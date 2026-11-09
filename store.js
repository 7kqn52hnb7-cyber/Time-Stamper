// データ保存レイヤー：Firebase（設定済みのとき）か、ローカル保存（未設定のとき）
import { firebaseConfig } from "./firebase-config.js";
import { t } from "./i18n.js";

const SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
export const DAY = 86400000;
// 画面で使う範囲（1か月さかのぼり＋比較用の前週ぶん）
const WINDOW_DAYS = 50;

export const DEFAULT_CATEGORIES = [
  ["トイレ", "#D7CCC8", "Toilet"], ["食事", "#FFB300", "Meals"], ["料理", "#FF7043", "Cooking"], ["勉強", "#FFD54F", "Study"],
  ["仕事", "#FF8F00", "Work"], ["移動", "#A1887F", "Commute"], ["家事", "#FFCC80", "Chores"], ["育児", "#F48FB1", "Childcare"],
  ["運動", "#F4511E", "Exercise"], ["入浴・身支度", "#FFE0B2", "Bath & Grooming"], ["休憩", "#BCAAA4", "Break"], ["必要スマホ", "#FFAB91", "Phone (needed)"],
  ["無駄スマホ", "#D84315", "Phone (wasted)"], ["読書", "#FFE082", "Reading"], ["買い物", "#8D6E63", "Shopping"], ["趣味", "#EF9A9A", "Hobby"],
].map(([name, color, en], i) => ({ id: "c" + (i + 1), name, color, en, hidden: false }));

// 初期カテゴリの英語名（名前を変えていなければ、言語に合わせて表示を切り替える）
export const DEFAULT_NAMES = Object.fromEntries(DEFAULT_CATEGORIES.map((c) => [c.id, { ja: c.name, en: c.en }]));

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

const hasFirebase = !!(firebaseConfig.apiKey && firebaseConfig.projectId);

class Store {
  constructor() {
    this.mode = hasFirebase ? "firebase" : "local";
    this.user = null;
    this.entries = new Map();
    this.categories = [];
    this.listeners = new Set();
    this.ready = false;
  }
  onChange(fn) { this.listeners.add(fn); }
  emit() { this.listeners.forEach((fn) => fn()); }
  list() { return [...this.entries.values()]; }

  async init(onAuth) {
    if (this.mode === "local") return this.#initLocal(onAuth);
    return this.#initFirebase(onAuth);
  }

  // ---------- ローカルモード ----------
  #initLocal(onAuth) {
    let data = null;
    try { data = JSON.parse(localStorage.getItem("ts_local") || "null"); } catch {}
    this.categories = data?.categories?.length ? data.categories : DEFAULT_CATEGORIES;
    (data?.entries || []).forEach((e) => this.entries.set(e.id, e));
    this.user = { label: "ローカルモード（この端末だけに保存）" };
    this.ready = true;
    onAuth(this.user);
    this.emit();
  }
  #saveLocal() {
    try {
      localStorage.setItem("ts_local", JSON.stringify({ entries: this.list(), categories: this.categories }));
    } catch {}
    this.emit();
  }

  // ---------- Firebase モード ----------
  async #initFirebase(onAuth) {
    const [{ initializeApp }, A, F] = await Promise.all([
      import(SDK + "firebase-app.js"),
      import(SDK + "firebase-auth.js"),
      import(SDK + "firebase-firestore.js"),
    ]);
    this.A = A; this.F = F;
    const app = initializeApp(firebaseConfig);
    this.auth = A.getAuth(app);
    await A.setPersistence(this.auth, A.browserLocalPersistence);
    try {
      this.db = F.initializeFirestore(app, {
        localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }),
      });
    } catch {
      this.db = F.getFirestore(app);
    }
    A.getRedirectResult(this.auth).catch(() => {});
    A.onAuthStateChanged(this.auth, (u) => {
      this.#unsub();
      this.entries.clear();
      this.categories = [];
      if (u) {
        this.user = { uid: u.uid, label: u.email || u.displayName || "ログイン中" };
        this.#subscribe(u.uid);
      } else {
        this.user = null;
      }
      onAuth(this.user);
      this.emit();
    });
  }
  #unsub() { (this.unsubs || []).forEach((f) => f()); this.unsubs = []; }
  #col() { return this.F.collection(this.db, "users", this.user.uid, "entries"); }
  #catDoc() { return this.F.doc(this.db, "users", this.user.uid, "settings", "categories"); }
  #subscribe(u) {
    const F = this.F;
    const cutoff = Date.now() - WINDOW_DAYS * DAY;
    const apply = (snap) => {
      snap.docChanges().forEach((c) => {
        if (c.type === "removed") this.entries.delete(c.doc.id);
        else this.entries.set(c.doc.id, { id: c.doc.id, ...c.doc.data() });
      });
      this.ready = true;
      this.emit();
    };
    const onErr = (e) => console.error(e);
    this.unsubs.push(F.onSnapshot(F.query(this.#col(), F.where("start", ">=", cutoff)), apply, onErr));
    this.unsubs.push(F.onSnapshot(F.query(this.#col(), F.where("end", "==", null)), apply, onErr));
    this.unsubs.push(F.onSnapshot(this.#catDoc(), (snap) => {
      if (snap.exists()) {
        this.categories = snap.data().items || [];
        this.emit();
      } else if (!snap.metadata.fromCache) {
        F.setDoc(this.#catDoc(), { items: DEFAULT_CATEGORIES });
      }
    }, onErr));
  }

  async signInGoogle() {
    const A = this.A;
    const p = new A.GoogleAuthProvider();
    try {
      await A.signInWithPopup(this.auth, p);
    } catch (e) {
      if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment"].includes(e.code)) {
        await A.signInWithRedirect(this.auth, p);
      } else throw e;
    }
  }
  signInEmail(email, pass) { return this.A.signInWithEmailAndPassword(this.auth, email, pass); }
  signOut() { return this.A.signOut(this.auth); }

  // ---------- 書き込み ----------
  // Firestore はオフラインでも即座に手元へ反映されるので await しない
  #write(promise) { promise?.catch?.((e) => { console.error(e); alert(t("save_failed") + e.message); }); }

  saveEntry(e) {
    e.updatedAt = Date.now();
    if (this.mode === "local") { this.entries.set(e.id, e); return this.#saveLocal(); }
    const { id, ...data } = e;
    this.#write(this.F.setDoc(this.F.doc(this.#col(), id), data));
  }
  deleteEntry(id) {
    if (this.mode === "local") { this.entries.delete(id); return this.#saveLocal(); }
    this.#write(this.F.deleteDoc(this.F.doc(this.#col(), id)));
  }
  saveCategories(items) {
    this.categories = items;
    if (this.mode === "local") return this.#saveLocal();
    this.emit();
    this.#write(this.F.setDoc(this.#catDoc(), { items }));
  }

  // CSV 用：期間指定で全件取得（表示範囲より古いデータも読む）
  async fetchRange(from, to) {
    if (this.mode === "local") return this.list().filter((e) => e.start < to && (e.end ?? Date.now()) > from);
    const F = this.F;
    // 日をまたぐ記録も拾うため、開始が1日前のものから取得
    const snap = await F.getDocs(F.query(this.#col(), F.where("start", ">=", from - DAY), F.where("start", "<", to)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((e) => (e.end ?? Date.now()) > from);
  }
}

export const store = new Store();

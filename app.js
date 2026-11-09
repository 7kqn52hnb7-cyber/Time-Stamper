import { store, DAY, uid, DEFAULT_NAMES } from "./store.js";
import { t, wd, getLang, setLang, applyStatic } from "./i18n.js";

const LONG_MS = 3 * 3600000;       // 3時間以上で「まだ続いていますか？」
const BACK_DAYS = 31;              // さかのぼれる最長日数
const PALETTE = ["#FFF3E0", "#FFE0B2", "#FFE082", "#FFD54F", "#FFCC80", "#FFB300", "#FF8F00", "#FFAB91",
  "#FF7043", "#F4511E", "#D84315", "#EF9A9A", "#F48FB1", "#D7CCC8", "#BCAAA4", "#A1887F", "#8D6E63"];

let QUOTES = [];
import("./quotes.js").then((m) => { QUOTES = m.QUOTES || []; render(); maybeShowQuote(); }).catch(() => {});

// ---------- helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const sod = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const addDays = (t, n) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); };
const weekStart = (t) => addDays(sod(t), -new Date(t).getDay());
const hm = (t) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const md = (t) => { const d = new Date(t); return getLang() === "en" ? `${wd(d.getDay())} ${d.getMonth() + 1}/${d.getDate()}` : `${d.getMonth() + 1}/${d.getDate()}(${wd(d.getDay())})`; };
const ymd = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const dtLocal = (t) => `${ymd(t)}T${hm(t)}`;
const dayKey = () => ymd(Date.now());
function dur(ms) {
  const m = Math.round(Math.abs(ms) / 60000);
  const h = Math.floor(m / 60);
  if (getLang() === "en") return h ? `${h}h ${pad(m % 60)}m` : `${m}m`;
  return h ? `${h}時間${pad(m % 60)}分` : `${m}分`;
}
function timer(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
}
function diffLabel(ms) {
  const m = Math.round(ms / 60000);
  if (m === 0) return ["±0", "same"];
  return m > 0 ? [`▲ ${dur(ms)}`, "up"] : [`▼ ${dur(ms)}`, "down"];
}
const ls = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const cats = () => store.categories;
// 初期カテゴリで名前を変えていなければ、言語に合わせた名前を出す
function catName(c) {
  const def = DEFAULT_NAMES[c.id];
  if (def && c.name === def.ja) return def[getLang()];
  return c.name;
}
const catOf = (id) => {
  const c = cats().find((x) => x.id === id);
  return c ? { ...c, label: catName(c) } : { id, label: t("deleted_cat"), color: "#5c5752" };
};
const running = () => store.list().filter((e) => e.end == null).sort((a, b) => a.start - b.start);

// 期間 [from, to) に重なる記録を切り取って返す
function clipped(from, to) {
  const now = Date.now();
  const out = [];
  for (const e of store.list()) {
    const s = Math.max(e.start, from), en = Math.min(e.end ?? now, to);
    if (en > s) out.push({ e, s, en });
  }
  return out.sort((a, b) => a.s - b.s);
}
function totals(from, to) {
  const m = new Map();
  for (const c of clipped(from, to)) m.set(c.e.cat, (m.get(c.e.cat) || 0) + (c.en - c.s));
  return m;
}

// ---------- state ----------
const state = {
  tab: "record",
  day: sod(Date.now()),
  week: weekStart(Date.now()),
  openPalette: null,
};
const minDay = () => addDays(sod(Date.now()), -BACK_DAYS);

// ---------- boot ----------
applyStatic();
store.onChange(() => render());
store.init((user) => {
  $("#boot").hidden = true;
  $("#login").hidden = !!user;
  $("#app").hidden = !user;
  if (user) maybeShowQuote();
}).catch((e) => {
  $("#boot").textContent = t("load_failed") + e.message;
});

$("#btn-google").onclick = async () => {
  $("#login-error").textContent = "";
  try { await store.signInGoogle(); } catch (e) { $("#login-error").textContent = e.message; }
};
$("#form-email").onsubmit = async (ev) => {
  ev.preventDefault();
  $("#login-error").textContent = "";
  try { await store.signInEmail($("#login-email").value, $("#login-pass").value); }
  catch (e) { $("#login-error").textContent = `${t("login_failed")}（${e.code}）`; }
};

$$(".tabs button").forEach((b) => (b.onclick = () => {
  state.tab = b.dataset.tab;
  $$(".tabs button").forEach((x) => x.classList.toggle("active", x === b));
  $$(".view").forEach((v) => (v.hidden = v.id !== "view-" + state.tab));
  if (state.tab === "daily") state.day = Math.max(state.day, minDay());
  render();
  window.scrollTo(0, 0);
}));

// 1秒ごとの更新（タイマーだけ書き換え、日付が変わったら全体を描き直す）
const tickClock = () => { $("#clock").textContent = `${md(Date.now())} ${hm(Date.now())}`; };
let lastDay = dayKey();
setInterval(() => {
  const now = Date.now();
  tickClock();
  $$("[data-timer]").forEach((el) => (el.textContent = timer(now - +el.dataset.timer)));
  if (dayKey() !== lastDay) { lastDay = dayKey(); render(); maybeShowQuote(); }
}, 1000);
tickClock();

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") { render(); maybeShowQuote(); }
});

// ---------- render ----------
function render() {
  if (!store.user) return;
  const v = state.tab;
  if (v === "record") renderRecord();
  if (v === "daily") renderDaily();
  if (v === "weekly") renderWeekly();
  if (v === "settings") renderSettings();
}

function todayQuote() {
  if (!QUOTES.length) return null;
  const d = new Date();
  const doy = Math.floor((sod(d) - new Date(d.getFullYear(), 0, 1).getTime()) / DAY);
  return QUOTES[doy % QUOTES.length];
}

function renderRecord() {
  const el = $("#view-record");
  // 入力中のメモは描き直しで消さない
  if (el.contains(document.activeElement) && document.activeElement.classList.contains("memo")) return;
  const now = Date.now();
  const run = running();
  const q = todayQuote();
  const dismissed = ls.get("ts_long_ok", []);
  const longOnes = run.filter((e) => now - e.start >= LONG_MS && !dismissed.includes(e.id));
  const today = sod(now);
  const list = clipped(today, addDays(today, 1)).sort((a, b) => b.s - a.s);

  el.innerHTML = `
    ${q ? `<div class="quote-strip">${esc(q.t)}<span class="who">— ${esc(q.a)}</span></div>` : ""}
    ${longOnes.map((e) => `
      <div class="alert">
        ${esc(t("long_alert", catOf(e.cat).label, hm(e.start)))}
        <div class="row">
          <button class="btn small" data-long-ok="${e.id}">${t("still_going")}</button>
          <button class="btn small" data-edit="${e.id}">${t("fix_time")}</button>
        </div>
      </div>`).join("")}

    <div class="label">Recording <span class="jp">${run.length ? `${t("recording")} ${t("count", run.length)}` : ""}</span></div>
    <div class="running">
      ${run.length ? run.map((e) => {
        const c = catOf(e.cat);
        return `
        <div class="run ${now - e.start >= LONG_MS ? "long" : ""}" style="--c:${c.color}">
          <div class="name"><span class="dot" style="background:${c.color}"></span>${esc(c.label)}
            <span class="since">${hm(e.start)}〜</span></div>
          <div class="timer" data-timer="${e.start}">${timer(now - e.start)}</div>
          <button class="end" data-end="${e.id}">END</button>
          <input class="memo" data-memo="${e.id}" placeholder="${t("memo")}" value="${esc(e.memo)}" enterkeyhint="done">
        </div>`;
      }).join("") : `<div class="card empty">${t("empty_running")}</div>`}
    </div>

    <div class="label">Start <span class="jp">${t("start_hint")}</span></div>
    <div class="grid">
      ${cats().filter((c) => !c.hidden).map((c) => {
        const r = run.filter((e) => e.cat === c.id).pop();
        return `<button class="cat ${r ? "on" : ""}" style="--c:${c.color}" data-cat="${c.id}">
          <span class="dot" style="background:${c.color}"></span>${esc(catName(c))}
          ${r ? `<span class="mini" data-timer="${r.start}">${timer(now - r.start)}</span>` : ""}
        </button>`;
      }).join("")}
    </div>

    <div class="label">Today <span class="jp"><button class="link-btn" data-add="${today}">${t("add_manual")}</button></span></div>
    <div class="card entries">${entryRows(list) || `<div class="empty">${t("no_records_yet")}</div>`}</div>
  `;

  $$("[data-cat]", el).forEach((b) => (b.onclick = () => toggleCat(b.dataset.cat)));
  $$("[data-end]", el).forEach((b) => (b.onclick = () => endEntry(b.dataset.end)));
  $$("[data-memo]", el).forEach((i) => {
    const save = () => {
      const e = store.entries.get(i.dataset.memo);
      if (e && (e.memo || "") !== i.value) store.saveEntry({ ...e, memo: i.value });
    };
    i.onchange = save; i.onblur = () => { save(); setTimeout(render, 0); };
    i.onkeydown = (ev) => { if (ev.key === "Enter") i.blur(); };
  });
  $$("[data-long-ok]", el).forEach((b) => (b.onclick = () => {
    ls.set("ts_long_ok", [...ls.get("ts_long_ok", []).slice(-50), b.dataset.longOk]);
    render();
  }));
  bindEntryEvents(el);
}

function entryRows(list) {
  return list.map(({ e, s, en }) => {
    const c = catOf(e.cat);
    const isRun = e.end == null;
    return `<button class="entry" data-edit="${e.id}">
      <span class="time">${hm(s)}–${isRun ? "" : hm(en)}</span>
      <span class="what"><span class="dot" style="background:${c.color}"></span>
        <span class="t">${esc(c.label)}</span>${e.memo ? `<span class="m">${esc(e.memo)}</span>` : ""}</span>
      ${isRun ? `<span class="now">${t("now")}</span>` : `<span class="dur">${dur(en - s)}</span>`}
    </button>`;
  }).join("");
}
function bindEntryEvents(el) {
  $$("[data-edit]", el).forEach((b) => (b.onclick = () => openEditor(store.entries.get(b.dataset.edit))));
  $$("[data-add]", el).forEach((b) => (b.onclick = () => openEditor(null, +b.dataset.add)));
}

// ---------- record actions ----------
function toggleCat(catId) {
  const r = running().filter((e) => e.cat === catId).pop();
  if (r) return endEntry(r.id);
  const e = { id: uid(), cat: catId, start: Date.now(), end: null, memo: "", createdAt: Date.now() };
  store.saveEntry(e);
  toast(t("started", catOf(catId).label), () => store.deleteEntry(e.id));
}
function endEntry(id) {
  const e = store.entries.get(id);
  if (!e) return;
  const before = { ...e };
  store.saveEntry({ ...e, end: Date.now() });
  toast(t("ended", catOf(e.cat).label, dur(Date.now() - e.start)), () => store.saveEntry(before));
}

let toastTimer;
function toast(msg, undo) {
  const el = $("#toast");
  el.innerHTML = `<span>${esc(msg)}</span>${undo ? `<button>${t("undo")}</button>` : ""}`;
  el.hidden = false;
  if (undo) el.querySelector("button").onclick = () => { undo(); el.hidden = true; };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 4000);
}

// ---------- editor ----------
function openEditor(entry, dayStart) {
  const isNew = !entry;
  let start, end;
  if (isNew) {
    const today = sod(Date.now());
    if (!dayStart || dayStart === today) {
      end = Math.floor(Date.now() / 60000) * 60000;
      start = end - 30 * 60000;
    } else {
      start = dayStart + 12 * 3600000;
      end = start + 30 * 60000;
    }
  } else {
    start = entry.start;
    end = entry.end;
  }
  const isRun = !isNew && entry.end == null;
  const curCat = entry?.cat || cats().find((c) => !c.hidden)?.id;
  $("#sheet").innerHTML = `
    <h3>${isNew ? t("add_title") : t("edit_title")}</h3>
    <label class="field"><span>${t("category")}</span>
      <select class="in" id="ed-cat">
        ${cats().map((c) => `<option value="${c.id}" ${c.id === curCat ? "selected" : ""}>${esc(catName(c))}${c.hidden ? t("hidden_mark") : ""}</option>`).join("")}
      </select></label>
    <label class="field"><span>${t("start")}</span><input class="in" type="datetime-local" id="ed-start" value="${dtLocal(start)}"></label>
    <label class="field"><span>${t("end")}</span><input class="in" type="datetime-local" id="ed-end" value="${end ? dtLocal(end) : ""}" ${isRun ? "disabled" : ""}></label>
    ${isRun ? `<label class="check"><input type="checkbox" id="ed-running" checked> ${t("still_running")}</label>` : ""}
    <label class="field"><span>${t("memo")}</span><textarea class="in" id="ed-memo" rows="2">${esc(entry?.memo)}</textarea></label>
    <p class="error" id="ed-err"></p>
    <div class="actions">
      ${isNew ? "" : `<button class="btn danger" id="ed-del">${t("del")}</button>`}
      <span class="spacer"></span>
      <button class="btn ghost" id="ed-cancel">${t("cancel")}</button>
      <button class="btn primary" id="ed-save">${t("save")}</button>
    </div>`;
  $("#modal").hidden = false;
  const close = () => ($("#modal").hidden = true);
  $("#modal").onclick = (ev) => { if (ev.target.id === "modal") close(); };
  $("#ed-cancel").onclick = close;
  const runBox = $("#ed-running");
  if (runBox) runBox.onchange = () => {
    $("#ed-end").disabled = runBox.checked;
    if (!runBox.checked && !$("#ed-end").value) $("#ed-end").value = dtLocal(Date.now());
  };
  if (!isNew) $("#ed-del").onclick = () => {
    if (!confirm(t("confirm_del"))) return;
    const backup = { ...entry };
    store.deleteEntry(entry.id);
    close();
    toast(t("deleted"), () => store.saveEntry(backup));
  };
  $("#ed-save").onclick = () => {
    const s = new Date($("#ed-start").value).getTime();
    const stillRunning = runBox?.checked;
    const en = stillRunning ? null : new Date($("#ed-end").value).getTime();
    const err = $("#ed-err");
    if (!s) return (err.textContent = t("err_start"));
    if (!stillRunning && !en) return (err.textContent = t("err_end"));
    if (en != null && en <= s) return (err.textContent = t("err_order"));
    if (s > Date.now() + 60000 || (en ?? 0) > Date.now() + 60000) return (err.textContent = t("err_future"));
    store.saveEntry({
      ...(entry || { id: uid(), createdAt: Date.now() }),
      cat: $("#ed-cat").value, start: s, end: en, memo: $("#ed-memo").value.trim(),
    });
    close();
  };
}

// ---------- daily ----------
function renderDaily() {
  const el = $("#view-daily");
  const d = state.day, next = addDays(d, 1);
  const today = sod(Date.now());
  const prev = addDays(d, -7);
  const list = clipped(d, next);
  const cur = totals(d, next), old = totals(prev, addDays(prev, 1));
  const sum = [...cur.values()].reduce((a, b) => a + b, 0);

  el.innerHTML = `
    <div class="nav">
      <button id="d-prev" ${addDays(d, -1) < minDay() ? "disabled" : ""}>‹</button>
      <div class="title"><div class="main">${md(d)}</div><div class="sub">${d === today ? t("today") : new Date(d).getFullYear()}</div></div>
      <button id="d-next" ${next > today ? "disabled" : ""}>›</button>
    </div>

    <div class="label">Total <span class="jp">${t("total_note")}</span></div>
    <div class="card stat"><span class="big">${dur(sum)}</span><span class="small">${t("count", list.length)}</span></div>

    <div class="label">Timeline <span class="jp">0:00–24:00</span></div>
    <div class="card">${timeline(list, d)}</div>

    <div class="label">Compare <span class="jp">${t("cmp_daily", md(prev))}</span></div>
    <div class="card">${compare(cur, old, t("this_day"), t("last_week"))}</div>

    <div class="label">Records <span class="jp"><button class="link-btn" data-add="${d}">${t("add_manual")}</button></span></div>
    <div class="card entries">${entryRows([...list].sort((a, b) => a.s - b.s)) || `<div class="empty">${t("no_records")}</div>`}</div>
  `;
  $("#d-prev").onclick = () => { state.day = addDays(d, -1); render(); };
  $("#d-next").onclick = () => { state.day = next; render(); };
  bindEntryEvents(el);
}

function timeline(list, d) {
  if (!list.length) return `<div class="empty">${t("no_records")}</div>`;
  const span = addDays(d, 1) - d;
  const lanes = [];
  for (const it of list) {
    let i = lanes.findIndex((end) => end <= it.s);
    if (i < 0) { i = lanes.length; lanes.push(0); }
    lanes[i] = it.en;
    it.lane = i;
  }
  const pct = (x) => ((x - d) / span) * 100;
  const now = Date.now();
  const grid = [0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => `<div class="grid-line" style="left:${(h / 24) * 100}%"></div>`).join("");
  return `<div class="timeline">
    <div class="axis">${[0, 6, 12, 18, 24].map((h) => `<span style="left:${(h / 24) * 100}%">${h}</span>`).join("")}</div>
    <div class="lanes">
      ${lanes.map((_, i) => `<div class="lane">${grid}${list.filter((x) => x.lane === i).map((x) => {
        const c = catOf(x.e.cat);
        return `<div class="blk" title="${esc(c.label)} ${hm(x.s)}–${hm(x.en)}" style="left:${pct(x.s)}%;width:${pct(x.en) - pct(x.s)}%;background:${c.color}"></div>`;
      }).join("")}</div>`).join("")}
      ${now > d && now < d + span ? `<div class="now-line" style="left:${pct(now)}%"></div>` : ""}
    </div>
  </div>`;
}

function compare(cur, old, curLabel, oldLabel) {
  const ids = new Set([...cur.keys(), ...old.keys()]);
  if (!ids.size) return `<div class="empty">${t("nothing_to_compare")}</div>`;
  const rows = [...ids].map((id) => ({ id, a: cur.get(id) || 0, b: old.get(id) || 0 }))
    .sort((x, y) => y.a - x.a || y.b - x.b);
  const max = Math.max(...rows.map((r) => Math.max(r.a, r.b)), 1);
  return `
    <div class="legend"><span><i style="background:var(--grad)"></i>${curLabel}</span><span><i style="background:var(--faint)"></i>${oldLabel}</span></div>
    <div class="cmp">${rows.map((r) => {
      const c = catOf(r.id);
      const [txt, cls] = diffLabel(r.a - r.b);
      return `<div class="row" style="--c:${c.color}">
        <span class="n"><span class="dot" style="background:${c.color}"></span>${esc(c.label)}</span>
        <span class="v">${dur(r.a)}<small>${oldLabel} ${dur(r.b)}</small></span>
        <span class="d ${cls}">${txt}</span>
        <div class="bars">
          <div class="bar" style="width:${(r.a / max) * 100}%"></div>
          <div class="bar prev" style="width:${(r.b / max) * 100}%"></div>
        </div>
      </div>`;
    }).join("")}</div>`;
}

// ---------- weekly ----------
function renderWeekly() {
  const el = $("#view-weekly");
  const ws = state.week;
  const today = sod(Date.now());
  const thisWeek = weekStart(Date.now());
  const isCurrent = ws === thisWeek;
  const days = isCurrent ? Math.round((today - ws) / DAY) + 1 : 7;
  const end = addDays(ws, days);
  const pws = addDays(ws, -7), pend = addDays(pws, days);
  const cur = totals(ws, end), old = totals(pws, pend);
  const sa = [...cur.values()].reduce((a, b) => a + b, 0);
  const sb = [...old.values()].reduce((a, b) => a + b, 0);
  const [dt, dc] = diffLabel(sa - sb);
  const minWeek = weekStart(minDay());

  el.innerHTML = `
    <div class="nav">
      <button id="w-prev" ${addDays(ws, -7) < minWeek ? "disabled" : ""}>‹</button>
      <div class="title"><div class="main">${md(ws)} – ${md(addDays(ws, 6))}</div>
        <div class="sub">${isCurrent ? t("this_week") : new Date(ws).getFullYear()}</div></div>
      <button id="w-next" ${isCurrent ? "disabled" : ""}>›</button>
    </div>

    <div class="label">Total <span class="jp">${isCurrent ? t("week_span", days) : t("vs_last_week")}</span></div>
    <div class="card stat">
      <span class="big">${dur(sa)}</span>
      <span class="small">${t("last_week")} ${dur(sb)}　<span style="color:var(--${dc === "same" ? "faint" : dc})">${dt}</span></span>
    </div>

    <div class="label">By category <span class="jp">${t("cmp_range", md(pws), md(addDays(pend, -1)))}</span></div>
    <div class="card">${compare(cur, old, t("this_week"), t("last_week"))}</div>
  `;
  $("#w-prev").onclick = () => { state.week = addDays(ws, -7); render(); };
  $("#w-next").onclick = () => { state.week = addDays(ws, 7); render(); };
}

// ---------- settings ----------
function renderSettings() {
  const el = $("#view-settings");
  if (el.contains(document.activeElement) && document.activeElement.matches("input[type=text], input[type=date]")) return;
  const list = cats();
  const now = Date.now();
  const firstOfMonth = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();
  el.innerHTML = `
    <div class="label">Language <span class="jp">${t("language")}</span></div>
    <div class="seg">
      <button data-lang="ja" class="${getLang() === "ja" ? "on" : ""}">日本語</button>
      <button data-lang="en" class="${getLang() === "en" ? "on" : ""}">English</button>
    </div>

    <div class="label">Account <span class="jp">${t("account")}</span></div>
    <div class="card set-row" style="border:1px solid var(--line)">
      <span style="flex:1;font-size:13px">${esc(store.mode === "local" ? t("local_mode") : store.user?.label)}</span>
      ${store.mode === "firebase" ? `<button class="btn small" id="s-logout">${t("logout")}</button>` : ""}
    </div>

    <div class="label">Categories <span class="jp">${t("cat_hint")}</span></div>
    <div class="card">
      ${list.map((c, i) => `
        <div class="set-row ${c.hidden ? "off" : ""}">
          <button class="swatch" style="--c:${c.color}" data-sw="${c.id}" aria-label="${t("color")}"></button>
          <input type="text" value="${esc(catName(c))}" data-name="${c.id}" maxlength="20">
          <button class="icon-btn" data-up="${i}" ${i === 0 ? "disabled" : ""} aria-label="${t("up")}">↑</button>
          <button class="icon-btn" data-down="${i}" ${i === list.length - 1 ? "disabled" : ""} aria-label="${t("down")}">↓</button>
          <button class="btn small ghost" data-hide="${c.id}">${c.hidden ? t("show") : t("hide")}</button>
        </div>
        ${state.openPalette === c.id ? `<div class="palette">${PALETTE.map((p) =>
          `<button style="--c:${p}" class="${p === c.color ? "sel" : ""}" data-pick="${p}"></button>`).join("")}</div>` : ""}
      `).join("")}
      <form class="add-row" id="s-add">
        <input class="in" id="s-new" placeholder="${t("new_cat")}" maxlength="20">
        <button class="btn">${t("add")}</button>
      </form>
    </div>

    <div class="label">Export <span class="jp">${t("export_hint")}</span></div>
    <div class="card">
      <div class="two">
        <label class="field"><span>${t("from")}</span><input class="in" type="date" id="x-from" value="${ymd(firstOfMonth)}"></label>
        <label class="field"><span>${t("to")}</span><input class="in" type="date" id="x-to" value="${ymd(now)}"></label>
      </div>
      <button class="btn primary wide" id="x-go">${t("export_btn")}</button>
    </div>

    <p class="muted" style="font-size:11px;text-align:center;margin-top:28px">Time Stamper · ${store.mode === "firebase" ? t("sync_cloud") : t("sync_local")}</p>
  `;

  const save = (items) => store.saveCategories(items);
  $$("[data-lang]", el).forEach((b) => (b.onclick = () => { setLang(b.dataset.lang); tickClock(); render(); }));
  $("#s-logout")?.addEventListener("click", () => { if (confirm(t("confirm_logout"))) store.signOut(); });
  $$("[data-name]", el).forEach((i) => (i.onchange = () => {
    const v = i.value.trim();
    const c = cats().find((x) => x.id === i.dataset.name);
    if (!v) { i.value = catName(c); return; }
    if (v === catName(c)) return; // 表示名のままなら変更なし（言語切り替えを保つ）
    save(cats().map((x) => (x.id === c.id ? { ...x, name: v } : x)));
  }));
  const move = (i, d) => { const a = [...cats()]; [a[i], a[i + d]] = [a[i + d], a[i]]; save(a); };
  $$("[data-up]", el).forEach((b) => (b.onclick = () => move(+b.dataset.up, -1)));
  $$("[data-down]", el).forEach((b) => (b.onclick = () => move(+b.dataset.down, 1)));
  $$("[data-hide]", el).forEach((b) => (b.onclick = () =>
    save(cats().map((c) => (c.id === b.dataset.hide ? { ...c, hidden: !c.hidden } : c)))));
  $$("[data-sw]", el).forEach((b) => (b.onclick = () => {
    state.openPalette = state.openPalette === b.dataset.sw ? null : b.dataset.sw; render();
  }));
  $$("[data-pick]", el).forEach((b) => (b.onclick = () => {
    const id = state.openPalette; state.openPalette = null;
    save(cats().map((c) => (c.id === id ? { ...c, color: b.dataset.pick } : c)));
  }));
  $("#s-add").onsubmit = (ev) => {
    ev.preventDefault();
    const name = $("#s-new").value.trim();
    if (!name) return;
    const used = new Set(cats().map((c) => c.color));
    const color = PALETTE.find((p) => !used.has(p)) || PALETTE[cats().length % PALETTE.length];
    $("#s-new").value = "";
    $("#s-new").blur();
    save([...cats(), { id: "c" + uid().slice(0, 8), name, color, hidden: false }]);
    toast(t("added", name));
  };
  $("#x-go").onclick = exportCsv;
}

async function exportCsv() {
  const fromV = $("#x-from").value, toV = $("#x-to").value;
  if (!fromV || !toV) return alert(t("need_range"));
  const from = new Date(fromV + "T00:00").getTime();
  const to = addDays(new Date(toV + "T00:00").getTime(), 1);
  if (to <= from) return alert(t("bad_range"));
  let rows;
  try { rows = await store.fetchRange(from, to); } catch (e) { return alert(t("load_failed") + e.message); }
  rows = rows.filter((e) => e.start >= from).sort((a, b) => a.start - b.start);
  const q = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const fmt = (x) => `${ymd(x).replace(/-/g, "/")} ${hm(x)}`;
  const lines = [t("csv_head").join(",")];
  for (const e of rows) {
    lines.push([
      ymd(e.start).replace(/-/g, "/"), wd(new Date(e.start).getDay()), q(catOf(e.cat).label),
      fmt(e.start), e.end ? fmt(e.end) : t("csv_running"),
      e.end ? Math.round((e.end - e.start) / 60000) : "", q(e.memo),
    ].join(","));
  }
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `TimeStamper_${fromV}_${toV}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast(t("exported", rows.length));
}

// ---------- quote overlay（その日の最初に開いたとき。名言は日本語のまま） ----------
function maybeShowQuote() {
  if (!store.user) return;
  const q = todayQuote();
  if (!q || ls.get("ts_quote_day", "") === dayKey()) return;
  ls.set("ts_quote_day", dayKey());
  const o = $("#quote-overlay");
  const d = new Date();
  o.innerHTML = `
    <div class="date">${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]}</div>
    <div class="mark">“</div>
    <div class="q">${esc(q.t)}</div>
    <div class="who">${esc(q.a)}<small>${esc(q.d)}</small></div>
    <div class="tap">${t("tap_start")}</div>`;
  o.hidden = false;
  o.onclick = () => (o.hidden = true);
}

// ---------- service worker ----------
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

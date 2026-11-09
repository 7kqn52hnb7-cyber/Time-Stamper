// 日本語・英語の切り替え（言語は端末ごとに保存）
const DICT = {
  ja: {
    tab_record: "記録", tab_daily: "Daily", tab_weekly: "Weekly", tab_settings: "設定",
    tagline: "自分の時間を、正確に。", login_google: "Google でログイン", login_email: "メールアドレスでログイン",
    email: "メールアドレス", password: "パスワード", login: "ログイン", login_failed: "ログインできませんでした",
    load_failed: "読み込みに失敗しました：", save_failed: "保存に失敗しました：",
    long_alert: (n, t) => `「${n}」の記録が ${t} から3時間以上続いています。まだ続いていますか？`,
    still_going: "続いている", fix_time: "時刻を直す",
    recording: "記録中", count: (n) => `${n}件`, memo: "メモ", empty_running: "下のボタンを押すとスタートします",
    start_hint: "押してスタート／もう一度押すとエンド", add_manual: "＋ 手動で追加", no_records_yet: "まだ記録がありません",
    no_records: "記録がありません", now: "記録中", started: (n) => `${n} をスタート`, ended: (n, d) => `${n} を終了（${d}）`,
    undo: "取り消す", add_title: "記録を追加", edit_title: "記録を編集", category: "カテゴリ", start: "開始", end: "終了",
    hidden_mark: "（非表示）", still_running: "記録中（まだ終わっていない）", del: "削除", cancel: "キャンセル", save: "保存",
    confirm_del: "この記録を削除します。よろしいですか？", deleted: "記録を削除しました",
    err_start: "開始時刻を入れてください", err_end: "終了時刻を入れてください", err_order: "終了は開始より後にしてください",
    err_future: "未来の時刻は入れられません", today: "今日", this_week: "今週",
    total_note: "記録した時間（同時記録は重複して数えます）",
    cmp_daily: (d) => `先週の同じ曜日 ${d} と比較`, this_day: "この日", last_week: "先週",
    nothing_to_compare: "比べる記録がありません",
    week_span: (n) => `日曜〜今日の${n}日間を先週の同じ${n}日間と比較`, vs_last_week: "先週と比較",
    cmp_range: (a, b) => `${a}〜${b} と比較`, deleted_cat: "（削除済み）",
    account: "アカウント", logout: "ログアウト", confirm_logout: "ログアウトしますか？", local_mode: "ローカルモード（この端末だけに保存）",
    cat_hint: "名前はタップして編集", show: "表示", hide: "非表示", new_cat: "新しいカテゴリ", add: "追加",
    added: (n) => `「${n}」を追加しました`, color: "色を変える", up: "上へ", down: "下へ",
    export_hint: "CSV 書き出し（Excel で開けます）", from: "開始日", to: "終了日", export_btn: "CSV を書き出す",
    need_range: "期間を入れてください", bad_range: "終了日は開始日以降にしてください", exported: (n) => `${n}件を書き出しました`,
    language: "言語", sync_cloud: "クラウド同期", sync_local: "ローカル保存", tap_start: "タップして始める",
    ptr_pull: "引っ張って更新", ptr_release: "離して更新", ptr_loading: "更新中…",
    csv_head: ["日付", "曜日", "カテゴリ", "開始", "終了", "時間(分)", "メモ"], csv_running: "記録中",
  },
  en: {
    tab_record: "Log", tab_daily: "Daily", tab_weekly: "Weekly", tab_settings: "Settings",
    tagline: "Know exactly where your time goes.", login_google: "Sign in with Google", login_email: "Sign in with email",
    email: "Email", password: "Password", login: "Sign in", login_failed: "Could not sign in",
    load_failed: "Failed to load: ", save_failed: "Failed to save: ",
    long_alert: (n, t) => `"${n}" has been running since ${t} (3h+). Still going?`,
    still_going: "Still going", fix_time: "Fix time",
    recording: "Recording", count: (n) => `${n}`, memo: "Note", empty_running: "Tap a category below to start",
    start_hint: "Tap to start / tap again to end", add_manual: "+ Add manually", no_records_yet: "No records yet",
    no_records: "No records", now: "Running", started: (n) => `Started ${n}`, ended: (n, d) => `Ended ${n} (${d})`,
    undo: "Undo", add_title: "Add record", edit_title: "Edit record", category: "Category", start: "Start", end: "End",
    hidden_mark: " (hidden)", still_running: "Still running", del: "Delete", cancel: "Cancel", save: "Save",
    confirm_del: "Delete this record?", deleted: "Record deleted",
    err_start: "Enter a start time", err_end: "Enter an end time", err_order: "End must be after start",
    err_future: "Future times are not allowed", today: "Today", this_week: "This week",
    total_note: "Recorded time (overlaps counted separately)",
    cmp_daily: (d) => `vs. same day last week (${d})`, this_day: "This day", last_week: "Last week",
    nothing_to_compare: "Nothing to compare",
    week_span: (n) => `First ${n} day(s) vs. the same days last week`, vs_last_week: "vs. last week",
    cmp_range: (a, b) => `vs. ${a} – ${b}`, deleted_cat: "(deleted)",
    account: "Account", logout: "Sign out", confirm_logout: "Sign out?", local_mode: "Local mode (this device only)",
    cat_hint: "Tap a name to edit", show: "Show", hide: "Hide", new_cat: "New category", add: "Add",
    added: (n) => `Added "${n}"`, color: "Change color", up: "Move up", down: "Move down",
    export_hint: "CSV export (opens in Excel)", from: "From", to: "To", export_btn: "Export CSV",
    need_range: "Enter a date range", bad_range: "End date must be on or after start date", exported: (n) => `Exported ${n} records`,
    language: "Language", sync_cloud: "Cloud sync", sync_local: "Local storage", tap_start: "Tap to begin",
    ptr_pull: "Pull to refresh", ptr_release: "Release to refresh", ptr_loading: "Refreshing…",
    csv_head: ["Date", "Day", "Category", "Start", "End", "Minutes", "Note"], csv_running: "Running",
  },
};
const WD = { ja: ["日", "月", "火", "水", "木", "金", "土"], en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] };

let lang = "ja";
try { lang = localStorage.getItem("ts_lang") === "en" ? "en" : "ja"; } catch {}

export const getLang = () => lang;
export function setLang(l) {
  lang = l;
  try { localStorage.setItem("ts_lang", l); } catch {}
  applyStatic();
}
export function t(key, ...args) {
  const v = DICT[lang][key] ?? DICT.ja[key] ?? key;
  return typeof v === "function" ? v(...args) : v;
}
export const wd = (i) => WD[lang][i];

// HTML に直接書いてある文字（data-i18n / data-i18n-ph）を切り替える
export function applyStatic() {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => (el.placeholder = t(el.dataset.i18nPh)));
}

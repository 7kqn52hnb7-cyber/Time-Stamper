// ネット優先・つながらないときは保存済みのファイルで起動
const CACHE = "dowhat-v6";
const SHELL = ["./", "index.html", "style.css", "app.js", "store.js", "i18n.js", "firebase-config.js", "quotes.js",
  "manifest.webmanifest", "icons/icon-192.png", "icons/apple-touch-icon.png", "icons/launch.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  const sameOrigin = url.origin === location.origin;
  const sdk = url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/");
  if (!sameOrigin && !sdk) return; // Firebase の通信そのものには触らない
  e.respondWith(
    // 自分のファイルはブラウザの一時保存を使わず毎回サーバーに確認（更新がすぐ届くように）
    fetch(sameOrigin ? new Request(e.request, { cache: "no-cache" }) : e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});

/* Seiva — service worker. Troque VERSION a cada atualização para o app baixar a nova versão. */
const VERSION = "seiva-1.1-261104d";
const SHELL = ["./", "index.html", "bridge.js", "firebase-config.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-180.png", "icons/favicon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  // dados e login nunca passam pelo cache
  if (/googleapis\.com|firebaseio|identitytoolkit|securetoken|api\.open-meteo\.com|spotify\.com|bigdatacloud/.test(url.host)) return;
  // páginas: tenta a rede primeiro (pega atualizações), cai no cache sem internet
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(VERSION).then(c => c.put("index.html", cp)); return r; }).catch(() => caches.match("index.html")));
    return;
  }
  // arquivos estáticos (inclui fontes e o SDK do Firebase): cache primeiro
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok && (url.origin === location.origin || /gstatic\.com|fonts\.googleapis\.com/.test(url.host))) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(req, cp)); }
    return r;
  })));
});

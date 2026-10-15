// Service worker : garde l'app en cache pour qu'elle marche hors ligne.
// Stratégie « cache d'abord, mise à jour en arrière-plan » : l'app s'ouvre
// instantanément depuis le cache et la version suivante est récupérée en
// tâche de fond quand le réseau est là. Changer VERSION force un nouveau cache.

const VERSION = "v2";
const CACHE = `webdebug-${VERSION}`;
const FICHIERS = [
  "./",
  "index.html",
  "css/style.css",
  "js/app.js",
  "js/analyse.js",
  "data/commandes.js",
  "data/parcours.js",
  "manifest.webmanifest",
  "icones/icone.svg",
  "icones/icone-192.png",
  "icones/icone-512.png",
  "js/outils.js",
  "data/ports.js",
  "data/oui.js",
];

self.addEventListener("install", (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((c) => c.startsWith("webdebug-") && c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (ev) => {
  if (ev.request.method !== "GET" || new URL(ev.request.url).origin !== self.location.origin) return;
  ev.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const enCache = await cache.match(ev.request, { ignoreSearch: true });
      const reseau = fetch(ev.request)
        .then((rep) => {
          if (rep.ok) cache.put(ev.request, rep.clone());
          return rep;
        })
        .catch(() => enCache);
      if (enCache) {
        ev.waitUntil(reseau);
        return enCache;
      }
      return reseau;
    })
  );
});

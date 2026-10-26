/* Service worker : sert la doc depuis le cache (hors-ligne), sinon depuis le réseau. */
"use strict";
var CACHE = "godot-docs-aaf2688d";

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    (async function () {
      var keys = await caches.keys();
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].indexOf("godot-docs-") === 0 && keys[i] !== CACHE) await caches.delete(keys[i]);
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // l'application Value Bet (dossier value-bet/) a son propre service worker : ne pas l'intercepter
  if (url.pathname.indexOf("/value-bet/") !== -1) return;
  // sw.js et precache.json doivent toujours venir du réseau quand il est disponible
  var base = url.pathname.split("/").pop();
  if (base === "sw.js" || base === "precache.json") return;

  event.respondWith(
    (async function () {
      var cache = await caches.open(CACHE);
      var hit = await cache.match(req, { ignoreSearch: true });
      if (!hit && url.pathname.slice(-1) === "/") {
        hit = await cache.match(url.pathname + "index.html", { ignoreSearch: true });
      }
      if (hit) return hit;
      try {
        var res = await fetch(req);
        if (res && res.status === 200 && !req.headers.has("range")) {
          cache.put(req, res.clone()).catch(function () {});
        }
        return res;
      } catch (err) {
        var fallback = await cache.match(new URL("index.html", self.registration.scope).href);
        if (fallback && req.mode === "navigate") return fallback;
        return new Response("Hors ligne : cette page n'est pas dans le cache.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    })()
  );
});

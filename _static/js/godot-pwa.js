/* Godot Docs hors-ligne : enregistre le service worker et propose de
 * télécharger toute la doc dans le cache du navigateur (Android / hébergé). */
(function () {
  "use strict";
  var VERSION = "aaf2688d";
  var CACHE = "godot-docs-" + VERSION;
  var script = document.currentScript;
  if (!script || !window.isSecureContext || !("serviceWorker" in navigator) || !window.caches) return;
  var root = new URL("../../", script.src).href;

  navigator.serviceWorker.register(root + "sw.js", { scope: root }).catch(function () {});

  var isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  var force = /[?&]offline=1/.test(location.search);
  if (isLocal && !coarse && !force) return; // sur PC en local, déjà hors-ligne

  var FLAG = "godot-docs-offline-" + VERSION;
  try { if (!force && localStorage.getItem(FLAG) === "done") return; } catch (e) {}

  var deferredInstall = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredInstall = e;
    render();
  });

  var list = null, todo = [], totalBytes = 0, doneBytes = 0, state = "idle", paused = false, wake = null;
  var bar, msg, btn, installBtn, prog, progIn, closeBtn;

  function mb(n) { return Math.round(n / 1048576) + " Mo"; }

  function build() {
    bar = document.createElement("div");
    bar.id = "godot-offline-bar";
    bar.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#1f2a44;color:#fff;" +
      "font:14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:10px 12px;" +
      "box-shadow:0 -2px 10px rgba(0,0,0,.35);display:flex;flex-wrap:wrap;gap:8px 10px;align-items:center";
    msg = document.createElement("div");
    msg.style.cssText = "flex:1 1 200px;min-width:0";
    prog = document.createElement("div");
    prog.style.cssText = "flex:1 1 100%;height:6px;background:#3a4668;border-radius:3px;overflow:hidden;display:none";
    progIn = document.createElement("div");
    progIn.style.cssText = "height:100%;width:0;background:#6cc04a;transition:width .3s";
    prog.appendChild(progIn);
    function mk(label, primary) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.style.cssText = "border:0;border-radius:6px;padding:8px 12px;font:inherit;font-weight:600;cursor:pointer;" +
        (primary ? "background:#3d8fcc;color:#fff" : "background:#3a4668;color:#fff");
      return b;
    }
    btn = mk("", true);
    installBtn = mk("Installer l'appli", false);
    closeBtn = mk("×", false);
    closeBtn.setAttribute("aria-label", "Fermer");
    closeBtn.onclick = function () { bar.style.display = "none"; };
    btn.onclick = onMain;
    installBtn.onclick = function () {
      if (!deferredInstall) return;
      deferredInstall.prompt();
      deferredInstall = null;
      render();
    };
    bar.appendChild(msg);
    bar.appendChild(btn);
    bar.appendChild(installBtn);
    bar.appendChild(closeBtn);
    bar.appendChild(prog);
    document.body.appendChild(bar);
  }

  function render() {
    if (!bar) return;
    var pct = totalBytes ? Math.min(100, Math.round(100 * doneBytes / totalBytes)) : 0;
    installBtn.style.display = deferredInstall ? "" : "none";
    prog.style.display = state === "running" || state === "paused" ? "block" : "none";
    progIn.style.width = pct + "%";
    if (state === "idle") {
      msg.textContent = "Utiliser la doc sans internet : télécharger toutes les pages (≈ " + mb(totalBytes - doneBytes) + ", Wi‑Fi conseillé).";
      btn.textContent = "Télécharger";
    } else if (state === "running") {
      msg.textContent = "Téléchargement… " + pct + " % (" + mb(doneBytes) + " / " + mb(totalBytes) + "). Garde cet onglet ouvert.";
      btn.textContent = "Pause";
    } else if (state === "paused") {
      msg.textContent = "En pause à " + pct + " %. Les pages déjà téléchargées restent disponibles hors-ligne.";
      btn.textContent = "Reprendre";
    } else if (state === "error") {
      msg.textContent = "Connexion interrompue à " + pct + " %. Réessaie quand le réseau revient.";
      btn.textContent = "Reprendre";
    } else if (state === "done") {
      msg.textContent = "✓ Toute la doc est disponible hors-ligne.";
      btn.style.display = "none";
    }
  }

  async function fetchOne(path, size) {
    var cache = await caches.open(CACHE);
    var url = new URL(path, root).href;
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        var res = await fetch(url);
        if (!res.ok) throw new Error("HTTP " + res.status);
        await cache.put(url, res.clone());
        await res.arrayBuffer();
        doneBytes += size;
        return true;
      } catch (e) {
        if (paused) return false;
        await new Promise(function (r) { setTimeout(r, 700 * (attempt + 1)); });
      }
    }
    return false;
  }

  async function run() {
    state = "running";
    paused = false;
    render();
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
    try { if (navigator.wakeLock) wake = await navigator.wakeLock.request("screen"); } catch (e) {}
    var idx = 0, failed = 0;
    async function worker() {
      while (!paused && idx < todo.length) {
        var item = todo[idx++];
        var ok = await fetchOne(item[0], item[1]);
        if (!ok) { failed++; if (!paused) { paused = true; state = "error"; } }
        render();
      }
    }
    var workers = [];
    for (var i = 0; i < 6; i++) workers.push(worker());
    await Promise.all(workers);
    try { if (wake) wake.release(); } catch (e) {}
    if (failed === 0 && idx >= todo.length) {
      state = "done";
      try { localStorage.setItem(FLAG, "done"); } catch (e) {}
      render();
      setTimeout(function () { if (bar) bar.style.display = "none"; }, 6000);
    } else {
      if (state !== "error") state = "paused";
      todo = todo.slice(Math.max(0, idx - 6));
      render();
    }
  }

  function onMain() {
    if (state === "running") { paused = true; return; }
    run();
  }

  async function init() {
    try {
      var r = await fetch(root + "precache.json", { cache: "no-store" });
      list = await r.json();
    } catch (e) { return; }
    var cache = await caches.open(CACHE);
    var keys = await cache.keys();
    var have = {};
    for (var i = 0; i < keys.length; i++) have[new URL(keys[i].url).pathname] = true;
    list.files.forEach(function (f) {
      totalBytes += f[1];
      if (have[new URL(f[0], root).pathname]) doneBytes += f[1];
      else todo.push(f);
    });
    if (todo.length === 0) {
      try { localStorage.setItem(FLAG, "done"); } catch (e) {}
      return;
    }
    build();
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

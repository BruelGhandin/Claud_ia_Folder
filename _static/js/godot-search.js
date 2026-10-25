/* Godot Docs hors-ligne : recherche instantanée des classes, méthodes, propriétés, signaux...
 * - suggestions sous la barre "Search docs" (début de nom, morceau de nom, Classe.membre, snake_case ou PascalCase)
 * - section "Classes, méthodes, propriétés" en tête de la page de résultats (search.html)
 * L'index (_static/js/godot-api-index.js) n'est chargé qu'au premier usage. */
(function () {
  "use strict";
  var script = document.currentScript;
  if (!script) return;
  var ROOT = new URL("../../", script.src).href;
  var DATA_URL = ROOT + "_static/js/godot-api-index.js";

  // code -> [libellé, priorité]
  var KIND = {
    C: ["classe", 9], m: ["méthode", 8], p: ["propriété", 8], s: ["signal", 7],
    e: ["énumération", 6], a: ["annotation", 5], r: ["constructeur", 5],
    x: ["constante", 4], k: ["valeur d'énum.", 3], t: ["thème", 2]
  };

  /* ---------- utilitaires ---------- */
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  // CamelCase / PascalCase -> snake_case minuscule ("Node2D" -> "node_2d", "get_position" inchangé)
  function snake(name) {
    return String(name).replace(/^@/, "")
      .replace(/([a-z])(\d)/g, "$1_$2")
      .replace(/([a-z])([A-Z])/g, "$1_$2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
      .toLowerCase();
  }
  // Saisie à la C# : "GetNode<Node2D>(\"a\")" -> "GetNode", "new Vector2(" -> "Vector2", "Normalized()" -> "Normalized"
  function parseQuery(q) {
    var raw = String(q).trim().replace(/^new\s+/i, "");
    var call = /\(/.test(raw), cut = raw.search(/[<(\[]/);
    if (cut > 0) raw = raw.slice(0, cut).trim();
    return { raw: raw, call: call };
  }
  // "Mathf.Lerp", "GD.Print" : classes C# sans équivalent direct dans la référence (fonctions globales)
  var ALIAS = { mathf: ["globalscope", "gdscript"], gd: ["globalscope", "gdscript"] };
  // classes de base : passent avant les classes obscures à nom de membre égal ("length" -> Vector2.length)
  var CORE = {
    "Vector2": 200, "Vector3": 200, "Vector2i": 150, "Vector3i": 150, "Vector4": 120, "Color": 180,
    "Transform2D": 100, "Transform3D": 100, "Basis": 100, "Quaternion": 100, "Array": 200, "Dictionary": 200,
    "String": 200, "StringName": 120, "NodePath": 100, "Callable": 100, "Signal": 80, "Input": 250,
    "Time": 100, "Engine": 100, "OS": 100, "@GlobalScope": 200, "@GDScript": 200,
    "Rect2": 40, "AABB": 40, "Plane": 40, "Projection": 40
  };
  var NOT_CALLABLE = "psxkte";  // propriétés, signaux, constantes, valeurs d'énum., énumérations, thème
  function normQ(q) {
    var raw = String(q).trim();
    var s = snake(raw.replace(/[^A-Za-z0-9_@]+/g, "_")).replace(/_+/g, "_").replace(/^_+|_+$/g, "");
    return { s: s, j: s.replace(/_/g, ""), t: s ? s.split("_") : [], u: raw.charAt(0) === "_" };
  }
  // nom C# : snake_case -> PascalCase (convention de Godot), "_ready" -> "_Ready"
  function pascal(n) {
    var m = /^_+/.exec(n), pre = m ? m[0] : "";
    return pre + n.slice(pre.length).split("_").map(function (w) {
      return /^\d+[a-z]$/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1);
    }).join("");
  }
  function csharp(e) {
    if (e.c.name.charAt(0) === "@") return "";
    if (e.k === "m") return pascal(e.n) + "()";
    if (e.k === "p" || e.k === "s") return pascal(e.n);
    return "";
  }
  function href(e) {
    var base = ROOT + "classes/class_" + e.c.stem + ".html";
    if (e.k === "C") return base;
    var id = e.id, cid = e.c.stem.replace("@", "");
    if (id.indexOf("e:") === 0) id = "enum-" + cid + "-" + id.slice(2);
    else if (id.charAt(0) === "=") id = id.slice(1);
    else id = "class-" + cid + "-" + id;
    return base + "#" + id;
  }

  /* ---------- données ---------- */
  var api = null, loading = null;
  function prepare(d) {
    var classes = d.c.map(function (c, i) {
      var s = snake(c[0]);
      return { i: i, name: c[0], stem: c[1], brief: c[2], chain: c[3], w: Math.max(c[4], CORE[c[0]] || 0), s: s, j: s.replace(/_/g, "") };
    });
    var items = classes.map(function (c) {
      return { k: "C", c: c, n: c.name, s: c.s, j: c.j, id: "", t: "", r: "" };
    });
    var needSnake = /[A-Z@\d]/;
    d.i.forEach(function (r) {
      var n = r[2], s = needSnake.test(n) ? snake(n) : n;  // la plupart des noms sont déjà en snake_case
      items.push({ k: r[0], c: classes[r[1]], n: n, s: s, j: s.replace(/_/g, ""), id: r[3], t: r[4], r: r[5] });
    });
    var pages = d.p.map(function (p) { return { t: p[0], l: p[0].toLowerCase(), p: p[1] }; });
    return { classes: classes, items: items, pages: pages };
  }
  function loadData() {
    if (api) return Promise.resolve(api);
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = DATA_URL;
      s.async = true;
      s.onload = function () {
        try { api = prepare(window.GODOT_API); window.GODOT_API = null; resolve(api); } catch (e) { reject(e); }
      };
      s.onerror = function () { loading = null; reject(new Error("index introuvable")); };
      document.head.appendChild(s);
    });
    return loading;
  }

  /* ---------- recherche ---------- */
  function wordStart(s, qs) { return ("_" + s).indexOf("_" + qs) >= 0; }
  function allWordStart(tokens, s) {
    for (var i = 0; i < tokens.length; i++) if (!wordStart(s, tokens[i])) return false;
    return true;
  }
  function scoreName(e, q) {
    if (!q.j) return 0;
    var sc = 0;
    if (e.j === q.j) sc = 1000;
    else if (e.j.indexOf(q.j) === 0) sc = 800 - Math.min(e.j.length - q.j.length, 60);
    else if (wordStart(e.s, q.s)) sc = 600 - Math.min(e.s.length - q.s.length, 50);
    else if (e.j.indexOf(q.j) >= 0) sc = 400 - Math.min(e.j.length - q.j.length, 50);
    else if (q.t.length > 1 && allWordStart(q.t, e.s)) sc = 300;
    else return 0;
    // "_pressed" (méthode virtuelle) passe après "pressed" quand on ne tape pas de "_"
    if (e.n.charAt(0) === "_" && !q.u) sc -= 45;
    return sc;
  }
  // tolérance aux fautes de frappe : écart minimal entre la 1re et la dernière lettre trouvées (dans l'ordre)
  function fuzzySpan(j, qj) {
    var best = 1e9, start = j.indexOf(qj.charAt(0));
    while (start >= 0) {
      var p = 1, i = start + 1;
      for (; i < j.length && p < qj.length; i++) if (j.charCodeAt(i) === qj.charCodeAt(p)) p++;
      if (p === qj.length) {
        var span = i - start;
        if (span < best) best = span;
        if (best === qj.length) break;
      } else break;
      start = j.indexOf(qj.charAt(0), start + 1);
    }
    return best;
  }
  function rankOf(sc, e) {
    return sc * 1e6 + Math.min(e.c.w, 999) * 1e3 + KIND[e.k][1] * 100 - Math.min(e.n.length, 99);
  }

  function searchApi(q, max) {
    var pq = parseQuery(q), raw = pq.raw;
    if (raw.length < 2 && !/[.:]/.test(raw)) return { list: [], total: 0 };
    var m = /^([^.:\s]+)(?:\.|::)(.*)$/.exec(raw);
    var cq = m ? normQ(m[1]) : null, mq = normQ(m ? m[2] : raw);
    if (!cq && !mq.j) return { list: [], total: 0 };
    var items = api.items, out = [], i, e, sc;
    var clsScore = null, alias = cq ? ALIAS[cq.j] : null;
    if (cq) {
      clsScore = api.classes.map(function (c) {
        if (!cq.j) return 0;
        if (alias && alias.indexOf(c.j) >= 0) return 3;
        if (c.j === cq.j) return 3;
        if (c.j.indexOf(cq.j) === 0) return 2;
        return c.j.indexOf(cq.j) >= 0 ? 1 : 0;
      });
    }
    var hit = new Uint8Array(items.length);
    for (i = 0; i < items.length; i++) {
      e = items[i];
      if (cq) {
        var cs = clsScore[e.c.i];
        if (!cs || (e.k === "C" && mq.j)) continue;
        if (e.k === "C") sc = 900 + cs * 300;
        else if (!mq.j) sc = 500 + cs * 300;
        else { sc = scoreName(e, mq); if (!sc) continue; sc += cs * 300; }
      } else {
        sc = scoreName(e, mq);
        if (!sc && mq.t.length > 1 && e.k !== "C" && allWordStart(mq.t, e.c.s + "_" + e.s)) sc = 250;
        if (!sc) continue;
        if (e.k === "C") sc += 50;  // à nom égal, la classe passe avant ses membres
      }
      // avec des parenthèses on cherche un appel : les méthodes passent avant les propriétés
      if (pq.call && NOT_CALLABLE.indexOf(e.k) >= 0) { sc -= 250; if (sc <= 0) continue; }
      hit[i] = 1;
      out.push({ e: e, r: rankOf(sc, e) });
    }
    if (out.length < 5 && !cq && mq.j.length >= 4) {  // fautes de frappe ("positon" -> position)
      for (i = 0; i < items.length; i++) {
        if (hit[i]) continue;
        e = items[i];
        if (e.j.length < mq.j.length - 1 || e.j.length > mq.j.length * 3) continue;
        var span = fuzzySpan(e.j, mq.j);
        if (span <= mq.j.length + 2) {
          out.push({ e: e, r: rankOf(150 - (span - mq.j.length) * 30 - Math.min(e.j.length - mq.j.length, 29), e) });
        }
      }
    }
    out.sort(function (a, b) { return b.r - a.r; });
    return { list: out.slice(0, max).map(function (o) { return o.e; }), total: out.length };
  }

  function searchPages(q, max) {
    var cleaned = parseQuery(q).raw;
    var t = cleaned.toLowerCase().split(/[\s._:]+/).filter(Boolean);
    if (!t.length || cleaned.length < 3) return [];
    var res = [];
    api.pages.forEach(function (p) {
      var score = 0, ok = true;
      for (var i = 0; i < t.length; i++) {
        var k = p.l.indexOf(t[i]);
        if (k < 0) { ok = false; break; }
        score += (k === 0 || p.l.charAt(k - 1) === " ") ? 2 : 1;
      }
      if (ok) res.push({ p: p, s: score * 1000 - p.t.length });
    });
    res.sort(function (a, b) { return b.s - a.s; });
    return res.slice(0, max).map(function (r) { return r.p; });
  }

  /* ---------- rendu ---------- */
  function mark(name, needle) {
    var n = String(needle || "").replace(/[^a-z0-9@]/g, "");
    if (!n) return esc(name);
    // les "_" du nom sont ignorés : "getnode" surligne "get_node"
    var re = new RegExp(n.split("").map(function (c) { return c === "@" ? "@" : c; }).join("_?"), "i");
    var m = re.exec(name);
    if (!m) return esc(name);
    return esc(name.slice(0, m.index)) + "<mark>" + esc(m[0]) + "</mark>" + esc(name.slice(m.index + m[0].length));
  }
  function itemHtml(e, needle, cls) {
    var chip = '<span class="gs-chip" data-k="' + e.k + '">' + KIND[e.k][0] + "</span>";
    var title, sub = "", cs = csharp(e);
    if (e.k === "C") {
      title = '<span class="gs-name">' + mark(e.n, needle) + "</span>" + chip;
      sub = '<span class="gs-sig gs-plain">' + esc(e.c.brief || e.c.chain) + "</span>";
    } else {
      var shown = e.k === "m" && e.n.charAt(0) !== "_" ? e.n : e.n;
      title = '<span class="gs-name"><span class="gs-cls">' + esc(e.c.name) + "</span>." + mark(shown, needle) + "</span>" + chip;
      var sig = "";
      if (e.k === "m" || e.k === "s" || e.k === "r") sig = e.r + (e.t && e.t !== "void" ? " → " + e.t : "");
      else sig = (e.t ? e.t + " " : "") + e.r;
      sub = '<span class="gs-sig">' + esc(sig.trim()) + "</span>";
    }
    if (cs) sub += '<span class="gs-cs" title="Nom C# déduit de la convention de Godot (snake_case → PascalCase)">C# ' + esc(cs) + "</span>";
    return '<a class="gs-opt ' + (cls || "") + '" href="' + esc(href(e)) + '" role="option"><span class="gs-t">' + title +
      '</span><span class="gs-sub">' + sub + "</span></a>";
  }
  function needleOf(q) {
    var raw = parseQuery(q).raw;
    var m = /^([^.:\s]+)(?:\.|::)(.*)$/.exec(raw);
    return String(m ? m[2] : raw).trim().toLowerCase().replace(/\s+/g, "_");
  }

  /* ---------- styles ---------- */
  var CSS =
    "#gs-pop{position:fixed;z-index:100000;display:none;background:#fff;color:#2b2b2b;border:1px solid #c5cfdd;border-radius:10px;" +
    "box-shadow:0 10px 30px rgba(12,22,48,.3);overflow:auto;font:14px/1.35 Inter,Lato,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}" +
    "#gs-pop.gs-open{display:block}" +
    "#gs-pop ul,.gs-list{list-style:none;margin:0;padding:0}#gs-pop ul{padding:4px}#gs-pop li,.gs-list li{margin:0;padding:0}" +
    ".gs-opt{display:block;padding:7px 10px;border-radius:7px;color:inherit!important;text-decoration:none!important;white-space:normal!important}" +
    ".gs-opt::after,.gs-opt::before,.gs-foot::after{display:none!important;content:none!important}" +
    ".gs-opt.gs-active,.gs-opt:hover{background:#e6f0fb}" +
    ".gs-t{display:flex;align-items:baseline;gap:8px}" +
    ".gs-name{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 13px/1.3 'Roboto Mono',Consolas,Menlo,monospace}" +
    ".gs-cls{color:#5b6c86;font-weight:500}.gs-name mark{background:#ffe9a8;color:inherit;padding:0;border-radius:2px}" +
    ".gs-chip{flex:none;font-size:11px;line-height:1.5;padding:0 7px;border-radius:9px;background:#e7ecf3;color:#3f526d}" +
    ".gs-chip[data-k=C]{background:#d6e9ff;color:#0b4f8a}.gs-chip[data-k=m]{background:#e3f4dd;color:#2c6a17}" +
    ".gs-chip[data-k=p]{background:#fdebd3;color:#8a4b00}.gs-chip[data-k=s]{background:#f5ddf4;color:#7a1f78}" +
    ".gs-sub{display:flex;gap:10px;margin-top:2px;color:#5f6f86;font-size:12px}" +
    ".gs-sig{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:'Roboto Mono',Consolas,Menlo,monospace;font-size:11.5px}" +
    ".gs-sig.gs-plain{font-family:inherit;font-size:12px}" +
    ".gs-cs{flex:none;color:#5b3fa8;font-family:'Roboto Mono',Consolas,Menlo,monospace;font-size:11.5px}" +
    ".gs-sep{margin:6px 10px 2px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#7a889e}" +
    ".gs-foot{display:block;padding:9px 12px;border-top:1px solid #e3e8f0;color:#2573b5!important;text-decoration:none!important;font-size:13px}" +
    ".gs-foot.gs-active,.gs-foot:hover{background:#e6f0fb}" +
    ".gs-empty{padding:12px;color:#5f6f86;font-size:13px}" +
    "#gs-results{margin:0 0 24px}#gs-results h2{margin-top:0}#gs-results h2 small{color:#7a889e;font-weight:400;font-size:.65em;margin-left:6px}" +
    "#gs-results .gs-list{border:1px solid #d5dde9;border-radius:10px;overflow:hidden;background:#fff}" +
    "#gs-results .gs-opt{border-radius:0;border-bottom:1px solid #edf0f5;padding:9px 12px}#gs-results li:last-child .gs-opt{border-bottom:0}" +
    "#gs-results .gs-more{margin-top:10px;padding:7px 14px;border:1px solid #b9c7da;border-radius:8px;background:#f4f7fb;color:#2573b5;cursor:pointer;font:inherit}" +
    "@media (max-width:768px){.gs-chip{font-size:10.5px}}";
  function injectCss() {
    if (document.getElementById("gs-css")) return;
    var st = document.createElement("style");
    st.id = "gs-css";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* ---------- liste déroulante sous la barre de recherche ---------- */
  var input, pop, active = -1, lastQ = "", seq = 0;

  function place() {
    if (!pop || !input) return;
    var r = input.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
    var w = Math.min(Math.max(r.width, 480), vw - 16);
    var left = Math.max(8, Math.min(r.left, vw - 8 - w));
    var top = r.bottom + 6;
    pop.style.left = left + "px";
    pop.style.top = top + "px";
    pop.style.width = w + "px";
    pop.style.maxHeight = Math.max(160, vh - top - 12) + "px";
  }
  function opts() { return pop.querySelectorAll(".gs-opt, .gs-foot"); }
  function setActive(i) {
    var list = opts();
    if (!list.length) { active = -1; return; }
    if (i < 0) i = list.length - 1;
    if (i >= list.length) i = 0;
    for (var k = 0; k < list.length; k++) list[k].classList.toggle("gs-active", k === i);
    active = i;
    var el = list[i];
    var pr = pop.getBoundingClientRect(), er = el.getBoundingClientRect();
    if (er.top < pr.top) pop.scrollTop -= pr.top - er.top;
    else if (er.bottom > pr.bottom) pop.scrollTop += er.bottom - pr.bottom;
  }
  function closePop() {
    if (pop) pop.classList.remove("gs-open");
    if (input) input.setAttribute("aria-expanded", "false");
    active = -1;
  }
  function fullSearchUrl(q) { return ROOT + "search.html?q=" + encodeURIComponent(q) + "&check_keywords=yes&area=default"; }

  function update() {
    var q = input.value;
    lastQ = q;
    if (q.trim().length < 2) { closePop(); return; }
    var my = ++seq;
    loadData().then(function () {
      if (my !== seq) return;
      var res = searchApi(q, 9), pages = searchPages(q, 3), needle = needleOf(q);
      var html = "";
      if (res.list.length) {
        html += "<ul>" + res.list.map(function (e) { return "<li>" + itemHtml(e, needle) + "</li>"; }).join("") + "</ul>";
      }
      if (pages.length) {
        html += '<div class="gs-sep">Pages</div><ul>' + pages.map(function (p) {
          return '<li><a class="gs-opt" role="option" href="' + esc(ROOT + p.p) + '"><span class="gs-t"><span class="gs-name" style="font-family:inherit;font-weight:600">' +
            esc(p.t) + '</span><span class="gs-chip">page</span></span></a></li>';
        }).join("") + "</ul>";
      }
      if (!res.list.length && !pages.length) html += '<div class="gs-empty">Aucune classe ni méthode ne correspond.</div>';
      var more = res.total > res.list.length ? " (" + res.total + " résultats d'API)" : "";
      html += '<a class="gs-foot" href="' + esc(fullSearchUrl(q)) + '">Voir tous les résultats pour « ' + esc(q.trim()) + " »" + more + " ↵</a>";
      pop.innerHTML = html;
      place();
      pop.classList.add("gs-open");
      input.setAttribute("aria-expanded", "true");
      active = -1;
    }, function () { closePop(); });
  }

  function initDropdown() {
    input = document.querySelector('.wy-side-nav-search input[name="q"]');
    if (!input) return;
    injectCss();
    pop = document.createElement("div");
    pop.id = "gs-pop";
    pop.setAttribute("role", "listbox");
    document.body.appendChild(pop);
    input.setAttribute("autocomplete", "off");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("placeholder", "Rechercher une classe, méthode… (touche /)");
    input.addEventListener("focus", function () { loadData().catch(function () {}); if (input.value.trim().length >= 2 && input.value !== lastQ) update(); });
    input.addEventListener("input", update);
    input.addEventListener("keydown", function (ev) {
      var open = pop.classList.contains("gs-open");
      if (ev.key === "ArrowDown" && open) { ev.preventDefault(); setActive(active + 1); }
      else if (ev.key === "ArrowUp" && open) { ev.preventDefault(); setActive(active - 1); }
      else if (ev.key === "Enter" && open && active >= 0) { ev.preventDefault(); var el = opts()[active]; if (el) window.location.href = el.href; }
      else if (ev.key === "Escape") { closePop(); }
    });
    document.addEventListener("mousedown", function (ev) { if (ev.target !== input && !pop.contains(ev.target)) closePop(); });
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    pop.addEventListener("mousemove", function (ev) {
      var el = ev.target.closest ? ev.target.closest(".gs-opt, .gs-foot") : null;
      if (!el) return;
      var list = opts();
      for (var k = 0; k < list.length; k++) if (list[k] === el) { if (k !== active) { for (var j = 0; j < list.length; j++) list[j].classList.toggle("gs-active", j === k); active = k; } break; }
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key !== "/" || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      var t = ev.target, tag = t && t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
      ev.preventDefault();
      input.focus();
      input.select();
    });
  }

  /* ---------- section API dans la page de résultats ---------- */
  function initResultsPage() {
    var holder = document.getElementById("search-results");
    var q = new URLSearchParams(window.location.search).get("q");
    if (!holder || !q || !q.trim()) return;
    injectCss();
    var box = document.createElement("div");
    box.id = "gs-results";
    holder.parentNode.insertBefore(box, holder);
    loadData().then(function () {
      var res = searchApi(q, 400), needle = needleOf(q), shown = 0, STEP = 40;
      if (!res.list.length) { box.parentNode.removeChild(box); return; }
      box.innerHTML = '<h2>Classes, méthodes, propriétés…<small>' + res.total + (res.total > res.list.length ? "+" : "") + '</small></h2><ul class="gs-list"></ul>';
      var ul = box.querySelector("ul");
      var btn = document.createElement("button");
      btn.type = "button"; btn.className = "gs-more";
      function more() {
        var next = res.list.slice(shown, shown + STEP);
        ul.insertAdjacentHTML("beforeend", next.map(function (e) { return "<li>" + itemHtml(e, needle) + "</li>"; }).join(""));
        shown += next.length;
        if (shown >= res.list.length) { if (btn.parentNode) btn.parentNode.removeChild(btn); }
        else btn.textContent = "Afficher plus (" + (res.list.length - shown) + " restants)";
      }
      btn.addEventListener("click", more);
      box.appendChild(btn);
      more();
    }, function () { box.parentNode.removeChild(box); });
  }

  function init() {
    initDropdown();
    initResultsPage();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

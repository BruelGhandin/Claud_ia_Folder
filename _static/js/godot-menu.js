/* Reconstruit le menu latéral de la doc Godot à partir du menu commun.
 * Reproduit ce que Sphinx générait dans chaque page : liens relatifs à la page,
 * entrée courante (href="#"), ancres de la page courante, classes "current"
 * sur l'entrée et sur tous ses ancêtres (li et ul).
 * Doit s'exécuter de façon synchrone avant SphinxRtdTheme.Navigation.enable(). */
(function () {
  "use strict";
  var el = document.querySelector(".wy-menu-vertical[data-godot-page]");
  if (!el || typeof window.GODOT_MENU !== "string") return;

  var root = el.getAttribute("data-godot-root") || "";
  var page = el.getAttribute("data-godot-page");
  var pageHash = page + "#";
  var notRelative = /^(#|[a-z][a-z0-9+.\-]*:|\/)/i;

  var tpl = document.createElement("template");
  tpl.innerHTML = window.GODOT_MENU;
  var frag = tpl.content;

  var anchors = frag.querySelectorAll("a");
  var selfs = [];
  for (var i = 0; i < anchors.length; i++) {
    var a = anchors[i];
    var h = a.getAttribute("href");
    if (h === null) continue;
    if (h === page) {
      a.setAttribute("href", "#");
      selfs.push(a);
    } else if (h.indexOf(pageHash) === 0) {
      a.setAttribute("href", h.slice(page.length));
    } else if (!notRelative.test(h)) {
      a.setAttribute("href", root + h);
    }
  }

  for (var j = 0; j < selfs.length; j++) {
    var self = selfs[j];
    self.classList.add("current");
    var n = self.parentElement;
    if (n) n.classList.add("current");
    n = n ? n.parentElement : null;
    while (n) {
      if (n.tagName === "UL" || n.tagName === "LI") n.classList.add("current");
      n = n.parentElement;
    }
  }

  el.appendChild(frag);
})();

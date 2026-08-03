(function () {
  var MIRROR = "nwd.gate";
  var gate = readMirror();
  var observing = false;
  var sweep = null;
  var pierce = null;

  applyGate();
  ensureTheme();
  reconcile();
  watchStorage();
  watchVisibility();
  enableAnimation();
  sweepLightSurfaces();
  pierceShadowRoots();

  /* Published projects render through a Web Component library -- nw-code-block,
     nw-button, nw-validation-box and ~30 others, over a thousand shadow roots on
     one page. A page stylesheet cannot cross a shadow boundary, so theme.css and
     the sweep above are both blind to every component interior; measured on one
     project page, 596 light surfaces across 19 component types.

     Every root is mode:"open" and supports adoptedStyleSheets, so one shared
     constructed sheet can be adopted into all of them. The sheet is deliberately
     UNLAYERED: the components' own rules sit in @layer base/utilities, and an
     unlayered declaration outranks any layered one -- the opposite of the
     light-DOM case, where the page's layered !important beats us. */
  function pierceShadowRoots() {
    var sheet = null;
    var pending = false;
    var covered = typeof WeakSet === "function" ? new WeakSet() : null;
    var queued = [];

    build();
    run();
    if (document.readyState !== "complete") window.addEventListener("load", run);
    watchForNewRoots();

    pierce = run;

    function build() {
      if (typeof CSSStyleSheet !== "function") return;
      try {
        sheet = new CSSStyleSheet();
      } catch (e) {
        return;
      }
      sheet.replaceSync([
        ":host{background-color:transparent;color:#cfc7c0;}",
        /* Element selectors, not *, so this stays cheap across ~1000 roots and
           does not repaint icon glyphs or transparent wrappers. */
        "div,section,article,aside,header,footer,ul,ol,li,dl,dt,dd,",
        "p,span,label,small,strong,b,em,i,h1,h2,h3,h4,h5,h6,",
        "table,thead,tbody,tr,td,th,figure,figcaption,summary,details",
        "{background-color:transparent!important;color:#cfc7c0!important;border-color:#46403b!important;}",
        "h1,h2,h3,h4,h5,h6,strong,b{color:#ede8e3!important;}",
        /* Surfaces the components paint themselves. */
        "[class*='bg-'],blockquote,pre,code,textarea,input,select,",
        "[class*='card'],[class*='panel'],[class*='box'],[class*='dropzone']",
        "{background-color:#272320!important;border-color:#46403b!important;}",
        "pre,code,[class*='code']{background-color:#141211!important;color:#cfc7c0!important;}",
        "textarea,input,select{color:#ede8e3!important;caret-color:#ede8e3!important;}",
        "button{background-color:transparent!important;color:#ede8e3!important;border-color:#46403b!important;}",
        "button[class*='bg-']{background-color:#38322e!important;}",
        "a{color:#7fb3f2!important;}",
        /* Icons inherit currentColor; painting them would fill the glyph box. */
        "svg,svg *,path,circle,rect,line,polyline,polygon,g",
        "{background-color:transparent!important;border-color:transparent!important;}",
        "::selection{background-color:#4a3a48!important;color:#ede8e3!important;}",
        "::placeholder{color:#9c928a!important;}"
      ].join(""));
    }

    function run() {
      if (!sheet) return;
      if (!has("dark")) {
        release();
        return;
      }
      walk(document, adopt);
    }

    /* Roots already carrying the sheet are remembered, so a re-scan skips their
       whole subtree instead of re-walking it. Without this the observer paid the
       full ~1000-root traversal on every DOM change to discover nothing new,
       which is what made scrolling feel heavy. */
    function adopt(root) {
      if (covered?.has(root)) return true;
      var sheets = root.adoptedStyleSheets;
      if (!sheets) return false;
      if (sheets.includes(sheet)) {
        if (covered) covered.add(root);
        return true;
      }
      try {
        root.adoptedStyleSheets = sheets.concat(sheet);
        if (covered) covered.add(root);
      } catch (e) {
        /* Not rethrown: the write throws only for a root that is closed or
           already detached, and neither becomes writable later. One refusing
           root must not abort the traversal of the ~1000 others. Returning
           here rather than falling through states that outcome explicitly --
           the root was not covered, so its subtree still needs walking. */
        return false;
      }
      return false;
    }

    function release() {
      covered = typeof WeakSet === "function" ? new WeakSet() : null;
      /* Signals no skip, ever: a root that does not carry the sheet may still
         contain one that does, so removal has to reach the whole tree. */
      walk(document, function (root) {
        var sheets = root.adoptedStyleSheets;
        if (!sheets) return;
        var i = sheets.indexOf(sheet);
        if (i === -1) return;
        try {
          root.adoptedStyleSheets = sheets.slice(0, i).concat(sheets.slice(i + 1));
        } catch (e) {}
      });
    }

    /* Components mount lazily -- expanding a step attaches dozens of new roots.
       Only the added subtrees are scanned, not the document: a keystroke in the
       editor should not cost a full traversal. */
    function watchForNewRoots() {
      if (typeof MutationObserver !== "function") return;
      new MutationObserver(function (records) {
        if (!has("dark")) return;
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node.nodeType !== 1) continue;
            queued.push(node);
          }
        }
        if (!queued.length || pending) return;
        pending = true;
        requestAnimationFrame(flush);
      }).observe(document.documentElement, { childList: true, subtree: true });
    }

    function flush() {
      pending = false;
      var batch = queued;
      queued = [];
      for (const node of batch) {
        if (!node.isConnected) continue;
        if (node.shadowRoot) adopt(node.shadowRoot);
        walk(node, adopt);
      }
    }
  }

  /* Iterative rather than recursive: nesting can run deep and a blown stack
     would abort the traversal partway, leaving half the page light.
     fn returns true when its subtree is already handled and can be skipped;
     returning nothing means keep descending. */
  function walk(start, fn) {
    var queue = [start];
    while (queue.length) {
      var node = queue.pop();
      for (const host of node.querySelectorAll("*")) {
        var root = host.shadowRoot;
        if (!root) continue;
        if (fn(root)) continue;
        queue.push(root);
      }
    }
  }

  /* The stylesheet lightens ALL text but can only darken surfaces it can name,
     and NextWork's surfaces are unnameable in CSS: arbitrary values (bg-[#f0ebe9]),
     stylesheet-driven gradients, and semantic utilities that carry no colour in
     the class string. Every surface the sheet misses becomes light-on-light, which
     is worse than leaving it alone. Only JS can read a computed colour, so the
     remaining ones are found by measurement and tagged for the sheet to style. */
  function sweepLightSurfaces() {
    var LIGHT = 150;
    var SURFACE = "#272320";
    var scheduled = false;

    sweep = run;
    run();
    if (document.readyState !== "complete") {
      document.addEventListener("DOMContentLoaded", run);
      window.addEventListener("load", run);
    }
    observeMutations();

    function run() {
      if (!document.body) return;
      if (!has("dark")) {
        revert();
        return;
      }
      for (const el of document.body.querySelectorAll("*")) tag(el);
    }

    /* Inline styles outlive the gate attribute, so turning dark mode off has to
       remove them explicitly or the page stays dark. */
    function revert() {
      for (const el of document.querySelectorAll("[data-nwd-lit]")) {
        delete el.dataset.nwdLit;
        el.style.removeProperty("background-color");
        el.style.removeProperty("background-image");
        el.style.removeProperty("color");
        for (const kid of el.querySelectorAll("*")) kid.style.removeProperty("color");
      }
    }

    /* Written as an INLINE important declaration, not left to theme.css. The
       page's Tailwind utilities declare !important inside @layer, and a layered
       !important beats an unlayered one no matter how specific the selector --
       measured: layered #d4f5e0 wins over our sheet, inline loses to nothing.
       So the sheet genuinely cannot repaint these surfaces; only the element can. */
    function paint(el) {
      el.dataset.nwdLit = "";
      el.style.setProperty("background-color", SURFACE, "important");
      /* Only vector fills are cleared. Blanking unconditionally destroyed a real
         525x360 hero photograph, because the element carrying it also had a light
         background-colour -- losing artwork is a worse defect than the light
         panel this is chasing. */
      var image = getComputedStyle(el).backgroundImage;
      if (image && image !== "none" && !isDecorativeImage(image)) {
        el.style.setProperty("background-image", "none", "important");
      }
      darkenText(el);
    }

    /* Descendants were authored to sit on a light surface, so their own light or
       brand colours have to come back -- same layered-!important problem. */
    function darkenText(root) {
      for (const kid of root.querySelectorAll("*")) {
        if ("nwdLit" in kid.dataset) continue;
        var kcs = getComputedStyle(kid);
        var bg = luminance(kcs.backgroundColor);
        /* A nested dark panel (the answer textarea) already reads correctly. */
        if (bg !== null && bg < LIGHT) continue;
        var fg = luminance(kcs.color);
        if (fg === null || fg > 110) {
          kid.style.setProperty("color", "#ede8e3", "important");
        } else {
          kid.style.setProperty("color", "#cfc7c0", "important");
        }
      }
      var own = luminance(getComputedStyle(root).color);
      if (own === null || own > 110) root.style.setProperty("color", "#cfc7c0", "important");
    }

    function tag(el) {
      if ("nwdLit" in el.dataset) return;
      var cs = getComputedStyle(el);
      var lum = luminance(cs.backgroundColor);
      if (lum !== null && lum > LIGHT) {
        paint(el);
        return;
      }
      /* A light background-IMAGE is invisible to every background-color rule.
         Two shapes appear on this site: gradients fading to the paper tone, and
         inline SVG data-URIs whose fill IS the panel -- the Secret Mission card
         is one, an svg+xml URI filled #F0E9E6. Both are matched by pulling every
         colour literal out of the value, rgb()/rgba() and bare hex alike. */
      var image = cs.backgroundImage;
      if (image && image !== "none" && !isDecorativeImage(image)) {
        for (const literal of imageColors(image)) {
          var l = luminance(literal);
          if (l !== null && l > LIGHT) {
            el.style.setProperty("background-image", "none", "important");
            el.style.setProperty("background-color", SURFACE, "important");
            el.dataset.nwdLit = "";
            darkenText(el);
            return;
          }
        }
      }
    }

    /* The reflection cards, popovers and expanded step bodies mount after first
       paint, so a single pass at load would miss exactly the blocks that prompted
       this. Batched on rAF because these mutate on every keystroke. */
    function observeMutations() {
      if (typeof MutationObserver !== "function") return;
      new MutationObserver(function () {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(function () {
          scheduled = false;
          run();
        });
      }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "data-nwdark"] });
    }
  }

  /* Dark Reader injects all of its CSS from JS and declares no "css" key at all,
     which is the portable path across extension layers. Verify ours actually
     landed and inject it ourselves if the manifest's css key was ignored. */
  function ensureTheme() {
    if (!chrome.runtime?.getURL) return;
    check();
    document.addEventListener("DOMContentLoaded", check);

    function check() {
      if (themePresent()) return;
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.id = "nwd-theme";
      link.href = chrome.runtime.getURL("theme.css");
      var parent = document.head || document.documentElement;
      if (parent && !document.getElementById("nwd-theme")) parent.appendChild(link);
    }

    /* Probes a real declaration rather than scanning rule text: an extension
       layer may expose injected sheets with an unreadable cssRules, and the
       theme's own gated selectors are the only thing that proves it is live. */
    function themePresent() {
      if (document.getElementById("nwd-theme")) return true;
      var root = document.documentElement;
      if (!root) return false;
      var had = "nwdark" in root.dataset;
      if (!had) root.dataset.nwdark = "on";
      var scheme = getComputedStyle(root).getPropertyValue("color-scheme");
      if (!had) delete root.dataset.nwdark;
      return scheme.includes("dark");
    }
  }

  function readMirror() {
    try {
      return localStorage.getItem(MIRROR) || "";
    } catch (e) {
      return "";
    }
  }

  function writeMirror(value) {
    try {
      localStorage.setItem(MIRROR, value);
    } catch (e) {}
  }

  function encode(dark, dim) {
    var words = [];
    if (dark) words.push("dark");
    if (dim) words.push("dim");
    return words.join(" ");
  }

  function has(word) {
    return gate.split(" ").includes(word);
  }

  /* At document_start document.documentElement is null (measured: readyState
     "loading", docEl null), so writing the gate has to wait for <html> to
     exist. localStorage is synchronously readable that early, which is why the
     mirror exists at all -- chrome.storage is async in every implementation and
     so can never beat first paint. */
  function applyGate() {
    var root = document.documentElement;
    if (!root) {
      observeRoot();
      return;
    }
    flag(root, "data-nwdark", has("dark"));
    flag(root, "data-nwdim", has("dim"));
  }

  function flag(root, name, on) {
    if (on) root.setAttribute(name, "on");
    else root.removeAttribute(name);
  }

  function observeRoot() {
    if (observing) return;
    observing = true;
    var observer = new MutationObserver(function () {
      if (!document.documentElement) return;
      observer.disconnect();
      observing = false;
      applyGate();
    });
    observer.observe(document, { childList: true });
  }

  /* applyGate runs unconditionally rather than only on change: on a warm start
     the reconciled value equals the mirror, but the attributes may not be on
     <html> yet, so an early return would leave the page unthemed. */
  function setGate(next) {
    if (next !== gate) {
      gate = next;
      writeMirror(next);
    }
    applyGate();
    /* The sweep depends on the gate being open and on body existing, neither of
       which is true at document_start, so it is re-run whenever the gate moves. */
    if (sweep) sweep();
    if (pierce) pierce();
  }

  function reconcile() {
    readPrefs(function (prefs) {
      if (!prefs) return;
      setGate(encode(!!prefs.darkMode, !!prefs.dimImages));
    });
  }

  /* Passes a callback and also handles a returned promise, since WebKit-derived
     extension layers may implement only one shape. The once-guard matters: a
     layer that does both would otherwise run the callback twice. */
  function readPrefs(callback) {
    var done = false;
    function finish(result) {
      if (done) return;
      done = true;
      callback(result && typeof result === "object" ? result : null);
    }
    var returned;
    try {
      returned = chrome.storage.local.get(["darkMode", "dimImages"], finish);
    } catch (e) {
      finish(null);
      return;
    }
    if (returned && typeof returned.then === "function") {
      returned.then(finish, function () {
        finish(null);
      });
    }
  }

  function watchStorage() {
    try {
      chrome.storage.onChanged.addListener(function (changes, area) {
        if (area === "local") reconcile();
      });
    } catch (e) {}
  }

  /* Second self-healing path: if onChanged never fans out to this context, the
     worst case becomes "correct on next focus" rather than "needs a reload".
     The mirror is shared per origin, so another tab's toggle can make it newer
     than this frame's gate -- but an EMPTY mirror means "unreadable or never
     written", not "dark off". Applying that would strip a correct gate and
     flash the page light, so only a non-empty mirror is applied here; turning
     the gate off is left to reconcile(), which is authoritative. */
  function watchVisibility() {
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) return;
      var mirror = readMirror();
      if (mirror) setGate(mirror);
      reconcile();
    });
  }

  function enableAnimation() {
    requestAnimationFrame(function () {
      var root = document.documentElement;
      if (root) root.dataset.nwdAnimate = "";
    });
  }

  /* Hoisted out of sweepLightSurfaces: all three are pure functions of their
     argument, so nesting them only rebuilt them on every call. */
  function luminance(color) {
    var s = String(color).trim();
    /* Hex is handled here because SVG data-URIs spell their fills that way. */
    var hex = /^#?([0-9a-fA-F]{6})$/.exec(s);
    if (hex) {
      return 0.2126 * Number.parseInt(hex[1].slice(0, 2), 16) +
             0.7152 * Number.parseInt(hex[1].slice(2, 4), 16) +
             0.0722 * Number.parseInt(hex[1].slice(4, 6), 16);
    }
    var m = s.match(/(\d+(?:\.\d+)?)/g);
    if (!m || m.length < 3) return null;
    if (m.length > 3 && Number.parseFloat(m[3]) < 0.15) return null;
    return 0.2126 * +m[0] + 0.7152 * +m[1] + 0.0722 * +m[2];
  }

  /* Photographs and icon sprites must be left alone: blanking a real image is
     a worse defect than the light panel this is chasing. Only vector sources,
     whose colours are legible as text, are candidates. */
  function isDecorativeImage(value) {
    if (value.includes("gradient")) return false;
    if (value.includes("svg+xml")) return false;
    return true;
  }

  function imageColors(value) {
    var out = [];
    var fn = value.match(/rgba?\([^)]+\)/g);
    if (fn) out = out.concat(fn);
    /* decodeURIComponent because the SVG arrives percent-encoded, so its
       fill="%23F0E9E6" is otherwise unreadable. */
    var text = value;
    try {
      text = decodeURIComponent(value);
    } catch (e) {
      /* A malformed escape means the value is not percent-encoded, so the raw
         string is already the readable form. */
    }
    var hexes = text.match(/#[0-9a-fA-F]{6}\b/g);
    if (hexes) out = out.concat(hexes);
    return out;
  }
})();

(function () {
  var KEYS = ["darkMode", "dimImages"];
  var CACHE = "nwd.popup";

  var dark = document.getElementById("dark-toggle");
  var dim = document.getElementById("dim-toggle");
  var dimRow = document.getElementById("dim-row");
  var status = document.getElementById("status");

  var prefs = readCache();
  /* Per key, not global: a click on one switch must outrank an older read of
     that key while still letting the read supply the other key's real value. */
  var owned = { darkMode: false, dimImages: false };

  dark.addEventListener("change", function () {
    set("darkMode", dark.checked);
  });

  dim.addEventListener("change", function () {
    set("dimImages", dim.checked);
  });

  /* The cache is readable synchronously, so the popup paints the right state
     immediately. There is no async-read window in which a switch can show a
     value the user then clicks against, and no "Loading" state to escape --
     which is why no read timeout is needed even if chrome.storage hangs. */
  render();
  load();
  watchStorage();
  setUpLauncher();

  /* Opens nextwork.ai unless the active tab is already there. The tab's url is
     only legible because the extension holds host_permissions for these domains;
     for any other site the browser withholds it, and an unreadable url is itself
     the answer -- not NextWork, so offer to open it. This is why the feature adds
     no new permission. */
  function setUpLauncher() {
    var go = document.getElementById("go");
    var label = document.getElementById("go-label");
    if (!go) return;

    var HOME = "https://nextwork.ai/";
    var onNextWork = false;

    queryActiveTab(function (tab) {
      /* Anchored match, not a substring: "nextwork.ai.example.com" contains the
         domain but is not it. */
      onNextWork = /^https?:\/\/([^\/]*\.)?nextwork\.(ai|org)(\/|$|\?|#)/.test((tab && tab.url) || "");
      if (!onNextWork) return;
      go.classList.add("is-current");
      go.setAttribute("aria-disabled", "true");
      label.textContent = "You're on NextWork";
      /* Overrides the inline fallback colours, which a class cannot beat. */
      go.style.background = "transparent";
      go.style.color = "#9c928a";
      go.style.borderColor = "#383330";
    });

    go.addEventListener("click", function () {
      if (onNextWork) return;
      openHome();
    });

    function openHome() {
      try {
        if (chrome.tabs && chrome.tabs.create) {
          chrome.tabs.create({ url: HOME });
        } else {
          window.open(HOME, "_blank");
        }
      } catch (e) {
        window.open(HOME, "_blank");
      }
      /* Chrome keeps the popup open after tabs.create; closing it matches what a
         user expects from a navigation action. */
      window.close();
    }
  }

  function queryActiveTab(callback) {
    var done = false;
    function finish(tabs) {
      if (done) return;
      done = true;
      callback(tabs && tabs.length ? tabs[0] : null);
    }
    var returned;
    try {
      returned = chrome.tabs.query({ active: true, currentWindow: true }, finish);
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

  /* Writes only the key that changed. A whole-object write would republish this
     popup's possibly stale value for the key the user never touched. */
  function set(key, value) {
    owned[key] = true;
    prefs[key] = value;
    render();
    writeCache(prefs);
    var change = {};
    change[key] = value;
    storageSet(change);
  }

  function load() {
    storageGet(function (result) {
      if (result) adopt(normalize(result));
    });
  }

  /* Mirrors content.js: reflects a toggle made by the keyboard shortcut or
     another window while this popup is open. An external write is newer than
     any click made here, so it supersedes ownership. */
  function watchStorage() {
    try {
      chrome.storage.onChanged.addListener(function (changes, area) {
        if (area !== "local") return;
        var dirty = false;
        for (var i = 0; i < KEYS.length; i++) {
          var key = KEYS[i];
          if (!changes[key]) continue;
          var value = !!changes[key].newValue;
          /* A value equal to what is displayed is this popup's own write
             echoing back, so it must not release ownership of the key. */
          if (value === prefs[key]) continue;
          owned[key] = false;
          prefs[key] = value;
          dirty = true;
        }
        if (dirty) {
          writeCache(prefs);
          render();
        }
      });
    } catch (e) {}
  }

  /* The authoritative read only fills in keys the user has not already set. */
  function adopt(values) {
    for (var i = 0; i < KEYS.length; i++) {
      var key = KEYS[i];
      if (!owned[key]) prefs[key] = values[key];
    }
    writeCache(prefs);
    render();
  }

  function render() {
    dark.checked = prefs.darkMode;
    dim.checked = prefs.dimImages;
    dim.disabled = !prefs.darkMode;
    /* Explicit class rather than :has() on the parent, which older WebKit does
       not support. */
    dimRow.className = prefs.darkMode ? "row" : "row disabled";
    status.textContent = statusText();
  }

  /* Dimming is only meaningful while dark mode is on, so the off state is
     reported on its own rather than as a combination. */
  function statusText() {
    if (!prefs.darkMode) return "Dark mode off";
    if (prefs.dimImages) return "Dark mode on, images dimmed";
    return "Dark mode on";
  }

  function normalize(result) {
    return { darkMode: !!result.darkMode, dimImages: !!result.dimImages };
  }

  function readCache() {
    try {
      return normalize(JSON.parse(localStorage.getItem(CACHE)) || {});
    } catch (e) {
      return { darkMode: false, dimImages: false };
    }
  }

  function writeCache(value) {
    try {
      localStorage.setItem(CACHE, JSON.stringify(value));
    } catch (e) {}
  }

  /* Callback and promise shapes are both handled, since WebKit-derived
     extension layers may implement only one. The once-guard is load-bearing: a
     layer providing both would otherwise run the callback twice. */
  function storageGet(callback) {
    var done = false;
    function finish(result) {
      if (done) return;
      done = true;
      callback(result && typeof result === "object" ? result : null);
    }
    var returned;
    try {
      returned = chrome.storage.local.get(KEYS, finish);
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

  function storageSet(value) {
    var returned;
    try {
      returned = chrome.storage.local.set(value, function () {});
    } catch (e) {
      return;
    }
    if (returned && typeof returned.then === "function") {
      returned.then(null, function () {});
    }
  }
})();

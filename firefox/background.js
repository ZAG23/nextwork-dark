/* Handles the keyboard command and the toolbar icon. Nothing else in the
   extension depends on this worker, so dark mode still works if it is asleep or
   unsupported. */
chrome.commands.onCommand.addListener(function (command) {
  if (command !== "toggle-dark") return;
  /* Escapes System Theme rather than fighting it: darkMode already holds the
     effective state (content.js writes the resolved value back), so flipping it
     and dropping ownership inverts what the user is actually looking at. Both
     keys go in one set() so listeners see a single onChanged. */
  get("darkMode", function (result) {
    set({ systemTheme: false, darkMode: !result?.darkMode });
  });
});

/* Firefox resolves the toolbar icon from theme_icons against the real theme,
   third-party themes included. Overriding that with setIcon would swap correct
   detection for a prefers-color-scheme guess, so the Firefox build opts out --
   the manifest key's presence is the build marker, since sync-firefox.sh copies
   this file verbatim and cannot fork it.

   Chrome has no equivalent: there is no API for the toolbar's background, so
   the OS setting is the only available proxy. popup.js and content.js resolve
   it and cache it under systemDark; this only applies the result. */
if (!themeIconsBuild()) {
  chrome.runtime.onStartup.addListener(applyStoredIcon);
  chrome.runtime.onInstalled.addListener(applyStoredIcon);
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== "local" || !changes.systemDark) return;
    applyIcon(!!changes.systemDark.newValue);
  });
}

function themeIconsBuild() {
  try {
    return !!chrome.runtime.getManifest().action?.theme_icons;
  } catch (e) {
    return false;
  }
}

/* Covers a browser restart, which drops any icon set for the session. */
function applyStoredIcon() {
  get("systemDark", function (result) {
    applyIcon(!!result?.systemDark);
  });
}

/* dark = the toolbar is dark, so the off-white mark is the legible one. */
function applyIcon(dark) {
  var suffix = dark ? "" : "-dark";
  var returned;
  try {
    returned = chrome.action.setIcon({
      path: {
        16: "icons/icon16" + suffix + ".png",
        32: "icons/icon32" + suffix + ".png"
      }
    }, function () {});
  } catch (e) {
    return;
  }
  if (returned && typeof returned.then === "function") {
    returned.then(null, function () {});
  }
}

function get(key, callback) {
  var done = false;
  function finish(result) {
    if (done) return;
    done = true;
    callback(result && typeof result === "object" ? result : null);
  }
  var returned;
  try {
    returned = chrome.storage.local.get(key, finish);
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

function set(value) {
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

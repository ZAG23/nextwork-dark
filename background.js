/* Handles the keyboard command only. Nothing else in the extension depends on
   this worker, so dark mode still works if it is asleep or unsupported. */
chrome.commands.onCommand.addListener(function (command) {
  if (command !== "toggle-dark") return;
  get(function (result) {
    set({ darkMode: !(result && result.darkMode) });
  });
});

function get(callback) {
  var done = false;
  function finish(result) {
    if (done) return;
    done = true;
    callback(result && typeof result === "object" ? result : null);
  }
  var returned;
  try {
    returned = chrome.storage.local.get("darkMode", finish);
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

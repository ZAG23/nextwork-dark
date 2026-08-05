#!/bin/sh
# Copies the files shared between the Chromium and Firefox builds into
# firefox/. Firefox's moz-extension:// resource loader does not follow
# symlinks (confirmed: a symlinked popup.html loaded as a blank document,
# title unparsed), so firefox/ holds real copies instead of symlinks.
# Run this after editing any of the files below, before reloading the
# Firefox build.
set -eu
cd "$(dirname "$0")/.."

for f in content.js theme.css popup.html popup.css popup.js background.js LICENSE; do
  cp "$f" "firefox/$f"
done
rm -rf firefox/icons
cp -R icons firefox/icons

echo "firefox/ synced from source."

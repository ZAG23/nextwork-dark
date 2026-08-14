#!/bin/sh
# Builds the store-upload zips for both browsers into dist/.
#
#   dist/nextwork-dark-chrome-<version>.zip   -> Chrome Web Store / Edge Add-ons
#   dist/nextwork-dark-firefox-<version>.zip  -> addons.mozilla.org
#
# Both stores want manifest.json at the ZIP ROOT, not inside a wrapping folder.
# Only the files the extension actually loads are included: docs/, scripts/,
# .git/, README and the Sonar config are development-only and are left out.
set -eu
cd "$(dirname "$0")/.."

# Firefox build is a copy of the shared sources, so refresh it before zipping
# or the two packages can ship different code under the same version number.
./scripts/sync-firefox.sh >/dev/null

read_version() {
  sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$1" | head -1
}

VERSION=$(read_version manifest.json)
FF_VERSION=$(read_version firefox/manifest.json)
[ -n "$VERSION" ] || { echo "could not read version from manifest.json" >&2; exit 1; }

# sync-firefox.sh deliberately does not copy the manifests, so the two versions
# can drift. Both stores reject a re-upload of an already-published version, and
# shipping mismatched numbers makes bug reports impossible to place.
if [ "$VERSION" != "$FF_VERSION" ]; then
  echo "version mismatch: manifest.json is $VERSION, firefox/manifest.json is $FF_VERSION" >&2
  echo "bump both before packaging." >&2
  exit 1
fi

rm -rf dist
mkdir -p dist

SHARED="background.js content.js popup.html popup.css popup.js theme.css icons LICENSE"

# -r recurse, -q quiet, -X drop macOS extended attributes (a __MACOSX/ folder or
# AppleDouble ._ files in the upload trip AMO's "unexpected file" validation).
zip -rqX "dist/nextwork-dark-chrome-$VERSION.zip" manifest.json $SHARED \
  -x '*.DS_Store'

(cd firefox && zip -rqX "../dist/nextwork-dark-firefox-$VERSION.zip" manifest.json $SHARED \
  -x '*.DS_Store')

echo "Built version $VERSION:"
ls -lh dist/*.zip | awk '{print "  " $9 "  (" $5 ")"}'

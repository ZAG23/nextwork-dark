# NextWork Dark

A dark mode extension for the [NextWork](https://nextwork.ai) learning platform. Manifest V3, no build step, no dependencies.

> **Unofficial.** Community-built by a NextWork Build Master. Not an official NextWork product — please report issues here rather than to NextWork support.

The theme derives its palette from NextWork's own light theme rather than applying a generic dark filter. Sampling the live site shows every surface and text colour is warm (red > green > blue): paper `#f8f5f1`, cards `#f0e9e6`, body copy `#443e3a`. The dark tones invert that same hue family, so the site still reads as itself.

## Install

### Chromium-based browsers (Chrome, Edge, Brave, Arc, Orion)

1. Download or clone this repo.
2. Open your browser's extension manager:
   - Chrome / Edge / Brave / Arc — `chrome://extensions`, enable **Developer mode**, click **Load unpacked**
   - Orion — **Tools → Extensions → Manage Extensions → Install from Disk**, and enable *Allow installation of 3rd party Chrome extensions* in Settings → Advanced first
3. Select the repo folder.
4. Open any nextwork.ai page and click the toolbar icon.

**Orion note:** Orion caches all unpacked extension resources — manifest, scripts, stylesheets — and does not reload them on disable/re-enable. After pulling an update, **remove the extension from Tools → Extensions and re-add it from disk**. Measured: a stale `manifest.json` kept old permissions, and a stale `popup.css` kept the popup rendering in the old colour scheme even after the source was corrected. Disabling and re-enabling is not enough.

### Firefox

The `firefox/` folder holds a Firefox-flavoured manifest plus copies of the shared files (`content.js`, `theme.css`, `popup.*`, `background.js`, `icons/`, `LICENSE`). The only source difference from the Chromium build is `background`: Firefox's MV3 implementation wants a plain `scripts` array rather than Chrome's `service_worker` key. The rest of the extension already handles both callback- and Promise-shaped `chrome.*` APIs, which is the form Firefox's WebExtensions implementation exposes, so no code forks were needed there.

These are real copies, not symlinks — measured: Firefox's `moz-extension://` resource loader does not follow a symlinked `popup.html`; it resolves to an empty document (title left unparsed, nothing rendered), which silently breaks the popup and, because `background.js` also symlinked, disables the keyboard shortcut too, with no error surfaced anywhere. After editing any shared file, run:

```
./scripts/sync-firefox.sh
```

before reloading the Firefox build. This just copies files — no bundler, no dependencies.

1. Download or clone this repo.
2. Go to `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on**.
3. Select `firefox/manifest.json`.
4. Open any nextwork.ai page and click the toolbar icon.

This is a temporary install — Firefox unloads it on restart, and reloading picks up file changes immediately (no cache to fight, unlike Orion). Requires Firefox 109+. For a permanent install you'd need to sign it through [addons.mozilla.org](https://addons.mozilla.org/developers/) (self-distributed or listed); the `browser_specific_settings.gecko.id` in `firefox/manifest.json` is a placeholder and should be replaced with your own before doing that.

## Features

- Warm dark theme for nextwork.ai and nextwork.org, matched to the site's own palette
- **Dim Images** — softens images while dark mode is active, full brightness on hover
- **Open NextWork** — jumps to the platform (opens https://nextwork.ai in a new tab), and goes inert when you are already there. Uses an anchored domain regex (`/^https?:\/\/([^\/]*\.)?nextwork\.(ai|org)(\/|$|\?|#)/`) so `nextwork.ai.example.com` does not match. The tab's URL is readable because the extension holds `host_permissions` for these domains; on any other site the browser withholds it, and an unreadable URL is the signal to offer the button — no new permission needed.
- Preferences persist across reloads, navigations, tabs and restarts
- No flash of white on page load
- Keyboard shortcut: `Cmd+Shift+D` / `Ctrl+Shift+D`
- Fully keyboard accessible

## How it works

| File | Role |
| --- | --- |
| `manifest.json` | MV3, Chromium build. One permission: `storage`. |
| `firefox/manifest.json` | MV3, Firefox build. Same as above but `background.scripts` instead of `service_worker`, plus a `gecko` id. Every other file in `firefox/` is a real copy of the Chromium source, kept in sync by `scripts/sync-firefox.sh` — not a symlink, which Firefox's resource loader does not follow. |
| `content.js` | Sets a gate attribute on `<html>` at `document_start`; sweeps for light surfaces CSS cannot reach. |
| `theme.css` | The theme. Every rule gated behind `html[data-nwdark="on"]`. |
| `popup.html` / `popup.css` / `popup.js` | Two toggles, backed by `chrome.storage.local`. |
| `background.js` | Keyboard command only — dark mode does not depend on it. |

Three design decisions are load-bearing:

**A gate attribute, not injected CSS.** `theme.css` ships as a content script at `document_start` with every rule scoped to `html[data-nwdark="on"]`. `content.js` reads a `localStorage` mirror synchronously — the only storage readable before first paint — and sets the attribute before the page renders. No flash of white, and no dependency on a service worker being awake.

**Inline styles for what CSS cannot win.** NextWork's Tailwind declares `!important` inside `@layer`, and a layered `!important` beats an unlayered one regardless of selector specificity. A stylesheet genuinely cannot repaint those surfaces. `content.js` measures computed colours, finds anything still light, and writes `element.style` directly.

**Measurement instead of class-name guessing.** Surfaces are found by reading computed colour, not by matching class names. NextWork uses Tailwind arbitrary values (`bg-[#f0ebe9]`), semantic utilities that carry no colour in the class string, and gradients whose colour lives in the background image. None are addressable by selector. This matters more than it sounds: the theme lightens *all* text, so every surface missed becomes light-on-light — worse than no theme at all.

## Provenance

Built by following the NextWork project *Build a Dark Mode Extension*, then substantially rewritten. The generated code did not work as written; [`docs/FEEDBACK.md`](docs/FEEDBACK.md) documents ten defects with reproductions, offered back to NextWork as course feedback. Tutorial text is NextWork's course content and is not redistributed here.

## Licence

MIT — see [LICENSE](LICENSE). The NextWork name and logo belong to NextWork.

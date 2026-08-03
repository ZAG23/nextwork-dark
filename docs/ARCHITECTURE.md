# Architecture

Why this extension is built the way it is. Every decision here traces to something that was measured, usually after a simpler approach failed.

## The gate attribute

`theme.css` is a content script injected at `document_start`, with every rule scoped to `html[data-nwdark="on"]`. It is inert until `content.js` sets that attribute.

This exists to solve first paint. `chrome.storage` is asynchronous in every implementation, so it cannot be read before the page renders — any design that awaits it flashes white on every navigation. `localStorage` *is* synchronously readable that early, so `content.js` keeps a mirror of the preference there, reads it immediately, and sets the attribute before anything paints. `chrome.storage` remains the source of truth and reconciles a moment later.

Two consequences worth knowing:

- At `document_start`, `document.documentElement` is null. Setting the attribute has to wait for `<html>` to exist, via a `MutationObserver` on `document`.
- The transition rule is gated behind a *second* attribute, `data-nwd-animate`, added on the next frame. Without that, a page that opens dark would animate up from white — the cross-fade should only apply to user toggles.

## Inline styles for what CSS cannot win

NextWork's Tailwind declares `!important` inside `@layer`. A layered `!important` beats an unlayered one regardless of selector specificity. Measured:

```css
@layer utilities { .mint { background-color: #d4f5e0 !important; } }
html[data-x] [data-lit] { background-color: #221f1d !important; }
```

→ computed `rgb(212, 245, 224)`. The page wins. No selector in an unlayered sheet can beat it.

Inline `!important` on the element does win. So for surfaces the page paints via layered utilities, `content.js` writes `element.style` directly. Inline styles outlive the gate attribute, so turning dark mode off has to remove them explicitly or the page stays dark.

## Measurement, not class names

Surfaces are found by reading computed colour. Class names cannot express them:

| Pattern | Why a selector fails |
| --- | --- |
| `bg-[#f0ebe9]` | arbitrary value — matches no colour word |
| semantic utilities | carry no colour in the class string |
| gradients | colour lives in `background-image` |
| scroll fades | gradient comes from a stylesheet rule, no class hook at all |

The measurement sweep (content.js lines 173–289) computes the luminance of each element's background colour and any gradient stops. Luminance is calculated per ITU-R BT.709 as `0.2126 * red + 0.7152 * green + 0.0722 * blue`. Any element with luminance above the `LIGHT = 150` threshold (approximately 60% grey on a 0–255 scale) is tagged `data-nwd-lit` and repainted inline with `#272320` background. This catches arbitrary values (`bg-[#f0ebe9]`), semantic utilities, and gradients whose colour lives in `background-image`, not in a class name. A `MutationObserver` batched on `requestAnimationFrame` catches content that mounts after page load — reflection cards, expanded steps, popovers.

The threshold of 150 was set by measuring NextWork's own light surfaces. The paper background `#f8f5f1` measures 242, cards `#f0e9e6` measure 235. A surface measuring 149 or below reads as already dark and is left alone.

This matters more than it appears. The theme lightens *all* text, so any surface left light becomes light-on-light — worse than no theme. Measurement is the only approach that cannot silently miss one.

Two traps found the hard way:

- **Substring selectors over-match.** `[class*="tip"]` matches `tiptap`, the editor root. That painted the whole content column as a callout, seaming it against the canvas. Short patterns use `[class~="..."]`.
- **Never paint what was transparent.** The editor column is `rgba(0,0,0,0)` by design. Inferring a surface from a structural word like `card` or `container` invents a background the site never had. Only classes that *name* a light background get one; everything else is left to measurement.

## Shadow DOM piercing

Published NextWork projects render through a Web Component library — `nw-code-block`, `nw-button`, `nw-validation-box`, `nw-editor`, and approximately 30 other custom elements. Measured on one published project page: 1032 shadow roots containing 596 light surfaces across 19 component types.

Page CSS cannot cross a shadow boundary. `theme.css` and the measurement sweep above both apply to the light DOM only, so without a second strategy every component interior stays light — cream code blocks, white buttons, mint reflection cards.

Every root is `mode: "open"` and supports `adoptedStyleSheets`, so one shared `CSSStyleSheet` can be adopted into all of them. The sheet is constructed in JS (content.js lines 28–165) and contains element-type selectors and component-specific class patterns.

This sheet is deliberately **UNLAYERED**. The components' own rules sit in `@layer base` and `@layer utilities`, and an unlayered declaration outranks any layered one regardless of specificity. This is the inverse of the light-DOM case, where the page's layered `!important` beats an unlayered stylesheet and forces inline styles instead.

Measured: 596 light surfaces reduced to 2 after adoption.

### Performance: the WeakSet optimization

Roots already carrying the sheet are remembered in a `WeakSet`, so a re-scan triggered by a DOM mutation can skip their entire subtree instead of re-walking it. Without this, the `MutationObserver` paid the full 1000-root traversal on every DOM change (including every keystroke in the editor), which made scrolling feel heavy.

Components mount lazily — expanding a step can attach dozens of new roots. The observer scans only the added subtrees, not the whole document, so a single keystroke does not cost a full traversal.

## Cross-implementation API access

Every `chrome.*` call passes a callback *and* handles a returned promise, with a once-guard so an implementation providing both does not fire twice:

```javascript
var returned;
try {
  returned = chrome.storage.local.get(KEYS, finish);
} catch (e) {
  finish(null);
  return;
}
if (returned && typeof returned.then === "function") {
  returned.then(finish, function () { finish(null); });
}
```

Promise-style MV3 APIs are a Chrome extension. WebKit-derived layers may implement callback style only, and an `await` that never settles renders the popup blank. Verified against three stub shapes: promise, callback-only, and a `chrome` that throws outright.

## The popup

The switch container is a `<label>`, and the checkbox is full-size and topmost (`inset: 0`, `z-index: 1`) rather than zero-size. This is the fix for the original unclickable toggle — verified with synthesized mouse events at the centre, all four edges, and both corners.

No border-radius on the input: a radius on a transparent full-size input makes corner hit-tests fall through to the parent. The radius lives on the visible track.

State is read synchronously from the `localStorage` cache so the popup paints correct immediately — there is no async window in which a switch shows a value the user then clicks against, and therefore no need for a read timeout. Ownership is tracked *per key*, so a late storage read cannot clobber a click the user made while it was in flight.

## The launcher button

The popup's "Open NextWork" button opens https://nextwork.ai in a new tab, unless the active tab is already on NextWork — in which case it goes inert and displays "You're on NextWork".

The URL test is an anchored regex: `/^https?:\/\/([^\/]*\.)?nextwork\.(ai|org)(\/|$|\?|#)/`. This prevents `nextwork.ai.example.com` from matching — the domain must be at the authority position in the URL, not embedded in a longer hostname.

Reading a tab's URL normally requires the broad `tabs` permission, but a matching `host_permissions` entry also grants it. The extension holds `host_permissions` for `*://*.nextwork.ai/*` and `*://*.nextwork.org/*`, so on a NextWork tab the URL is readable. On any other site the browser withholds it, and that withholding is the signal: an unreadable URL means "not NextWork", so the button offers to open it.

This is why the feature adds no new permission. The dual-shape `chrome.tabs.query` call (popup.js lines 80–99) handles both promise and callback implementations so the button works in WebKit-derived layers.

## The service worker

Handles the keyboard command. Nothing else. Dark mode works whether or not it is running — MV3 workers are designed to be evicted, so anything user-visible that depends on one is a latent failure.

## Testing and contributing

### Testing constraints

Chrome 151+ removed the `--load-extension` flag, so the unpacked extension cannot be loaded into headless Chrome. Attempts fail silently: `chrome-extension://` URLs resolve to `chrome-error://chromewebdata` and `chrome://extensions-internals` lists nothing.

What works instead: headless Chrome browses ordinary pages fine. To test `popup.html`, copy it plus `popup.css`, `popup.js`, and `icons/` to a temp directory, inject a stub `chrome` object before `popup.js` runs, and load over `file://`. Drive it with CDP (Chrome DevTools Protocol) over plain `node` — Node v26 has global `WebSocket`, so no npm install needed.

To test the theme and shadow piercing: build a synthetic page with custom elements that `attachShadow({mode: "open"})`, or load a real nextwork.ai project page. **Important:** an unauthenticated project page renders only a ~406-element login shell. A real page is >2000 elements. If you measure ~406 and find "0 problems", you measured nothing — check the element count first.

To test clickability you must synthesize real mouse events with `Input.dispatchMouseEvent` (mousePressed + mouseReleased) at coordinates from `getBoundingClientRect`. A JS `.click()` or `.checked = true` proves nothing — it bypasses hit-testing. Also assert `document.elementFromPoint(x, y)` matches the element you expect.

`getComputedStyle` can return stale values immediately after hot-swapping a stylesheet. Force a reload or read via `CSS.getMatchedStylesForNode` before concluding a rule does not work. This caused three wrong diagnoses during development.

### Invariants to preserve

- **Never paint an element the site left transparent.** Inferring a surface from a structural word like `card` or `container` invents a background the site never had. The editor column is `rgba(0,0,0,0)` by design; painting it creates a visible seam.
- **Short substring selectors over-match.** `[class*="tip"]` matches `tiptap`, the editor root, painting the entire content column as a callout. Use `[class~="..."]` for short patterns, or measure with `getComputedStyle` rather than matching class names.
- **No new build step or dependencies.** The extension is plain JS with no bundler, so it works in any Chromium browser including WebKit-derived layers with partial MV3 support.
- **Do not weaken the gate attribute or break the toggle.** Both are verified working: the toggle passes real-mouse-click tests at centre, all four edges, and both corners, under promise / callback-only / throwing `chrome` stubs.

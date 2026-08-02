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

The sweep walks the DOM, computes luminance for each element's background (and each gradient stop), and repaints anything above the threshold. A `MutationObserver`, batched on `requestAnimationFrame`, catches content that mounts after load — reflection cards, expanded steps, popovers.

This matters more than it appears. The theme lightens *all* text, so any surface left light becomes light-on-light — worse than no theme. Measurement is the only approach that cannot silently miss one.

Two traps found the hard way:

- **Substring selectors over-match.** `[class*="tip"]` matches `tiptap`, the editor root. That painted the whole content column as a callout, seaming it against the canvas. Short patterns use `[class~="..."]`.
- **Never paint what was transparent.** The editor column is `rgba(0,0,0,0)` by design. Inferring a surface from a structural word like `card` or `container` invents a background the site never had. Only classes that *name* a light background get one; everything else is left to measurement.

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

## The service worker

Handles the keyboard command. Nothing else. Dark mode works whether or not it is running — MV3 workers are designed to be evicted, so anything user-visible that depends on one is a latent failure.

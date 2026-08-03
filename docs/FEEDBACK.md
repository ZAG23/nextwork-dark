# Course feedback: *Build a Dark Mode Extension*

Findings from building the project as written, then debugging it to a working state.

Every claim below was verified empirically — headless Chrome driven over the DevTools Protocol, real synthesized mouse events, computed-style measurement. Where a number appears, it was measured. Nothing here is inferred from reading the code alone.

**Update:** The regenerated project (Aug 2026) fixed 9 of 10 original defects. See [FOLLOWUP.md](FOLLOWUP.md) for second-pass findings.

**Headline:** a learner who follows the project exactly ends up with an extension whose popup opens, whose toggle appears to do nothing, and which produces no error message anywhere. Three independent blocking defects each cause that same symptom, so fixing one does not reveal progress.

And once those are fixed, a fourth issue surfaces that the project never mentions: published projects render through a Web Component library, and page CSS cannot reach inside a shadow root (defect 8b).

Project version: `cf82e2ed-9cc3-4b95-adc7-181889dc6d41_v1`

---

## Blocking — the extension cannot work as written

### 1. Wrong domain throughout

Match patterns and the URL guard target `nextwork.org`, but the live platform is `nextwork.ai` (`.org` 301-redirects to it). Confirmed: `curl -L https://nextwork.org` → `https://nextwork.ai/`.

```javascript
function isNextWorkUrl(url) {
  if (!url) return false;
  return url.includes("nextwork.org");   // never true on the real site
}
```

Every injection path is gated on this, so all of them silently no-op. The learner is told to navigate to `nextwork.org` and observe dark mode; they observe nothing.

**Fix:** cover both domains and their subdomains.

### 2. The toggle switch cannot be clicked

The popup markup:

```html
<div class="switch">
  <input type="checkbox" id="dark-toggle">   <!-- opacity:0; width:0; height:0 -->
  <span class="slider"></span>               <!-- position:absolute; inset:0 -->
</div>
```

The container is a `<div>`, so there is no implicit label→control association. The checkbox has a zero-size hit box. The `.slider` span covers the whole control. A real click therefore lands on the span and goes nowhere.

Measured with `Input.dispatchMouseEvent` at the switch centre (218, 79):

| | Result |
| --- | --- |
| `document.elementFromPoint` | `SPAN.slider` |
| `checkbox.checked` after click | `false` |
| `change` event fired | no |
| `chrome.*` calls made | none |

Clicking the *text* label works, because that is a real `<label for="dark-toggle">`. So the feature appears half-broken in a way that is hard to attribute.

**Fix:** make the container a `<label>`. In this repo the input is also full-size and topmost (`inset: 0`, `z-index: 1`) so the whole control is hit-testable. Note: a `border-radius` on a transparent full-size input makes corner clicks fall through — the radius belongs on the visible track.

> Worth flagging as a teaching point: this pure-CSS toggle pattern is widely copied, and the `<label>` container is the part most often dropped. A verification step of "click the switch itself, not the label" would catch it.

### 3. `host_permissions` missing

```json
"permissions": ["activeTab", "scripting", "storage"]
```

`activeTab` grants host access only after a user gesture **on that tab**. The `chrome.tabs.onUpdated` handler injects into tabs the user never clicked, so `insertCSS` has no authority there and rejects. The rejection is swallowed by the tutorial's own `try/catch`, so nothing surfaces.

**Fix:** declare explicit `host_permissions`. (The content-script architecture in this repo needs neither `activeTab` nor `scripting` — it ships with `storage` alone.)

---

## Architecture — fragile by construction

### 4. Dark mode depends on a lazy service worker

All styling routes through the MV3 background worker. If it is asleep, evicted, or unsupported, the toggle does nothing and reports nothing. MV3 workers are *designed* to be evicted, so this is an expected state, not an edge case.

**Fix:** a content script that applies the theme from stored preferences. Nothing user-visible depends on the worker; here it handles only the keyboard command.

### 5. Flash of white on every page load

Step 3 sets up `content_scripts` with `run_at: "document_start"` and explains — correctly — that this "injects the CSS before the page paints, so the user never sees a flash of white."

Step 4 then removes it in favour of injecting on `changeInfo.status === "complete"`, which is *after* the page has painted. The flash is reintroduced on every navigation, and the tutorial does not acknowledge the regression.

**Fix:** keep the CSS at `document_start` and gate it behind an attribute set synchronously from a `localStorage` mirror. `chrome.storage` is async in every implementation and can never beat first paint.

### 6. Promise-only `chrome.*` calls

`await chrome.storage.local.get(...)` throughout. Promise-style MV3 APIs are a Chrome extension; WebKit-derived layers (Orion, which many learners on macOS use) may implement callback style only. The awaits then never settle and the popup renders blank or stale.

**Fix:** pass a callback *and* handle a returned promise, with a once-guard so a layer providing both does not fire twice.

---

## Correctness

### 7. The `!important` premise is incorrect

Step 3 states:

> Every rule uses `!important` because your extension CSS must override the site's existing styles.

This is not true for this site. NextWork's Tailwind build declares `!important` inside `@layer`, and **a layered `!important` beats an unlayered one regardless of selector specificity.** Reduced test case:

```css
@layer utilities { .mint { background-color: #d4f5e0 !important; } }   /* page */
html[data-x] [data-lit] { background-color: #221f1d !important; }      /* extension */
```

Computed result: `rgb(212, 245, 224)` — the page wins. Inline `!important` on the element wins (`rgb(34, 31, 29)`).

Consequence: the reflection cards render as bright mint with pale, near-invisible text, and **no stylesheet rule can fix it.** This is the single most important correction — it invalidates the strategy the whole CSS step is built on. The tutorial never mentions `@layer`.

**Fix:** for surfaces the page paints via layered utilities, set styles inline from JS.

### 8. Selectors do not match the real DOM

`dark-mode.css` guesses structural class names (`[class*="card"]`, `[class*="panel"]`, `[class*="box"]`). NextWork ships Tailwind, so the real surfaces are:

- arbitrary values — `bg-[#f0ebe9]`, matching no colour-word pattern
- semantic utilities carrying no colour in the class string
- gradients, where the colour lives in `background-image`, not `background-color`
- stylesheet-driven scroll fades with **no colour-related class at all**

Measured on a live project page with the tutorial's CSS: **132 elements over 2000px² still painted a light background.**

This compounds badly. The stylesheet lightens *all* text but darkens only nameable surfaces, so every miss becomes **light-text-on-light-background** — actively less readable than no theme. The failure mode is worse than the absence of the feature.

**Fix:** measure. `getComputedStyle` reads what a class name cannot express. This repo sweeps the DOM, finds anything still light (including gradient stops), and repaints it — with a `MutationObserver` for content that mounts after load, which is what reflection cards and expanded steps do.

Two further traps found by measurement:

- **Substring selectors over-match.** `[class*="tip"]` also matches `tiptap`, the editor root, so the entire content column was painted as a callout and formed a visible vertical seam against the canvas. Short patterns need `[class~="..."]`.
- **Don't paint what was transparent.** The editor column is `rgba(0,0,0,0)` by design. Guessing a surface from a structural word invents a background the site never had, which is what produced the seam.

### 8b. The component library is never mentioned

Published projects render through a Web Component library — `nw-code-block`, `nw-button`, `nw-validation-box`, `nw-editor` and ~30 others. Measured on one project page: **1,032 shadow roots**, containing **596 light surfaces across 19 component types**.

Page CSS cannot cross a shadow boundary. So a learner who completes the project exactly as taught gets an extension that themes the page chrome and leaves every component interior in light mode — cream code blocks, white buttons, mint reflection cards. On a step-heavy page that is most of what they are looking at.

This is invisible from inside the tutorial, because the project the learner writes their answers into is rendered from the editor in plain DOM. The failure only appears on *published* projects, which is where they will actually use it.

Getting past it needs `adoptedStyleSheets` on each open root, and one non-obvious detail: the sheet must be **unlayered**. The components' own rules sit in `@layer base` / `@layer utilities`, so an unlayered declaration outranks them — the exact inverse of the light-DOM situation in defect 7. Measured 596 → 2 with that approach.

A note in the project that dark mode stops at a shadow boundary would be worth more than the fix itself; it is a concept most learners will meet for the first time here.

### 9. Dead code

`NEXTWORK_PATTERNS` is declared, explained in prose, and listed in the final checklist — but never referenced. `isNextWorkUrl` hardcodes a substring instead. It reads as an intended `matches`-pattern check that was never wired up.

### 10. Documentation errors

- Step 4 checkpoint: *"Confirm you have saved all three files: `manifest.json`, `background.js`, `popup.html`, and `popup.js`"* — three vs. four.
- Step 5 explains that toggle-off animates but toggle-on does not, attributing it to the transition rule arriving with the colours. The real cause is that `insertCSS` applies the rule and the colours in the same frame, so there is no "before" state. The observation is right; the mechanism is misstated.
- Steps 2 and 3 both instruct disable/re-enable to reload. In Orion that does **not** re-read `manifest.json` — a stale manifest persists until the extension is removed and re-added. Worth a platform note, since it makes a corrected manifest look like it changed nothing.

---

## Suggested course changes

1. Fix the domain to `nextwork.ai` — without this nothing works.
2. Make the switch container a `<label>`, and add a verification step that clicks the switch itself, not the label.
3. Add `host_permissions`, or drop to a content-script design that needs no host permission at all.
4. Teach the content-script + gate-attribute approach instead of service-worker injection. It is simpler, avoids the flash of white, and has fewer failure modes.
5. Replace the `!important` claim with a short explanation of `@layer` precedence, and show measuring a computed colour as the reliable technique.
6. Add an Orion note on manifest caching.

The overall arc — inspect a live site, write overrides, add programmatic control, persist preferences — is a genuinely good structure for teaching browser extensions. The defects are in the specifics, and most are one-line fixes.

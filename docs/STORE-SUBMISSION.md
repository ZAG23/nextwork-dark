# Store submission

Everything needed to list NextWork Dark on the Chrome Web Store and addons.mozilla.org
(AMO). Build the uploads with:

```
./scripts/package.sh
```

That writes `dist/nextwork-dark-chrome-<version>.zip` and
`dist/nextwork-dark-firefox-<version>.zip`, each with `manifest.json` at the zip root and
development-only files (`docs/`, `scripts/`, `.git/`, `README.md`, `.sonarcloud.properties`)
left out. `dist/` is gitignored — rebuild rather than commit.

## Name and trademark: settled

NextWork's CEO has given permission to publish under the name **NextWork Dark**, so the name
and the existing icon both stand as-is. No manifest changes needed.

Both stores still screen for trademarks in listing names, and a reviewer who does not know
about the permission may flag it. Two things make that a non-event:

- **The permission is in writing** from NextWork's CEO — that written record is what a Chrome
  trademark appeal or an AMO reviewer reply needs, and neither store can act on anything less.
  Keep it retrievable outside this repo; a challenge can arrive long after launch.
- **Say so up front in the reviewer notes** (already included in the AMO section below).
  Chrome has no reviewer-notes field, so there the permission only comes into play on appeal
  if the listing is challenged.

Keep the "Unofficial" line at the top of both descriptions regardless. Permission to publish
is not the same as this being a NextWork product, and the disclaimer is what keeps support
requests pointed at GitHub instead of at NextWork.

## Chrome Web Store

One-time $5 developer registration fee. Review is typically a few days, longer for a new
publisher account.

**Package:** `dist/nextwork-dark-chrome-<version>.zip`

| Field | Value |
| --- | --- |
| Category | Accessibility |
| Language | English (United States) |
| Short description (132 char max) | Warm dark theme for the NextWork learning platform, matched to the site's own palette. Unofficial, community-built. |

**Single purpose** (they ask for this verbatim, keep it to one sentence):

> Apply a dark colour theme to pages on nextwork.ai and nextwork.org.

**Permission justifications** — each permission gets its own box in the dashboard:

- `storage` — Stores two user preferences (dark mode on/off, dim images on/off) on the
  device. A `localStorage` mirror is read synchronously at `document_start` because it is the
  only storage readable before first paint, which is what prevents a flash of white on load.
  Nothing is transmitted anywhere.
- `host_permissions` for `nextwork.ai` / `nextwork.org` and their subdomains — These are the
  only sites the extension themes. The content script restyles pages on these domains, and
  the popup reads the active tab's URL to decide whether the "Open NextWork" button is useful
  or should go inert. No other host is requested.

**Data usage disclosures:** tick nothing. The extension collects and transmits no user data,
so no privacy policy URL is required. Certify that data is not sold, not used for unrelated
purposes, and not used for creditworthiness or lending.

**Remote code:** answer "No, I am not using remote code." All JavaScript is in the package —
no `eval`, no `new Function`, no injected `<script>`, no network requests.

## addons.mozilla.org

Free. Submit as a **listed** add-on so Mozilla signs and hosts it.

**Package:** `dist/nextwork-dark-firefox-<version>.zip`

| Field | Value |
| --- | --- |
| Categories | Appearance, Other |
| Licence | MIT |
| Summary (250 char max) | see below |

**Summary** — 235 of the 250 characters allowed:

> Warm dark theme for the NextWork learning platform (nextwork.ai and nextwork.org), derived
> from the site's own light palette rather than a generic invert filter. Optional image
> dimming. Unofficial, published with NextWork's permission.

**Description.** AMO accepts a limited HTML subset — `<strong>`, `<em>`, `<ul>`, `<li>`,
`<a>`, `<code>`, `<blockquote>`. No `<p>` and no headings; blank lines become paragraph
breaks. This is the Chrome body from the bottom of this file with two deliberate changes: the
no-tracking claim is promoted out of the bullet list into its own paragraph, because on AMO
that is the line privacy-minded users scan for and it is independently checkable against the
`data_collection_permissions` declaration; and the keyboard shortcut leads with Ctrl rather
than Cmd, since Firefox desktop skews Windows and Linux.

```html
<strong>Unofficial — community-built, not a NextWork product, but published with NextWork's permission.</strong> Please report problems on GitHub rather than to NextWork support.

A dark theme for the NextWork learning platform that keeps the site looking like itself. Rather than applying a generic inversion filter, the palette is derived from NextWork's own light theme — every surface and text colour on the site is warm, so the dark tones invert that same hue family instead of flattening everything to grey.

<ul>
<li>Themes nextwork.ai and nextwork.org, including subdomains</li>
<li><strong>Dim Images</strong> — softens images while dark mode is on, full brightness on hover</li>
<li>No flash of white on page load</li>
<li>Preferences persist across reloads, tabs and restarts</li>
<li>Keyboard shortcut: Ctrl+Shift+D (Cmd+Shift+D on macOS)</li>
<li>Fully keyboard accessible</li>
</ul>

<strong>No accounts, no tracking, no network requests.</strong> The only stored data is your two toggle settings, kept on your own device.

Open source under the MIT licence: <a href="https://github.com/ZAG23/nextwork-dark">github.com/ZAG23/nextwork-dark</a>

The NextWork name and logo belong to NextWork.
```

### Source code submission: not required

AMO asks whether the add-on uses code generators or minifiers, bundlers such as webpack, web
template engines, or *any other tool that takes code or files, applies processing, and
generates code or files to include in the extension*. **The answer is no to all four**, and
the fourth is the one that deserves a second look, because this repo does run two scripts.
Neither transforms anything:

- `scripts/sync-firefox.sh` is `cp`. The seven shared files are byte-identical between the
  repo root and `firefox/` — verify with
  `for f in content.js theme.css popup.html popup.css popup.js background.js LICENSE; do cmp "$f" "firefox/$f"; done`.
- `scripts/package.sh` is `zip`. Unpacking the built archive and running `diff -r` against
  `firefox/` shows no difference.

Copying and archiving are not what the question is about. It exists so reviewers know whether
the submitted files can be read as the real source, and here they can, byte for byte.

**Keep it that way.** Answering no while shipping a file that does not look like authored
source is a rejection with a slow appeal. If a build step, a minifier, or a CSS preprocessor
is ever added, this answer flips to yes and a source archive has to accompany every upload —
which is a large part of why the sync stays a plain `cp` rather than anything cleverer.

**Notes for the reviewer** (paste into "Notes to Reviewer"):

> This is an unofficial, community-built dark theme for the NextWork learning platform,
> published with the permission of NextWork's CEO to use the NextWork name. Written
> confirmation can be supplied on request.
>
> No build step, no dependencies, no minification — the files in the package are the source.
> The repository is at https://github.com/ZAG23/nextwork-dark.
>
> The extension makes no network requests and collects no data. The only stored state is two
> booleans in `chrome.storage.local`, mirrored into `localStorage` so `content.js` can read
> the preference synchronously at `document_start` and set a gate attribute on `<html>`
> before first paint; every rule in `theme.css` is scoped behind that attribute.
>
> `content.js` writes inline styles in one place. This is not obfuscation: NextWork's
> Tailwind build declares `!important` inside `@layer`, which beats an unlayered `!important`
> at any specificity, so those surfaces cannot be repainted from a stylesheet. The script
> measures computed colours and repaints only elements that are still light.
>
> `theme.css` is listed in `web_accessible_resources` because it is also injected into shadow
> roots, which a page-level stylesheet cannot cross. It is exposed only to the two matched
> domains.
>
> `data_collection_permissions` is declared as `none`, which is accurate. The two linter
> warnings about it are the key requiring Firefox 142 while `strict_min_version` is `109.0`,
> where MV3 support began. The lower minimum is intentional: raising it would drop Firefox
> 109–141 including ESR 140, and a "collects nothing" declaration has no consent prompt for
> an older browser to fail to show. Happy to raise it if you would prefer.

**Privacy policy:** none needed — declare that no data is collected.

**Validation.** `npx --yes web-ext@latest lint --source-dir=./firefox` runs Mozilla's own
validator, the same one AMO runs on upload. Current state: **0 errors, 2 warnings**, both the
same known interaction and both safe to submit with.

`browser_specific_settings.gecko.data_collection_permissions` is set to `{"required":
["none"]}` — required for all new Firefox extensions, and the declaration that this add-on
collects nothing. The key only landed in Firefox 142, while `strict_min_version` is `109.0`
(where MV3 support arrived), so the validator warns twice that older Firefox cannot read it.
That is left as-is deliberately: raising the minimum to 142 would clear the warnings but drop
Firefox 109–141, including ESR 140 users, and because the declaration is "collects nothing"
there is no consent prompt for an older browser to miss. Nothing is lost by ignoring it.

Re-run the lint after any manifest change — it is the cheapest way to catch a rejection
before spending a review cycle on it.

`browser_specific_settings.gecko.id` is currently `nextwork-dark@nextwork-dark.app`. AMO
registers whatever ID is uploaded first and it is permanent for the listing, so change it now
if a different one is wanted — after the first upload it cannot be changed without publishing
a separate add-on.

## Store assets

The 128×128 icon is already in the package. Still needed, and the same images work for both
stores:

- **Screenshots** — 1–5, at 1280×800 (Chrome also accepts 640×400; AMO is flexible). Shoot a
  real nextwork.ai page: one with the theme on, one showing the popup open over a themed
  page, one before/after pair. Chrome shows the first screenshot in search results, so make
  that one the most legible.
- **Small promo tile**, 440×280 — optional, but Chrome cannot feature a listing without it.

Screenshots have to come from a logged-in NextWork session, so they are yours to capture.

## Chrome description body

Plain text only — Chrome strips markup. The AMO version above is this text with the
no-tracking line promoted to its own paragraph and the shortcut order flipped; edit both if
the wording changes.

> **Unofficial — community-built, not a NextWork product, but published with NextWork's
> permission.** Please report problems on GitHub rather than to NextWork support.
>
> A dark theme for the NextWork learning platform that keeps the site looking like itself.
> Rather than applying a generic inversion filter, the palette is derived from NextWork's own
> light theme — every surface and text colour on the site is warm, so the dark tones invert
> that same hue family instead of flattening it to grey.
>
> • Themes nextwork.ai and nextwork.org, including subdomains
> • Dim Images — softens images while dark mode is on, full brightness on hover
> • No flash of white on page load
> • Preferences persist across reloads, tabs and restarts
> • Keyboard shortcut: Cmd+Shift+D (Ctrl+Shift+D on Windows and Linux)
> • Fully keyboard accessible
> • No accounts, no tracking, no network requests — the only stored data is your two toggle
>   settings, kept on your own device
>
> Open source under the MIT licence: https://github.com/ZAG23/nextwork-dark
> The NextWork name and logo belong to NextWork.

## Order of operations

1. Save NextWork's written permission somewhere outside this repo, where an appeal can reach
   it months from now.
2. Capture screenshots.
3. Submit to AMO first — it is free and reviews fastest, so it surfaces packaging problems
   before the paid Chrome submission.
4. Submit to Chrome.
5. Optional: the Chrome zip uploads unchanged to Microsoft Edge Add-ons, which is free and
   covers Edge users directly.
6. Once both are live, replace the "Load unpacked" instructions in `README.md` with store
   links, keeping the unpacked route as a development section.

## Releasing an update

Bump `version` in **both** `manifest.json` and `firefox/manifest.json` — `sync-firefox.sh`
does not copy the manifests, so they drift independently. `package.sh` refuses to build if
the two disagree, which is the guard against shipping mismatched numbers or re-uploading a
version a store has already seen. Then re-run `./scripts/package.sh` and upload the new zips.
Chrome and AMO both auto-update installed copies.

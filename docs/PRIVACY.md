# Privacy policy — NextWork Dark

**Last updated: 14 August 2026**

NextWork Dark is a browser extension that applies a dark colour theme to pages on
`nextwork.ai` and `nextwork.org`. This policy covers the Chrome, Edge and Firefox builds.

## The short version

**NextWork Dark collects no data.** It has no servers, no analytics, no tracking, and makes
no network requests of any kind. Nothing you do in the extension is transmitted anywhere, and
the author cannot see it.

## What is stored, and where

Two settings, both of which you control from the extension's popup:

| Setting | Value |
| --- | --- |
| Dark Mode | on or off |
| Dim Images | on or off |

These are stored on your own computer, in your browser's extension storage
(`chrome.storage.local`). The Dark Mode setting is additionally mirrored into `localStorage`
for the two NextWork domains, because that is the only storage the extension can read fast
enough to apply the theme before the page draws — without it you would see a flash of white
on every page load.

That is the complete list. No browsing history, no page contents, no personal information, no
identifiers, and no usage statistics are stored, read for any other purpose, or sent anywhere.

If your browser is signed in and syncing extension data, your browser may sync these two
settings between your own devices. That is handled entirely by your browser, not by this
extension, and the settings still never reach the author or any third party.

## Permissions, and why they exist

- **`storage`** — to remember the two settings above between page loads, tabs and restarts.
- **Access to `nextwork.ai` and `nextwork.org` (and their subdomains)** — the extension
  restyles these pages, which requires running on them. The popup also checks whether the tab
  you are looking at is a NextWork page, so its "Open NextWork" button can go inert when you
  are already there. No other website is requested or accessible.

The extension requests access to no other sites, and holds no permission that would let it
read your browsing on any other site.

## Third parties

None. No data is sold, transferred, or shared, because none is collected. No third-party
code, library, SDK, font, or resource is loaded — every file the extension uses ships inside
the extension package.

## Children

The extension collects no data from anyone, including children.

## Changes

If this policy ever changes, the revised version will be published at this URL and the date
at the top updated. Any change that involved collecting data would also require a new
permission and a new extension review before it could reach you.

## Contact

Questions or concerns: open an issue at
<https://github.com/ZAG23/nextwork-dark/issues>.

NextWork Dark is an unofficial, community-built extension, published with NextWork's
permission. It is not a NextWork product, and NextWork is not responsible for it. The
extension is open source under the MIT licence.

# SSP Watcher (Tampermonkey Userscript)

Lightweight overlay for Google Ad Manager (GAM) / Prebid.js ad slots:
- Shows a numeric SSP ID for the winning bidder of the slot
- Adds a compact second badge with the Ad Unit Code (last slug only, e.g. `/desktop-billboard_atf`)
- Works with lazy-load, refresh, and SPA navigations

If no bidder can be determined but GAM served a creative, the script shows Google AdX (ID 31) instead of 00.

---

## Name suggestions

Pick one for your repo/store entry:
- SSP Watcher
- SSP Watcher: Prebid/GAM Chips
- SSP Chips
- Prebid/GAM SSP Overlay
- AdSlot SSP Radar

This README uses “SSP Watcher.”

---

## What it does

- Draws a small numeric badge (top-left of the ad container) showing the SSP that won the ad unit.
- Draws a secondary badge just beneath it with the Ad Unit Code (last path segment).
- Keeps badges in sync with slot movement/resizing via ResizeObserver/IntersectionObserver.
- Ignores frames (top window only) and runs at `document-idle`.

---

## How it works (signal priority)

1) Prebid Winner (strongest)
   - Uses `pbjs.onEvent('bidWon')` to cache winners and refresh the correct slot.
   - If events were missed, queries Prebid live to minimize “00” cases:
     - `pbjs.getAdserverTargetingForAdUnitCode(adUnitCode)` to read `hb_bidder` (supports suffixed variants)
     - Reverse map `hb_adid` using `pbjs.getAllWinningBids()`, `pbjs.getHighestCpmBids()`, `pbjs.getBidResponsesForAdUnitCode()`
     - Heuristic match by `adUnitCode` containment for stubborn cases

2) GPT Targeting
   - Reads collected GPT targeting keys on slot (`hb_bidder*`) when present

3) SafeFrame hints
   - Reads `hb_bidder` from the SafeFrame URL (if present)
   - Maps SafeFrame host using subdomain suffix walking (e.g., `a.secure.adnxs.com` → `adnxs.com`)

4) GAM Served fallback
   - If GPT reports a served creative but no bidder was identified, shows `Google AdX` (ID 31)

If none of the above yields a known SSP, the numeric badge shows `00`.

---

## Ad Unit Code (badge)

- The label shows only the last slug of the Ad Unit Code, prefixed with `/`
  - Examples:
    - `/1234/site/desktop-billboard_atf` → `/desktop-billboard_atf`
    - `site/mobile-mrec` → `/mobile-mrec`
    - `div-gpt-ad-123456-0` → `/div-gpt-ad-123456-0`
- Resolution priority:
  1. Prebid win’s `adUnitCode`
  2. GPT’s `slot.getAdUnitPath()`
  3. Best candidate among collected identifiers

---

## Installation (Tampermonkey)

1) Install Tampermonkey extension (Chrome, Edge, Firefox, Safari, Opera)
2) Create a new userscript:
   - Tampermonkey icon → Dashboard → Utilities → “Create a new script…”
3) Paste the script from `SSP-watcher/ssp-watcher.user.js`
4) Save
5) Visit a page with Prebid/GAM inventory; badges should appear once slots render

Notes:
- Script runs with `@grant none` and `@noframes`
- Targets top-level window only

---

## Keyboard shortcuts

- Ctrl+Shift+A → Rescan (useful on SPA navigation or stubborn dynamic inserts)
- Ctrl+Shift+D → Toggle verbose debug logs (persists in `localStorage` as `ssp-watcher-debug`)
- Ctrl+Shift+H → Toggle badge visibility (persists as `ssp-watcher-enabled`)

---

## Debugging

Open DevTools console and look for `[SSP]` logs:
- Boot lifecycle: “Boot”, “Styles injected”, “GPT events hooked”, “Prebid hooked”, periodic “Scan …”
- Per-slot: “GPT update …”, “Chip created …”, “Chip refresh …”
- Identification traces: “Identify: …” showing which path resolved the SSP or why it fell back

You can also poke around via:
```js
window.sspWatcher // { chips, slotMeta, prebidWins, rescan, scan, ensureChip, version }
```

---

## SSP → Numeric ID mapping

The numeric mapping applied to badge text:

```
01  Adagio
02  AdaptMX
03  Adform
04  Adhese
05  Adyoulike
06  ConnectAd
07  Criteo
08  Equativ
09  EXTE
10  GPS Appnexus
11  GPS Native
12  GumGum
13  Invibes
14  KueezRTB
15  Magnite
16  Missena
17  Ogury
18  OneTag
19  Pubmatic
20  Rise
21  Seedtag
22  Sharethrough
23  Smart Adserver
24  SOVRN
25  Taboola
26  Teads
27  The Trade Desk
28  TripleLift
29  Weborama Appnexus
30  Xandr
31  Google AdX
```

Aliases (examples)
- AppNexus / adnxs / xandr → Xandr (30) or GPS Appnexus (10) based on context
- GAM/AdX/GAM Ad Manager → Google AdX (31)
- Magnite/Rubicon → Magnite (15)
- Sharethrough/btlr.com → Sharethrough (22)
- Sovrn/Lijit → SOVRN (24)

(Extend the alias list as you encounter partner naming variants.)

---

## Performance & safety

- Badges use pure DOM/CSS; no blocking network calls
- Observers do minimal work and disconnect automatically when hosts are removed
- `@grant none` disables sandboxed APIs and keeps the script in the page context (best compatibility with `window.googletag` and `window.pbjs`)

---

## Limitations

- If a site hides or renames Prebid/GPT interfaces, identification may fall back to `00` or `31`
- Custom wrappers may require adding more aliases or SafeFrame host hints
- Some single-slot layouts reuse containers across refresh sequences; the script tries to de-duplicate badges per container


## Changelog

- 0.3.0
  - Stronger winner detection (Prebid targeting & bid caches)
  - GAM served fallback → Google AdX (31)
  - SafeFrame host suffix detection
  - Ad Unit Code badge (last slug)
  - Chip de-duplication per container
  - Debug shortcuts and console tracing# SSP-Watcher-Prebid-GAM-Chips---Tampermonkey

## Install on Microsoft Edge Mobile (Android)

Edge Mobile is gradually rolling out extension support. If your build supports extensions, you can install Tampermonkey directly. If not, use the alternative path below.

Option A — Edge Mobile with Extensions (Preview)
- Update Edge to the latest version available on your device (Stable/Dev/Beta).
- Open Edge → Menu (…) → Settings → Extensions (Preview).
  - If the Extensions toggle exists, enable it. If you can’t find it, try visiting edge://extensions in the address bar and check if extensions are available on your build.
- Tap “Open extension store” (or “Get extensions”).
- Search for “Tampermonkey” and install it from the Microsoft Add-ons store.
- Open Tampermonkey and add the userscript:
  - Create script: Dashboard → “+” → “Create a new script…”
  - Copy the contents from [SSP-watcher/ssp-watcher.user.js](SSP-watcher/ssp-watcher.user.js) and paste into the editor, then Save.
  - Reload a site with Prebid/GAM inventory and verify the badges show.

Option B — If extensions are not available on your Edge build
- Use Kiwi Browser (Android), which supports Chrome extensions:
  - Install Kiwi from the Play Store, open chrome://extensions, enable “Developer mode”, open the Chrome Web Store, install “Tampermonkey”.
  - In Tampermonkey, create a new script and paste the code from [SSP-watcher/ssp-watcher.user.js](SSP-watcher/ssp-watcher.user.js), then Save.
  - Load a site with Prebid/GAM inventory and verify the badges show.

Notes
- iOS: Edge on iOS currently does not support extensions. Consider Safari with a compatible userscript manager or use a desktop/Android device to run this userscript.
- If pasting is cumbersome on mobile, host the raw .user.js file and open its URL directly in the mobile browser; Tampermonkey will offer an “Install” prompt.

Troubleshooting on Mobile
- If badges don’t show:
  - Ensure “Allow in Incognito” is enabled if you test in private tabs.
  - Confirm the script is enabled in Tampermonkey and the “Matches” include your test domain.
  - Open the page’s DevTools remote debugging (chrome://inspect from a desktop) to view “[SSP]” logs and verify that Prebid/GPT are present.

## Auto-Update from GitHub (Desktop & iOS)

This project supports installing the userscript directly from GitHub RAW and receiving automatic updates whenever you push changes and bump the version.

RAW install/update URL (use this exact link):
- https://raw.githubusercontent.com/ItsRayRay/SSP-Watcher-Prebid-GAM-Chips---Tampermonkey/main/ssp-watcher.user.js

Important: The repository must be Public. Always use the RAW link above (not the normal GitHub "blob" page).

---

### Quick Install

Desktop (Chrome/Edge/Firefox)
- Tampermonkey icon → Dashboard → Utilities → "Install from URL"
- Paste the RAW URL above → Install

iOS (Safari) using Tampermonkey app
- Install Tampermonkey from the App Store and enable the Safari extension (Settings → Safari → Extensions)
- Open Tampermonkey app → Dashboard → Utilities (or "+") → "Install from URL"
- Paste the RAW URL above → Install

iOS using the "Userscripts" app (Quoid)
- Install "Userscripts" from the App Store and enable it in Safari (Settings → Safari → Extensions)
- Open the Userscripts app → Add → "Add Remote Script" (or "Add from URL")
- Paste the RAW URL above → Save (enable auto-update if available)

---

### Userscript Header: Required for Auto-Updates

Add these lines to the metadata block at the top of your userscript and bump the version on every release:

```js
// ==UserScript==
// @name         SSP Checker
// @namespace    https://tampermonkey.net/
// @version      0.3.1
// @description  Show numeric SSP ID of the Prebid (bidWon) winner per ad unit; falls back to 00 when unknown.
// @author       SSP Watcher
// @match        *://*/*
// @grant        none
// @run-at       document-idle
// @noframes
// @downloadURL  https://raw.githubusercontent.com/ItsRayRay/SSP-Watcher-Prebid-GAM-Chips---Tampermonkey/main/ssp-watcher.user.js
// @updateURL    https://raw.githubusercontent.com/ItsRayRay/SSP-Watcher-Prebid-GAM-Chips---Tampermonkey/main/ssp-watcher.user.js
// @homepageURL  https://github.com/ItsRayRay/SSP-Watcher-Prebid-GAM-Chips---Tampermonkey
// @supportURL   https://github.com/ItsRayRay/SSP-Watcher-Prebid-GAM-Chips---Tampermonkey/issues
// ==/UserScript==
```

Notes:
- Change @version each time you publish (e.g., 0.3.1 → 0.3.2). Tampermonkey updates only when it sees a higher version.
- Keep the branch name ("main") in the URLs correct for your repo.

---

### Release Workflow

1) Edit your script code
2) Increase the @version in the metadata block
3) Commit and push to GitHub
4) Tampermonkey (and compatible managers) will auto-check and fetch updates. You can also manually "Check for updates" in the dashboard.

---

### Desktop Installation (Details)

Option A — Direct from RAW
- Paste the RAW URL into the address bar. If the browser tries to download, prefer Option B.

Option B — From Tampermonkey Dashboard
- Tampermonkey icon → Dashboard → Utilities → "Install from URL"
- Paste the RAW URL → Install

Verify:
- Tampermonkey icon → Dashboard → click the script → ensure downloadURL/updateURL show the RAW URL
- Click "Check for updates" to test

---

### iOS Installation (Details)

Tampermonkey (Safari)
- App Store → install "Tampermonkey"
- Enable in Settings → Safari → Extensions (and allow in Private if needed)
- Tampermonkey app → Dashboard → Utilities → "Install from URL" → paste RAW URL → Install
- Verify updateURL/downloadURL in the script details

Userscripts app (Quoid)
- Add Remote Script with the RAW URL (recommended to receive updates)
- Pull-to-refresh or use its update controls to fetch new versions
- If you import a local file instead, updates are manual unless you re-import

---

### Troubleshooting & Pitfalls

- If using the GitHub "blob" page, install won’t auto-update. Always use the RAW URL.
- If the RAW URL downloads a file:
  - Use "Install from URL" inside Tampermonkey/Userscripts instead of opening the link directly
- No updates arriving:
  - Ensure @version increased in the script header
  - Ensure @downloadURL/@updateURL exactly match the RAW URL
  - Repo must be Public
  - GitHub RAW may take up to ~1 minute to propagate via CDN
- iOS Private Browsing:
  - Explicitly allow your extension for Private in Settings → Safari → Extensions

This setup ensures users install once from the RAW link and automatically get your changes after you push and bump @version.


---

## Important: Release Checklist (Don’t forget)

Use this quick checklist every time you publish an update so all users auto-update without manual re-install:

- Bump version in the userscript header:
  - Edit [SSP-watcher/ssp-watcher.user.js](SSP-watcher/ssp-watcher.user.js) and increase the `@version` (e.g., 0.3.1 → 0.3.2)
- Ensure update URLs are correct in the header:
  - `@downloadURL  https://raw.githubusercontent.com/ItsRayRay/SSP-Watcher-Prebid-GAM-Chips---Tampermonkey/main/ssp-watcher.user.js`
  - `@updateURL    https://raw.githubusercontent.com/ItsRayRay/SSP-Watcher-Prebid-GAM-Chips---Tampermonkey/main/ssp-watcher.user.js`
- Commit and push to the same branch referenced in the URLs (e.g., main)
- Optional: Update any displayed runtime version string you keep in code (e.g., `window.sspWatcher.version`) in [SSP-watcher/ssp-watcher.user.js](SSP-watcher/ssp-watcher.user.js)
- Confirm the repository stays Public (clients must be able to fetch the RAW URL)
- After pushing, you can force-pull:
  - Tampermonkey Dashboard → “Check for updates” (desktop/iOS)
  - Userscripts app (iOS) → pull-to-refresh or use its update control for remote scripts

Install/Update URL (RAW — share this link with users):
- https://raw.githubusercontent.com/ItsRayRay/SSP-Watcher-Prebid-GAM-Chips---Tampermonkey/main/ssp-watcher.user.js

---

## Author

- ItsRayRay — https://github.com/ItsRayRay/


---

## Quick Install Guide (Desktop, iOS, Android)

Install once from the RAW link below. Future updates are automatic when the script’s `@version` is bumped and pushed to GitHub.

RAW install/update URL (share this exact link):
- https://raw.githubusercontent.com/ItsRayRay/SSP-Watcher-Prebid-GAM-Chips---Tampermonkey/main/ssp-watcher.user.js

How updates work (summary)
- The userscript header includes `@updateURL` and `@downloadURL` that point to the RAW link.
- Tampermonkey (and similar managers) periodically check for updates. When they see a higher `@version`, they fetch and install the new script automatically.
- You can force an update via “Check for updates.”

---

### Desktop (Chrome / Edge / Firefox)

1) Install Tampermonkey from your browser’s extension store.
2) Open Tampermonkey → Dashboard → Utilities → “Install from URL”.
3) Paste the RAW URL above → Install.
4) Verify in the script’s details that `updateURL` and `downloadURL` match the RAW link.
5) That’s it—updates are automatic after you bump `@version` and push to GitHub.

Tip: You can force updates any time via Tampermonkey Dashboard → “Check for updates”.

---

### iOS (Safari)

Option A — Tampermonkey for Safari (recommended)
1) App Store → install “Tampermonkey”.
2) Enable in iOS Settings → Safari → Extensions (allow for All Websites; enable in Private if needed).
3) Tampermonkey app → Dashboard → Utilities (or “+”) → “Install from URL”.
4) Paste the RAW URL above → Install.
5) Verify `updateURL`/`downloadURL` in the script’s details. Updates are automatic when you bump `@version`.

Option B — “Userscripts” app by Quoid (Safari extension)
1) App Store → install “Userscripts”. Enable in Settings → Safari → Extensions.
2) Open the Userscripts app → Add → “Add Remote Script” (or “Add from URL”).
3) Paste the RAW URL above → Save. Enable auto-update/refresh if available.
4) Updates are fetched periodically or when you pull-to-refresh in the app. Keep the RAW URL and bump `@version` on releases.

---

### Android

Option A — Kiwi Browser (supports Chrome extensions)
1) Install “Kiwi Browser” from Google Play.
2) Open Kiwi → go to the Chrome Web Store → install “Tampermonkey”.
3) Tampermonkey icon → Dashboard → Utilities → “Install from URL”.
4) Paste the RAW URL above → Install.
5) Updates are automatic when you bump `@version` and push to GitHub. You can also “Check for updates”.

Option B — Firefox for Android + Tampermonkey (if supported in your build)
- Similar flow: install Tampermonkey, then “Install from URL” with the RAW link.

---

### Notes & Pitfalls

- Always install from the RAW link (raw.githubusercontent.com), not the GitHub “blob” page.
- The repository must be Public so clients can fetch the RAW URL.
- Bump `@version` in the userscript header on every release; otherwise managers won’t fetch the update.
- CDN cache: RAW may take up to ~1 minute to propagate globally.
- On mobile, ensure the extension is enabled for the site and (if needed) in Private browsing.

---

### Developer Reminder (Release Flow)

- Edit code in [SSP-watcher/ssp-watcher.user.js](SSP-watcher/ssp-watcher.user.js)
- Bump `@version` in the header (e.g., 0.3.1 → 0.3.2)
- Commit and push to the same branch used by the RAW URL (e.g., main)
- Optional: update the in-page runtime version string if you keep one in [SSP-watcher/ssp-watcher.user.js](SSP-watcher/ssp-watcher.user.js)
- Users will receive the update automatically; “Check for updates” will pull it immediately

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

---

## License

MIT (recommended) — you can update the script header to add `@license MIT`.

---

## Changelog

- 0.3.0
  - Stronger winner detection (Prebid targeting & bid caches)
  - GAM served fallback → Google AdX (31)
  - SafeFrame host suffix detection
  - Ad Unit Code badge (last slug)
  - Chip de-duplication per container
  - Debug shortcuts and console tracing# SSP-Watcher-Prebid-GAM-Chips---Tampermonkey

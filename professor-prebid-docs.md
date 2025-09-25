# SSP Watcher Masked Chips Userscript

## Overview
- Displays lightweight chips above detected ad slots with numeric SSP identifiers.
- Prioritises Prebid `bidWon` data, then GPT targeting keys (`hb_bidder`), then SafeFrame host hints.
- Falls back to `00` for unknown or unmatched supply partners and refreshes chips as new data arrives.

## Key Behaviours
- Hooks into `pbjs.onEvent('bidWon')` and `googletag.pubads()` events to stay in sync with lazy-load and refresh cycles.
- Normalises bidder names via an alias map before resolving them to the hard-coded numeric IDs.
- Periodically scans for new ad containers (SPA navigation, dynamic inserts) and SafeFrame iframes.
- Chips are rendered as fixed-position badges (`pointer-events: none`) to avoid interfering with page interactions.
- Uses Resize/Intersection observers (lifted from the original half-working script) so chip placement follows resizing iframes and viewport scroll.
- Ships with a manual rescan shortcut (`Ctrl+Shift+A`) plus an SPA navigation hook for stubborn single-page app refreshes.

## SSP ID Mapping
```
Adagio               -> 01
AdaptMX              -> 02
Adform               -> 03
Adhese               -> 04
Adyoulike            -> 05
ConnectAd            -> 06
Criteo               -> 07
Equativ              -> 08
EXTE                 -> 09
GPS Appnexus         -> 10
GPS Native           -> 11
GumGum               -> 12
Invibes              -> 13
KueezRTB             -> 14
Magnite              -> 15
Missena              -> 16
Ogury                -> 17
OneTag               -> 18
Pubmatic             -> 19
Rise                 -> 20
Seedtag              -> 21
Sharethrough         -> 22
Smart Adserver       -> 23
SOVRN                -> 24
Taboola              -> 25
Teads                -> 26
The Trade Desk       -> 27
TripleLift           -> 28
Weborama Appnexus    -> 29
Xandr                -> 30
```

## Usage Notes
- Install the script in Tampermonkey and visit any page with GPT/Prebid inventory; chips appear once slots render.
- Unknown SSPs stay at `00` until a recognised bidder name or SafeFrame host is observed.
- Host hint coverage is intentionally conservative; extend `SAFEFRAME_HOST_HINTS` with additional domains if needed.
- The alias map can be enriched to match internal naming conventions without exposing readable names in the UI.
- The script runs `@run-at document-idle` and ignores nested frames, so ensure Tampermonkey is allowed on the top-level domain you are testing.

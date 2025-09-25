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

(function () {
  'use strict';
  if (top !== self) {
    return;
  }

  const LOG = (...args) => console.log('[SSP]', ...args);
  const once = (fn) => {
    let ran = false;
    let result;
    return function (...args) {
      if (!ran) {
        ran = true;
        result = fn.apply(this, args);
      }
      return result;
    };
  };
  const byArea = (rect) => rect.width * rect.height;
  const getHost = (input) => {
    try {
      return new URL(input, location.href).host;
    } catch (error) {
      return (input || '').replace(/^https?:\/\//i, '').split('/')[0];
    }
  };
  const parseQS = (input) => {
    const out = {};
    try {
      const url = new URL(input, location.href);
      url.searchParams.forEach((value, key) => {
        out[key] = value;
      });
      const scope = out.prev_scp || out.scp;
      if (scope) {
        decodeURIComponent(scope)
          .split('&')
          .forEach((pair) => {
            const [k, ...rest] = pair.split('=');
            if (!k) {
              return;
            }
            out[k] = rest.join('=');
          });
      }
    } catch (error) {
      // ignore parsing errors
    }
    return out;
  };

  const DEBUG_MODE = (() => {
    try {
      return localStorage.getItem('ssp-watcher-debug') === '1';
    } catch (error) {
      return false;
    }
  })();

  const cssEscape = (value) => {
    const stringValue = String(value || '');
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(stringValue);
    }
    return stringValue.replace(/[^a-zA-Z0-9_\-]/g, (char) => `\\${char}`);
  };

  const unresolvedSsps = new Set();

  const noteUnresolved = (raw, context) => {
    if (!raw) {
      return;
    }
    const key = `${context}:${raw}`;
    if (unresolvedSsps.has(key)) {
      return;
    }
    unresolvedSsps.add(key);
    if (DEBUG_MODE) {
      LOG('Unmapped SSP', { context, raw });
    }
  };

  const SSP_ID_MAP = {
    'Adagio': '01',
    'AdaptMX': '02',
    'Adform': '03',
    'Adhese': '04',
    'Adyoulike': '05',
    'ConnectAd': '06',
    'Criteo': '07',
    'Equativ': '08',
    'EXTE': '09',
    'GPS Appnexus': '10',
    'GPS Native': '11',
    'GumGum': '12',
    'Invibes': '13',
    'KueezRTB': '14',
    'Magnite': '15',
    'Missena': '16',
    'Ogury': '17',
    'OneTag': '18',
    'Pubmatic': '19',
    'Rise': '20',
    'Seedtag': '21',
    'Sharethrough': '22',
    'Smart Adserver': '23',
    'SOVRN': '24',
    'Taboola': '25',
    'Teads': '26',
    'The Trade Desk': '27',
    'TripleLift': '28',
    'Weborama Appnexus': '29',
    'Xandr': '30',
    'Google AdX': '31',
  };

  const CANONICAL_LOOKUP = new Map(
    Object.keys(SSP_ID_MAP).map((name) => [normalize(name), name])
  );

  const SSP_ALIAS_RULES = [
    { regex: /adagio/i, canonical: 'Adagio' },
    { regex: /adapt\s*mx|adapt\.mx/i, canonical: 'AdaptMX' },
    { regex: /adform/i, canonical: 'Adform' },
    { regex: /adhese/i, canonical: 'Adhese' },
    { regex: /adyoulike/i, canonical: 'Adyoulike' },
    { regex: /connectad/i, canonical: 'ConnectAd' },
    { regex: /criteo/i, canonical: 'Criteo' },
    { regex: /equativ/i, canonical: 'Equativ' },
    { regex: /smart\s*adserver/i, canonical: 'Smart Adserver' },
    { regex: /exte/i, canonical: 'EXTE' },
    { regex: /gps[\s_-]*native/i, canonical: 'GPS Native' },
    { regex: /gps[\s_-]*(appnexus|adnxs)/i, canonical: 'GPS Appnexus' },
    { regex: /(appnexus|adnxs|xandr)/i, canonical: 'Xandr' },
    { regex: /gum\s*gum|gumgum/i, canonical: 'GumGum' },
    { regex: /invibes/i, canonical: 'Invibes' },
    { regex: /kueez/i, canonical: 'KueezRTB' },
    { regex: /magnite|rubicon/i, canonical: 'Magnite' },
    { regex: /missena/i, canonical: 'Missena' },
    { regex: /ogury/i, canonical: 'Ogury' },
    { regex: /one\s*tag/i, canonical: 'OneTag' },
    { regex: /pubmatic/i, canonical: 'Pubmatic' },
    { regex: /richaudience|rise/i, canonical: 'Rise' },
    { regex: /seedtag/i, canonical: 'Seedtag' },
    { regex: /sharethrough|btlr\.com/i, canonical: 'Sharethrough' },
    { regex: /sovrn|lijit/i, canonical: 'SOVRN' },
    { regex: /taboola/i, canonical: 'Taboola' },
    { regex: /teads/i, canonical: 'Teads' },
    { regex: /adsrvr\.org|thetradedesk/i, canonical: 'The Trade Desk' },
    { regex: /triplelift|3lift|tlx/i, canonical: 'TripleLift' },
    { regex: /weborama/i, canonical: 'Weborama Appnexus' },
    // Common aliases for Google's own exchange/ad server fallback
    { regex: /\b(adx|ad\s*x)\b|google\s+ad\s*x/i, canonical: 'Google AdX' },
    { regex: /\b(gam|google\s*ad\s*manager|ad\s*manager)\b/i, canonical: 'Google AdX' },
  ];

  const SAFEFRAME_HOST_HINTS = {
    'ib.adnxs.com': 'GPS Appnexus',
    'secure.adnxs.com': 'GPS Appnexus',
    'prebid.adnxs.com': 'GPS Appnexus',
    'wa.outbrain.com': 'Taboola',
    'wa.taboola.com': 'Taboola',
    'ads.taboola.com': 'Taboola',
    'gumgum.com': 'GumGum',
    'criteo.net': 'Criteo',
    'criteo.com': 'Criteo',
    'pubmatic.com': 'Pubmatic',
    'magnite.com': 'Magnite',
    'rubiconproject.com': 'Magnite',
    'sharethrough.com': 'Sharethrough',
    'adhese.com': 'Adhese',
    'connectad.io': 'ConnectAd',
    'seedtag.com': 'Seedtag',
    'teads.tv': 'Teads',
    'onetag-sys.com': 'OneTag',
    'onetag.io': 'OneTag',
    'ogury.com': 'Ogury',
    'adyoulike.com': 'Adyoulike',
    'smartadserver.com': 'Smart Adserver',
    'equativ.com': 'Equativ',
    'adform.net': 'Adform',
    'adagio.io': 'Adagio',
    'missena.com': 'Missena',
    'invibes.com': 'Invibes',
    'triplelift.com': 'TripleLift',
    'adsrvr.org': 'The Trade Desk',
    'kueezrtb.com': 'KueezRTB',
    'weborama.com': 'Weborama Appnexus',
  };

  const chips = new Map();
  const slotMeta = new Map();
  const prebidWins = new Map();
  const chipsByHost = new WeakMap();

  const PREFER_SELECTORS = [
    'div[id^="google_ads_iframe_"][id$="__container__"]',
    'div[id^="div-gpt-ad"]',
    'div[id^="gpt-ad"]',
    '[data-google-query-id]'
  ].join(',');

  const FALLBACK_SELECTORS = [
    'iframe[id^="google_ads_iframe_"]',
    'iframe[name^="google_ads_iframe_"]',
    'iframe[id^="aswift_"]',
    'iframe[src*="safeframe.googlesyndication.com"]',
    'div[class*="adunit"]',
    'div[class*="ad-unit"]',
    'div[class*="ad-slot"]',
    'div.st-adunit'
  ].join(',');

  injectStyles();
  // Defer hooks to avoid TDZ when hookGPTOnce/hookPrebidOnce are const-initialized later
  setTimeout(() => { try { hookGPT(); } catch (e) { LOG('Deferred hookGPT error', e); } }, 0);
  setTimeout(() => { try { hookPrebid(); } catch (e) { LOG('Deferred hookPrebid error', e); } }, 0);
  setTimeout(() => { try { scan(); } catch (e) { LOG('Deferred scan error', e); } }, 0);
  observeDOM();
  hookSPA();
  LOG('Boot', location.href);
  // Dev: expose debugging handle
  try { window.sspWatcher = { chips, slotMeta, prebidWins, rescan, scan, ensureChip, version: '0.3.1' }; } catch (e) {}
  // Extra rescans soon after boot to catch late inits
  [200, 800, 1800, 3500].forEach((ms) => setTimeout(scan, ms));

  function injectStyles() {
    const style = document.createElement('style');
    style.id = 'ssp-watcher-chip-style';
    style.textContent = `
      .ssp-watcher-chip {
        position: absolute;
        left: 0;
        top: 0;
        transform: translate(4px, 4px);
        padding: 1px 6px;
        border-radius: 10px;
        font: 11px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
        background: #2196F3;
        color: #fff;
        pointer-events: none;
        white-space: nowrap;
        z-index: 2147483000;
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08);
        opacity: 0;
        transition: opacity 150ms ease-in-out;
      }
      .ssp-watcher-chip[data-status="known"] {
        opacity: 1;
      }
      .ssp-watcher-chip[data-status="unknown"] {
        opacity: 1;
        background: #787878;
      }
      .ssp-watcher-unit {
        position: absolute;
        left: 0;
        top: 0;
        transform: translate(4px, 22px);
        padding: 0 6px;
        border-radius: 8px;
        font: 10px/1.6 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
        background: #000;
        color: #fff;
        pointer-events: none;
        white-space: nowrap;
        z-index: 2147483000;
        box-shadow: 0 0 0 1px rgba(0,0,0,0.08);
        opacity: 1;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
    LOG('Styles injected');
  }

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function resolveCanonical(raw) {
    if (!raw) {
      return null;
    }
    const normalized = normalize(raw);
    if (!normalized) {
      return null;
    }
    const direct = CANONICAL_LOOKUP.get(normalized);
    if (direct) {
      return direct;
    }
    for (const { regex, canonical } of SSP_ALIAS_RULES) {
      if (regex.test(raw) || regex.test(normalized)) {
        return canonical;
      }
    }
    return null;
  }

  function resolveSsp(raw) {
    if (raw == null) {
      return null;
    }
    const seen = new Set();
    const queue = [];
    const pushCandidate = (value) => {
      if (value == null) {
        return;
      }
      String(value)
        .split(/[|,]/)
        .forEach((fragment) => {
          const candidate = fragment.trim();
          if (candidate && !seen.has(candidate)) {
            seen.add(candidate);
            queue.push(candidate);
          }
        });
    };

    if (Array.isArray(raw)) {
      raw.forEach(pushCandidate);
    } else {
      pushCandidate(raw);
    }

    for (const candidate of queue) {
      const canonical = resolveCanonical(candidate);
      if (canonical && SSP_ID_MAP[canonical]) {
        return {
          id: SSP_ID_MAP[canonical],
          canonical,
          raw: candidate,
        };
      }
    }
    return null;
  }

  function resolveCanonicalFromHost(host) {
    if (!host) {
      return null;
    }
    const clean = String(host).toLowerCase();
    // Walk subdomain suffixes: a.b.c.com -> check 'a.b.c.com','b.c.com','c.com'
    const parts = clean.split('.');
    for (let i = 0; i < parts.length - 1; i++) {
      const suffix = parts.slice(i).join('.');
      if (SAFEFRAME_HOST_HINTS[suffix]) {
        return SAFEFRAME_HOST_HINTS[suffix];
      }
    }
    return resolveCanonical(clean);
  }

  function resolveSspFromHost(host) {
    const canonical = resolveCanonicalFromHost(host);
    if (!canonical || !SSP_ID_MAP[canonical]) {
      return null;
    }
    return {
      id: SSP_ID_MAP[canonical],
      canonical,
      raw: host,
    };
  }

  function resolveId(raw) {
    const resolved = resolveSsp(raw);
    return resolved ? resolved.id : null;
  }

  // Return only the last slug of a GAM ad unit path or code, prefixed with "/"
  // Examples:
  //   "/1234/site/desktop-billboard_atf" -> "/desktop-billboard_atf"
  //   "site/mobile-mrec" -> "/mobile-mrec"
  //   "div-gpt-ad-123456-0" -> "/div-gpt-ad-123456-0"
  function shortAdUnitLabel(input) {
    if (input == null) return '';
    const s = String(input).trim();
    if (!s) return '';
    const parts = s.split('/').filter(Boolean);
    const last = parts.length ? parts[parts.length - 1] : s;
    const cleaned = String(last).replace(/\s+/g, ' ').trim();
    return cleaned ? `/${cleaned}` : '';
  }

  const hookGPTOnce = once(() => {
    const register = () => {
      const pubads = window.googletag?.pubads?.();
      if (!pubads) {
        return;
      }
      const update = (slot, extra = {}) => {
        try {
          const id = slot.getSlotElementId?.();
          if (!id) {
            LOG('GPT update: missing slot id', extra);
            return;
          }
          const meta = {
            id,
            slot,
            ts: Date.now(),
            adUnitPath: slot.getAdUnitPath?.() || null,
            sizes: (slot.getSizes?.() || []).map((size) =>
              size.getWidth ? [size.getWidth(), size.getHeight()] : size
            ),
            targeting: Object.fromEntries(
              (slot.getTargetingKeys?.() || []).map((key) => [key, slot.getTargeting(key)])
            ),
            ...extra,
          };
          slotMeta.set(id, meta);
          LOG('GPT update', { id, phase: extra.phase || 'n/a', adUnitPath: meta.adUnitPath, sizes: meta.sizes });
          const chip = ensureChip(id);
          if (chip) chip.refresh();
        } catch (error) {
          LOG('GPT update error', error);
        }
      };

      pubads.addEventListener('slotRequested', (event) => update(event.slot, { phase: 'requested' }));
      pubads.addEventListener('slotResponseReceived', (event) => update(event.slot, { phase: 'response' }));
      pubads.addEventListener('slotRenderEnded', (event) => update(event.slot, {
        phase: 'render',
        render: { isEmpty: !!event.isEmpty, size: event.size || null },
      }));
      pubads.addEventListener('impressionViewable', (event) => update(event.slot, { phase: 'viewable' }));
      pubads.addEventListener('slotOnload', (event) => update(event.slot, { phase: 'onload' }));
      pubads.addEventListener('slotVisibilityChanged', (event) => update(event.slot, { phase: 'visibility', visibility: event.inViewPercentage }));
      try {
        // Snapshot any pre-existing slots in case we hooked after initial GPT events
        const existing = pubads.getSlots?.() || [];
        existing.forEach((s) => update(s, { phase: 'snapshot' }));
      } catch (e) {
        // ignore snapshot issues
      }
      LOG('GPT events hooked');
    };

    if (window.googletag?.cmd) {
      window.googletag.cmd.push(register);
    } else {
      const timer = setInterval(() => {
        if (window.googletag?.cmd) {
          clearInterval(timer);
          window.googletag.cmd.push(register);
        }
      }, 120);
      setTimeout(() => clearInterval(timer), 15000);
    }
  });

  function hookGPT() {
    hookGPTOnce();
  }

  const hookPrebidOnce = once(() => {
    const init = () => {
      const pb = window.pbjs;
      if (!pb?.onEvent) {
        return;
      }
      pb.onEvent('bidWon', (bid) => {
        if (bid?.adUnitCode) {
          prebidWins.set(bid.adUnitCode, bid);
          LOG('Prebid bidWon', { adUnitCode: bid.adUnitCode, bidder: bid.bidder || bid.bidderCode || bid.bidderName, cpm: bid.cpm });
          pokeByAdUnit(bid.adUnitCode);
        } else {
          LOG('Prebid bidWon (missing adUnitCode)', bid);
        }
      });
      // Immediate sweep on init to prefill winners if auctions already completed
      try {
        const wins0 = pb.getAllWinningBids?.();
        if (Array.isArray(wins0)) {
          wins0.forEach((bid) => {
            if (bid?.adUnitCode) {
              prebidWins.set(bid.adUnitCode, bid);
            }
          });
        }
      } catch (error) {
        // ignore
      }
      setInterval(() => {
        try {
          const wins = pb.getAllWinningBids?.();
          if (Array.isArray(wins)) {
            wins.forEach((bid) => {
              if (bid?.adUnitCode) {
                prebidWins.set(bid.adUnitCode, bid);
              }
            });
            rescan();
          }
        } catch (error) {
          LOG('Prebid sweep error', error);
        }
      }, 3000);
      LOG('Prebid hooked');
    };

    if (window.pbjs?.que) {
      window.pbjs.que.push(init);
    } else {
      const timer = setInterval(() => {
        if (window.pbjs?.que) {
          clearInterval(timer);
          window.pbjs.que.push(init);
        }
      }, 120);
      setTimeout(() => clearInterval(timer), 15000);
    }
  });

  function hookPrebid() {
    hookPrebidOnce();
  }

  class Chip {
    constructor(slotId, host) {
      this.slotId = slotId;
      this.host = host;
      this.el = document.createElement('div');
      this.el.className = 'ssp-watcher-chip';
      this.el.textContent = '00';
      this.el.dataset.status = 'unknown';
      document.body.appendChild(this.el);

      // Secondary badge for GAM/Prebid Ad Unit code/name
      this.unitEl = document.createElement('div');
      this.unitEl.className = 'ssp-watcher-unit';
      this.unitEl.textContent = '';
      document.body.appendChild(this.unitEl);

      try {
        const enabled = localStorage.getItem('ssp-watcher-enabled') !== '0';
        if (!enabled) { this.el.style.display = 'none'; this.unitEl.style.display = 'none'; }
      } catch (e) {}
      LOG('Chip created', { slotId, hostTag: host?.tagName, hostId: host?.id });

      this.ro = new ResizeObserver(() => this.sync());
      this.io = new IntersectionObserver(() => this.sync(), { threshold: [0, 0.05, 0.2, 1] });
      this.mo = new MutationObserver(() => {
        if (!document.body.contains(this.host)) {
          this.destroy();
        }
      });

      this.ro.observe(this.host);
      this.io.observe(this.host);
      addEventListener('scroll', (this.syncBound ||= () => this.sync()), { passive: true });
      addEventListener('resize', this.syncBound);
      this.mo.observe(document.body, { childList: true, subtree: true });

      this.sync();
      this.refresh();
    }

    sync() {
      if (!document.body.contains(this.host)) {
        this.destroy();
        return;
      }
      const rect = this.host.getBoundingClientRect();
      const area = byArea(rect);
      const viewportArea = innerWidth * innerHeight;
      if (!rect.width || !rect.height || area > viewportArea * 0.95) {
        this.el.style.display = 'none';
        if (this.unitEl) this.unitEl.style.display = 'none';
        return;
      }
      const left = `${Math.round(rect.left + scrollX)}px`;
      const top = `${Math.round(rect.top + scrollY)}px`;
      this.el.style.display = 'block';
      this.el.style.left = left;
      this.el.style.top = top;
      if (this.unitEl) {
        this.unitEl.style.display = this.unitEl.textContent ? 'block' : 'none';
        this.unitEl.style.left = left;
        this.unitEl.style.top = top;
      }
    }

    refresh() {
      clearTimeout(this._refreshTimer);
      this._refreshTimer = setTimeout(() => {
        try {
          const info = this.identify();
          const nextId = info.id || '00';
          this.el.textContent = nextId;
          this.el.dataset.status = nextId === '00' ? 'unknown' : 'known';
          if (info.source) {
            this.el.dataset.source = info.source;
          }
          if (DEBUG_MODE) {
            if (info.canonical) {
              this.el.dataset.canonical = info.canonical;
              this.el.title = `${info.canonical} (#${nextId})`;
            } else {
              delete this.el.dataset.canonical;
              this.el.title = `Unknown (#${nextId})`;
            }
            if (info.raw) {
              this.el.dataset.raw = Array.isArray(info.raw) ? info.raw.join(',') : info.raw;
            } else {
              delete this.el.dataset.raw;
            }
          } else {
            delete this.el.dataset.canonical;
            delete this.el.dataset.raw;
            this.el.removeAttribute('title');
          }

          // Compute and render AdUnit badge (Prebid adUnitCode > GPT adUnitPath > best candidate)
          const meta = slotMeta.get(this.slotId) || findMetaForHost(this.host);
          const slotCandidates = collectSlotCandidates(meta, this.slotId);
          let adUnit = '';
          try {
            const win = meta ? bestWinForSlot(slotCandidates) : bestWinForSlot(this.slotId);
            if (win?.adUnitCode) adUnit = String(win.adUnitCode);
            if (!adUnit && meta?.adUnitPath) adUnit = String(meta.adUnitPath);
            if (!adUnit) {
              for (const c of slotCandidates) {
                const s = String(c || '');
                if (!s) continue;
                if (s.startsWith('/') || s.includes('/') || s.startsWith('div-gpt-ad') || s.includes('-')) { adUnit = s; break; }
              }
            }
            if (!adUnit && slotCandidates?.length) adUnit = String(slotCandidates[0] || '');
          } catch {}
          if (this.unitEl) {
            const label = shortAdUnitLabel(adUnit);
            this.unitEl.textContent = label ? `AdUnit Code: ${label}` : '';
            this.unitEl.style.display = label ? 'block' : 'none';
          }

          LOG('Chip refresh', { slotId: this.slotId, id: nextId, source: info.source || 'n/a', canonical: info.canonical || null, adUnit: adUnit || null });
        } catch (e) {
          LOG('Chip refresh error', e);
          this.el.textContent = '00';
          this.el.dataset.status = 'unknown';
          this.el.removeAttribute('title');
          if (this.unitEl) this.unitEl.style.display = 'none';
        }
      }, 60);
    }

   identify() {
     const meta = slotMeta.get(this.slotId) || findMetaForHost(this.host);
     const slotCandidates = collectSlotCandidates(meta, this.slotId);
     LOG('Identify start', { slotId: this.slotId, candidates: slotCandidates, haveMeta: !!meta });

     // Helper: normalize targeting values (string | string[]) to flat array of strings
     const flatVals = (val) => {
       if (Array.isArray(val)) return val.map(v => String(v)).filter(Boolean);
       if (val == null) return [];
       return [String(val)];
     };

     // 0) If we have hb_adid from GPT targeting, try to reverse-map via Prebid bids
     const hbAdIds = [];
     if (meta && meta.targeting) {
       for (const k of Object.keys(meta.targeting)) {
         if (/^hb_adid(?:_[a-z0-9]+)?$/i.test(k)) {
           hbAdIds.push(...flatVals(meta.targeting[k]));
         }
       }
     }
     if (hbAdIds.length) {
       LOG('Identify: hb_adid candidates', { slotId: this.slotId, hbAdIds });
     }

     // 1) Prebid cached winners from events/sweeps
     const slotWin = meta ? bestWinForSlot(slotCandidates) : bestWinForSlot(this.slotId);
     if (slotWin) {
       const rawBidder = slotWin.bidder || slotWin.bidderCode || slotWin.bidderName;
       const resolved = resolveSsp(rawBidder);
       if (resolved) {
         LOG('Identify: resolved via prebid event', { slotId: this.slotId, bidder: rawBidder, canonical: resolved.canonical, id: resolved.id });
         return { ...resolved, source: 'prebid' };
       }
       noteUnresolved(rawBidder, 'prebid');
     }

     // 2) Direct Prebid API checks (reduce 00s when events missed)
     try {
       const pb = window.pbjs;
       if (pb) {
         const candidates = Array.isArray(slotCandidates) ? slotCandidates : [slotCandidates];

         // 2a) If hb_adid is present, map by adId first (most reliable)
         if (hbAdIds.length) {
           // Check all winning bids first
           const wins = pb.getAllWinningBids?.();
           if (Array.isArray(wins)) {
             for (const bid of wins) {
               if (!bid) continue;
               if (hbAdIds.includes(String(bid.adId))) {
                 const rawBidder = bid.bidder || bid.bidderCode || bid.bidderName;
                 const resolved = resolveSsp(rawBidder);
                 if (resolved) {
                   return { ...resolved, source: 'prebid-adid-win' };
                 }
                 noteUnresolved(rawBidder, 'prebid-adid-win');
               }
             }
           }
           // Then check per-adUnit responses/top bids
           for (const code of candidates) {
             if (!code) continue;
             const topArr = pb.getHighestCpmBids?.(code);
             const top = Array.isArray(topArr) ? topArr[0] : null;
             if (top && hbAdIds.includes(String(top.adId))) {
               const rawBidder = top.bidder || top.bidderCode || top.bidderName;
               const resolved = resolveSsp(rawBidder);
               if (resolved) {
                 LOG('Identify: resolved via prebid-adid-top', { slotId: this.slotId, bidder: rawBidder, id: resolved.id });
                 return { ...resolved, source: 'prebid-adid-top' };
               }
               noteUnresolved(rawBidder, 'prebid-adid-top');
             }
             const resp = pb.getBidResponsesForAdUnitCode?.(code);
             const bids = resp?.bids || [];
             for (const bid of bids) {
               if (hbAdIds.includes(String(bid.adId))) {
                 const rawBidder = bid.bidder || bid.bidderCode || bid.bidderName;
                 const resolved = resolveSsp(rawBidder);
                 if (resolved) {
                   LOG('Identify: resolved via prebid-adid-resp', { slotId: this.slotId, bidder: rawBidder, id: resolved.id });
                   return { ...resolved, source: 'prebid-adid-resp' };
                 }
                 noteUnresolved(rawBidder, 'prebid-adid-resp');
               }
             }
           }
           // Fallback: search top bids globally and match adUnit heuristic + adId
           const allTop = pb.getHighestCpmBids?.();
           if (Array.isArray(allTop)) {
             for (const bid of allTop) {
               if (!bid) continue;
               if (hbAdIds.includes(String(bid.adId))) {
                 const rawBidder = bid.bidder || bid.bidderCode || bid.bidderName;
                 const resolved = resolveSsp(rawBidder);
                 if (resolved) {
                   LOG('Identify: resolved via prebid-adid-top-all', { slotId: this.slotId, bidder: rawBidder, id: resolved.id });
                   return { ...resolved, source: 'prebid-adid-top-all' };
                 }
                 noteUnresolved(rawBidder, 'prebid-adid-top-all');
               }
             }
           }
           // Map via getAdserverTargeting() when hb_adid matches
           const byUnit = pb.getAdserverTargeting?.() || {};
           for (const [adUnitCode, t] of Object.entries(byUnit)) {
             if (!t) continue;
             const keys = Object.keys(t);
             for (const key of keys) {
               if (/^hb_adid(?:_[a-z0-9]+)?$/i.test(key)) {
                 const vals = flatVals(t[key]);
                 if (vals.some(v => hbAdIds.includes(String(v)))) {
                   const topArr = pb.getHighestCpmBids?.(adUnitCode);
                   const top = Array.isArray(topArr) ? topArr[0] : null;
                   const rawBidder = (top && (top.bidder || top.bidderCode || top.bidderName)) || null;
                   const resolved = resolveSsp(rawBidder);
                   if (resolved) {
                     LOG('Identify: resolved via prebid-adid-targeting', { slotId: this.slotId, adUnitCode, id: resolved.id });
                     return { ...resolved, source: 'prebid-adid-targeting' };
                   }
                   if (rawBidder) {
                     noteUnresolved(rawBidder, 'prebid-adid-targeting');
                   }
                 }
               }
             }
           }
         }

         // 2b) Use Prebid targeting per candidate to get hb_bidder (supports suffixed keys)
         for (const code of candidates) {
           if (!code) continue;
           const targeting = pb.getAdserverTargetingForAdUnitCode?.(code);
           if (targeting && typeof targeting === 'object') {
             // try hb_bidder and hb_bidder_appnexus etc.
             const bidderKeys = Object.keys(targeting).filter((k) => /^hb_bidder(?:_[a-z0-9]+)?$/i.test(k));
             for (const k of bidderKeys) {
               const vals = flatVals(targeting[k]);
               for (const val of vals) {
                 const resolved = resolveSsp(val);
                 if (resolved) {
                   LOG('Identify: resolved via prebid-targeting', { slotId: this.slotId, bidder: val, id: resolved.id });
                   return { ...resolved, source: 'prebid-targeting' };
                 }
                 noteUnresolved(val, 'prebid-targeting');
               }
             }
           }
         }

         // 2c) Highest CPM bid for each candidate
         for (const code of candidates) {
           if (!code) continue;
           const topBidArr = pb.getHighestCpmBids?.(code);
           const topBid = Array.isArray(topBidArr) ? topBidArr[0] : null;
           if (topBid) {
             const rawBidder = topBid.bidder || topBid.bidderCode || topBid.bidderName;
             const resolved = resolveSsp(rawBidder);
             if (resolved) {
               LOG('Identify: resolved via prebid-top', { slotId: this.slotId, bidder: rawBidder, id: resolved.id });
               return { ...resolved, source: 'prebid-top' };
             }
             noteUnresolved(rawBidder, 'prebid-top');
           }
         }

         // 2d) Last resort: scan all top bids and match by adUnitCode heuristic
         const allTop = pb.getHighestCpmBids?.();
         if (Array.isArray(allTop)) {
           for (const bid of allTop) {
             if (!bid) continue;
             const code = bid.adUnitCode || bid.code;
             if (!code) continue;
             for (const cand of candidates) {
               if (!cand) continue;
               if (code === cand || code.includes(cand) || cand.includes(code)) {
                 const rawBidder = bid.bidder || bid.bidderCode || bid.bidderName;
                 const resolved = resolveSsp(rawBidder);
                 if (resolved) {
                   LOG('Identify: resolved via prebid-top-any', { slotId: this.slotId, bidder: rawBidder, id: resolved.id });
                   return { ...resolved, source: 'prebid-top' };
                 }
                 noteUnresolved(rawBidder, 'prebid-top');
               }
             }
           }
         }

         // 2e) Per-adUnit bidResponses as last Prebid fallback
         for (const code of candidates) {
           if (!code) continue;
           const resp = pb.getBidResponsesForAdUnitCode?.(code);
           const bids = Array.isArray(resp?.bids) ? resp.bids.slice() : [];
           if (bids.length) {
             bids.sort((a, b) => (b?.cpm || 0) - (a?.cpm || 0));
             const cand = bids[0];
             const rawBidder = cand?.bidder || cand?.bidderCode || cand?.bidderName;
             const resolved = resolveSsp(rawBidder);
             if (resolved) {
               return { ...resolved, source: 'prebid-resp' };
             }
             if (rawBidder) {
               noteUnresolved(rawBidder, 'prebid-resp');
             }
           }
         }
       }
     } catch (error) {
       // ignore Prebid access issues
     }

     // 3) GPT targeting keys (hb_bidder*, incl. suffixed) from collected slot meta
     if (meta) {
       const targeting = meta.targeting || {};
       for (const key of Object.keys(targeting)) {
         if (/^hb_bidder(?:_[a-z0-9]+)?$/i.test(key) && targeting[key]?.length) {
           const vals = flatVals(targeting[key]);
           for (const v of vals) {
             const resolved = resolveSsp(v);
             if (resolved) {
               return { ...resolved, source: 'gpt' };
             }
             noteUnresolved(v, 'gpt');
           }
         }
       }
     }

     // 4) SafeFrame query string hb_bidder and/or host hints
     const iframe = findIframe(this.host);
     if (iframe?.src) {
       const qs = parseQS(iframe.src);
       if (qs.hb_bidder) {
         const resolved = resolveSsp(qs.hb_bidder);
         if (resolved) {
           return { ...resolved, source: 'safeframe' };
         }
         noteUnresolved(qs.hb_bidder, 'safeframe-hb');
       }
       const hostResolved = resolveSspFromHost(getHost(iframe.src));
       if (hostResolved) {
         return { ...hostResolved, source: 'safeframe' };
       }
     }

     // 5) If GPT reports a filled creative but we couldn't map a bidder, assume Google AdX
     try {
       const served = (meta?.render && meta.render.isEmpty === false) || (meta?.slot?.getResponseInformation?.() ? true : false);
       if (served && SSP_ID_MAP['Google AdX']) {
         return { id: SSP_ID_MAP['Google AdX'], canonical: 'Google AdX', source: 'gpt-served' };
       }
     } catch (e) {
       // ignore
     }

     // Unknown
     return { id: '00', source: 'unknown' };
   }

    destroy() {
      try {
        this.ro.disconnect();
        this.io.disconnect();
        this.mo.disconnect();
      } catch (error) {
        // ignore
      }
      removeEventListener('scroll', this.syncBound);
      removeEventListener('resize', this.syncBound);
      try { this.el.remove(); } catch {}
      try { this.unitEl?.remove(); } catch {}
      chips.delete(this.slotId);
      try { chipsByHost.delete(this.host); } catch {}
    }
  }

  function ensureChip(slotId) {
    if (chips.has(slotId)) {
      return chips.get(slotId);
    }
    const host = findSlotHost(slotId);
    if (!host) {
      LOG('ensureChip: no host found for slotId', slotId);
      return null;
    }
    // De-duplicate: Only one chip per physical host element
    const existing = chipsByHost.get(host);
    if (existing) {
      chips.set(slotId, existing);
      LOG('ensureChip: dedup by host', { slotId, primary: existing.slotId });
      return existing;
    }
    const chip = new Chip(slotId, host);
    chipsByHost.set(host, chip);
    chips.set(slotId, chip);
    LOG('ensureChip: chip created', { slotId });
    return chip;
  }

  function findMetaForHost(host) {
    if (!host) {
      return null;
    }
    const hostId = host.id;
    if (hostId && slotMeta.has(hostId)) {
      return slotMeta.get(hostId);
    }
    for (const meta of slotMeta.values()) {
      const element = document.getElementById(meta.id);
      if (!element) {
        continue;
      }
      if (element === host || element.contains(host) || host.contains?.(element)) {
        return meta;
      }
    }
    return null;
  }

  function collectSlotCandidates(meta, fallbackId) {
    const set = new Set();
    if (fallbackId) {
      set.add(fallbackId);
    }
    if (meta) {
      if (meta.id) {
        set.add(meta.id);
      }
      if (meta.adUnitPath) {
        set.add(meta.adUnitPath);
      }
      const targeting = meta.targeting || {};
      if (Array.isArray(targeting.adunit)) {
        targeting.adunit.forEach((value) => value && set.add(value));
      }
      const slot = meta.slot;
      if (slot) {
        const push = (value) => {
          if (value) {
            set.add(String(value));
          }
        };
        push(slot.getSlotElementId?.());
        push(slot.getAdUnitPath?.());
        push(slot.getAdUnitId?.());
        try {
          const adunit = slot.getTargeting?.('adunit');
          if (Array.isArray(adunit)) {
            adunit.forEach(push);
          }
        } catch (error) {
          // ignore targeting accessor issues
        }
      }
    }
    return Array.from(set).filter(Boolean);
  }

  function findSlotHost(slotId) {
    let element = document.getElementById(slotId);
    if (element) {
      const pref = preferContainer(element);
      return stable(pref || element);
    }
    try {
      const escapedId = cssEscape(slotId);
      element = document.querySelector(`[id="${escapedId}"], [id*="${escapedId}"]`);
      if (element) {
        const pref = preferContainer(element);
        return stable(pref || element);
      }
    } catch (error) {
      // ignore invalid selectors
    }
    element = document.querySelector(PREFER_SELECTORS);
    if (element) {
      return stable(element);
    }
    element = document.querySelector(FALLBACK_SELECTORS);
    if (element) {
      const pref = preferContainer(element);
      return stable(pref || element);
    }
    return null;

    function preferContainer(node) {
      try {
        const container = node.closest?.(PREFER_SELECTORS);
        return container || null;
      } catch (e) {
        return null;
      }
    }

    function stable(node) {
      if (!node) {
        return null;
      }
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height || byArea(rect) > (innerWidth * innerHeight) / 2) {
        return null;
      }
      return node;
    }
  }

  function findIframe(host) {
    if (!host) {
      return null;
    }
    if (host.tagName === 'IFRAME') {
      return host;
    }
    return host.querySelector?.('iframe[src]') || null;
  }

  function bestWinForSlot(slotIds) {
    const candidates = Array.isArray(slotIds) ? slotIds : [slotIds];
    const filtered = candidates.filter(Boolean).map((value) => String(value));
    for (const candidate of filtered) {
      const direct = prebidWins.get(candidate);
      if (direct) {
        return direct;
      }
    }
    for (const [code, bid] of prebidWins.entries()) {
      if (!code || !bid) {
        continue;
      }
      for (const candidate of filtered) {
        if (!candidate) {
          continue;
        }
        if (code === candidate || code.includes(candidate) || candidate.includes(code)) {
          return bid;
        }
      }
    }
    return null;
  }

  function pokeByAdUnit(adUnit) {
    if (!adUnit) {
      return;
    }
    const element =
      document.getElementById(adUnit) ||
      (() => {
        try {
          return document.querySelector(`[id*="${cssEscape(adUnit)}"]`);
        } catch (error) {
          return null;
        }
      })();
    const slotId = element?.id || slotIdFromAncestor(element);
    if (slotId) {
      ensureChip(slotId)?.refresh();
    }
  }

  function slotIdFromAncestor(element) {
    for (let node = element; node && node !== document.body; node = node.parentElement) {
      if (node?.id && slotMeta.has(node.id)) {
        return node.id;
      }
    }
    return null;
  }

  function scan() {
    try {
      const initialChips = chips.size;
      for (const [slotId] of slotMeta) {
        const c = ensureChip(slotId);
        if (c) c.refresh();
      }
      const preferEls = document.querySelectorAll(PREFER_SELECTORS);
      preferEls.forEach((element) => {
        const id = element.id || element.getAttribute('data-google-query-id');
        if (id) {
          const c = ensureChip(id);
          if (c) c.refresh();
        }
      });
      const fallbackEls = document.querySelectorAll(FALLBACK_SELECTORS);
      fallbackEls.forEach((element) => {
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) {
          return;
        }
        if (byArea(rect) > (innerWidth * innerHeight) / 2) {
          return;
        }
        const id =
          element.id ||
          element.getAttribute('data-google-query-id') ||
          `ssp-${Math.random().toString(36).slice(2, 9)}`;
        if (!slotMeta.has(id)) {
          slotMeta.set(id, { id, ts: Date.now(), phase: 'detected' });
        }
        const c = ensureChip(id);
        if (c) c.refresh();
      });
      LOG('Scan', { slotMeta: slotMeta.size, prefer: preferEls.length, fallback: fallbackEls.length, chips: chips.size, newChips: chips.size - initialChips });
    } catch (e) {
      LOG('Scan error', e);
    }
  }

  function rescan() {
    [0, 200, 800, 1800, 3500].forEach((ms) => setTimeout(scan, ms));
  }

  function observeDOM() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          (mutation.type === 'childList' && mutation.addedNodes?.length) ||
          (mutation.type === 'attributes' && ['src', 'id', 'data-google-query-id'].includes(mutation.attributeName || ''))
        ) {
          LOG('DOM change -> rescan', { type: mutation.type, attr: mutation.attributeName || null });
          rescan();
          break;
        }
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['id', 'src', 'data-google-query-id'],
    });
  }

  function hookSPA() {
    const originalPushState = history.pushState;
    history.pushState = function (...args) {
      const result = originalPushState.apply(this, args);
      dispatchEvent(new Event('ssp:navigate'));
      return result;
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function (...args) {
      const result = originalReplaceState.apply(this, args);
      dispatchEvent(new Event('ssp:navigate'));
      return result;
    };

    addEventListener('popstate', () => dispatchEvent(new Event('ssp:navigate')));
    addEventListener('ssp:navigate', rescan);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        rescan();
      }
    });
    setInterval(scan, 4000);
  }

  addEventListener('keydown', (event) => {
    if (!event.ctrlKey || !event.shiftKey) return;
    if (event.code === 'KeyA') {
      rescan();
    } else if (event.code === 'KeyD') {
      try {
        const next = localStorage.getItem('ssp-watcher-debug') === '1' ? '0' : '1';
        localStorage.setItem('ssp-watcher-debug', next);
        LOG('Debug toggled', { debug: next === '1' });
        rescan();
      } catch (e) {
        LOG('Debug toggle failed', e);
      }
    } else if (event.code === 'KeyH') {
      try {
        const next = localStorage.getItem('ssp-watcher-enabled') === '1' ? '0' : '1';
        localStorage.setItem('ssp-watcher-enabled', next);
        const enabled = next === '1';
        chips.forEach(chip => {
          chip.el.style.display = enabled ? '' : 'none';
          if (chip.unitEl) chip.unitEl.style.display = enabled ? '' : 'none';
        });
        LOG('Visibility toggled', { enabled });
      } catch (e) {
        LOG('Visibility toggle failed', e);
      }
    }
  });
})();

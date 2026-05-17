// TweAI — Ad Blocker (MV3 content script)
// Ported from ultimate_twitter_tool/src/content/ad-blocker.js

(function () {
    const DEBUG = true;
    function log(...args) { try { if (DEBUG) console.info('[TTA][ADBLOCK]', ...args); } catch (_) {} }

    const STORAGE_KEYS = {
        enabled: 'adBlockerEnabled',
        panel: 'adBlockerPanelEnabled',
        removeCompletely: 'removeAdsCompletely',
        chillMode: 'chillModeEnabled',
        statsBlocked: 'blockedAdsCount',
        statsLast: 'lastBlockedTime'
    };

    const STATE = {
        enabled: false,  // opt-in — user must explicitly enable in Settings
        panelVisible: false,
        removeCompletely: true,
        chillMode: false,
        stats: { blocked: 0, lastAt: null },
        panelEl: null
    };

    const CAT_IMAGES = [
        'https://i.pinimg.com/236x/7e/0a/34/7e0a34a030e0cb470599701d7a5c618e.jpg',
        'https://i.pinimg.com/236x/c8/bf/25/c8bf2504099200fa89c8329ca504c7c1.jpg',
        'https://i.pinimg.com/236x/b5/dd/84/b5dd842f7a77d3797a611277136f074b.jpg',
        'https://i.pinimg.com/236x/03/67/f8/0367f83d36aa973ea4c0ac564a529b73.jpg',
        'https://i.pinimg.com/236x/be/44/40/be444014a81a6838a95853d6aadc7f7f.jpg'
    ];

    function randCat() { return CAT_IMAGES[Math.floor(Math.random() * CAT_IMAGES.length)]; }

    function ensureStyles() {
        if (document.getElementById('tta-adblock-styles')) return;
        const s = document.createElement('style');
        s.id = 'tta-adblock-styles';
        s.textContent = `
            #tta-ad-panel { position: fixed; bottom: 20px; right: 20px; z-index: 2147483647; display: none; }
            #tta-ad-panel .card { background: #1DA1F2; color: #fff; padding: 12px; border-radius: 12px; box-shadow: 0 8px 28px rgba(0,0,0,0.28); font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial; }
            #tta-ad-panel .row { display:flex; gap: 8px; align-items:center; }
            #tta-ad-panel .toggle { appearance:none; border:none; background:#fff; color:#1DA1F2; padding:6px 10px; border-radius:8px; font-weight:700; cursor:pointer; }
            #tta-ad-panel .counter { background:#fff; color:#1DA1F2; padding:6px 10px; border-radius:8px; font-weight:700; }
            .tta-ad-blocked { position: relative !important; min-height: 100px !important; width: 100% !important; box-sizing: border-box !important; }
            .tta-ad-blocked:not(.tta-chill) * { display: none !important; }
            .tta-ad-blocked:not(.tta-chill)::after { content: 'THIS AD HAS BEEN BLOCKED'; position:absolute; inset:auto 0 0 0; top:50%; transform: translateY(-50%); text-align:center; font-weight:800; color:#e02f2f; }
            .tta-ad-blocked.tta-chill { display:block !important; background:transparent !important; border:none !important; padding:0 !important; margin:8px 0 !important; }
            .tta-ad-blocked.tta-chill * { display: initial !important; }
            .tta-cat-box { position: relative; width: 100%; overflow: hidden; border-radius: 16px; background: #f7f7f8; border: 1px solid #e1e8ed; }
            .tta-cat-box img { width: 100%; height: auto; display: block; border-radius: 16px; }
            .tta-cat-overlay { position:absolute; left:0; right:0; bottom:0; padding:8px 12px; background:linear-gradient(to top, rgba(0,0,0,.6), transparent); color:#fff; font-weight:600; text-shadow:0 1px 2px rgba(0,0,0,.4); }
            @media (prefers-color-scheme: dark) {
                .tta-cat-box { background:#15202b; border-color:#38444d; }
            }
        `;
        document.head.appendChild(s);
    }

    async function loadSettings() {
        try {
            const data = await chrome.storage.local.get({
                [STORAGE_KEYS.enabled]: false,  // opt-in default
                [STORAGE_KEYS.panel]: false,
                [STORAGE_KEYS.removeCompletely]: true,
                [STORAGE_KEYS.chillMode]: false,
                [STORAGE_KEYS.statsBlocked]: 0,
                [STORAGE_KEYS.statsLast]: null
            });
            STATE.enabled = Boolean(data[STORAGE_KEYS.enabled]);
            STATE.panelVisible = Boolean(data[STORAGE_KEYS.panel]);
            STATE.removeCompletely = Boolean(data[STORAGE_KEYS.removeCompletely]);
            STATE.chillMode = Boolean(data[STORAGE_KEYS.chillMode]);
            STATE.stats.blocked = Number(data[STORAGE_KEYS.statsBlocked] || 0);
            STATE.stats.lastAt = data[STORAGE_KEYS.statsLast] || null;
        } catch (_) {}
        log('settings loaded', JSON.parse(JSON.stringify(STATE)));
    }

    async function saveSettings() {
        try {
            await chrome.storage.local.set({
                [STORAGE_KEYS.enabled]: STATE.enabled,
                [STORAGE_KEYS.panel]: STATE.panelVisible,
                [STORAGE_KEYS.removeCompletely]: STATE.removeCompletely,
                [STORAGE_KEYS.chillMode]: STATE.chillMode
            });
        } catch (_) {}
    }

    async function saveStats() {
        try {
            await chrome.storage.local.set({
                [STORAGE_KEYS.statsBlocked]: STATE.stats.blocked,
                [STORAGE_KEYS.statsLast]: STATE.stats.lastAt
            });
        } catch (_) {}
    }

    function updateCounter() {
        if (!STATE.panelEl) return;
        const c = STATE.panelEl.querySelector('.counter');
        if (c) c.textContent = String(STATE.stats.blocked);
        const t = STATE.panelEl.querySelector('.toggle');
        if (t) t.textContent = STATE.enabled ? 'ON' : 'OFF';
    }

    function ensurePanel() {
        if (!STATE.panelVisible) return;
        if (STATE.panelEl && document.body.contains(STATE.panelEl)) { STATE.panelEl.style.display = 'block'; updateCounter(); return; }
        const host = document.createElement('div');
        host.id = 'tta-ad-panel';
        host.innerHTML = `
            <div class="card" role="region" aria-label="Ad Blocker">
                <div class="row">
                    <span>Ad Blocker:</span>
                    <button class="toggle" type="button">${STATE.enabled ? 'ON' : 'OFF'}</button>
                    <span class="counter" aria-live="polite">${STATE.stats.blocked}</span>
                </div>
            </div>
        `;
        document.body.appendChild(host);
        STATE.panelEl = host;
        host.style.display = 'block';
        const btn = host.querySelector('.toggle');
        if (btn) btn.addEventListener('click', async () => {
            STATE.enabled = !STATE.enabled;
            updateCounter();
            await saveSettings();
            if (!STATE.enabled) unmarkAll(); else scanAndBlock();
        });
    }

    function hidePanelIfNeeded() {
        if (STATE.panelEl && !STATE.panelVisible) {
            try { STATE.panelEl.remove(); } catch (_) {}
            STATE.panelEl = null;
        }
    }

    function isAdArticle(article) {
        try {
            const badges = article.querySelectorAll('[data-testid="promoted-badge"], [data-promoted="true"], [data-ad="true"]');
            if (badges.length) return true;
            const spans = article.querySelectorAll('span');
            for (const s of spans) {
                const t = (s.textContent || '').trim();
                if (t === 'Ad' || t === 'Reklam' || t === 'Sponsored' || t === 'Promoted' || t === 'Tanıtılan' || t === 'Öne Çıkarılan') return true;
            }
            const dt = article.getAttribute('data-testid');
            if (dt === 'promoted-tweet') return true;
            const cls = String(article.className || '');
            if (/\bpromoted\b|\bad\b/i.test(cls)) return true;
        } catch (_) {}
        return false;
    }

    function unmarkAll() {
        document.querySelectorAll('.tta-ad-blocked').forEach((el) => {
            try {
                el.classList.remove('tta-ad-blocked', 'tta-chill');
                el.removeAttribute('data-tta-ad');
                el.removeAttribute('data-tta-mode');
                el.style.display = '';
            } catch (_) {}
        });
    }

    function replaceWithCat(el) {
        try {
            el.innerHTML = '';
            const box = document.createElement('div'); box.className = 'tta-cat-box';
            const img = document.createElement('img'); img.alt = 'Cute cat'; img.src = randCat();
            const ov = document.createElement('div'); ov.className = 'tta-cat-overlay'; ov.textContent = 'Replaced an ad with a cute cat 🐱';
            img.onerror = function () { this.src = 'https://placekitten.com/600/400'; this.onerror = null; };
            box.appendChild(img); box.appendChild(ov); el.appendChild(box);
            el.classList.add('tta-chill');
            Object.assign(el.style, { display: 'block', background: 'transparent', border: 'none', padding: '0', margin: '8px 0' });
        } catch (_) {}
    }

    function processAd(el) {
        if (el.classList.contains('tta-ad-blocked')) {
            const mode = el.getAttribute('data-tta-mode');
            if (STATE.removeCompletely && mode !== 'removed') { el.style.display = 'none'; el.setAttribute('data-tta-mode', 'removed'); }
            else if (STATE.chillMode && mode !== 'chill') { replaceWithCat(el); el.setAttribute('data-tta-mode', 'chill'); }
            else if (!STATE.removeCompletely && !STATE.chillMode && mode !== 'blocked') { el.innerHTML = '<div style="padding:20px;text-align:center;color:#657786;border:1px solid #e1e8ed;border-radius:15px;margin:10px 0;">THIS AD HAS BEEN BLOCKED</div>'; el.setAttribute('data-tta-mode', 'blocked'); }
            return false;
        }
        el.classList.add('tta-ad-blocked');
        el.setAttribute('data-tta-ad', '1');
        STATE.stats.blocked += 1;
        STATE.stats.lastAt = new Date().toISOString();
        if (STATE.removeCompletely) { el.style.display = 'none'; el.setAttribute('data-tta-mode', 'removed'); }
        else if (STATE.chillMode) { replaceWithCat(el); el.setAttribute('data-tta-mode', 'chill'); }
        else { el.innerHTML = '<div style="padding:20px;text-align:center;color:#657786;border:1px solid #e1e8ed;border-radius:15px;margin:10px 0;">THIS AD HAS BEEN BLOCKED</div>'; el.setAttribute('data-tta-mode', 'blocked'); }
        return true;
    }

    function scanAndBlock() {
        if (!STATE.enabled) return;
        const arts = document.querySelectorAll('article');
        let newCount = 0;
        arts.forEach((a) => { if (isAdArticle(a)) { if (processAd(a)) newCount++; } });
        document.querySelectorAll('[data-testid="promoted-badge"], [data-promoted="true"], [data-ad="true"]').forEach((el) => {
            const host = el.closest('article') || el.closest('div[data-testid="cellInnerDiv"]') || el.closest('div[role="article"]');
            if (host) { if (processAd(host)) newCount++; }
        });
        if (newCount > 0) { updateCounter(); saveStats(); }
    }

    function debounce(fn, wait) { let to = null; return (...args) => { clearTimeout(to); to = setTimeout(() => fn.apply(null, args), wait); }; }

    function observe() {
        const mo = new MutationObserver(() => scanAndBlock());
        mo.observe(document.body, { childList: true, subtree: true });
        setInterval(scanAndBlock, 1200);
        setInterval(() => { if (STATE.panelVisible) ensurePanel(); }, 4000);
        window.addEventListener('load', () => setTimeout(scanAndBlock, 1200));
        window.addEventListener('scroll', debounce(() => scanAndBlock(), 300));
    }

    function setupMessageBridge() {
        try {
            chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
                if (!msg || msg.type !== 'TTA_ADBLOCK') return false;
                log('message', msg);
                switch (msg.name) {
                    case 'TOGGLE_ENABLED':
                        STATE.enabled = Boolean(msg.enabled);
                        saveSettings();
                        if (!STATE.enabled) unmarkAll(); else scanAndBlock();
                        sendResponse?.({ ok: true }); return true;
                    case 'TOGGLE_PANEL':
                        STATE.panelVisible = Boolean(msg.visible);
                        saveSettings();
                        if (STATE.panelVisible) ensurePanel(); else hidePanelIfNeeded();
                        sendResponse?.({ ok: true }); return true;
                    case 'UPDATE_SETTINGS':
                        if (typeof msg.removeCompletely === 'boolean') STATE.removeCompletely = msg.removeCompletely;
                        if (typeof msg.chillMode === 'boolean') STATE.chillMode = msg.chillMode;
                        saveSettings();
                        if (STATE.enabled) scanAndBlock();
                        sendResponse?.({ ok: true }); return true;
                    case 'GET_STATS':
                        sendResponse?.({
                            ok: true,
                            stats: { blocked: STATE.stats.blocked, lastAt: STATE.stats.lastAt },
                            settings: { enabled: STATE.enabled, panel: STATE.panelVisible, removeCompletely: STATE.removeCompletely, chillMode: STATE.chillMode }
                        });
                        return true;
                    case 'FORCE_REFRESH':
                        unmarkAll(); if (STATE.enabled) scanAndBlock(); sendResponse?.({ ok: true }); return true;
                    default:
                        return false;
                }
            });
        } catch (_) {}
    }

    async function init() {
        ensureStyles();
        await loadSettings();
        if (STATE.panelVisible) ensurePanel();
        scanAndBlock();
        observe();
        setupMessageBridge();
        log('ready');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();

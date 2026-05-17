// TweAI — Dev Logger overlay (MV3 content script)
// Ported from ultimate_twitter_tool/src/content/dev-logger.js

(() => {
    const isDevBuild = (() => { try { return !Boolean(chrome.runtime.getManifest()?.update_url); } catch (_) { return true; } })();

    let overlay = null;
    let enabled = false;
    let observer = null;

    function mountOverlay() {
        if (!document.body) {
            document.addEventListener('DOMContentLoaded', mountOverlay, { once: true });
            return;
        }
        if (overlay && document.body.contains(overlay)) return;
        overlay = document.getElementById('tta-dev-logger') || document.createElement('div');
        overlay.id = 'tta-dev-logger';
        overlay.setAttribute('aria-live', 'polite');
        Object.assign(overlay.style, {
            position: 'fixed', bottom: '12px', right: '12px', width: '360px', maxHeight: '240px',
            overflow: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: '12px', background: 'rgba(0,0,0,0.8)', color: '#c7ddff', border: '1px solid rgba(59,130,246,0.6)',
            borderRadius: '8px', padding: '8px', zIndex: '2147483647', whiteSpace: 'pre-wrap', boxShadow: '0 6px 18px rgba(0,0,0,0.4)'
        });
        if (!overlay.firstChild) {
            const header = document.createElement('div');
            header.textContent = 'TweAI Dev Logger';
            Object.assign(header.style, { fontWeight: '700', marginBottom: '6px', color: '#93c5fd' });
            overlay.appendChild(header);
        }
        document.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'l' && e.altKey && e.shiftKey) {
                window.TTALogger.setEnabled(!enabled);
            }
        });
        if (!document.body.contains(overlay)) document.body.appendChild(overlay);

        if (!observer) {
            observer = new MutationObserver(() => {
                if (enabled && !document.getElementById('tta-dev-logger')) mountOverlay();
            });
            observer.observe(document.documentElement, { childList: true, subtree: true });
        }
    }

    function ensureOverlay() { if (enabled) mountOverlay(); return overlay; }

    function appendLine(message) {
        const box = ensureOverlay();
        if (!box) return;
        const line = document.createElement('div');
        const ts = new Date();
        line.textContent = `[${ts.toLocaleTimeString()}] ${message}`;
        box.appendChild(line);
        while (box.childNodes.length > 250) box.removeChild(box.firstChild);
        box.scrollTop = box.scrollHeight;
    }

    function serialize(arg) { if (typeof arg === 'string') return arg; try { return JSON.stringify(arg); } catch (_) { return String(arg); } }

    const api = {
        log: (...args) => { try { console.info('[TTA]', ...args); } catch (_) {} if (!enabled) return; appendLine(args.map(serialize).join(' ')); },
        setEnabled: (v) => { enabled = Boolean(v); if (enabled) mountOverlay(); },
        enable: () => api.setEnabled(true),
        disable: () => api.setEnabled(false),
        clear: () => { if (overlay) overlay.innerHTML = '<div style="font-weight:700;color:#93c5fd;margin-bottom:6px">TweAI Dev Logger</div>'; },
        injectOverlay: () => mountOverlay()
    };

    window.TTALogger = api;

    (function init() {
        try {
            const url = new URL(location.href);
            const urlFlag = url.searchParams.get('tta_debug') === '1' || url.hash.includes('tta_debug');
            const lsFlag = (() => { try { return localStorage.getItem('tta_debug') === '1'; } catch (_) { return false; } })();
            chrome.storage?.local?.get({ ttaDebugLogs: false, ttaDebugLogsUntil: 0 }).then(({ ttaDebugLogs, ttaDebugLogsUntil }) => {
                const until = Number(ttaDebugLogsUntil) || 0;
                const shouldEnable = Boolean(ttaDebugLogs) || until > Date.now() || isDevBuild || urlFlag || lsFlag;
                if (shouldEnable) api.enable();
                api.log('dev-logger ready', { enabled: shouldEnable });
            }).catch(() => { if (isDevBuild) { api.enable(); api.log('dev-logger ready (fallback)'); } });
        } catch (_) { if (isDevBuild) { api.enable(); api.log('dev-logger ready (catch)'); } }
    })();
})();

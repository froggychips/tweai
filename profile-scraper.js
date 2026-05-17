// TweAI — Profile scraper (MV3 content script)
// Ported from ultimate_twitter_tool/src/content/profile-scraper.js
// Runs on /<handle> profile pages; persists data to chrome.storage.local
// so content_script.js can use it for richer AI deep context.

(function () {
    const MAX_ATTEMPTS = 60;
    const INTERVAL_MS = 500;

    function parseCount(text) {
        if (!text) return null;
        const raw = String(text).trim().toLowerCase();
        const match = raw.match(/([0-9]+(?:[\.,][0-9]+)?)\s*([km])?/);
        if (!match) {
            const digits = (raw.match(/\d/g) || []).join('');
            return digits ? Number.parseInt(digits, 10) : null;
        }
        const numStr = match[1];
        const suffix = match[2];
        if (suffix === 'm' || suffix === 'k') {
            const base = parseFloat(numStr.replace(',', '.'));
            if (Number.isNaN(base)) return null;
            return suffix === 'm' ? Math.round(base * 1_000_000) : Math.round(base * 1_000);
        }
        const digitsOnly = (numStr.match(/\d/g) || []).join('');
        return digitsOnly ? Number.parseInt(digitsOnly, 10) : null;
    }

    function textContent(el) { return el ? (el.textContent || '').trim() : ''; }

    function selectFollowersAnchor(username) {
        const anchors = Array.from(document.querySelectorAll('a[role="link"], a'));
        const byVerified = anchors.find(a => (a.getAttribute('href') || '').endsWith(`/${username}/verified_followers`));
        if (byVerified) return byVerified;
        const byHref = anchors.find(a => (a.getAttribute('href') || '').endsWith(`/${username}/followers`));
        if (byHref) return byHref;
        return anchors.find(a => /followers/i.test(textContent(a)));
    }

    function selectFollowingAnchor(username) {
        const anchors = Array.from(document.querySelectorAll('a[role="link"], a'));
        const byHref = anchors.find(a => (a.getAttribute('href') || '').endsWith(`/${username}/following`));
        if (byHref) return byHref;
        return anchors.find(a => /following/i.test(textContent(a)));
    }

    function selectAvatarImg(username) {
        const testid = document.querySelector(`[data-testid^="UserAvatar-Container-"] img`);
        if (testid) return testid;
        const link = document.querySelector(`a[href="/${username}/photo"]`);
        if (link) { const img = link.querySelector('img'); if (img?.src) return img; }
        const img1 = document.querySelector('img[src*="pbs.twimg.com/profile_images/"]');
        if (img1) return img1;
        return null;
    }

    function selectNameAndHandle() {
        const pathname = location.pathname || '/';
        const parts = pathname.split('/').filter(Boolean);
        const handle = (parts[0] || '').replace(/^[@]+/, '');
        let name = '';
        const userNameBlock = document.querySelector('[data-testid="UserName"]');
        if (userNameBlock) {
            const nameSpan = userNameBlock.querySelector('div[dir="ltr"] span');
            name = textContent(nameSpan);
        }
        if (!name) {
            const candidate = document.querySelector('[data-testid="UserName"] span, h1, [role="heading"]');
            name = textContent(candidate);
        }
        return { name: name || handle, handle };
    }

    function selectCountsByTestIds(username) {
        const wrap = document.querySelector('[data-testid="UserProfileHeader_Items"]');
        if (!wrap) return { followers: null, following: null };
        let followers = null; let following = null;
        const aFollowing = wrap.querySelector(`a[href="/${username}/following"]`);
        if (aFollowing) following = parseCount(textContent(aFollowing));
        const aFollowers = wrap.querySelector(`a[href="/${username}/verified_followers"], a[href="/${username}/followers"]`);
        if (aFollowers) followers = parseCount(textContent(aFollowers));
        return { followers, following };
    }

    function selectBio() {
        const bioBlock = document.querySelector('[data-testid="UserDescription"]');
        if (!bioBlock) return null;
        let txt = textContent(bioBlock).replace(/\s*View more\s*$/i, '').trim();
        return txt || null;
    }

    async function tryMcpProfile(handle) {
        try {
            const r = await chrome.runtime.sendMessage({ type: 'TTA_MCP_GET_PROFILE', handle });
            return r?.ok ? r.profile : null;
        } catch { return null; }
    }

    async function tryMcpTweets(handle, count) {
        try {
            const r = await chrome.runtime.sendMessage({ type: 'TTA_MCP_GET_TWEETS', handle, count });
            return r?.ok ? r.tweets : null;
        } catch { return null; }
    }

    async function scrapeOnce() {
        const { handle } = selectNameAndHandle();
        if (!handle) return null;
        const byTest = selectCountsByTestIds(handle);
        let followers = byTest.followers;
        let following = byTest.following;
        if (followers == null || following == null) {
            const followersA = selectFollowersAnchor(handle);
            const followingA = selectFollowingAnchor(handle);
            if (followers == null) followers = parseCount(followersA ? textContent(followersA) : '');
            if (following == null) following = parseCount(followingA ? textContent(followingA) : '');
        }
        const avatarEl = selectAvatarImg(handle);
        let avatarUrl = null;
        if (avatarEl instanceof HTMLImageElement) avatarUrl = avatarEl.src || null;
        const nameHandle = selectNameAndHandle();
        const dom = {
            username: nameHandle.handle,
            name: nameHandle.name,
            avatarUrl,
            followers: Number.isFinite(followers) ? followers : null,
            following: Number.isFinite(following) ? following : null,
            profileUrl: `https://x.com/${nameHandle.handle}`,
            bio: selectBio(),
            updatedAt: Date.now()
        };

        // MCP fallback for fields DOM failed to parse (X redesign resilience)
        if (!dom.bio || dom.followers == null || !dom.avatarUrl) {
            const mcp = await tryMcpProfile(nameHandle.handle);
            if (mcp) {
                if (!dom.bio && mcp.bio) dom.bio = mcp.bio;
                if (dom.followers == null && mcp.followers != null) dom.followers = mcp.followers;
                if (dom.following == null && mcp.following != null) dom.following = mcp.following;
                if (!dom.avatarUrl && mcp.avatarUrl) dom.avatarUrl = mcp.avatarUrl;
                if (!dom.name && mcp.name) dom.name = mcp.name;
            }
        }
        return dom;
    }

    let lastSerialized = '';

    async function persist(data) {
        try {
            const current = JSON.stringify({ u: data.username, n: data.name, a: data.avatarUrl || null, fr: data.followers || null, fg: data.following || null, b: data.bio || null });
            if (current === lastSerialized) return;
            lastSerialized = current;
            await chrome.storage.local.set({ profileData: data });
            window.dispatchEvent(new CustomEvent('tta:profileData', { detail: data }));
        } catch (_) {}
    }

    function waitForSelector(selector, { timeout = 20000 } = {}) {
        return new Promise((resolve) => {
            const start = Date.now();
            if (document.querySelector(selector)) return resolve(true);
            let done = false;
            const observer = new MutationObserver(() => {
                if (document.querySelector(selector)) { if (!done) { done = true; observer.disconnect(); resolve(true); } }
            });
            observer.observe(document.documentElement, { childList: true, subtree: true });
            const timer = setInterval(() => {
                if (document.querySelector(selector)) { if (!done) { done = true; clearInterval(timer); observer.disconnect(); resolve(true); } }
                if (Date.now() - start > timeout) { if (!done) { done = true; clearInterval(timer); observer.disconnect(); resolve(false); } }
            }, 250);
        });
    }

    async function waitForProfileReady(username) {
        const okName = await waitForSelector('[data-testid="UserName"]');
        const okCounts = await waitForSelector(`a[href="/${username}/following"], a[href="/${username}/verified_followers"], a[href="/${username}/followers"]`);
        return okName && okCounts;
    }

    function watchRouteChanges(callback) {
        const origPush = history.pushState;
        const origReplace = history.replaceState;
        const trigger = () => setTimeout(callback, 100);
        try {
            history.pushState = function () { origPush.apply(this, arguments); trigger(); };
            history.replaceState = function () { origReplace.apply(this, arguments); trigger(); };
        } catch (_) {}
        window.addEventListener('popstate', trigger);
    }

    async function run() {
        let attempts = 0;
        const tryScrape = async () => {
            attempts++;
            const data = await scrapeOnce();
            if (!data) return false;
            await persist(data);
            return Boolean(data.followers || data.avatarUrl);
        };

        const { handle } = selectNameAndHandle();
        await waitForProfileReady(handle);
        const ok = await tryScrape();
        if (ok) return;

        const start = Date.now();
        const timer = setInterval(async () => {
            if (attempts >= MAX_ATTEMPTS) { clearInterval(timer); return; }
            if (await tryScrape()) clearInterval(timer);
        }, INTERVAL_MS);

        const mo = new MutationObserver(() => tryScrape());
        mo.observe(document.documentElement, { childList: true, subtree: true });
        watchRouteChanges(() => { attempts = 0; lastSerialized = ''; tryScrape(); });
    }

    const path = location.pathname.split('/').filter(Boolean);
    if (path.length >= 1 && !['home', 'explore', 'notifications', 'messages', 'i', 'settings', 'compose', 'search'].includes(path[0])) {
        run();
    }
})();

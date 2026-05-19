# Troubleshooting

If TweAI suddenly stops working, walk through these in order. Most issues fall into one of three buckets: **X changed its DOM**, **API key issue**, or **the service worker fell asleep**.

## First aid: Run health check

`chrome://extensions` → TweAI → Details → Extension options → scroll to **Diagnostics** → **Run health check**. It will probe each configured API key and report what's reachable. If everything is green here but the UI on x.com is dead, jump to "DOM selectors have degraded" below.

## TweAI's buttons don't appear on x.com

1. **Check the URL.** TweAI matches `https://x.com/*`, `https://*.x.com/*`, `https://twitter.com/*`. If you're on a subdomain that isn't whitelisted, nothing will inject.
2. **Reload the tab.** Content scripts don't retroactively inject into already-open tabs after an extension update.
3. **Top-frame guard.** Since v1.8.1, TweAI runs only in the top frame. If x.com is somehow embedded in an iframe (unusual), TweAI won't load there.
4. **DOM selectors have degraded.** See below.

## DOM selectors have degraded

X periodically renames `data-testid` attributes. TweAI has fallback strategies (semantic and structural) but they're noisier and may still miss.

**Diagnose:**

1. Open DevTools on `x.com`.
2. In the console: `chrome.storage.local.get('tta_selector_health', console.log)`.
3. You'll see counts like `tweetText: { l1: 200, l2: 0, l3: 0, miss: 0 }`. Healthy state is `l1 >> 0` everywhere. If you see `miss > 0` on a key consistently, that selector strategy is failing.

**Fix:**

- If this is your repo: update the relevant `find*` function in `selectors.js`, add a new fallback strategy at level 2 or 3.
- If you're a user: open a [GitHub issue](https://github.com/froggychips/tweai/issues) with the output of the `tta_selector_health` dump.

## "Daily token budget exceeded"

You hit the daily cap configured in Options → Advanced → Spending limit.

- Reset the counter: Options → Spending limit → **Reset counter**.
- Or raise the limit (or set it to `0` for unlimited).

## API key looks invalid / 401 errors

- **OpenAI**: keys start with `sk-`. Generate at [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
- **Grok (xAI)**: keys start with `xai-`. Generate at [console.x.ai](https://console.x.ai).
- **Gemini**: keys start with `AIza…`. Generate at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).

After pasting, run the key test in Options → Provider card → Configure.

## Service worker dies during long requests

Symptom: a slow AI request (>30s) sometimes returns `Generation failed` silently.

- Since v1.8.1+, TweAI uses `chrome.alarms` to keep the service worker alive while AI calls are in-flight. If you still see this, check `chrome://serviceworker-internals/` — find the TweAI worker and look at the "Status".
- A failed alarm-keepalive in Chrome is usually a deeper Chrome bug; retry the request once.

## Rate-limit (429) errors

`aiFetch` retries 429/5xx automatically twice with exponential backoff (~400ms → 1.6s). If you're consistently hitting 429:

- Check provider quota dashboard.
- For Gemini: free tier is 1M tokens/day, but RPM (requests per minute) is also throttled — auto-translate of the whole timeline can burst.

## MCP gateway shows offline

- Options → Advanced → For developers → MCP Gateway → **Test**.
- Confirm `mcpUrl` matches what your local MCP server is listening on.
- TweAI 1.8.1+ moved localhost into `optional_host_permissions`. The first time you set an MCP URL, Chrome will prompt you to grant `http://127.0.0.1/*` permission — accept it. If you didn't, the request will fail without a clear error.

## Translation appears in the wrong language

- Options → Translate tweets → **Translate to**. `Browser language (auto)` resolves to your Chrome UI language; pick an explicit target if you've set Chrome to a language you don't read.

## How do I file a useful bug report

Run health check, capture its output, and include:

- Chrome version (`chrome://version`)
- TweAI version (manifest.json or extensions page)
- Steps to reproduce
- DevTools Console output (filter to "TweAI" or "TTA")
- `chrome.storage.local.get('tta_selector_health', console.log)` dump if X UI looks broken

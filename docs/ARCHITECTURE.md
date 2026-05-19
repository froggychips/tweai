# Architecture

A bird's-eye view of how TweAI's moving parts fit together. The goal here is to give a maintainer enough mental model to find the right file when something breaks.

## Top-level flow

```
                ┌────────────────────┐
   user on x.com│  content_script.js │ (per-tab, isolated world)
                │  + selectors.js    │
                │  + dev-logger.js   │
                │  + ad-blocker.js   │
                │  + profile-scraper │
                └────────┬───────────┘
                         │ chrome.runtime.sendMessage
                         ▼
                ┌────────────────────┐
                │   background.js    │  service worker
                │   (MV3 SW)         │
                └────┬───────────┬───┘
                     │           │
       AI providers  │           │  MCP gateway (optional)
   ┌─────────────────┴┐         ┌┴──────────────────────┐
   │ api.openai.com   │         │ 127.0.0.1:<port>/...  │
   │ api.x.ai (Grok)  │         │ tweai-mcp-server/     │
   │ generativelang…  │         │                       │
   │ (Gemini)         │         └───────────────────────┘
   └──────────────────┘
```

## Components

### Service worker (`background.js`)

- **Settings store** (`baseDefaults` + `chrome.storage.sync`)
- **Persona prompts** (`PERSONAS` constant)
- **Provider registry** — `PROVIDERS = { openai, grok, gemini }`. Each entry has `keyField`, `label`, `buildRequest`, `parseResponse`. The dispatcher `callAI(provider, model, messages, temperature)` picks the right entry by name.
- **`aiFetch()`** — fetch wrapper with `AbortController` timeout (30s default) + exponential backoff retry on 429/5xx.
- **Token budgeting** (`checkBudget` / `addUsage`) — daily quota stored under `usage:YYYY-MM-DD` in `chrome.storage.local`.
- **MCP client** — `mcpFetch` with 5-min in-memory cache; `mcpGetProfile`, `mcpGetRecentTweets`.
- **SW keep-alive** — `chrome.alarms` registered while `inflightCount > 0`; `chrome.storage.session.tta_inflight_requests` tracks pending calls for restart visibility.
- **Message handlers** (`handlers` object) — `TTA_GET_PREFS`, `TTA_TRANSLATE_TWEET`, `TTA_EXPLAIN_TWEET`, `TTA_GENERATE_REPLY`, `TTA_LIST_PERSONAS`, `TTA_TEST_KEY`, `TTA_HEALTH_CHECK`, `TTA_MCP_*`, etc. Each handler is `async msg => result`; the listener validates `sender` origin before dispatch.

### Content script (`content_script.js`)

Injected on `x.com` / `twitter.com` at `document_start`. Runs only in the top frame (nested iframes skip `boot()`).

- **`boot()`** wires `MutationObserver` for the timeline, plus `scroll` / `popstate` / `visibilitychange` listeners (all funnel into `scheduleScan`).
- **`scan()`** finds every `<article>` and DM composer and attaches UI (translate label, AI explain/reply submenu, compose box, etc).
- **DOM lookups go through `window.TTASelectors`** — see `selectors.js`. Never embed `data-testid="…"` directly in this file.
- **AI calls** go to `background.js` via `chrome.runtime.sendMessage({ type: 'TTA_…' })`. The content script never talks to AI providers directly.

### `selectors.js`

`window.TTASelectors` is the only place that knows X's DOM. Each function tries:

1. `data-testid` (level 1 — precise, fragile),
2. ARIA / `lang` / `dir` attributes (level 2 — semantic),
3. structural CSS path (level 3 — last resort).

Every call records success level into a local ring buffer, persisted to `chrome.storage.local.tta_selector_health` for diagnostics. See [TROUBLESHOOTING.md](TROUBLESHOOTING.md#dom-selectors-have-degraded) for how to read it.

### Options page (`options.html` + `options.js`)

Single page, no modules. Reads/writes `chrome.storage.sync` via `storageGet` / `storageSet`. UI text comes from `_locales/<lang>/messages.json` via `data-i18n*` attributes and `applyI18n()` on `DOMContentLoaded`.

Onboarding wizard (`#tta-onboarding`) overlays on first run if `onboardingDone` is unset.

### Dev tooling

- `dev-logger.js` — floating log overlay; opt-in via `chrome.storage.local.ttaDebugLogs` or unpacked dev build (no `update_url`).
- `profile-scraper.js` — listens for `history.pushState` to detect profile navigation, scrapes basic data, stores in `chrome.storage.local.profileData`.
- `ad-blocker.js` — separate content script entry; reads `chrome.storage.local.adBlockerEnabled` and removes promoted posts.

### MCP gateway (optional, separate repo folder)

`tweai-mcp-server/` is a tiny Node + Express service that wraps X's GraphQL endpoints. The extension talks to it via `mcpFetch` when `prefs.mcpUrl` is set. The fallback chain in `content_script.js` is **DOM scan → MCP (background-side cached) → local storage cache**.

The MCP server is excluded from the Chrome Web Store package — users who want it install it themselves.

## Data persistence

| Where | What |
|---|---|
| `chrome.storage.sync` | User settings: API keys (encrypted by Chrome), models, persona, custom personas, language, MCP URL |
| `chrome.storage.local` | Token usage per day (`usage:YYYY-MM-DD`), profile cache, ad-blocker stats, dev-logger toggle, selector-health ring buffer |
| `chrome.storage.session` | In-flight request tracker (cleared on SW restart) |
| In-memory (SW) | MCP response cache (5 min TTL), inflight counter |

## What lives off-disk

Nothing. There is no backend server, no telemetry, no analytics. The extension's only outbound calls are:

- The AI provider you chose (OpenAI / Grok / Gemini),
- Google Translate (only if you enabled that path with a key),
- Your own MCP server (only if you configured `mcpUrl`).

If you see TweAI calling anything else in DevTools Network, that's a bug — please [file an issue](https://github.com/froggychips/tweai/issues).

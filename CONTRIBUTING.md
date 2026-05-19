# Contributing to TweAI

Thanks for considering a contribution! TweAI is a single-developer side-project that turned out useful enough to open up. PRs are welcome but I review at a hobby cadence.

## Project layout

```
.
├── manifest.json          # MV3 manifest
├── background.js          # service worker — AI calls, MCP, message dispatch
├── content_script.js      # UI injection on x.com / twitter.com
├── selectors.js           # window.TTASelectors with fallback DOM strategies
├── dev-logger.js          # opt-in floating log overlay (dev/debug)
├── ad-blocker.js          # promoted-post hider (separate content_scripts entry)
├── profile-scraper.js     # author profile sniffer
├── options.html / .js / .css
├── styles.css             # shared CSS injected into x.com
├── _locales/{en,ru}/messages.json
├── tools/build.mjs        # dist/ + zip packager
├── tweai-mcp-server/      # Node MCP gateway (separate package; not bundled)
└── docs/
    ├── ARCHITECTURE.md
    ├── TROUBLESHOOTING.md
    ├── CWS_REVIEW.md
    └── ...
```

`tweai-mcp-server/` is a separate Node project for an optional local gateway. It has its own `package.json` and is excluded from the extension zip.

## Local development

```bash
git clone https://github.com/froggychips/tweai.git
cd tweai
npm install
npm run lint
npm run format
npm run package    # produces dist/ + tweai-v<version>.zip
```

Load `dist/` (or the repo root) via `chrome://extensions` → Developer mode → Load unpacked.

After every file change in the extension, click the reload icon on the TweAI card in `chrome://extensions`. Content scripts also need a tab reload on x.com to re-inject.

## Style

- Prettier handles formatting (`npm run format:fix` to apply). 100-col, single quotes, trailing commas, LF.
- ESLint is intentionally light: it catches typos and unused vars but doesn't enforce style.
- Comments: explain *why* something is non-obvious, not *what* the code does. Skip comments for code that reads cleanly on its own.

## DOM selectors

If you touch DOM lookups on x.com, **add or update a strategy in `selectors.js`** rather than embedding `data-testid="…"` in `content_script.js` directly. The selector module:

1. tries `data-testid` (level 1),
2. falls back to ARIA/semantic attributes (level 2),
3. then to structural selectors (level 3),
4. records every call into a ring buffer in `chrome.storage.local.tta_selector_health`.

This lets us tell *which* lookup broke after an X redesign without staring at silent failures.

## i18n

Strings that the user sees go through `_locales/{en,ru}/messages.json`. In HTML, use `data-i18n="key"` (or `data-i18n-placeholder` / `data-i18n-html` / `data-i18n-aria-label`). In JS, use the `i18n('key')` helper in `options.js` or `tta_i18n('key')` in `content_script.js` — both have an English fallback if the message is missing.

New strings: add the key to both `en/messages.json` and `ru/messages.json`. Don't ship hardcoded Russian text in default-locale UI — that's a Chrome Web Store blocker.

## Provider additions

To add a new AI provider, register it in the `PROVIDERS` registry in `background.js` with `keyField`, `label`, `buildRequest(apiKey, model, messages, temperature)` and `parseResponse(j)`. The dispatcher `callAI()` picks it up automatically. Make sure the new key field is also in `baseDefaults` and surfaced in `options.html`.

## Commits & PRs

- One logical change per PR. If something feels like two PRs, it is.
- Title imperative: "Add X" / "Fix Y" / "Refactor Z". Body explains *why*, not *what*.
- For DOM changes, paste a screenshot of x.com before/after.
- For provider/API changes, describe how you verified the wire format (DevTools Network screenshot is fine).
- CI must be green (lint, format, build). Don't `--no-verify` past it; ask if the hook is wrong.

## Reporting bugs

[GitHub Issues](https://github.com/froggychips/tweai/issues). Include:

- Chrome version
- TweAI version (`manifest.json` or `chrome://extensions`)
- Reproduction steps
- DevTools console output if there's a JS error
- Output of "Run health check" in TweAI options
- For DOM-breakage reports: also dump `chrome.storage.local.get('tta_selector_health', console.log)` so we see which selector level fell over

## Security issues

See [SECURITY.md](SECURITY.md). Don't open public issues for vulnerabilities.

# Changelog

All notable changes to TweAI are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project loosely follows [SemVer](https://semver.org/).

## [Unreleased]

### Tooling
- `package.json` + `eslint.config.js` + `.prettierrc.json` (PR #9)
- `tools/build.mjs` packages `dist/` and `tweai-v<version>.zip` without `tweai-mcp-server/` or `docs/`
- `.github/workflows/checks.yml` runs lint + format + build on every PR
- `.github/workflows/release.yml` builds and publishes a GitHub release with the zip when a `v*` tag is pushed

### Architecture
- `selectors.js` introduces `window.TTASelectors` with multi-strategy DOM lookups (testid → semantic → structural) and a ring-buffer health counter in `chrome.storage.local.tta_selector_health` (PR #7)
- Provider abstraction: `callOpenAI` / `callGrok` / `callGemini` merged into a `PROVIDERS` registry + `aiFetch()` with `AbortController` timeout and 429/5xx retry with exponential backoff (PR #6)
- Service worker keep-alive via `chrome.alarms` while AI requests are in-flight; MCP responses cached in-memory for 5 min (PR #8)
- Gemini API key is now sent via `x-goog-api-key` header instead of `?key=` URL param

### Internationalization
- `_locales/en/messages.json` and `_locales/ru/messages.json` cover ~110 UI keys; `manifest.default_locale: "en"` (PR #5)
- `options.html` strings bound via `data-i18n` / `data-i18n-placeholder` / `data-i18n-html` / `data-i18n-aria-label`
- Built-in personas now ship with English `label` / `hint` (fallback if `chrome.i18n` is unavailable)

### Security
- `chrome.runtime.onMessage` validates `sender`: only own extension pages and `*.x.com` / `*.twitter.com` frames are allowed
- `http://localhost/*` / `http://127.0.0.1/*` moved from `host_permissions` to `optional_host_permissions`
- Dev-logger no longer reads `?tta_debug=1` or `localStorage 'tta_debug'` (both forgeable from x.com)
- `boot()` runs only in the top frame
- `document.execCommand('insertText')` consolidated into a single helper with InputEvent → execCommand → direct-assignment fallback chain
- Persona hint renders via DOM API (`replaceChildren`, `textContent`) instead of `innerHTML`

## [1.8.1] - 2026-05-19

Security & CWS hygiene patch (see [release notes](https://github.com/froggychips/tweai/releases/tag/v1.8.1)).

## [1.8] - 2026-05-17

Open-source launch.

# Chrome Web Store submission checklist

Internal checklist before pushing a new version to the Chrome Web Store. Walk through this top to bottom; every item should be either ✅ or have a comment on why it's skipped.

## Pre-submission

### Manifest hygiene

- [ ] `manifest_version: 3`
- [ ] `version` bumped from previous release (numeric SemVer, e.g. `1.8.1`)
- [ ] `default_locale: "en"` set; `_locales/en/messages.json` exists
- [ ] `name` and `description` reference `__MSG_*__` not hardcoded text
- [ ] `host_permissions` contains only what the extension actually calls
- [ ] `optional_host_permissions` used for everything user-toggled (MCP, localhost)
- [ ] No `<all_urls>` in matches or host_permissions
- [ ] Icons present at 16/48/128 px in `icons/` and referenced from `action` + top-level `icons`

### Code

- [ ] `npm run lint` passes (no errors)
- [ ] `npm run format` passes
- [ ] `npm run package` succeeds; resulting zip is < 10 MB
- [ ] Test the zip in `chrome://extensions` → Load unpacked from `dist/`
- [ ] No `console.log` spam in production paths (`dev-logger` is opt-in only)
- [ ] No hardcoded API keys, tokens, or URLs to dev infrastructure

### Documentation

- [ ] `CHANGELOG.md` has an entry for the new version
- [ ] `README.md` install instructions still work
- [ ] `PRIVACY.md` accurately describes data flow for any new features
- [ ] `SECURITY.md` threat model matches reality

### Store listing assets

- [ ] **At least one screenshot**, 1280×800 or 640×400 PNG/JPEG, showing TweAI in action on x.com (CWS rejects without this)
- [ ] Promotional tile 440×280 (optional but recommended)
- [ ] Updated short description (132 chars max)
- [ ] Updated long description (up to 16,384 chars; usually mirrors README "Features" section)
- [ ] **Privacy practices form** filled out in the dev dashboard:
  - Does not collect personally identifiable information ✅
  - Does not collect health information ✅
  - Does not collect financial info ✅
  - Authentication info: API keys stored locally only (declare this)
  - User activity: not collected
  - Web content: tweet text is sent to user-configured AI provider only

### Permissions justification

For every permission in `manifest.json`, have a 1-sentence reason ready (CWS asks for this):

| Permission | Justification |
|---|---|
| `storage` | Persist user settings, API keys, custom personas, token usage |
| `scripting` | Required for `chrome.scripting` calls from background script |
| `activeTab` | Quick action on the current X tab without `<all_urls>` |
| `webNavigation` | Detect SPA navigation on x.com to refresh injected UI |
| `clipboardWrite` | Copy generated replies to clipboard on user action |
| `tabs` | Open options page; iterate X tabs to broadcast settings updates |
| `alarms` | Keep service worker alive during long AI requests (>30s) |
| host_permissions: `api.openai.com`, `api.x.ai`, `generativelanguage.googleapis.com` | The user's AI provider endpoints |
| host_permissions: `x.com`, `*.x.com`, `twitter.com`, `*.twitter.com` | Inject UI on the target sites |
| optional `127.0.0.1`, `localhost` | User-toggled MCP gateway; requested at runtime if enabled |

## Submission

- [ ] Upload the zip from `npm run package`
- [ ] Fill out all required listing fields
- [ ] Submit for review

## Post-submission

- [ ] Tag the release in git: `git tag v<version> && git push origin v<version>`
- [ ] CI release workflow attaches the zip to a GitHub release automatically
- [ ] Monitor [CWS dev dashboard](https://chrome.google.com/webstore/devconsole/) for review feedback (typically 1–3 business days)
- [ ] Once approved, update README install link to the CWS listing

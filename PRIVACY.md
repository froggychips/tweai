# Privacy Policy

**TweAI is bring-your-own-key (BYOK).** We do not run a backend, we do not collect telemetry, and we do not see your API key, your prompts, or the AI responses.

## What is stored, and where

| Data | Where | Why |
|---|---|---|
| Your OpenAI / Google API key | `chrome.storage.sync` (synced across your Chrome profile) | Used to call the model on your behalf |
| Your preferences (model, language, persona, style) | `chrome.storage.sync` | Persist UI settings |
| Translation cache | `chrome.storage.local` | Avoid re-translating the same tweet |

`chrome.storage.sync` is encrypted at rest by Chrome and synced through your Google account. Switch to `chrome.storage.local` (planned option) if you don't want sync.

## What is sent off-device

When you trigger Translate, Explain, AI Reply, or use the Composer, the extension sends an HTTPS request **directly from your browser** to:

- `https://api.openai.com/v1/chat/completions` (always, when you use OpenAI)
- `https://translation.googleapis.com/language/translate/v2` (only if you opted into the Google provider for translation)

The request contains the tweet text, your prompt, and your API key. Nothing passes through any server we control — there is no server we control.

## What we do not collect

- No analytics, no tracking pixels, no error reporting beacons.
- No cloud sync of prompts or replies.
- No user identifiers tied to your account.

## Removing data

Uninstalling the extension wipes `chrome.storage.local`. To clear `storage.sync` immediately, click **Reset to defaults** in Options before uninstalling.

## Contact

Open an issue: https://github.com/froggychips/TweAI/issues

# Security

## Reporting a vulnerability

Please open a private security advisory:
https://github.com/froggychips/tweai/security/advisories/new

Or email the maintainer (link in the GitHub profile). Do not file public issues for security problems.

## Threat model — what we protect against

- **Prompt injection from tweet text.** Tweet content is wrapped in delimiters and the system prompt explicitly instructs the model to treat it as data, not instructions. Not bullet-proof, but defends against most casual injections.
- **API key exposure.** The key never leaves the user's browser. It is stored in `chrome.storage.sync` and sent only to the configured provider over HTTPS.
- **Permission overreach.** The extension only requests `storage`, `scripting`, `activeTab`, `webNavigation`, `clipboardWrite`, plus host access to X / Twitter / `api.openai.com`. No `<all_urls>`, no `tabs`.

## What we do not protect against

- **A malicious user who already has access to your Chrome profile.** They can read `chrome.storage.sync` and exfiltrate your API key. Use a separate Chrome profile if this matters.
- **Compromised OpenAI / Google endpoints.** We trust the configured provider's TLS endpoint.
- **DOM-injected scripts on x.com.** A compromised X frontend could read DOM that the extension also reads.

## Supply chain

The extension has zero runtime dependencies (no `node_modules`, no bundler, no minifier). The only build script is `scripts/inject-secrets.js` for local dev — it does not touch published code.

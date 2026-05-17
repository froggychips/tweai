# Launch checklist & copy

Drafts ready to paste. Adjust tone to taste, but the structure is tuned for each surface. Do **all of these on the same day** — Product Hunt timer is 24h, your Twitter post is the discovery driver, and the GitHub README is what people land on.

---

## 1) Chrome Web Store listing

Chrome Store ranks heavily on title + first 132 chars of description. Both are below.

**Name** (≤45 chars):

```
TweAI — AI Reply Assistant for X (Twitter)
```

**Short description** (≤132 chars; first thing search shows):

```
AI replies on X / Twitter in your voice. Personas, multilingual, your own OpenAI key. Open source, no subscription, no backend.
```

**Detailed description** (≤16,000 chars; the box on the listing page):

```
TweAI is an open-source Chrome extension that drafts AI replies for X (Twitter) in your own voice. No subscription. No backend. Your OpenAI key, your data.

WHY YOU MIGHT LIKE IT
- Built-in tech-creator personas (Founder, Engineer, AI Researcher, Casual Tech, Flirt) — or write your own.
- Per-account memory: a different default voice on each X account you use in the same browser.
- Deep context: optionally include the post author's last 5 tweets so the reply matches their thread.
- Translates the timeline lazily as you scroll; cached locally so you don't re-spend tokens on the same tweet.
- Works in DMs, not just the timeline.
- One-click Tweet button: translates your draft into the source tweet's language and inserts it into the native reply box.
- Daily token budget so you don't accidentally burn $20 on a long doom-scroll.
- One-click diagnostics if X redesigns their DOM.

PRIVACY
TweAI has no backend. Your API key, your prompts, and the AI responses go directly from your browser to OpenAI (or Google Translate, if you choose) over HTTPS. We do not see them. We do not have a server you could point at.

SOURCE & LICENSE
100% open source under Apache-2.0. Read the code, fork it, or send a PR:
https://github.com/froggychips/tweai

WHAT YOU NEED
- An OpenAI API key (https://platform.openai.com/api-keys). The default model gpt-4o-mini costs ~$0.15 per million input tokens — typically a fraction of a cent per reply.

INSTALL
1. Add to Chrome.
2. Click the extension icon → Options.
3. Paste your OpenAI key. Click Test.
4. Open x.com. The 🤖 Explain, AI Reply, ✍️ Composer, and Tweet buttons will appear under each post.

FEEDBACK & BUGS
GitHub Issues: https://github.com/froggychips/tweai/issues
```

**Category:** Productivity
**Language:** English (Russian secondary)
**Single screenshot needed:** 1280×800 — show timeline with one tweet's submenu open (Explain rendered + Persona dropdown visible). Animated GIF goes in the README, not the Store.

---

## 2) Product Hunt

Headline (≤60 chars):

```
TweAI — open-source AI replies for X. BYOK. No subscription.
```

Tagline (≤80 chars; appears under the name):

```
Drafts replies in your voice with custom personas. Your key, no backend.
```

First-comment template (PH highly weighs the maker's first comment — post it within 5 min of going live):

```
Hey Product Hunt — I'm shipping TweAI today.

Why I built it: every "AI reply" extension on the Chrome Store is a $9–29/mo subscription that wraps OpenAI behind a rate-limit and a generic "Great point! 🔥" tone. That's silly when you can BYOK and get unlimited replies for cents per call.

What it does, briefly:
• Drafts replies for X / Twitter in 5 built-in tech-creator personas — or write your own
• Per-account memory: different voice on different X accounts you use
• Multilingual: replies match the source tweet's language with one click
• Translates timeline lazily, cached, so doom-scrolling doesn't burn tokens
• Daily token budget so you can't accidentally spend $20

What's deliberately missing:
• No automation. This is an assistant — you press Send. Nothing posts on its own.
• No telemetry, no backend, no subscription. Your OpenAI key, your data.

Built in plain MV3 — zero runtime dependencies, no bundler. ~700 LOC of content_script + 200 of background. Apache-2.0.

Source: https://github.com/froggychips/tweai
Direct GitHub install instructions in the README until the Chrome Store review clears.

Happy to hear feedback, especially on persona prompts.
```

Hashtags / topics (PH allows up to 4): `Chrome Extensions`, `Productivity`, `Artificial Intelligence`, `Open Source`.

**Time the launch for 12:01 AM PT** — you get the full 24h on the Today board.

---

## 3) Tech-twitter / X thread

Goal: drive ~200–500 GitHub stars and ~500 Chrome installs in the first 48h. Single thread, 4–6 posts. Don't link to Chrome Store from tweet 1 (X deboosts external links from the first post). Link from tweet 2 onward, or only at the end.

**Tweet 1 (the hook — no link):**

```
Open-sourced an AI reply assistant for X today.

It drafts replies in your voice with personas you can customize.
Your own OpenAI key. No subscription. No backend.

Built it for myself; figured I'd share. Apache-2.0.
```

Attach the demo GIF here. This is the most important asset.

**Tweet 2:**

```
Why I built it instead of paying $9/mo:

every "AI reply for X" extension wraps OpenAI behind a rate-limit and a generic "Great point! 🔥" tone.

BYOK + Apache-2.0 + 5 tech-creator personas (or write your own) gets you unlimited replies for cents per call.

Code:
github.com/froggychips/tweai
```

**Tweet 3 (feature highlight — pick the one with the best visual):**

```
The trick that makes it feel personal:

Per-account memory.

Switch X accounts in the same browser → the default persona switches with you. Your "founder" voice and your "shitposter" voice never bleed into each other.
```

**Tweet 4 (proof of restraint):**

```
What it deliberately *doesn't* do:

→ No automation. You press Tweet. Nothing posts on its own.
→ No telemetry, no analytics, no backend.
→ No subscription tier hiding "real" features.

This is a tool, not a SaaS funnel.
```

**Tweet 5 (call to action):**

```
If you've ever opened ChatGPT in another tab to draft a reply — try it.

Install from source today; Chrome Store review pending.
github.com/froggychips/tweai

⭐ if it's useful, would help me stay accountable to keeping it free.
```

**Optional Tweet 6 (community ask):**

```
Looking for feedback on persona prompts.

If you DM me your X handle + the kind of voice you want, I'll try writing a system prompt that nails it and ship it as a built-in persona in v1.8.
```

---

## 4) Hacker News (`Show HN`)

HN is hit-or-miss for browser extensions but has high signal when it lands. Submit at 6–9 AM PT on a weekday.

**Title** (≤80 chars; HN strips emojis and hype):

```
Show HN: TweAI – open-source AI reply assistant for X (Twitter), BYOK
```

**URL field:** `https://github.com/froggychips/tweai` (point at the GitHub repo, not the Chrome Store; HN trusts source > store).

**No body text.** HN's house style is to put the explanation in the first comment instead.

**First comment** (post within 1 min of submission):

```
Maker here. Why this exists:

Every "AI reply for X" extension on the Chrome store is a $9–29/mo subscription that wraps OpenAI behind a rate-limit and a generic tone. Felt silly when you can BYOK.

TweAI is plain MV3 JavaScript, zero runtime dependencies. ~700 LOC of content_script + ~200 of background. Apache-2.0.

What's there:
- 5 built-in tech-creator personas (Founder, Engineer, AI Researcher, Casual Tech, Flirt) plus a custom-persona editor that takes any system prompt
- Per-account memory: different default persona on different X accounts in the same browser
- Lazy timeline translation with local cache (doom-scrolling doesn't burn tokens)
- Daily token budget you can set in Options
- Sandwich-pattern prompt-injection defense (tweet text is wrapped and the system prompt explicitly tells the model to treat it as data)

What's deliberately not there:
- No automation. You press Send. Nothing posts on its own.
- No backend, no telemetry, no analytics.

Happy to discuss. Particularly interested in feedback on the persona prompts and on how the per-account detection holds up against X's frequent DOM redesigns.
```

---

## 5) Reddit / niche subs (lower priority)

Post in this order, ~24h apart, **only if the HN/PH/twitter cycle didn't already saturate you with installs**:

- `/r/chrome_extensions` — title: `[Show] TweAI: open-source AI reply assistant for X (Twitter), BYOK`
- `/r/Twitter` — title: `Built an open-source AI reply assistant. Personas, BYOK, no subscription.`
- `/r/SideProject` — title: `Shipped my open-source AI reply assistant for X today`
- `/r/MachineLearning` — **only** with a technical angle (e.g., the prompt-injection defense). Don't post without one; mods nuke promotional posts.

---

## 6) Day-of checklist

- [ ] `docs/demo.gif` recorded and pushed (see `docs/RECORDING.md`)
- [ ] PR #4 merged, master tagged `v1.7`
- [ ] Chrome Store submission filed (~3–5 days review)
- [ ] Product Hunt scheduled for 12:01 AM PT
- [ ] Twitter thread queued, pinned to profile after publishing
- [ ] HN submitted at 7 AM PT
- [ ] Reddit posts queued for D+1 and D+2 (in case the launch underperforms)
- [ ] GitHub repo settings: enable Discussions; pin one issue per planned next feature

## 7) What "success" looks like at 7 days

Realistic for a soloProduct Hunt + tech-twitter launch with a working extension:

- 2,000–5,000 Chrome installs
- 200–500 GitHub stars
- 5–15 first-time issues / PRs
- 0 paying customers (this is by design — open-core monetization comes after validation)

**If you're below 500 installs at D+7**, the niche isn't pulling. Don't build the cloud-tier; iterate on the open-source positioning, try a second launch in 4–6 weeks with one or two viral features (e.g., custom persona library, GIF replies, etc.).

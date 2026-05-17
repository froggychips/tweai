#!/usr/bin/env node
/**
 * TweAI MCP Gateway
 *
 * Local HTTP server that wraps X (Twitter) API calls so the browser extension
 * has a stable data source. When X redesigns their DOM, profile-scraper.js and
 * content_script.js fall back here instead of breaking.
 *
 * Auth: cookie-based (ct0 + auth_token), same as your logged-in browser session.
 * Set TWITTER_CT0 and TWITTER_AUTH_TOKEN env vars before starting.
 *
 * Usage:
 *   npm install
 *   TWITTER_CT0=... TWITTER_AUTH_TOKEN=... MCP_TOKEN=your-secret node server.js
 *
 * Extension connects to http://localhost:3847/ with Bearer MCP_TOKEN.
 */

const express = require("express");

const PORT = Number(process.env.MCP_PORT || 3847);
const CT0 = process.env.TWITTER_CT0 || "";
const AUTH_TOKEN = process.env.TWITTER_AUTH_TOKEN || "";
const MCP_TOKEN = process.env.MCP_TOKEN || "";

// ── Auth check middleware ────────────────────────────────────────────────────

function requireToken(req, res, next) {
  if (!MCP_TOKEN) return next(); // no token configured → open (dev only)
  const auth = req.headers["authorization"] || "";
  if (auth === `Bearer ${MCP_TOKEN}`) return next();
  res.status(401).json({ ok: false, error: "MCP_UNAUTHORIZED" });
}

// ── Twitter API helpers ──────────────────────────────────────────────────────

const X_HEADERS = {
  "authorization": "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
  "x-csrf-token": CT0,
  "cookie": `ct0=${CT0}; auth_token=${AUTH_TOKEN}`,
  "content-type": "application/json",
  "x-twitter-active-user": "yes",
  "x-twitter-client-language": "en",
};

async function xFetch(url, options = {}) {
  if (!CT0 || !AUTH_TOKEN) throw Object.assign(new Error("X credentials not configured"), { code: "MCP_NOT_CONFIGURED" });
  const res = await fetch(url, { headers: X_HEADERS, ...options });
  if (res.status === 401 || res.status === 403) throw Object.assign(new Error("X auth failed — refresh your cookies"), { code: "MCP_UNAUTHORIZED" });
  if (!res.ok) throw new Error(`X API ${res.status}: ${await res.text().catch(() => "")}`);
  return res.json();
}

// UserByScreenName GraphQL endpoint (stable across X redesigns)
async function fetchProfile(handle) {
  const variables = encodeURIComponent(JSON.stringify({
    screen_name: handle,
    withSafetyModeUserFields: true,
  }));
  const features = encodeURIComponent(JSON.stringify({
    hidden_profile_likes_enabled: true,
    hidden_profile_subscriptions_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    subscriptions_verification_info_is_identity_verified_enabled: true,
    subscriptions_verification_info_verified_since_enabled: true,
    highlights_tweets_tab_ui_enabled: true,
    responsive_web_twitter_article_notes_tab_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    responsive_web_graphql_timeline_v2_enabled: true,
  }));
  const data = await xFetch(
    `https://x.com/i/api/graphql/NimuplG1OB7Fd2btCLdBOw/UserByScreenName?variables=${variables}&features=${features}`
  );
  const u = data?.data?.user?.result;
  if (!u) return null;
  const legacy = u.legacy || {};
  return {
    username: legacy.screen_name || handle,
    name: legacy.name || handle,
    bio: legacy.description || null,
    followers: legacy.followers_count ?? null,
    following: legacy.friends_count ?? null,
    avatarUrl: legacy.profile_image_url_https?.replace("_normal", "_400x400") || null,
    verified: !!legacy.verified || !!u.is_blue_verified,
    profileUrl: `https://x.com/${legacy.screen_name || handle}`,
  };
}

// UserTweets GraphQL endpoint — last N tweets
async function fetchRecentTweets(handle, count = 5) {
  // First resolve userId
  const profile = await fetchProfile(handle);
  if (!profile) return [];

  const variables = encodeURIComponent(JSON.stringify({
    userId: profile.userId, // may be null — handled below
    count,
    includePromotedContent: false,
    withQuickPromoteEligibilityTweetFields: false,
    withVoice: false,
    withV2Timeline: true,
  }));

  // If userId isn't available from profile, skip
  if (!profile.userId) return [];

  const data = await xFetch(
    `https://x.com/i/api/graphql/V7H0Ap3_Hh2FyS75OCDO3Q/UserTweets?variables=${variables}`
  );

  const entries = data?.data?.user?.result?.timeline_v2?.timeline?.instructions
    ?.flatMap(i => i.entries || []) || [];

  return entries
    .filter(e => e?.content?.itemContent?.__typename === "TimelineTweet")
    .slice(0, count)
    .map(e => {
      const t = e?.content?.itemContent?.tweet_results?.result?.legacy;
      return t?.full_text || null;
    })
    .filter(Boolean);
}

// DM Inbox — best-effort via v1.1 or v2 fallback
async function fetchDmInbox() {
  try {
    const data = await xFetch("https://x.com/i/api/1.1/dm/inbox_initial_state.json?nsfw_filtering_enabled=false&filter_low_quality=false&include_quality=all&dm_secret_conversations_enabled=false&krs_registration_enabled=true&cards_platform=Web-12&include_cards=1&include_ext_alt_text=true&include_quote_count=true&include_reply_count=1&tweet_mode=extended&include_entities=true&include_user_entities=true&include_ext_media_color=true&include_ext_media_availability=true&send_error_codes=true&simple_quoted_tweet=true&count=20");
    const conversations = Object.values(data?.inbox_initial_state?.conversations || {}).map(c => ({
      conversationId: c.conversation_id,
      participantIds: c.participants?.map(p => p.user_id) || [],
      lastMessage: c.last_read_event_id || null,
    }));
    return { conversations, source: "v1.1" };
  } catch (e) {
    return { conversations: [], source: "error", error: e.message };
  }
}

// ── Express app ──────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// CORS — extension calls from chrome-extension:// origin
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/status", (req, res) => {
  res.json({
    ok: true,
    serverVersion: "0.1.0",
    configured: !!(CT0 && AUTH_TOKEN),
    tokenRequired: !!MCP_TOKEN,
  });
});

app.get("/profiles/:handle", requireToken, async (req, res) => {
  try {
    const profile = await fetchProfile(req.params.handle);
    if (!profile) return res.status(404).json({ ok: false, error: "Profile not found" });
    res.json({ ok: true, profile });
  } catch (e) {
    const code = e.code || "MCP_ERROR";
    res.status(code === "MCP_UNAUTHORIZED" ? 401 : code === "MCP_NOT_CONFIGURED" ? 503 : 500)
       .json({ ok: false, error: e.message, code });
  }
});

app.get("/tweets/:handle/recent", requireToken, async (req, res) => {
  try {
    const count = Math.min(20, Math.max(1, Number(req.query.count) || 5));
    const tweets = await fetchRecentTweets(req.params.handle, count);
    res.json({ ok: true, tweets });
  } catch (e) {
    const code = e.code || "MCP_ERROR";
    res.status(code === "MCP_UNAUTHORIZED" ? 401 : 500)
       .json({ ok: false, error: e.message, code });
  }
});

app.get("/dm/inbox", requireToken, async (req, res) => {
  try {
    const result = await fetchDmInbox();
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`TweAI MCP gateway listening on http://127.0.0.1:${PORT}`);
  if (!CT0 || !AUTH_TOKEN) console.warn("⚠  TWITTER_CT0 / TWITTER_AUTH_TOKEN not set — API calls will fail");
  if (!MCP_TOKEN) console.warn("⚠  MCP_TOKEN not set — server is open (dev mode)");
});

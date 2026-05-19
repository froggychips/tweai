// === TweAI content script ===

// Манифест поднимает скрипт во всех iframe (all_frames + match_about_blank) ради
// поддержки nested-фреймов X, но реальная разметка таймлайна живёт только в top-frame.
// В nested-фреймах исполнение скрипта только удваивает MutationObserver и засоряет логи.
const TTA_IS_TOP_FRAME = (() => { try { return window.self === window.top; } catch { return false; } })();

const STYLES = [
  ['formal', 'formal'],
  ['casual', 'casual'],
  ['flirt', 'flirt']
];
const LANGS = [
  ['auto', 'Auto'], ['ru', 'Русский'], ['en', 'English'], ['th', 'ไทย'],
  ['es', 'Español'], ['de', 'Deutsch'], ['fr', 'Français'], ['pt', 'Português'],
  ['it', 'Italiano'], ['ja', '日本語'], ['ar', 'العربية'], ['tr', 'Türkçe']
];
const EMOJIS = '😀 😃 😄 😁 😆 😅 😂 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤗 🤭 🤫 🤔 🤤 🤩 🤯 😎 🤓 🥳 😏 😒 🙄 😬 😮‍💨 😴 🤝 👍 👎 👋 🙏 💪 ✍️ ✌️ 🤞 👀 ❤️ 🧡 💛 💚 💙 💜 🤍 ⭐ ✨ 🔥 💡 📌'.split(/\s+/);

const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const once = (el, key) => { if (!el || el[key]) return false; el[key] = true; return true; };

// chrome.i18n с graceful fallback. content-script может выполняться до полной
// инициализации API, поэтому ловим исключения и возвращаем пустую строку.
const tta_i18n = (key) => {
  try { return chrome?.i18n?.getMessage(key) || ''; } catch { return ''; }
};

async function getPrefs() {
  try {
    const r = await chrome.runtime.sendMessage({ type: 'TTA_GET_PREFS' });
    return r?.ok ? r : { prefs: {}, uiLang: 'en' };
  } catch {
    return { prefs: {}, uiLang: 'en' };
  }
}

// Detect the currently active X account handle for per-account persona override.
// X exposes the active handle on the side-nav account switcher.
function detectActiveHandle() {
  const switcher = TTASelectors.findAccountSwitcher();
  if (switcher) {
    const handleSpan = qsa('span', switcher).find(s => /^@/.test(s.textContent || ''));
    if (handleSpan) return handleSpan.textContent.trim().toLowerCase();
  }
  // Fallback: profile link in side nav (handle через URL)
  const profileLink = TTASelectors.findProfileLink();
  if (profileLink) {
    const href = profileLink.getAttribute('href') || '';
    const m = href.match(/^\/([A-Za-z0-9_]{1,15})$/);
    if (m) return ('@' + m[1]).toLowerCase();
  }
  return null;
}

function resolveActivePersona(prefs) {
  const handle = detectActiveHandle();
  if (handle && prefs?.accountPreferences?.[handle]?.persona) {
    return prefs.accountPreferences[handle].persona;
  }
  return prefs?.persona || 'default';
}

let personasPromise = null;
async function getPersonas() {
  if (!personasPromise) {
    personasPromise = (async () => {
      try {
        const r = await chrome.runtime.sendMessage({ type: 'TTA_LIST_PERSONAS' });
        return r?.ok ? r.personas : [{ id: 'default', label: 'Default' }];
      } catch {
        return [{ id: 'default', label: 'Default' }];
      }
    })();
  }
  return personasPromise;
}

function fillPersonaSelect(select, personas, defaultId) {
  if (!select || select.options.length) return;
  for (const { id, label } of personas) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = label;
    if (id === defaultId) opt.selected = true;
    select.appendChild(opt);
  }
}

function getTweetText(article) {
  return TTASelectors.findTweetText(article);
}

function getAuthorId(article) {
  const a = TTASelectors.findAuthorLink(article);
  return a?.getAttribute('href')?.split('?')[0] || null;
}

function collectRecentTweetsOfAuthor(article, limit = 5) {
  const author = getAuthorId(article);
  const container = article.closest('main') || document;
  const out = [];
  for (const a of qsa('article[data-testid="tweet"], article[role="article"]', container)) {
    if (out.length >= limit) break;
    if (getAuthorId(a) === author) {
      const t = getTweetText(a);
      if (t) out.push('• ' + t);
    }
  }
  return out.join('\n');
}

// Returns null for pure reposts (no AI Reply button needed).
// Otherwise returns { type, text, quotedText, thread }.
function extractTweetPayload(article) {
  const socialCtx = qs('[data-testid="socialContext"]', article);
  const isRepost = /reposted|retweeted/i.test(socialCtx?.textContent || '');

  // Quoted tweet container: nested article or role="link" block inside article
  const quotedContainer = qs('[data-testid="tweet"] article', article)
    || qs('div[role="link"][tabindex="0"]', article);
  const quotedText = quotedContainer ? getTweetText(quotedContainer) : null;

  // Own text = tweetText nodes NOT inside the quoted container.
  // Используем те же стратегии что и findTweetText, но руками — нам нужно
  // отфильтровать nodes принадлежащие quoted блоку.
  let ownText = '';
  let textNodes = qsa('[data-testid="tweetText"]', article);
  if (!textNodes.length) textNodes = qsa('div[dir="auto"][lang], span[dir="auto"][lang]', article);
  for (const el of textNodes) {
    if (quotedContainer && quotedContainer.contains(el)) continue;
    ownText += (ownText ? '\n' : '') + el.innerText.trim();
  }

  // Pure repost: no own words, just re-sharing
  if (isRepost && !ownText) return null;

  const onTweetPage = /\/status\/\d+/.test(location.pathname);
  const thread = onTweetPage ? collectThreadAbove(article) : null;

  const type = quotedText ? 'quote'
             : thread?.length ? 'thread_reply'
             : 'original';

  return { type, text: ownText || getTweetText(article), quotedText, thread };
}

// Collect up to 5 tweets above the given article on a status page,
// labelled by author handle so the model knows who said what.
function collectThreadAbove(article) {
  const all = qsa('article[data-testid="tweet"]');
  const idx = all.indexOf(article);
  if (idx <= 0) return [];
  return all.slice(Math.max(0, idx - 5), idx).map(a => {
    const handle = (getAuthorId(a) || '').replace(/^\//, '').split('?')[0] || '?';
    const t = getTweetText(a);
    return t ? `@${handle}: ${t}` : null;
  }).filter(Boolean);
}

// In deep mode on a status page: collect only the author's own posts in this
// thread instead of their global recent tweets — more relevant signal.
function collectAuthorRepliesInThread(article) {
  const authorPath = getAuthorId(article);
  if (!authorPath) return '';
  const all = qsa('article[data-testid="tweet"]');
  const idx = all.indexOf(article);
  if (idx <= 0) return '';
  return all.slice(0, idx)
    .filter(a => getAuthorId(a) === authorPath)
    .map(a => getTweetText(a))
    .filter(Boolean)
    .map(t => '• ' + t)
    .join('\n');
}

async function collectDeepContext(article) {
  const authorPath = getAuthorId(article);
  const handle = authorPath ? authorPath.replace(/^\//, '').split('?')[0] : null;
  const onTweetPage = /\/status\/\d+/.test(location.pathname);

  // On a status page prefer the author's replies in this specific thread —
  // more relevant than their global recent tweets.
  let tweets = onTweetPage ? collectAuthorRepliesInThread(article) : '';

  // 1. If not on status page (or no thread replies found): MCP → DOM scan
  if (!tweets) {
    if (handle) {
      try {
        const r = await chrome.runtime.sendMessage({ type: 'TTA_MCP_GET_TWEETS', handle, count: 5 });
        if (r?.ok && r.tweets?.length) tweets = r.tweets.map(t => '• ' + t).join('\n');
      } catch {}
    }
    if (!tweets) tweets = collectRecentTweetsOfAuthor(article, 5);
  }

  // 2. Profile context: read from local storage (populated by profile-scraper.js)
  let profileLine = '';
  if (handle) {
    try {
      const data = await new Promise(r => chrome.storage.local.get(['profileData'], o => r(o)));
      const p = data.profileData;
      if (p && p.username === handle) {
        const parts = [];
        if (p.bio) parts.push('Bio: ' + p.bio);
        if (p.followers != null) parts.push('Followers: ' + p.followers);
        if (parts.length) profileLine = parts.join(', ');
      }
    } catch {}
  }

  if (profileLine && tweets) return `Author profile: ${profileLine}\n\nRecent tweets:\n${tweets}`;
  if (profileLine) return `Author profile: ${profileLine}`;
  return tweets;
}

const cacheGet = key => new Promise(res => chrome.storage.local.get([key], o => res(o[key])));
const cacheSet = (key, val) => new Promise(res => chrome.storage.local.set({ [key]: val }, res));

function applyPrefsToBlock(block, prefs) {
  block.style.setProperty('--tta-font-family', prefs.fontFamily || 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial');
  block.style.setProperty('--tta-font-color', prefs.fontColor || '#D1D5DB');
  block.classList.toggle('bg-subtle', prefs.bgStyle === 'subtle');
  block.classList.toggle('bg-transparent', prefs.bgStyle !== 'subtle');
}

// === Block construction ===
function buildBlock(auto) {
  const wrap = document.createElement('div');
  wrap.className = 'tta-translation';

  // Translation row
  const rowTranslate = document.createElement('div');
  rowTranslate.className = 'tta-row';

  const planet = document.createElement('span');
  planet.className = 'tta-planet';
  planet.dataset.ttaAct = 'translate';
  planet.title = 'Translate';
  if (!auto) planet.textContent = '🌐';

  const transText = document.createElement('div');
  transText.className = 'tta-translation-text';
  transText.dataset.ttaTranslation = '';
  transText.textContent = auto ? '…' : '—';

  rowTranslate.append(planet, transText);

  // Explain row
  const rowExplain = document.createElement('div');
  rowExplain.className = 'tta-row';

  const explainBtn = document.createElement('button');
  explainBtn.type = 'button';
  explainBtn.className = 'plain-link';
  explainBtn.dataset.ttaAct = 'explain';
  explainBtn.textContent = '🤖 Explain';
  rowExplain.appendChild(explainBtn);

  // Submenu
  const submenu = document.createElement('div');
  submenu.className = 'tta-submenu';
  submenu.hidden = true;

  const explainTitle = document.createElement('div');
  explainTitle.className = 'tta-explain-title';
  // Cyrillic А — prevents X from translating the label
  explainTitle.textContent = 'АI Analysis:';

  const explainBody = document.createElement('div');
  explainBody.className = 'tta-explain-body';
  explainBody.dataset.ttaSection = 'ai-analysis';

  // Composer (✍️) line
  const composeLine = buildComposerLine();

  // Reply controls
  const replyCtl = document.createElement('div');
  replyCtl.className = 'tta-reply-ctl';

  const replyBtn = document.createElement('button');
  replyBtn.type = 'button';
  replyBtn.className = 'btn';
  replyBtn.dataset.ttaAct = 'reply';
  replyBtn.textContent = 'AI Reply';

  const deepLabel = document.createElement('label');
  deepLabel.title = 'Use author context';
  const deepCheckbox = document.createElement('input');
  deepCheckbox.type = 'checkbox';
  deepCheckbox.dataset.ttaDeep = '';
  deepLabel.append(deepCheckbox, document.createTextNode(' Deep'));

  const styleLabel = document.createElement('label');
  styleLabel.dataset.styleSelectWrap = '';
  const styleSelect = document.createElement('select');
  styleSelect.dataset.styleSelect = '';
  for (const [value, label] of STYLES) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    if (value === 'flirt') opt.selected = true;
    styleSelect.appendChild(opt);
  }
  styleLabel.appendChild(styleSelect);

  const personaLabel = document.createElement('label');
  personaLabel.dataset.personaSelectWrap = '';
  const personaSelect = document.createElement('select');
  personaSelect.dataset.personaSelect = '';
  // Personas populated lazily via TTA_LIST_PERSONAS
  personaLabel.appendChild(personaSelect);

  const censorLabel = document.createElement('label');
  censorLabel.className = 'nocensor';
  censorLabel.title = 'SFW only';
  const censorCheckbox = document.createElement('input');
  censorCheckbox.type = 'checkbox';
  censorCheckbox.dataset.ttaCensor = '';
  censorLabel.append(censorCheckbox, document.createTextNode(' без цензуры'));

  replyCtl.append(replyBtn, deepLabel, styleLabel, personaLabel, censorLabel);

  // Reply output
  const replyOut = document.createElement('div');
  replyOut.className = 'tta-reply-out';

  const replyBody = document.createElement('div');
  replyBody.className = 'tta-reply-body';
  replyBody.dataset.ttaSection = 'suggested-reply';

  const replyCopyLine = document.createElement('div');
  replyCopyLine.className = 'tta-copyline';

  const tweetBtn = document.createElement('button');
  tweetBtn.type = 'button';
  tweetBtn.className = 'tta-copy tta-copy-reply';
  tweetBtn.title = 'Insert into reply composer';
  tweetBtn.textContent = 'Tweet';
  replyCopyLine.appendChild(tweetBtn);

  replyOut.append(replyBody, replyCopyLine);

  submenu.append(explainTitle, explainBody, composeLine, replyCtl, replyOut);
  wrap.append(rowTranslate, rowExplain, submenu);

  return wrap;
}

function buildComposerLine() {
  const line = document.createElement('div');
  line.className = 'tta-compose-line';

  const emojiBtn = document.createElement('button');
  emojiBtn.type = 'button';
  emojiBtn.className = 'tta-emoji-btn';
  emojiBtn.title = tta_i18n('cs_emoji_title') || 'Emoji';
  emojiBtn.textContent = '😊';

  const emojiPanel = document.createElement('div');
  emojiPanel.className = 'tta-emoji-panel';
  emojiPanel.hidden = true;

  const composeBtn = document.createElement('button');
  composeBtn.type = 'button';
  composeBtn.className = 'tta-compose-btn';
  composeBtn.title = tta_i18n('cs_compose_title') || 'Write a prompt';
  composeBtn.textContent = '✍️';

  const input = document.createElement('textarea');
  input.className = 'tta-compose-input';
  input.placeholder = tta_i18n('cs_compose_ph_post') || 'Your prompt for this post…';

  composeBtn.addEventListener('click', () => {
    input.classList.toggle('show');
    if (input.classList.contains('show')) input.focus();
  });

  for (const e of EMOJIS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tta-emoji-item';
    b.textContent = e;
    b.addEventListener('click', () => {
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      input.value = input.value.slice(0, start) + e + input.value.slice(end);
      const caret = start + e.length;
      try { input.setSelectionRange(caret, caret); } catch {}
      input.focus();
    });
    emojiPanel.appendChild(b);
  }

  emojiBtn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    emojiPanel.hidden = !emojiPanel.hidden;
  });
  document.addEventListener('click', e => {
    if (!emojiPanel.contains(e.target) && e.target !== emojiBtn) emojiPanel.hidden = true;
  }, true);

  input.addEventListener('keydown', async ev => {
    if (ev.key !== 'Enter' || ev.shiftKey) return;
    ev.preventDefault();
    const article = input.closest('article');
    const submenu = input.closest('.tta-submenu');
    if (!article || !submenu) return;
    const styleSel = submenu.querySelector('[data-style-select]');
    const personaSel = submenu.querySelector('[data-persona-select]');
    const deepContext = !!submenu.querySelector('[data-tta-deep]')?.checked;
    const userPrompt = input.value.trim();
    const freshPayload = extractTweetPayload(article) || { type: 'original', text: getTweetText(article) };
    // If user typed a custom prompt, treat it as a user instruction overlaid on tweet context
    const context = userPrompt ? 'USER_PROMPT:\n' + userPrompt : (deepContext ? await collectDeepContext(article) : '');
    const payload = {
      tweetPayload: freshPayload,
      style: styleSel?.value || 'formal',
      persona: personaSel?.value || 'default',
      censorshipOff: !!submenu.querySelector('[data-tta-censor]')?.checked,
      deepContext,
      context,
    };
    if (!freshPayload.text) return;
    input.value = tta_i18n('cs_compose_sending') || 'Sending…';
    try {
      const r = await chrome.runtime.sendMessage({ type: 'TTA_GENERATE_REPLY', payload });
      input.value = r?.ok && r.text ? r.text : (tta_i18n('cs_compose_error') || 'Generation failed');
    } catch {
      input.value = tta_i18n('cs_compose_error') || 'Generation failed';
    }
  });

  line.append(emojiBtn, emojiPanel, composeBtn, input);
  return line;
}

// === Action handlers ===
async function runTranslate(block, text, target) {
  const transEl = block.querySelector('[data-tta-translation]');
  const key = 'tta:tr:' + target + ':' + text.slice(0, 512);
  const cached = await cacheGet(key);
  if (cached) {
    transEl.textContent = cached + ' (cached)';
    return;
  }
  transEl.textContent = 'Translating…';
  try {
    const r = await chrome.runtime.sendMessage({ type: 'TTA_TRANSLATE_TWEET', payload: { text, target } });
    if (r?.ok) {
      transEl.textContent = r.text;
      await cacheSet(key, r.text);
    } else {
      transEl.textContent = 'Translation failed';
    }
  } catch {
    transEl.textContent = 'Translation failed';
  }
}

// Вставка текста в composer X.
// Стратегия: 1) InputEvent path (дружелюбен к React/ProseMirror и не помечен deprecated);
//            2) execCommand('insertText') как fallback (X пока на нём держится);
//            3) прямое присваивание value/textContent для textarea / простых полей.
// Возвращает true, если хоть один путь сработал.
function ttaInsertText(box, text) {
  if (!box || typeof text !== 'string') return false;
  try { box.focus(); } catch {}
  // 1. Modern InputEvent — Chrome не отдаст реальный insert на contenteditable,
  // но сам факт диспатча сообщит React'у о намерении и поднимет 'beforeinput'.
  try {
    const ev = new InputEvent('beforeinput', {
      inputType: 'insertText', data: text, bubbles: true, cancelable: true,
    });
    box.dispatchEvent(ev);
  } catch {}
  // 2. Legacy execCommand (deprecated, но в Chrome работает на contenteditable до сих пор).
  let inserted = false;
  try { inserted = document.execCommand('insertText', false, text); } catch {}
  // 3. Direct assignment fallback — textarea/<input>.
  if (!inserted) {
    try {
      if ('value' in box && typeof box.value === 'string') box.value += text;
      else box.textContent = (box.textContent || '') + text;
      inserted = true;
    } catch {}
  }
  try { box.dispatchEvent(new InputEvent('input', { bubbles: true })); } catch {}
  return inserted;
}

function insertIntoComposer(text, anchor) {
  const root = anchor?.closest?.('article') || document;
  const box = TTASelectors.findComposeBox(root) || TTASelectors.findComposeBox(document);
  if (!box) return false;
  return ttaInsertText(box, text);
}

function quickInsert(article, text, tries = 8, delay = 120) {
  let n = 0;
  const tick = () => {
    const box = (article.querySelector('div[role="textbox"], textarea'))
      || document.querySelector('div[role="textbox"], textarea');
    if (box) {
      ttaInsertText(box, text);
      return;
    }
    if (++n < tries) setTimeout(tick, delay);
  };
  setTimeout(tick, delay);
}

async function attachToTweet(article) {
  if (!once(article, '__ttaAttached')) return;
  const tweetPayload = extractTweetPayload(article);
  // Pure repost with no author comment — translation/explain still works, reply skipped
  const txt = tweetPayload?.text || getTweetText(article);
  if (!txt) {
    delete article.__ttaAttached;
    return;
  }
  const { prefs } = await getPrefs();
  const auto = !!prefs?.autoTranslateTweets;
  const defaultIso = prefs?.targetLanguage || 'auto';

  const block = buildBlock(auto);
  applyPrefsToBlock(block, prefs || {});
  const anchor = TTASelectors.findTweetAnchor(article);
  anchor.insertAdjacentElement('afterend', block);

  const submenu = block.querySelector('.tta-submenu');
  const translateBtn = block.querySelector('[data-tta-act="translate"]');
  const personaSelect = submenu.querySelector('[data-persona-select]');
  getPersonas().then(personas => fillPersonaSelect(personaSelect, personas, resolveActivePersona(prefs)));

  // Hide the AI Reply controls for pure reposts — author said nothing
  if (!tweetPayload) {
    submenu.querySelector('[data-tta-act="reply"]')?.closest('.tta-reply-ctl')?.remove();
    submenu.querySelector('.tta-reply-out')?.remove();
  }

  if (auto) {
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) {
          runTranslate(block, txt, defaultIso);
          io.disconnect();
        }
      }
    }, { threshold: 0.1 });
    io.observe(block);
  } else {
    translateBtn?.addEventListener('click', () => runTranslate(block, txt, defaultIso));
  }

  // Explain
  block.querySelector('[data-tta-act="explain"]').addEventListener('click', async () => {
    submenu.hidden = false;
    const explainEl = submenu.querySelector('[data-tta-section="ai-analysis"]');
    explainEl.textContent = 'Analyzing…';
    try {
      const r = await chrome.runtime.sendMessage({ type: 'TTA_EXPLAIN', payload: { text: txt } });
      explainEl.textContent = r?.ok ? r.text : 'Analyze failed';
    } catch {
      explainEl.textContent = 'Analyze failed';
    }
  });

  // AI Reply
  submenu.querySelector('[data-tta-act="reply"]')?.addEventListener('click', async () => {
    const styleSel = submenu.querySelector('[data-style-select]');
    const personaSel = submenu.querySelector('[data-persona-select]');
    const censorshipOff = !!submenu.querySelector('[data-tta-censor]')?.checked;
    const deepContext = !!submenu.querySelector('[data-tta-deep]')?.checked;
    const context = deepContext ? await collectDeepContext(article) : '';
    // Re-extract payload at click time — thread context may have loaded since attach
    const freshPayload = extractTweetPayload(article) || { type: 'original', text: txt };
    const out = submenu.querySelector('[data-tta-section="suggested-reply"]');
    out.textContent = 'Generating…';
    try {
      const r = await chrome.runtime.sendMessage({
        type: 'TTA_GENERATE_REPLY',
        payload: {
          tweetPayload: freshPayload,
          style: styleSel?.value || 'formal',
          persona: personaSel?.value || 'default',
          censorshipOff, deepContext, context
        }
      });
      out.textContent = r?.ok ? r.text : 'Reply failed';
    } catch {
      out.textContent = 'Reply failed';
    }
  });

  // Tweet button: translate to source lang -> open native reply -> insert
  block.querySelector('.tta-copy-reply').addEventListener('click', async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    const custom = block.querySelector('.tta-compose-input');
    let replyText = (custom?.value || '').trim();
    if (!replyText) {
      replyText = (block.querySelector('[data-tta-section="suggested-reply"]')?.textContent || '').trim();
    }
    if (!replyText) return;

    let iso = 'und';
    try {
      const det = await chrome.runtime.sendMessage({ type: 'TTA_DETECT_LANGUAGE', payload: { text: txt } });
      if (det?.ok && det.iso) iso = det.iso;
    } catch {}

    let finalText = replyText;
    if (iso !== 'und') {
      try {
        const tr = await chrome.runtime.sendMessage({ type: 'TTA_TRANSLATE_TWEET', payload: { text: replyText, target: iso } });
        if (tr?.ok && tr.text) finalText = tr.text;
      } catch {}
    }

    article.querySelector('[data-testid="reply"]')?.click();
    if (!insertIntoComposer(finalText, article)) quickInsert(article, finalText);
  });
}

// === DM support ===
function attachToDmComposer(area) {
  if (!once(area, '__ttaDM')) return;
  const parent = area.parentElement;
  if (!parent) return;

  if (!parent.querySelector('.tta-compose-line')) {
    const line = buildComposerLine();
    line.querySelector('.tta-compose-input').placeholder = tta_i18n('cs_compose_ph_dm') || 'Your prompt for this DM…';
    parent.insertBefore(line, area);
  }
  if (!parent.querySelector('.tta-dm-reply')) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tta-dm-reply';
    b.textContent = 'Tweet';
    b.style.marginLeft = '6px';
    b.addEventListener('click', () => {
      const custom = parent.querySelector('.tta-compose-input');
      const txt = (custom?.value || '').trim();
      if (!txt) return;
      ttaInsertText(area, txt);
    });
    parent.appendChild(b);
  }
}

// === Settings popup hook ===
function wireSettings(root) {
  const sel = '[data-tta-act="settings"], .tta-open-settings, button[aria-label="Settings"], a[href="#tta-settings"]';
  for (const el of root.querySelectorAll(sel)) {
    if (!once(el, '__ttaSettingsWired')) continue;
    el.addEventListener('click', async e => {
      e.preventDefault();
      e.stopPropagation();
      try {
        const r = await chrome.runtime.sendMessage({ type: 'TTA_OPEN_SETTINGS' });
        if (!r?.ok) chrome.runtime.openOptionsPage?.();
      } catch {
        chrome.runtime.openOptionsPage?.();
      }
    }, true);
  }
}

// === DOM cleanup (X-injected labels) ===
// X иногда инжектит локализованные плейсхолдеры рядом с твитом ("Перевести пост" в ru-UI,
// "Translate post" в en-UI). Список расширяемый — добавлять локалью по мере обнаружения.
const X_LEGACY_TRANSLATE_LABELS = new Set([
  'Перевести пост',
  'Translate post',
]);
function cleanupXLabels(root) {
  for (const el of root.querySelectorAll('span')) {
    const t = el.textContent?.trim();
    if (t && X_LEGACY_TRANSLATE_LABELS.has(t)) el.remove();
  }
}

// === Single observer + scheduler ===
let scanTimer = null;
function scheduleScan() {
  if (scanTimer) clearTimeout(scanTimer);
  scanTimer = setTimeout(scan, 200);
}

function scan() {
  for (const a of qsa('article')) attachToTweet(a);
  for (const dm of TTASelectors.findDmComposers(document)) attachToDmComposer(dm);
  wireSettings(document);
  cleanupXLabels(document);
}

function boot() {
  scan();
  const mo = new MutationObserver(scheduleScan);
  mo.observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('scroll', scheduleScan, true);
  addEventListener('popstate', scheduleScan);
  document.addEventListener('visibilitychange', scheduleScan);
  if ('navigation' in window) {
    try { navigation.addEventListener('navigatesuccess', scheduleScan); } catch {}
  }
}

if (TTA_IS_TOP_FRAME) {
  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot, { once: true });
}

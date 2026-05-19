// === TweAI DOM selectors ===
//
// X (Twitter) часто переименовывает data-testid атрибуты. Каждая функция здесь
// пробует несколько стратегий по убыванию надёжности:
//   1) data-testid — самый точный и долгое время стабильный, но ломается при
//      редизайнах X.
//   2) семантические селекторы (ARIA / lang / dir) — реже ломаются, но шумнее.
//   3) структурные — последний рубеж, может вернуть мусор.
//
// Каждая успешная ветка инкрементирует счётчик в chrome.storage.local.
// Если уровень 1 проваливается часто (например, >30% последних вызовов), это
// сигнал что X сменил DOM и расширение нужно обновить — см. /docs/TROUBLESHOOTING.md.
//
// Загружается перед content_script.js (см. manifest content_scripts.js order).

(() => {
  const HEALTH_KEY = 'tta_selector_health';
  const HEALTH_BUFFER = 200; // ring buffer last N attempts per selector

  // Local in-memory ring buffer; flushed на storage по таймеру, чтобы не
  // лупить chrome.storage.local.set на каждый querySelector.
  const localBuffer = {};
  let flushTimer = null;
  const scheduleFlush = () => {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      try {
        chrome.storage?.local?.set({ [HEALTH_KEY]: localBuffer });
      } catch {}
    }, 2000);
  };

  function record(name, level) {
    const slot = localBuffer[name] || (localBuffer[name] = { l1: 0, l2: 0, l3: 0, miss: 0, n: 0 });
    slot[level] = (slot[level] || 0) + 1;
    slot.n = (slot.n || 0) + 1;
    if (slot.n > HEALTH_BUFFER) {
      // Reset ring buffer когда переполняется — храним только свежие.
      for (const k of Object.keys(slot)) slot[k] = 0;
    }
    scheduleFlush();
  }

  // Утилиты
  const $  = (root, sel) => (root || document).querySelector(sel);
  const $$ = (root, sel) => Array.from((root || document).querySelectorAll(sel));

  // Текст твита внутри <article>.
  function findTweetText(article) {
    if (!article) return '';
    // Уровень 1: data-testid
    let nodes = $$(article, '[data-testid="tweetText"]');
    if (nodes.length) { record('tweetText', 'l1'); return nodes.map(n => n.innerText.trim()).join('\n').trim(); }
    // Уровень 2: семантика — div[dir="auto"][lang]
    nodes = $$(article, 'div[dir="auto"][lang], span[dir="auto"][lang]');
    if (nodes.length) { record('tweetText', 'l2'); return nodes.map(n => n.innerText.trim()).join('\n').trim(); }
    // Уровень 3: первый осмысленный текстовый блок
    const fallback = $(article, 'article > div > div > div');
    if (fallback?.innerText) { record('tweetText', 'l3'); return fallback.innerText.trim(); }
    record('tweetText', 'miss');
    return '';
  }

  // Анкор-нода для крепления UI поверх твита.
  function findTweetAnchor(article) {
    return $(article, '[data-testid="tweetText"]')
        || $(article, 'div[dir="auto"][lang], span[dir="auto"][lang]')
        || article;
  }

  // Ссылка на профиль автора (href вида /handle).
  function findAuthorLink(article) {
    let el = $(article, '[data-testid="User-Name"] a[href*="/"]');
    if (el) { record('authorLink', 'l1'); return el; }
    el = $(article, 'a[role="link"][href^="/"]');
    if (el) { record('authorLink', 'l2'); return el; }
    record('authorLink', 'miss');
    return null;
  }

  // Кнопка-переключатель аккаунта в side nav.
  function findAccountSwitcher() {
    let el = $(document, '[data-testid="SideNav_AccountSwitcher_Button"]');
    if (el) { record('accountSwitcher', 'l1'); return el; }
    el = $(document, 'button[aria-label*="ccount"]');
    if (el) { record('accountSwitcher', 'l2'); return el; }
    record('accountSwitcher', 'miss');
    return null;
  }

  // Ссылка на свой профиль в side nav (для определения активного handle).
  function findProfileLink() {
    let el = $(document, '[data-testid="AppTabBar_Profile_Link"]');
    if (el) { record('profileLink', 'l1'); return el; }
    el = $(document, 'a[href^="/"][aria-label*="rofile"]');
    if (el) { record('profileLink', 'l2'); return el; }
    record('profileLink', 'miss');
    return null;
  }

  // Reply composer box внутри статьи или глобально.
  function findComposeBox(root) {
    const r = root || document;
    let el = $(r, '[data-testid="tweetTextarea_0"] div[role="textbox"]');
    if (el) { record('composeBox', 'l1'); return el; }
    el = $(r, 'div[role="textbox"]');
    if (el) { record('composeBox', 'l2'); return el; }
    el = $(r, 'textarea');
    if (el) { record('composeBox', 'l3'); return el; }
    record('composeBox', 'miss');
    return null;
  }

  // DM composer.
  function findDmComposers(root) {
    const r = root || document;
    let list = $$(r, '[data-testid="dmComposerTextInput"]');
    if (list.length) { record('dmComposer', 'l1'); return list; }
    // У X иногда dm-input — обычный textarea внутри aria-label="Type a message"
    list = $$(r, '[aria-label*="essage" i] textarea, [aria-label*="essage" i] div[role="textbox"]');
    if (list.length) { record('dmComposer', 'l2'); return list; }
    record('dmComposer', 'miss');
    return [];
  }

  window.TTASelectors = {
    findTweetText,
    findTweetAnchor,
    findAuthorLink,
    findAccountSwitcher,
    findProfileLink,
    findComposeBox,
    findDmComposers,
    // Для диагностики: текущий снапшот ring-buffer'ов.
    _getHealth: () => JSON.parse(JSON.stringify(localBuffer)),
  };
})();

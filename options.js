const chromeApi = typeof chrome !== 'undefined' ? chrome : undefined;
const runtimeApi = chromeApi?.runtime;
const storageSync = chromeApi?.storage?.sync;

const memoryStore = {};

const storageGet = defaults => storageSync
  ? new Promise(resolve => storageSync.get(defaults, resolve))
  : Promise.resolve({ ...defaults, ...memoryStore });

const storageSet = values => {
  if (storageSync) return new Promise(resolve => storageSync.set(values, resolve));
  Object.assign(memoryStore, values);
  return Promise.resolve();
};

const sendMessage = msg => {
  if (!chromeApi?.runtime?.sendMessage) return Promise.resolve(null);
  return chromeApi.runtime.sendMessage(msg).catch(() => null);
};

const baseDefaults = {
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
  fontColor: '#D1D5DB',
  bgStyle: 'transparent',
  // OpenAI
  apiKey: '',
  translateModel: 'gpt-4o-mini',
  explainModel: 'gpt-4o',
  replyModel: 'gpt-4o',
  // Grok
  grokApiKey: '',
  grokModel: 'grok-3-mini',
  // Gemini
  geminiApiKey: '',
  geminiModel: 'gemini-2.0-flash',
  // Per-feature routing
  translateAiProvider: 'openai',
  explainProvider: 'openai',
  replyProvider: 'openai',
  // Google Translate API
  translationProvider: 'openai',
  googleApiKey: '',
  // Timeline
  autoTranslateTweets: true,
  targetLanguage: 'auto',
  // Personas
  persona: 'default',
  customPersonas: [],
  accountPreferences: {},
  // Token budget
  dailyTokenBudget: 0,
  // MCP
  mcpUrl: '',
  mcpToken: '',
};

const $ = id => document.getElementById(id);

const BUILTIN_PERSONAS = [
  { id: 'default',       label: 'По умолчанию',    hint: 'Нейтральный и взвешенный. Без ярко выраженного характера.',                           builtin: true },
  { id: 'tech_founder',  label: 'Фаундер',          hint: 'Стартап-голос: конкретные цифры, оптимизм, без buzzwords.',                           builtin: true },
  { id: 'engineer',      label: 'Инженер',           hint: 'Точность и лёгкий скептицизм. Замечает подводные камни, требует доказательств.',     builtin: true },
  { id: 'ai_researcher', label: 'AI-исследователь', hint: 'Нюансы и осторожность. Отделяет факты от спекуляций, без хайпа.',                    builtin: true },
  { id: 'casual_tech',   label: 'Свой парень',       hint: 'Тепло и по-человечески. Как сообщение хорошему знакомому.',                          builtin: true },
  { id: 'skeptic',       label: 'Скептик',           hint: 'Ставит всё под сомнение. Ищет слабое место в аргументе. Коротко и прямо.',           builtin: true },
  { id: 'diplomat',      label: 'Дипломат',          hint: 'Находит точки соприкосновения. Смягчает конфликт, показывает разные стороны.',       builtin: true },
  { id: 'flirt',         label: 'Флирт',             hint: 'Игривый и обаятельный, с намёками и юморком. Строго SFW.',                           builtin: true },
  { id: 'troll',         label: 'Тролль 🔥',         hint: 'Хаос ради лулзов. Провоцирует, передёргивает, нагнетает. Для срачей.\n⚡ Рекомендуется Grok — меньше самоцензуры.',  builtin: true },
];

async function loadPersonas() {
  const r = await sendMessage({ type: 'TTA_LIST_PERSONAS' });
  return r?.ok ? r.personas : BUILTIN_PERSONAS;
}

function updatePersonaHint(personaId) {
  const el = $('persona-hint');
  if (!el) return;
  const found = BUILTIN_PERSONAS.find(p => p.id === personaId);
  if (!found?.hint) { el.innerHTML = ''; return; }
  const [main, note] = found.hint.split('\n');
  el.innerHTML = main
    + (note ? `<br><span style="color:#a78bfa;font-weight:500;">${note}</span>` : '');
}

let currentState = null;

async function load() {
  const prefs = await storageGet(baseDefaults);
  currentState = {
    customPersonas: Array.isArray(prefs.customPersonas) ? prefs.customPersonas : [],
    accountPreferences: prefs.accountPreferences && typeof prefs.accountPreferences === 'object'
      ? prefs.accountPreferences : {}
  };

  // OpenAI
  $('apiKey').value = prefs.apiKey || '';
  $('translateModel').value = prefs.translateModel || 'gpt-4o-mini';
  $('explainModel').value = prefs.explainModel || 'gpt-4o';
  $('replyModel').value = prefs.replyModel || 'gpt-4o';
  // Grok
  $('grokApiKey').value = prefs.grokApiKey || '';
  $('grokModel').value = prefs.grokModel || 'grok-3-mini';
  // Gemini
  $('geminiApiKey').value = prefs.geminiApiKey || '';
  $('geminiModel').value = prefs.geminiModel || 'gemini-2.0-flash';
  // Routing
  $('translateAiProvider').value = prefs.translateAiProvider || 'openai';
  $('explainProvider').value = prefs.explainProvider || 'openai';
  $('replyProvider').value = prefs.replyProvider || 'openai';
  // Translation
  $('autoTranslateTweets').checked = !!prefs.autoTranslateTweets;
  const savedLang = prefs.targetLanguage || 'auto';
  $('targetLanguage').value = savedLang;
  if (!$('targetLanguage').value) $('targetLanguage').value = 'auto';
  $('translationProvider').value = prefs.translationProvider || 'openai';
  $('googleApiKey').value = prefs.googleApiKey || '';
  // Appearance
  $('fontFamily').value = prefs.fontFamily;
  $('fontColor').value = prefs.fontColor;
  $('bgStyle').value = prefs.bgStyle || 'transparent';
  // Other
  $('dailyTokenBudget').value = prefs.dailyTokenBudget || 0;
  $('mcpUrl').value = prefs.mcpUrl || '';
  $('mcpToken').value = prefs.mcpToken || '';

  await refreshPersonaUi(prefs.persona);
  updatePersonaHint(prefs.persona);
  renderCustomPersonas();
  renderAccountPrefs();
  await refreshUsage();
  syncFontPicker(prefs.fontFamily);
  updateAppearancePreview();
  syncToggleButtons();
  updateProviderDisplay();
}

async function refreshPersonaUi(selectedPersonaId) {
  const personas = await loadPersonas();
  for (const selectId of ['persona', 'apPersona']) {
    const sel = $(selectId);
    clear(sel);
    for (const { id, label } of personas) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = label;
      sel.appendChild(opt);
    }
  }
  if (selectedPersonaId) $('persona').value = selectedPersonaId;
}

// === Custom personas ===

function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
function emptyHint(parent, text) {
  const div = document.createElement('div');
  div.className = 'hint muted';
  div.textContent = text;
  parent.appendChild(div);
}

function renderCustomPersonas() {
  const list = $('customPersonasList');
  clear(list);
  if (!currentState.customPersonas.length) {
    emptyHint(list, 'No custom personas yet.');
    return;
  }
  for (const p of currentState.customPersonas) {
    const card = document.createElement('div');
    card.className = 'persona-card';
    const head = document.createElement('div');
    head.className = 'persona-card-head';
    const title = document.createElement('strong');
    title.textContent = p.label;
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn';
    del.textContent = 'Delete';
    del.addEventListener('click', () => deleteCustomPersona(p.id));
    head.append(title, del);
    const body = document.createElement('div');
    body.className = 'persona-card-body';
    body.textContent = p.prompt;
    card.append(head, body);
    list.appendChild(card);
  }
}

async function addCustomPersona() {
  const label = $('cpLabel').value.trim();
  const prompt = $('cpPrompt').value.trim();
  if (!label || !prompt) {
    alert('Label and system prompt are both required.');
    return;
  }
  const id = 'custom_' + Date.now().toString(36);
  currentState.customPersonas.push({ id, label, prompt });
  await storageSet({ customPersonas: currentState.customPersonas });
  $('cpLabel').value = '';
  $('cpPrompt').value = '';
  renderCustomPersonas();
  await refreshPersonaUi($('persona').value);
}

async function deleteCustomPersona(id) {
  currentState.customPersonas = currentState.customPersonas.filter(p => p.id !== id);
  // If any per-account rule pointed at this persona, fall back to default
  for (const handle of Object.keys(currentState.accountPreferences)) {
    if (currentState.accountPreferences[handle]?.persona === id) {
      currentState.accountPreferences[handle].persona = 'default';
    }
  }
  await storageSet({
    customPersonas: currentState.customPersonas,
    accountPreferences: currentState.accountPreferences
  });
  renderCustomPersonas();
  renderAccountPrefs();
  await refreshPersonaUi($('persona').value);
}

// === Per-account personas ===

function renderAccountPrefs() {
  const list = $('accountPrefsList');
  clear(list);
  const handles = Object.keys(currentState.accountPreferences);
  if (!handles.length) {
    emptyHint(list, 'No per-account rules yet.');
    return;
  }
  for (const handle of handles) {
    const row = document.createElement('div');
    row.className = 'account-row';
    const h = document.createElement('span');
    h.textContent = handle;
    h.className = 'account-handle';
    const persona = document.createElement('span');
    persona.className = 'account-persona';
    persona.textContent = currentState.accountPreferences[handle]?.persona || 'default';
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn';
    del.textContent = 'Remove';
    del.addEventListener('click', () => deleteAccountPref(handle));
    row.append(h, persona, del);
    list.appendChild(row);
  }
}

async function addAccountPref() {
  let handle = $('apHandle').value.trim().toLowerCase();
  const persona = $('apPersona').value;
  if (!handle) { alert('Enter a handle, e.g. @yourname'); return; }
  if (!handle.startsWith('@')) handle = '@' + handle;
  if (!/^@[a-z0-9_]{1,15}$/.test(handle)) {
    alert('Handle must match @[a-z0-9_]{1,15}');
    return;
  }
  currentState.accountPreferences[handle] = { persona };
  await storageSet({ accountPreferences: currentState.accountPreferences });
  $('apHandle').value = '';
  renderAccountPrefs();
}

async function deleteAccountPref(handle) {
  delete currentState.accountPreferences[handle];
  await storageSet({ accountPreferences: currentState.accountPreferences });
  renderAccountPrefs();
}

// === Token budget ===

async function refreshUsage() {
  const r = await sendMessage({ type: 'TTA_GET_USAGE' });
  const panel = $('usagePanel');
  clear(panel);
  if (!r?.ok) { panel.textContent = 'Usage unavailable.'; return; }
  const total = (r.usage.input || 0) + (r.usage.output || 0);
  const budget = r.budget || 0;
  const parts = [
    `Today (${r.day}) — input `,
    [r.usage.input, 'b'],
    ' + output ',
    [r.usage.output, 'b'],
    ' = ',
    [total, 'b'],
    ` tokens across ${r.usage.calls} calls.`
  ];
  if (budget) {
    parts.push(' Budget ', [budget, 'b'], '; remaining ', [Math.max(0, budget - total), 'b'], '.');
  } else {
    parts.push(' No daily budget set.');
  }
  for (const part of parts) {
    if (Array.isArray(part)) {
      const tag = document.createElement(part[1]);
      tag.textContent = String(part[0]);
      panel.appendChild(tag);
    } else {
      panel.appendChild(document.createTextNode(part));
    }
  }
}

async function resetUsage() {
  await sendMessage({ type: 'TTA_RESET_USAGE' });
  await refreshUsage();
}

// === Health check ===

async function runHealth() {
  const out = $('healthResult');
  out.textContent = 'Running…';
  const r = await sendMessage({ type: 'TTA_HEALTH_CHECK' });
  if (!r?.ok) { out.textContent = 'Health check failed to run.'; return; }
  clear(out);
  const ul = document.createElement('ul');
  ul.className = 'health-list';
  for (const c of r.checks) {
    const li = document.createElement('li');
    li.className = c.ok ? 'health-ok' : 'health-fail';
    li.textContent = (c.ok ? '✅ ' : '❌ ') + c.name + (c.detail ? ' — ' + c.detail : '');
    ul.appendChild(li);
  }
  out.appendChild(ul);
}

// === Save / reset / test ===

async function save() {
  await storageSet({
    // OpenAI
    apiKey: $('apiKey').value.trim(),
    translateModel: $('translateModel').value,
    explainModel: $('explainModel').value,
    replyModel: $('replyModel').value,
    // Grok
    grokApiKey: $('grokApiKey').value.trim(),
    grokModel: $('grokModel').value,
    // Gemini
    geminiApiKey: $('geminiApiKey').value.trim(),
    geminiModel: $('geminiModel').value,
    // Routing
    translateAiProvider: $('translateAiProvider').value,
    explainProvider: $('explainProvider').value,
    replyProvider: $('replyProvider').value,
    // Translation
    autoTranslateTweets: $('autoTranslateTweets').checked,
    targetLanguage: $('targetLanguage').value,
    translationProvider: $('translationProvider').value,
    googleApiKey: $('googleApiKey').value.trim(),
    // Appearance
    fontFamily: $('fontFamily').value,
    fontColor: $('fontColor').value,
    bgStyle: $('bgStyle').value,
    // Personas / budget
    persona: $('persona').value,
    dailyTokenBudget: Math.max(0, parseInt($('dailyTokenBudget').value, 10) || 0),
    // MCP
    mcpUrl: $('mcpUrl').value.trim(),
    mcpToken: $('mcpToken').value.trim(),
  });
  flashSaved();
}

async function reset() {
  await storageSet(baseDefaults);
  await load();
  flashSaved('Reset to defaults');
}

function flashSaved(label = 'Saved') {
  const btn = $('save');
  const prev = btn.textContent;
  btn.textContent = label;
  setTimeout(() => { btn.textContent = prev; }, 1200);
}

function wireAutoTest(inputId, storageKey, resultId, provider) {
  const input = $(inputId);
  const result = $(resultId);
  if (!input || !result) return;
  let timer = null;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const val = input.value.trim();
    if (!val) { result.textContent = ''; return; }
    result.textContent = '…';
    result.style.color = '';
    timer = setTimeout(async () => {
      await storageSet({ [storageKey]: val });
      const r = await sendMessage({ type: 'TTA_TEST_KEY', provider });
      if (!result) return;
      result.textContent = r?.ok ? '✅ OK' : '❌ ' + (r?.error || 'error');
      result.style.color = r?.ok ? 'var(--ok)' : 'var(--bad)';
      updateProviderDisplay();
    }, 700);
  });
}

// === Font picker ===

const FONTS = [
  { label: 'System UI',       value: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial' },
  { label: 'Inter',           value: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial' },
  { label: 'Roboto',          value: 'Roboto, system-ui, -apple-system, Segoe UI, Helvetica, Arial' },
  { label: 'Helvetica / Arial', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Georgia',         value: 'Georgia, serif' },
  { label: 'Courier New',     value: 'Courier New, monospace' },
];

function updateAppearancePreview() {
  const block = $('preview-tta-block');
  if (!block) return;
  const fontFamily = $('fontFamily').value;
  const fontColor  = $('fontColor').value;
  const bgStyle    = $('bgStyle').value;
  block.style.setProperty('--tta-font-family', fontFamily);
  block.style.setProperty('--tta-font-color',  fontColor);
  block.classList.toggle('bg-subtle',      bgStyle === 'subtle');
  block.classList.toggle('bg-transparent', bgStyle !== 'subtle');
}

function syncFontPicker(value) {
  const found = FONTS.find(f => f.value === value) || FONTS[0];
  const cur = $('fontPickerCurrent');
  if (cur) { cur.textContent = found.label; cur.style.fontFamily = found.value; }
  $('fontPickerList')?.querySelectorAll('button').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.value === found.value);
  });
}

function initFontPicker() {
  const trigger = $('fontPickerTrigger');
  const list = $('fontPickerList');
  if (!trigger || !list) return;

  FONTS.forEach(f => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = f.label;
    btn.style.fontFamily = f.value;
    btn.dataset.value = f.value;
    btn.addEventListener('click', () => {
      $('fontFamily').value = f.value;
      syncFontPicker(f.value);
      updateAppearancePreview();
      list.hidden = true;
    });
    list.appendChild(btn);
  });

  trigger.addEventListener('click', e => {
    e.stopPropagation();
    list.hidden = !list.hidden;
  });
  document.addEventListener('click', () => { list.hidden = true; });
}

// === Big-card UI helpers ===

function syncToggleButtons() {
  const translateOn = Boolean($('autoTranslateTweets')?.checked);
  $('toggle-translate')?.classList.toggle('on', translateOn);
  const txExtra = $('translate-extra');
  if (txExtra) txExtra.style.display = translateOn ? '' : 'none';

  const adOn = Boolean($('adEnabled')?.checked);
  $('toggle-ad')?.classList.toggle('on', adOn);
  const adExtra = $('ad-extra');
  if (adExtra) adExtra.style.display = adOn ? '' : 'none';
}

async function updateProviderDisplay() {
  const prefs = await storageGet({ apiKey: '', grokApiKey: '', geminiApiKey: '', replyProvider: 'openai' });
  const keyMap = { openai: prefs.apiKey, grok: prefs.grokApiKey, gemini: prefs.geminiApiKey };
  const nameMap = { openai: 'OpenAI', grok: 'Grok', gemini: 'Gemini' };
  const active = prefs.replyProvider || 'openai';
  const hasKey = Boolean(keyMap[active]);
  const sub = $('card-provider-sub');
  if (!sub) return;
  if (hasKey) {
    sub.textContent = `✓ ${nameMap[active]} подключён`;
    sub.className = 'feat-card-sub ok';
  } else {
    sub.textContent = 'Ключ не введён';
    sub.className = 'feat-card-sub bad';
  }
}

// === Ad Blocker ===

const AD_KEYS = {
  enabled: 'adBlockerEnabled',
  panel: 'adBlockerPanelEnabled',
  removeCompletely: 'removeAdsCompletely',
  chillMode: 'chillModeEnabled',
  count: 'blockedAdsCount',
  last: 'lastBlockedTime'
};

async function loadAdSettings() {
  const store = await new Promise(resolve =>
    chrome.storage.local.get({
      [AD_KEYS.enabled]: false,  // opt-in, disabled by default
      [AD_KEYS.panel]: false,
      [AD_KEYS.removeCompletely]: true,
      [AD_KEYS.chillMode]: false,
      [AD_KEYS.count]: 0,
      [AD_KEYS.last]: null
    }, resolve)
  );
  const adEnabled = $('adEnabled'), adPanel = $('adPanel'), adMode = $('adMode');
  const adCount = $('adCount'), adLast = $('adLast');
  if (adEnabled) adEnabled.checked = Boolean(store[AD_KEYS.enabled]);
  if (adPanel) adPanel.checked = Boolean(store[AD_KEYS.panel]);
  if (adMode) {
    const remove = Boolean(store[AD_KEYS.removeCompletely]);
    const chill = Boolean(store[AD_KEYS.chillMode]);
    adMode.value = remove ? 'remove' : (chill ? 'chill' : 'message');
  }
  if (adCount) adCount.textContent = String(store[AD_KEYS.count] || 0);
  if (adLast) adLast.textContent = store[AD_KEYS.last] ? new Date(store[AD_KEYS.last]).toLocaleString() : '—';
  syncToggleButtons();
}

async function sendToAllXTabs(message) {
  try {
    const tabs = await chrome.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] });
    await Promise.all((tabs || []).map(t => chrome.tabs.sendMessage(t.id, message).catch(() => {})));
  } catch (_) {}
}

async function saveAdSettings() {
  const enabled = Boolean($('adEnabled')?.checked);
  const panel = Boolean($('adPanel')?.checked);
  const mode = String($('adMode')?.value || 'remove');
  const removeCompletely = mode === 'remove';
  const chillMode = mode === 'chill';
  await new Promise(resolve =>
    chrome.storage.local.set({
      [AD_KEYS.enabled]: enabled,
      [AD_KEYS.panel]: panel,
      [AD_KEYS.removeCompletely]: removeCompletely,
      [AD_KEYS.chillMode]: chillMode
    }, resolve)
  );
  await sendToAllXTabs({ type: 'TTA_ADBLOCK', name: 'TOGGLE_ENABLED', enabled });
  await sendToAllXTabs({ type: 'TTA_ADBLOCK', name: 'TOGGLE_PANEL', visible: panel });
  await sendToAllXTabs({ type: 'TTA_ADBLOCK', name: 'UPDATE_SETTINGS', removeCompletely, chillMode });
  const btn = $('adSave');
  if (btn) { btn.textContent = 'Saved'; setTimeout(() => { btn.textContent = 'Save'; }, 1000); }
}

async function forceRefreshAds() {
  await sendToAllXTabs({ type: 'TTA_ADBLOCK', name: 'FORCE_REFRESH' });
  setTimeout(loadAdSettings, 500);
}

document.addEventListener('DOMContentLoaded', () => {
  load();
  $('save').addEventListener('click', save);
  $('reset').addEventListener('click', reset);
  wireAutoTest('apiKey', 'apiKey', 'testResult', 'openai');
  wireAutoTest('grokApiKey', 'grokApiKey', 'testGrokResult', 'grok');
  wireAutoTest('geminiApiKey', 'geminiApiKey', 'testGeminiResult', 'gemini');

  // Provider card toggle
  $('provider-toggle-btn')?.addEventListener('click', () => {
    const edit = $('provider-edit');
    const isOpen = edit.style.display !== 'none';
    edit.style.display = isOpen ? 'none' : '';
    $('provider-toggle-btn').textContent = isOpen ? 'Настроить' : 'Готово';
    if (isOpen) updateProviderDisplay();
  });

  // Translate big toggle
  $('toggle-translate')?.addEventListener('click', () => {
    const cb = $('autoTranslateTweets');
    cb.checked = !cb.checked;
    syncToggleButtons();
    save();
  });

  // Ad big toggle
  $('toggle-ad')?.addEventListener('click', () => {
    const cb = $('adEnabled');
    cb.checked = !cb.checked;
    syncToggleButtons();
    saveAdSettings();
  });

  // Provider tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.provider-tab').forEach(p => p.classList.toggle('active', p.id === 'ptab-' + tab));
    });
  });
  initFontPicker();
  $('fontColor')?.addEventListener('input', updateAppearancePreview);
  $('bgStyle')?.addEventListener('change', updateAppearancePreview);
  $('persona')?.addEventListener('change', () => updatePersonaHint($('persona').value));
  $('cpAdd').addEventListener('click', addCustomPersona);
  $('apAdd').addEventListener('click', addAccountPref);
  $('usageReset').addEventListener('click', resetUsage);
  $('healthRun').addEventListener('click', runHealth);

  // MCP gateway
  $('mcpTest')?.addEventListener('click', async () => {
    const el = $('mcpStatus');
    el.textContent = 'Testing…';
    const r = await sendMessage({ type: 'TTA_MCP_STATUS' });
    if (r?.ok) {
      el.textContent = `✅ Online — configured: ${r.configured}`;
      el.style.color = 'var(--ok)';
    } else {
      el.textContent = `❌ Offline (${r?.code || 'no response'}) — save URL first, then test`;
      el.style.color = 'var(--bad)';
    }
  });

  // Ad blocker — show ToS warning when user tries to enable
  loadAdSettings();
  $('adEnabled')?.addEventListener('change', function () {
    $('adTosWarn').style.display = this.checked ? 'block' : 'none';
  });
  $('adSave')?.addEventListener('click', saveAdSettings);
  $('adRefresh')?.addEventListener('click', forceRefreshAds);

  // Live counter update while options page is open
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (AD_KEYS.count in changes) $('adCount').textContent = String(changes[AD_KEYS.count].newValue || 0);
      if (AD_KEYS.last in changes && changes[AD_KEYS.last].newValue) $('adLast').textContent = new Date(changes[AD_KEYS.last].newValue).toLocaleString();
    });
  } catch (_) {}

  initOnboarding();
});

// ── Onboarding ─────────────────────────────────────────────────────────────

const OB_KEY_LINKS = {
  openai: 'https://platform.openai.com/api-keys',
  grok:   'https://console.x.ai',
  gemini: 'https://aistudio.google.com/app/apikey'
};

const OB_KEY_PLACEHOLDERS = {
  openai: 'sk-…',
  grok:   'xai-…',
  gemini: 'AIza…'
};

const OB_STORAGE_KEYS = {
  openai: 'apiKey',
  grok:   'grokApiKey',
  gemini: 'geminiApiKey'
};

async function initOnboarding() {
  let done = false;
  try {
    const r = await storageGet({ onboardingDone: false });
    done = Boolean(r.onboardingDone);
  } catch (_) {}
  if (done) return;

  const overlay = $('tta-onboarding');
  if (!overlay) return;
  overlay.style.display = 'flex';

  let selectedProvider = null;
  let keyOk = false;
  let obTimer = null;

  function setStep(n) {
    [1, 2, 3].forEach(i => {
      $(`ob-pane-${i}`).style.display = i === n ? '' : 'none';
      const dot = $(`ob-dot-${i}`);
      dot.classList.toggle('active', i === n);
      dot.classList.toggle('done', i < n);
    });
  }

  // Provider card selection
  overlay.querySelectorAll('.ob-provider-card').forEach(card => {
    card.addEventListener('click', () => {
      overlay.querySelectorAll('.ob-provider-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      card.querySelector('input[type=radio]').checked = true;
      selectedProvider = card.dataset.provider;

      const keyRow = $('ob-key-row');
      keyRow.style.display = '';
      $('ob-get-key').href = OB_KEY_LINKS[selectedProvider];
      $('ob-apiKey').placeholder = OB_KEY_PLACEHOLDERS[selectedProvider];
      $('ob-apiKey').value = '';
      $('ob-key-status').textContent = '';
      keyOk = false;
      $('ob-next-1').disabled = true;
    });
  });

  // Auto-test on key input
  $('ob-apiKey').addEventListener('input', () => {
    clearTimeout(obTimer);
    const val = $('ob-apiKey').value.trim();
    const status = $('ob-key-status');
    $('ob-next-1').disabled = !val;
    if (!val) { status.textContent = ''; keyOk = false; return; }
    status.textContent = '…';
    status.style.color = '';
    obTimer = setTimeout(async () => {
      const storKey = OB_STORAGE_KEYS[selectedProvider];
      await storageSet({ [storKey]: val });
      const r = await sendMessage({ type: 'TTA_TEST_KEY', provider: selectedProvider });
      keyOk = Boolean(r?.ok);
      status.textContent = keyOk ? '✅ Ключ работает' : '❌ ' + (r?.error || 'Неверный ключ');
      status.style.color = keyOk ? 'var(--ok)' : 'var(--bad)';
      $('ob-next-1').disabled = !val;
    }, 700);
  });

  $('ob-skip').addEventListener('click', async () => {
    await storageSet({ onboardingDone: true });
    overlay.style.display = 'none';
  });

  $('ob-next-1').addEventListener('click', () => setStep(2));

  $('ob-back-2').addEventListener('click', () => setStep(1));

  $('ob-next-2').addEventListener('click', async () => {
    const lang = $('ob-lang').value;
    await storageSet({ targetLanguage: lang });
    if ($('targetLanguage')) $('targetLanguage').value = lang;

    const providerLabel = { openai: 'OpenAI', grok: 'Grok (xAI)', gemini: 'Google Gemini' }[selectedProvider] || selectedProvider;
    const langLabel = $('ob-lang').options[$('ob-lang').selectedIndex]?.text || lang;
    $('ob-summary').textContent =
      `Провайдер: ${providerLabel}. Язык перевода: ${langLabel}. ` +
      `Все три фичи (перевод, объяснение, ответы) направлены на выбранный провайдер.`;

    if (selectedProvider) {
      await storageSet({
        translateAiProvider: selectedProvider,
        explainProvider:     selectedProvider,
        replyProvider:       selectedProvider
      });
      if ($('translateAiProvider')) $('translateAiProvider').value = selectedProvider;
      if ($('explainProvider'))     $('explainProvider').value     = selectedProvider;
      if ($('replyProvider'))       $('replyProvider').value       = selectedProvider;
    }

    setStep(3);
  });

  $('ob-finish').addEventListener('click', async () => {
    await storageSet({ onboardingDone: true });
    overlay.style.display = 'none';
    await load();
  });
}

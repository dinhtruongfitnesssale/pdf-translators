'use strict';
// Lưu cài đặt + ô chọn Model (hộp chọn tự làm).
// Script thường (không phải module): dùng chung phạm vi toàn cục với các file khác,
// thứ tự nạp nằm trong index.html.

// ---------- Settings persistence ----------
const SETTINGS_KEY = 'ptr.settings';
function loadSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch {}
  providerEl.value = s.provider || 'gemini';
  rememberEl.checked = !!s.rememberKey;
  if (s.rememberKey && s.apiKey) apiKeyEl.value = s.apiKey;
  applyModelSuggest(s.model);
  if (s.skill) skillEl.dataset.want = s.skill;
}
function saveSettings() {
  const s = {
    provider: providerEl.value,
    model: modelEl.value.trim(),
    skill: skillEl.value,
    rememberKey: rememberEl.checked,
    apiKey: rememberEl.checked ? apiKeyEl.value : '',
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}
// Model đã bị gỡ -> tên thay thế, để cài đặt cũ lưu trong máy không làm hỏng bản dịch.
const RETIRED_MODELS = {
  'gemini-2.0-flash': 'gemini-3.6-flash',
  'gemini-2.0-flash-001': 'gemini-3.6-flash',
  'gemini-2.0-flash-lite': 'gemini-3.5-flash-lite',
  'gemini-1.5-flash': 'gemini-3.5-flash-lite',
  'gemini-1.5-flash-8b': 'gemini-3.5-flash-lite',
  'gemini-1.5-pro': 'gemini-3.7-flash',
  // Claude đời cũ còn chạy nhưng đã có bản mới hơn (rẻ hơn) cùng dòng → tự lên đời.
  'claude-opus-4-8': 'claude-opus-5-5',
  'claude-opus-4-7': 'claude-opus-5-5',
  'claude-opus-5': 'claude-opus-5-5',
  'claude-sonnet-5': 'claude-sonnet-5-5',
  'claude-sonnet-4-6': 'claude-sonnet-5-5',
  'claude-haiku-4-5': 'claude-haiku-5-5',
};
const migrateModel = (m) => RETIRED_MODELS[String(m || '').trim()] || m;

// ---------- Ô Model: hộp chọn tự làm ----------
// Trước đây ô này dùng <datalist>: trình duyệt lọc gợi ý theo chữ đang có trong ô,
// mà ô luôn chứa sẵn tên model đầy đủ nên bấm mũi tên chẳng ra gì. Nay tự vẽ menu.
let modelOptions = [];
let modelActive = -1;

function renderModelMenu() {
  const cur = modelEl.value.trim();
  if (!modelOptions.length) {
    modelMenuEl.innerHTML = '<li class="combo-empty">Chưa có danh sách model — nhập tên model vào ô.</li>';
    return;
  }
  modelMenuEl.innerHTML = modelOptions
    .map((m, i) => `<li role="option" data-i="${i}" aria-selected="${m === cur}" title="${m}">${m}</li>`)
    .join('');
  modelActive = modelOptions.indexOf(cur);
  highlightModelItem();
}

function highlightModelItem() {
  const items = [...modelMenuEl.querySelectorAll('li[data-i]')];
  items.forEach((li, i) => li.classList.toggle('active', i === modelActive));
  if (modelActive >= 0 && items[modelActive]) items[modelActive].scrollIntoView({ block: 'nearest' });
}

function openModelMenu() {
  renderModelMenu();
  modelMenuEl.hidden = false;
  modelComboEl.classList.add('open');
  modelEl.setAttribute('aria-expanded', 'true');
}

function closeModelMenu() {
  modelMenuEl.hidden = true;
  modelComboEl.classList.remove('open');
  modelEl.setAttribute('aria-expanded', 'false');
  modelActive = -1;
}

function pickModel(i) {
  const m = modelOptions[i];
  if (!m) return;
  modelEl.value = m;
  saveSettings();
  closeModelMenu();
}

modelArrowEl.addEventListener('mousedown', (e) => e.preventDefault()); // giữ con trỏ trong ô
modelArrowEl.addEventListener('click', () => {
  if (modelMenuEl.hidden) { openModelMenu(); modelEl.focus(); } else closeModelMenu();
});
modelMenuEl.addEventListener('mousedown', (e) => e.preventDefault());
modelMenuEl.addEventListener('click', (e) => {
  const li = e.target.closest('li[data-i]');
  if (li) pickModel(Number(li.dataset.i));
});
modelEl.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (modelMenuEl.hidden) { openModelMenu(); return; }
    if (!modelOptions.length) return;
    const step = e.key === 'ArrowDown' ? 1 : -1;
    modelActive = (modelActive + step + modelOptions.length) % modelOptions.length;
    highlightModelItem();
  } else if (e.key === 'Enter') {
    if (!modelMenuEl.hidden && modelActive >= 0) { e.preventDefault(); pickModel(modelActive); }
  } else if (e.key === 'Escape') {
    if (!modelMenuEl.hidden) { e.stopPropagation(); closeModelMenu(); }
  }
});
modelEl.addEventListener('blur', closeModelMenu);
document.addEventListener('click', (e) => {
  if (!modelMenuEl.hidden && !modelComboEl.contains(e.target)) closeModelMenu();
});

function applyModelSuggest(preferred) {
  const list = MODEL_SUGGEST[providerEl.value] || [];
  const want = migrateModel(preferred);
  modelOptions = list.slice();
  if (want && (list.includes(want) || want.length)) modelEl.value = want;
  else modelEl.value = list[0] || '';
}

// Hỏi thẳng Google / Anthropic xem key này dùng được model nào, rồi thay danh sách gợi ý.
// Nhờ vậy mỗi lần nhà cung cấp đổi đời model, người dùng không phải chờ cập nhật ứng dụng.
let modelFetchKey = '';
async function refreshModelList() {
  const apiKey = apiKeyEl.value.trim();
  const provider = providerEl.value;
  const fetchKey = provider + ':' + apiKey;
  if ((provider !== 'gemini' && provider !== 'claude') || !apiKey || fetchKey === modelFetchKey) return;
  modelFetchKey = fetchKey;
  try {
    const r = await fetch('/api/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, apiKey }),
    });
    const data = await r.json();
    if (!r.ok || !Array.isArray(data.models) || !data.models.length) return;
    if (providerEl.value !== provider) return; // người dùng đã đổi nhà cung cấp trong lúc chờ
    MODEL_SUGGEST[provider] = data.models;
    const cur = modelEl.value.trim();
    modelOptions = data.models.slice();
    if (!modelMenuEl.hidden) renderModelMenu();
    if (!cur || !data.models.includes(cur)) {
      modelEl.value = data.models.includes(data.default) ? data.default : data.models[0];
      saveSettings();
    }
  } catch {
    modelFetchKey = ''; // mạng lỗi thì cho thử lại lần sau
  }
}

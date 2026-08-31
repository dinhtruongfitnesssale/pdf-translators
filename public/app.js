import '/vendor/pdfjs/compat.mjs';
import * as pdfjsLib from '/vendor/pdfjs/pdf.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.entry.mjs';

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const providerEl = $('provider');
const apiKeyEl = $('apiKey');
const modelEl = $('model');
const modelComboEl = $('modelCombo');
const modelArrowEl = $('modelArrow');
const modelMenuEl = $('modelMenu');
const skillEl = $('skill');
const rememberEl = $('rememberKey');
const toggleKeyEl = $('toggleKey');
const fileInput = $('fileInput');
const openBtn = $('openBtn');
const translateBtn = $('translateBtn');
const exportBtn = $('exportBtn');
const closeBtn = $('closeBtn');
const viewmodeEl = $('viewmode');
const readmodeEl = $('readmode');
const overlayEl = $('overlay');
const bookEl = $('book');
const bookStage = $('bookStage');
const bookLeftCanvas = $('bookLeft');
const bookRightCanvas = $('bookRight');
const bookTextLeft = $('bookTextLeft');
const bookTextRight = $('bookTextRight');
const bookMsg = $('bookMsg');
const bookPrevBtn = $('bookPrev');
const bookNextBtn = $('bookNext');

// Phần tử ẩn để đo chiều cao chữ khi dàn trang bản dịch
const measEl = document.createElement('div');
measEl.setAttribute('aria-hidden', 'true');
measEl.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;white-space:pre-wrap;word-break:break-word;box-sizing:border-box;';
document.body.appendChild(measEl);
const zoomInBtn = $('zoomIn');
const zoomOutBtn = $('zoomOut');
const zoomLevelEl = $('zoomLevel');
const pageInput = $('pageInput');
const pageTotalEl = $('pageTotal');
const expandBtn = $('expandBtn');
const bookExitBtn = $('bookExit');
const statusEl = $('status');
const emptyEl = $('empty');
const pagesEl = $('pages');
const keyhintEl = $('keyhint');
const libraryEl = $('library');
const topbarEl = document.querySelector('.topbar');
const menuToggle = $('menuToggle');
const expandBtnM = $('expandBtnM');
// Modal chọn phạm vi
const modalEl = $('modal');
const modalTotalEl = $('modalTotal');
const rangeFromEl = $('rangeFrom');
const rangeToEl = $('rangeTo');
const rangeAllEl = $('rangeAll');
const modalHintEl = $('modalHint');
const modalGoBtn = $('modalGo');
const modalCancelBtn = $('modalCancel');
// Sao lưu / khôi phục
const backupBtn = $('backupBtn');
const restoreBtn = $('restoreBtn');
const restoreInput = $('restoreInput');
const backupModalEl = $('backupModal');
const backupSummaryEl = $('backupSummary');
const backupHintEl = $('backupHint');
const bkKeyEl = $('bkKey');
const bkPdfEl = $('bkPdf');
const backupGoBtn = $('backupGo');
const backupCancelBtn = $('backupCancel');
// Ngăn kéo Bookmark · Highlight · Ghi chú
const drawerEl = $('drawer');
const drawerBtn = $('drawerBtn');
// Tìm chữ
const findBtn = $('findBtn');
const findInput = $('findInput');
const findPrevBtn = $('findPrev');
const findNextBtn = $('findNext');
const findScopeEl = $('findScope');
const findStatEl = $('findStat');
const findListEl = $('findList');
const drawerCloseBtn = $('drawerClose');
const drawerWideBtn = $('drawerWide');
const hlBtn = $('hlBtn');
const hlToggleBtn = $('hlToggle');
const hlSwatchesEl = $('hlSwatches');
const bmAddBtn = $('bmAdd');
const bmListEl = $('bmList');
const hlListEl = $('hlList');
const selbarEl = $('selbar');
const noteScopeEl = $('noteScope');
const noteFollowBtn = $('noteFollow');
const chapAddBtn = $('chapAdd');
const chapRenBtn = $('chapRen');
const chapDelBtn = $('chapDel');
const noteReviewBtn = $('noteReview');
const noteSynthBtn = $('noteSynth');
const noteAIBtn = $('noteAI');
const noteMdBtn = $('noteMd');
const notePdfBtn = $('notePdf');
const noteStatEl = $('noteStat');
const cornellEl = $('cornell');
const cwEls = { cue: $('cwCue'), note: $('cwNote'), sum: $('cwSum') };
// Modal nhập một dòng
const promptEl = $('promptModal');
const promptEyebrowEl = $('promptEyebrow');
const promptTitleEl = $('promptTitle');
const promptLabelEl = $('promptLabel');
const promptInputEl = $('promptInput');
const promptOkBtn = $('promptOk');
const promptCancelBtn = $('promptCancel');
// Modal xác nhận (dùng chung)
const confirmEl = $('confirmModal');
const confirmEyebrowEl = $('confirmEyebrow');
const confirmTitleEl = $('confirmTitle');
const confirmMsgEl = $('confirmMsg');
const confirmOkBtn = $('confirmOk');
const confirmCancelBtn = $('confirmCancel');

// Hộp xác nhận theo bộ thương hiệu, thay cho confirm() mặc định của trình duyệt.
// Trả về Promise<boolean>. Đóng bằng Esc / bấm nền = Hủy.
function confirmDialog({ title, message = '', eyebrow = 'XÁC NHẬN', okText = 'Xóa', cancelText = 'Hủy', danger = true } = {}) {
  confirmEyebrowEl.textContent = eyebrow;
  confirmTitleEl.textContent = title;
  confirmMsgEl.textContent = message;
  confirmMsgEl.hidden = !message;
  confirmOkBtn.textContent = okText;
  confirmCancelBtn.textContent = cancelText;
  confirmOkBtn.className = danger ? 'btn btn-danger' : 'btn btn-primary';
  confirmEl.hidden = false;
  confirmOkBtn.focus();

  return new Promise((resolve) => {
    function cleanup(result) {
      confirmEl.hidden = true;
      confirmOkBtn.removeEventListener('click', onOk);
      confirmCancelBtn.removeEventListener('click', onCancel);
      confirmEl.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    function onBackdrop(e) { if (e.target === confirmEl) cleanup(false); }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); cleanup(false); }
      else if (e.key === 'Enter') { e.preventDefault(); cleanup(true); }
    }
    confirmOkBtn.addEventListener('click', onOk);
    confirmCancelBtn.addEventListener('click', onCancel);
    confirmEl.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey);
  });
}

// Hộp nhập một dòng (đặt tên chương…). Trả về Promise<string|null> — null = hủy.
function promptDialog({ title, label = 'Nội dung', value = '', eyebrow = 'NHẬP', okText = 'Xong' } = {}) {
  promptEyebrowEl.textContent = eyebrow;
  promptTitleEl.textContent = title;
  promptLabelEl.textContent = label;
  promptInputEl.value = value;
  promptOkBtn.textContent = okText;
  promptEl.hidden = false;
  promptInputEl.focus();
  promptInputEl.select();

  return new Promise((resolve) => {
    function cleanup(result) {
      promptEl.hidden = true;
      promptOkBtn.removeEventListener('click', onOk);
      promptCancelBtn.removeEventListener('click', onCancel);
      promptEl.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    }
    function onOk() { cleanup(promptInputEl.value.trim()); }
    function onCancel() { cleanup(null); }
    function onBackdrop(e) { if (e.target === promptEl) cleanup(null); }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); cleanup(null); }
      else if (e.key === 'Enter') { e.preventDefault(); cleanup(promptInputEl.value.trim()); }
    }
    promptOkBtn.addEventListener('click', onOk);
    promptCancelBtn.addEventListener('click', onCancel);
    promptEl.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey);
  });
}

// Đừng để trình duyệt tự khôi phục cuộn (nó reset về 0 và cãi với code của mình)
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

// ---------- State ----------
const MODEL_SUGGEST = {
  gemini: ['gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-pro'],
  claude: ['claude-opus-4-8', 'claude-haiku-4-5', 'claude-sonnet-5'],
};
let docId = null;
let docTitle = 'ban-dich';
let pdfDoc = null;
let viewMode = 'both'; // 'both' | 'trans' | 'orig' | 'overlay'
let readMode = 'scroll'; // 'scroll' | 'book'
let bookIndex = 0; // trang bên trái (0-based) ở chế độ Đọc sách
let transPages = []; // bản dịch đã dàn thành từng trang (chuỗi)
let transSig = ''; // chữ ký để cache kết quả dàn trang
let zoom = 1; // 0.5 – 3
const pages = []; // { index, pageNum, canvas, origEl, transEl, sourceText, editor, statEl, aspect, rendered }
let renderObserver = null; // vẽ canvas trễ khi trang cuộn tới gần khung nhìn
// Chế độ "Đè trang": mỗi trang ghép bản gốc + chữ Việt đè đúng vị trí khối gốc.
const overlayPages = []; // { pageNum, el, canvas, statEl, ext, translated, trHash, composed, composing, sig }
let overlayObserver = null;

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

// Hỏi thẳng Google xem key này còn dùng được model nào, rồi thay danh sách gợi ý.
// Nhờ vậy mỗi lần Google đổi đời model, người dùng không phải chờ cập nhật ứng dụng.
let modelFetchKey = '';
async function refreshModelList() {
  const apiKey = apiKeyEl.value.trim();
  if (providerEl.value !== 'gemini' || !apiKey || apiKey === modelFetchKey) return;
  modelFetchKey = apiKey;
  try {
    const r = await fetch('/api/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'gemini', apiKey }),
    });
    const data = await r.json();
    if (!r.ok || !Array.isArray(data.models) || !data.models.length) return;
    MODEL_SUGGEST.gemini = data.models;
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

// ---------- Translations persistence (per document) ----------
const trKey = (id) => `ptr.tr.${id}`;
function loadTranslations(id) {
  try { return JSON.parse(localStorage.getItem(trKey(id)) || '{}'); } catch { return {}; }
}
function saveTranslation(id, idx, value) {
  const all = loadTranslations(id);
  all[idx] = value;
  try {
    localStorage.setItem(trKey(id), JSON.stringify(all));
    return true;
  } catch (e) {
    setStatus('Không lưu được: bộ nhớ trình duyệt đã đầy (ảnh chèn quá nặng). Hãy xoá bớt ảnh hoặc gỡ bớt tài liệu.', 'error');
    return false;
  }
}

// ---------- Mô hình khối bản dịch (chữ + ảnh, theo thứ tự) ----------
// Mỗi trang bản dịch là một danh sách khối:
//   { type:'text', text }            — một đoạn chữ có thể chỉnh sửa
//   { type:'image', src, w, h }      — một ảnh (data URL) chèn giữa các đoạn
// Lưu gọn: trang chỉ có 1 khối chữ vẫn lưu dạng chuỗi (tương thích bản cũ).
function normalizeBlocks(saved) {
  if (saved == null) return [{ type: 'text', text: '' }];
  if (typeof saved === 'string') return [{ type: 'text', text: saved }];
  if (Array.isArray(saved)) {
    const out = [];
    for (const b of saved) {
      if (!b) continue;
      if (b.type === 'image' && b.src) out.push({ type: 'image', src: b.src, w: b.w || 0, h: b.h || 0, widthPct: b.widthPct || 1 });
      else if (b.type === 'text') out.push({ type: 'text', text: String(b.text || '') });
    }
    return out.length ? out : [{ type: 'text', text: '' }];
  }
  return [{ type: 'text', text: '' }];
}
function serializeBlocks(blocks) {
  if (blocks.length === 1 && blocks[0].type === 'text') return blocks[0].text; // gọn + hợp bản cũ
  return blocks;
}
function entryPlainText(entry) {
  return entry.blocks.filter((b) => b.type === 'text')
    .map((b) => (b.text || '').trim()).filter(Boolean).join('\n\n');
}
function entryHasContent(entry) {
  return entry.blocks.some((b) => (b.type === 'text' && b.text.trim()) || b.type === 'image');
}
function savePageTranslation(entry) {
  return saveTranslation(docId, entry.index, serializeBlocks(entry.blocks));
}

// Đặt kết quả dịch vào KHỐI CHỮ đầu tiên (giữ nguyên ảnh/khối đã chèn tay).
function setEntryTranslation(entry, text) {
  const first = entry.blocks.find((b) => b.type === 'text');
  if (first) first.text = text;
  else entry.blocks.unshift({ type: 'text', text });
  // Dịch lại = thay sạch nội dung → neo lại vệt bôi cũ (không tìm thấy thì bỏ)
  reanchorText(entry.index, entry.blocks.findIndex((b) => b.type === 'text'));
  renderBlocks(entry);
  savePageTranslation(entry);
}

// Dựng lại DOM các khối cho một trang (gọi khi thêm/xoá/đổi thứ tự khối).
// Chỉnh chữ chỉ cập nhật mô hình, KHÔNG dựng lại (giữ con trỏ nhập).
function renderBlocks(entry) {
  const wrap = entry.blocksEl;
  wrap.innerHTML = '';
  entry.blocks.forEach((block, k) => {
    const row = document.createElement('div');
    row.className = 'block block-' + block.type;
    if (block.type === 'text') {
      const ed = document.createElement('div');
      ed.className = 'editor';
      ed.contentEditable = 'true';
      ed.spellcheck = false;
      ed.textContent = block.text || '';
      // Neo cho highlight: mỗi ô chữ được xác định bằng (trang, thứ tự khối)
      ed.dataset.p = String(entry.index);
      ed.dataset.b = String(k);
      ed.addEventListener('input', () => {
        block.text = ed.textContent;
        savePageTranslation(entry);
      });
      // Sửa chữ làm lệch vị trí highlight → neo lại khi rời ô, rồi vẽ lại vệt màu.
      // (Không vẽ lại trong lúc gõ để khỏi mất con trỏ nhập.)
      ed.addEventListener('blur', () => { reanchorText(entry.index, k); paintEditor(ed); });
      row.appendChild(ed);
      paintEditor(ed);
    } else {
      const holder = document.createElement('div');
      holder.className = 'block-img-wrap';
      holder.style.width = (clampPct(block.widthPct) * 100) + '%';
      const img = document.createElement('img');
      img.className = 'block-img';
      img.src = block.src;
      img.alt = 'Ảnh chèn';
      img.draggable = false;
      const handle = document.createElement('span');
      handle.className = 'img-resize';
      handle.title = 'Kéo để đổi kích cỡ ảnh';
      holder.append(img, handle);
      attachImageResize(handle, holder, entry, block);
      row.appendChild(holder);
    }
    row.appendChild(buildBlockControls(entry, k));
    wrap.appendChild(row);
  });
}

function clampPct(p) { return Math.min(1, Math.max(0.1, Number(p) || 1)); }

// Kéo góc phải-dưới của ảnh để đổi kích cỡ (lưu theo % bề rộng cột → nhất quán
// giữa lúc soạn, lúc đọc sách và lúc xuất PDF).
function attachImageResize(handle, holder, entry, block) {
  let startX = 0, rowW = 1, startW = 0, dragging = false;
  const onMove = (e) => {
    if (!dragging) return;
    const pct = clampPct((startW + (e.clientX - startX)) / rowW);
    holder.style.width = (pct * 100) + '%';
    block.widthPct = pct;
    e.preventDefault();
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    savePageTranslation(entry);
  };
  handle.addEventListener('pointerdown', (e) => {
    dragging = true;
    startX = e.clientX;
    const row = holder.closest('.block');
    rowW = (row ? row.clientWidth : holder.parentElement.clientWidth) || 1;
    startW = holder.offsetWidth;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    e.preventDefault();
  });
}
function stepImgWidth(entry, k, d) {
  const b = entry.blocks[k];
  if (!b || b.type !== 'image') return;
  b.widthPct = clampPct((b.widthPct || 1) + d);
  renderBlocks(entry);
  savePageTranslation(entry);
}

function buildBlockControls(entry, k) {
  const bar = document.createElement('div');
  bar.className = 'block-ctrls';
  const mk = (label, title, fn, cls) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bc' + (cls ? ' ' + cls : '');
    b.textContent = label;
    b.title = title;
    b.addEventListener('click', fn);
    return b;
  };
  const isImg = entry.blocks[k] && entry.blocks[k].type === 'image';
  if (isImg) bar.append(
    mk('Ảnh nhỏ', 'Thu nhỏ ảnh', () => stepImgWidth(entry, k, -0.1)),
    mk('Ảnh to', 'Phóng to ảnh', () => stepImgWidth(entry, k, 0.1)),
  );
  bar.append(
    mk('＋ Ảnh', 'Chèn ảnh ngay dưới khối này', () => insertImageAfter(entry, k)),
    mk('＋ Chữ', 'Thêm ô chữ ngay dưới khối này', () => insertTextAfter(entry, k)),
    mk('↑', 'Đưa khối lên', () => moveBlock(entry, k, -1)),
    mk('↓', 'Đưa khối xuống', () => moveBlock(entry, k, 1)),
    mk('✕', 'Xoá khối này', () => removeBlock(entry, k), 'bc-del'),
  );
  return bar;
}

function insertTextAfter(entry, k) {
  entry.blocks.splice(k + 1, 0, { type: 'text', text: '' });
  shiftTextHls(entry.index, 'insert', k + 1);
  renderBlocks(entry);
  savePageTranslation(entry);
  const row = entry.blocksEl.children[k + 1];
  const ed = row && row.querySelector('.editor');
  if (ed) ed.focus();
}

function moveBlock(entry, k, dir) {
  const j = k + dir;
  if (j < 0 || j >= entry.blocks.length) return;
  const t = entry.blocks[k];
  entry.blocks[k] = entry.blocks[j];
  entry.blocks[j] = t;
  shiftTextHls(entry.index, 'swap', [k, j]);
  renderBlocks(entry);
  savePageTranslation(entry);
}

async function removeBlock(entry, k) {
  const block = entry.blocks[k];
  if (block && block.type === 'image') {
    const ok = await confirmDialog({
      eyebrow: 'XOÁ ẢNH',
      title: 'Xoá ảnh đã chèn?',
      message: 'Ảnh này sẽ bị gỡ khỏi bản dịch của trang.',
      okText: 'Xoá ảnh', cancelText: 'Giữ lại',
    });
    if (!ok) return;
  }
  if (entry.blocks.length <= 1) entry.blocks = [{ type: 'text', text: '' }];
  else entry.blocks.splice(k, 1);
  shiftTextHls(entry.index, 'remove', k);
  renderBlocks(entry);
  savePageTranslation(entry);
}

// Chọn ảnh từ máy → nén lại (tối đa 1600px, nền trắng, JPEG) cho nhẹ bộ nhớ.
function pickImageFile() {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.addEventListener('change', () => resolve((inp.files && inp.files[0]) || null), { once: true });
    inp.click();
  });
}
function fileToImageBlock(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error || new Error('Không đọc được ảnh'));
    fr.onload = () => {
      const im = new Image();
      im.onerror = () => reject(new Error('Ảnh lỗi hoặc không hỗ trợ'));
      im.onload = () => {
        const MAX = 1600;
        const scale = Math.min(1, MAX / Math.max(im.naturalWidth, im.naturalHeight));
        const w = Math.max(1, Math.round(im.naturalWidth * scale));
        const h = Math.max(1, Math.round(im.naturalHeight * scale));
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#ffffff';           // nền trắng phòng ảnh PNG trong suốt
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(im, 0, 0, w, h);
        resolve({ type: 'image', src: cv.toDataURL('image/jpeg', 0.82), w, h });
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
async function insertImageAfter(entry, k) {
  const file = await pickImageFile();
  if (!file) return;
  setPageStat(entry.statEl, 'đang xử lý ảnh…', 'working');
  try {
    const block = await fileToImageBlock(file);
    entry.blocks.splice(k + 1, 0, block);
    shiftTextHls(entry.index, 'insert', k + 1);
    renderBlocks(entry);
    if (savePageTranslation(entry)) setPageStat(entry.statEl, 'đã chèn ảnh', 'done');
  } catch (err) {
    setPageStat(entry.statEl, 'lỗi ảnh', 'error');
    setStatus('Không chèn được ảnh: ' + err.message, 'error');
  }
}

// ---------- Last-opened PDF (IndexedDB) + scroll position ----------
const IDB_NAME = 'ptr';
const IDB_STORE = 'docs';
function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(IDB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbSet(key, val) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(val, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const rq = tx.objectStore(IDB_STORE).get(key);
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}
async function idbDel(key) {
  const db = await idbOpen();
  return new Promise((res) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => res();
    tx.onerror = () => res();
  });
}

// Xin trình duyệt KHÔNG tự xóa dữ liệu khi máy thiếu bộ nhớ.
// Sau khi được cấp, IndexedDB/localStorage chỉ mất khi người dùng chủ động xóa.
async function requestPersistentStorage() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return;
    if (await navigator.storage.persisted()) return; // đã bền sẵn
    await navigator.storage.persist();
  } catch {}
}

// Nhớ TRANG đang đọc (bền hơn toạ độ px khi render lại / đổi chế độ xem)
const pageKey = (id) => `ptr.page.${id}`;
const tPageKey = (id) => `ptr.tpage.${id}`; // vị trí đang đọc ở chế độ sách-bản-dịch

// ---------- Thư viện: tối đa 3 tài liệu lưu trong máy (IndexedDB) ----------
// Bytes của mỗi PDF nằm trong IndexedDB theo khóa = docId (`name::size`).
// Danh mục nhẹ (tên/kích thước/lần mở gần nhất) để liệt kê nhanh nằm ở localStorage.
const MAX_DOCS = 3;
const LIB_KEY = 'ptr.library';
const LAST_DOC_KEY = 'ptr.lastDoc';
const makeId = (name, size) => `${name}::${size}`;

function loadLibrary() {
  try { return JSON.parse(localStorage.getItem(LIB_KEY) || '[]'); } catch { return []; }
}
function saveLibrary(list) { localStorage.setItem(LIB_KEY, JSON.stringify(list)); }
// Thêm mới hoặc cập nhật thời điểm mở gần nhất
function upsertLibrary(meta) {
  const list = loadLibrary();
  const i = list.findIndex((d) => d.id === meta.id);
  const now = Date.now();
  if (i >= 0) list[i] = { ...list[i], ...meta, lastOpened: now };
  else list.push({ ...meta, addedAt: now, lastOpened: now });
  saveLibrary(list);
  return list;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderLibrary() {
  const list = loadLibrary().slice().sort((a, b) => (b.lastOpened || 0) - (a.lastOpened || 0));
  if (!list.length) { libraryEl.hidden = true; libraryEl.innerHTML = ''; return; }
  libraryEl.hidden = false;
  const chips = list.map((d) => {
    const title = d.name.replace(/\.pdf$/i, '');
    const active = d.id === docId;
    const idAttr = escapeHtml(d.id);
    // Khôi phục từ bản sao lưu không kèm PDF: còn bản dịch nhưng thiếu file gốc
    const pending = !!d.needsFile;
    const tip = pending ? `${title} — cần mở lại file PDF này` : title;
    return `<div class="doc-chip${active ? ' active' : ''}${pending ? ' pending' : ''}" title="${escapeHtml(tip)}">
      <button class="doc-open" type="button" data-id="${idAttr}">
        <span class="doc-ic" aria-hidden="true">${pending ? '⇧' : '📄'}</span><span class="doc-name">${escapeHtml(title)}</span>
      </button>
      <button class="doc-remove" type="button" data-remove="${idAttr}" title="Gỡ khỏi thư viện" aria-label="Gỡ ${escapeHtml(title)}">✕</button>
    </div>`;
  }).join('');
  libraryEl.innerHTML =
    `<div class="lib-head"><span class="eyebrow">THƯ VIỆN</span>` +
    `<span class="lib-count">${list.length}/${MAX_DOCS} tài liệu</span></div>` +
    `<div class="lib-shelf">${chips}</div>`;
}

// Mở một tài liệu đã lưu trong thư viện
async function openFromLibrary(id) {
  if (id === docId) return; // đang mở sẵn rồi
  try {
    const rec = await idbGet(id);
    if (!rec || !rec.bytes) {
      const meta = loadLibrary().find((d) => d.id === id);
      if (meta && meta.needsFile) {
        // Bản dịch đã khôi phục sẵn — chỉ thiếu file PDF gốc. Mở luôn hộp chọn file;
        // chọn đúng file cũ là bản dịch tự khớp lại (mã tài liệu = tên::dung lượng).
        setStatus(`Hãy chọn lại file “${meta.name}” — bản dịch đã có sẵn và sẽ tự khớp vào.`, 'working');
        fileInput.click();
        return;
      }
      setStatus('Không tìm thấy dữ liệu tài liệu (có thể đã bị xóa).', 'error');
      return;
    }
    setStatus('Đang mở tài liệu…', 'working');
    upsertLibrary({ id, name: rec.name, size: rec.size, needsFile: false });
    localStorage.setItem(LAST_DOC_KEY, id);
    await openFromBytes(rec.bytes, rec.name, rec.size, false);
    renderLibrary();
  } catch (e) {
    setStatus('Không mở được tài liệu: ' + e.message, 'error');
  }
}

// Gỡ hẳn một tài liệu: xóa bytes + bản dịch + vị trí đọc khỏi trình duyệt
async function removeDoc(id) {
  const meta = loadLibrary().find((d) => d.id === id);
  const title = meta ? meta.name.replace(/\.pdf$/i, '') : 'tài liệu';
  const ok = await confirmDialog({
    eyebrow: 'GỠ TÀI LIỆU',
    title: `Gỡ “${title}” khỏi thư viện?`,
    message: 'Bản dịch và vị trí đọc của tài liệu này sẽ bị xóa khỏi máy.',
    okText: 'Gỡ tài liệu',
    cancelText: 'Giữ lại',
  });
  if (!ok) return;
  try { await idbDel(id); } catch {}
  saveLibrary(loadLibrary().filter((d) => d.id !== id));
  localStorage.removeItem(trKey(id));
  localStorage.removeItem(ovKey(id));
  localStorage.removeItem(noteKey(id));
  localStorage.removeItem(pageKey(id));
  localStorage.removeItem(tPageKey(id));
  if (localStorage.getItem(LAST_DOC_KEY) === id) localStorage.removeItem(LAST_DOC_KEY);
  if (id === docId) await closeDoc(); // đang mở thì đóng khung xem luôn
  renderLibrary();
  setStatus(`Đã gỡ “${title}” khỏi thư viện.`, '');
}

// Di trú dữ liệu phiên cũ (chỉ lưu 1 file dưới khóa 'last') sang thư viện mới
async function migrateLegacyLast() {
  if (loadLibrary().length) return;
  let rec;
  try { rec = await idbGet('last'); } catch { return; }
  if (!rec || !rec.bytes) return;
  const id = makeId(rec.name, rec.size);
  try { await idbSet(id, { id, name: rec.name, size: rec.size, bytes: rec.bytes }); } catch { return; }
  upsertLibrary({ id, name: rec.name, size: rec.size });
  localStorage.setItem(LAST_DOC_KEY, id);
  try { await idbDel('last'); } catch {}
}

// ---------- Sao lưu / Khôi phục dữ liệu ----------
// Toàn bộ dữ liệu của app nằm trong trình duyệt (localStorage + IndexedDB) nên
// xóa lịch sử duyệt web / đổi máy là mất sạch. Hai nút "Sao lưu" và "Khôi phục"
// gói mọi thứ vào MỘT file .json để cất giữ rồi nạp lại bất cứ lúc nào:
//   • bản dịch từng trang (kể cả ảnh chèn) + bản dịch chế độ "Đè trang"
//   • vị trí đang đọc, danh mục thư viện, cài đặt (bộ máy, model, hồ sơ dịch)
//   • API key — TÙY CHỌN (mặc định có kèm, vì đây là thứ hay mất nhất)
//   • file PDF gốc — TÙY CHỌN (file sao lưu nặng hơn nhiều)
const BACKUP_TAG = 'pdf-translator-backup';
const BACKUP_VERSION = 1;

function readJsonKey(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
// ArrayBuffer ↔ base64 (cắt khúc để không tràn ngăn xếp với file PDF lớn)
function abToB64(ab) {
  const bytes = new Uint8Array(ab);
  const CHUNK = 0x8000;
  let s = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(s);
}
function b64ToAb(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
function fmtSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}
// Đếm số trang đã có bản dịch của một tài liệu (để báo cho người dùng biết
// bản sao lưu chứa những gì).
function countTranslated(id) {
  const tr = readJsonKey(trKey(id)) || {};
  let n = 0;
  for (const v of Object.values(tr)) {
    if (typeof v === 'string' ? v.trim() : Array.isArray(v) && v.length) n++;
  }
  const ov = readJsonKey(ovKey(id)) || {};
  const nt = readJsonKey(noteKey(id)) || {};
  return {
    pages: n,
    overlay: Object.keys(ov).length,
    marks: (nt.bookmarks || []).length + (nt.highlights || []).length,
  };
}

async function buildBackup({ withKey, withPdf }) {
  const lib = loadLibrary();
  const docs = [];
  for (const meta of lib) {
    const item = {
      id: meta.id,
      name: meta.name,
      size: meta.size,
      addedAt: meta.addedAt || null,
      lastOpened: meta.lastOpened || null,
      page: localStorage.getItem(pageKey(meta.id)),
      tpage: localStorage.getItem(tPageKey(meta.id)),
      tr: readJsonKey(trKey(meta.id)) || {},
      ov: readJsonKey(ovKey(meta.id)) || {},
      note: readJsonKey(noteKey(meta.id)) || null, // bookmark + highlight + ghi chú
      pdf: null,
    };
    if (withPdf) {
      try {
        const rec = await idbGet(meta.id);
        if (rec && rec.bytes) item.pdf = abToB64(rec.bytes);
      } catch {}
    }
    docs.push(item);
  }
  return {
    app: BACKUP_TAG,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    hasKey: !!(withKey && apiKeyEl.value.trim()),
    hasPdf: docs.some((d) => !!d.pdf),
    settings: {
      provider: providerEl.value,
      model: modelEl.value.trim(),
      skill: skillEl.value,
      rememberKey: rememberEl.checked,
      apiKey: withKey ? apiKeyEl.value.trim() : '',
    },
    prefs: {
      mode: localStorage.getItem('ptr.mode') || '',
      readmode: localStorage.getItem('ptr.readmode') || '',
      zoom: localStorage.getItem('ptr.zoom') || '',
    },
    lastDoc: localStorage.getItem(LAST_DOC_KEY) || '',
    docs,
  };
}

function openBackupModal() {
  const lib = loadLibrary();
  const totals = lib.reduce((acc, d) => {
    const c = countTranslated(d.id);
    acc.pages += c.pages;
    acc.overlay += c.overlay;
    acc.marks += c.marks;
    acc.bytes += Number(d.size) || 0;
    return acc;
  }, { pages: 0, overlay: 0, marks: 0, bytes: 0 });
  backupSummaryEl.innerHTML = lib.length
    ? `Có <b>${lib.length}</b> tài liệu, <b>${totals.pages}</b> trang bản dịch` +
      (totals.overlay ? `, <b>${totals.overlay}</b> trang “Đè trang”` : '') +
      (totals.marks ? `, <b>${totals.marks}</b> bookmark/highlight kèm ghi chú` : '') + '.'
    : 'Chưa có tài liệu nào — bản sao lưu sẽ chỉ gồm cài đặt và API key.';
  bkKeyEl.checked = !!apiKeyEl.value.trim();
  bkKeyEl.disabled = !apiKeyEl.value.trim();
  bkPdfEl.checked = false;
  bkPdfEl.disabled = !lib.length;
  backupModalEl.dataset.pdfBytes = String(totals.bytes);
  updateBackupHint();
  backupModalEl.hidden = false;
  backupGoBtn.focus();
}
function updateBackupHint() {
  const pdfBytes = Number(backupModalEl.dataset.pdfBytes || 0);
  if (bkPdfEl.checked && pdfBytes) {
    // base64 phình ~4/3 lần so với file gốc
    backupHintEl.textContent = `File sao lưu sẽ nặng khoảng ${fmtSize(pdfBytes * 1.37)} — tải xuống lâu hơn.`;
  } else {
    backupHintEl.textContent = 'Không kèm PDF: file rất nhẹ. Khi khôi phục chỉ cần mở lại đúng file PDF cũ, bản dịch tự khớp vào.';
  }
}
function closeBackupModal() { backupModalEl.hidden = true; }

async function doBackup() {
  const withKey = bkKeyEl.checked && !bkKeyEl.disabled;
  const withPdf = bkPdfEl.checked && !bkPdfEl.disabled;
  closeBackupModal();
  setStatus('Đang gói dữ liệu…', 'working');
  try {
    flushPage();  // chốt vị trí đang đọc trước khi gói
    flushNotes(); // chốt ghi chú đang gõ dở
    const data = await buildBackup({ withKey, withPdf });
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const stamp = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sao-luu-dich-pdf-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus(`Đã tải file sao lưu (${fmtSize(blob.size)}).`, 'done');
  } catch (err) {
    setStatus('Không tạo được file sao lưu: ' + err.message, 'error');
  }
}

// Gộp dữ liệu cũ + mới: trang trùng chỉ số thì bản trong file sao lưu thắng.
function mergeStore(key, incoming) {
  if (!incoming || typeof incoming !== 'object' || !Object.keys(incoming).length) return true;
  let cur = {};
  try { cur = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
  try {
    localStorage.setItem(key, JSON.stringify({ ...cur, ...incoming }));
    return true;
  } catch { return false; }
}

async function applyBackup(data) {
  const docs = Array.isArray(data.docs) ? data.docs : [];
  const lib = loadLibrary();
  let added = 0, updated = 0, skipped = 0, withBytes = 0, full = false, quota = false;

  for (const d of docs) {
    if (!d || !d.id) continue;
    const known = lib.findIndex((x) => x.id === d.id);
    if (known < 0 && lib.length >= MAX_DOCS) { skipped++; full = true; continue; }

    if (!mergeStore(trKey(d.id), d.tr)) quota = true;
    if (!mergeStore(ovKey(d.id), d.ov)) quota = true;
    if (!mergeNoteStore(d.id, d.note)) quota = true;
    if (d.page != null) localStorage.setItem(pageKey(d.id), String(d.page));
    if (d.tpage != null) localStorage.setItem(tPageKey(d.id), String(d.tpage));

    // File PDF: lấy từ bản sao lưu nếu có, nếu không thì giữ file đang có trong máy
    let hasBytes = false;
    if (d.pdf) {
      try {
        await idbSet(d.id, { id: d.id, name: d.name, size: d.size, bytes: b64ToAb(d.pdf) });
        hasBytes = true;
      } catch {}
    }
    if (!hasBytes) {
      try { const rec = await idbGet(d.id); hasBytes = !!(rec && rec.bytes); } catch {}
    }
    if (hasBytes) withBytes++;

    const meta = {
      id: d.id,
      name: d.name || d.id,
      size: d.size,
      addedAt: d.addedAt || Date.now(),
      lastOpened: d.lastOpened || Date.now(),
      needsFile: !hasBytes, // có bản dịch nhưng thiếu file gốc → mời mở lại PDF
    };
    if (known >= 0) { lib[known] = { ...lib[known], ...meta }; updated++; }
    else { lib.push(meta); added++; }
  }
  saveLibrary(lib);

  // Cài đặt + API key — ghi thẳng vào localStorage (không phụ thuộc trạng thái
  // giao diện: danh sách "Hồ sơ dịch" có thể chưa tải xong).
  const s = data.settings || {};
  const cur = readJsonKey(SETTINGS_KEY) || {};
  const liveKey = apiKeyEl.value.trim();
  const apiKey = s.apiKey || liveKey || (cur.rememberKey ? cur.apiKey : '') || '';
  const keyRestored = !!(s.apiKey && s.apiKey !== liveKey);
  const next = {
    provider: s.provider || cur.provider || providerEl.value,
    model: s.model || cur.model || modelEl.value.trim(),
    skill: s.skill || cur.skill || skillEl.value,
    // Có key trong file → bật "Ghi nhớ key" luôn, khỏi mất thêm lần nữa
    rememberKey: s.apiKey ? true : (typeof s.rememberKey === 'boolean' ? s.rememberKey : !!cur.rememberKey),
    apiKey: '',
  };
  next.apiKey = next.rememberKey ? apiKey : '';
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  // Đồng bộ giao diện luôn cho khớp (trang sẽ tải lại ngay sau đó)
  providerEl.value = next.provider;
  applyModelSuggest(next.model);
  if (next.skill) { skillEl.dataset.want = next.skill; skillEl.value = next.skill; }
  if (apiKey) apiKeyEl.value = apiKey;
  rememberEl.checked = next.rememberKey;
  updateKeyHint();

  // Tùy chọn hiển thị
  const p = data.prefs || {};
  if (p.mode) localStorage.setItem('ptr.mode', p.mode);
  if (p.readmode) localStorage.setItem('ptr.readmode', p.readmode);
  if (p.zoom) localStorage.setItem('ptr.zoom', String(p.zoom));
  if (data.lastDoc && lib.some((x) => x.id === data.lastDoc && !x.needsFile)) {
    localStorage.setItem(LAST_DOC_KEY, data.lastDoc);
  }

  return { added, updated, skipped, withBytes, full, quota, keyRestored, total: docs.length };
}

async function restoreFromFile(file) {
  setStatus('Đang đọc file sao lưu…', 'working');
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    setStatus('File không đọc được — hãy chọn đúng file .json đã tải từ nút Sao lưu.', 'error');
    return;
  }
  if (!data || data.app !== BACKUP_TAG || !Array.isArray(data.docs)) {
    setStatus('Đây không phải file sao lưu của ứng dụng này.', 'error');
    return;
  }

  const when = data.createdAt ? new Date(data.createdAt).toLocaleString('vi-VN') : 'không rõ thời điểm';
  const trPages = data.docs.reduce((n, d) => n + Object.keys(d.tr || {}).length, 0);
  const ok = await confirmDialog({
    eyebrow: 'KHÔI PHỤC DỮ LIỆU',
    title: 'Nạp dữ liệu từ file sao lưu?',
    message:
      `File tạo lúc: ${when}\n` +
      `Gồm ${data.docs.length} tài liệu, ${trPages} trang bản dịch` +
      (data.hasKey ? ', có kèm API key' : '') + (data.hasPdf ? ', có kèm file PDF' : '') + '.\n' +
      'Trang nào trùng nhau sẽ lấy theo bản trong file. Ứng dụng sẽ tải lại sau khi nạp xong.',
    okText: 'Khôi phục',
    cancelText: 'Hủy',
    danger: false,
  });
  if (!ok) { setStatus(''); return; }

  setStatus('Đang khôi phục…', 'working');
  let r;
  try {
    r = await applyBackup(data);
  } catch (err) {
    setStatus('Khôi phục thất bại: ' + err.message, 'error');
    return;
  }

  const parts = [];
  if (r.added) parts.push(`${r.added} tài liệu mới`);
  if (r.updated) parts.push(`${r.updated} tài liệu cập nhật`);
  if (r.keyRestored) parts.push('API key');
  let msg = parts.length ? `Đã khôi phục: ${parts.join(', ')}.` : 'Đã khôi phục cài đặt.';
  if (r.full) msg += ` Bỏ qua ${r.skipped} tài liệu vì thư viện chỉ chứa tối đa ${MAX_DOCS}.`;
  if (r.quota) msg += ' Một phần bản dịch không lưu được (bộ nhớ trình duyệt đầy).';
  setStatus(msg + ' Đang tải lại…', 'done');
  setTimeout(() => location.reload(), 1200);
}

let scrollTimer = null;
let suppressScrollSave = false;

function stickyOffset() {
  const t = document.querySelector('.topbar');
  let h = (t ? t.offsetHeight : 120) + 10;
  if (libraryEl && !libraryEl.hidden) h += libraryEl.offsetHeight; // thanh Thư viện dính
  return h;
}
function visibleColEl(entry) {
  return viewMode === 'trans' ? entry.transEl : entry.origEl;
}
function currentTopPage() {
  const off = stickyOffset() + 4;
  let idx = 0;
  for (let i = 0; i < pages.length; i++) {
    const el = visibleColEl(pages[i]);
    if (!el) continue;
    if (el.getBoundingClientRect().top - off <= 0) idx = i;
    else break;
  }
  return idx;
}
function scrollToPage(idx) {
  const e = pages[idx];
  if (!e) return;
  const el = visibleColEl(e);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - stickyOffset();
  window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
}
// Khôi phục vị trí đọc bền: canh lại đúng trang liên tục tới khi layout ổn định
// (bản dịch dài + font tải trễ hay làm xê dịch). Dừng ngay khi người dùng tự thao tác.
function restoreReadingPosition(idx) {
  suppressScrollSave = true;
  let cancelled = false;
  const cancel = () => { cancelled = true; suppressScrollSave = false; };
  const opts = { once: true, passive: true };
  ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach((ev) =>
    window.addEventListener(ev, cancel, opts));
  const start = performance.now();
  const tick = () => {
    if (cancelled || docId == null) return;
    scrollToPage(idx);
    renderVisible(); // vẽ các trang quanh vị trí đang đọc
    if (performance.now() - start < 2000) setTimeout(() => requestAnimationFrame(tick), 90);
    else suppressScrollSave = false;
  };
  requestAnimationFrame(tick);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      if (!cancelled && docId != null) { scrollToPage(idx); renderVisible(); }
    });
  }
}

// Cập nhật ô số trang (giới hạn 1 lần/khung hình cho mượt) + đi tới trang
let pageRaf = false;
function schedulePageUpdate() {
  if (pageRaf) return;
  pageRaf = true;
  requestAnimationFrame(() => { pageRaf = false; updatePageInput(); syncFollowScope(); });
}
function updatePageInput() {
  if (!pages.length || document.activeElement === pageInput) return;
  pageInput.value = String(currentTopPage() + 1);
}
function gotoPageFromInput() {
  if (viewMode === 'overlay') {
    const total = overlayPages.length;
    if (!total) return;
    let n = parseInt(pageInput.value, 10);
    if (!Number.isFinite(n)) n = 1;
    n = Math.min(Math.max(1, n), total);
    pageInput.value = String(n);
    suppressScrollSave = true;
    scrollOverlayToPage(n - 1);
    if (docId) localStorage.setItem(pageKey(docId), String(n - 1));
    setTimeout(() => { suppressScrollSave = false; }, 350);
    return;
  }
  if (readMode === 'book') {
    const total = bookTotal();
    if (!total) return;
    let n = parseInt(pageInput.value, 10);
    if (!Number.isFinite(n)) n = 1;
    n = Math.min(Math.max(1, n), total);
    pageInput.value = String(n);
    bookIndex = n - 1;
    renderBook();
    return;
  }
  const total = pages.length;
  if (!total) return;
  let n = parseInt(pageInput.value, 10);
  if (!Number.isFinite(n)) n = 1;
  n = Math.min(Math.max(1, n), total);
  pageInput.value = String(n);
  suppressScrollSave = true;
  scrollToPage(n - 1);
  if (docId) localStorage.setItem(pageKey(docId), String(n - 1));
  setTimeout(() => { suppressScrollSave = false; }, 350);
}

window.addEventListener('scroll', () => {
  if (!docId) return;
  if (viewMode === 'overlay') { overlayScroll(); return; }
  if (readMode === 'book') return;
  schedulePageUpdate();
  if (suppressScrollSave) return;
  if (scrollTimer) return;
  scrollTimer = setTimeout(() => {
    scrollTimer = null;
    if (suppressScrollSave || !docId) return; // đang khôi phục/đổi tài liệu → bỏ qua
    localStorage.setItem(pageKey(docId), String(currentTopPage()));
  }, 200);
}, { passive: true });

let resizeTimer = null;
window.addEventListener('resize', () => {
  if (!pdfDoc) return;
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (viewMode === 'overlay') {
      const keep = overlayCurrentTop();
      for (const e of overlayPages) e.composed = false;
      composeVisibleOverlay();
      scrollOverlayToPage(keep);
      return;
    }
    if (readMode === 'book') { renderBook(); return; }
    if (viewMode === 'trans') return;
    const keep = currentTopPage();
    reserveAll();
    scrollToPage(keep);
    renderVisible();
  }, 200);
});

// Lưu ngay vị trí trang khi rời/ẩn trang (đề phòng refresh trong lúc throttle)
function flushPage() {
  if (readMode === 'book') return; // chế độ sách đã tự lưu bookIndex khi lật
  if (!docId || suppressScrollSave) return;
  if (viewMode === 'overlay') {
    if (overlayPages.length) localStorage.setItem(pageKey(docId), String(overlayCurrentTop()));
    return;
  }
  // Ở chế độ Đè trang các trang song ngữ bị ẩn → currentTopPage() sai (trả trang cuối);
  // chỉ lưu theo currentTopPage() cho các chế độ cuộn song ngữ/bản dịch/bản gốc.
  if (pages.length) localStorage.setItem(pageKey(docId), String(currentTopPage()));
}
window.addEventListener('pagehide', flushPage);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushPage();
});

// Hiện gợi ý lấy key khi ô API key còn trống
function updateKeyHint() {
  keyhintEl.hidden = !!apiKeyEl.value.trim();
}

// ---------- Status ----------
function setStatus(msg, kind = '') {
  statusEl.textContent = msg || '';
  statusEl.className = 'status' + (kind ? ' ' + kind : '');
}
function setPageStat(el, msg, kind = '') {
  el.textContent = msg || '';
  el.className = 'pstat' + (kind ? ' ' + kind : '');
}

// ---------- Config (skills) ----------
async function loadConfig() {
  try {
    const r = await fetch('/api/config');
    const cfg = await r.json();
    skillEl.innerHTML = (cfg.skills || [])
      .map((s) => `<option value="${s.key}">${s.label}</option>`).join('');
    if (skillEl.dataset.want) { skillEl.value = skillEl.dataset.want; }
  } catch {
    skillEl.innerHTML = '<option value="fitness">Fitness &amp; Health</option><option value="ld">Learning &amp; Development</option>';
  }
}

// ---------- Open & render PDF ----------
async function openFile(file) {
  const id = makeId(file.name, file.size);
  const lib = loadLibrary();
  const known = lib.some((d) => d.id === id);
  // Đã đủ 3 tài liệu và đây là file mới → chặn, mời gỡ bớt trước
  if (!known && lib.length >= MAX_DOCS) {
    setStatus(`Thư viện đã đủ ${MAX_DOCS} tài liệu. Hãy gỡ bớt một tài liệu rồi mở lại.`, 'error');
    return;
  }
  const ab = await file.arrayBuffer();
  // Lưu file vào thư viện để mở lại bất cứ lúc nào (không rời máy bạn — nằm trong trình duyệt).
  try { await idbSet(id, { id, name: file.name, size: file.size, bytes: ab }); } catch {}
  upsertLibrary({ id, name: file.name, size: file.size, needsFile: false });
  localStorage.setItem(LAST_DOC_KEY, id);
  await openFromBytes(ab, file.name, file.size, false);
  renderLibrary();
}

async function openFromBytes(ab, name, size, restoring) {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
  pdfDoc = pdf;

  // Đừng lưu vị trí trong lúc dựng/khôi phục tài liệu: khi đổi tài liệu (đang cuộn
  // sâu), một lần lưu bị hẹn giờ có thể ghi đè trang đang đọc của tài liệu MỚI bằng
  // vị trí cuộn tạm thời (thường là trang cuối) → mở lại bị nhảy xuống cuối.
  suppressScrollSave = true;
  if (scrollTimer) { clearTimeout(scrollTimer); scrollTimer = null; }
  if (ovScrollTimer) { clearTimeout(ovScrollTimer); ovScrollTimer = null; }

  docTitle = name.replace(/\.pdf$/i, '');
  docId = `${name}::${size}`;
  resetFind(); // kết quả tìm của tài liệu trước không còn đúng nữa
  document.body.classList.add('reading');
  const saved = loadTranslations(docId);
  NOTE = loadNotes(docId); // bookmark + highlight + ghi chú của tài liệu này

  // reset UI
  renderErrorShown = false; // tài liệu mới → cho phép báo lỗi vẽ lại từ đầu
  pages.length = 0;
  [...pagesEl.querySelectorAll('.orig, .trans')].forEach((n) => n.remove());
  if (overlayObserver) { overlayObserver.disconnect(); overlayObserver = null; }
  overlayPages.length = 0;
  overlayEl.innerHTML = '';
  emptyEl.hidden = true;
  pagesEl.hidden = viewMode === 'overlay';

  setStatus(`Đang mở ${pdf.numPages} trang…`);

  // Tỉ lệ khung trang (dùng trang 1 làm mặc định để chừa đúng chỗ trước khi vẽ)
  let defAspect = 1.414; // A4 dọc mặc định
  try {
    const v = (await pdf.getPage(1)).getViewport({ scale: 1 });
    defAspect = v.height / v.width;
  } catch {}

  // Dựng khung tất cả các trang NGAY (không vẽ, không trích chữ) → mở gần như tức thì.
  // Canvas được chừa đúng chiều cao qua reserveAll(); pixel vẽ trễ khi cuộn tới.
  const frag = document.createDocumentFragment();
  for (let i = 1; i <= pdf.numPages; i++) {
    // --- left: original ---
    const orig = document.createElement('div');
    orig.className = 'orig';
    const tag = document.createElement('div');
    tag.className = 'pagetag';
    const tagTxt = document.createElement('span');
    tagTxt.textContent = `Trang ${i} / ${pdf.numPages}`;
    tag.append(tagTxt, makeBookmarkBtn(i - 1));
    const canvas = document.createElement('canvas');
    // Canvas nằm trong khung định vị để lớp highlight đè đúng lên trang
    const cwrap = document.createElement('div');
    cwrap.className = 'canvas-wrap';
    const hlLayer = document.createElement('div');
    hlLayer.className = 'hl-layer';
    hlLayer.dataset.p = String(i - 1);
    // Lớp riêng cho vệt "tìm thấy" — nằm trên lớp bôi vàng, không chắn chuột
    const findLayer = document.createElement('div');
    findLayer.className = 'find-layer';
    cwrap.append(canvas, hlLayer, findLayer);
    orig.append(tag, cwrap);
    frag.appendChild(orig);

    // --- right: translation ---
    const trans = document.createElement('div');
    trans.className = 'trans';
    const bar = document.createElement('div');
    bar.className = 'trans-toolbar';
    const pnum = document.createElement('span');
    pnum.className = 'pnum';
    pnum.textContent = `Trang ${i}`;
    const bmT = makeBookmarkBtn(i - 1);
    const retro = document.createElement('button');
    retro.className = 'retro';
    retro.type = 'button';
    retro.textContent = 'Dịch lại';
    const pstat = document.createElement('span');
    pstat.className = 'pstat';
    const blocksEl = document.createElement('div');
    blocksEl.className = 'blocks';
    bar.append(pnum, bmT, retro, pstat);
    trans.append(bar, blocksEl);
    frag.appendChild(trans);

    const entry = {
      index: i - 1, pageNum: i, canvas,
      origEl: orig, transEl: trans, hlLayer, findLayer,
      sourceText: null, // trích chữ trễ (chỉ khi cần dịch)
      findSrc: null,    // chữ + toạ độ từng mẩu chữ, để tìm kiếm (trích trễ)
      blocks: normalizeBlocks(saved[i - 1]), blocksEl, statEl: pstat,
      aspect: defAspect, rendered: false, renderSig: '', renderingSig: null,
    };
    orig._entry = entry;
    pages.push(entry);
    renderBlocks(entry);

    // restore saved translation
    if (entryHasContent(entry)) setPageStat(pstat, 'đã lưu', 'done');

    retro.addEventListener('click', () => translateOne(entry, true));
  }
  pagesEl.appendChild(frag);

  reserveAll();            // chừa đúng chiều cao mỗi trang → nhảy tới trang đang đọc là chuẩn ngay
  setupRenderObserver();   // vẽ trang theo nhu cầu khi cuộn tới (nhanh + nhẹ RAM)
  for (const e of pages) paintRectLayer(e.hlLayer, e.index, e.aspect, 'orig');
  // Mục lục nhúng trong PDF → chương (chạy nền, xong thì vẽ lại ngăn kéo)
  initChapters().then(() => { renderScopeSelect(); renderDrawer(); });
  setNotesEnabled(true);
  renderDrawer();

  setStatus(restoring ? `Đã mở lại ${pdf.numPages} trang (phiên trước).` : `Đã mở ${pdf.numPages} trang.`, 'done');
  translateBtn.disabled = false;
  exportBtn.disabled = false;
  closeBtn.disabled = false;
  expandBtn.disabled = false;
  if (expandBtnM) expandBtnM.disabled = false;

  // Khôi phục đúng TRANG đang đọc dở (thử vài lần để tránh layout/font dịch chuyển)
  const savedPage = Number(localStorage.getItem(pageKey(docId)) || 0);
  pageTotalEl.textContent = String(pdf.numPages);
  pageInput.max = String(pdf.numPages);
  pageInput.disabled = false;
  pageInput.value = String(Math.min(pdf.numPages, savedPage + 1));
  bookIndex = savedPage;
  if (viewMode === 'overlay') {
    pagesEl.hidden = true;
    bookEl.hidden = true;
    overlayEl.hidden = false;
    renderOverlay(savedPage);
  } else if (readMode === 'book') {
    setReadMode('book');
    suppressScrollSave = false; // chế độ sách tự quản vị trí, gỡ cờ chặn
  } else restoreReadingPosition(savedPage);
}

// ---------- Vẽ canvas theo nhu cầu (lazy): chỉ vẽ trang gần khung nhìn ----------
// Chiều rộng (CSS px) một trang sẽ chiếm — mọi .orig cùng chế độ đều bằng nhau
function colBoxWidth() {
  const w = pages.length ? (pages[0].origEl.clientWidth || 480) : 480;
  return Math.max(200, w) * zoom;
}
// Chữ ký kích thước để biết canvas đã vẽ có còn hợp lệ không (đổi zoom/độ rộng → vẽ lại)
function renderSigFor() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  return Math.round(colBoxWidth()) + 'x' + dpr;
}
// Chừa chỗ (chiều cao) cho một trang chưa vẽ, đúng bằng khổ khi vẽ xong → không giật layout
function reservePlaceholder(e, boxW) {
  if (!e.canvas) return;
  e.canvas.style.width = boxW + 'px';
  e.canvas.style.height = (boxW * e.aspect) + 'px';
}
// Chừa lại chỗ cho MỌI trang theo layout/zoom hiện tại và đánh dấu cần vẽ lại
function reserveAll() {
  if (!pdfDoc || viewMode === 'trans' || readMode === 'book') return;
  const boxW = colBoxWidth();
  for (const e of pages) { e.rendered = false; e.renderSig = ''; reservePlaceholder(e, boxW); }
}
// Vẽ pixel cho một trang nếu chưa vẽ / kích thước đã đổi
async function ensureRendered(e) {
  if (!pdfDoc || viewMode === 'trans' || readMode === 'book') return;
  if (!e.origEl || e.origEl.clientWidth < 10) return; // đang ẩn thì bỏ qua
  const sig = renderSigFor();
  if (e.rendered && e.renderSig === sig) return;
  if (e.renderingSig === sig) return; // đang vẽ dở đúng kích thước này
  // Kích thước đổi giữa chừng (đổi chế độ xem, mở ngăn kéo, nhảy tới kết quả tìm…):
  // phải HUỶ nét vẽ đang dở, vì pdf.js không cho hai lượt vẽ cùng một canvas —
  // gặp vậy nó ném lỗi và trang trơ ra một ô trắng.
  if (e.renderTask) { try { e.renderTask.cancel(); } catch {} e.renderTask = null; }
  e.renderingSig = sig;
  let task = null;
  try {
    const page = await pdfDoc.getPage(e.pageNum);
    const v = page.getViewport({ scale: 1 });
    e.aspect = v.height / v.width; // tỉ lệ thật của trang (phòng trang khác khổ)
    await renderPage(page, e.canvas, e.origEl, (t) => { task = t; e.renderTask = t; });
    e.rendered = true;
    e.renderSig = sig;
    paintRectLayer(e.hlLayer, e.index, e.aspect, 'orig'); // vệt bôi theo đúng tỉ lệ trang
    paintFindLayer(e);                                    // vệt tìm thấy cũng theo tỉ lệ đó
  } catch (err) {
    // Mình chủ động huỷ để vẽ lại cho đúng khổ → không phải lỗi, đừng làm phiền.
    if (!err || err.name !== 'RenderingCancelledException') reportRenderError(e.pageNum, err);
  }
  finally {
    // Chỉ dọn cờ của CHÍNH lượt vẽ này, đừng dọn nhầm lượt vẽ mới hơn
    if (e.renderingSig === sig) e.renderingSig = null;
    if (task && e.renderTask === task) e.renderTask = null;
  }
}
// Vẽ những trang đang (gần) trong khung nhìn
function renderVisible() {
  if (!pdfDoc || viewMode === 'trans' || readMode === 'book') return;
  const vh = window.innerHeight;
  const m = vh; // chừa 1 màn hình trên/dưới
  for (const e of pages) {
    if (!e.origEl) continue;
    const r = e.origEl.getBoundingClientRect();
    if (r.bottom > -m && r.top < vh + m) ensureRendered(e);
  }
}
// Quan sát cuộn để tự vẽ trang khi tới gần
function setupRenderObserver() {
  if (renderObserver) renderObserver.disconnect();
  renderObserver = new IntersectionObserver((ents) => {
    for (const it of ents) {
      if (it.isIntersecting && it.target._entry) ensureRendered(it.target._entry);
    }
  }, { rootMargin: '1200px 0px' });
  for (const e of pages) renderObserver.observe(e.origEl);
}

// ---------- Chế độ xem ----------
function applyScrollLayout(keep) {
  pagesEl.className = 'pages' + (viewMode !== 'both' ? ' mode-' + viewMode : '');
  // rAF để layout (đổi độ rộng cột theo chế độ) áp dụng xong rồi mới đo/chừa chỗ
  requestAnimationFrame(() => {
    if (pdfDoc && viewMode !== 'trans') reserveAll(); // chừa chiều cao theo layout mới
    if (docId && pages.length) {
      scrollToPage(keep);
      localStorage.setItem(pageKey(docId), String(keep));
    }
    renderVisible();
  });
}

// Trang đang xem hiện tại theo đúng chế độ hiện hành (để giữ vị trí khi đổi chế độ).
function getCurrentPageIndex() {
  if (viewMode === 'overlay') return overlayPages.length ? overlayCurrentTop() : 0;
  if (readMode === 'book') return bookIndex;
  if (docId && pages.length) return currentTopPage();
  return 0;
}

function setMode(mode) {
  const keep = getCurrentPageIndex();
  viewMode = mode;
  localStorage.setItem('ptr.mode', mode);
  [...viewmodeEl.querySelectorAll('.seg')].forEach((b) =>
    b.classList.toggle('active', b.dataset.mode === mode));

  // "Đè trang": mặt phẳng riêng, không dùng bố cục cột hay chế độ đọc sách.
  if (mode === 'overlay') {
    pagesEl.hidden = true;
    bookEl.hidden = true;
    overlayEl.hidden = !pdfDoc;
    if (pdfDoc) renderOverlay(keep);
    return;
  }
  overlayEl.hidden = true;

  if (readMode === 'book') {
    pagesEl.hidden = true;
    bookEl.hidden = !pdfDoc;
    transSig = ''; // buộc dàn lại nếu chuyển sang bản dịch
    if (docId) bookIndex = Number(localStorage.getItem((mode === 'trans' ? tPageKey : pageKey)(docId)) || 0);
    if (pdfDoc) renderBook();
    return;
  }
  bookEl.hidden = true;
  pagesEl.hidden = !pdfDoc;
  applyScrollLayout(keep);
}

// ---------- Chế độ Đọc sách ----------
// Gom toàn bộ khối bản dịch của mọi trang thành một dòng chảy (chữ + ảnh) theo thứ tự
function allBlocks() {
  const out = [];
  for (const p of pages) {
    for (const b of p.blocks) {
      if (b.type === 'text') {
        const t = (b.text || '').trim();
        if (t) out.push({ type: 'text', text: t });
      } else if (b.type === 'image' && b.src) {
        out.push({ type: 'image', src: b.src, w: b.w || 0, h: b.h || 0, widthPct: b.widthPct || 1 });
      }
    }
  }
  return out;
}
// Chữ ký nội dung để biết có cần dàn lại trang không
function blocksSignature(blocks) {
  let s = '';
  for (const b of blocks) s += b.type === 'text' ? ('t' + b.text.length) : ('i' + (b.src ? b.src.length : 0));
  return s + '#' + blocks.length;
}

// Dàn dòng chảy khối thành từng trang. Chữ có thể cắt sang trang mới; ảnh là
// một khối nguyên (tự co để vừa khổ trang). Mỗi trang trả về là danh sách mảnh
// { type:'text', text } | { type:'image', src, w, h } với w/h là kích thước hiển thị.
function paginateBlocks(blocks, contentW, contentH, fontPx, lineH) {
  measEl.style.width = contentW + 'px';
  measEl.style.fontFamily = getComputedStyle(document.body).fontFamily;
  measEl.style.fontSize = fontPx + 'px';
  measEl.style.lineHeight = String(lineH);
  const measure = (t) => { measEl.textContent = t; return measEl.scrollHeight; };
  const gap = Math.round(fontPx * 0.7); // khoảng cách giữa hai khối
  const out = [];
  let cur = [];
  let used = 0;
  const flush = () => { if (cur.length) { out.push(cur); cur = []; used = 0; } };
  const gapNow = () => (cur.length ? gap : 0);

  for (const block of blocks) {
    if (block.type === 'image') {
      let dw = contentW * clampPct(block.widthPct);
      let dh = block.w ? (block.h * dw / block.w) : Math.min(contentH, dw);
      if (dh > contentH) { dw = dw * (contentH / dh); dh = contentH; } // cao quá 1 trang → co lại
      if (cur.length && used + gapNow() + dh > contentH) flush();
      used += gapNow() + dh;
      cur.push({ type: 'image', src: block.src, w: Math.round(dw), h: Math.round(dh) });
    } else {
      const toks = block.text.split(/(\s+)/);
      const join = (a, b) => toks.slice(a, b).join('');
      let i = 0;
      while (i < toks.length) {
        const avail = contentH - used - gapNow();
        if (cur.length && avail < fontPx * lineH) { flush(); continue; } // hết chỗ → sang trang
        let lo = i + 1, hi = toks.length, fit = i + 1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (measure(join(i, mid)) <= Math.max(avail, fontPx * lineH)) { fit = mid; lo = mid + 1; }
          else hi = mid - 1;
        }
        if (fit <= i) fit = i + 1;                       // luôn tiến ít nhất 1 token
        const piece = join(i, fit).replace(/^\s+/, '');
        used += gapNow() + measure(piece);
        cur.push({ type: 'text', text: piece });
        i = fit;
        if (i < toks.length) flush();                    // còn dư chữ → sang trang mới
      }
    }
  }
  flush();
  return out.length ? out : [[{ type: 'text', text: '' }]];
}

// Điện thoại: đọc sách chỉ 1 trang/màn hình (2 trang sẽ quá bé)
const isMobile = () => window.matchMedia('(max-width: 720px)').matches;

function bookGeometry() {
  const fs = !!document.fullscreenElement;
  const topbarH = fs ? 0 : document.querySelector('.topbar').offsetHeight;
  const stageH = Math.max(360, window.innerHeight - topbarH - (fs ? 12 : 40));
  const stageW = bookStage.clientWidth || (window.innerWidth - 130);
  return { stageH, stageW };
}

function currentBookMode() {
  if (viewMode === 'trans') return 'trans';
  if (viewMode === 'orig') return 'orig';
  return 'none'; // song ngữ
}
function bookTotal() {
  if (viewMode === 'trans') return transPages.length;
  if (viewMode === 'orig') return pdfDoc ? pdfDoc.numPages : 0;
  return 0;
}

// Hai trang sách dùng đi dùng lại đúng hai canvas: lật nhanh hoặc vẽ lại giữa
// chừng thì phải huỷ nét vẽ cũ trước, không pdf.js sẽ báo lỗi trùng canvas.
const bookTasks = new WeakMap();
async function renderBookPage(canvas, pageNum, maxW, maxH) {
  const prev = bookTasks.get(canvas);
  if (prev) { try { prev.cancel(); } catch {} bookTasks.delete(canvas); }
  const page = await pdfDoc.getPage(pageNum);
  const base = page.getViewport({ scale: 1 });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const fit = Math.max(0.1, Math.min(maxW / base.width, maxH / base.height) * zoom);
  const viewport = page.getViewport({ scale: fit * dpr });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = (viewport.width / dpr) + 'px';
  canvas.style.height = (viewport.height / dpr) + 'px';
  const task = page.render({ canvasContext: canvas.getContext('2d'), viewport });
  bookTasks.set(canvas, task);
  try {
    await task.promise;
  } catch (err) {
    if (!err || err.name !== 'RenderingCancelledException') throw err;
  } finally {
    if (bookTasks.get(canvas) === task) bookTasks.delete(canvas);
  }
}

// ---- Đọc sách: BẢN GỐC (ảnh trang) ----
let bookToken = 0;
async function renderBookOriginal() {
  bookMsg.hidden = true;
  bookTextLeft.hidden = true;
  bookTextRight.hidden = true;
  const token = ++bookToken;
  const total = pdfDoc.numPages;
  bookIndex = Math.min(Math.max(0, bookIndex), total - 1);
  const leftNum = bookIndex + 1;
  const rightNum = bookIndex + 2;

  const { stageH, stageW } = bookGeometry();
  const hasRight = !isMobile() && rightNum <= total; // điện thoại: 1 trang
  const cols = hasRight ? 2 : 1;
  const halfW = Math.max(160, (stageW - (cols === 2 ? 14 : 0)) / cols);

  await renderBookPage(bookLeftCanvas, leftNum, halfW, stageH);
  if (token !== bookToken) return;
  paintRectsOnCanvas(bookLeftCanvas.getContext('2d'), leftNum - 1, bookLeftCanvas.width, 'orig');
  paintFindOnCanvas(bookLeftCanvas.getContext('2d'), leftNum - 1, bookLeftCanvas.width);
  bookLeftCanvas.hidden = false;
  if (hasRight) {
    bookRightCanvas.hidden = false;
    await renderBookPage(bookRightCanvas, rightNum, halfW, stageH);
    if (token !== bookToken) return;
    paintRectsOnCanvas(bookRightCanvas.getContext('2d'), rightNum - 1, bookRightCanvas.width, 'orig');
    paintFindOnCanvas(bookRightCanvas.getContext('2d'), rightNum - 1, bookRightCanvas.width);
  } else {
    bookRightCanvas.hidden = true;
  }

  pageTotalEl.textContent = String(total);
  pageInput.max = String(total);
  pageInput.value = String(leftNum);
  if (docId) localStorage.setItem(pageKey(docId), String(bookIndex));
  bookPrevBtn.disabled = bookIndex <= 0;
  bookNextBtn.disabled = bookIndex >= total - 1;
}

// ---- Đọc sách: BẢN DỊCH (chữ, tự dàn sang trang mới khi dài) ----
function applyPageStyle(el, pageW, pageH, padX, padY, fontPx, lineH) {
  el.style.width = pageW + 'px';
  el.style.height = pageH + 'px';
  el.style.padding = padY + 'px ' + padX + 'px';
  el.style.fontSize = fontPx + 'px';
  el.style.lineHeight = String(lineH);
}
// Đổ các mảnh (chữ/ảnh) của một trang sách vào phần tử trang
function fillBookPage(el, fragments, pageW, pageH, padX, padY, fontPx, lineH) {
  applyPageStyle(el, pageW, pageH, padX, padY, fontPx, lineH);
  el.innerHTML = '';
  const gap = Math.round(fontPx * 0.7);
  fragments.forEach((f, idx) => {
    let node;
    if (f.type === 'image') {
      node = document.createElement('img');
      node.src = f.src;
      node.style.width = f.w + 'px';
      node.style.height = f.h + 'px';
    } else {
      node = document.createElement('div');
      node.className = 'book-frag-text';
      // Đang tìm chữ thì tô luôn trên trang sách (chữ ở đây đã dàn lại nên không
      // dùng được vị trí ký tự của khối gốc — dò thẳng trên đúng mẩu chữ này).
      if (FIND.qf) node.innerHTML = highlightFindHtml(f.text);
      else node.textContent = f.text;
    }
    if (idx > 0) node.style.marginTop = gap + 'px';
    el.appendChild(node);
  });
}
function renderBookTranslation() {
  bookLeftCanvas.hidden = true;
  bookRightCanvas.hidden = true;

  const blocks = allBlocks();
  if (!blocks.length) {
    transPages = [];
    bookTextLeft.hidden = true;
    bookTextRight.hidden = true;
    bookMsg.hidden = false;
    bookMsg.textContent = 'Chưa có bản dịch. Bấm “Dịch tài liệu” trước, rồi quay lại chế độ đọc sách.';
    pageTotalEl.textContent = '—';
    bookPrevBtn.disabled = true;
    bookNextBtn.disabled = true;
    return;
  }
  bookMsg.hidden = true;

  const single = isMobile(); // điện thoại: 1 trang rộng hết khổ
  const { stageH, stageW } = bookGeometry();
  let pageW = Math.min(stageH * 0.72, single ? stageW : (stageW - 14) / 2);
  const pageH = Math.min(stageH, pageW / 0.72);
  const padX = Math.round(pageW * 0.09);
  const padY = Math.round(pageH * 0.07);
  const lineH = 1.62;
  const fontPx = Math.max(12, Math.min(26, pageW * 0.033)) * zoom;
  const contentW = pageW - 2 * padX;
  const contentH = pageH - 2 * padY;

  const sig = [blocksSignature(blocks), Math.round(contentW), Math.round(contentH), Math.round(fontPx * 10)].join('|');
  if (sig !== transSig) {
    transPages = paginateBlocks(blocks, contentW, contentH, fontPx, lineH);
    transSig = sig;
  }
  const total = transPages.length;
  bookIndex = Math.min(Math.max(0, bookIndex), total - 1);

  fillBookPage(bookTextLeft, transPages[bookIndex] || [], pageW, pageH, padX, padY, fontPx, lineH);
  bookTextLeft.hidden = false;

  const rightIdx = bookIndex + 1;
  if (!single && rightIdx < total) {
    fillBookPage(bookTextRight, transPages[rightIdx], pageW, pageH, padX, padY, fontPx, lineH);
    bookTextRight.hidden = false;
  } else {
    bookTextRight.hidden = true;
  }

  pageTotalEl.textContent = String(total);
  pageInput.max = String(total);
  pageInput.value = String(bookIndex + 1);
  if (docId) localStorage.setItem(tPageKey(docId), String(bookIndex));
  bookPrevBtn.disabled = bookIndex <= 0;
  bookNextBtn.disabled = bookIndex >= total - 1;
}

function renderBookNone() {
  bookLeftCanvas.hidden = true;
  bookRightCanvas.hidden = true;
  bookTextLeft.hidden = true;
  bookTextRight.hidden = true;
  bookMsg.hidden = false;
  bookMsg.textContent = 'Chế độ “Song ngữ” không đọc kiểu sách được. Hãy chọn “Bản gốc” hoặc “Bản dịch”.';
  pageTotalEl.textContent = '—';
  bookPrevBtn.disabled = true;
  bookNextBtn.disabled = true;
}

async function renderBook() {
  if (!pdfDoc) return;
  const m = currentBookMode();
  if (m === 'orig') return renderBookOriginal();
  if (m === 'trans') return renderBookTranslation();
  return renderBookNone();
}

function buildFlipFromEl(srcEl, dir) {
  const stageRect = bookStage.getBoundingClientRect();
  const r = srcEl.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'book-flip ' + dir;
  el.style.left = (r.left - stageRect.left) + 'px';
  el.style.top = (r.top - stageRect.top) + 'px';
  el.style.width = r.width + 'px';
  el.style.height = r.height + 'px';
  el.style.transformOrigin = dir === 'next' ? 'left center' : 'right center';
  if (srcEl.tagName === 'CANVAS') {
    const c = document.createElement('canvas');
    c.width = srcEl.width; c.height = srcEl.height;
    c.getContext('2d').drawImage(srcEl, 0, 0);
    c.style.width = '100%'; c.style.height = '100%';
    el.appendChild(c);
  } else {
    const clone = srcEl.cloneNode(true);
    clone.removeAttribute('id');
    clone.hidden = false;
    clone.style.width = '100%';
    clone.style.height = '100%';
    clone.style.boxShadow = 'none';
    el.appendChild(clone);
  }
  const shade = document.createElement('div');
  shade.className = 'book-flip-shade';
  el.appendChild(shade);
  bookStage.appendChild(el);
  return el;
}
function animateFlip(el, dir) {
  const end = dir === 'next' ? -170 : 170;
  const shade = el.querySelector('.book-flip-shade');
  const a = el.animate(
    [{ transform: 'rotateY(0deg)' }, { transform: `rotateY(${end}deg)` }],
    { duration: 620, easing: 'cubic-bezier(.36,.06,.28,1)' }
  );
  if (shade) shade.animate(
    [{ opacity: 0 }, { opacity: 0.55, offset: 0.5 }, { opacity: 0 }],
    { duration: 620, easing: 'ease-in-out' }
  );
  const done = () => el.remove();
  a.onfinish = done;
  a.oncancel = done;
}
async function bookGo(delta) {
  if (!pdfDoc) return;
  const m = currentBookMode();
  if (m === 'none') return;
  const total = bookTotal();
  if (!total) return;
  const ni = Math.min(Math.max(0, bookIndex + delta), total - 1);
  if (ni === bookIndex) return;
  const dir = delta > 0 ? 'next' : 'prev';
  const single = isMobile(); // 1 trang: chỉ có trang trái đang hiện để lật
  const src = m === 'orig'
    ? (single ? bookLeftCanvas : (dir === 'next' ? bookRightCanvas : bookLeftCanvas))
    : (single ? bookTextLeft : (dir === 'next' ? bookTextRight : bookTextLeft));
  const canFlip = src && !src.hidden;
  const snap = canFlip ? buildFlipFromEl(src, dir) : null;
  bookIndex = ni;
  await renderBook();
  if (snap) animateFlip(snap, dir);
}

async function toggleBookFullscreen() {
  if (!pdfDoc) return;
  if (document.fullscreenElement) { document.exitFullscreen(); return; }
  if (readMode !== 'book') setReadMode('book');
  try { await bookEl.requestFullscreen(); }
  catch { setStatus('Trình duyệt không cho vào toàn màn hình.', 'error'); }
}

function setReadMode(mode) {
  readMode = mode;
  localStorage.setItem('ptr.readmode', mode);
  document.body.classList.toggle('read-book', mode === 'book');
  [...readmodeEl.querySelectorAll('.seg')].forEach((b) =>
    b.classList.toggle('active', b.dataset.read === mode));

  // Chế độ "Đè trang" không phân biệt Kéo lướt / Đọc sách — giữ nguyên mặt phẳng đè.
  if (viewMode === 'overlay') {
    pagesEl.hidden = true;
    bookEl.hidden = true;
    overlayEl.hidden = !pdfDoc;
    return;
  }
  overlayEl.hidden = true;

  if (mode === 'book') {
    pagesEl.hidden = true;
    transSig = '';
    if (docId) bookIndex = Number(localStorage.getItem((viewMode === 'trans' ? tPageKey : pageKey)(docId)) || 0);
    bookEl.hidden = !pdfDoc;
    if (pdfDoc) renderBook();
  } else {
    bookEl.hidden = true;
    pagesEl.hidden = !pdfDoc;
    const keep = docId ? Number(localStorage.getItem(pageKey(docId)) || 0) : 0;
    if (pdfDoc) {
      pageTotalEl.textContent = String(pdfDoc.numPages);
      pageInput.max = String(pdfDoc.numPages);
      pageInput.value = String(keep + 1);
      applyScrollLayout(keep);
    }
  }
}

// ---------- Phóng to / thu nhỏ ----------
function applyZoomVar() {
  pagesEl.style.setProperty('--zoom', String(zoom));
  zoomLevelEl.textContent = Math.round(zoom * 100) + '%';
}
function setZoom(next) {
  const keep = getCurrentPageIndex();
  zoom = Math.min(3, Math.max(0.5, Math.round(next * 100) / 100));
  applyZoomVar();
  localStorage.setItem('ptr.zoom', String(zoom));
  if (viewMode === 'overlay') {
    if (pdfDoc) {
      for (const e of overlayPages) e.composed = false;
      requestAnimationFrame(() => { scrollOverlayToPage(keep); composeVisibleOverlay(); });
    }
    return;
  }
  if (readMode === 'book') { if (pdfDoc) renderBook(); return; }
  if (pdfDoc && viewMode !== 'trans') {
    reserveAll(); // đổi zoom → chừa lại chiều cao theo khổ mới
    if (docId && pages.length) scrollToPage(keep);
    renderVisible();
  } else if (docId && pages.length) {
    requestAnimationFrame(() => scrollToPage(keep));
  }
}

// ---------- Đóng tài liệu ----------
async function closeDoc() {
  // "Đóng" chỉ đóng khung xem — tài liệu vẫn nằm trong thư viện để mở lại.
  localStorage.removeItem(LAST_DOC_KEY);
  if (renderObserver) { renderObserver.disconnect(); renderObserver = null; }
  pages.length = 0;
  pdfDoc = null;
  docId = null;
  document.body.classList.remove('reading');
  docTitle = 'ban-dich';
  NOTE = emptyNoteStore();
  setNotesEnabled(false);
  resetFind();
  hideSelbar();
  renderDrawer();
  [...pagesEl.querySelectorAll('.orig, .trans')].forEach((n) => n.remove());
  if (overlayObserver) { overlayObserver.disconnect(); overlayObserver = null; }
  overlayPages.length = 0;
  overlayEl.innerHTML = '';
  pagesEl.hidden = true;
  overlayEl.hidden = true;
  bookEl.hidden = true;
  emptyEl.hidden = false;
  translateBtn.disabled = true;
  exportBtn.disabled = true;
  closeBtn.disabled = true;
  expandBtn.disabled = true;
  if (expandBtnM) expandBtnM.disabled = true;
  pageInput.disabled = true;
  pageInput.value = '';
  pageTotalEl.textContent = '—';
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  closeRangeModal();
  renderLibrary(); // bỏ đánh dấu tài liệu đang mở
  setStatus('Đã đóng tài liệu.', '');
}

async function restoreLastDoc() {
  await migrateLegacyLast(); // đưa dữ liệu phiên cũ vào thư viện (nếu có)
  renderLibrary();
  // Sách khôi phục từ bản sao lưu không kèm PDF: nhắc người dùng chọn lại file gốc
  const pendingN = loadLibrary().filter((d) => d.needsFile).length;
  if (pendingN) {
    setStatus(`${pendingN} tài liệu đã có bản dịch — bấm tên sách ở Thư viện để chọn lại file PDF gốc.`, '');
  }
  const id = localStorage.getItem(LAST_DOC_KEY);
  if (!id) return; // không có tài liệu đang mở dở → hiện thư viện + màn hình trống
  try {
    const rec = await idbGet(id);
    if (!rec || !rec.bytes) return;
    setStatus('Đang mở lại tài liệu phiên trước…', 'working');
    await openFromBytes(rec.bytes, rec.name, rec.size, true);
    renderLibrary();
  } catch (e) {
    setStatus('Không mở lại được tài liệu trước: ' + e.message, 'error');
  }
}

// Trang vẽ hỏng thì canvas chỉ trơ ra một ô trắng — im lặng là không thể lần ra
// nguyên nhân. Ghi console đầy đủ, và báo lên thanh trạng thái một lần duy nhất
// để không spam khi cả tập tài liệu cùng hỏng vì một lý do.
let renderErrorShown = false;
function reportRenderError(pageNum, err) {
  if (err?.name === 'RenderingCancelledException') return; // huỷ có chủ đích
  console.error(`[pdf-translator] Vẽ trang ${pageNum} hỏng:`, err);
  if (renderErrorShown) return;
  renderErrorShown = true;
  setStatus(`Không vẽ được trang ${pageNum}: ${err?.message || err}`, 'error');
}

async function renderPage(page, canvas, container, onTask) {
  const base = page.getViewport({ scale: 1 });
  const cssWidth = Math.max(200, (container.clientWidth || 480)) * zoom;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const scale = (cssWidth / base.width) * dpr;
  const viewport = page.getViewport({ scale });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = (viewport.width / dpr) + 'px';
  canvas.style.height = (viewport.height / dpr) + 'px';
  const ctx = canvas.getContext('2d');
  const task = page.render({ canvasContext: ctx, viewport });
  if (onTask) onTask(task); // để nơi gọi huỷ được nếu cần vẽ lại khổ khác
  await task.promise;
}

// Trích text theo CỘT: tách các cột bằng khoảng trắng dọc rồi đọc trọn từng cột
// (trên→dưới) trước khi sang cột kế. Giúp bảng/nhiều cột không bị đọc xen kẽ.
function medianHeight(boxes) {
  const hs = boxes.map((b) => b.h).filter((h) => h > 0).sort((a, b) => a - b);
  return hs.length ? hs[Math.floor(hs.length / 2)] : 10;
}
function flushLine(items) {
  items.sort((a, b) => a.x - b.x);
  let s = '';
  let prevRight = null;
  for (const it of items) {
    if (prevRight !== null && it.x - prevRight > it.h * 0.3) s += ' ';
    s += it.str;
    prevRight = it.x + it.w;
  }
  return s;
}
function linesFromBoxes(boxes) {
  const sorted = boxes.slice().sort((a, b) => (b.y - a.y) || (a.x - b.x));
  const lh = medianHeight(boxes) || 10;
  const yThresh = lh * 0.6;
  const lines = [];
  let cur = [];
  let anchorY = null;
  for (const b of sorted) {
    if (anchorY === null || Math.abs(b.y - anchorY) <= yThresh) {
      cur.push(b);
      if (anchorY === null) anchorY = b.y;
    } else {
      lines.push({ y: anchorY, text: flushLine(cur) });
      cur = [b];
      anchorY = b.y;
    }
  }
  if (cur.length) lines.push({ y: anchorY, text: flushLine(cur) });
  let out = '';
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) out += (lines[i - 1].y - lines[i].y) > lh * 1.8 ? '\n\n' : '\n';
    out += lines[i].text;
  }
  return out;
}
function detectColumns(boxes, minX, maxX) {
  const width = maxX - minX;
  if (width <= 0) return [boxes];
  const BINS = 80;
  const binW = width / BINS;
  const cov = new Array(BINS).fill(0);
  for (const b of boxes) {
    const s = Math.max(0, Math.floor((b.x - minX) / binW));
    const e = Math.min(BINS - 1, Math.floor((b.x + b.w - minX) / binW));
    for (let i = s; i <= e; i++) cov[i]++;
  }
  let maxCov = 0;
  for (const c of cov) if (c > maxCov) maxCov = c;
  const thresh = Math.max(1, maxCov * 0.03); // bin gần như trống = khe giữa cột
  const cutXs = [];
  let i = 0;
  while (i < BINS) {
    if (cov[i] <= thresh) {
      let j = i;
      while (j < BINS && cov[j] <= thresh) j++;
      // chỉ tính khe NẰM GIỮA (không phải lề) và đủ rộng
      if (i > 0 && j < BINS && (j - i) * binW >= width * 0.02) {
        cutXs.push(minX + ((i + j) / 2) * binW);
      }
      i = j;
    } else i++;
  }
  if (!cutXs.length) return [boxes]; // một cột → giữ nguyên
  const bounds = [minX - 1, ...cutXs, maxX + 1];
  const cols = [];
  for (let c = 0; c < bounds.length - 1; c++) {
    const lo = bounds[c], hi = bounds[c + 1];
    const colBoxes = boxes.filter((b) => {
      const cx = b.x + b.w / 2;
      return cx >= lo && cx < hi;
    });
    if (colBoxes.length) cols.push(colBoxes);
  }
  return cols.length ? cols : [boxes];
}
async function extractText(page) {
  const tc = await page.getTextContent();
  const boxes = [];
  let minX = Infinity, maxX = -Infinity;
  for (const it of tc.items) {
    if (typeof it.str !== 'string' || !it.str.length) continue;
    const x = it.transform[4];
    const y = it.transform[5];
    const w = it.width || 0;
    const h = it.height || Math.abs(it.transform[3]) || 10;
    boxes.push({ x, y, w, h, str: it.str });
    if (x < minX) minX = x;
    if (x + w > maxX) maxX = x + w;
  }
  if (!boxes.length) return '';
  const columns = detectColumns(boxes, minX, maxX);
  const parts = columns.map((col) => linesFromBoxes(col));
  return parts.join('\n\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ---------- Translate ----------
// Trích chữ theo nhu cầu (mở tài liệu không còn trích sẵn mọi trang → mở nhanh hơn)
async function getSourceText(entry) {
  if (entry.sourceText != null) return entry.sourceText;
  try {
    const page = await pdfDoc.getPage(entry.pageNum);
    entry.sourceText = await extractText(page);
  } catch { entry.sourceText = ''; }
  return entry.sourceText;
}

async function translateOne(entry, force = false) {
  const apiKey = apiKeyEl.value.trim();
  if (!apiKey) { setStatus('Chưa nhập API key.', 'error'); apiKeyEl.focus(); return false; }
  if (!force && entryPlainText(entry).trim()) return true;

  const sourceText = await getSourceText(entry);
  if (!sourceText) { setPageStat(entry.statEl, 'trống', ''); return true; }

  setPageStat(entry.statEl, 'đang dịch…', 'working');
  try {
    const r = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: providerEl.value,
        apiKey,
        model: modelEl.value.trim(),
        skill: skillEl.value,
        text: sourceText,
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    setEntryTranslation(entry, data.translation || '');
    setPageStat(entry.statEl, 'xong', 'done');
    return true;
  } catch (err) {
    setPageStat(entry.statEl, 'lỗi', 'error');
    setStatus('Lỗi trang ' + (entry.index + 1) + ': ' + err.message, 'error');
    return false;
  }
}

// ---------- Modal chọn phạm vi ----------
function setModalHint(msg, error) {
  modalHintEl.textContent = msg || '';
  modalHintEl.className = 'modal-hint' + (error ? ' error' : '');
}
function openRangeModal() {
  if (!pages.length) return;
  modalTotalEl.textContent = String(pages.length);
  rangeFromEl.max = String(pages.length);
  rangeToEl.max = String(pages.length);
  rangeFromEl.value = '1';
  rangeToEl.value = String(pages.length);
  rangeAllEl.checked = false;
  rangeFromEl.disabled = false;
  rangeToEl.disabled = false;
  setModalHint('');
  modalEl.hidden = false;
  rangeFromEl.focus();
}
function closeRangeModal() { modalEl.hidden = true; }

function confirmRange() {
  const total = pages.length;
  let from = 1, to = total;
  if (!rangeAllEl.checked) {
    from = parseInt(rangeFromEl.value, 10);
    to = parseInt(rangeToEl.value, 10);
    if (!Number.isFinite(from) || !Number.isFinite(to)) {
      setModalHint('Nhập số trang bắt đầu và kết thúc.', true);
      return;
    }
    from = Math.min(Math.max(1, from), total);
    to = Math.min(Math.max(1, to), total);
    if (from > to) { const t = from; from = to; to = t; } // tự đảo nếu nhập ngược
  }
  closeRangeModal();
  if (viewMode === 'overlay') { runOverlayTranslate(overlayPages.slice(from - 1, to)); return; }
  runTranslate(pages.slice(from - 1, to));
}

// ---------- Dịch ----------
async function runTranslate(list) {
  const apiKey = apiKeyEl.value.trim();
  if (!apiKey) { setStatus('Chưa nhập API key.', 'error'); apiKeyEl.focus(); return; }
  if (!list.length) { setStatus('Không có trang nào để dịch.', 'error'); return; }
  saveSettings();
  translateBtn.disabled = true;
  openBtn.disabled = true;
  let ok = 0;
  for (let i = 0; i < list.length; i++) {
    setStatus(`Đang dịch ${i + 1}/${list.length} (trang ${list[i].index + 1})…`, 'working');
    const done = await translateOne(list[i], true);
    if (done) ok++;
    else break; // dừng nếu lỗi (thường do key/quota) để bạn xử lý
  }
  translateBtn.disabled = false;
  openBtn.disabled = false;
  if (ok === list.length) setStatus(`Đã dịch xong ${ok}/${list.length} trang.`, 'done');
  else setStatus(`Dừng ở ${ok}/${list.length} trang. Kiểm tra thông báo lỗi rồi thử lại.`, 'error');
}

// ---------- Export PDF ----------
async function exportPdf() {
  if (viewMode === 'overlay') return exportOverlayPdf();
  if (!pages.length) return;
  const payload = {
    title: docTitle + ' — bản dịch',
    pages: pages.map((p) => ({
      blocks: p.blocks
        .map((b) => b.type === 'image'
          ? { type: 'image', src: b.src, w: b.w || 0, h: b.h || 0, widthPct: clampPct(b.widthPct) }
          : { type: 'text', text: (b.text || '').trim() })
        .filter((b) => (b.type === 'image' ? !!b.src : !!b.text)),
    })),
  };
  setStatus('Đang tạo PDF…', 'working');
  try {
    const r = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${r.status}`);
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (docTitle || 'ban-dich') + ' - ban dich.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus('Đã tạo PDF.', 'done');
  } catch (err) {
    setStatus('Lỗi tạo PDF: ' + err.message, 'error');
  }
}

// ---------- Events ----------
openBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const f = fileInput.files && fileInput.files[0];
  if (f) { closeNav(); openFile(f).catch((e) => setStatus('Không mở được PDF: ' + e.message, 'error')); }
});
translateBtn.addEventListener('click', () => { closeNav(); openRangeModal(); });
exportBtn.addEventListener('click', exportPdf);
closeBtn.addEventListener('click', () => { closeNav(); closeDoc(); });

// Sao lưu / khôi phục dữ liệu
backupBtn.addEventListener('click', () => { closeNav(); openBackupModal(); });
backupGoBtn.addEventListener('click', doBackup);
backupCancelBtn.addEventListener('click', closeBackupModal);
backupModalEl.addEventListener('click', (e) => { if (e.target === backupModalEl) closeBackupModal(); });
bkPdfEl.addEventListener('change', updateBackupHint);
document.addEventListener('keydown', (e) => {
  if (backupModalEl.hidden) return;
  if (e.key === 'Escape') closeBackupModal();
  else if (e.key === 'Enter') doBackup();
});
restoreBtn.addEventListener('click', () => { closeNav(); restoreInput.click(); });
restoreInput.addEventListener('change', () => {
  const f = restoreInput.files && restoreInput.files[0];
  restoreInput.value = ''; // chọn lại cùng một file vẫn kích hoạt change
  if (f) restoreFromFile(f).catch((e) => setStatus('Khôi phục thất bại: ' + e.message, 'error'));
});

// ---------- Menu ☰ trên điện thoại: gộp cài đặt + công cụ ----------
function setNav(open) {
  topbarEl.classList.toggle('nav-open', open);
  if (menuToggle) menuToggle.setAttribute('aria-expanded', String(open));
}
// Thu menu sau khi chọn xong để lộ vùng đọc (chỉ có tác dụng khi menu đang mở/mobile)
function closeNav() { setNav(false); }
if (menuToggle) {
  menuToggle.addEventListener('click', () => setNav(!topbarEl.classList.contains('nav-open')));
}

// Thư viện: bấm tên để mở, bấm ✕ để gỡ
libraryEl.addEventListener('click', (e) => {
  const rem = e.target.closest('[data-remove]');
  if (rem) { removeDoc(rem.getAttribute('data-remove')); return; }
  const open = e.target.closest('.doc-open');
  if (open) { closeNav(); openFromLibrary(open.getAttribute('data-id')); }
});

// Modal
modalGoBtn.addEventListener('click', confirmRange);
modalCancelBtn.addEventListener('click', closeRangeModal);
modalEl.addEventListener('click', (e) => { if (e.target === modalEl) closeRangeModal(); });
rangeAllEl.addEventListener('change', () => {
  rangeFromEl.disabled = rangeAllEl.checked;
  rangeToEl.disabled = rangeAllEl.checked;
  setModalHint(rangeAllEl.checked ? 'Sẽ dịch toàn bộ tài liệu.' : '');
});
document.addEventListener('keydown', (e) => {
  if (modalEl.hidden) return;
  if (e.key === 'Escape') closeRangeModal();
  else if (e.key === 'Enter') confirmRange();
});
providerEl.addEventListener('change', () => { applyModelSuggest(); saveSettings(); refreshModelList(); });
[apiKeyEl, modelEl, skillEl, rememberEl].forEach((el) =>
  el.addEventListener('change', saveSettings));
apiKeyEl.addEventListener('input', updateKeyHint);
apiKeyEl.addEventListener('change', refreshModelList);
refreshModelList(); // key đã nhớ sẵn thì cập nhật danh sách ngay khi mở
// Ẩn / hiện API key
if (toggleKeyEl) toggleKeyEl.addEventListener('click', () => {
  const show = apiKeyEl.type === 'password';
  apiKeyEl.type = show ? 'text' : 'password';
  toggleKeyEl.textContent = show ? 'Ẩn' : 'Hiện';
  toggleKeyEl.setAttribute('aria-pressed', String(show));
  toggleKeyEl.setAttribute('aria-label', show ? 'Ẩn key' : 'Hiện key');
});
viewmodeEl.addEventListener('click', (e) => {
  const b = e.target.closest('.seg');
  if (b) { setMode(b.dataset.mode); closeNav(); }
});
zoomInBtn.addEventListener('click', () => setZoom(zoom + 0.15));
zoomOutBtn.addEventListener('click', () => setZoom(zoom - 0.15));
pageInput.addEventListener('change', gotoPageFromInput);
pageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); gotoPageFromInput(); pageInput.blur(); closeNav(); }
});

// Kiểu đọc + lật trang
readmodeEl.addEventListener('click', (e) => {
  const b = e.target.closest('.seg');
  if (b) { setReadMode(b.dataset.read); closeNav(); }
});
bookPrevBtn.addEventListener('click', () => bookGo(-1));
bookNextBtn.addEventListener('click', () => bookGo(1));
expandBtn.addEventListener('click', toggleBookFullscreen);
if (expandBtnM) expandBtnM.addEventListener('click', toggleBookFullscreen);
bookExitBtn.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); });
document.addEventListener('fullscreenchange', () => {
  if (readMode === 'book' && pdfDoc) requestAnimationFrame(renderBook);
  if (POMO.open) pomoReparent(); // đồng hồ phải theo vào/ra khỏi phần tử toàn màn hình
});
bookStage.addEventListener('click', (e) => {
  const r = bookStage.getBoundingClientRect();
  if (e.clientX - r.left < r.width / 2) bookGo(-1); else bookGo(1);
});
document.addEventListener('keydown', (e) => {
  if (readMode !== 'book' || !modalEl.hidden || !backupModalEl.hidden || !confirmEl.hidden) return;
  const ae = document.activeElement;
  if (ae && (ae.tagName === 'INPUT' || ae.isContentEditable)) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); bookGo(1); }
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); bookGo(-1); }
});

// ================= Chế độ "Đè trang" (overlay) =================
// Giữ nguyên ảnh/bố cục trang gốc, che chữ tiếng Anh rồi vẽ tiếng Việt đè đúng chỗ.
// Tối ưu cho tài liệu NỀN TRƠN (sách/giáo trình chữ). Khi bản dịch dài hơn: giãn
// trang xuống + co chữ nhẹ nếu cần, không để các khối đè lên nhau.

const OV_LINE = 1.3;               // hệ số giãn dòng khi vẽ chữ Việt
const OV_FONT = '"Be Vietnam Pro","Segoe UI",sans-serif';
let ovFontsReady = null;
function ensureFontsReady() {
  if (!ovFontsReady) {
    ovFontsReady = (document.fonts && document.fonts.ready)
      ? document.fonts.ready
          .then(() => Promise.all([
            document.fonts.load('400 16px "Be Vietnam Pro"'),
            document.fonts.load('600 16px "Be Vietnam Pro"'),
          ]))
          .catch(() => {})
      : Promise.resolve();
  }
  return ovFontsReady;
}

const medNum = (arr) => {
  const a = arr.filter((n) => n > 0).sort((m, n) => m - n);
  return a.length ? a[a.length >> 1] : 0;
};

// --- Trích KHỐI đoạn (giữ toạ độ) từ một trang PDF, hệ toạ độ điểm, gốc trên-trái ---
async function extractBlocks(page) {
  const tc = await page.getTextContent();
  const vp = page.getViewport({ scale: 1 });
  const Wp = vp.width, Hp = vp.height;
  const items = [];
  let minX = Infinity, maxX = -Infinity;
  for (const it of tc.items) {
    if (typeof it.str !== 'string' || !it.str.length) continue;
    const x = it.transform[4];
    const yb = it.transform[5];               // baseline y (gốc dưới, kiểu PDF)
    const w = it.width || 0;
    const fs = Math.abs(it.transform[3]) || it.height || 10;
    const top = Hp - yb - fs;                 // đổi sang gốc trên
    items.push({ x, top, bottom: top + fs, w, fs, str: it.str });
    if (x < minX) minX = x;
    if (x + w > maxX) maxX = x + w;
  }
  if (!items.length) return { blocks: [], Wp, Hp };
  const medFs = medNum(items.map((i) => i.fs)) || 10;

  const joinLine = (arr) => {
    arr.sort((a, b) => a.x - b.x);
    let s = '', prevR = null;
    for (const it of arr) {
      if (prevR !== null && it.x - prevR > it.fs * 0.3) s += ' ';
      s += it.str;
      prevR = it.x + it.w;
    }
    return { text: s, x: arr[0].x, right: Math.max(...arr.map((i) => i.x + i.w)),
      top: Math.min(...arr.map((i) => i.top)), bottom: Math.max(...arr.map((i) => i.bottom)),
      fs: medNum(arr.map((i) => i.fs)) || medFs };
  };

  const cols = detectColumns(items, minX, maxX); // dùng lại bộ tách cột sẵn có
  const blocks = [];
  cols.forEach((colItems, ci) => {
    const lh = medNum(colItems.map((i) => i.fs)) || medFs;
    const sorted = colItems.slice().sort((a, b) => (a.top - b.top) || (a.x - b.x));
    // gom thành dòng
    const lines = [];
    let cur = [], anchor = null;
    for (const it of sorted) {
      if (anchor === null || Math.abs(it.top - anchor) <= lh * 0.6) {
        cur.push(it);
        if (anchor === null) anchor = it.top;
      } else { lines.push(joinLine(cur)); cur = [it]; anchor = it.top; }
    }
    if (cur.length) lines.push(joinLine(cur));
    // gom dòng thành đoạn: ngắt khi cách dòng lớn hoặc cỡ chữ đổi (heading)
    let para = [];
    const flush = () => {
      if (!para.length) return;
      const x = Math.min(...para.map((l) => l.x));
      const right = Math.max(...para.map((l) => l.right));
      const top = Math.min(...para.map((l) => l.top));
      const bottom = Math.max(...para.map((l) => l.bottom));
      const fs = medNum(para.map((l) => l.fs)) || medFs;
      blocks.push({
        x, top, w: Math.max(0, right - x), h: Math.max(fs, bottom - top),
        fs, bold: fs >= medFs * 1.25, col: ci,
        text: para.map((l) => l.text).join(' ').replace(/\s+/g, ' ').trim(),
      });
      para = [];
    };
    for (let i = 0; i < lines.length; i++) {
      if (para.length) {
        const prev = para[para.length - 1];
        const gap = lines[i].top - prev.bottom;
        const fsChange = Math.abs(lines[i].fs - prev.fs) > prev.fs * 0.25;
        if (gap > lh * 0.9 || fsChange) flush();
      }
      para.push(lines[i]);
    }
    flush();
  });
  return { blocks: blocks.filter((b) => b.text && b.w >= 4), Wp, Hp };
}

// --- Đo & bẻ dòng chữ Việt cho vừa bề rộng khối ---
function wrapLines(ctx, text, maxW) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (line && ctx.measureText(t).width > maxW) { lines.push(line); line = w; }
    else line = t;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}
// Chọn cỡ chữ: giữ cỡ gốc nếu vừa; nếu dài, co tối đa 20% để bớt phần phải giãn.
function fitBlock(ctx, text, w, baseFs, boxH, bold) {
  const wrapW = Math.max(w, 24);
  const setFont = (f) => { ctx.font = `${bold ? 600 : 400} ${f}px ${OV_FONT}`; };
  let f = baseFs;
  setFont(f);
  let lines = wrapLines(ctx, text, wrapW);
  let needed = lines.length * f * OV_LINE;
  if (needed > boxH) {
    const fMin = Math.max(7, baseFs * 0.8);
    while (f > fMin && lines.length * f * OV_LINE > boxH * 1.3) {
      f = Math.max(fMin, +(f - 0.5).toFixed(2));
      setFont(f);
      lines = wrapLines(ctx, text, wrapW);
    }
    needed = lines.length * f * OV_LINE;
  }
  return { f, lines, needed };
}

function samplePixel(ctx, x, y) {
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  x = Math.max(0, Math.min(cw - 1, x | 0));
  y = Math.max(0, Math.min(ch - 1, y | 0));
  const d = ctx.getImageData(x, y, 1, 1).data;
  return [d[0], d[1], d[2]];
}
function medianColor(cols) {
  const ch = [0, 1, 2].map((k) => {
    const a = cols.map((c) => c[k]).sort((m, n) => m - n);
    return a[a.length >> 1];
  });
  return `rgb(${ch[0]},${ch[1]},${ch[2]})`;
}
// Lấy màu nền quanh khối (điểm ngay ngoài hộp chữ) — nền trơn nên rất khớp.
function sampleBgAround(bctx, b, S) {
  const midY = b.top + b.h / 2;
  const pts = [
    [b.x - 6, midY], [b.x + b.w + 6, midY],
    [b.x + b.w / 2, b.top - 6], [b.x + b.w / 2, b.top + b.h + 6],
  ];
  const cols = [];
  for (const [px, py] of pts) {
    const dx = Math.round(px * S), dy = Math.round(py * S);
    if (dx < 0 || dy < 0 || dx >= bctx.canvas.width || dy >= bctx.canvas.height) continue;
    cols.push(samplePixel(bctx, dx, dy));
  }
  return cols.length ? medianColor(cols) : null;
}

function hashBlocks(blocks) {
  return blocks.length + '#' + blocks.map((b) => b.text.length).join('.');
}

// --- Ghép một trang: bản gốc (che chữ) + chữ Việt đè lên, giãn trang khi cần ---
async function composeOverlay(entry, opts) {
  const page = await pdfDoc.getPage(entry.pageNum);
  const ext = entry.ext || (entry.ext = await extractBlocks(page));
  const { Wp, Hp, blocks } = ext;

  // Bỏ bản dịch đã lưu nếu không còn khớp cấu trúc khối hiện tại (tránh đè lệch chỗ).
  if (entry.translated && (entry.trHash !== hashBlocks(blocks) || entry.translated.length !== blocks.length)) {
    entry.translated = null;
  }
  const vis = entry.translated;

  let cssW, dpr;
  if (opts.mode === 'export') { cssW = Wp; dpr = Math.min(3, Math.max(2, 1600 / Wp)); }
  else { cssW = opts.cssW; dpr = Math.min(window.devicePixelRatio || 1, 2); }
  const scale = cssW / Wp;   // điểm → css px
  const S = scale * dpr;     // điểm → px thiết bị

  // 1) vẽ trang gốc (nền + chữ Anh) làm nền
  const bg = document.createElement('canvas');
  bg.width = Math.max(1, Math.round(Wp * S));
  bg.height = Math.max(1, Math.round(Hp * S));
  const bctx = bg.getContext('2d', { willReadFrequently: true });
  await page.render({ canvasContext: bctx, viewport: page.getViewport({ scale: S }) }).promise;
  const pageBg = samplePixel(bctx, 3, 3); // góc trên-trái ~ màu giấy

  // 2) dàn chữ Việt theo từng cột: khối dài đẩy các khối dưới cùng cột xuống
  const meas = document.createElement('canvas').getContext('2d');
  entry.drawBoxes = null;
  const byCol = new Map();
  blocks.forEach((b, i) => {
    if (!byCol.has(b.col)) byCol.set(b.col, []);
    byCol.get(b.col).push({ b, i });
  });
  let grownBottom = Hp;
  for (const col of byCol.values()) {
    col.sort((p, q) => p.b.top - q.b.top);
    let shift = 0;
    for (const { b, i } of col) {
      b._drawTop = b.top + shift;
      const vi = vis ? vis[i] : null;
      if (vi && String(vi).trim()) {
        b._draw = fitBlock(meas, vi, b.w, b.fs, b.h, b.bold);
        const dh = Math.max(b.h, b._draw.needed);
        shift += Math.max(0, b._draw.needed - b.h);
        grownBottom = Math.max(grownBottom, b._drawTop + dh);
      } else {
        b._draw = null;
        grownBottom = Math.max(grownBottom, b._drawTop + b.h);
      }
    }
  }
  const Hp2 = Math.max(Hp, grownBottom + Hp * 0.02);
  // Vị trí THẬT của từng khối sau khi dàn lại (bản dịch dài đẩy khối xuống) —
  // cần cho việc lấy chữ nằm dưới một vùng bôi ở chế độ Đè trang.
  entry.drawBoxes = blocks.map((b) => ({
    x: b.x, w: b.w, top: b._drawTop,
    h: Math.max(b.h, b._draw ? b._draw.needed : b.h),
  }));

  // 3) canvas kết quả: nền giấy phủ kín (kể cả phần giãn thêm), rồi dán trang gốc
  const out = opts.canvas;
  out.width = Math.max(1, Math.round(Wp * S));
  out.height = Math.max(1, Math.round(Hp2 * S));
  out.style.width = (Wp * scale) + 'px';
  out.style.height = (Hp2 * scale) + 'px';
  const ctx = out.getContext('2d');
  ctx.fillStyle = `rgb(${pageBg[0]},${pageBg[1]},${pageBg[2]})`;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(bg, 0, 0);

  // 4) che chữ Anh (tại vị trí GỐC) bằng màu nền cục bộ
  for (const b of blocks) {
    if (!b._draw) continue;
    ctx.fillStyle = sampleBgAround(bctx, b, S) || `rgb(${pageBg[0]},${pageBg[1]},${pageBg[2]})`;
    ctx.fillRect(Math.floor((b.x - 2) * S), Math.floor((b.top - 1) * S),
      Math.ceil((b.w + 4) * S), Math.ceil((b.h + 2) * S));
  }
  // 5) vẽ chữ Việt (tại vị trí đã dàn lại)
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#14110E';
  for (const b of blocks) {
    if (!b._draw) continue;
    const f = b._draw.f;
    ctx.font = `${b.bold ? 600 : 400} ${f * S}px ${OV_FONT}`;
    let y = b._drawTop;
    for (const line of b._draw.lines) {
      ctx.fillText(line, Math.round(b.x * S), Math.round(y * S));
      y += f * OV_LINE;
    }
  }
  // 6) khi xuất PDF: vẽ luôn vệt bôi vào ảnh trang (trên màn hình đã có lớp DOM riêng)
  if (opts.mode === 'export') paintRectsOnCanvas(ctx, entry.pageNum - 1, out.width, 'ov');
  return { wPt: Wp, hPt: Hp2 };
}

// ---------- Dựng mặt phẳng "Đè trang" ----------
const ovKey = (id) => `ptr.ov.${id}`;
function loadOverlayAll() {
  try { return JSON.parse(localStorage.getItem(ovKey(docId)) || '{}'); } catch { return {}; }
}
function saveOverlayTr(pageIdx, blocks, viArr) {
  const all = loadOverlayAll();
  all[pageIdx] = { h: hashBlocks(blocks), vi: viArr };
  try { localStorage.setItem(ovKey(docId), JSON.stringify(all)); }
  catch { setStatus('Không lưu được bản dịch đè trang (bộ nhớ trình duyệt đầy).', 'error'); }
}

function setOvStat(entry, msg, kind = '') {
  if (!entry.statEl) return;
  entry.statEl.textContent = msg || '';
  entry.statEl.className = 'ov-stat' + (kind ? ' ' + kind : '');
}

function overlayColWidth() {
  const cw = (overlayEl.clientWidth || window.innerWidth) - 28;
  return Math.max(280, Math.min(cw, 940)) * zoom;
}

function buildOverlaySurface() {
  overlayEl.innerHTML = '';
  overlayPages.length = 0;
  const all = loadOverlayAll();
  const frag = document.createDocumentFragment();
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const wrap = document.createElement('div');
    wrap.className = 'ov-page';
    const head = document.createElement('div');
    head.className = 'ov-head';
    const tag = document.createElement('div');
    tag.className = 'ov-tag';
    tag.textContent = `Trang ${i} / ${pdfDoc.numPages}`;
    const btn = document.createElement('button');
    btn.className = 'ov-btn';
    btn.type = 'button';
    head.append(tag, makeBookmarkBtn(i - 1), btn);
    const canvas = document.createElement('canvas');
    canvas.className = 'ov-canvas';
    const cwrap = document.createElement('div');
    cwrap.className = 'canvas-wrap';
    const hlLayer = document.createElement('div');
    hlLayer.className = 'hl-layer';
    hlLayer.dataset.p = String(i - 1);
    cwrap.append(canvas, hlLayer);
    const stat = document.createElement('div');
    stat.className = 'ov-stat';
    wrap.append(head, cwrap, stat);
    const rec = all[i - 1];
    const entry = {
      pageNum: i, el: wrap, canvas, statEl: stat, btnEl: btn, ext: null, hlLayer,
      translated: rec && Array.isArray(rec.vi) ? rec.vi : null,
      trHash: rec ? rec.h : '', composed: false, composing: false, sig: '',
    };
    btn.textContent = entry.translated ? 'Dịch lại' : 'Dịch';
    if (entry.translated) setOvStat(entry, 'đã dịch', 'done');
    else setOvStat(entry, 'chưa dịch', '');
    btn.addEventListener('click', () => translateOverlayOne(entry));
    wrap._ov = entry;
    overlayPages.push(entry);
    frag.appendChild(wrap);
  }
  overlayEl.appendChild(frag);
}

function setupOverlayObserver() {
  if (overlayObserver) overlayObserver.disconnect();
  overlayObserver = new IntersectionObserver((ents) => {
    for (const it of ents) if (it.isIntersecting && it.target._ov) ensureComposed(it.target._ov);
  }, { rootMargin: '900px 0px' });
  for (const e of overlayPages) overlayObserver.observe(e.el);
}

async function ensureComposed(entry, force) {
  if (!pdfDoc || viewMode !== 'overlay') return;
  if (!entry.el || entry.el.clientWidth < 10) return;
  const cssW = overlayColWidth();
  const trTag = entry.translated ? (entry.translated.length + ':' + (entry.trHash || '')) : 'none';
  const sig = Math.round(cssW) + '|' + trTag;
  if (!force && entry.composed && entry.sig === sig) return;
  if (entry.composing) return;
  entry.composing = true;
  try {
    await ensureFontsReady();
    const dims = await composeOverlay(entry, { canvas: entry.canvas, cssW, mode: 'screen' });
    entry.composed = true;
    entry.sig = sig;
    // Trang đè có thể cao thêm khi bản dịch dài → vẽ lại vệt bôi theo tỉ lệ mới
    paintRectLayer(entry.hlLayer, entry.pageNum - 1, dims.hPt / dims.wPt, 'ov');
  } catch (e) {
    reportRenderError(entry.pageNum, e); // giữ canvas cũ, nhưng phải nói ra là hỏng
  } finally {
    entry.composing = false;
  }
}

function composeVisibleOverlay() {
  const vh = window.innerHeight;
  for (const e of overlayPages) {
    const r = e.el.getBoundingClientRect();
    if (r.bottom > -vh && r.top < vh * 2) ensureComposed(e);
  }
}

function overlayCurrentTop() {
  const off = stickyOffset() + 1;
  for (let i = 0; i < overlayPages.length; i++) {
    if (overlayPages[i].el.getBoundingClientRect().bottom > off) return i;
  }
  return overlayPages.length ? overlayPages.length - 1 : 0;
}
function scrollOverlayToPage(idx) {
  const e = overlayPages[idx];
  if (!e) return;
  const top = e.el.getBoundingClientRect().top + window.scrollY - stickyOffset();
  window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
}

let ovScrollTimer = null;
function overlayScroll() {
  if (document.activeElement !== pageInput) pageInput.value = String(overlayCurrentTop() + 1);
  composeVisibleOverlay();
  syncFollowScope();
  if (suppressScrollSave) return;
  if (ovScrollTimer) return;
  ovScrollTimer = setTimeout(() => {
    ovScrollTimer = null;
    if (suppressScrollSave || !docId) return; // đang khôi phục/đổi tài liệu → bỏ qua
    localStorage.setItem(pageKey(docId), String(overlayCurrentTop()));
  }, 200);
}

function renderOverlay(keep) {
  if (!pdfDoc) return;
  if (overlayPages.length !== pdfDoc.numPages) buildOverlaySurface();
  setupOverlayObserver();
  pageTotalEl.textContent = String(pdfDoc.numPages);
  pageInput.max = String(pdfDoc.numPages);
  pageInput.disabled = false;
  pageInput.value = String(Math.min(pdfDoc.numPages, (keep || 0) + 1));
  suppressScrollSave = true;
  requestAnimationFrame(() => {
    scrollOverlayToPage(keep || 0);
    composeVisibleOverlay();
    setTimeout(() => { suppressScrollSave = false; }, 450);
  });
}

// ---------- Dịch cho chế độ Đè trang ----------
async function translateOverlayPage(entry) {
  const apiKey = apiKeyEl.value.trim();
  const page = await pdfDoc.getPage(entry.pageNum);
  const ext = entry.ext || (entry.ext = await extractBlocks(page));
  const texts = ext.blocks.map((b) => b.text);
  if (!texts.length) { entry.translated = []; entry.trHash = hashBlocks(ext.blocks); return true; }

  const r = await fetch('/api/translate-blocks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: providerEl.value, apiKey, model: modelEl.value.trim(),
      skill: skillEl.value, blocks: texts,
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  const arr = Array.isArray(data.translations) ? data.translations : [];
  entry.translated = arr;
  entry.trHash = hashBlocks(ext.blocks);
  saveOverlayTr(entry.pageNum - 1, ext.blocks, arr);
  return true;
}

// Dịch NGAY một trang (nút "Dịch" trên chính trang đó).
async function translateOverlayOne(entry) {
  const apiKey = apiKeyEl.value.trim();
  if (!apiKey) { setStatus('Chưa nhập API key.', 'error'); apiKeyEl.focus(); return; }
  saveSettings();
  if (entry.btnEl) { entry.btnEl.disabled = true; entry.btnEl.textContent = 'Đang dịch…'; }
  setOvStat(entry, 'đang dịch…', 'working');
  setStatus(`Đang dịch trang ${entry.pageNum}…`, 'working');
  try {
    await translateOverlayPage(entry);
    setOvStat(entry, 'đã dịch', 'done');
    setStatus(`Đã dịch xong trang ${entry.pageNum}.`, 'done');
    entry.composed = false;
    ensureComposed(entry, true);
  } catch (err) {
    setOvStat(entry, 'lỗi', 'error');
    setStatus('Lỗi trang ' + entry.pageNum + ': ' + err.message, 'error');
  } finally {
    if (entry.btnEl) { entry.btnEl.disabled = false; entry.btnEl.textContent = entry.translated ? 'Dịch lại' : 'Dịch'; }
  }
}

async function runOverlayTranslate(list) {
  const apiKey = apiKeyEl.value.trim();
  if (!apiKey) { setStatus('Chưa nhập API key.', 'error'); apiKeyEl.focus(); return; }
  if (!list.length) { setStatus('Không có trang nào để dịch.', 'error'); return; }
  saveSettings();
  translateBtn.disabled = true;
  openBtn.disabled = true;
  let ok = 0;
  for (let i = 0; i < list.length; i++) {
    const entry = list[i];
    setStatus(`Đang dịch ${i + 1}/${list.length} (trang ${entry.pageNum})…`, 'working');
    setOvStat(entry, 'đang dịch…', 'working');
    try {
      await translateOverlayPage(entry);
      ok++;
      setOvStat(entry, 'đã dịch', 'done');
      if (entry.btnEl) entry.btnEl.textContent = 'Dịch lại';
      entry.composed = false;
      ensureComposed(entry, true);
    } catch (err) {
      setOvStat(entry, 'lỗi', 'error');
      setStatus('Lỗi trang ' + entry.pageNum + ': ' + err.message, 'error');
      break;
    }
  }
  translateBtn.disabled = false;
  openBtn.disabled = false;
  if (ok === list.length) setStatus(`Đã dịch xong ${ok}/${list.length} trang (Đè trang).`, 'done');
  else setStatus(`Dừng ở ${ok}/${list.length} trang. Kiểm tra lỗi rồi thử lại.`, 'error');
}

// ---------- Xuất PDF Đè trang (mỗi trang là 1 ảnh đã ghép, đúng khổ) ----------
async function exportOverlayPdf() {
  if (!pdfDoc || !overlayPages.length) { setStatus('Chưa có trang để xuất.', 'error'); return; }
  setStatus('Đang tạo PDF đè trang…', 'working');
  exportBtn.disabled = true;
  try {
    await ensureFontsReady();
    const out = [];
    const cnv = document.createElement('canvas');
    for (let i = 0; i < overlayPages.length; i++) {
      setStatus(`Đang dựng trang ${i + 1}/${overlayPages.length}…`, 'working');
      const dims = await composeOverlay(overlayPages[i], { canvas: cnv, mode: 'export' });
      out.push({ img: cnv.toDataURL('image/jpeg', 0.9), w: dims.wPt, h: dims.hPt });
    }
    const r = await fetch('/api/export-overlay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: docTitle + ' — đè trang', pages: out }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.error || `HTTP ${r.status}`);
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (docTitle || 'ban-dich') + ' - de trang.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus('Đã tạo PDF đè trang.', 'done');
  } catch (err) {
    setStatus('Lỗi tạo PDF: ' + err.message, 'error');
  } finally {
    exportBtn.disabled = false;
  }
}

// =========================================================================
// BOOKMARK · HIGHLIGHT · GHI CHÚ CORNELL
// Toàn bộ dữ liệu của ba tính năng này nằm chung MỘT khoá localStorage cho mỗi
// tài liệu (`ptr.note.<docId>`) → một lần đọc/ghi, dễ sao lưu, dễ dọn khi gỡ sách:
//   bookmarks  [{ p, label, at }]                       — đánh dấu theo TRANG
//   highlights [{ id, k:'t'|'r', p, ... , c, q }]        — 't' = chữ trong cột bản
//              dịch (neo theo vị trí ký tự), 'r' = vùng kéo trên trang gốc / đè
//              trang (toạ độ chuẩn hoá theo BỀ RỘNG trang → đúng ở mọi mức zoom)
//   chapters   [{ id, title, from, src }]                — mốc chương (từ mục lục
//              nhúng trong PDF, hoặc do người đọc tự cắt)
//   notes      { '<chapterId>'|'__doc__': { cue, note, sum } }  — Cornell
// =========================================================================

const noteKey = (id) => `ptr.note.${id}`;
const DOC_SCOPE = '__doc__';
const HL_COLORS = { y: '#FFE08A', b: '#BEDDF3', p: '#F6C7D8', g: '#CFE7B4' };
const HL_NAMES = { y: 'Quan trọng', b: 'Định nghĩa', p: 'Chưa hiểu', g: 'Ví dụ' };

function emptyNoteStore() {
  return { bookmarks: [], highlights: [], chapters: [], notes: {}, chaptersInit: false };
}
let NOTE = emptyNoteStore();
let hlMode = false;         // đang bật kéo-vùng-bôi trên trang gốc?
let hlColor = 'y';          // màu mặc định khi bôi
let noteFollow = true;      // ghi chú tự bám chương đang đọc
let noteTab = 'bm';         // tab đang mở trong ngăn kéo

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

function loadNotes(id) {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(noteKey(id)) || 'null'); } catch {}
  const out = emptyNoteStore();
  if (!s || typeof s !== 'object') return out;
  out.bookmarks = Array.isArray(s.bookmarks) ? s.bookmarks.filter((b) => b && Number.isFinite(b.p)) : [];
  out.highlights = Array.isArray(s.highlights) ? s.highlights.filter((h) => h && h.id && Number.isFinite(h.p)) : [];
  out.chapters = Array.isArray(s.chapters) ? s.chapters.filter((c) => c && c.id && Number.isFinite(c.from)) : [];
  out.notes = (s.notes && typeof s.notes === 'object') ? s.notes : {};
  out.chaptersInit = !!s.chaptersInit;
  return out;
}

let noteSaveTimer = null;
function saveNotes() {
  if (!docId) return;
  // Bỏ các ô Cornell rỗng (chỉ mở ra xem rồi thôi) cho khỏi phình bộ nhớ
  const notes = {};
  for (const [k, v] of Object.entries(NOTE.notes)) {
    if (v && ((v.cue || '').trim() || (v.note || '').trim() || (v.sum || '').trim())) notes[k] = v;
  }
  try {
    localStorage.setItem(noteKey(docId), JSON.stringify({ ...NOTE, notes }));
  } catch {
    setStatus('Không lưu được ghi chú: bộ nhớ trình duyệt đã đầy.', 'error');
  }
}
// Gõ ghi chú thì ghi trễ (300ms) cho đỡ tốn, nhưng mọi thao tác bấm nút lưu ngay.
function scheduleNoteSave() {
  if (noteSaveTimer) clearTimeout(noteSaveTimer);
  noteSaveTimer = setTimeout(() => { noteSaveTimer = null; saveNotes(); }, 300);
}
function flushNotes() {
  if (noteSaveTimer) { clearTimeout(noteSaveTimer); noteSaveTimer = null; }
  saveNotes();
}
window.addEventListener('pagehide', flushNotes);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushNotes();
});

// Gộp ghi chú khi khôi phục từ bản sao lưu: bookmark gộp theo trang, highlight gộp
// theo id, ô Cornell nào có nội dung trong file thì lấy theo file.
function mergeNoteStore(id, incoming) {
  if (!incoming || typeof incoming !== 'object') return true;
  const cur = readJsonKey(noteKey(id));
  let out = incoming;
  if (cur && typeof cur === 'object') {
    const bm = new Map();
    for (const b of [...(cur.bookmarks || []), ...(incoming.bookmarks || [])]) if (b && Number.isFinite(b.p)) bm.set(b.p, b);
    const hl = new Map();
    for (const h of [...(cur.highlights || []), ...(incoming.highlights || [])]) if (h && h.id) hl.set(h.id, h);
    out = {
      bookmarks: [...bm.values()].sort((a, b) => a.p - b.p),
      highlights: [...hl.values()],
      chapters: (incoming.chapters && incoming.chapters.length) ? incoming.chapters : (cur.chapters || []),
      chaptersInit: !!(cur.chaptersInit || incoming.chaptersInit),
      notes: { ...(cur.notes || {}), ...(incoming.notes || {}) },
    };
  }
  try { localStorage.setItem(noteKey(id), JSON.stringify(out)); return true; }
  catch { return false; }
}

// ---------- Chương ----------
// Ưu tiên MỤC LỤC nhúng sẵn trong file PDF (hầu hết sách/giáo trình đều có) —
// không bắt người đọc khai báo tay. Không có mục lục thì tự cắt bằng nút.
async function destPage(dest) {
  try {
    let d = dest;
    if (typeof d === 'string') d = await pdfDoc.getDestination(d);
    if (!Array.isArray(d) || !d.length) return null;
    const ref = d[0];
    if (ref && typeof ref === 'object') return await pdfDoc.getPageIndex(ref);
    if (typeof ref === 'number') return ref;
  } catch {}
  return null;
}
async function chaptersFromOutline() {
  let tree = null;
  try { tree = await pdfDoc.getOutline(); } catch { return []; }
  if (!Array.isArray(tree) || !tree.length) return [];
  // Mục lục chỉ có một mục gốc (kiểu "Nội dung") → lấy các mục con làm chương
  let level = tree;
  if (level.length === 1 && Array.isArray(level[0].items) && level[0].items.length > 1) level = level[0].items;
  const res = [];
  for (const it of level) {
    const p = await destPage(it.dest);
    if (p == null || p < 0) continue;
    res.push({ id: uid(), title: String(it.title || '').trim() || `Trang ${p + 1}`, from: p, src: 'outline' });
  }
  res.sort((a, b) => a.from - b.from);
  const out = [];
  for (const c of res) if (!out.length || out[out.length - 1].from !== c.from) out.push(c);
  return out.slice(0, 300);
}
async function initChapters() {
  if (!pdfDoc || NOTE.chaptersInit) return;
  const id = docId;
  NOTE.chaptersInit = true;
  const list = await chaptersFromOutline();
  if (id !== docId) return; // đổi tài liệu giữa chừng → đừng ghi nhầm sang sách khác
  if (list.length) NOTE.chapters = list;
  saveNotes();
}
function sortedChapters() { return NOTE.chapters.slice().sort((a, b) => a.from - b.from); }
function chapterAt(pageIdx) {
  const list = sortedChapters();
  let cur = null;
  for (const c of list) { if (c.from <= pageIdx) cur = c; else break; }
  return cur;
}
function chapterById(id) { return NOTE.chapters.find((c) => c.id === id) || null; }
function chapterRange(ch) {
  const list = sortedChapters();
  const i = list.findIndex((c) => c.id === ch.id);
  const total = pdfDoc ? pdfDoc.numPages : (pages.length || 1);
  const to = (i >= 0 && i + 1 < list.length) ? list[i + 1].from - 1 : total - 1;
  return [ch.from, Math.max(ch.from, to)];
}
function chapterLabel(ch) {
  const [a, b] = chapterRange(ch);
  return `${ch.title} (tr.${a + 1}–${b + 1})`;
}
// Chương chứa một trang; không có mốc chương nào thì ghi vào note cả tài liệu.
function scopeForPage(p) {
  const c = chapterAt(p);
  return c ? c.id : DOC_SCOPE;
}

// ---------- Trang đang đọc (dùng chung cho bookmark / ghi chú) ----------
// Trả về chỉ số trang PDF (0-based). Riêng "đọc sách + bản dịch" thì số trang là
// trang bản dịch đã dàn lại, không suy ra được trang gốc → trả -1.
function readingPageIndex() {
  if (!pdfDoc) return -1;
  if (viewMode === 'overlay') return overlayPages.length ? overlayCurrentTop() : 0;
  if (readMode === 'book') return viewMode === 'trans' ? -1 : bookIndex;
  return pages.length ? currentTopPage() : 0;
}
function jumpToPage(idx) {
  if (!pdfDoc) return;
  pageInput.value = String(idx + 1);
  gotoPageFromInput();
}

// ---------- Bookmark ----------
function bmIndex(p) { return NOTE.bookmarks.findIndex((b) => b.p === p); }
function isBookmarked(p) { return bmIndex(p) >= 0; }
// Nhãn mặc định: mấy chữ đầu của bản dịch trang đó → danh sách đọc ra nghĩa,
// thay vì chỉ trơ ra "Trang 47".
function defaultBmLabel(p) {
  let t = '';
  const e = pages[p];
  if (e) t = entryPlainText(e);
  if (!t) {
    const ov = overlayPages[p];
    if (ov && Array.isArray(ov.translated)) t = ov.translated.filter(Boolean).join(' ');
  }
  t = (t || '').replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, 60) : `Trang ${p + 1}`;
}
function makeBookmarkBtn(p) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'bm-btn' + (isBookmarked(p) ? ' on' : '');
  b.dataset.p = String(p);
  b.textContent = isBookmarked(p) ? '★' : '☆';
  b.title = 'Đánh dấu trang này (phím B)';
  b.setAttribute('aria-label', `Đánh dấu trang ${p + 1}`);
  b.addEventListener('click', (e) => { e.stopPropagation(); toggleBookmark(p); });
  return b;
}
function refreshBookmarkBtns(p) {
  const on = isBookmarked(p);
  document.querySelectorAll(`.bm-btn[data-p="${p}"]`).forEach((b) => {
    b.classList.toggle('on', on);
    b.textContent = on ? '★' : '☆';
  });
}
function toggleBookmark(p) {
  if (!docId) { setStatus('Chưa mở tài liệu nào để đánh dấu.', 'error'); return; }
  if (p == null || p < 0) {
    setStatus('Chế độ “Đọc sách + Bản dịch” không xác định được trang gốc — chuyển sang Bản gốc hoặc Kéo lướt để đánh dấu.', 'error');
    return;
  }
  const i = bmIndex(p);
  if (i >= 0) { NOTE.bookmarks.splice(i, 1); setStatus(`Đã bỏ đánh dấu trang ${p + 1}.`, ''); }
  else {
    NOTE.bookmarks.push({ p, label: defaultBmLabel(p), at: Date.now() });
    NOTE.bookmarks.sort((a, b) => a.p - b.p);
    setStatus(`Đã đánh dấu trang ${p + 1}.`, 'done');
  }
  saveNotes();
  refreshBookmarkBtns(p);
  if (noteTab === 'bm') renderBmList();
}

// ---------- Highlight: dữ liệu ----------
function textHls(p, b) { return NOTE.highlights.filter((h) => h.k === 't' && h.p === p && h.b === b); }
// Vùng bôi gắn với đúng MẶT PHẲNG đã vẽ nó: 'orig' (trang gốc — kéo lướt & đọc
// sách) hay 'ov' (đè trang). Hai mặt phẳng không cùng hệ toạ độ vì trang đè giãn
// cao thêm khi bản dịch dài, nên vẽ chéo sang nhau sẽ lệch chỗ.
function rectHls(p, surface) {
  return NOTE.highlights.filter((h) =>
    h.k === 'r' && h.p === p && (surface ? (h.o ? 'ov' : 'orig') === surface : true));
}
function hlById(id) { return NOTE.highlights.find((h) => h.id === id) || null; }
function removeHl(id) {
  const h = hlById(id);
  if (!h) return;
  NOTE.highlights = NOTE.highlights.filter((x) => x.id !== id);
  saveNotes();
  repaintHl(h);
  if (noteTab === 'hl') renderHlList();
}
function setHlColor(id, c) {
  const h = hlById(id);
  if (!h) return;
  h.c = c;
  saveNotes();
  repaintHl(h);
  if (noteTab === 'hl') renderHlList();
}
// Vẽ lại đúng chỗ chứa một highlight (cột bản dịch hoặc lớp đè trên canvas)
function repaintHl(h) {
  if (h.k === 't') {
    const ed = document.querySelector(`.editor[data-p="${h.p}"][data-b="${h.b}"]`);
    if (ed) paintEditor(ed);
  } else {
    const e = pages[h.p];
    if (e) paintRectLayer(e.hlLayer, h.p, e.aspect, 'orig');
    const ov = overlayPages[h.p];
    if (ov) paintRectLayer(ov.hlLayer, h.p, ovAspect(ov), 'ov');
    if (readMode === 'book' && viewMode === 'orig' && pdfDoc) renderBook();
  }
}

// ---------- Highlight: chữ trong cột bản dịch ----------
// Lưu theo VỊ TRÍ KÝ TỰ (không nhét thẻ vào nội dung) → bản dịch vẫn là chữ thuần
// như cũ; kèm `q` (đoạn chữ đã bôi) để neo lại khi bạn sửa chữ làm lệch vị trí.
function paintEditor(ed) {
  if (!ed) return;
  const p = Number(ed.dataset.p), b = Number(ed.dataset.b);
  const entry = pages[p];
  const block = entry && entry.blocks[b];
  if (!block || block.type !== 'text') return;
  const text = block.text || '';
  const hs = textHls(p, b).slice().sort((a, z) => a.s - z.s);
  const fs = findRangesFor(p, b);
  if (!hs.length && !fs.length) {
    if (ed.childElementCount) ed.textContent = text; // gỡ vệt cũ, chuẩn hoá lại DOM
    return;
  }
  // Vệt bôi và vệt tìm thấy có thể lồng lên nhau → cắt chữ tại mọi mốc đầu/cuối
  // rồi tô từng mẩu một, thay vì cố nhét thẻ này vào trong thẻ kia.
  const clamp = (n) => Math.max(0, Math.min(Number(n) || 0, text.length));
  const cuts = new Set([0, text.length]);
  for (const h of hs) { cuts.add(clamp(h.s)); cuts.add(clamp(h.e)); }
  for (const f of fs) { cuts.add(clamp(f.s)); cuts.add(clamp(f.e)); }
  const marks = [...cuts].sort((a, z) => a - z);
  let html = '';
  for (let i = 0; i < marks.length - 1; i++) {
    const s = marks[i], e = marks[i + 1];
    if (e <= s) continue;
    const seg = escapeHtml(text.slice(s, e));
    const h = hs.find((x) => clamp(x.s) <= s && clamp(x.e) >= e);
    const f = fs.find((x) => clamp(x.s) <= s && clamp(x.e) >= e);
    if (f) {
      // Giữ nguyên data-h để bấm vào vẫn mở được thanh đổi màu của vệt bôi bên dưới
      const attr = h ? ` data-h="${h.id}" data-c="${h.c}"` : '';
      html += `<mark class="findmark${f.i === FIND.cur ? ' find-cur' : ''}" data-fi="${f.i}"${attr}>${seg}</mark>`;
    } else if (h) {
      html += `<mark data-h="${h.id}" data-c="${h.c}">${seg}</mark>`;
    } else html += seg;
  }
  ed.innerHTML = html;
}
// Vị trí ký tự của một điểm trong ô chữ (tính theo nội dung thuần, bỏ qua thẻ <mark>)
function offsetIn(root, node, off) {
  if (node === root) {
    let n = 0;
    for (let i = 0; i < off && i < root.childNodes.length; i++) n += (root.childNodes[i].textContent || '').length;
    return n;
  }
  let n = 0;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let cur;
  while ((cur = w.nextNode())) {
    if (cur === node) return n + off;
    n += cur.nodeValue.length;
  }
  return n;
}
function textSelectionInfo() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const r = sel.getRangeAt(0);
  const startEl = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
  const ed = startEl && startEl.closest ? startEl.closest('.editor') : null;
  if (!ed || !ed.contains(r.endContainer)) return null;
  const a = offsetIn(ed, r.startContainer, r.startOffset);
  const z = offsetIn(ed, r.endContainer, r.endOffset);
  const s = Math.min(a, z), e = Math.max(a, z);
  if (e - s < 1) return null;
  return { ed, s, e, rect: r.getBoundingClientRect() };
}
function addTextHl(info, color) {
  const p = Number(info.ed.dataset.p), b = Number(info.ed.dataset.b);
  const entry = pages[p];
  const block = entry && entry.blocks[b];
  if (!block) return null;
  const text = block.text || '';
  // Bôi đè lên vệt cũ → gỡ vệt cũ đi cho gọn, một vùng chỉ một màu
  NOTE.highlights = NOTE.highlights.filter(
    (h) => !(h.k === 't' && h.p === p && h.b === b && h.s < info.e && h.e > info.s));
  const h = { id: uid(), k: 't', p, b, s: info.s, e: info.e, c: color, q: text.slice(info.s, info.e) };
  NOTE.highlights.push(h);
  saveNotes();
  paintEditor(info.ed);
  if (noteTab === 'hl') renderHlList();
  return h;
}
// Sau khi sửa chữ: tìm lại đoạn đã bôi trong nội dung mới (chọn vị trí gần chỗ cũ
// nhất). Không tìm thấy nữa → bỏ vệt bôi đó thay vì để nó trôi lung tung.
function nearestIndex(text, q, want) {
  if (!q) return -1;
  let best = -1, bestD = Infinity, i = text.indexOf(q);
  while (i >= 0) {
    const d = Math.abs(i - want);
    if (d < bestD) { bestD = d; best = i; }
    i = text.indexOf(q, i + 1);
  }
  return best;
}
// Thêm / xoá / đổi chỗ khối chữ làm số thứ tự khối lệch đi → dời neo highlight theo,
// nếu không vệt bôi sẽ nhảy sang nhầm khối.
function shiftTextHls(p, op, k) {
  let dropped = 0;
  for (const h of NOTE.highlights) {
    if (h.k !== 't' || h.p !== p) continue;
    if (op === 'insert') { if (h.b >= k) h.b++; }
    else if (op === 'remove') {
      if (h.b === k) { h.dead = true; dropped++; }
      else if (h.b > k) h.b--;
    } else if (op === 'swap') {
      if (h.b === k[0]) h.b = k[1];
      else if (h.b === k[1]) h.b = k[0];
    }
  }
  if (dropped) NOTE.highlights = NOTE.highlights.filter((h) => !h.dead);
  saveNotes();
  if (noteTab === 'hl') renderHlList();
}

function reanchorText(p, b) {
  const entry = pages[p];
  const block = entry && entry.blocks[b];
  if (!block) return;
  const text = block.text || '';
  let changed = false, dropped = 0;
  for (const h of NOTE.highlights) {
    if (h.k !== 't' || h.p !== p || h.b !== b) continue;
    if (text.slice(h.s, h.e) === h.q) continue; // vẫn đúng chỗ
    const i = nearestIndex(text, h.q, h.s);
    if (i >= 0) { h.s = i; h.e = i + h.q.length; }
    else { h.dead = true; dropped++; }
    changed = true;
  }
  if (dropped) NOTE.highlights = NOTE.highlights.filter((h) => !h.dead);
  if (changed) {
    saveNotes();
    if (noteTab === 'hl') renderHlList();
    if (dropped) setStatus(`${dropped} vệt bôi đã mất chỗ neo sau khi bạn sửa chữ nên được gỡ bỏ.`, '');
  }
}

// ---------- Highlight: vùng kéo trên trang gốc / đè trang ----------
// Toạ độ lưu theo BỀ RỘNG trang (x, y, w, h đều là tỉ lệ so với bề rộng) → phóng
// to, đổi chế độ xem hay xuất PDF đều đặt lại đúng chỗ, không cần tính lại gì.
function ovAspect(ovEntry) {
  const w = parseFloat(ovEntry.canvas.style.width) || 0;
  const h = parseFloat(ovEntry.canvas.style.height) || 0;
  return (w > 0 && h > 0) ? h / w : 1.414;
}
function paintRectLayer(layer, p, aspect, surface) {
  if (!layer) return;
  const asp = (aspect > 0.05 && Number.isFinite(aspect)) ? aspect : 1.414;
  layer.innerHTML = '';
  for (const h of rectHls(p, surface)) {
    const d = document.createElement('div');
    d.className = 'hl-rect';
    d.dataset.h = h.id;
    d.style.left = (h.x * 100) + '%';
    d.style.width = (h.w * 100) + '%';
    d.style.top = (h.y / asp * 100) + '%';   // % chiều dọc = (y·W)/H = y/tỉ-lệ-trang
    d.style.height = (h.h / asp * 100) + '%';
    d.style.background = HL_COLORS[h.c] || HL_COLORS.y;
    d.title = (h.q ? h.q.slice(0, 80) + ' — ' : '') + 'bấm để đổi màu / gửi vào ghi chú';
    layer.appendChild(d);
  }
}
function repaintAllRectLayers() {
  for (const e of pages) paintRectLayer(e.hlLayer, e.index, e.aspect, 'orig');
  for (const e of overlayPages) paintRectLayer(e.hlLayer, e.pageNum - 1, ovAspect(e), 'ov');
}
// Vẽ thẳng vào canvas — dùng cho chế độ Đọc sách và lúc xuất PDF đè trang
function paintRectsOnCanvas(ctx, p, widthPx, surface) {
  const hs = rectHls(p, surface);
  if (!hs.length || !ctx) return;
  ctx.save();
  ctx.globalAlpha = 0.42;
  for (const h of hs) {
    ctx.fillStyle = HL_COLORS[h.c] || HL_COLORS.y;
    ctx.fillRect(h.x * widthPx, h.y * widthPx, h.w * widthPx, h.h * widthPx);
  }
  ctx.restore();
}
// Khối chữ của một trang (dùng lại bộ trích khối của chế độ Đè trang), có nhớ đệm
async function pageBlocksExt(p) {
  const e = pages[p], ov = overlayPages[p];
  if (e && e.ext) return e.ext;
  if (ov && ov.ext) return ov.ext;
  if (!pdfDoc) return null;
  try {
    const ext = await extractBlocks(await pdfDoc.getPage(p + 1));
    if (e) e.ext = ext;
    if (ov) ov.ext = ext;
    return ext;
  } catch { return null; }
}
// Chữ nằm dưới một vùng đã bôi → để gửi vào ghi chú. Ở chế độ Đè trang lấy luôn
// bản tiếng Việt đang hiển thị (và đúng vị trí đã dàn lại), chỗ khác lấy bản gốc.
async function textUnderRect(p, h) {
  const ext = await pageBlocksExt(p);
  if (!ext || !ext.blocks.length) return '';
  const { Wp, blocks } = ext;
  // Vùng bôi vẽ trên trang ĐÈ: dò theo vị trí khối ĐÃ DÀN LẠI và lấy luôn câu
  // tiếng Việt đang hiện. Vẽ trên trang GỐC: dò theo vị trí gốc, lấy câu tiếng Anh.
  const ov = h.o ? overlayPages[p] : null;
  const boxes = (ov && Array.isArray(ov.drawBoxes) && ov.drawBoxes.length === blocks.length) ? ov.drawBoxes : blocks;
  const vi = (ov && Array.isArray(ov.translated) && ov.translated.length === blocks.length) ? ov.translated : null;
  const x0 = h.x * Wp, y0 = h.y * Wp, x1 = (h.x + h.w) * Wp, y1 = (h.y + h.h) * Wp;
  const out = [];
  boxes.forEach((box, i) => {
    if (box.x < x1 && box.x + box.w > x0 && box.top < y1 && box.top + box.h > y0) {
      const t = (vi && String(vi[i] || '').trim()) || blocks[i].text;
      if (t) out.push(t);
    }
  });
  return out.join(' ').replace(/\s+/g, ' ').trim().slice(0, 500);
}

// Kéo một vùng để bôi (chỉ khi đã bật chế độ bôi)
let drawing = null;
function onLayerPointerDown(e) {
  if (!hlMode || e.button != null && e.button !== 0) return;
  const layer = e.target.closest ? e.target.closest('.hl-layer') : null;
  if (!layer) return;
  e.preventDefault();
  const box = layer.getBoundingClientRect();
  if (box.width < 20) return;
  hideSelbar();
  const draft = document.createElement('div');
  draft.className = 'hl-draft';
  layer.appendChild(draft);
  drawing = { layer, draft, box, p: Number(layer.dataset.p), x0: e.clientX - box.left, y0: e.clientY - box.top };
  window.addEventListener('pointermove', onLayerPointerMove);
  window.addEventListener('pointerup', onLayerPointerUp, { once: true });
}
function onLayerPointerMove(e) {
  if (!drawing) return;
  const x1 = Math.min(Math.max(0, e.clientX - drawing.box.left), drawing.box.width);
  const y1 = Math.min(Math.max(0, e.clientY - drawing.box.top), drawing.box.height);
  const l = Math.min(drawing.x0, x1), t = Math.min(drawing.y0, y1);
  drawing.draft.style.cssText =
    `position:absolute;left:${l}px;top:${t}px;width:${Math.abs(x1 - drawing.x0)}px;height:${Math.abs(y1 - drawing.y0)}px;`;
  drawing.last = { l, t, w: Math.abs(x1 - drawing.x0), h: Math.abs(y1 - drawing.y0) };
}
async function onLayerPointerUp() {
  const d = drawing;
  drawing = null;
  window.removeEventListener('pointermove', onLayerPointerMove);
  if (!d) return;
  d.draft.remove();
  const r = d.last;
  if (!r || r.w < 8 || r.h < 6) return; // chạm nhẹ, không phải kéo vùng
  const W = d.box.width;
  const h = {
    id: uid(), k: 'r', p: d.p, c: hlColor,
    o: viewMode === 'overlay' ? 1 : 0, // vẽ trên mặt phẳng nào thì hiện ở đó
    x: r.l / W, y: r.t / W, w: r.w / W, h: r.h / W, q: '',
  };
  NOTE.highlights.push(h);
  saveNotes();
  repaintHl(h);
  if (noteTab === 'hl') renderHlList();
  // Lấy sẵn chữ nằm dưới vùng bôi để danh sách/ghi chú/xuất file dùng được ngay
  try {
    h.q = await textUnderRect(d.p, h);
    saveNotes();
    if (noteTab === 'hl') renderHlList();
  } catch {}
  const el = d.layer.querySelector(`.hl-rect[data-h="${h.id}"]`);
  if (el) openSelbarForHl(h.id, el.getBoundingClientRect());
}
document.addEventListener('pointerdown', onLayerPointerDown);

function setHlMode(on) {
  hlMode = !!on;
  document.body.classList.toggle('hl-mode', hlMode);
  hlBtn.setAttribute('aria-pressed', String(hlMode));
  hlBtn.classList.toggle('btn-primary', hlMode);
  hlToggleBtn.setAttribute('aria-pressed', String(hlMode));
  hlToggleBtn.textContent = hlMode ? '🖍 Tắt bôi trên trang gốc' : '🖍 Bật bôi trên trang gốc';
  hlToggleBtn.classList.toggle('btn-primary', hlMode);
  if (hlMode) setStatus('Chế độ bôi: kéo một vùng trên trang gốc để tô màu. Bấm 🖍 hoặc phím H để tắt.', 'working');
  else setStatus('');
}

// ---------- Thanh nổi chọn màu / gửi vào ghi chú ----------
let selCtx = null;
function hideSelbar() { selbarEl.hidden = true; selbarEl.innerHTML = ''; selCtx = null; }
function buildSelbar(onColor, onSend, onDel) {
  selbarEl.innerHTML = '';
  for (const c of Object.keys(HL_COLORS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sw';
    b.style.background = HL_COLORS[c];
    b.title = HL_NAMES[c];
    b.setAttribute('aria-label', HL_NAMES[c]);
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', () => onColor(c));
    selbarEl.appendChild(b);
  }
  const sep = document.createElement('span');
  sep.className = 'sep';
  selbarEl.appendChild(sep);
  const send = document.createElement('button');
  send.type = 'button';
  send.className = 'sb';
  send.textContent = '→ Ghi chú';
  send.title = 'Đưa đoạn này vào cột NOTES của chương đang đọc';
  send.addEventListener('mousedown', (e) => e.preventDefault());
  send.addEventListener('click', onSend);
  selbarEl.appendChild(send);
  if (onDel) {
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'sb sb-del';
    del.textContent = '✕';
    del.title = 'Xoá vệt bôi';
    del.addEventListener('mousedown', (e) => e.preventDefault());
    del.addEventListener('click', onDel);
    selbarEl.appendChild(del);
  }
}
function placeSelbar(rect) {
  selbarEl.hidden = false;
  const w = selbarEl.offsetWidth, h = selbarEl.offsetHeight;
  let left = rect.left + rect.width / 2 - w / 2;
  left = Math.min(Math.max(8, left), window.innerWidth - w - 8);
  let top = rect.top - h - 8;
  if (top < 8) top = Math.min(rect.bottom + 8, window.innerHeight - h - 8);
  selbarEl.style.left = left + 'px';
  selbarEl.style.top = top + 'px';
}
function openSelbarForSelection(info) {
  selCtx = { mode: 'sel', info };
  buildSelbar(
    (c) => {
      hlColor = c;
      const h = addTextHl(info, c);
      hideSelbar();
      window.getSelection().removeAllRanges();
      renderSwatches();
      if (h) setStatus(`Đã bôi ${HL_NAMES[c].toLowerCase()} ở trang ${h.p + 1}.`, 'done');
    },
    () => {
      const h = addTextHl(info, hlColor);
      hideSelbar();
      window.getSelection().removeAllRanges();
      if (h) sendHlToNote(h);
    },
    null,
  );
  placeSelbar(info.rect);
}
function openSelbarForHl(id, rect) {
  const h = hlById(id);
  if (!h) return;
  selCtx = { mode: 'hl', id };
  buildSelbar(
    (c) => { hlColor = c; setHlColor(id, c); hideSelbar(); renderSwatches(); },
    () => { hideSelbar(); sendHlToNote(h); },
    () => { removeHl(id); hideSelbar(); },
  );
  placeSelbar(rect);
}
// Bôi chữ ở cột bản dịch: quét chọn xong là hiện thanh màu
function onMaybeSelection() {
  setTimeout(() => {
    if (selCtx && selCtx.mode === 'hl') return;
    const info = textSelectionInfo();
    if (info) openSelbarForSelection(info);
    else if (selCtx) hideSelbar();
  }, 10);
}
document.addEventListener('mouseup', onMaybeSelection);
document.addEventListener('touchend', onMaybeSelection);
// Bấm vào một vệt bôi sẵn có → đổi màu / gửi ghi chú / xoá
document.addEventListener('click', (e) => {
  const t = e.target;
  if (selbarEl.contains(t)) return;
  const rect = t.closest ? t.closest('.hl-rect') : null;
  if (rect) { openSelbarForHl(rect.dataset.h, rect.getBoundingClientRect()); return; }
  const mk = t.closest ? t.closest('mark[data-h]') : null;
  if (mk) { openSelbarForHl(mk.dataset.h, mk.getBoundingClientRect()); return; }
  if (selCtx && selCtx.mode === 'hl') hideSelbar();
});
window.addEventListener('scroll', () => { if (selCtx) hideSelbar(); }, { passive: true });

// ---------- Ngăn kéo ----------
function drawerOpen() { return !drawerEl.hidden; }
function setDrawer(open) {
  const keep = getCurrentPageIndex();
  drawerEl.hidden = !open;
  document.body.classList.toggle('drawer-open', open);
  drawerBtn.setAttribute('aria-expanded', String(open));
  drawerBtn.classList.toggle('btn-primary', open);
  if (open) renderDrawer();
  else hideSelbar();
  relayoutWidth(keep); // khung đọc hẹp/rộng lại → dựng lại khổ trang cho khớp
}
function toggleDrawer() { setDrawer(!drawerOpen()); }
// Mở/đóng ngăn kéo làm đổi bề rộng cột đọc: chừa lại chiều cao và giữ đúng trang
function relayoutWidth(keep) {
  if (!pdfDoc) return;
  if (viewMode === 'overlay') {
    for (const e of overlayPages) e.composed = false;
    requestAnimationFrame(() => { scrollOverlayToPage(keep); composeVisibleOverlay(); });
    return;
  }
  if (readMode === 'book') { renderBook(); return; }
  requestAnimationFrame(() => {
    if (viewMode !== 'trans') reserveAll();
    if (pages.length) scrollToPage(keep);
    renderVisible();
    repaintAllRectLayers();
  });
}
function setNoteTab(tab) {
  noteTab = tab;
  [...drawerEl.querySelectorAll('.dtab')].forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $('paneFind').hidden = tab !== 'find';
  $('paneBm').hidden = tab !== 'bm';
  $('paneHl').hidden = tab !== 'hl';
  $('paneNote').hidden = tab !== 'note';
  renderDrawer();
}
function setNotesEnabled(on) {
  drawerBtn.disabled = !on;
  hlBtn.disabled = !on;
  findBtn.disabled = !on;
  if (!on && hlMode) setHlMode(false);
}
function renderDrawer() {
  if (!drawerOpen()) return;
  if (noteTab === 'find') renderFindList();
  else if (noteTab === 'bm') renderBmList();
  else if (noteTab === 'hl') { renderSwatches(); renderHlList(); }
  else { renderScopeSelect(); loadScopeIntoUI(); syncFollowScope(); }
}
function emptyMsg(text) {
  const d = document.createElement('div');
  d.className = 'list-empty';
  d.textContent = text;
  return d;
}
function renderBmList() {
  bmListEl.innerHTML = '';
  if (!docId) { bmListEl.appendChild(emptyMsg('Chưa mở tài liệu nào.')); return; }
  const list = NOTE.bookmarks.slice().sort((a, b) => a.p - b.p);
  if (!list.length) {
    bmListEl.appendChild(emptyMsg('Chưa có bookmark. Bấm ☆ trên một trang, dùng nút phía trên, hoặc bấm phím B khi đang đọc.'));
    return;
  }
  for (const bm of list) {
    const row = document.createElement('div');
    row.className = 'item';
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'item-go';
    go.innerHTML = `<span class="item-p">TRANG ${bm.p + 1}</span><span class="item-t">${escapeHtml(bm.label || `Trang ${bm.p + 1}`)}</span>`;
    go.addEventListener('click', () => { jumpToPage(bm.p); if (isMobile()) setDrawer(false); });
    const ren = document.createElement('button');
    ren.type = 'button';
    ren.className = 'item-x';
    ren.textContent = '✎';
    ren.title = 'Đổi tên bookmark';
    ren.addEventListener('click', async () => {
      const v = await promptDialog({ eyebrow: 'BOOKMARK', title: `Đặt tên cho trang ${bm.p + 1}`, label: 'Tên bookmark', value: bm.label || '' });
      if (v == null) return;
      bm.label = v || `Trang ${bm.p + 1}`;
      saveNotes();
      renderBmList();
    });
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'item-x';
    del.textContent = '✕';
    del.title = 'Bỏ bookmark';
    del.addEventListener('click', () => toggleBookmark(bm.p));
    row.append(go, ren, del);
    bmListEl.appendChild(row);
  }
}
function renderSwatches() {
  hlSwatchesEl.innerHTML = '';
  for (const c of Object.keys(HL_COLORS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sw' + (c === hlColor ? ' on' : '');
    b.innerHTML = `<i style="background:${HL_COLORS[c]}"></i>${HL_NAMES[c]}`;
    b.addEventListener('click', () => { hlColor = c; renderSwatches(); });
    hlSwatchesEl.appendChild(b);
  }
}
function renderHlList() {
  hlListEl.innerHTML = '';
  if (!docId) { hlListEl.appendChild(emptyMsg('Chưa mở tài liệu nào.')); return; }
  const list = NOTE.highlights.slice().sort((a, b) => a.p - b.p);
  if (!list.length) {
    hlListEl.appendChild(emptyMsg('Chưa bôi gì. Ở cột bản dịch: quét chọn chữ rồi chọn màu. Trên trang gốc: bật nút bôi rồi kéo một vùng.'));
    return;
  }
  for (const h of list) {
    const row = document.createElement('div');
    row.className = 'item';
    const dot = document.createElement('span');
    dot.className = 'item-dot';
    dot.style.background = HL_COLORS[h.c] || HL_COLORS.y;
    dot.title = HL_NAMES[h.c] || '';
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'item-go';
    const q = (h.q || '').trim();
    go.innerHTML = `<span class="item-p">TRANG ${h.p + 1}${h.k === 'r' ? (h.o ? ' · VÙNG (ĐÈ TRANG)' : ' · VÙNG (TRANG GỐC)') : ''}</span>` +
      `<span class="item-t quote">${q ? escapeHtml(q.slice(0, 160)) : '(vùng đã bôi)'}</span>`;
    go.addEventListener('click', () => { jumpToPage(h.p); if (isMobile()) setDrawer(false); });
    const send = document.createElement('button');
    send.type = 'button';
    send.className = 'item-x';
    send.textContent = '→';
    send.title = 'Gửi vào ghi chú Cornell';
    send.addEventListener('click', () => sendHlToNote(h));
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'item-x';
    del.textContent = '✕';
    del.title = 'Xoá vệt bôi';
    del.addEventListener('click', () => removeHl(h.id));
    row.append(dot, go, send, del);
    hlListEl.appendChild(row);
  }
}

// ---------- Ghi chú Cornell ----------
function getNote(scope) {
  if (!NOTE.notes[scope]) NOTE.notes[scope] = { cue: '', note: '', sum: '' };
  const s = NOTE.notes[scope];
  if (typeof s.cue !== 'string') s.cue = '';
  if (typeof s.note !== 'string') s.note = '';
  if (typeof s.sum !== 'string') s.sum = '';
  return s;
}
function curScope() { return noteScopeEl.value || DOC_SCOPE; }
function renderScopeSelect() {
  const want = noteScopeEl.value;
  const list = sortedChapters();
  let html = `<option value="${DOC_SCOPE}">📕 Cả tài liệu — tổng hợp</option>`;
  list.forEach((c, i) => {
    html += `<option value="${escapeHtml(c.id)}">${i + 1}. ${escapeHtml(chapterLabel(c))}</option>`;
  });
  noteScopeEl.innerHTML = html;
  const p = readingPageIndex();
  const auto = (noteFollow && p >= 0) ? scopeForPage(p) : null;
  const pick = (want && noteScopeEl.querySelector(`option[value="${CSS.escape(want)}"]`)) ? want : (auto || DOC_SCOPE);
  noteScopeEl.value = pick;
  const isChap = pick !== DOC_SCOPE;
  chapRenBtn.disabled = !isChap;
  chapDelBtn.disabled = !isChap;
}
// Chữ ghi chú lưu THUẦN VĂN BẢN; riêng liên kết về trang là token [[p12]] →
// hiển thị thành "tr.13 ↗" bấm được, và xuất file thì thành "(tr.13)".
function noteToHtml(s) {
  return escapeHtml(s || '').replace(/\[\[p(\d+)\]\]/g, (_, n) =>
    `<a class="pref" data-p="${n}" title="Nhảy tới trang ${Number(n) + 1}">tr.${Number(n) + 1} ↗</a>`);
}
function htmlToNote(el) {
  let out = '';
  const walk = (node) => {
    for (const c of node.childNodes) {
      if (c.nodeType === 3) out += c.nodeValue;
      else if (c.nodeType === 1) {
        if (c.tagName === 'BR') { out += '\n'; continue; }
        if (c.classList && c.classList.contains('pref')) { out += `[[p${c.dataset.p}]]`; continue; }
        if (/^(DIV|P|LI|H[1-6]|TR)$/.test(c.tagName) && out && !out.endsWith('\n')) out += '\n';
        walk(c);
      }
    }
  };
  walk(el);
  return out.replace(/ /g, ' '); // trình duyệt hay chèn khoảng trắng cứng khi gõ
}
function loadScopeIntoUI() {
  const st = getNote(curScope());
  for (const f of ['cue', 'note', 'sum']) {
    const el = cwEls[f];
    if (document.activeElement === el) continue; // đang gõ dở thì đừng dựng lại
    el.innerHTML = noteToHtml(st[f]);
  }
  cwEls.note.classList.remove('revealed');
  const scope = curScope();
  const isDoc = scope === DOC_SCOPE;
  noteSynthBtn.hidden = !isDoc;
  noteAIBtn.hidden = !isDoc;
}
function saveField(f) {
  const st = getNote(curScope());
  st[f] = htmlToNote(cwEls[f]);
  scheduleNoteSave();
}
// Ghi chú tự bám chương đang đọc khi cuộn
function syncFollowScope() {
  if (!noteFollow || !drawerOpen() || noteTab !== 'note' || !docId) return;
  if (cornellEl.contains(document.activeElement)) return; // đang gõ → đừng nhảy
  const p = readingPageIndex();
  if (p < 0) return;
  const want = scopeForPage(p);
  if (want === curScope()) return;
  if (!noteScopeEl.querySelector(`option[value="${CSS.escape(want)}"]`)) return;
  noteScopeEl.value = want;
  loadScopeIntoUI();
}
// Gửi một vệt bôi vào cột NOTES của ĐÚNG chương chứa trang đó
async function sendHlToNote(h) {
  let text = (h.q || '').trim();
  if (!text && h.k === 'r') {
    setNoteStat('Đang lấy chữ trong vùng bôi…');
    try { text = await textUnderRect(h.p, h); h.q = text; saveNotes(); } catch {}
  }
  if (!text) { setStatus('Không lấy được chữ trong vùng đã bôi (trang ảnh scan?).', 'error'); return; }
  const scope = scopeForPage(h.p);
  const st = getNote(scope);
  st.note = (st.note ? st.note.replace(/\s+$/, '') + '\n' : '') + `• ${text} [[p${h.p}]]`;
  saveNotes();
  if (!drawerOpen()) setDrawer(true);
  setNoteTab('note');
  renderScopeSelect();
  noteScopeEl.value = scope;
  loadScopeIntoUI();
  const ch = chapterById(scope);
  setNoteStat(`Đã thêm vào NOTES của ${ch ? ch.title : 'ghi chú cả tài liệu'}.`);
}
function setNoteStat(msg) { noteStatEl.textContent = msg || ''; }

// Ghép Cue + Summary của mọi chương thành một trang ôn tập ở note cả tài liệu
function buildSynthText() {
  const parts = [];
  for (const c of sortedChapters()) {
    const st = NOTE.notes[c.id];
    if (!st) continue;
    const cue = (st.cue || '').trim(), sum = (st.sum || '').trim(), note = (st.note || '').trim();
    if (!cue && !sum && !note) continue;
    const [a, b] = chapterRange(c);
    parts.push(`— ${c.title} (tr.${a + 1}–${b + 1}) —`);
    if (cue) parts.push('Cue: ' + cue.replace(/\n+/g, ' / '));
    if (sum) parts.push('Tóm tắt: ' + sum);
    else if (note) parts.push('Ý chính: ' + note);
    parts.push('');
  }
  return parts.join('\n').trim();
}
function doSynth() {
  const t = buildSynthText();
  if (!t) { setNoteStat('Chưa có chương nào được ghi chú — hãy ghi Cue/Tóm tắt cho vài chương trước.'); return; }
  const st = getNote(DOC_SCOPE);
  st.note = (st.note ? st.note.replace(/\s+$/, '') + '\n\n' : '') + t;
  flushNotes();
  noteScopeEl.value = DOC_SCOPE;
  loadScopeIntoUI();
  setNoteStat('Đã ghép ghi chú các chương vào cột NOTES. Giờ tự viết lại phần SUMMARY bằng lời của bạn.');
}
async function doSynthAI() {
  const apiKey = apiKeyEl.value.trim();
  if (!apiKey) { setStatus('Chưa nhập API key.', 'error'); apiKeyEl.focus(); return; }
  const t = buildSynthText();
  if (!t) { setNoteStat('Chưa có chương nào được ghi chú để tổng hợp.'); return; }
  noteAIBtn.disabled = true;
  setNoteStat('Đang nhờ AI soạn bản tổng hợp…');
  setStatus('Đang soạn bản tổng hợp…', 'working');
  try {
    const r = await fetch('/api/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: providerEl.value, apiKey, model: modelEl.value.trim(),
        skill: skillEl.value, title: docTitle, text: t,
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    const st = getNote(DOC_SCOPE);
    st.note = (st.note ? st.note.replace(/\s+$/, '') + '\n\n' : '') + (data.result || '').trim();
    flushNotes();
    noteScopeEl.value = DOC_SCOPE;
    loadScopeIntoUI();
    setNoteStat('AI đã soạn bản nháp — hãy đọc lại và sửa theo ý bạn.');
    setStatus('Đã soạn xong bản tổng hợp.', 'done');
  } catch (err) {
    setNoteStat('');
    setStatus('Không soạn được bản tổng hợp: ' + err.message, 'error');
  } finally {
    noteAIBtn.disabled = false;
  }
}

// ---------- Xuất ghi chú ----------
const plainNote = (s) => String(s || '').replace(/\[\[p(\d+)\]\]/g, (_, n) => `(tr.${Number(n) + 1})`);
function notesPayload() {
  const chapters = sortedChapters().map((c) => {
    const st = NOTE.notes[c.id] || {};
    const [a, b] = chapterRange(c);
    return {
      title: c.title, range: `tr.${a + 1}–${b + 1}`,
      cue: plainNote(st.cue), note: plainNote(st.note), sum: plainNote(st.sum),
    };
  }).filter((c) => c.cue || c.note || c.sum);
  const d = NOTE.notes[DOC_SCOPE] || {};
  return {
    title: docTitle,
    doc: { cue: plainNote(d.cue), note: plainNote(d.note), sum: plainNote(d.sum) },
    chapters,
    highlights: NOTE.highlights.slice().sort((a, b) => a.p - b.p)
      .map((h) => ({ p: h.p + 1, color: HL_NAMES[h.c] || '', text: (h.q || '').trim() }))
      .filter((h) => h.text),
    bookmarks: NOTE.bookmarks.slice().sort((a, b) => a.p - b.p).map((b) => ({ p: b.p + 1, label: b.label || '' })),
  };
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function exportNotesMd() {
  flushNotes();
  const d = notesPayload();
  const cell = (label, v) => (v ? `**${label}**\n\n${v}\n\n` : '');
  let md = `# ${d.title} — Ghi chú Cornell\n\n`;
  if (d.doc.cue || d.doc.note || d.doc.sum) {
    md += `## Tổng hợp cả tài liệu\n\n${cell('Cue', d.doc.cue)}${cell('Notes', d.doc.note)}${cell('Summary', d.doc.sum)}`;
  }
  for (const c of d.chapters) {
    md += `## ${c.title} — ${c.range}\n\n${cell('Cue', c.cue)}${cell('Notes', c.note)}${cell('Summary', c.sum)}`;
  }
  if (d.highlights.length) {
    md += `## Câu đã bôi\n\n` + d.highlights.map((h) => `- (tr.${h.p}) ${h.text}${h.color ? ` _[${h.color}]_` : ''}`).join('\n') + '\n\n';
  }
  if (d.bookmarks.length) {
    md += `## Bookmark\n\n` + d.bookmarks.map((b) => `- tr.${b.p} — ${b.label}`).join('\n') + '\n';
  }
  downloadBlob(new Blob([md], { type: 'text/markdown;charset=utf-8' }), `${d.title || 'ghi-chu'} - ghi chu.md`);
  setNoteStat('Đã tải file .md.');
}
async function exportNotesPdf() {
  flushNotes();
  const d = notesPayload();
  if (!d.chapters.length && !d.highlights.length && !d.doc.note && !d.doc.sum && !d.doc.cue) {
    setNoteStat('Chưa có gì để xuất.');
    return;
  }
  notePdfBtn.disabled = true;
  setStatus('Đang tạo PDF ghi chú…', 'working');
  try {
    const r = await fetch('/api/export-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(d),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error || `HTTP ${r.status}`);
    }
    downloadBlob(await r.blob(), `${d.title || 'ghi-chu'} - ghi chu.pdf`);
    setStatus('Đã tạo PDF ghi chú.', 'done');
    setNoteStat('');
  } catch (err) {
    setStatus('Lỗi tạo PDF ghi chú: ' + err.message, 'error');
  } finally {
    notePdfBtn.disabled = false;
  }
}

// =========================================================================
// TÌM CHỮ TRONG TÀI LIỆU
// Tìm cùng lúc ở hai nơi:
//   • BẢN DỊCH — chữ đang nằm sẵn trong bộ nhớ, tìm ra ngay lập tức.
//   • BẢN GỐC  — phải trích chữ + toạ độ từng mẩu chữ của từng trang PDF, nên
//     quét dần theo trang (có báo tiến độ) và nhớ đệm lại cho những lần tìm sau.
// So khớp "dễ tính": bỏ dấu, không phân biệt hoa thường, gộp mọi khoảng trắng →
// gõ "tieng viet" vẫn ra "tiếng Việt" kể cả khi nó bị ngắt qua hai dòng.
// =========================================================================
const FIND_MAX = 400;         // đủ dùng để đọc sách, không làm nghẹt danh sách
const FIND = {
  q: '', qf: '',              // từ khoá thật / từ khoá đã "gấp" để so khớp
  scope: 'both',              // 'both' | 'trans' | 'orig'
  results: [], cur: -1, curM: null,
  byBlock: new Map(),         // 'trang:khối' → [{ s, e, i }] cho cột bản dịch
  boxes: new Map(),           // trang → [{ i, rects }] cho trang gốc
  painted: new Set(),         // các ô chữ đang có vệt tìm (để còn xoá đi)
  run: 0, scanning: false, wantFirst: false,
};

// "Gấp" chữ về dạng dễ so khớp; `map` giữ vị trí gốc của từng ký tự đã gấp để
// đánh dấu lại đúng chỗ trong văn bản thật.
function foldText(s) {
  let out = '';
  const map = [];
  let space = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (/\s/.test(c)) {
      if (out.length && !space) { out += ' '; map.push(i); space = true; }
      continue;
    }
    space = false;
    const f = ((c === 'đ' || c === 'Đ') ? 'd' : c)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    for (let k = 0; k < f.length; k++) { out += f[k]; map.push(i); }
  }
  return { text: out, map };
}
const foldQuery = (q) => foldText(String(q || '')).text.trim();

// Mọi chỗ xuất hiện của `qf` trong `src`, trả về vị trí theo CHỮ THẬT
function matchesIn(src, qf, folded) {
  const out = [];
  if (!src || !qf) return out;
  const fd = folded || foldText(src);
  let at = 0;
  while (out.length < 2000) {
    const i = fd.text.indexOf(qf, at);
    if (i < 0) break;
    const s = fd.map[i];
    let e = fd.map[i + qf.length - 1] + 1;
    while (e < src.length && /[\u0300-\u036f]/.test(src[e])) e++; // ôm trọn dấu rời
    out.push({ s, e });
    at = i + qf.length;
  }
  return out;
}

// Một mẩu chữ ngắn quanh chỗ tìm thấy, in đậm đúng phần khớp
function findSnippet(text, s, e) {
  const cut = (t) => t.replace(/\s+/g, ' ');
  const from = Math.max(0, s - 46), to = Math.min(text.length, e + 74);
  return (from > 0 ? '…' : '') + escapeHtml(cut(text.slice(from, s)))
    + '<b>' + escapeHtml(cut(text.slice(s, e))) + '</b>'
    + escapeHtml(cut(text.slice(e, to))) + (to < text.length ? '…' : '');
}

// Tô chữ tìm thấy trong một đoạn văn bản thuần (dùng cho trang sách đã dàn lại)
function highlightFindHtml(text) {
  const hits = matchesIn(text, FIND.qf);
  if (!hits.length) return escapeHtml(text);
  let html = '', at = 0;
  for (const h of hits) {
    html += escapeHtml(text.slice(at, h.s));
    html += `<mark class="findmark">${escapeHtml(text.slice(h.s, h.e))}</mark>`;
    at = h.e;
  }
  return html + escapeHtml(text.slice(at));
}

// --- Bản gốc: chữ + toạ độ từng mẩu chữ của một trang (nhớ đệm theo trang) ---
async function origPageText(p) {
  const entry = pages[p];
  if (entry && entry.findSrc) return entry.findSrc;
  if (!pdfDoc) return null;
  const page = await pdfDoc.getPage(p + 1);
  const vp = page.getViewport({ scale: 1 });
  const Wp = vp.width, Hp = vp.height;
  const tc = await page.getTextContent();
  let text = '';
  const spans = [];
  let prevRight = null, prevTop = null;
  for (const it of tc.items) {
    if (typeof it.str !== 'string' || !it.str.length) continue;
    const x = it.transform[4];
    const fs = Math.abs(it.transform[3]) || it.height || 10;
    const top = Hp - it.transform[5] - fs;   // đổi sang gốc trên-trái
    const w = it.width || 0;
    if (text) {
      if (prevTop === null || Math.abs(top - prevTop) > fs * 0.6) text += '\n';
      else if (x - prevRight > fs * 0.3) text += ' ';
    }
    spans.push({ s: text.length, e: text.length + it.str.length, x, top, w, fs });
    text += it.str;
    prevRight = x + w;
    prevTop = top;
  }
  const data = { text, spans, Wp, Hp, folded: foldText(text) };
  if (entry) entry.findSrc = data;
  return data;
}
// PDF chỉ cho biết bề rộng CẢ MẨU chữ, không cho biết từng chữ cái nằm đâu. Chia
// đều theo số ký tự thì vệt tô lệch hẳn đi (chữ "i" đâu có rộng bằng chữ "m"), nên
// đo thử bằng canvas rồi lấy TỈ LỆ — sai số font thay thế phần lớn tự triệt tiêu.
let findMeasCtx = null;
function textRatios(str, a, b, fs) {
  const len = str.length || 1;
  const flat = { start: a / len, width: (b - a) / len };
  try {
    if (!findMeasCtx) findMeasCtx = document.createElement('canvas').getContext('2d');
    findMeasCtx.font = Math.max(4, Math.round(fs)) + 'px sans-serif';
    const total = findMeasCtx.measureText(str).width;
    if (!(total > 0)) return flat;
    return {
      start: findMeasCtx.measureText(str.slice(0, a)).width / total,
      width: findMeasCtx.measureText(str.slice(a, b)).width / total,
    };
  } catch { return flat; }
}
// Chỗ tìm thấy → các ô chữ nhật, toạ độ theo BỀ RỘNG trang (giống vệt bôi vùng)
function findRects(data, s, e) {
  const out = [];
  for (const sp of data.spans) {
    if (sp.e <= s || sp.s >= e || sp.w <= 0) continue;
    const str = data.text.slice(sp.s, sp.e);
    const r = textRatios(str, Math.max(s, sp.s) - sp.s, Math.min(e, sp.e) - sp.s, sp.fs);
    out.push({
      x: (sp.x + sp.w * r.start) / data.Wp,
      y: (sp.top - sp.fs * 0.08) / data.Wp,
      w: (sp.w * r.width) / data.Wp,
      h: (sp.fs * 1.2) / data.Wp,
    });
  }
  return out;
}

// --- Quét bản dịch (nhanh, nằm sẵn trong bộ nhớ) ---
function scanTranslations() {
  for (const entry of pages) {
    for (let k = 0; k < entry.blocks.length; k++) {
      const block = entry.blocks[k];
      if (block.type !== 'text') continue;
      const text = block.text || '';
      for (const h of matchesIn(text, FIND.qf)) {
        if (FIND.results.length >= FIND_MAX) return;
        FIND.results.push({
          p: entry.index, k: 't', b: k, s: h.s, e: h.e,
          hit: text.slice(h.s, h.e), html: findSnippet(text, h.s, h.e),
        });
      }
    }
  }
}

function sortFind() {
  FIND.results.sort((a, z) =>
    a.p - z.p || (a.k === z.k ? ((a.b || 0) - (z.b || 0) || a.s - z.s) : (a.k === 'o' ? -1 : 1)));
}
// Dựng lại bảng tra cứu sau mỗi lần danh sách kết quả đổi
function reindexFind() {
  FIND.byBlock = new Map();
  FIND.boxes = new Map();
  FIND.results.forEach((m, i) => {
    m.i = i;
    if (m.k === 't') {
      const key = m.p + ':' + m.b;
      if (!FIND.byBlock.has(key)) FIND.byBlock.set(key, []);
      FIND.byBlock.get(key).push({ s: m.s, e: m.e, i });
    } else {
      if (!FIND.boxes.has(m.p)) FIND.boxes.set(m.p, []);
      FIND.boxes.get(m.p).push({ i, rects: m.rects || [] });
    }
  });
  FIND.cur = FIND.curM ? FIND.results.indexOf(FIND.curM) : -1;
  if (FIND.cur < 0) FIND.curM = null;
}
function findRangesFor(p, b) {
  if (!FIND.qf) return [];
  return FIND.byBlock.get(p + ':' + b) || [];
}

// --- Vẽ vệt tìm thấy ---
function paintFindLayer(entry) {
  const layer = entry.findLayer;
  if (!layer) return;
  const list = FIND.qf ? FIND.boxes.get(entry.index) : null;
  if (!list || !list.length) { if (layer.childElementCount) layer.innerHTML = ''; return; }
  const a = entry.findAspect || entry.aspect || 1.414;
  const asp = (a > 0.05 && Number.isFinite(a)) ? a : 1.414;
  layer.innerHTML = '';
  for (const m of list) {
    for (const r of m.rects) {
      const d = document.createElement('div');
      d.className = 'find-box' + (m.i === FIND.cur ? ' cur' : '');
      d.style.left = (r.x * 100) + '%';
      d.style.width = (r.w * 100) + '%';
      d.style.top = (r.y / asp * 100) + '%';
      d.style.height = (r.h / asp * 100) + '%';
      layer.appendChild(d);
    }
  }
}
// Vẽ thẳng lên canvas — dùng cho chế độ Đọc sách
function paintFindOnCanvas(ctx, p, widthPx) {
  const list = FIND.qf ? FIND.boxes.get(p) : null;
  if (!list || !ctx) return;
  ctx.save();
  ctx.globalAlpha = 0.42;
  for (const m of list) {
    ctx.fillStyle = m.i === FIND.cur ? '#F2A03D' : '#FFE08A';
    for (const r of m.rects) ctx.fillRect(r.x * widthPx, r.y * widthPx, r.w * widthPx, r.h * widthPx);
  }
  ctx.restore();
}
function repaintFind(withBook) {
  const want = new Set(FIND.byBlock.keys());
  for (const key of new Set([...want, ...FIND.painted])) {
    const i = key.indexOf(':');
    const ed = document.querySelector(`.editor[data-p="${key.slice(0, i)}"][data-b="${key.slice(i + 1)}"]`);
    if (ed && document.activeElement !== ed) paintEditor(ed); // đang gõ dở thì để yên
  }
  FIND.painted = want;
  for (const entry of pages) paintFindLayer(entry);
  if (withBook && readMode === 'book' && pdfDoc) renderBook();
}

// --- Chạy tìm ---
let findDebounce = null;
function scheduleFind() {
  if (findDebounce) clearTimeout(findDebounce);
  findDebounce = setTimeout(() => { findDebounce = null; runFind(); }, 240);
}
async function runFind() {
  const token = ++FIND.run;   // lần tìm mới → lần quét đang dở tự bỏ cuộc
  FIND.q = findInput.value.trim();
  FIND.qf = foldQuery(findInput.value);
  FIND.results = [];
  FIND.curM = null;
  FIND.scanning = false;
  reindexFind();
  repaintFind(true);
  renderFindList();
  if (!pdfDoc) { setFindStat('Chưa mở tài liệu nào.'); return; }
  if (FIND.qf.length < 2) { setFindStat(FIND.qf ? 'Gõ ít nhất 2 ký tự.' : ''); return; }

  if (FIND.scope !== 'orig') {
    scanTranslations();
    sortFind(); reindexFind(); renderFindList(); repaintFind(false);
    setFindStat(FIND.results.length
      ? `${FIND.results.length} kết quả trong bản dịch…`
      : 'Chưa thấy trong bản dịch…');
    takeFirstIfWanted();
  }

  if (FIND.scope !== 'trans' && FIND.results.length < FIND_MAX) {
    FIND.scanning = true;
    const total = pages.length;
    for (let p = 0; p < total; p++) {
      if (token !== FIND.run) return;
      let data = null;
      try { data = await origPageText(p); } catch { data = null; }
      if (token !== FIND.run) return;
      if (data) {
        const entry = pages[p];
        if (entry && data.Wp > 0) entry.findAspect = data.Hp / data.Wp;
        for (const h of matchesIn(data.text, FIND.qf, data.folded)) {
          if (FIND.results.length >= FIND_MAX) break;
          FIND.results.push({
            p, k: 'o', s: h.s, e: h.e,
            hit: data.text.slice(h.s, h.e), html: findSnippet(data.text, h.s, h.e),
            rects: findRects(data, h.s, h.e),
          });
        }
      }
      if (FIND.results.length >= FIND_MAX) break;
      // Nhả luồng theo từng nhóm trang: danh sách hiện dần, app không bị đơ
      if (p % 6 === 5 || p === total - 1) {
        sortFind(); reindexFind(); renderFindList(); repaintFind(false);
        setFindStat(`Đang quét bản gốc — trang ${p + 1}/${total}… (${FIND.results.length} kết quả)`);
        takeFirstIfWanted();
        await new Promise((r) => setTimeout(r, 0));
        if (token !== FIND.run) return;
      }
    }
    FIND.scanning = false;
  }
  sortFind(); reindexFind(); renderFindList(); repaintFind(true);
  setFindStat(findSummary());
  takeFirstIfWanted();
}
// Bấm Enter lúc chưa có kết quả nào → nhảy tới kết quả đầu tiên ngay khi có
function takeFirstIfWanted() {
  if (FIND.wantFirst && FIND.results.length) { FIND.wantFirst = false; activateFind(0); }
}
function findSummary() {
  const n = FIND.results.length;
  if (!FIND.qf) return '';
  if (!n) return `Không thấy “${FIND.q}”.`;
  const np = new Set(FIND.results.map((r) => r.p)).size;
  const capped = n >= FIND_MAX ? ` — dừng ở ${FIND_MAX} kết quả đầu` : '';
  const cur = FIND.cur >= 0 ? `Kết quả ${FIND.cur + 1}/${n} · ` : '';
  return `${cur}${n} kết quả trong ${np} trang${capped}. Enter = kết quả sau, Shift+Enter = trước.`;
}
function setFindStat(msg) { if (findStatEl) findStatEl.textContent = msg || ''; }

function renderFindList() {
  if (!findListEl) return;
  findListEl.innerHTML = '';
  findPrevBtn.disabled = findNextBtn.disabled = !FIND.results.length;
  if (!FIND.qf) {
    findListEl.appendChild(emptyMsg(
      'Gõ từ khoá để tìm trong bản gốc và bản dịch. Không cần bỏ dấu cho đúng — gõ "tieng viet" vẫn ra "tiếng Việt".'));
    return;
  }
  if (!FIND.results.length) {
    if (!FIND.scanning) findListEl.appendChild(emptyMsg(`Không thấy “${FIND.q}” trong tài liệu.`));
    return;
  }
  FIND.results.forEach((m, i) => {
    const row = document.createElement('div');
    row.className = 'item' + (i === FIND.cur ? ' cur' : '');
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'item-go';
    go.innerHTML = `<span class="item-p">TRANG ${m.p + 1} · ${m.k === 'o' ? 'BẢN GỐC' : 'BẢN DỊCH'}</span>`
      + `<span class="item-t">${m.html}</span>`;
    go.addEventListener('click', () => { activateFind(i); if (isMobile()) setDrawer(false); });
    row.appendChild(go);
    findListEl.appendChild(row);
  });
}

// --- Nhảy tới một kết quả ---
function activateFind(i) {
  const n = FIND.results.length;
  if (!n) return;
  FIND.cur = ((i % n) + n) % n;
  FIND.curM = FIND.results[FIND.cur];
  gotoFindMatch(FIND.curM); // đã tự vẽ lại trang sách với vệt mới → khỏi vẽ lần nữa
  repaintFind(false);
  renderFindList();
  const row = findListEl && findListEl.children[FIND.cur];
  if (row) row.scrollIntoView({ block: 'nearest' });
  setFindStat(findSummary());
}
function findStep(d) {
  if (!FIND.results.length) return;
  activateFind(FIND.cur < 0 ? (d > 0 ? 0 : FIND.results.length - 1) : FIND.cur + d);
}
// Đưa vệt đang chọn xuống dưới thanh công cụ dính. Không cuộn lên cao hơn đầu
// trang chứa nó (`minTop`), nếu không ô số trang lại nhảy về trang trước đó.
function scrollElIntoReading(el, minTop) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const want = r.top + window.scrollY - stickyOffset() - 120;
  window.scrollTo({ top: Math.max(minTop || 0, want), behavior: 'auto' });
}
function gotoFindMatch(m) {
  if (!pdfDoc) return;
  pageInput.value = String(m.p + 1);

  if (viewMode === 'overlay') {
    suppressScrollSave = true;
    scrollOverlayToPage(m.p);
    setTimeout(() => { suppressScrollSave = false; }, 350);
    return;
  }

  if (readMode === 'book') {
    // Trang sách chỉ hiện được một mặt: đưa chế độ xem về đúng loại kết quả
    const want = m.k === 'o' ? 'orig' : 'trans';
    if (viewMode !== want) setMode(want);
    if (m.k === 'o') bookIndex = m.p;
    else {
      const bp = bookPageOfMatch(m);
      if (bp < 0) { setFindStat('Chưa dàn được trang sách cho kết quả này — thử chế độ Kéo lướt.'); return; }
      bookIndex = bp;
    }
    renderBook();
    return;
  }

  // Kéo lướt: cột chứa kết quả phải đang hiện thì mới thấy vệt tô
  if (m.k === 't' && viewMode === 'orig') setMode('both');
  else if (m.k === 'o' && viewMode === 'trans') setMode('both');

  suppressScrollSave = true;
  scrollToPage(m.p);
  const pageTop = window.scrollY;
  renderVisible();
  requestAnimationFrame(() => {
    const sel = m.k === 't'
      ? `.editor[data-p="${m.p}"][data-b="${m.b}"] mark.find-cur`
      : null;
    const el = sel ? document.querySelector(sel) : (pages[m.p] && pages[m.p].findLayer.querySelector('.find-box.cur'));
    if (el) scrollElIntoReading(el, pageTop);
    pageInput.value = String(m.p + 1);
    renderVisible();
    if (docId) localStorage.setItem(pageKey(docId), String(m.p));
    setTimeout(() => { suppressScrollSave = false; }, 350);
  });
}
// Kết quả thứ mấy trong bản dịch → trang sách thứ mấy (chữ đã dàn lại nhưng vẫn
// đúng thứ tự, nên đếm lần xuất hiện là ra).
function bookPageOfMatch(m) {
  if (!transPages.length) return -1;
  let want = 0;
  for (const r of FIND.results) {
    if (r === m) break;
    if (r.k === 't') want++;
  }
  let seen = 0, last = -1;
  for (let i = 0; i < transPages.length; i++) {
    const t = transPages[i].filter((f) => f.type === 'text').map((f) => f.text).join(' ');
    const n = matchesIn(t, FIND.qf).length;
    if (!n) continue;
    if (seen + n > want) return i;
    seen += n;
    last = i;
  }
  // Dàn lại trang có thể cắt chữ ngay giữa từ khoá → không khớp đủ số lần: lấy
  // trang cuối còn thấy từ khoá, vẫn hơn là đứng im.
  return last;
}

// Mở tài liệu khác / đóng tài liệu → bỏ hết kết quả cũ
function resetFind() {
  FIND.run++;
  FIND.q = ''; FIND.qf = '';
  FIND.results = []; FIND.cur = -1; FIND.curM = null;
  FIND.scanning = false; FIND.wantFirst = false;
  FIND.byBlock = new Map(); FIND.boxes = new Map(); FIND.painted = new Set();
  if (findDebounce) { clearTimeout(findDebounce); findDebounce = null; }
  if (findInput) findInput.value = '';
  renderFindList();
  setFindStat('');
}
function openFindPanel() {
  if (!pdfDoc) return;
  closeNav();
  if (!drawerOpen()) setDrawer(true);
  setNoteTab('find');
  findInput.focus();
  findInput.select();
}

// ---------- Sự kiện tìm chữ ----------
findBtn.addEventListener('click', openFindPanel);
findInput.addEventListener('input', () => { FIND.wantFirst = false; scheduleFind(); });
findInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (FIND.results.length) { findStep(e.shiftKey ? -1 : 1); return; }
    FIND.wantFirst = true;
    if (findDebounce) { clearTimeout(findDebounce); findDebounce = null; runFind(); }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    if (findInput.value) { findInput.value = ''; runFind(); }
    else setDrawer(false);
  }
});
findPrevBtn.addEventListener('click', () => findStep(-1));
findNextBtn.addEventListener('click', () => findStep(1));
findScopeEl.addEventListener('click', (e) => {
  const b = e.target.closest('.seg');
  if (!b) return;
  FIND.scope = b.dataset.fs;
  [...findScopeEl.querySelectorAll('.seg')].forEach((x) => x.classList.toggle('active', x === b));
  FIND.wantFirst = false;
  runFind();
});

// ---------- Sự kiện của ngăn kéo ----------
drawerBtn.addEventListener('click', () => { closeNav(); toggleDrawer(); });
drawerCloseBtn.addEventListener('click', () => setDrawer(false));
drawerWideBtn.addEventListener('click', () => {
  const keep = getCurrentPageIndex();
  const wide = !document.body.classList.contains('drawer-wide');
  document.body.classList.toggle('drawer-wide', wide);
  drawerEl.classList.toggle('drawer-wide', wide);
  drawerWideBtn.setAttribute('aria-pressed', String(wide));
  relayoutWidth(keep);
});
drawerEl.addEventListener('click', (e) => {
  const t = e.target.closest('.dtab');
  if (t) setNoteTab(t.dataset.tab);
});
hlBtn.addEventListener('click', () => { closeNav(); setHlMode(!hlMode); });
hlToggleBtn.addEventListener('click', () => setHlMode(!hlMode));
bmAddBtn.addEventListener('click', () => toggleBookmark(readingPageIndex()));

noteScopeEl.addEventListener('change', () => { loadScopeIntoUI(); setNoteStat(''); });
noteFollowBtn.addEventListener('click', () => {
  noteFollow = !noteFollow;
  noteFollowBtn.setAttribute('aria-pressed', String(noteFollow));
  noteFollowBtn.title = noteFollow ? 'Đang tự bám chương đang đọc' : 'Không tự đổi chương';
  if (noteFollow) syncFollowScope();
});
chapAddBtn.addEventListener('click', async () => {
  const p = readingPageIndex();
  if (p < 0) { setNoteStat('Không xác định được trang đang đọc ở chế độ này.'); return; }
  if (NOTE.chapters.some((c) => c.from === p)) { setNoteStat(`Trang ${p + 1} đã là mốc bắt đầu của một chương.`); return; }
  const name = await promptDialog({
    eyebrow: 'CẮT CHƯƠNG', title: `Chương mới bắt đầu từ trang ${p + 1}`,
    label: 'Tên chương', value: `Chương ${NOTE.chapters.length + 1}`,
  });
  if (name == null) return;
  NOTE.chapters.push({ id: uid(), title: name || `Chương ${NOTE.chapters.length + 1}`, from: p, src: 'manual' });
  flushNotes();
  renderScopeSelect();
  noteScopeEl.value = scopeForPage(p);
  loadScopeIntoUI();
  setNoteStat('Đã thêm mốc chương.');
});
chapRenBtn.addEventListener('click', async () => {
  const c = chapterById(curScope());
  if (!c) return;
  const name = await promptDialog({ eyebrow: 'ĐỔI TÊN', title: 'Đổi tên chương', label: 'Tên chương', value: c.title });
  if (name == null) return;
  c.title = name || c.title;
  flushNotes();
  renderScopeSelect();
  noteScopeEl.value = c.id;
});
chapDelBtn.addEventListener('click', async () => {
  const c = chapterById(curScope());
  if (!c) return;
  const st = NOTE.notes[c.id];
  const hasNote = st && ((st.cue || '').trim() || (st.note || '').trim() || (st.sum || '').trim());
  const ok = await confirmDialog({
    eyebrow: 'BỎ MỐC CHƯƠNG',
    title: `Bỏ mốc “${c.title}”?`,
    message: hasNote
      ? 'Ghi chú Cornell của chương này sẽ bị xoá theo.'
      : 'Chỉ bỏ mốc chia chương, không ảnh hưởng bản dịch.',
    okText: 'Bỏ mốc', cancelText: 'Giữ lại',
  });
  if (!ok) return;
  NOTE.chapters = NOTE.chapters.filter((x) => x.id !== c.id);
  delete NOTE.notes[c.id];
  flushNotes();
  noteScopeEl.value = DOC_SCOPE;
  renderScopeSelect();
  loadScopeIntoUI();
});
noteReviewBtn.addEventListener('click', () => {
  const on = !cornellEl.classList.contains('review');
  cornellEl.classList.toggle('review', on);
  cwEls.note.classList.remove('revealed');
  noteReviewBtn.setAttribute('aria-pressed', String(on));
  noteReviewBtn.classList.toggle('btn-primary', on);
  setNoteStat(on ? 'Ôn tập: cột NOTES bị che — tự trả lời theo CUE rồi bấm vào vùng mờ để đối chiếu.' : '');
});
cwEls.note.addEventListener('click', () => {
  if (cornellEl.classList.contains('review')) cwEls.note.classList.add('revealed');
});
noteSynthBtn.addEventListener('click', doSynth);
noteAIBtn.addEventListener('click', doSynthAI);
noteMdBtn.addEventListener('click', exportNotesMd);
notePdfBtn.addEventListener('click', exportNotesPdf);

for (const f of ['cue', 'note', 'sum']) {
  const el = cwEls[f];
  el.addEventListener('input', () => saveField(f));
  el.addEventListener('blur', () => { saveField(f); flushNotes(); el.innerHTML = noteToHtml(getNote(curScope())[f]); });
  // Dán luôn về chữ thuần để ô ghi chú không dính định dạng lạ từ nơi khác
  el.addEventListener('paste', (e) => {
    e.preventDefault();
    const t = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, t);
  });
  // Bấm "tr.12 ↗" → nhảy tới trang đó
  el.addEventListener('click', (e) => {
    const a = e.target.closest ? e.target.closest('.pref') : null;
    if (!a) return;
    e.preventDefault();
    jumpToPage(Number(a.dataset.p));
    if (isMobile()) setDrawer(false);
  });
}

// Ctrl+F / F3: tìm chữ ngay trong app thay vì hộp tìm của trình duyệt (trình duyệt
// chỉ thấy phần đang hiện trên màn hình, còn app tìm được cả tài liệu).
document.addEventListener('keydown', (e) => {
  if (!modalEl.hidden || !backupModalEl.hidden || !confirmEl.hidden || !promptEl.hidden) return;
  if (!pdfDoc) return; // chưa mở sách thì cứ để trình duyệt làm việc của nó
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    openFindPanel();
  } else if (e.key === 'F3') {
    e.preventDefault();
    if (FIND.results.length) findStep(e.shiftKey ? -1 : 1);
    else openFindPanel();
  }
});

// Phím tắt: F = tìm chữ, N = ngăn kéo, B = bookmark trang đang đọc, H = bật/tắt bôi,
// P = đồng hồ Pomodoro (chạy được cả khi chưa mở tài liệu)
document.addEventListener('keydown', (e) => {
  if (!modalEl.hidden || !backupModalEl.hidden || !confirmEl.hidden || !promptEl.hidden) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const ae = document.activeElement;
  if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'SELECT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
  if (e.key === 'Escape') {
    if (selCtx) { hideSelbar(); return; }
    if (hlMode) { setHlMode(false); return; }
    if (drawerOpen() && !document.fullscreenElement) { setDrawer(false); return; }
    return;
  }
  if (e.key.toLowerCase() === 'p') { e.preventDefault(); setPomoOpen(!POMO.open); return; }
  if (!pdfDoc) return;
  const k = e.key.toLowerCase();
  if (k === 'f') { e.preventDefault(); openFindPanel(); }
  else if (k === 'n') { e.preventDefault(); toggleDrawer(); }
  else if (k === 'b') { e.preventDefault(); toggleBookmark(readingPageIndex()); }
  else if (k === 'h') { e.preventDefault(); setHlMode(!hlMode); }
});

// ---------- Đồng hồ Pomodoro ----------
// Đọc 25 phút rồi nghỉ 5 phút; xong 4 lượt thì nghỉ dài. Đếm giờ bằng mốc thời
// gian thật (Date.now) chứ không cộng dồn từng nhịp — tab bị trình duyệt ru ngủ
// thì lúc quay lại giờ vẫn đúng.
const pomoEl = $('pomo');
const pomoBtn = $('pomoBtn');
const pomoPhaseEl = $('pomoPhase');
const pomoTimeEl = $('pomoTime');
const pomoArcEl = $('pomoArc');
const pomoStartBtn = $('pomoStart');
const pomoSkipBtn = $('pomoSkip');
const pomoResetBtn = $('pomoReset');
const pomoMinBtn = $('pomoMin');
const pomoCloseBtn = $('pomoClose');
const pomoDotsEl = $('pomoDots');
const pomoStatEl = $('pomoStat');
const pomoPosBtn = $('pomoPos');
const pomoCfgEls = {
  focus: $('pomoCfgFocus'),
  short: $('pomoCfgShort'),
  long: $('pomoCfgLong'),
  auto: $('pomoCfgAuto'),
  sound: $('pomoCfgSound'),
};

const POMO_KEY = 'ptr.pomo';
const POMO_DEF = { focus: 25, short: 5, long: 15, every: 4, auto: true, sound: true };
const POMO_LABEL = { focus: 'TẬP TRUNG', short: 'NGHỈ NGẮN', long: 'NGHỈ DÀI' };
const POMO_DONE_SAY = {
  focus: 'Hết một phiên đọc — đứng dậy, nhìn ra xa cho mắt nghỉ.',
  short: 'Hết giờ nghỉ — quay lại đọc tiếp nào.',
  long: 'Hết giờ nghỉ dài — bắt đầu vòng mới.',
};
const POMO_ARC_C = pomoArcEl ? 2 * Math.PI * Number(pomoArcEl.getAttribute('r') || 0) : 0;
const PAGE_TITLE = document.title;

let POMO = {
  phase: 'focus',            // 'focus' | 'short' | 'long'
  running: false,
  endsAt: 0,                 // mốc kết thúc (ms) khi đang chạy
  left: POMO_DEF.focus * 60, // số giây còn lại khi đang tạm dừng
  done: 0,                   // số phiên tập trung đã xong trong ngày
  day: '',
  open: false,
  mini: false,
  pos: null,                 // {x, y} khi người đọc tự kéo đồng hồ đi chỗ khác
  cfg: { ...POMO_DEF },
};
let pomoTimer = null;
let pomoAudio = null;

const pomoToday = () => new Date().toISOString().slice(0, 10);
const pomoDur = (ph) => Math.max(1, Math.min(180, Math.round(POMO.cfg[ph] || POMO_DEF[ph]))) * 60;
const pomoLeft = () =>
  POMO.running ? Math.max(0, Math.round((POMO.endsAt - Date.now()) / 1000)) : Math.max(0, Math.round(POMO.left));
const pomoClock = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

function pomoSave() {
  try { localStorage.setItem(POMO_KEY, JSON.stringify(POMO)); } catch {}
}
function pomoLoad() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(POMO_KEY) || '{}'); } catch {}
  POMO = { ...POMO, ...s, cfg: { ...POMO_DEF, ...(s.cfg || {}) } };
  if (POMO.day !== pomoToday()) { POMO.done = 0; POMO.day = pomoToday(); }
  let missed = '';
  if (POMO.running && POMO.endsAt <= Date.now()) {
    // Phiên kết thúc trong lúc app đóng: ghi nhận rồi sang phiên mới, không reo chuông muộn.
    missed = POMO_DONE_SAY[POMO.phase];
    pomoAdvance({ silent: true });
  } else if (!POMO.running) {
    POMO.left = Math.min(POMO.left || pomoDur(POMO.phase), pomoDur(POMO.phase));
  }
  for (const k of ['focus', 'short', 'long']) if (pomoCfgEls[k]) pomoCfgEls[k].value = POMO.cfg[k];
  if (pomoCfgEls.auto) pomoCfgEls.auto.checked = !!POMO.cfg.auto;
  if (pomoCfgEls.sound) pomoCfgEls.sound.checked = !!POMO.cfg.sound;
  pomoEl.classList.toggle('mini', !!POMO.mini);
  pomoMinBtn.textContent = POMO.mini ? '⤢' : '–';
  setPomoOpen(!!POMO.open, { silent: true });
  if (POMO.running) pomoLoop();
  pomoRender();
  if (missed) pomoSay('Trong lúc bạn rời đi: ' + missed);
}

function setPomoOpen(v, { silent = false } = {}) {
  POMO.open = !!v;
  pomoEl.hidden = !POMO.open;
  if (pomoBtn) pomoBtn.setAttribute('aria-expanded', String(POMO.open));
  if (POMO.open) { pomoReparent(); pomoApplyPos(); pomoRender(); }
  else document.title = PAGE_TITLE;
  if (!silent) pomoSave();
}

// --- Kéo đồng hồ tới chỗ mình thích ---
// Vị trí lưu theo toạ độ góc trái-trên và luôn được kẹp lại trong màn hình, để
// đổi cỡ cửa sổ hay xoay ngang điện thoại thì đồng hồ không lạc ra ngoài.
function pomoApplyPos() {
  if (!POMO.pos) {
    pomoEl.style.left = '';
    pomoEl.style.top = '';
    pomoEl.style.bottom = '';
    return;
  }
  const r = pomoEl.getBoundingClientRect();
  const w = r.width || 222;
  const h = r.height || 240;
  const m = 8;
  const x = Math.max(m, Math.min(Math.max(m, window.innerWidth - w - m), POMO.pos.x));
  const y = Math.max(m, Math.min(Math.max(m, window.innerHeight - h - m), POMO.pos.y));
  POMO.pos = { x, y };
  pomoEl.style.left = x + 'px';
  pomoEl.style.top = y + 'px';
  pomoEl.style.bottom = 'auto';
}
// Thả gần mép thì cho dính hẳn vào mép cho gọn
function pomoSnapPos() {
  if (!POMO.pos) return;
  const r = pomoEl.getBoundingClientRect();
  const m = 18;
  const near = 30;
  if (POMO.pos.x < near) POMO.pos.x = m;
  else if (window.innerWidth - (POMO.pos.x + r.width) < near) POMO.pos.x = window.innerWidth - r.width - m;
  if (POMO.pos.y < near) POMO.pos.y = m;
  else if (window.innerHeight - (POMO.pos.y + r.height) < near) POMO.pos.y = window.innerHeight - r.height - m;
  pomoApplyPos();
}
function pomoResetPos() {
  POMO.pos = null;
  pomoApplyPos();
  pomoSave();
}

let pomoDrag = null;
pomoEl.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  if (e.target.closest('button, input, select, textarea, summary, a, label')) return; // chừa mấy nút bấm ra
  const r = pomoEl.getBoundingClientRect();
  pomoDrag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false };
  try { pomoEl.setPointerCapture(e.pointerId); } catch {}
  pomoEl.classList.add('dragging');
});
pomoEl.addEventListener('pointermove', (e) => {
  if (!pomoDrag || e.pointerId !== pomoDrag.id) return;
  e.preventDefault();
  pomoDrag.moved = true;
  POMO.pos = { x: e.clientX - pomoDrag.dx, y: e.clientY - pomoDrag.dy };
  pomoApplyPos();
});
function pomoEndDrag(e) {
  if (!pomoDrag || e.pointerId !== pomoDrag.id) return;
  try { pomoEl.releasePointerCapture(e.pointerId); } catch {}
  pomoEl.classList.remove('dragging');
  if (pomoDrag.moved) { pomoSnapPos(); pomoSave(); }
  pomoDrag = null;
}
pomoEl.addEventListener('pointerup', pomoEndDrag);
pomoEl.addEventListener('pointercancel', pomoEndDrag);
window.addEventListener('resize', () => { if (POMO.open) pomoApplyPos(); });
// Đọc toàn màn hình dùng phần tử #book, nên đồng hồ phải chui vào đó mới hiện được.
function pomoReparent() {
  const host = document.fullscreenElement || document.body;
  if (pomoEl.parentElement !== host) host.appendChild(pomoEl);
}

function pomoLoop() {
  clearInterval(pomoTimer);
  pomoTimer = setInterval(pomoTick, 250);
}
function pomoStopLoop() {
  clearInterval(pomoTimer);
  pomoTimer = null;
}
function pomoTick() {
  if (!POMO.running) return pomoStopLoop();
  if (pomoLeft() <= 0) pomoAdvance();
  else pomoRender();
}

function pomoStart() {
  if (POMO.running) return;
  const left = Math.max(1, pomoLeft()); // đọc số giây còn lại TRƯỚC khi bật cờ chạy
  POMO.running = true;
  POMO.endsAt = Date.now() + left * 1000;
  pomoLoop();
  pomoSave();
  pomoRender();
}
function pomoPause() {
  if (!POMO.running) return;
  POMO.left = pomoLeft();
  POMO.running = false;
  POMO.endsAt = 0;
  pomoStopLoop();
  pomoSave();
  pomoRender();
}
function pomoReset() {
  POMO.running = false;
  POMO.endsAt = 0;
  POMO.left = pomoDur(POMO.phase);
  pomoStopLoop();
  pomoSave();
  pomoRender();
}
// Sang phiên kế tiếp. Bấm "Bỏ qua" giữa chừng thì không tính là một phiên đã xong.
function pomoAdvance({ silent = false, count = true } = {}) {
  const from = POMO.phase;
  if (from === 'focus' && count) {
    if (POMO.day !== pomoToday()) { POMO.done = 0; POMO.day = pomoToday(); }
    POMO.done += 1;
  }
  const every = Math.max(1, Math.round(POMO.cfg.every || POMO_DEF.every));
  POMO.phase = from === 'focus' ? (count && POMO.done % every === 0 ? 'long' : 'short') : 'focus';
  POMO.running = false;
  POMO.endsAt = 0;
  POMO.left = pomoDur(POMO.phase);
  pomoStopLoop();
  if (!silent && count) {
    pomoChime(from === 'focus' ? 3 : 2);
    pomoNotify(POMO_DONE_SAY[from]);
  }
  pomoSave();
  pomoRender();
  if (!silent && count) pomoSay(POMO_DONE_SAY[from]);
  if (!silent && POMO.cfg.auto) pomoStart();
}

// Lời nhắn giữ nguyên trên thẻ đồng hồ cho tới nhịp đếm kế tiếp
function pomoSay(msg) {
  pomoStatEl.textContent = msg;
  pomoStatEl.dataset.keep = '1';
  clearTimeout(pomoSay.t);
  pomoSay.t = setTimeout(() => {
    delete pomoStatEl.dataset.keep;
    pomoRender();
  }, 20000);
}

function pomoChime(beeps) {
  if (!POMO.cfg.sound) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    pomoAudio = pomoAudio || new AC();
    if (pomoAudio.state === 'suspended') pomoAudio.resume();
    const t0 = pomoAudio.currentTime + 0.02;
    for (let i = 0; i < beeps; i++) {
      const at = t0 + i * 0.3;
      const osc = pomoAudio.createOscillator();
      const gain = pomoAudio.createGain();
      osc.type = 'sine';
      osc.frequency.value = 620 + i * 130;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.2, at + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.26);
      osc.connect(gain).connect(pomoAudio.destination);
      osc.start(at);
      osc.stop(at + 0.28);
    }
  } catch {}
}
function pomoNotify(msg) {
  setStatus(msg, 'done');
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Pomodoro — ' + POMO_LABEL[POMO.phase].toLowerCase(), { body: msg, tag: 'ptr-pomo' });
    }
  } catch {}
}
function pomoAskNotify() {
  try {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  } catch {}
}

function pomoRender() {
  const left = pomoLeft();
  const total = pomoDur(POMO.phase);
  pomoEl.dataset.phase = POMO.phase;
  pomoEl.classList.toggle('paused', !POMO.running);
  pomoPhaseEl.textContent = POMO_LABEL[POMO.phase];
  pomoTimeEl.textContent = pomoClock(left);
  if (pomoArcEl) {
    pomoArcEl.style.strokeDasharray = POMO_ARC_C;
    pomoArcEl.style.strokeDashoffset = POMO_ARC_C * (1 - Math.max(0, Math.min(1, left / total)));
  }
  const midway = left < total;
  pomoStartBtn.textContent = POMO.running ? '⏸ Dừng' : (midway ? '▶ Tiếp' : '▶ Bắt đầu');
  pomoStartBtn.classList.toggle('btn-primary', !POMO.running);
  const every = Math.max(1, Math.round(POMO.cfg.every || POMO_DEF.every));
  const inRound = POMO.done % every;
  pomoDotsEl.innerHTML = Array.from({ length: every }, (_, i) => '<i class="' + (i < inRound ? 'on' : '') + '"></i>').join('');
  pomoDotsEl.title = 'Đã xong ' + POMO.done + ' phiên đọc hôm nay';
  if (POMO.open) {
    document.title = POMO.running
      ? pomoClock(left) + (POMO.phase === 'focus' ? ' 📖 ' : ' ☕ ') + PAGE_TITLE
      : PAGE_TITLE;
  }
  if (!pomoStatEl.dataset.keep) {
    pomoStatEl.textContent = POMO.done
      ? 'Hôm nay: ' + POMO.done + ' phiên đọc · còn ' + (every - inRound) + ' phiên nữa tới kỳ nghỉ dài'
      : 'Đọc một mạch tới khi hết giờ. Đừng nghỉ giữa phiên.';
  }
}

function pomoCfgChanged() {
  for (const k of ['focus', 'short', 'long']) {
    const el = pomoCfgEls[k];
    if (!el) continue;
    const v = Math.max(1, Math.min(180, Math.round(Number(el.value) || POMO_DEF[k])));
    POMO.cfg[k] = v;
    el.value = v;
  }
  if (pomoCfgEls.auto) POMO.cfg.auto = pomoCfgEls.auto.checked;
  if (pomoCfgEls.sound) POMO.cfg.sound = pomoCfgEls.sound.checked;
  if (!POMO.running) POMO.left = pomoDur(POMO.phase); // đang dừng thì áp giờ mới ngay
  pomoSave();
  pomoRender();
}

if (pomoBtn) pomoBtn.addEventListener('click', () => setPomoOpen(!POMO.open));
pomoCloseBtn.addEventListener('click', () => setPomoOpen(false));
pomoMinBtn.addEventListener('click', () => {
  POMO.mini = !POMO.mini;
  pomoEl.classList.toggle('mini', POMO.mini);
  pomoMinBtn.textContent = POMO.mini ? '⤢' : '–';
  pomoMinBtn.title = POMO.mini ? 'Mở rộng' : 'Thu gọn';
  pomoApplyPos(); // đổi cỡ thẻ thì kẹp lại cho khỏi lòi ra ngoài màn hình
  pomoSave();
});
pomoPosBtn.addEventListener('click', pomoResetPos);
pomoStartBtn.addEventListener('click', () => {
  if (POMO.running) pomoPause();
  else { pomoAskNotify(); pomoStart(); }
});
pomoSkipBtn.addEventListener('click', () => pomoAdvance({ count: false }));
pomoResetBtn.addEventListener('click', pomoReset);
Object.values(pomoCfgEls).forEach((el) => el && el.addEventListener('change', pomoCfgChanged));

// ---------- Init ----------
// Ghim chiều cao topbar vào biến CSS để thanh Thư viện dính đúng ngay dưới topbar
// (topbar co giãn khi đổi khổ màn hình / mở menu ☰ trên điện thoại).
function syncTopbarHeight() {
  document.documentElement.style.setProperty('--topbar-h', (topbarEl ? topbarEl.offsetHeight : 0) + 'px');
}
if (window.ResizeObserver && topbarEl) new ResizeObserver(syncTopbarHeight).observe(topbarEl);
window.addEventListener('resize', syncTopbarHeight);
syncTopbarHeight();

loadSettings();
pomoLoad();
updateKeyHint();
loadConfig();
zoom = Math.min(3, Math.max(0.5, Number(localStorage.getItem('ptr.zoom')) || 1));
applyZoomVar();
setMode(localStorage.getItem('ptr.mode') || 'both');
setReadMode(localStorage.getItem('ptr.readmode') || 'scroll');
renderSwatches();
setNotesEnabled(false);
requestPersistentStorage();
restoreLastDoc();

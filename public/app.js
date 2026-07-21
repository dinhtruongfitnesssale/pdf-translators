import * as pdfjsLib from '/vendor/pdfjs/pdf.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.mjs';

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const providerEl = $('provider');
const apiKeyEl = $('apiKey');
const modelEl = $('model');
const modelList = $('modelList');
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

// Đừng để trình duyệt tự khôi phục cuộn (nó reset về 0 và cãi với code của mình)
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

// ---------- State ----------
const MODEL_SUGGEST = {
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
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
function applyModelSuggest(preferred) {
  const list = MODEL_SUGGEST[providerEl.value] || [];
  modelList.innerHTML = list.map((m) => `<option value="${m}"></option>`).join('');
  if (preferred && (list.includes(preferred) || preferred.length)) modelEl.value = preferred;
  else modelEl.value = list[0] || '';
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
      ed.addEventListener('input', () => {
        block.text = ed.textContent;
        savePageTranslation(entry);
      });
      row.appendChild(ed);
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
    return `<div class="doc-chip${active ? ' active' : ''}" title="${escapeHtml(title)}">
      <button class="doc-open" type="button" data-id="${idAttr}">
        <span class="doc-ic" aria-hidden="true">📄</span><span class="doc-name">${escapeHtml(title)}</span>
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
      setStatus('Không tìm thấy dữ liệu tài liệu (có thể đã bị xóa).', 'error');
      return;
    }
    setStatus('Đang mở tài liệu…', 'working');
    upsertLibrary({ id, name: rec.name, size: rec.size });
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
  requestAnimationFrame(() => { pageRaf = false; updatePageInput(); });
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
  upsertLibrary({ id, name: file.name, size: file.size });
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
  document.body.classList.add('doc-open');
  const saved = loadTranslations(docId);

  // reset UI
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
    tag.textContent = `Trang ${i} / ${pdf.numPages}`;
    const canvas = document.createElement('canvas');
    orig.append(tag, canvas);
    frag.appendChild(orig);

    // --- right: translation ---
    const trans = document.createElement('div');
    trans.className = 'trans';
    const bar = document.createElement('div');
    bar.className = 'trans-toolbar';
    const pnum = document.createElement('span');
    pnum.className = 'pnum';
    pnum.textContent = `Trang ${i}`;
    const retro = document.createElement('button');
    retro.className = 'retro';
    retro.type = 'button';
    retro.textContent = 'Dịch lại';
    const pstat = document.createElement('span');
    pstat.className = 'pstat';
    const blocksEl = document.createElement('div');
    blocksEl.className = 'blocks';
    bar.append(pnum, retro, pstat);
    trans.append(bar, blocksEl);
    frag.appendChild(trans);

    const entry = {
      index: i - 1, pageNum: i, canvas,
      origEl: orig, transEl: trans,
      sourceText: null, // trích chữ trễ (chỉ khi cần dịch)
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
  e.renderingSig = sig;
  try {
    const page = await pdfDoc.getPage(e.pageNum);
    const v = page.getViewport({ scale: 1 });
    e.aspect = v.height / v.width; // tỉ lệ thật của trang (phòng trang khác khổ)
    await renderPage(page, e.canvas, e.origEl);
    e.rendered = true;
    e.renderSig = sig;
  } catch {}
  finally { e.renderingSig = null; }
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

async function renderBookPage(canvas, pageNum, maxW, maxH) {
  const page = await pdfDoc.getPage(pageNum);
  const base = page.getViewport({ scale: 1 });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const fit = Math.max(0.1, Math.min(maxW / base.width, maxH / base.height) * zoom);
  const viewport = page.getViewport({ scale: fit * dpr });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = (viewport.width / dpr) + 'px';
  canvas.style.height = (viewport.height / dpr) + 'px';
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
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
  bookLeftCanvas.hidden = false;
  if (hasRight) {
    bookRightCanvas.hidden = false;
    await renderBookPage(bookRightCanvas, rightNum, halfW, stageH);
    if (token !== bookToken) return;
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
      node.textContent = f.text;
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
  document.body.classList.remove('doc-open');
  docTitle = 'ban-dich';
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

async function renderPage(page, canvas, container) {
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
  await page.render({ canvasContext: ctx, viewport }).promise;
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
providerEl.addEventListener('change', () => { applyModelSuggest(); saveSettings(); });
[apiKeyEl, modelEl, skillEl, rememberEl].forEach((el) =>
  el.addEventListener('change', saveSettings));
apiKeyEl.addEventListener('input', updateKeyHint);
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
});
bookStage.addEventListener('click', (e) => {
  const r = bookStage.getBoundingClientRect();
  if (e.clientX - r.left < r.width / 2) bookGo(-1); else bookGo(1);
});
document.addEventListener('keydown', (e) => {
  if (readMode !== 'book' || !modalEl.hidden) return;
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
    head.append(tag, btn);
    const canvas = document.createElement('canvas');
    canvas.className = 'ov-canvas';
    const stat = document.createElement('div');
    stat.className = 'ov-stat';
    wrap.append(head, canvas, stat);
    const rec = all[i - 1];
    const entry = {
      pageNum: i, el: wrap, canvas, statEl: stat, btnEl: btn, ext: null,
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
    await composeOverlay(entry, { canvas: entry.canvas, cssW, mode: 'screen' });
    entry.composed = true;
    entry.sig = sig;
  } catch (e) {
    /* trang lỗi → bỏ qua, giữ canvas cũ */
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
updateKeyHint();
loadConfig();
zoom = Math.min(3, Math.max(0.5, Number(localStorage.getItem('ptr.zoom')) || 1));
applyZoomVar();
setMode(localStorage.getItem('ptr.mode') || 'both');
setReadMode(localStorage.getItem('ptr.readmode') || 'scroll');
requestPersistentStorage();
restoreLastDoc();

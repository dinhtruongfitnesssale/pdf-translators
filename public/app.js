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
const fileInput = $('fileInput');
const openBtn = $('openBtn');
const translateBtn = $('translateBtn');
const exportBtn = $('exportBtn');
const closeBtn = $('closeBtn');
const viewmodeEl = $('viewmode');
const readmodeEl = $('readmode');
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
let viewMode = 'both'; // 'both' | 'trans' | 'orig'
let readMode = 'scroll'; // 'scroll' | 'book'
let bookIndex = 0; // trang bên trái (0-based) ở chế độ Đọc sách
let transPages = []; // bản dịch đã dàn thành từng trang (chuỗi)
let transSig = ''; // chữ ký để cache kết quả dàn trang
let zoom = 1; // 0.5 – 3
const pages = []; // { index, pageNum, canvas, origEl, transEl, sourceText, editor, statEl, aspect, rendered }
let renderObserver = null; // vẽ canvas trễ khi trang cuộn tới gần khung nhìn

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
function saveTranslation(id, idx, text) {
  const all = loadTranslations(id);
  all[idx] = text;
  localStorage.setItem(trKey(id), JSON.stringify(all));
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
  if (!confirm(`Gỡ “${title}” khỏi thư viện?\nBản dịch và vị trí đọc của tài liệu này sẽ bị xóa khỏi máy.`)) return;
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
  return (t ? t.offsetHeight : 120) + 10;
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
  if (!docId || readMode === 'book') return;
  schedulePageUpdate();
  if (suppressScrollSave) return;
  if (scrollTimer) return;
  scrollTimer = setTimeout(() => {
    scrollTimer = null;
    localStorage.setItem(pageKey(docId), String(currentTopPage()));
  }, 200);
}, { passive: true });

let resizeTimer = null;
window.addEventListener('resize', () => {
  if (!pdfDoc) return;
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
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
  if (docId && pages.length) localStorage.setItem(pageKey(docId), String(currentTopPage()));
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

  docTitle = name.replace(/\.pdf$/i, '');
  docId = `${name}::${size}`;
  const saved = loadTranslations(docId);

  // reset UI
  pages.length = 0;
  [...pagesEl.querySelectorAll('.orig, .trans')].forEach((n) => n.remove());
  emptyEl.hidden = true;
  pagesEl.hidden = false;

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
    const editor = document.createElement('div');
    editor.className = 'editor';
    editor.contentEditable = 'true';
    editor.spellcheck = false;
    bar.append(pnum, retro, pstat);
    trans.append(bar, editor);
    frag.appendChild(trans);

    const entry = {
      index: i - 1, pageNum: i, canvas,
      origEl: orig, transEl: trans,
      sourceText: null, // trích chữ trễ (chỉ khi cần dịch)
      editor, statEl: pstat,
      aspect: defAspect, rendered: false, renderSig: '', renderingSig: null,
    };
    orig._entry = entry;
    pages.push(entry);

    // restore saved translation
    if (saved[i - 1] != null) {
      editor.textContent = saved[i - 1];
      setPageStat(pstat, 'đã lưu', 'done');
    }

    editor.addEventListener('input', () => saveTranslation(docId, entry.index, editor.textContent));
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
  if (readMode === 'book') setReadMode('book');
  else restoreReadingPosition(savedPage);
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

function setMode(mode) {
  const keep = (readMode === 'scroll' && docId && pages.length) ? currentTopPage() : 0;
  viewMode = mode;
  localStorage.setItem('ptr.mode', mode);
  [...viewmodeEl.querySelectorAll('.seg')].forEach((b) =>
    b.classList.toggle('active', b.dataset.mode === mode));

  if (readMode === 'book') {
    transSig = ''; // buộc dàn lại nếu chuyển sang bản dịch
    if (docId) bookIndex = Number(localStorage.getItem((mode === 'trans' ? tPageKey : pageKey)(docId)) || 0);
    if (pdfDoc) renderBook();
    return;
  }
  applyScrollLayout(keep);
}

// ---------- Chế độ Đọc sách ----------
// Gom toàn bộ bản dịch (bỏ trang trống), nối bằng ngắt đoạn
function fullTranslatedText() {
  return pages.map((p) => (p.editor.textContent || '').trim()).filter(Boolean).join('\n\n');
}

// Dàn chữ thành từng trang bằng cách đo chiều cao (nhị phân theo token)
function paginateTranslation(text, contentW, contentH, fontPx, lineH) {
  measEl.style.width = contentW + 'px';
  measEl.style.fontFamily = getComputedStyle(document.body).fontFamily;
  measEl.style.fontSize = fontPx + 'px';
  measEl.style.lineHeight = String(lineH);
  const toks = text.split(/(\s+)/);
  const join = (a, b) => toks.slice(a, b).join('');
  const out = [];
  let i = 0;
  while (i < toks.length) {
    let lo = i + 1, hi = toks.length, fit = i + 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      measEl.textContent = join(i, mid);
      if (measEl.scrollHeight <= contentH) { fit = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    if (fit <= i) fit = i + 1; // luôn tiến ít nhất 1 token (phòng từ quá dài)
    out.push(join(i, fit).replace(/^\s+/, ''));
    i = fit;
  }
  return out.length ? out : [''];
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
function renderBookTranslation() {
  bookLeftCanvas.hidden = true;
  bookRightCanvas.hidden = true;

  const text = fullTranslatedText();
  if (!text) {
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

  const sig = [text.length, Math.round(contentW), Math.round(contentH), Math.round(fontPx * 10)].join('|');
  if (sig !== transSig) {
    transPages = paginateTranslation(text, contentW, contentH, fontPx, lineH);
    transSig = sig;
  }
  const total = transPages.length;
  bookIndex = Math.min(Math.max(0, bookIndex), total - 1);

  applyPageStyle(bookTextLeft, pageW, pageH, padX, padY, fontPx, lineH);
  bookTextLeft.textContent = transPages[bookIndex] || '';
  bookTextLeft.hidden = false;

  const rightIdx = bookIndex + 1;
  if (!single && rightIdx < total) {
    applyPageStyle(bookTextRight, pageW, pageH, padX, padY, fontPx, lineH);
    bookTextRight.textContent = transPages[rightIdx];
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
  const keep = (docId && pages.length) ? currentTopPage() : 0;
  zoom = Math.min(3, Math.max(0.5, Math.round(next * 100) / 100));
  applyZoomVar();
  localStorage.setItem('ptr.zoom', String(zoom));
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
  docTitle = 'ban-dich';
  [...pagesEl.querySelectorAll('.orig, .trans')].forEach((n) => n.remove());
  pagesEl.hidden = true;
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
  if (!force && entry.editor.textContent.trim()) return true;

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
    entry.editor.textContent = data.translation || '';
    saveTranslation(docId, entry.index, entry.editor.textContent);
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
  let list;
  if (rangeAllEl.checked) {
    list = pages;
  } else {
    const total = pages.length;
    let from = parseInt(rangeFromEl.value, 10);
    let to = parseInt(rangeToEl.value, 10);
    if (!Number.isFinite(from) || !Number.isFinite(to)) {
      setModalHint('Nhập số trang bắt đầu và kết thúc.', true);
      return;
    }
    from = Math.min(Math.max(1, from), total);
    to = Math.min(Math.max(1, to), total);
    if (from > to) { const t = from; from = to; to = t; } // tự đảo nếu nhập ngược
    list = pages.slice(from - 1, to);
  }
  closeRangeModal();
  runTranslate(list);
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
  if (!pages.length) return;
  const payload = {
    title: docTitle + ' — bản dịch',
    pages: pages.map((p) => p.editor.textContent),
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

// ---------- Init ----------
loadSettings();
updateKeyHint();
loadConfig();
zoom = Math.min(3, Math.max(0.5, Number(localStorage.getItem('ptr.zoom')) || 1));
applyZoomVar();
setMode(localStorage.getItem('ptr.mode') || 'both');
setReadMode(localStorage.getItem('ptr.readmode') || 'scroll');
restoreLastDoc();

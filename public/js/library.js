'use strict';
// PDF mở gần nhất (IndexedDB) + thư viện tối đa 3 tài liệu.
// Script thường (không phải module): dùng chung phạm vi toàn cục với các file khác,
// thứ tự nạp nằm trong index.html.

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

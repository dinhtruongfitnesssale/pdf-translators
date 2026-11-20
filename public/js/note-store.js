'use strict';
// Kho dữ liệu bookmark / highlight / ghi chú + chương + trang đang đọc.
// Script thường (không phải module): dùng chung phạm vi toàn cục với các file khác,
// thứ tự nạp nằm trong index.html.

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

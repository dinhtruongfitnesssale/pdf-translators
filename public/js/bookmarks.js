'use strict';
// Bookmark.
// Script thường (không phải module): dùng chung phạm vi toàn cục với các file khác,
// thứ tự nạp nằm trong index.html.

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

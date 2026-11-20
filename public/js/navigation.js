'use strict';
// Vị trí đọc, ô số trang, lưu cuộn.
// Script thường (không phải module): dùng chung phạm vi toàn cục với các file khác,
// thứ tự nạp nằm trong index.html.

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

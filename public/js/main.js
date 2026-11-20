'use strict';
// Khởi động app (chạy sau cùng).
// Script thường (không phải module): dùng chung phạm vi toàn cục với các file khác,
// thứ tự nạp nằm trong index.html.

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

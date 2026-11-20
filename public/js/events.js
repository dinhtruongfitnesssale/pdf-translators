'use strict';
// Gắn sự kiện chính + menu ☰ trên điện thoại.
// Script thường (không phải module): dùng chung phạm vi toàn cục với các file khác,
// thứ tự nạp nằm trong index.html.

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

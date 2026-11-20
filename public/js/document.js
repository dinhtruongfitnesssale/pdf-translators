'use strict';
// Đóng tài liệu, mở lại tài liệu cũ, vẽ một trang.
// Script thường (không phải module): dùng chung phạm vi toàn cục với các file khác,
// thứ tự nạp nằm trong index.html.

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

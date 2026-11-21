'use strict';
// Dịch, modal chọn phạm vi trang, xuất PDF.
// Script thường (không phải module): dùng chung phạm vi toàn cục với các file khác,
// thứ tự nạp nằm trong index.html.

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
        ...keepPayload(),
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

// ---------- Đang dịch hàng loạt ----------
// Trong lúc chạy, nút "Dịch tài liệu" biến thành "Dừng dịch" (dừng sau trang đang dịch dở).
let TR_RUN = null;
function startTrRun() {
  TR_RUN = { stop: false, doc: docId };
  translateBtn.textContent = 'Dừng dịch';
  translateBtn.classList.add('btn-danger');
  translateBtn.disabled = false;
  openBtn.disabled = true;
  return TR_RUN;
}
function endTrRun() {
  TR_RUN = null;
  translateBtn.textContent = 'Dịch tài liệu';
  translateBtn.classList.remove('btn-danger');
  translateBtn.disabled = !pdfDoc;
  openBtn.disabled = false;
}
function requestStopTr() {
  if (!TR_RUN) return;
  TR_RUN.stop = true;
  translateBtn.disabled = true;
  translateBtn.textContent = 'Đang dừng…';
  setStatus('Sẽ dừng sau khi xong trang đang dịch…', 'working');
}
// Hết lượt vì tài liệu đã đóng / đổi sang tài liệu khác?
const trRunCancelled = (run) => run.stop || docId !== run.doc;

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
  setModalHint(overlaySkipNote());
  modalEl.hidden = false;
  rangeFromEl.focus();
}
function closeRangeModal() { modalEl.hidden = true; }
// Ở chế độ Đè trang: báo trước những trang đã dịch sẽ được bỏ qua
function overlaySkipNote() {
  if (viewMode !== 'overlay') return '';
  const done = overlayPages.filter((e) => e.translated).length;
  return done ? `Đã có ${done}/${pages.length} trang dịch đè trang — các trang này sẽ được bỏ qua (muốn dịch lại trang nào thì bấm "Dịch lại" trên trang đó).` : '';
}

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
  const run = startTrRun();
  let ok = 0, failed = false;
  for (let i = 0; i < list.length; i++) {
    if (trRunCancelled(run)) break;
    setStatus(`Đang dịch ${i + 1}/${list.length} (trang ${list[i].index + 1})…`, 'working');
    const done = await translateOne(list[i], true);
    if (done) ok++;
    else { failed = true; break; } // dừng nếu lỗi (thường do key/quota) để bạn xử lý
  }
  const stopped = run.stop;
  endTrRun();
  if (ok === list.length) setStatus(`Đã dịch xong ${ok}/${list.length} trang.`, 'done');
  else if (stopped && !failed) setStatus(`Đã dừng ở ${ok}/${list.length} trang.`, '');
  else if (failed) setStatus(`Dừng ở ${ok}/${list.length} trang. Kiểm tra thông báo lỗi rồi thử lại.`, 'error');
}

// ---------- Export PDF ----------
async function exportPdf() {
  if (viewMode === 'overlay') {
    // đang xuất → nút này là "Dừng xuất"; không thì mở hộp chọn trang / chất lượng
    if (EX_RUN) stopOverlayExport();
    else openOverlayExportModal();
    return;
  }
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

'use strict';
// "Tải PDF" ở chế độ Đè trang: chọn khoảng trang / chương, chất lượng ảnh, lớp chữ ẩn.
// Script thường (không phải module): dùng chung phạm vi toàn cục với các file khác,
// thứ tự nạp nằm trong index.html.

// Chất lượng ảnh trang. kb = dung lượng trung bình mỗi trang CHƯA dịch, đo trên một giáo
// trình in dày chữ (trang đã dịch thường dài hơn ~30–60% → nặng hơn tương ứng).
const EX_QUALITY = {
  hi: { px: 1600, q: 0.85, kb: 510, label: 'Nét' },
  mid: { px: 1400, q: 0.8, kb: 380, label: 'Vừa' },
  lo: { px: 1200, q: 0.75, kb: 270, label: 'Nhẹ' },
};
let EX_RUN = null; // đang xuất → nút "Tải PDF bản dịch" thành "Dừng xuất"

const exQualityKey = () => (document.querySelector('input[name="exQuality"]:checked') || {}).value || 'mid';
function exRange() {
  const total = overlayPages.length;
  let a = parseInt(exFromEl.value, 10), b = parseInt(exToEl.value, 10);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  a = Math.min(Math.max(1, a), total); b = Math.min(Math.max(1, b), total);
  return a <= b ? [a, b] : [b, a];
}
function updateExportHint() {
  const r = exRange();
  if (!r) { exHintEl.textContent = 'Nhập trang bắt đầu và kết thúc.'; exHintEl.className = 'modal-hint error'; return; }
  const Q = EX_QUALITY[exQualityKey()];
  let kb = 0, tr = 0;
  for (let i = r[0] - 1; i < r[1]; i++) {
    const done = !!overlayPages[i].translated;
    if (done) tr++;
    kb += Q.kb * (done ? 1.35 : 1);
  }
  if (exTextEl.checked) kb += 80; // phông chữ nhúng
  const n = r[1] - r[0] + 1;
  exHintEl.className = 'modal-hint';
  exHintEl.textContent = `${n} trang (${tr} trang đã dịch) · ước tính khoảng ${fmtSize(kb * 1024)}` +
    (n > 150 ? ' · sách dày: nên xuất từng chương cho nhẹ và nhanh.' : '');
}

// Mục lục 2 cấp cho ô "chọn nhanh": nhiều sách chỉ có PHẦN ở cấp ngoài, CHƯƠNG nằm bên trong.
// Mỗi mục kéo dài tới ngay trước mục kế tiếp cùng cấp hoặc cấp cao hơn.
let exOutlineCache = { doc: null, list: [] };
async function exportOutline() {
  if (exOutlineCache.doc === docId) return exOutlineCache.list;
  const flat = [];
  try {
    let tree = await pdfDoc.getOutline();
    if (Array.isArray(tree) && tree.length === 1 && Array.isArray(tree[0].items) && tree[0].items.length > 1) tree = tree[0].items;
    for (const it of tree || []) {
      const p = await destPage(it.dest);
      if (p != null && p >= 0) flat.push({ title: String(it.title || '').trim(), from: p, level: 0 });
      for (const sub of it.items || []) {
        const q = await destPage(sub.dest);
        if (q != null && q >= 0) flat.push({ title: String(sub.title || '').trim(), from: q, level: 1 });
      }
      if (flat.length > 400) break;
    }
  } catch {}
  const total = pdfDoc.numPages;
  flat.forEach((x, i) => {
    let to = total - 1;
    for (let j = i + 1; j < flat.length; j++) if (flat[j].level <= x.level) { to = flat[j].from - 1; break; }
    x.to = Math.max(x.from, to);
    x.id = 'o' + i;
  });
  exOutlineCache = { doc: docId, list: flat };
  return flat;
}

async function openOverlayExportModal() {
  if (!pdfDoc || !overlayPages.length) { setStatus('Chưa có trang để xuất.', 'error'); return; }
  await overlayHydrated; // số trang đã dịch cho đúng
  const total = overlayPages.length;
  exTotalEl.textContent = String(total);
  exFromEl.max = exToEl.max = String(total);
  exFromEl.value = '1';
  exToEl.value = String(total);
  // Chọn nhanh theo phần / chương: mục lục nhúng trong PDF (2 cấp); không có thì dùng
  // các chương người đọc tự cắt ở phần Ghi chú
  let items = await exportOutline();
  if (!items.length) {
    try { await initChapters(); } catch {}
    items = sortedChapters().map((c) => { const [a, b] = chapterRange(c); return { id: c.id, title: c.title, from: a, to: b, level: 0 }; });
  }
  exChapterWrap.hidden = !items.length;
  exChapterEl.innerHTML = '<option value="">— Tự nhập trang —</option>' +
    `<option value="__all">Toàn bộ tài liệu (tr.1–${total})</option>` +
    items.map((c) => `<option value="${escapeHtml(c.id)}">${c.level ? '    ↳ ' : ''}` +
      `${escapeHtml(c.title)} (tr.${c.from + 1}–${c.to + 1})</option>`).join('');
  exChapterEl._items = items;
  // Đang đọc ở đâu thì chọn sẵn mục nhỏ nhất chứa trang đó (chương thay vì cả phần)
  const p = readingPageIndex();
  let cur = null;
  for (const c of items) if (c.from <= p && p <= c.to && (!cur || c.to - c.from <= cur.to - cur.from)) cur = c;
  exChapterEl.value = cur ? cur.id : '__all';
  applyExportChapter();
  updateExportHint();
  exportModalEl.hidden = false;
  exGoBtn.focus();
}
function closeOverlayExportModal() { exportModalEl.hidden = true; }
function applyExportChapter() {
  const v = exChapterEl.value;
  const c = (exChapterEl._items || []).find((x) => x.id === v);
  if (v === '__all') { exFromEl.value = '1'; exToEl.value = String(overlayPages.length); }
  else if (c) { exFromEl.value = String(c.from + 1); exToEl.value = String(c.to + 1); }
  updateExportHint();
}

function confirmOverlayExport() {
  const r = exRange();
  if (!r) { updateExportHint(); return; }
  closeOverlayExportModal();
  exportOverlayRange(r[0], r[1], exQualityKey(), exTextEl.checked);
}

// Sự kiện của hộp thoại
exGoBtn.addEventListener('click', confirmOverlayExport);
exCancelBtn.addEventListener('click', closeOverlayExportModal);
exportModalEl.addEventListener('click', (e) => { if (e.target === exportModalEl) closeOverlayExportModal(); });
exChapterEl.addEventListener('change', applyExportChapter);
[exFromEl, exToEl].forEach((el) => el.addEventListener('input', () => { exChapterEl.value = ''; updateExportHint(); }));
exTextEl.addEventListener('change', updateExportHint);
document.querySelectorAll('input[name="exQuality"]').forEach((el) => el.addEventListener('change', updateExportHint));
document.addEventListener('keydown', (e) => {
  if (exportModalEl.hidden) return;
  if (e.key === 'Escape') closeOverlayExportModal();
  else if (e.key === 'Enter' && e.target.tagName !== 'SELECT') confirmOverlayExport();
});

const canvasToJpeg = (cnv, q) => new Promise((res, rej) =>
  cnv.toBlob((b) => (b ? res(b) : rej(new Error('Không tạo được ảnh trang'))), 'image/jpeg', q));

function stopOverlayExport() {
  if (!EX_RUN) return;
  EX_RUN.stop = true;
  exportBtn.disabled = true;
  setStatus('Đang dừng xuất PDF…', 'working');
}

async function exportOverlayRange(from, to, qualityKey, withText) {
  const Q = EX_QUALITY[qualityKey] || EX_QUALITY.mid;
  const run = (EX_RUN = { stop: false, doc: docId });
  exportBtn.textContent = 'Dừng xuất';
  setStatus('Đang chuẩn bị xuất PDF…', 'working');
  try {
    await ensureFontsReady();
    await overlayHydrated; // để trang đã dịch từ phiên trước cũng có mặt trong file
    let font = null;
    if (withText) {
      try { font = await loadPdfFont(); }
      catch (e) { setStatus('Không tải được phông chữ cho lớp chữ ẩn — vẫn xuất PDF nhưng không tìm/copy chữ được.', 'error'); await waitMs(1500); }
    }
    const list = overlayPages.slice(from - 1, to);
    const out = [];
    const cnv = document.createElement('canvas');
    const t0 = Date.now();
    for (let i = 0; i < list.length; i++) {
      if (run.stop || docId !== run.doc) break;
      const eta = i ? ` · còn khoảng ${fmtDuration(((Date.now() - t0) / 1000 / i) * (list.length - i))}` : '';
      setStatus(`Đang dựng trang ${list[i].pageNum} (${i + 1}/${list.length})${eta}…`, 'working');
      const dims = await composeOverlay(list[i], { canvas: cnv, mode: 'export', exportPx: Q.px, textRuns: !!font });
      out.push({ jpeg: await canvasToJpeg(cnv, Q.q), pxW: cnv.width, pxH: cnv.height, w: dims.wPt, h: dims.hPt, runs: dims.runs });
    }
    if (docId !== run.doc) return;
    if (run.stop) { setStatus('Đã dừng xuất PDF.', ''); return; }
    setStatus('Đang ghép file PDF…', 'working');
    const whole = from === 1 && to === overlayPages.length;
    const title = docTitle + ' — đè trang' + (whole ? '' : ` (tr.${from}–${to})`);
    const blob = await buildImagePdf(out, { title, font });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docTitle || 'ban-dich'} - de trang${whole ? '' : ` (tr ${from}-${to})`}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000); // file lớn: chờ trình duyệt tải xong mới thu hồi
    const done = list.filter((e) => e.translated).length;
    setStatus(`Đã tạo PDF đè trang: ${list.length} trang (${done} trang có bản dịch), chất lượng ${Q.label}` +
      (font ? ', tìm/copy chữ được' : '') + `, ${fmtSize(blob.size)}.`, 'done');
  } catch (err) {
    setStatus('Lỗi tạo PDF: ' + err.message, 'error');
  } finally {
    EX_RUN = null;
    exportBtn.textContent = 'Tải PDF bản dịch';
    exportBtn.disabled = !pdfDoc;
  }
}

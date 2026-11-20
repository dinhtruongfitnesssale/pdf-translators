'use strict';
// Sao lưu / khôi phục dữ liệu.
// Script thường (không phải module): dùng chung phạm vi toàn cục với các file khác,
// thứ tự nạp nằm trong index.html.

// ---------- Sao lưu / Khôi phục dữ liệu ----------
// Toàn bộ dữ liệu của app nằm trong trình duyệt (localStorage + IndexedDB) nên
// xóa lịch sử duyệt web / đổi máy là mất sạch. Hai nút "Sao lưu" và "Khôi phục"
// gói mọi thứ vào MỘT file .json để cất giữ rồi nạp lại bất cứ lúc nào:
//   • bản dịch từng trang (kể cả ảnh chèn) + bản dịch chế độ "Đè trang"
//   • vị trí đang đọc, danh mục thư viện, cài đặt (bộ máy, model, hồ sơ dịch)
//   • API key — TÙY CHỌN (mặc định có kèm, vì đây là thứ hay mất nhất)
//   • file PDF gốc — TÙY CHỌN (file sao lưu nặng hơn nhiều)
const BACKUP_TAG = 'pdf-translator-backup';
const BACKUP_VERSION = 1;

function readJsonKey(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
// ArrayBuffer ↔ base64 (cắt khúc để không tràn ngăn xếp với file PDF lớn)
function abToB64(ab) {
  const bytes = new Uint8Array(ab);
  const CHUNK = 0x8000;
  let s = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(s);
}
function b64ToAb(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
function fmtSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}
// Đếm số trang đã có bản dịch của một tài liệu (để báo cho người dùng biết
// bản sao lưu chứa những gì).
async function countTranslated(id) {
  const tr = readJsonKey(trKey(id)) || {};
  let n = 0;
  for (const v of Object.values(tr)) {
    if (typeof v === 'string' ? v.trim() : Array.isArray(v) && v.length) n++;
  }
  let ov = {};
  try { ov = await ovIdbAll(id); } catch {}
  const nt = readJsonKey(noteKey(id)) || {};
  return {
    pages: n,
    overlay: Object.keys(ov).length,
    marks: (nt.bookmarks || []).length + (nt.highlights || []).length,
  };
}

async function buildBackup({ withKey, withPdf }) {
  const lib = loadLibrary();
  const docs = [];
  for (const meta of lib) {
    let ov = {};
    try { ov = await ovIdbAll(meta.id); } catch {}
    const item = {
      id: meta.id,
      name: meta.name,
      size: meta.size,
      addedAt: meta.addedAt || null,
      lastOpened: meta.lastOpened || null,
      page: localStorage.getItem(pageKey(meta.id)),
      tpage: localStorage.getItem(tPageKey(meta.id)),
      tr: readJsonKey(trKey(meta.id)) || {},
      ov, // bản dịch "Đè trang" (IndexedDB) — cùng định dạng { trang: { h, vi } } như trước
      note: readJsonKey(noteKey(meta.id)) || null, // bookmark + highlight + ghi chú
      pdf: null,
    };
    if (withPdf) {
      try {
        const rec = await idbGet(meta.id);
        if (rec && rec.bytes) item.pdf = abToB64(rec.bytes);
      } catch {}
    }
    docs.push(item);
  }
  return {
    app: BACKUP_TAG,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    hasKey: !!(withKey && apiKeyEl.value.trim()),
    hasPdf: docs.some((d) => !!d.pdf),
    settings: {
      provider: providerEl.value,
      model: modelEl.value.trim(),
      skill: skillEl.value,
      rememberKey: rememberEl.checked,
      apiKey: withKey ? apiKeyEl.value.trim() : '',
    },
    prefs: {
      mode: localStorage.getItem('ptr.mode') || '',
      readmode: localStorage.getItem('ptr.readmode') || '',
      zoom: localStorage.getItem('ptr.zoom') || '',
    },
    lastDoc: localStorage.getItem(LAST_DOC_KEY) || '',
    docs,
  };
}

async function openBackupModal() {
  const lib = loadLibrary();
  const totals = { pages: 0, overlay: 0, marks: 0, bytes: 0 };
  for (const d of lib) {
    const c = await countTranslated(d.id);
    totals.pages += c.pages;
    totals.overlay += c.overlay;
    totals.marks += c.marks;
    totals.bytes += Number(d.size) || 0;
  }
  backupSummaryEl.innerHTML = lib.length
    ? `Có <b>${lib.length}</b> tài liệu, <b>${totals.pages}</b> trang bản dịch` +
      (totals.overlay ? `, <b>${totals.overlay}</b> trang “Đè trang”` : '') +
      (totals.marks ? `, <b>${totals.marks}</b> bookmark/highlight kèm ghi chú` : '') + '.'
    : 'Chưa có tài liệu nào — bản sao lưu sẽ chỉ gồm cài đặt và API key.';
  bkKeyEl.checked = !!apiKeyEl.value.trim();
  bkKeyEl.disabled = !apiKeyEl.value.trim();
  bkPdfEl.checked = false;
  bkPdfEl.disabled = !lib.length;
  backupModalEl.dataset.pdfBytes = String(totals.bytes);
  updateBackupHint();
  backupModalEl.hidden = false;
  backupGoBtn.focus();
}
function updateBackupHint() {
  const pdfBytes = Number(backupModalEl.dataset.pdfBytes || 0);
  if (bkPdfEl.checked && pdfBytes) {
    // base64 phình ~4/3 lần so với file gốc
    backupHintEl.textContent = `File sao lưu sẽ nặng khoảng ${fmtSize(pdfBytes * 1.37)} — tải xuống lâu hơn.`;
  } else {
    backupHintEl.textContent = 'Không kèm PDF: file rất nhẹ. Khi khôi phục chỉ cần mở lại đúng file PDF cũ, bản dịch tự khớp vào.';
  }
}
function closeBackupModal() { backupModalEl.hidden = true; }

async function doBackup() {
  const withKey = bkKeyEl.checked && !bkKeyEl.disabled;
  const withPdf = bkPdfEl.checked && !bkPdfEl.disabled;
  closeBackupModal();
  setStatus('Đang gói dữ liệu…', 'working');
  try {
    flushPage();  // chốt vị trí đang đọc trước khi gói
    flushNotes(); // chốt ghi chú đang gõ dở
    const data = await buildBackup({ withKey, withPdf });
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const stamp = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sao-luu-dich-pdf-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus(`Đã tải file sao lưu (${fmtSize(blob.size)}).`, 'done');
  } catch (err) {
    setStatus('Không tạo được file sao lưu: ' + err.message, 'error');
  }
}

// Gộp dữ liệu cũ + mới: trang trùng chỉ số thì bản trong file sao lưu thắng.
function mergeStore(key, incoming) {
  if (!incoming || typeof incoming !== 'object' || !Object.keys(incoming).length) return true;
  let cur = {};
  try { cur = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
  try {
    localStorage.setItem(key, JSON.stringify({ ...cur, ...incoming }));
    return true;
  } catch { return false; }
}

async function applyBackup(data) {
  const docs = Array.isArray(data.docs) ? data.docs : [];
  const lib = loadLibrary();
  let added = 0, updated = 0, skipped = 0, withBytes = 0, full = false, quota = false;

  for (const d of docs) {
    if (!d || !d.id) continue;
    const known = lib.findIndex((x) => x.id === d.id);
    if (known < 0 && lib.length >= MAX_DOCS) { skipped++; full = true; continue; }

    if (!mergeStore(trKey(d.id), d.tr)) quota = true;
    if (d.ov && typeof d.ov === 'object') {
      try { await ovIdbPutMany(d.id, d.ov); } catch { quota = true; }
    }
    if (!mergeNoteStore(d.id, d.note)) quota = true;
    if (d.page != null) localStorage.setItem(pageKey(d.id), String(d.page));
    if (d.tpage != null) localStorage.setItem(tPageKey(d.id), String(d.tpage));

    // File PDF: lấy từ bản sao lưu nếu có, nếu không thì giữ file đang có trong máy
    let hasBytes = false;
    if (d.pdf) {
      try {
        await idbSet(d.id, { id: d.id, name: d.name, size: d.size, bytes: b64ToAb(d.pdf) });
        hasBytes = true;
      } catch {}
    }
    if (!hasBytes) {
      try { const rec = await idbGet(d.id); hasBytes = !!(rec && rec.bytes); } catch {}
    }
    if (hasBytes) withBytes++;

    const meta = {
      id: d.id,
      name: d.name || d.id,
      size: d.size,
      addedAt: d.addedAt || Date.now(),
      lastOpened: d.lastOpened || Date.now(),
      needsFile: !hasBytes, // có bản dịch nhưng thiếu file gốc → mời mở lại PDF
    };
    if (known >= 0) { lib[known] = { ...lib[known], ...meta }; updated++; }
    else { lib.push(meta); added++; }
  }
  saveLibrary(lib);

  // Cài đặt + API key — ghi thẳng vào localStorage (không phụ thuộc trạng thái
  // giao diện: danh sách "Hồ sơ dịch" có thể chưa tải xong).
  const s = data.settings || {};
  const cur = readJsonKey(SETTINGS_KEY) || {};
  const liveKey = apiKeyEl.value.trim();
  const apiKey = s.apiKey || liveKey || (cur.rememberKey ? cur.apiKey : '') || '';
  const keyRestored = !!(s.apiKey && s.apiKey !== liveKey);
  const next = {
    provider: s.provider || cur.provider || providerEl.value,
    model: s.model || cur.model || modelEl.value.trim(),
    skill: s.skill || cur.skill || skillEl.value,
    // Có key trong file → bật "Ghi nhớ key" luôn, khỏi mất thêm lần nữa
    rememberKey: s.apiKey ? true : (typeof s.rememberKey === 'boolean' ? s.rememberKey : !!cur.rememberKey),
    apiKey: '',
  };
  next.apiKey = next.rememberKey ? apiKey : '';
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  // Đồng bộ giao diện luôn cho khớp (trang sẽ tải lại ngay sau đó)
  providerEl.value = next.provider;
  applyModelSuggest(next.model);
  if (next.skill) { skillEl.dataset.want = next.skill; skillEl.value = next.skill; }
  if (apiKey) apiKeyEl.value = apiKey;
  rememberEl.checked = next.rememberKey;
  updateKeyHint();

  // Tùy chọn hiển thị
  const p = data.prefs || {};
  if (p.mode) localStorage.setItem('ptr.mode', p.mode);
  if (p.readmode) localStorage.setItem('ptr.readmode', p.readmode);
  if (p.zoom) localStorage.setItem('ptr.zoom', String(p.zoom));
  if (data.lastDoc && lib.some((x) => x.id === data.lastDoc && !x.needsFile)) {
    localStorage.setItem(LAST_DOC_KEY, data.lastDoc);
  }

  return { added, updated, skipped, withBytes, full, quota, keyRestored, total: docs.length };
}

async function restoreFromFile(file) {
  setStatus('Đang đọc file sao lưu…', 'working');
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    setStatus('File không đọc được — hãy chọn đúng file .json đã tải từ nút Sao lưu.', 'error');
    return;
  }
  if (!data || data.app !== BACKUP_TAG || !Array.isArray(data.docs)) {
    setStatus('Đây không phải file sao lưu của ứng dụng này.', 'error');
    return;
  }

  const when = data.createdAt ? new Date(data.createdAt).toLocaleString('vi-VN') : 'không rõ thời điểm';
  const trPages = data.docs.reduce((n, d) => n + Object.keys(d.tr || {}).length, 0);
  const ok = await confirmDialog({
    eyebrow: 'KHÔI PHỤC DỮ LIỆU',
    title: 'Nạp dữ liệu từ file sao lưu?',
    message:
      `File tạo lúc: ${when}\n` +
      `Gồm ${data.docs.length} tài liệu, ${trPages} trang bản dịch` +
      (data.hasKey ? ', có kèm API key' : '') + (data.hasPdf ? ', có kèm file PDF' : '') + '.\n' +
      'Trang nào trùng nhau sẽ lấy theo bản trong file. Ứng dụng sẽ tải lại sau khi nạp xong.',
    okText: 'Khôi phục',
    cancelText: 'Hủy',
    danger: false,
  });
  if (!ok) { setStatus(''); return; }

  setStatus('Đang khôi phục…', 'working');
  let r;
  try {
    r = await applyBackup(data);
  } catch (err) {
    setStatus('Khôi phục thất bại: ' + err.message, 'error');
    return;
  }

  const parts = [];
  if (r.added) parts.push(`${r.added} tài liệu mới`);
  if (r.updated) parts.push(`${r.updated} tài liệu cập nhật`);
  if (r.keyRestored) parts.push('API key');
  let msg = parts.length ? `Đã khôi phục: ${parts.join(', ')}.` : 'Đã khôi phục cài đặt.';
  if (r.full) msg += ` Bỏ qua ${r.skipped} tài liệu vì thư viện chỉ chứa tối đa ${MAX_DOCS}.`;
  if (r.quota) msg += ' Một phần bản dịch không lưu được (bộ nhớ trình duyệt đầy).';
  setStatus(msg + ' Đang tải lại…', 'done');
  setTimeout(() => location.reload(), 1200);
}

'use strict';
// Lưu bản dịch theo tài liệu + mô hình khối bản dịch (chữ + ảnh).
// Script thường (không phải module): dùng chung phạm vi toàn cục với các file khác,
// thứ tự nạp nằm trong index.html.

// ---------- Translations persistence (per document) ----------
const trKey = (id) => `ptr.tr.${id}`;
function loadTranslations(id) {
  try { return JSON.parse(localStorage.getItem(trKey(id)) || '{}'); } catch { return {}; }
}
function saveTranslation(id, idx, value) {
  const all = loadTranslations(id);
  all[idx] = value;
  try {
    localStorage.setItem(trKey(id), JSON.stringify(all));
    return true;
  } catch (e) {
    setStatus('Không lưu được: bộ nhớ trình duyệt đã đầy (ảnh chèn quá nặng). Hãy xoá bớt ảnh hoặc gỡ bớt tài liệu.', 'error');
    return false;
  }
}

// ---------- Mô hình khối bản dịch (chữ + ảnh, theo thứ tự) ----------
// Mỗi trang bản dịch là một danh sách khối:
//   { type:'text', text }            — một đoạn chữ có thể chỉnh sửa
//   { type:'image', src, w, h }      — một ảnh (data URL) chèn giữa các đoạn
// Lưu gọn: trang chỉ có 1 khối chữ vẫn lưu dạng chuỗi (tương thích bản cũ).
function normalizeBlocks(saved) {
  if (saved == null) return [{ type: 'text', text: '' }];
  if (typeof saved === 'string') return [{ type: 'text', text: saved }];
  if (Array.isArray(saved)) {
    const out = [];
    for (const b of saved) {
      if (!b) continue;
      if (b.type === 'image' && b.src) out.push({ type: 'image', src: b.src, w: b.w || 0, h: b.h || 0, widthPct: b.widthPct || 1 });
      else if (b.type === 'text') out.push({ type: 'text', text: String(b.text || '') });
    }
    return out.length ? out : [{ type: 'text', text: '' }];
  }
  return [{ type: 'text', text: '' }];
}
function serializeBlocks(blocks) {
  if (blocks.length === 1 && blocks[0].type === 'text') return blocks[0].text; // gọn + hợp bản cũ
  return blocks;
}
function entryPlainText(entry) {
  return entry.blocks.filter((b) => b.type === 'text')
    .map((b) => (b.text || '').trim()).filter(Boolean).join('\n\n');
}
function entryHasContent(entry) {
  return entry.blocks.some((b) => (b.type === 'text' && b.text.trim()) || b.type === 'image');
}
function savePageTranslation(entry) {
  return saveTranslation(docId, entry.index, serializeBlocks(entry.blocks));
}

// Đặt kết quả dịch vào KHỐI CHỮ đầu tiên (giữ nguyên ảnh/khối đã chèn tay).
function setEntryTranslation(entry, text) {
  const first = entry.blocks.find((b) => b.type === 'text');
  if (first) first.text = text;
  else entry.blocks.unshift({ type: 'text', text });
  // Dịch lại = thay sạch nội dung → neo lại vệt bôi cũ (không tìm thấy thì bỏ)
  reanchorText(entry.index, entry.blocks.findIndex((b) => b.type === 'text'));
  renderBlocks(entry);
  savePageTranslation(entry);
}

// Dựng lại DOM các khối cho một trang (gọi khi thêm/xoá/đổi thứ tự khối).
// Chỉnh chữ chỉ cập nhật mô hình, KHÔNG dựng lại (giữ con trỏ nhập).
function renderBlocks(entry) {
  const wrap = entry.blocksEl;
  wrap.innerHTML = '';
  entry.blocks.forEach((block, k) => {
    const row = document.createElement('div');
    row.className = 'block block-' + block.type;
    if (block.type === 'text') {
      const ed = document.createElement('div');
      ed.className = 'editor';
      ed.contentEditable = 'true';
      ed.spellcheck = false;
      ed.textContent = block.text || '';
      // Neo cho highlight: mỗi ô chữ được xác định bằng (trang, thứ tự khối)
      ed.dataset.p = String(entry.index);
      ed.dataset.b = String(k);
      ed.addEventListener('input', () => {
        block.text = ed.textContent;
        savePageTranslation(entry);
      });
      // Sửa chữ làm lệch vị trí highlight → neo lại khi rời ô, rồi vẽ lại vệt màu.
      // (Không vẽ lại trong lúc gõ để khỏi mất con trỏ nhập.)
      ed.addEventListener('blur', () => { reanchorText(entry.index, k); paintEditor(ed); });
      row.appendChild(ed);
      paintEditor(ed);
    } else {
      const holder = document.createElement('div');
      holder.className = 'block-img-wrap';
      holder.style.width = (clampPct(block.widthPct) * 100) + '%';
      const img = document.createElement('img');
      img.className = 'block-img';
      img.src = block.src;
      img.alt = 'Ảnh chèn';
      img.draggable = false;
      const handle = document.createElement('span');
      handle.className = 'img-resize';
      handle.title = 'Kéo để đổi kích cỡ ảnh';
      holder.append(img, handle);
      attachImageResize(handle, holder, entry, block);
      row.appendChild(holder);
    }
    row.appendChild(buildBlockControls(entry, k));
    wrap.appendChild(row);
  });
}

function clampPct(p) { return Math.min(1, Math.max(0.1, Number(p) || 1)); }

// Kéo góc phải-dưới của ảnh để đổi kích cỡ (lưu theo % bề rộng cột → nhất quán
// giữa lúc soạn, lúc đọc sách và lúc xuất PDF).
function attachImageResize(handle, holder, entry, block) {
  let startX = 0, rowW = 1, startW = 0, dragging = false;
  const onMove = (e) => {
    if (!dragging) return;
    const pct = clampPct((startW + (e.clientX - startX)) / rowW);
    holder.style.width = (pct * 100) + '%';
    block.widthPct = pct;
    e.preventDefault();
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    savePageTranslation(entry);
  };
  handle.addEventListener('pointerdown', (e) => {
    dragging = true;
    startX = e.clientX;
    const row = holder.closest('.block');
    rowW = (row ? row.clientWidth : holder.parentElement.clientWidth) || 1;
    startW = holder.offsetWidth;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    e.preventDefault();
  });
}
function stepImgWidth(entry, k, d) {
  const b = entry.blocks[k];
  if (!b || b.type !== 'image') return;
  b.widthPct = clampPct((b.widthPct || 1) + d);
  renderBlocks(entry);
  savePageTranslation(entry);
}

function buildBlockControls(entry, k) {
  const bar = document.createElement('div');
  bar.className = 'block-ctrls';
  const mk = (label, title, fn, cls) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bc' + (cls ? ' ' + cls : '');
    b.textContent = label;
    b.title = title;
    b.addEventListener('click', fn);
    return b;
  };
  const isImg = entry.blocks[k] && entry.blocks[k].type === 'image';
  if (isImg) bar.append(
    mk('Ảnh nhỏ', 'Thu nhỏ ảnh', () => stepImgWidth(entry, k, -0.1)),
    mk('Ảnh to', 'Phóng to ảnh', () => stepImgWidth(entry, k, 0.1)),
  );
  bar.append(
    mk('＋ Ảnh', 'Chèn ảnh ngay dưới khối này', () => insertImageAfter(entry, k)),
    mk('＋ Chữ', 'Thêm ô chữ ngay dưới khối này', () => insertTextAfter(entry, k)),
    mk('↑', 'Đưa khối lên', () => moveBlock(entry, k, -1)),
    mk('↓', 'Đưa khối xuống', () => moveBlock(entry, k, 1)),
    mk('✕', 'Xoá khối này', () => removeBlock(entry, k), 'bc-del'),
  );
  return bar;
}

function insertTextAfter(entry, k) {
  entry.blocks.splice(k + 1, 0, { type: 'text', text: '' });
  shiftTextHls(entry.index, 'insert', k + 1);
  renderBlocks(entry);
  savePageTranslation(entry);
  const row = entry.blocksEl.children[k + 1];
  const ed = row && row.querySelector('.editor');
  if (ed) ed.focus();
}

function moveBlock(entry, k, dir) {
  const j = k + dir;
  if (j < 0 || j >= entry.blocks.length) return;
  const t = entry.blocks[k];
  entry.blocks[k] = entry.blocks[j];
  entry.blocks[j] = t;
  shiftTextHls(entry.index, 'swap', [k, j]);
  renderBlocks(entry);
  savePageTranslation(entry);
}

async function removeBlock(entry, k) {
  const block = entry.blocks[k];
  if (block && block.type === 'image') {
    const ok = await confirmDialog({
      eyebrow: 'XOÁ ẢNH',
      title: 'Xoá ảnh đã chèn?',
      message: 'Ảnh này sẽ bị gỡ khỏi bản dịch của trang.',
      okText: 'Xoá ảnh', cancelText: 'Giữ lại',
    });
    if (!ok) return;
  }
  if (entry.blocks.length <= 1) entry.blocks = [{ type: 'text', text: '' }];
  else entry.blocks.splice(k, 1);
  shiftTextHls(entry.index, 'remove', k);
  renderBlocks(entry);
  savePageTranslation(entry);
}

// Chọn ảnh từ máy → nén lại (tối đa 1600px, nền trắng, JPEG) cho nhẹ bộ nhớ.
function pickImageFile() {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.addEventListener('change', () => resolve((inp.files && inp.files[0]) || null), { once: true });
    inp.click();
  });
}
function fileToImageBlock(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error || new Error('Không đọc được ảnh'));
    fr.onload = () => {
      const im = new Image();
      im.onerror = () => reject(new Error('Ảnh lỗi hoặc không hỗ trợ'));
      im.onload = () => {
        const MAX = 1600;
        const scale = Math.min(1, MAX / Math.max(im.naturalWidth, im.naturalHeight));
        const w = Math.max(1, Math.round(im.naturalWidth * scale));
        const h = Math.max(1, Math.round(im.naturalHeight * scale));
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#ffffff';           // nền trắng phòng ảnh PNG trong suốt
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(im, 0, 0, w, h);
        resolve({ type: 'image', src: cv.toDataURL('image/jpeg', 0.82), w, h });
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
async function insertImageAfter(entry, k) {
  const file = await pickImageFile();
  if (!file) return;
  setPageStat(entry.statEl, 'đang xử lý ảnh…', 'working');
  try {
    const block = await fileToImageBlock(file);
    entry.blocks.splice(k + 1, 0, block);
    shiftTextHls(entry.index, 'insert', k + 1);
    renderBlocks(entry);
    if (savePageTranslation(entry)) setPageStat(entry.statEl, 'đã chèn ảnh', 'done');
  } catch (err) {
    setPageStat(entry.statEl, 'lỗi ảnh', 'error');
    setStatus('Không chèn được ảnh: ' + err.message, 'error');
  }
}

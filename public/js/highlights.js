'use strict';
// Highlight chữ / vùng + thanh nổi chọn màu.
// Script thường (không phải module): dùng chung phạm vi toàn cục với các file khác,
// thứ tự nạp nằm trong index.html.

// ---------- Highlight: dữ liệu ----------
function textHls(p, b) { return NOTE.highlights.filter((h) => h.k === 't' && h.p === p && h.b === b); }
// Vùng bôi gắn với đúng MẶT PHẲNG đã vẽ nó: 'orig' (trang gốc — kéo lướt & đọc
// sách) hay 'ov' (đè trang). Hai mặt phẳng không cùng hệ toạ độ vì trang đè giãn
// cao thêm khi bản dịch dài, nên vẽ chéo sang nhau sẽ lệch chỗ.
function rectHls(p, surface) {
  return NOTE.highlights.filter((h) =>
    h.k === 'r' && h.p === p && (surface ? (h.o ? 'ov' : 'orig') === surface : true));
}
function hlById(id) { return NOTE.highlights.find((h) => h.id === id) || null; }
function removeHl(id) {
  const h = hlById(id);
  if (!h) return;
  NOTE.highlights = NOTE.highlights.filter((x) => x.id !== id);
  saveNotes();
  repaintHl(h);
  if (noteTab === 'hl') renderHlList();
}
function setHlColor(id, c) {
  const h = hlById(id);
  if (!h) return;
  h.c = c;
  saveNotes();
  repaintHl(h);
  if (noteTab === 'hl') renderHlList();
}
// Vẽ lại đúng chỗ chứa một highlight (cột bản dịch hoặc lớp đè trên canvas)
function repaintHl(h) {
  if (h.k === 't') {
    const ed = document.querySelector(`.editor[data-p="${h.p}"][data-b="${h.b}"]`);
    if (ed) paintEditor(ed);
  } else {
    const e = pages[h.p];
    if (e) paintRectLayer(e.hlLayer, h.p, e.aspect, 'orig');
    const ov = overlayPages[h.p];
    if (ov) paintRectLayer(ov.hlLayer, h.p, ovAspect(ov), 'ov');
    if (readMode === 'book' && viewMode === 'orig' && pdfDoc) renderBook();
  }
}

// ---------- Highlight: chữ trong cột bản dịch ----------
// Lưu theo VỊ TRÍ KÝ TỰ (không nhét thẻ vào nội dung) → bản dịch vẫn là chữ thuần
// như cũ; kèm `q` (đoạn chữ đã bôi) để neo lại khi bạn sửa chữ làm lệch vị trí.
function paintEditor(ed) {
  if (!ed) return;
  const p = Number(ed.dataset.p), b = Number(ed.dataset.b);
  const entry = pages[p];
  const block = entry && entry.blocks[b];
  if (!block || block.type !== 'text') return;
  const text = block.text || '';
  const hs = textHls(p, b).slice().sort((a, z) => a.s - z.s);
  const fs = findRangesFor(p, b);
  if (!hs.length && !fs.length) {
    if (ed.childElementCount) ed.textContent = text; // gỡ vệt cũ, chuẩn hoá lại DOM
    return;
  }
  // Vệt bôi và vệt tìm thấy có thể lồng lên nhau → cắt chữ tại mọi mốc đầu/cuối
  // rồi tô từng mẩu một, thay vì cố nhét thẻ này vào trong thẻ kia.
  const clamp = (n) => Math.max(0, Math.min(Number(n) || 0, text.length));
  const cuts = new Set([0, text.length]);
  for (const h of hs) { cuts.add(clamp(h.s)); cuts.add(clamp(h.e)); }
  for (const f of fs) { cuts.add(clamp(f.s)); cuts.add(clamp(f.e)); }
  const marks = [...cuts].sort((a, z) => a - z);
  let html = '';
  for (let i = 0; i < marks.length - 1; i++) {
    const s = marks[i], e = marks[i + 1];
    if (e <= s) continue;
    const seg = escapeHtml(text.slice(s, e));
    const h = hs.find((x) => clamp(x.s) <= s && clamp(x.e) >= e);
    const f = fs.find((x) => clamp(x.s) <= s && clamp(x.e) >= e);
    if (f) {
      // Giữ nguyên data-h để bấm vào vẫn mở được thanh đổi màu của vệt bôi bên dưới
      const attr = h ? ` data-h="${h.id}" data-c="${h.c}"` : '';
      html += `<mark class="findmark${f.i === FIND.cur ? ' find-cur' : ''}" data-fi="${f.i}"${attr}>${seg}</mark>`;
    } else if (h) {
      html += `<mark data-h="${h.id}" data-c="${h.c}">${seg}</mark>`;
    } else html += seg;
  }
  ed.innerHTML = html;
}
// Vị trí ký tự của một điểm trong ô chữ (tính theo nội dung thuần, bỏ qua thẻ <mark>)
function offsetIn(root, node, off) {
  if (node === root) {
    let n = 0;
    for (let i = 0; i < off && i < root.childNodes.length; i++) n += (root.childNodes[i].textContent || '').length;
    return n;
  }
  let n = 0;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let cur;
  while ((cur = w.nextNode())) {
    if (cur === node) return n + off;
    n += cur.nodeValue.length;
  }
  return n;
}
function textSelectionInfo() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const r = sel.getRangeAt(0);
  const startEl = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
  const ed = startEl && startEl.closest ? startEl.closest('.editor') : null;
  if (!ed || !ed.contains(r.endContainer)) return null;
  const a = offsetIn(ed, r.startContainer, r.startOffset);
  const z = offsetIn(ed, r.endContainer, r.endOffset);
  const s = Math.min(a, z), e = Math.max(a, z);
  if (e - s < 1) return null;
  return { ed, s, e, rect: r.getBoundingClientRect() };
}
function addTextHl(info, color) {
  const p = Number(info.ed.dataset.p), b = Number(info.ed.dataset.b);
  const entry = pages[p];
  const block = entry && entry.blocks[b];
  if (!block) return null;
  const text = block.text || '';
  // Bôi đè lên vệt cũ → gỡ vệt cũ đi cho gọn, một vùng chỉ một màu
  NOTE.highlights = NOTE.highlights.filter(
    (h) => !(h.k === 't' && h.p === p && h.b === b && h.s < info.e && h.e > info.s));
  const h = { id: uid(), k: 't', p, b, s: info.s, e: info.e, c: color, q: text.slice(info.s, info.e) };
  NOTE.highlights.push(h);
  saveNotes();
  paintEditor(info.ed);
  if (noteTab === 'hl') renderHlList();
  return h;
}
// Sau khi sửa chữ: tìm lại đoạn đã bôi trong nội dung mới (chọn vị trí gần chỗ cũ
// nhất). Không tìm thấy nữa → bỏ vệt bôi đó thay vì để nó trôi lung tung.
function nearestIndex(text, q, want) {
  if (!q) return -1;
  let best = -1, bestD = Infinity, i = text.indexOf(q);
  while (i >= 0) {
    const d = Math.abs(i - want);
    if (d < bestD) { bestD = d; best = i; }
    i = text.indexOf(q, i + 1);
  }
  return best;
}
// Thêm / xoá / đổi chỗ khối chữ làm số thứ tự khối lệch đi → dời neo highlight theo,
// nếu không vệt bôi sẽ nhảy sang nhầm khối.
function shiftTextHls(p, op, k) {
  let dropped = 0;
  for (const h of NOTE.highlights) {
    if (h.k !== 't' || h.p !== p) continue;
    if (op === 'insert') { if (h.b >= k) h.b++; }
    else if (op === 'remove') {
      if (h.b === k) { h.dead = true; dropped++; }
      else if (h.b > k) h.b--;
    } else if (op === 'swap') {
      if (h.b === k[0]) h.b = k[1];
      else if (h.b === k[1]) h.b = k[0];
    }
  }
  if (dropped) NOTE.highlights = NOTE.highlights.filter((h) => !h.dead);
  saveNotes();
  if (noteTab === 'hl') renderHlList();
}

function reanchorText(p, b) {
  const entry = pages[p];
  const block = entry && entry.blocks[b];
  if (!block) return;
  const text = block.text || '';
  let changed = false, dropped = 0;
  for (const h of NOTE.highlights) {
    if (h.k !== 't' || h.p !== p || h.b !== b) continue;
    if (text.slice(h.s, h.e) === h.q) continue; // vẫn đúng chỗ
    const i = nearestIndex(text, h.q, h.s);
    if (i >= 0) { h.s = i; h.e = i + h.q.length; }
    else { h.dead = true; dropped++; }
    changed = true;
  }
  if (dropped) NOTE.highlights = NOTE.highlights.filter((h) => !h.dead);
  if (changed) {
    saveNotes();
    if (noteTab === 'hl') renderHlList();
    if (dropped) setStatus(`${dropped} vệt bôi đã mất chỗ neo sau khi bạn sửa chữ nên được gỡ bỏ.`, '');
  }
}

// ---------- Highlight: vùng kéo trên trang gốc / đè trang ----------
// Toạ độ lưu theo BỀ RỘNG trang (x, y, w, h đều là tỉ lệ so với bề rộng) → phóng
// to, đổi chế độ xem hay xuất PDF đều đặt lại đúng chỗ, không cần tính lại gì.
function ovAspect(ovEntry) {
  const w = parseFloat(ovEntry.canvas.style.width) || 0;
  const h = parseFloat(ovEntry.canvas.style.height) || 0;
  return (w > 0 && h > 0) ? h / w : 1.414;
}
function paintRectLayer(layer, p, aspect, surface) {
  if (!layer) return;
  const asp = (aspect > 0.05 && Number.isFinite(aspect)) ? aspect : 1.414;
  layer.innerHTML = '';
  for (const h of rectHls(p, surface)) {
    const d = document.createElement('div');
    d.className = 'hl-rect';
    d.dataset.h = h.id;
    d.style.left = (h.x * 100) + '%';
    d.style.width = (h.w * 100) + '%';
    d.style.top = (h.y / asp * 100) + '%';   // % chiều dọc = (y·W)/H = y/tỉ-lệ-trang
    d.style.height = (h.h / asp * 100) + '%';
    d.style.background = HL_COLORS[h.c] || HL_COLORS.y;
    d.title = (h.q ? h.q.slice(0, 80) + ' — ' : '') + 'bấm để đổi màu / gửi vào ghi chú';
    layer.appendChild(d);
  }
}
function repaintAllRectLayers() {
  for (const e of pages) paintRectLayer(e.hlLayer, e.index, e.aspect, 'orig');
  for (const e of overlayPages) paintRectLayer(e.hlLayer, e.pageNum - 1, ovAspect(e), 'ov');
}
// Vẽ thẳng vào canvas — dùng cho chế độ Đọc sách và lúc xuất PDF đè trang
function paintRectsOnCanvas(ctx, p, widthPx, surface) {
  const hs = rectHls(p, surface);
  if (!hs.length || !ctx) return;
  ctx.save();
  ctx.globalAlpha = 0.42;
  for (const h of hs) {
    ctx.fillStyle = HL_COLORS[h.c] || HL_COLORS.y;
    ctx.fillRect(h.x * widthPx, h.y * widthPx, h.w * widthPx, h.h * widthPx);
  }
  ctx.restore();
}
// Khối chữ của một trang (dùng lại bộ trích khối của chế độ Đè trang), có nhớ đệm
async function pageBlocksExt(p) {
  const e = pages[p], ov = overlayPages[p];
  if (e && e.ext) return e.ext;
  if (ov && ov.ext) return ov.ext;
  if (!pdfDoc) return null;
  try {
    const ext = await extractBlocks(await pdfDoc.getPage(p + 1));
    if (e) e.ext = ext;
    if (ov) ov.ext = ext;
    return ext;
  } catch { return null; }
}
// Chữ nằm dưới một vùng đã bôi → để gửi vào ghi chú. Ở chế độ Đè trang lấy luôn
// bản tiếng Việt đang hiển thị (và đúng vị trí đã dàn lại), chỗ khác lấy bản gốc.
async function textUnderRect(p, h) {
  const ext = await pageBlocksExt(p);
  if (!ext || !ext.blocks.length) return '';
  const { Wp, blocks } = ext;
  // Vùng bôi vẽ trên trang ĐÈ: dò theo vị trí khối ĐÃ DÀN LẠI và lấy luôn câu
  // tiếng Việt đang hiện. Vẽ trên trang GỐC: dò theo vị trí gốc, lấy câu tiếng Anh.
  const ov = h.o ? overlayPages[p] : null;
  const boxes = (ov && Array.isArray(ov.drawBoxes) && ov.drawBoxes.length === blocks.length) ? ov.drawBoxes : blocks;
  const vi = (ov && Array.isArray(ov.translated) && ov.translated.length === blocks.length) ? ov.translated : null;
  const x0 = h.x * Wp, y0 = h.y * Wp, x1 = (h.x + h.w) * Wp, y1 = (h.y + h.h) * Wp;
  const out = [];
  boxes.forEach((box, i) => {
    if (box.x < x1 && box.x + box.w > x0 && box.top < y1 && box.top + box.h > y0) {
      const t = (vi && String(vi[i] || '').trim()) || blocks[i].text;
      if (t) out.push(t);
    }
  });
  return out.join(' ').replace(/\s+/g, ' ').trim().slice(0, 500);
}

// Kéo một vùng để bôi (chỉ khi đã bật chế độ bôi)
let drawing = null;
function onLayerPointerDown(e) {
  if (!hlMode || e.button != null && e.button !== 0) return;
  const layer = e.target.closest ? e.target.closest('.hl-layer') : null;
  if (!layer) return;
  e.preventDefault();
  const box = layer.getBoundingClientRect();
  if (box.width < 20) return;
  hideSelbar();
  const draft = document.createElement('div');
  draft.className = 'hl-draft';
  layer.appendChild(draft);
  drawing = { layer, draft, box, p: Number(layer.dataset.p), x0: e.clientX - box.left, y0: e.clientY - box.top };
  window.addEventListener('pointermove', onLayerPointerMove);
  window.addEventListener('pointerup', onLayerPointerUp, { once: true });
}
function onLayerPointerMove(e) {
  if (!drawing) return;
  const x1 = Math.min(Math.max(0, e.clientX - drawing.box.left), drawing.box.width);
  const y1 = Math.min(Math.max(0, e.clientY - drawing.box.top), drawing.box.height);
  const l = Math.min(drawing.x0, x1), t = Math.min(drawing.y0, y1);
  drawing.draft.style.cssText =
    `position:absolute;left:${l}px;top:${t}px;width:${Math.abs(x1 - drawing.x0)}px;height:${Math.abs(y1 - drawing.y0)}px;`;
  drawing.last = { l, t, w: Math.abs(x1 - drawing.x0), h: Math.abs(y1 - drawing.y0) };
}
async function onLayerPointerUp() {
  const d = drawing;
  drawing = null;
  window.removeEventListener('pointermove', onLayerPointerMove);
  if (!d) return;
  d.draft.remove();
  const r = d.last;
  if (!r || r.w < 8 || r.h < 6) return; // chạm nhẹ, không phải kéo vùng
  const W = d.box.width;
  const h = {
    id: uid(), k: 'r', p: d.p, c: hlColor,
    o: viewMode === 'overlay' ? 1 : 0, // vẽ trên mặt phẳng nào thì hiện ở đó
    x: r.l / W, y: r.t / W, w: r.w / W, h: r.h / W, q: '',
  };
  NOTE.highlights.push(h);
  saveNotes();
  repaintHl(h);
  if (noteTab === 'hl') renderHlList();
  // Lấy sẵn chữ nằm dưới vùng bôi để danh sách/ghi chú/xuất file dùng được ngay
  try {
    h.q = await textUnderRect(d.p, h);
    saveNotes();
    if (noteTab === 'hl') renderHlList();
  } catch {}
  const el = d.layer.querySelector(`.hl-rect[data-h="${h.id}"]`);
  if (el) openSelbarForHl(h.id, el.getBoundingClientRect());
}
document.addEventListener('pointerdown', onLayerPointerDown);

function setHlMode(on) {
  hlMode = !!on;
  document.body.classList.toggle('hl-mode', hlMode);
  hlBtn.setAttribute('aria-pressed', String(hlMode));
  hlBtn.classList.toggle('btn-primary', hlMode);
  hlToggleBtn.setAttribute('aria-pressed', String(hlMode));
  hlToggleBtn.textContent = hlMode ? '🖍 Tắt bôi trên trang gốc' : '🖍 Bật bôi trên trang gốc';
  hlToggleBtn.classList.toggle('btn-primary', hlMode);
  if (hlMode) setStatus('Chế độ bôi: kéo một vùng trên trang gốc để tô màu. Bấm 🖍 hoặc phím H để tắt.', 'working');
  else setStatus('');
}

// ---------- Thanh nổi chọn màu / gửi vào ghi chú ----------
let selCtx = null;
function hideSelbar() { selbarEl.hidden = true; selbarEl.innerHTML = ''; selCtx = null; }
function buildSelbar(onColor, onSend, onDel) {
  selbarEl.innerHTML = '';
  for (const c of Object.keys(HL_COLORS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sw';
    b.style.background = HL_COLORS[c];
    b.title = HL_NAMES[c];
    b.setAttribute('aria-label', HL_NAMES[c]);
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', () => onColor(c));
    selbarEl.appendChild(b);
  }
  const sep = document.createElement('span');
  sep.className = 'sep';
  selbarEl.appendChild(sep);
  const send = document.createElement('button');
  send.type = 'button';
  send.className = 'sb';
  send.textContent = '→ Ghi chú';
  send.title = 'Đưa đoạn này vào cột NOTES của chương đang đọc';
  send.addEventListener('mousedown', (e) => e.preventDefault());
  send.addEventListener('click', onSend);
  selbarEl.appendChild(send);
  if (onDel) {
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'sb sb-del';
    del.textContent = '✕';
    del.title = 'Xoá vệt bôi';
    del.addEventListener('mousedown', (e) => e.preventDefault());
    del.addEventListener('click', onDel);
    selbarEl.appendChild(del);
  }
}
function placeSelbar(rect) {
  selbarEl.hidden = false;
  const w = selbarEl.offsetWidth, h = selbarEl.offsetHeight;
  let left = rect.left + rect.width / 2 - w / 2;
  left = Math.min(Math.max(8, left), window.innerWidth - w - 8);
  let top = rect.top - h - 8;
  if (top < 8) top = Math.min(rect.bottom + 8, window.innerHeight - h - 8);
  selbarEl.style.left = left + 'px';
  selbarEl.style.top = top + 'px';
}
function openSelbarForSelection(info) {
  selCtx = { mode: 'sel', info };
  buildSelbar(
    (c) => {
      hlColor = c;
      const h = addTextHl(info, c);
      hideSelbar();
      window.getSelection().removeAllRanges();
      renderSwatches();
      if (h) setStatus(`Đã bôi ${HL_NAMES[c].toLowerCase()} ở trang ${h.p + 1}.`, 'done');
    },
    () => {
      const h = addTextHl(info, hlColor);
      hideSelbar();
      window.getSelection().removeAllRanges();
      if (h) sendHlToNote(h);
    },
    null,
  );
  placeSelbar(info.rect);
}
function openSelbarForHl(id, rect) {
  const h = hlById(id);
  if (!h) return;
  selCtx = { mode: 'hl', id };
  buildSelbar(
    (c) => { hlColor = c; setHlColor(id, c); hideSelbar(); renderSwatches(); },
    () => { hideSelbar(); sendHlToNote(h); },
    () => { removeHl(id); hideSelbar(); },
  );
  placeSelbar(rect);
}
// Bôi chữ ở cột bản dịch: quét chọn xong là hiện thanh màu
function onMaybeSelection() {
  setTimeout(() => {
    if (selCtx && selCtx.mode === 'hl') return;
    const info = textSelectionInfo();
    if (info) openSelbarForSelection(info);
    else if (selCtx) hideSelbar();
  }, 10);
}
document.addEventListener('mouseup', onMaybeSelection);
document.addEventListener('touchend', onMaybeSelection);
// Bấm vào một vệt bôi sẵn có → đổi màu / gửi ghi chú / xoá
document.addEventListener('click', (e) => {
  const t = e.target;
  if (selbarEl.contains(t)) return;
  const rect = t.closest ? t.closest('.hl-rect') : null;
  if (rect) { openSelbarForHl(rect.dataset.h, rect.getBoundingClientRect()); return; }
  const mk = t.closest ? t.closest('mark[data-h]') : null;
  if (mk) { openSelbarForHl(mk.dataset.h, mk.getBoundingClientRect()); return; }
  if (selCtx && selCtx.mode === 'hl') hideSelbar();
});
window.addEventListener('scroll', () => { if (selCtx) hideSelbar(); }, { passive: true });

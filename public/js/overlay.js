'use strict';
// Chế độ "Đè trang": dựng, dịch, xuất PDF.
// Script thường (không phải module): dùng chung phạm vi toàn cục với các file khác,
// thứ tự nạp nằm trong index.html.

// ================= Chế độ "Đè trang" (overlay) =================
// Giữ nguyên ảnh/bố cục trang gốc, che chữ tiếng Anh rồi vẽ tiếng Việt đè đúng chỗ.
// Tối ưu cho tài liệu NỀN TRƠN (sách/giáo trình chữ). Khi bản dịch dài hơn: giãn
// trang xuống + co chữ nhẹ nếu cần, không để các khối đè lên nhau.

const OV_LINE = 1.3;               // hệ số giãn dòng khi vẽ chữ Việt
const OV_FONT = '"Be Vietnam Pro","Segoe UI",sans-serif';
let ovFontsReady = null;
function ensureFontsReady() {
  if (!ovFontsReady) {
    ovFontsReady = (document.fonts && document.fonts.ready)
      ? document.fonts.ready
          .then(() => Promise.all([
            document.fonts.load('400 16px "Be Vietnam Pro"'),
            document.fonts.load('600 16px "Be Vietnam Pro"'),
          ]))
          .catch(() => {})
      : Promise.resolve();
  }
  return ovFontsReady;
}

const medNum = (arr) => {
  const a = arr.filter((n) => n > 0).sort((m, n) => m - n);
  return a.length ? a[a.length >> 1] : 0;
};

// --- Trích KHỐI đoạn (giữ toạ độ) từ một trang PDF, hệ toạ độ điểm, gốc trên-trái ---
async function extractBlocks(page) {
  const tc = await page.getTextContent();
  const vp = page.getViewport({ scale: 1 });
  const Wp = vp.width, Hp = vp.height;
  const items = [];
  let minX = Infinity, maxX = -Infinity;
  for (const it of tc.items) {
    if (typeof it.str !== 'string' || !it.str.length) continue;
    const x = it.transform[4];
    const yb = it.transform[5];               // baseline y (gốc dưới, kiểu PDF)
    const w = it.width || 0;
    const fs = Math.abs(it.transform[3]) || it.height || 10;
    const top = Hp - yb - fs;                 // đổi sang gốc trên
    items.push({ x, top, bottom: top + fs, w, fs, str: it.str });
    if (x < minX) minX = x;
    if (x + w > maxX) maxX = x + w;
  }
  if (!items.length) return { blocks: [], Wp, Hp };
  const medFs = medNum(items.map((i) => i.fs)) || 10;

  const joinLine = (arr) => {
    arr.sort((a, b) => a.x - b.x);
    let s = '', prevR = null;
    for (const it of arr) {
      if (prevR !== null && it.x - prevR > it.fs * 0.3) s += ' ';
      s += it.str;
      prevR = it.x + it.w;
    }
    return { text: s, x: arr[0].x, right: Math.max(...arr.map((i) => i.x + i.w)),
      top: Math.min(...arr.map((i) => i.top)), bottom: Math.max(...arr.map((i) => i.bottom)),
      fs: medNum(arr.map((i) => i.fs)) || medFs };
  };

  const cols = detectColumns(items, minX, maxX); // dùng lại bộ tách cột sẵn có
  const blocks = [];
  cols.forEach((colItems, ci) => {
    const lh = medNum(colItems.map((i) => i.fs)) || medFs;
    const sorted = colItems.slice().sort((a, b) => (a.top - b.top) || (a.x - b.x));
    // gom thành dòng
    const lines = [];
    let cur = [], anchor = null;
    for (const it of sorted) {
      if (anchor === null || Math.abs(it.top - anchor) <= lh * 0.6) {
        cur.push(it);
        if (anchor === null) anchor = it.top;
      } else { lines.push(joinLine(cur)); cur = [it]; anchor = it.top; }
    }
    if (cur.length) lines.push(joinLine(cur));
    // gom dòng thành đoạn: ngắt khi cách dòng lớn hoặc cỡ chữ đổi (heading)
    let para = [];
    const flush = () => {
      if (!para.length) return;
      const x = Math.min(...para.map((l) => l.x));
      const right = Math.max(...para.map((l) => l.right));
      const top = Math.min(...para.map((l) => l.top));
      const bottom = Math.max(...para.map((l) => l.bottom));
      const fs = medNum(para.map((l) => l.fs)) || medFs;
      blocks.push({
        x, top, w: Math.max(0, right - x), h: Math.max(fs, bottom - top),
        fs, bold: fs >= medFs * 1.25, col: ci,
        text: para.map((l) => l.text).join(' ').replace(/\s+/g, ' ').trim(),
      });
      para = [];
    };
    for (let i = 0; i < lines.length; i++) {
      if (para.length) {
        const prev = para[para.length - 1];
        const gap = lines[i].top - prev.bottom;
        const fsChange = Math.abs(lines[i].fs - prev.fs) > prev.fs * 0.25;
        if (gap > lh * 0.9 || fsChange) flush();
      }
      para.push(lines[i]);
    }
    flush();
  });
  return { blocks: blocks.filter((b) => b.text && b.w >= 4), Wp, Hp };
}

// --- Đo & bẻ dòng chữ Việt cho vừa bề rộng khối ---
function wrapLines(ctx, text, maxW) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (line && ctx.measureText(t).width > maxW) { lines.push(line); line = w; }
    else line = t;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}
// Chọn cỡ chữ: giữ cỡ gốc nếu vừa; nếu dài, co tối đa 20% để bớt phần phải giãn.
function fitBlock(ctx, text, w, baseFs, boxH, bold) {
  const wrapW = Math.max(w, 24);
  const setFont = (f) => { ctx.font = `${bold ? 600 : 400} ${f}px ${OV_FONT}`; };
  let f = baseFs;
  setFont(f);
  let lines = wrapLines(ctx, text, wrapW);
  let needed = lines.length * f * OV_LINE;
  if (needed > boxH) {
    const fMin = Math.max(7, baseFs * 0.8);
    while (f > fMin && lines.length * f * OV_LINE > boxH * 1.3) {
      f = Math.max(fMin, +(f - 0.5).toFixed(2));
      setFont(f);
      lines = wrapLines(ctx, text, wrapW);
    }
    needed = lines.length * f * OV_LINE;
  }
  return { f, lines, needed };
}

function samplePixel(ctx, x, y) {
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  x = Math.max(0, Math.min(cw - 1, x | 0));
  y = Math.max(0, Math.min(ch - 1, y | 0));
  const d = ctx.getImageData(x, y, 1, 1).data;
  return [d[0], d[1], d[2]];
}
function medianColor(cols) {
  const ch = [0, 1, 2].map((k) => {
    const a = cols.map((c) => c[k]).sort((m, n) => m - n);
    return a[a.length >> 1];
  });
  return `rgb(${ch[0]},${ch[1]},${ch[2]})`;
}
// Lấy màu nền quanh khối (điểm ngay ngoài hộp chữ) — nền trơn nên rất khớp.
function sampleBgAround(bctx, b, S) {
  const midY = b.top + b.h / 2;
  const pts = [
    [b.x - 6, midY], [b.x + b.w + 6, midY],
    [b.x + b.w / 2, b.top - 6], [b.x + b.w / 2, b.top + b.h + 6],
  ];
  const cols = [];
  for (const [px, py] of pts) {
    const dx = Math.round(px * S), dy = Math.round(py * S);
    if (dx < 0 || dy < 0 || dx >= bctx.canvas.width || dy >= bctx.canvas.height) continue;
    cols.push(samplePixel(bctx, dx, dy));
  }
  return cols.length ? medianColor(cols) : null;
}

function hashBlocks(blocks) {
  return blocks.length + '#' + blocks.map((b) => b.text.length).join('.');
}

// --- Ghép một trang: bản gốc (che chữ) + chữ Việt đè lên, giãn trang khi cần ---
async function composeOverlay(entry, opts) {
  const page = await pdfDoc.getPage(entry.pageNum);
  const ext = entry.ext || (entry.ext = await extractBlocks(page));
  const { Wp, Hp, blocks } = ext;

  // Bỏ bản dịch đã lưu nếu không còn khớp cấu trúc khối hiện tại (tránh đè lệch chỗ).
  if (entry.translated && (entry.trHash !== hashBlocks(blocks) || entry.translated.length !== blocks.length)) {
    entry.translated = null;
  }
  const vis = entry.translated;

  let cssW, dpr;
  if (opts.mode === 'export') { cssW = Wp; dpr = Math.min(3, Math.max(2, 1600 / Wp)); }
  else { cssW = opts.cssW; dpr = Math.min(window.devicePixelRatio || 1, 2); }
  const scale = cssW / Wp;   // điểm → css px
  const S = scale * dpr;     // điểm → px thiết bị

  // 1) vẽ trang gốc (nền + chữ Anh) làm nền
  const bg = document.createElement('canvas');
  bg.width = Math.max(1, Math.round(Wp * S));
  bg.height = Math.max(1, Math.round(Hp * S));
  const bctx = bg.getContext('2d', { willReadFrequently: true });
  await page.render({ canvasContext: bctx, viewport: page.getViewport({ scale: S }) }).promise;
  const pageBg = samplePixel(bctx, 3, 3); // góc trên-trái ~ màu giấy

  // 2) dàn chữ Việt theo từng cột: khối dài đẩy các khối dưới cùng cột xuống
  const meas = document.createElement('canvas').getContext('2d');
  entry.drawBoxes = null;
  const byCol = new Map();
  blocks.forEach((b, i) => {
    if (!byCol.has(b.col)) byCol.set(b.col, []);
    byCol.get(b.col).push({ b, i });
  });
  let grownBottom = Hp;
  for (const col of byCol.values()) {
    col.sort((p, q) => p.b.top - q.b.top);
    let shift = 0;
    for (const { b, i } of col) {
      b._drawTop = b.top + shift;
      const vi = vis ? vis[i] : null;
      if (vi && String(vi).trim()) {
        b._draw = fitBlock(meas, vi, b.w, b.fs, b.h, b.bold);
        const dh = Math.max(b.h, b._draw.needed);
        shift += Math.max(0, b._draw.needed - b.h);
        grownBottom = Math.max(grownBottom, b._drawTop + dh);
      } else {
        b._draw = null;
        grownBottom = Math.max(grownBottom, b._drawTop + b.h);
      }
    }
  }
  const Hp2 = Math.max(Hp, grownBottom + Hp * 0.02);
  // Vị trí THẬT của từng khối sau khi dàn lại (bản dịch dài đẩy khối xuống) —
  // cần cho việc lấy chữ nằm dưới một vùng bôi ở chế độ Đè trang.
  entry.drawBoxes = blocks.map((b) => ({
    x: b.x, w: b.w, top: b._drawTop,
    h: Math.max(b.h, b._draw ? b._draw.needed : b.h),
  }));

  // 3) canvas kết quả: nền giấy phủ kín (kể cả phần giãn thêm), rồi dán trang gốc
  const out = opts.canvas;
  out.width = Math.max(1, Math.round(Wp * S));
  out.height = Math.max(1, Math.round(Hp2 * S));
  out.style.width = (Wp * scale) + 'px';
  out.style.height = (Hp2 * scale) + 'px';
  const ctx = out.getContext('2d');
  ctx.fillStyle = `rgb(${pageBg[0]},${pageBg[1]},${pageBg[2]})`;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(bg, 0, 0);

  // 4) che chữ Anh (tại vị trí GỐC) bằng màu nền cục bộ
  for (const b of blocks) {
    if (!b._draw) continue;
    ctx.fillStyle = sampleBgAround(bctx, b, S) || `rgb(${pageBg[0]},${pageBg[1]},${pageBg[2]})`;
    ctx.fillRect(Math.floor((b.x - 2) * S), Math.floor((b.top - 1) * S),
      Math.ceil((b.w + 4) * S), Math.ceil((b.h + 2) * S));
  }
  // 5) vẽ chữ Việt (tại vị trí đã dàn lại)
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#14110E';
  for (const b of blocks) {
    if (!b._draw) continue;
    const f = b._draw.f;
    ctx.font = `${b.bold ? 600 : 400} ${f * S}px ${OV_FONT}`;
    let y = b._drawTop;
    for (const line of b._draw.lines) {
      ctx.fillText(line, Math.round(b.x * S), Math.round(y * S));
      y += f * OV_LINE;
    }
  }
  // 6) khi xuất PDF: vẽ luôn vệt bôi vào ảnh trang (trên màn hình đã có lớp DOM riêng)
  if (opts.mode === 'export') paintRectsOnCanvas(ctx, entry.pageNum - 1, out.width, 'ov');
  return { wPt: Wp, hPt: Hp2 };
}

// ---------- Dựng mặt phẳng "Đè trang" ----------
const ovKey = (id) => `ptr.ov.${id}`;
function loadOverlayAll() {
  try { return JSON.parse(localStorage.getItem(ovKey(docId)) || '{}'); } catch { return {}; }
}
function saveOverlayTr(pageIdx, blocks, viArr) {
  const all = loadOverlayAll();
  all[pageIdx] = { h: hashBlocks(blocks), vi: viArr };
  try { localStorage.setItem(ovKey(docId), JSON.stringify(all)); }
  catch { setStatus('Không lưu được bản dịch đè trang (bộ nhớ trình duyệt đầy).', 'error'); }
}

function setOvStat(entry, msg, kind = '') {
  if (!entry.statEl) return;
  entry.statEl.textContent = msg || '';
  entry.statEl.className = 'ov-stat' + (kind ? ' ' + kind : '');
}

function overlayColWidth() {
  const cw = (overlayEl.clientWidth || window.innerWidth) - 28;
  return Math.max(280, Math.min(cw, 940)) * zoom;
}

function buildOverlaySurface() {
  overlayEl.innerHTML = '';
  overlayPages.length = 0;
  const all = loadOverlayAll();
  const frag = document.createDocumentFragment();
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const wrap = document.createElement('div');
    wrap.className = 'ov-page';
    const head = document.createElement('div');
    head.className = 'ov-head';
    const tag = document.createElement('div');
    tag.className = 'ov-tag';
    tag.textContent = `Trang ${i} / ${pdfDoc.numPages}`;
    const btn = document.createElement('button');
    btn.className = 'ov-btn';
    btn.type = 'button';
    head.append(tag, makeBookmarkBtn(i - 1), btn);
    const canvas = document.createElement('canvas');
    canvas.className = 'ov-canvas';
    const cwrap = document.createElement('div');
    cwrap.className = 'canvas-wrap';
    const hlLayer = document.createElement('div');
    hlLayer.className = 'hl-layer';
    hlLayer.dataset.p = String(i - 1);
    cwrap.append(canvas, hlLayer);
    const stat = document.createElement('div');
    stat.className = 'ov-stat';
    wrap.append(head, cwrap, stat);
    const rec = all[i - 1];
    const entry = {
      pageNum: i, el: wrap, canvas, statEl: stat, btnEl: btn, ext: null, hlLayer,
      translated: rec && Array.isArray(rec.vi) ? rec.vi : null,
      trHash: rec ? rec.h : '', composed: false, composing: false, sig: '',
    };
    btn.textContent = entry.translated ? 'Dịch lại' : 'Dịch';
    if (entry.translated) setOvStat(entry, 'đã dịch', 'done');
    else setOvStat(entry, 'chưa dịch', '');
    btn.addEventListener('click', () => translateOverlayOne(entry));
    wrap._ov = entry;
    overlayPages.push(entry);
    frag.appendChild(wrap);
  }
  overlayEl.appendChild(frag);
}

function setupOverlayObserver() {
  if (overlayObserver) overlayObserver.disconnect();
  overlayObserver = new IntersectionObserver((ents) => {
    for (const it of ents) if (it.isIntersecting && it.target._ov) ensureComposed(it.target._ov);
  }, { rootMargin: '900px 0px' });
  for (const e of overlayPages) overlayObserver.observe(e.el);
}

async function ensureComposed(entry, force) {
  if (!pdfDoc || viewMode !== 'overlay') return;
  if (!entry.el || entry.el.clientWidth < 10) return;
  const cssW = overlayColWidth();
  const trTag = entry.translated ? (entry.translated.length + ':' + (entry.trHash || '')) : 'none';
  const sig = Math.round(cssW) + '|' + trTag;
  if (!force && entry.composed && entry.sig === sig) return;
  if (entry.composing) return;
  entry.composing = true;
  try {
    await ensureFontsReady();
    const dims = await composeOverlay(entry, { canvas: entry.canvas, cssW, mode: 'screen' });
    entry.composed = true;
    entry.sig = sig;
    // Trang đè có thể cao thêm khi bản dịch dài → vẽ lại vệt bôi theo tỉ lệ mới
    paintRectLayer(entry.hlLayer, entry.pageNum - 1, dims.hPt / dims.wPt, 'ov');
  } catch (e) {
    reportRenderError(entry.pageNum, e); // giữ canvas cũ, nhưng phải nói ra là hỏng
  } finally {
    entry.composing = false;
  }
}

function composeVisibleOverlay() {
  const vh = window.innerHeight;
  for (const e of overlayPages) {
    const r = e.el.getBoundingClientRect();
    if (r.bottom > -vh && r.top < vh * 2) ensureComposed(e);
  }
}

function overlayCurrentTop() {
  const off = stickyOffset() + 1;
  for (let i = 0; i < overlayPages.length; i++) {
    if (overlayPages[i].el.getBoundingClientRect().bottom > off) return i;
  }
  return overlayPages.length ? overlayPages.length - 1 : 0;
}
function scrollOverlayToPage(idx) {
  const e = overlayPages[idx];
  if (!e) return;
  const top = e.el.getBoundingClientRect().top + window.scrollY - stickyOffset();
  window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
}

let ovScrollTimer = null;
function overlayScroll() {
  if (document.activeElement !== pageInput) pageInput.value = String(overlayCurrentTop() + 1);
  composeVisibleOverlay();
  syncFollowScope();
  if (suppressScrollSave) return;
  if (ovScrollTimer) return;
  ovScrollTimer = setTimeout(() => {
    ovScrollTimer = null;
    if (suppressScrollSave || !docId) return; // đang khôi phục/đổi tài liệu → bỏ qua
    localStorage.setItem(pageKey(docId), String(overlayCurrentTop()));
  }, 200);
}

function renderOverlay(keep) {
  if (!pdfDoc) return;
  if (overlayPages.length !== pdfDoc.numPages) buildOverlaySurface();
  setupOverlayObserver();
  pageTotalEl.textContent = String(pdfDoc.numPages);
  pageInput.max = String(pdfDoc.numPages);
  pageInput.disabled = false;
  pageInput.value = String(Math.min(pdfDoc.numPages, (keep || 0) + 1));
  suppressScrollSave = true;
  requestAnimationFrame(() => {
    scrollOverlayToPage(keep || 0);
    composeVisibleOverlay();
    setTimeout(() => { suppressScrollSave = false; }, 450);
  });
}

// ---------- Dịch cho chế độ Đè trang ----------
async function translateOverlayPage(entry) {
  const apiKey = apiKeyEl.value.trim();
  const page = await pdfDoc.getPage(entry.pageNum);
  const ext = entry.ext || (entry.ext = await extractBlocks(page));
  const texts = ext.blocks.map((b) => b.text);
  if (!texts.length) { entry.translated = []; entry.trHash = hashBlocks(ext.blocks); return true; }

  const r = await fetch('/api/translate-blocks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: providerEl.value, apiKey, model: modelEl.value.trim(),
      skill: skillEl.value, blocks: texts,
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  const arr = Array.isArray(data.translations) ? data.translations : [];
  entry.translated = arr;
  entry.trHash = hashBlocks(ext.blocks);
  saveOverlayTr(entry.pageNum - 1, ext.blocks, arr);
  return true;
}

// Dịch NGAY một trang (nút "Dịch" trên chính trang đó).
async function translateOverlayOne(entry) {
  const apiKey = apiKeyEl.value.trim();
  if (!apiKey) { setStatus('Chưa nhập API key.', 'error'); apiKeyEl.focus(); return; }
  saveSettings();
  if (entry.btnEl) { entry.btnEl.disabled = true; entry.btnEl.textContent = 'Đang dịch…'; }
  setOvStat(entry, 'đang dịch…', 'working');
  setStatus(`Đang dịch trang ${entry.pageNum}…`, 'working');
  try {
    await translateOverlayPage(entry);
    setOvStat(entry, 'đã dịch', 'done');
    setStatus(`Đã dịch xong trang ${entry.pageNum}.`, 'done');
    entry.composed = false;
    ensureComposed(entry, true);
  } catch (err) {
    setOvStat(entry, 'lỗi', 'error');
    setStatus('Lỗi trang ' + entry.pageNum + ': ' + err.message, 'error');
  } finally {
    if (entry.btnEl) { entry.btnEl.disabled = false; entry.btnEl.textContent = entry.translated ? 'Dịch lại' : 'Dịch'; }
  }
}

async function runOverlayTranslate(list) {
  const apiKey = apiKeyEl.value.trim();
  if (!apiKey) { setStatus('Chưa nhập API key.', 'error'); apiKeyEl.focus(); return; }
  if (!list.length) { setStatus('Không có trang nào để dịch.', 'error'); return; }
  saveSettings();
  translateBtn.disabled = true;
  openBtn.disabled = true;
  let ok = 0;
  for (let i = 0; i < list.length; i++) {
    const entry = list[i];
    setStatus(`Đang dịch ${i + 1}/${list.length} (trang ${entry.pageNum})…`, 'working');
    setOvStat(entry, 'đang dịch…', 'working');
    try {
      await translateOverlayPage(entry);
      ok++;
      setOvStat(entry, 'đã dịch', 'done');
      if (entry.btnEl) entry.btnEl.textContent = 'Dịch lại';
      entry.composed = false;
      ensureComposed(entry, true);
    } catch (err) {
      setOvStat(entry, 'lỗi', 'error');
      setStatus('Lỗi trang ' + entry.pageNum + ': ' + err.message, 'error');
      break;
    }
  }
  translateBtn.disabled = false;
  openBtn.disabled = false;
  if (ok === list.length) setStatus(`Đã dịch xong ${ok}/${list.length} trang (Đè trang).`, 'done');
  else setStatus(`Dừng ở ${ok}/${list.length} trang. Kiểm tra lỗi rồi thử lại.`, 'error');
}

// ---------- Xuất PDF Đè trang (mỗi trang là 1 ảnh đã ghép, đúng khổ) ----------
async function exportOverlayPdf() {
  if (!pdfDoc || !overlayPages.length) { setStatus('Chưa có trang để xuất.', 'error'); return; }
  setStatus('Đang tạo PDF đè trang…', 'working');
  exportBtn.disabled = true;
  try {
    await ensureFontsReady();
    const out = [];
    const cnv = document.createElement('canvas');
    for (let i = 0; i < overlayPages.length; i++) {
      setStatus(`Đang dựng trang ${i + 1}/${overlayPages.length}…`, 'working');
      const dims = await composeOverlay(overlayPages[i], { canvas: cnv, mode: 'export' });
      out.push({ img: cnv.toDataURL('image/jpeg', 0.9), w: dims.wPt, h: dims.hPt });
    }
    const r = await fetch('/api/export-overlay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: docTitle + ' — đè trang', pages: out }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.error || `HTTP ${r.status}`);
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (docTitle || 'ban-dich') + ' - de trang.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus('Đã tạo PDF đè trang.', 'done');
  } catch (err) {
    setStatus('Lỗi tạo PDF: ' + err.message, 'error');
  } finally {
    exportBtn.disabled = false;
  }
}

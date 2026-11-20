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
  for (const it of tc.items) {
    if (typeof it.str !== 'string' || !it.str.length) continue;
    const x = it.transform[4];
    const yb = it.transform[5];               // baseline y (gốc dưới, kiểu PDF)
    const w = it.width || 0;
    const fs = Math.abs(it.transform[3]) || it.height || 10;
    const top = Hp - yb - fs;                 // đổi sang gốc trên
    items.push({ x, top, bottom: top + fs, w, fs, str: it.str });
  }
  if (!items.length) return { blocks: [], Wp, Hp };
  // Cỡ chữ THÂN BÀI = cỡ chiếm nhiều ký tự nhất (nhãn hình / chú thích nhỏ hơn hẳn)
  const fsChars = new Map();
  for (const it of items) {
    const k = Math.round(it.fs * 2) / 2;
    fsChars.set(k, (fsChars.get(k) || 0) + it.str.length);
  }
  const bodyFs = [...fsChars.entries()].sort((a, b) => b[1] - a[1])[0][0] || 10;

  // Không tách cột trên toàn trang nữa: một hình có nhãn vắt ngang khe giữa cột là đủ
  // làm hỏng việc dò khe (hai cột bị nối dòng, nhãn bị dồn cục). Thay vào đó gom từ dưới lên:
  // mẩu chữ → đoạn dòng (cắt ở khoảng trống ngang lớn) → khối (dòng ngay dưới, chồng nhau theo chiều ngang).

  // 1) Hàng: các mẩu chữ chồng nhau theo chiều dọc ≥ 50% (chịu được chỉ số trên/dưới)
  const sorted = items.slice().sort((a, b) => (a.top - b.top) || (a.x - b.x));
  const rows = [];
  for (const it of sorted) {
    let row = null;
    for (let r = rows.length - 1; r >= 0 && r >= rows.length - 4; r--) {
      const R = rows[r];
      const ov = Math.min(R.bottom, it.bottom) - Math.max(R.top, it.top);
      if (ov >= 0.5 * Math.min(R.bottom - R.top, it.bottom - it.top)) { row = R; break; }
    }
    // Giữ nguyên dải dọc của mẩu đầu hàng (không nới ra): nếu nới, một tiêu đề chữ to
    // nằm giữa hai dòng của cột bên cạnh sẽ "bắc cầu" nối hai dòng đó làm một.
    if (row) row.items.push(it);
    else rows.push({ items: [it], top: it.top, bottom: it.bottom });
  }

  // 2) Đoạn dòng: trong một hàng, khoảng trống > 0.9 cỡ chữ = khe cột / nhãn khác
  const frags = [];
  const makeFrag = (arr) => {
    let s = '', prevR = null;
    for (const it of arr) {
      if (prevR !== null && it.x - prevR > it.fs * 0.3 && !/\s$/.test(s) && !/^\s/.test(it.str)) s += ' ';
      s += it.str;
      prevR = Math.max(prevR === null ? -Infinity : prevR, it.x + it.w);
    }
    const text = s.replace(/\s+/g, ' ').trim();
    if (!text) return;
    // cỡ chữ của đoạn = cỡ chiếm nhiều ký tự nhất (bỏ qua dấu cách, ký hiệu lẻ)
    const m = new Map();
    for (const it of arr) { const k = it.fs; m.set(k, (m.get(k) || 0) + it.str.trim().length); }
    const fs = [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
    frags.push({ text, x: Math.min(...arr.map((i) => i.x)), right: Math.max(...arr.map((i) => i.x + i.w)),
      top: Math.min(...arr.map((i) => i.top)), bottom: Math.max(...arr.map((i) => i.bottom)), fs });
  };
  for (const row of rows) {
    const its = row.items.filter((i) => i.str.trim() || i.w > 0).sort((a, b) => a.x - b.x);
    let cur = [], curR = -Infinity;
    for (const it of its) {
      const gapMax = 0.9 * Math.min(it.fs, cur.length ? cur[cur.length - 1].fs : it.fs);
      if (cur.length && it.str.trim() && it.x - curR > gapMax) { makeFrag(cur); cur = []; curR = -Infinity; }
      cur.push(it);
      curR = Math.max(curR, it.x + it.w);
    }
    if (cur.length) makeFrag(cur);
  }

  // 3) Khối: nối đoạn dòng vào khối có dòng cuối nằm NGAY TRÊN, chồng nhau theo chiều
  //    ngang, cùng cỡ chữ (cỡ đổi = tiêu đề / nhãn khác → khối mới)
  frags.sort((a, b) => (a.top - b.top) || (a.x - b.x));
  const groups = [];
  for (const f of frags) {
    let best = null, bestGap = Infinity;
    for (const g of groups) {
      const L = g.lines[g.lines.length - 1];
      const gap = f.top - L.bottom;
      if (gap < -0.35 * f.fs || gap > 0.9 * Math.min(f.fs, L.fs)) continue;
      if (Math.abs(f.fs - L.fs) > 0.25 * Math.min(f.fs, L.fs)) continue;
      const ov = Math.min(f.right, g.right) - Math.max(f.x, g.x);
      if (ov < 0.5 * Math.min(f.right - f.x, g.right - g.x)) continue;
      // Cách xa hơn hẳn nhịp dòng của chính khối → nhãn / đoạn khác đặt sát bên dưới
      if (g.lines.length >= 2 && gap > g.gap + 0.5 * f.fs) continue;
      // Thụt đầu dòng ngay sau một dòng ngắn = đầu đoạn mới
      if (f.x - L.x > 0.6 * f.fs && L.right < g.right - f.fs) continue;
      if (gap < bestGap) { best = g; bestGap = gap; }
    }
    if (best) {
      if (best.lines.length === 1) best.gap = bestGap; // nhịp dòng = khoảng cách 2 dòng đầu
      best.lines.push(f);
      best.x = Math.min(best.x, f.x);
      best.right = Math.max(best.right, f.right);
    } else groups.push({ lines: [f], x: f.x, right: f.right, gap: 0 });
  }

  const blocks = groups.map((g) => {
    const ls = g.lines;
    const top = Math.min(...ls.map((l) => l.top));
    const bottom = Math.max(...ls.map((l) => l.bottom));
    const m = new Map();
    for (const l of ls) m.set(l.fs, (m.get(l.fs) || 0) + l.text.length);
    const fs = [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
    // Canh lề: nhãn hình hay canh phải (sát đường chỉ) hoặc giữa — giữ đúng như bản gốc
    const label = fs <= bodyFs * 0.8;
    let align = 'left';
    if (label && ls.length >= 2) { // thân bài: luôn trái (thụt đầu dòng + căn đều dễ bị nhận nhầm)
      const span = (arr) => Math.max(...arr) - Math.min(...arr);
      const tol = Math.max(1.2, fs * 0.25);
      const dL = span(ls.map((l) => l.x)), dR = span(ls.map((l) => l.right));
      const dC = span(ls.map((l) => (l.x + l.right) / 2));
      if (dL > tol * 2 && dR <= tol) align = 'right';
      else if (dL > tol * 2 && dR > tol * 2 && dC <= tol) align = 'center';
    }
    return {
      x: g.x, top, w: Math.max(0, g.right - g.x), h: Math.max(fs, bottom - top),
      fs, bold: fs >= bodyFs * 1.25, align,
      // Chữ nhỏ hơn hẳn thân bài = nhãn hình / chú thích / chân trang: giữ nguyên chỗ,
      // không đẩy khối khác, co chữ nhiều hơn cho vừa ô.
      label, nLines: ls.length,
      text: ls.map((l) => l.text).join(' ').replace(/\s+/g, ' ').trim(),
    };
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

// Khối MỘT dòng (tiêu đề, đầu trang, chú thích hình): cố giữ một dòng — nới sang chỗ trống
// bên phải và co chữ tới 85%; xuống dòng sẽ đè lên đường kẻ / khối bên dưới.
function fitOneLine(ctx, text, b, maxW) {
  const setFont = (f) => { ctx.font = `${b.bold ? 600 : 400} ${f}px ${OV_FONT}`; };
  for (let f = b.fs; f >= b.fs * 0.85 - 1e-6; f = +(f - 0.25).toFixed(2)) {
    setFont(f);
    if (ctx.measureText(String(text).trim()).width <= maxW) {
      return { f, lines: [String(text).trim()], needed: b.h, lh: f * OV_LINE };
    }
  }
  return fitBlock(ctx, text, maxW, b.fs, b.h, b.bold);
}

// Nhãn hình: ô chật và không được dời chỗ → dòng sát hơn, co chữ tới 70% cỡ gốc, cho
// rộng hơn ô gốc một chút; vẫn không vừa thì mới tràn xuống (phần tràn sẽ được che nền).
const OV_LABEL_LINE = 1.15;
function fitLabel(ctx, text, b) {
  const wrapW = Math.max(b.w * 1.15, 20);
  const fMin = Math.max(4, b.fs * 0.7);
  const setFont = (f) => { ctx.font = `${b.bold ? 600 : 400} ${f}px ${OV_FONT}`; };
  // Nhãn một dòng ("Cytosol" → "Bào tương"): thà dài ra một chút còn hơn co chữ tí hon
  if (b.nLines === 1) {
    const t = String(text).trim();
    for (let f = b.fs; f >= b.fs * 0.8 - 1e-6; f = +(f - 0.25).toFixed(2)) {
      setFont(f);
      const width = ctx.measureText(t).width;
      if (width <= Math.max(b.w * 1.6, b.w + 3 * b.fs)) {
        return { f, lines: [t], needed: b.h, width, lh: f * OV_LABEL_LINE };
      }
    }
  }
  let f = b.fs, lines;
  for (;;) {
    setFont(f);
    lines = wrapLines(ctx, text, wrapW);
    if (lines.length * f * OV_LABEL_LINE <= b.h * 1.05 || f <= fMin) break;
    f = Math.max(fMin, +(f - 0.25).toFixed(2));
  }
  const width = Math.max(...lines.map((l) => ctx.measureText(l).width));
  return { f, lines, needed: lines.length * f * OV_LABEL_LINE, width, lh: f * OV_LABEL_LINE };
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

  // 2) dàn chữ Việt: khối thân bài dài ra thì đẩy những khối NẰM NGAY DƯỚI nó (chồng
  //    nhau theo chiều ngang) xuống. Nhãn hình thì đứng yên tại chỗ — dời đi là lạc khỏi
  //    đường chỉ — và cũng không đẩy ai.
  const meas = document.createElement('canvas').getContext('2d');
  entry.drawBoxes = null;
  const order = blocks.map((b, i) => i).sort((p, q) => blocks[p].top - blocks[q].top);
  const contentRight = Math.max(...blocks.map((b) => b.x + b.w));
  // Chỗ trống bên phải một khối (tới khối kế bên cùng hàng, hoặc lề phải nội dung)
  const roomRight = (b) => {
    let r = contentRight;
    for (const o of blocks) {
      if (o === b || o.x < b.x + b.w - 1) continue;
      if (Math.min(o.top + o.h, b.top + b.h) - Math.max(o.top, b.top) > 0) r = Math.min(r, o.x - 6);
    }
    return Math.max(b.w, r - b.x);
  };
  const placed = [];
  let grownBottom = Hp;
  for (const i of order) {
    const b = blocks[i];
    const vi = vis ? vis[i] : null;
    const has = !!(vi && String(vi).trim());
    b._draw = !has ? null
      : b.label ? fitLabel(meas, vi, b)
      : b.nLines === 1 ? fitOneLine(meas, vi, b, roomRight(b))
      : fitBlock(meas, vi, b.w, b.fs, b.h, b.bold);
    let shift = 0;
    for (const p of placed) {
      if (p.bottom > b.top + 0.35 * b.fs) continue; // chỉ khối nằm TRÊN
      if (Math.min(p.x + p.w, b.x + b.w) - Math.max(p.x, b.x) <= 0) continue;
      if (!b.label) {
        if (!p.label) shift = Math.max(shift, p.drawBottom - p.bottom);
      } else if (!p.label && p.drawBottom > p.bottom) {
        // Nhãn/chú thích nhỏ chỉ dời khi thật sự bị chữ phía trên tràn xuống đè lên
        shift = Math.max(shift, p.drawBottom + 0.3 * b.fs - b.top);
      }
    }
    b._drawTop = b.top + shift;
    const dh = b._draw ? Math.max(b.h, b._draw.needed) : b.h;
    placed.push({ x: b.x, w: b.w, bottom: b.top + b.h, drawBottom: b._drawTop + dh, label: b.label });
    grownBottom = Math.max(grownBottom, b._drawTop + dh);
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

  // 4) che chữ Anh (tại vị trí GỐC) bằng màu nền cục bộ. Nhãn mà chữ Việt vẫn tràn
  //    khỏi ô thì che luôn phần tràn, để chữ không đè lên nét vẽ.
  for (const b of blocks) {
    if (!b._draw) continue;
    ctx.fillStyle = sampleBgAround(bctx, b, S) || `rgb(${pageBg[0]},${pageBg[1]},${pageBg[2]})`;
    const h = b.label ? Math.max(b.h, b._draw.needed) : b.h;
    const w = b.label ? Math.max(b.w, b._draw.width || 0) : b.w;
    const x = !b.label ? b.x : b.align === 'right' ? b.x + b.w - w : b.align === 'center' ? b.x + (b.w - w) / 2 : b.x;
    // + phần đuôi chữ (g, p, y thò xuống dưới đường chân chữ ~ 0.3 cỡ chữ)
    ctx.fillRect(Math.floor((x - 2) * S), Math.floor((b.top - 1) * S),
      Math.ceil((w + 4) * S), Math.ceil((h + 1 + 0.3 * b.fs) * S));
  }
  // 5) vẽ chữ Việt (tại vị trí đã dàn lại), giữ canh lề như bản gốc
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#14110E';
  for (const b of blocks) {
    if (!b._draw) continue;
    const f = b._draw.f;
    ctx.font = `${b.bold ? 600 : 400} ${f * S}px ${OV_FONT}`;
    ctx.textAlign = b.align === 'right' ? 'right' : b.align === 'center' ? 'center' : 'left';
    const ax = b.align === 'right' ? b.x + b.w : b.align === 'center' ? b.x + b.w / 2 : b.x;
    let y = b._drawTop;
    for (const line of b._draw.lines) {
      ctx.fillText(line, Math.round(ax * S), Math.round(y * S));
      y += b._draw.lh || f * OV_LINE;
    }
  }
  ctx.textAlign = 'left';
  // 6) khi xuất PDF: vẽ luôn vệt bôi vào ảnh trang (trên màn hình đã có lớp DOM riêng)
  if (opts.mode === 'export') paintRectsOnCanvas(ctx, entry.pageNum - 1, out.width, 'ov');
  return { wPt: Wp, hPt: Hp2 };
}

// ---------- Dựng mặt phẳng "Đè trang" ----------
// Bản dịch Đè trang nằm trong IndexedDB (xem library.js). Ghi lỗi thì vẫn giữ trong
// bộ nhớ của phiên đang mở — báo cho người dùng để kịp xuất PDF.
async function saveOverlayTr(pageIdx, blocks, viArr) {
  try {
    await ovIdbPut(docId, pageIdx, { h: hashBlocks(blocks), vi: viArr });
    return true;
  } catch (e) {
    setStatus('Không lưu được bản dịch đè trang vào máy (' + (e && e.message || 'lỗi bộ nhớ') +
      '). Bản dịch vẫn còn trong phiên này — hãy xuất PDF trước khi đóng trang.', 'error');
    return false;
  }
}
// Nạp bản dịch đã lưu vào các trang (chạy nền sau khi dựng khung trang)
let overlayHydrated = Promise.resolve();
function hydrateOverlay() {
  const id = docId;
  overlayHydrated = (async () => {
    let all = {};
    try { all = await ovIdbAll(id); } catch { return; }
    if (id !== docId) return; // đã đổi tài liệu trong lúc chờ
    for (const [k, rec] of Object.entries(all)) {
      const entry = overlayPages[Number(k)];
      if (!entry || entry.translated || !rec || !Array.isArray(rec.vi)) continue;
      entry.translated = rec.vi;
      entry.trHash = rec.h || '';
      entry.composed = false;
      if (entry.btnEl) entry.btnEl.textContent = 'Dịch lại';
      setOvStat(entry, 'đã dịch', 'done');
    }
    if (viewMode === 'overlay') composeVisibleOverlay();
  })();
  return overlayHydrated;
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
    const entry = {
      pageNum: i, el: wrap, canvas, statEl: stat, btnEl: btn, ext: null, hlLayer,
      translated: null, trHash: '', composed: false, composing: false, sig: '',
    };
    btn.textContent = 'Dịch';
    setOvStat(entry, 'chưa dịch', '');
    btn.addEventListener('click', () => translateOverlayOne(entry));
    wrap._ov = entry;
    overlayPages.push(entry);
    frag.appendChild(wrap);
  }
  overlayEl.appendChild(frag);
  hydrateOverlay();
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
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(data.error || `HTTP ${r.status}`);
    e.status = r.status;
    throw e;
  }
  const arr = Array.isArray(data.translations) ? data.translations : [];
  entry.translated = arr;
  entry.trHash = hashBlocks(ext.blocks);
  await saveOverlayTr(entry.pageNum - 1, ext.blocks, arr);
  return true;
}

// Trang đã có bản dịch còn khớp với cách chia khối hiện tại → khỏi dịch lại (đỡ tốn tiền)
async function overlayPageDone(entry) {
  if (!entry.translated) return false;
  const ext = entry.ext || (entry.ext = await extractBlocks(await pdfDoc.getPage(entry.pageNum)));
  return entry.trHash === hashBlocks(ext.blocks) && entry.translated.length === ext.blocks.length;
}

// Lỗi tạm thời (nghẽn lượt gọi, máy chủ bận, rớt mạng) thì nên thử lại; sai key / sai model thì không.
function isRetryableError(err) {
  const msg = String(err && err.message || '');
  if (err && err.status === 400) return false;
  if (/API key|model|provider|từ chối/i.test(msg)) return false;
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

// Dịch hàng loạt (cả cuốn sách được): bỏ qua trang đã dịch, gặp nghẽn thì chờ rồi thử lại,
// bấm "Dừng dịch" là dừng sau trang đang dở. Mỗi trang dịch xong được lưu ngay vào máy,
// nên dừng / lỗi / tắt máy giữa chừng thì lần sau bấm dịch tiếp là chạy nối từ chỗ còn thiếu.
const OV_RETRY_WAITS = [5, 20, 60]; // giây chờ trước mỗi lần thử lại
const waitMs = (ms) => new Promise((r) => setTimeout(r, ms));
function fmtDuration(sec) {
  sec = Math.max(0, Math.round(sec));
  if (sec < 60) return `${sec} giây`;
  const m = Math.round(sec / 60);
  return m < 60 ? `${m} phút` : `${Math.floor(m / 60)} giờ ${m % 60} phút`;
}
async function runOverlayTranslate(list) {
  const apiKey = apiKeyEl.value.trim();
  if (!apiKey) { setStatus('Chưa nhập API key.', 'error'); apiKeyEl.focus(); return; }
  if (!list.length) { setStatus('Không có trang nào để dịch.', 'error'); return; }
  saveSettings();
  const run = startTrRun();
  await overlayHydrated; // chờ nạp xong bản dịch đã lưu, để không dịch trùng
  let ok = 0, skipped = 0, fresh = 0, failed = null, failedPage = 0, spent = 0;
  for (let i = 0; i < list.length; i++) {
    if (trRunCancelled(run)) break;
    const entry = list[i];
    if (await overlayPageDone(entry)) { ok++; skipped++; continue; }
    // còn lại bao nhiêu trang chưa dịch (ước lượng, coi như các trang sau đều chưa dịch)
    const eta = fresh ? ` · còn khoảng ${fmtDuration((spent / fresh) * (list.length - i))}` : '';
    const skipNote = skipped ? ` · bỏ qua ${skipped} trang đã dịch` : '';
    setStatus(`Đang dịch ${i + 1}/${list.length} (trang ${entry.pageNum})${skipNote}${eta}`, 'working');
    setOvStat(entry, 'đang dịch…', 'working');
    const t0 = Date.now();
    for (let attempt = 0; ; attempt++) {
      try { await translateOverlayPage(entry); break; }
      catch (err) {
        if (attempt < OV_RETRY_WAITS.length && isRetryableError(err) && !trRunCancelled(run)) {
          for (let s = OV_RETRY_WAITS[attempt]; s > 0 && !trRunCancelled(run); s--) {
            setStatus(`Trang ${entry.pageNum}: ${err.message} — thử lại sau ${s} giây (lần ${attempt + 1}/${OV_RETRY_WAITS.length})…`, 'working');
            await waitMs(1000);
          }
          if (!trRunCancelled(run)) continue;
        }
        failed = err; failedPage = entry.pageNum;
        break;
      }
    }
    if (failed) {
      if (run.stop) setOvStat(entry, 'chưa dịch', '');
      else setOvStat(entry, 'lỗi', 'error');
      break;
    }
    spent += (Date.now() - t0) / 1000;
    ok++; fresh++;
    setOvStat(entry, 'đã dịch', 'done');
    if (entry.btnEl) entry.btnEl.textContent = 'Dịch lại';
    entry.composed = false;
    composeVisibleOverlay(); // chỉ vẽ lại trang đang nhìn thấy; trang khác vẽ khi cuộn tới
  }
  const stopped = run.stop;
  endTrRun();
  const resume = 'Bấm "Dịch tài liệu" lần nữa để dịch tiếp — các trang đã dịch sẽ được bỏ qua.';
  if (docId !== run.doc) return; // tài liệu đã đóng giữa chừng — không báo gì thêm
  if (failed && !stopped) {
    setStatus(`Lỗi trang ${failedPage}: ${failed.message} Đã xong ${ok}/${list.length} trang. ${resume}`, 'error');
  } else if (ok < list.length) {
    setStatus(`Đã dừng: xong ${ok}/${list.length} trang. ${resume}`, '');
  } else {
    setStatus(`Đã dịch xong ${list.length} trang (Đè trang)` +
      (skipped ? `: ${fresh} trang mới, ${skipped} trang đã có sẵn.` : '.'), 'done');
  }
}

// ---------- Xuất PDF Đè trang (mỗi trang là 1 ảnh đã ghép, đúng khổ) ----------
// Ghép PDF ngay trong trình duyệt: mỗi trang là một ảnh JPEG (bộ lọc DCTDecode của PDF
// đọc thẳng JPEG, khỏi giải nén). Không gửi ảnh lên máy chủ nữa → không vướng giới hạn
// dung lượng request (máy chủ cục bộ 60MB, Vercel 4,5MB), xuất được cả cuốn sách.
// pages: [{ jpeg: Blob, pxW, pxH, w, h }] — w/h tính bằng điểm (1/72 inch)
function buildImagePdf(pages, title) {
  const enc = new TextEncoder();
  const parts = [];
  const offsets = [];
  let offset = 0;
  const push = (x) => {
    const b = typeof x === 'string' ? enc.encode(x) : x;
    parts.push(b);
    offset += b instanceof Blob ? b.size : b.length;
  };
  const num = (v) => (Math.round(v * 100) / 100).toString();
  const obj = (n, write) => { offsets[n] = offset; push(`${n} 0 obj\n`); write(); push('\nendobj\n'); };
  const n = pages.length;
  const pageObj = (i) => 3 + i * 3, contObj = (i) => 4 + i * 3, imgObj = (i) => 5 + i * 3;
  const infoObj = 3 + n * 3;

  push(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // %PDF-1.4 + dòng nhị phân
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ')}] >>`));
  pages.forEach((p, i) => {
    obj(pageObj(i), () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(p.w)} ${num(p.h)}] ` +
      `/Resources << /XObject << /Im0 ${imgObj(i)} 0 R >> >> /Contents ${contObj(i)} 0 R >>`));
    const cs = `q ${num(p.w)} 0 0 ${num(p.h)} 0 0 cm /Im0 Do Q`;
    obj(contObj(i), () => push(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`));
    obj(imgObj(i), () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${p.pxW} /Height ${p.pxH} /ColorSpace /DeviceRGB ` +
        `/BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.size} >>\nstream\n`);
      push(p.jpeg);
      push('\nendstream');
    });
  });
  // Tiêu đề tài liệu: chuỗi UTF-16BE dạng hex (đúng chuẩn cho chữ có dấu)
  let hex = 'FEFF';
  for (const ch of String(title || '')) {
    const cp = ch.codePointAt(0);
    const units = cp > 0xffff ? [0xd800 + ((cp - 0x10000) >> 10), 0xdc00 + ((cp - 0x10000) & 0x3ff)] : [cp];
    for (const u of units) hex += u.toString(16).toUpperCase().padStart(4, '0');
  }
  obj(infoObj, () => push(`<< /Title <${hex}> /Producer (PDF Translator) >>`));
  const xrefAt = offset;
  let xref = `xref\n0 ${infoObj + 1}\n0000000000 65535 f \n`;
  for (let k = 1; k <= infoObj; k++) xref += String(offsets[k]).padStart(10, '0') + ' 00000 n \n';
  push(xref);
  push(`trailer\n<< /Size ${infoObj + 1} /Root 1 0 R /Info ${infoObj} 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}

const canvasToJpeg = (cnv, q) => new Promise((res, rej) =>
  cnv.toBlob((b) => (b ? res(b) : rej(new Error('Không tạo được ảnh trang'))), 'image/jpeg', q));

async function exportOverlayPdf() {
  if (!pdfDoc || !overlayPages.length) { setStatus('Chưa có trang để xuất.', 'error'); return; }
  setStatus('Đang tạo PDF đè trang…', 'working');
  exportBtn.disabled = true;
  try {
    await ensureFontsReady();
    await overlayHydrated; // để trang đã dịch từ phiên trước cũng có mặt trong file
    const out = [];
    const cnv = document.createElement('canvas');
    const t0 = Date.now();
    for (let i = 0; i < overlayPages.length; i++) {
      const eta = i ? ` · còn khoảng ${fmtDuration(((Date.now() - t0) / 1000 / i) * (overlayPages.length - i))}` : '';
      setStatus(`Đang dựng trang ${i + 1}/${overlayPages.length}${eta}…`, 'working');
      const dims = await composeOverlay(overlayPages[i], { canvas: cnv, mode: 'export' });
      out.push({ jpeg: await canvasToJpeg(cnv, 0.85), pxW: cnv.width, pxH: cnv.height, w: dims.wPt, h: dims.hPt });
    }
    setStatus('Đang ghép file PDF…', 'working');
    const blob = buildImagePdf(out, docTitle + ' — đè trang');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (docTitle || 'ban-dich') + ' - de trang.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000); // file lớn: chờ trình duyệt tải xong mới thu hồi
    const done = overlayPages.filter((e) => e.translated).length;
    setStatus(`Đã tạo PDF đè trang (${overlayPages.length} trang, ${done} trang có bản dịch, ${fmtSize(blob.size)}).`, 'done');
  } catch (err) {
    setStatus('Lỗi tạo PDF: ' + err.message, 'error');
  } finally {
    exportBtn.disabled = false;
  }
}

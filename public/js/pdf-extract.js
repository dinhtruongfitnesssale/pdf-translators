'use strict';
// Trích chữ từ trang PDF theo cột.
// Script thường (không phải module): dùng chung phạm vi toàn cục với các file khác,
// thứ tự nạp nằm trong index.html.

// Trích text theo CỘT: tách các cột bằng khoảng trắng dọc rồi đọc trọn từng cột
// (trên→dưới) trước khi sang cột kế. Giúp bảng/nhiều cột không bị đọc xen kẽ.
function medianHeight(boxes) {
  const hs = boxes.map((b) => b.h).filter((h) => h > 0).sort((a, b) => a - b);
  return hs.length ? hs[Math.floor(hs.length / 2)] : 10;
}
function flushLine(items) {
  items.sort((a, b) => a.x - b.x);
  let s = '';
  let prevRight = null;
  for (const it of items) {
    if (prevRight !== null && it.x - prevRight > it.h * 0.3) s += ' ';
    s += it.str;
    prevRight = it.x + it.w;
  }
  return s;
}
function linesFromBoxes(boxes) {
  const sorted = boxes.slice().sort((a, b) => (b.y - a.y) || (a.x - b.x));
  const lh = medianHeight(boxes) || 10;
  const yThresh = lh * 0.6;
  const lines = [];
  let cur = [];
  let anchorY = null;
  for (const b of sorted) {
    if (anchorY === null || Math.abs(b.y - anchorY) <= yThresh) {
      cur.push(b);
      if (anchorY === null) anchorY = b.y;
    } else {
      lines.push({ y: anchorY, text: flushLine(cur) });
      cur = [b];
      anchorY = b.y;
    }
  }
  if (cur.length) lines.push({ y: anchorY, text: flushLine(cur) });
  let out = '';
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) out += (lines[i - 1].y - lines[i].y) > lh * 1.8 ? '\n\n' : '\n';
    out += lines[i].text;
  }
  return out;
}
function detectColumns(boxes, minX, maxX) {
  const width = maxX - minX;
  if (width <= 0) return [boxes];
  const BINS = 80;
  const binW = width / BINS;
  const cov = new Array(BINS).fill(0);
  for (const b of boxes) {
    const s = Math.max(0, Math.floor((b.x - minX) / binW));
    const e = Math.min(BINS - 1, Math.floor((b.x + b.w - minX) / binW));
    for (let i = s; i <= e; i++) cov[i]++;
  }
  let maxCov = 0;
  for (const c of cov) if (c > maxCov) maxCov = c;
  const thresh = Math.max(1, maxCov * 0.03); // bin gần như trống = khe giữa cột
  const cutXs = [];
  let i = 0;
  while (i < BINS) {
    if (cov[i] <= thresh) {
      let j = i;
      while (j < BINS && cov[j] <= thresh) j++;
      // chỉ tính khe NẰM GIỮA (không phải lề) và đủ rộng
      if (i > 0 && j < BINS && (j - i) * binW >= width * 0.02) {
        cutXs.push(minX + ((i + j) / 2) * binW);
      }
      i = j;
    } else i++;
  }
  if (!cutXs.length) return [boxes]; // một cột → giữ nguyên
  const bounds = [minX - 1, ...cutXs, maxX + 1];
  const cols = [];
  for (let c = 0; c < bounds.length - 1; c++) {
    const lo = bounds[c], hi = bounds[c + 1];
    const colBoxes = boxes.filter((b) => {
      const cx = b.x + b.w / 2;
      return cx >= lo && cx < hi;
    });
    if (colBoxes.length) cols.push(colBoxes);
  }
  return cols.length ? cols : [boxes];
}
async function extractText(page) {
  const tc = await page.getTextContent();
  const boxes = [];
  let minX = Infinity, maxX = -Infinity;
  for (const it of tc.items) {
    if (typeof it.str !== 'string' || !it.str.length) continue;
    const x = it.transform[4];
    const y = it.transform[5];
    const w = it.width || 0;
    const h = it.height || Math.abs(it.transform[3]) || 10;
    boxes.push({ x, y, w, h, str: it.str });
    if (x < minX) minX = x;
    if (x + w > maxX) maxX = x + w;
  }
  if (!boxes.length) return '';
  const columns = detectColumns(boxes, minX, maxX);
  const parts = columns.map((col) => linesFromBoxes(col));
  return parts.join('\n\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

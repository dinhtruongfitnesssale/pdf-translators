'use strict';
// Ghép file PDF ngay trong trình duyệt (dùng cho "Tải PDF" ở chế độ Đè trang).
// Script thường (không phải module): dùng chung phạm vi toàn cục với các file khác,
// thứ tự nạp nằm trong index.html.
//
// Mỗi trang = một ảnh JPEG (bộ lọc DCTDecode của PDF đọc thẳng JPEG) + tuỳ chọn một
// LỚP CHỮ ẨN (chế độ vẽ 3 = không hiện) đặt đúng vị trí từng dòng trên ảnh. Mắt chỉ
// thấy ảnh; Ctrl+F, bôi đen để copy, trình đọc màn hình thì "thấy" lớp chữ.
// Phông Be Vietnam Pro được nhúng (nén) để lớp chữ mang đủ dấu tiếng Việt.
// Các phần của file là Blob → trình duyệt có thể để tạm trên ổ đĩa, xuất được sách dày.

// ---------- Đọc phông TrueType: bảng ký tự → glyph, bề rộng glyph ----------
function parseTtf(buf) {
  const dv = new DataView(buf);
  const tables = {};
  const numTables = dv.getUint16(4);
  for (let i = 0; i < numTables; i++) {
    const r = 12 + i * 16;
    const tag = String.fromCharCode(dv.getUint8(r), dv.getUint8(r + 1), dv.getUint8(r + 2), dv.getUint8(r + 3));
    tables[tag] = { off: dv.getUint32(r + 8), len: dv.getUint32(r + 12) };
  }
  for (const t of ['head', 'hhea', 'hmtx', 'maxp', 'cmap']) {
    if (!tables[t]) throw new Error('Phông thiếu bảng ' + t);
  }
  const head = tables.head.off, hhea = tables.hhea.off;
  const upm = dv.getUint16(head + 18);
  const bbox = [dv.getInt16(head + 36), dv.getInt16(head + 38), dv.getInt16(head + 40), dv.getInt16(head + 42)];
  const ascent = dv.getInt16(hhea + 4), descent = dv.getInt16(hhea + 6);
  const nHM = dv.getUint16(hhea + 34);
  const numGlyphs = dv.getUint16(tables.maxp.off + 4);
  const adv = (gid) => dv.getUint16(tables.hmtx.off + 4 * Math.min(gid, nHM - 1));

  // cmap: ưu tiên (3,10) định dạng 12 (đủ mọi ký tự), rồi (3,1)/(0,x) định dạng 4
  const cm = tables.cmap.off;
  let sub4 = -1, sub12 = -1;
  for (let i = 0, n = dv.getUint16(cm + 2); i < n; i++) {
    const r = cm + 4 + i * 8;
    const pid = dv.getUint16(r), eid = dv.getUint16(r + 2), so = cm + dv.getUint32(r + 4);
    const fmt = dv.getUint16(so);
    if (fmt === 12 && (pid === 3 || pid === 0)) sub12 = so;
    if (fmt === 4 && (pid === 3 && eid === 1 || pid === 0) && sub4 < 0) sub4 = so;
  }
  let lookup;
  if (sub12 >= 0) {
    const n = dv.getUint32(sub12 + 12);
    lookup = (c) => {
      let lo = 0, hi = n - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1, g = sub12 + 16 + mid * 12;
        const s = dv.getUint32(g), e = dv.getUint32(g + 4);
        if (c < s) hi = mid - 1; else if (c > e) lo = mid + 1; else return dv.getUint32(g + 8) + (c - s);
      }
      return 0;
    };
  } else if (sub4 >= 0) {
    const segX2 = dv.getUint16(sub4 + 6), ends = sub4 + 14, starts = ends + segX2 + 2;
    const deltas = starts + segX2, ranges = deltas + segX2;
    lookup = (c) => {
      if (c > 0xffff) return 0;
      for (let i = 0; i < segX2; i += 2) {
        if (dv.getUint16(ends + i) < c) continue;
        const s = dv.getUint16(starts + i);
        if (s > c) return 0;
        const d = dv.getInt16(deltas + i), ro = dv.getUint16(ranges + i);
        if (!ro) return (c + d) & 0xffff;
        const g = dv.getUint16(ranges + i + ro + 2 * (c - s));
        return g ? (g + d) & 0xffff : 0;
      }
      return 0;
    };
  } else throw new Error('Phông không có bảng ký tự Unicode');
  return { buf, upm, bbox, ascent, descent, numGlyphs, adv, lookup };
}

let pdfFontPromise = null;
function loadPdfFont() {
  if (!pdfFontPromise) {
    pdfFontPromise = fetch('/fonts/BeVietnamPro-Regular.ttf')
      .then((r) => { if (!r.ok) throw new Error('Không tải được phông chữ'); return r.arrayBuffer(); })
      .then(parseTtf)
      .catch((e) => { pdfFontPromise = null; throw e; });
  }
  return pdfFontPromise;
}

// Nén zlib (= FlateDecode của PDF) bằng CompressionStream có sẵn trong trình duyệt
async function deflateBytes(u8) {
  if (typeof CompressionStream === 'undefined') return null;
  const stream = new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Chuỗi Unicode → hex UTF-16BE (cho tiêu đề và bảng ToUnicode)
function utf16Hex(str) {
  let hex = '';
  for (const ch of String(str)) {
    const cp = ch.codePointAt(0);
    const units = cp > 0xffff ? [0xd800 + ((cp - 0x10000) >> 10), 0xdc00 + ((cp - 0x10000) & 0x3ff)] : [cp];
    for (const u of units) hex += u.toString(16).toUpperCase().padStart(4, '0');
  }
  return hex;
}

// pages: [{ jpeg: Blob, pxW, pxH, w, h, runs?: [{ x, top, f, w, text }] }] — w/h/x/top/f tính bằng điểm
// opts: { title, font } — có font thì kèm lớp chữ ẩn từ runs
async function buildImagePdf(pages, opts = {}) {
  const font = opts.font || null;
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
  const stream = (n, dict, bytes) => obj(n, () => { push(`<< ${dict} /Length ${bytes.length} >>\nstream\n`); push(bytes); push('\nendstream'); });

  const n = pages.length;
  const pageObj = (i) => 3 + i * 3, contObj = (i) => 4 + i * 3, imgObj = (i) => 5 + i * 3;
  const base = 3 + n * 3;
  const F = { type0: base, cid: base + 1, desc: base + 2, file: base + 3, map: base + 4, toUni: base + 5 };
  const infoObj = font ? base + 6 : base;

  // Mã CID tự cấp cho từng ký tự gặp trong lớp chữ (1, 2, 3…) → ký tự thiếu glyph trong
  // phông vẫn copy ra đúng chữ, vì bảng ToUnicode ánh xạ theo CID chứ không theo glyph.
  const cidOf = new Map(), cidChar = [null], cidGid = [0], cidW = [0];
  const scale = font ? 1000 / font.upm : 1;
  const cid = (ch) => {
    let c = cidOf.get(ch);
    if (c) return c;
    c = cidChar.length;
    const gid = font.lookup(ch.codePointAt(0));
    cidOf.set(ch, c); cidChar.push(ch); cidGid.push(gid);
    cidW.push(Math.round((gid ? font.adv(gid) : font.upm / 2) * scale));
    return c;
  };
  const baseK = font ? font.ascent / (font.ascent - font.descent) : 0.8; // đường chân chữ / chiều cao dòng

  // "%PDF-1.4" + một dòng chú thích có byte > 127 (báo cho phần mềm biết đây là file nhị phân)
  push(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ')}] >>`));
  pages.forEach((p, i) => {
    const res = `/XObject << /Im0 ${imgObj(i)} 0 R >>` + (font ? ` /Font << /F1 ${F.type0} 0 R >>` : '');
    obj(pageObj(i), () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(p.w)} ${num(p.h)}] ` +
      `/Resources << ${res} >> /Contents ${contObj(i)} 0 R >>`));
    let cs = `q ${num(p.w)} 0 0 ${num(p.h)} 0 0 cm /Im0 Do Q`;
    if (font && p.runs && p.runs.length) {
      cs += '\nBT 3 Tr';
      for (const r of p.runs) {
        let hex = '', natural = 0;
        for (const ch of r.text) {
          const cp = ch.codePointAt(0);
          if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) continue;
          const c = cid(ch);
          hex += c.toString(16).padStart(4, '0');
          natural += cidW[c];
        }
        if (!hex) continue;
        natural = natural / 1000 * r.f;
        // co giãn ngang cho dòng chữ ẩn khớp bề rộng dòng chữ trên ảnh (để bôi đen đúng chỗ)
        const tz = natural > 0 && r.w > 0 ? Math.max(20, Math.min(400, (r.w / natural) * 100)) : 100;
        const y = p.h - (r.top + baseK * r.f);
        cs += `\n/F1 ${num(r.f)} Tf ${num(tz)} Tz 1 0 0 1 ${num(r.x)} ${num(y)} Tm <${hex}> Tj`;
      }
      cs += '\nET';
    }
    stream(contObj(i), '', enc.encode(cs));
    obj(imgObj(i), () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${p.pxW} /Height ${p.pxH} /ColorSpace /DeviceRGB ` +
        `/BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.size} >>\nstream\n`);
      push(p.jpeg);
      push('\nendstream');
    });
  });

  if (font) {
    const name = '/BeVietnamPro-Regular';
    obj(F.type0, () => push(`<< /Type /Font /Subtype /Type0 /BaseFont ${name} /Encoding /Identity-H ` +
      `/DescendantFonts [${F.cid} 0 R] /ToUnicode ${F.toUni} 0 R >>`));
    const W = cidW.length > 1 ? `/W [1 [${cidW.slice(1).join(' ')}]]` : '';
    obj(F.cid, () => push(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont ${name} ` +
      `/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> ` +
      `/FontDescriptor ${F.desc} 0 R /DW 500 ${W} /CIDToGIDMap ${F.map} 0 R >>`));
    const s = (v) => Math.round(v * scale);
    obj(F.desc, () => push(`<< /Type /FontDescriptor /FontName ${name} /Flags 32 ` +
      `/FontBBox [${font.bbox.map(s).join(' ')}] /ItalicAngle 0 /Ascent ${s(font.ascent)} /Descent ${s(font.descent)} ` +
      `/CapHeight ${s(font.ascent)} /StemV 80 /FontFile2 ${F.file} 0 R >>`));
    const raw = new Uint8Array(font.buf);
    const zipped = await deflateBytes(raw);
    stream(F.file, `/Length1 ${raw.length}` + (zipped ? ' /Filter /FlateDecode' : ''), zipped || raw);
    const map = new Uint8Array(cidGid.length * 2);
    cidGid.forEach((g, k) => { map[2 * k] = g >> 8; map[2 * k + 1] = g & 0xff; });
    stream(F.map, '', map);
    let cmap = '/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n' +
      '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n' +
      '/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n';
    for (let k = 1; k < cidChar.length; k += 100) {
      const chunk = cidChar.slice(k, k + 100);
      cmap += `${chunk.length} beginbfchar\n` +
        chunk.map((ch, j) => `<${(k + j).toString(16).padStart(4, '0')}> <${utf16Hex(ch)}>`).join('\n') + '\nendbfchar\n';
    }
    cmap += 'endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend';
    stream(F.toUni, '', enc.encode(cmap));
  }

  obj(infoObj, () => push(`<< /Title <FEFF${utf16Hex(opts.title || '')}> /Producer (PDF Translator) >>`));
  const xrefAt = offset;
  let xref = `xref\n0 ${infoObj + 1}\n0000000000 65535 f \n`;
  for (let k = 1; k <= infoObj; k++) xref += String(offsets[k]).padStart(10, '0') + ' 00000 n \n';
  push(xref);
  push(`trailer\n<< /Size ${infoObj + 1} /Root 1 0 R /Info ${infoObj} 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}

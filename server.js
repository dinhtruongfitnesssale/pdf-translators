// server.js — máy chủ cục bộ: phục vụ giao diện, proxy dịch (Gemini/Claude), xuất PDF.
// Không lưu tài liệu, không lưu API key. Mọi thứ chạy trên máy của bạn.

const path = require('path');
const express = require('express');
const PDFDocument = require('pdfkit');
const Anthropic = require('@anthropic-ai/sdk');
const { SKILLS, buildSystemPrompt, buildBlocksSystemPrompt } = require('./prompts');

const app = express();
const PORT = process.env.PORT || 5173;

app.use(express.json({ limit: '60mb' })); // rộng rãi cho bản dịch có ảnh chèn (base64)

// Giao diện tĩnh (gồm cả pdf.js đã chép sẵn vào public/vendor/pdfjs)
app.use(express.static(path.join(__dirname, 'public')));

// Thương hiệu (paper + ink + amber...) để xuất PDF
const BRAND = {
  paper: '#F6F2EA',
  ink: '#14110E',
  amber: '#B5651E',
  slate: '#3A5567',
};

// Danh sách hồ sơ dịch cho dropdown
app.get('/api/config', (req, res) => {
  res.json({
    skills: Object.entries(SKILLS).map(([key, v]) => ({ key, label: v.label })),
  });
});

// Gọi bộ máy dịch phù hợp với provider (dùng chung cho mọi endpoint dịch).
async function runTranslate({ provider, apiKey, model, system, text }) {
  if (!text || !text.trim()) return '';
  if (provider === 'claude') return (await translateClaude({ apiKey, model, system, text })) || '';
  if (provider === 'gemini') return (await translateGemini({ apiKey, model, system, text })) || '';
  const e = new Error('provider không hợp lệ (chọn "gemini" hoặc "claude").');
  e.status = 400;
  throw e;
}

// --- DỊCH (một khối chữ) ---
app.post('/api/translate', async (req, res) => {
  try {
    const { provider, apiKey, model, skill, text } = req.body || {};
    if (!apiKey) return res.status(400).json({ error: 'Thiếu API key.' });
    if (!text || !text.trim()) return res.json({ translation: '' });
    const translation = await runTranslate({ provider, apiKey, model, system: buildSystemPrompt(skill), text });
    res.json({ translation: (translation || '').trim() });
  } catch (err) {
    console.error('translate error:', err?.message || err);
    res.status(err?.status === 400 ? 400 : 502).json({ error: normalizeError(err) });
  }
});

// Tách bản dịch nhiều khối theo marker [[n]] → mảng đúng thứ tự (thiếu = null).
function parseNumbered(raw, n) {
  const out = new Array(n).fill(null);
  const re = /\[\[\s*(\d+)\s*\]\]/g;
  const marks = [];
  let m;
  while ((m = re.exec(raw))) marks.push({ n: parseInt(m[1], 10), start: m.index, end: re.lastIndex });
  for (let i = 0; i < marks.length; i++) {
    const cur = marks[i];
    const textEnd = i + 1 < marks.length ? marks[i + 1].start : raw.length;
    const t = raw.slice(cur.end, textEnd).trim();
    if (cur.n >= 1 && cur.n <= n) out[cur.n - 1] = t;
  }
  return out;
}

// --- DỊCH THEO KHỐI (cho chế độ "Đè trang") ---
// Nhận mảng đoạn chữ, trả về mảng bản dịch cùng số lượng/thứ tự. Gọi 1 lần cho cả
// trang; khối nào model trả thiếu/không khớp marker thì dịch lại riêng khối đó.
app.post('/api/translate-blocks', async (req, res) => {
  try {
    const { provider, apiKey, model, skill, blocks } = req.body || {};
    if (!apiKey) return res.status(400).json({ error: 'Thiếu API key.' });
    const list = Array.isArray(blocks) ? blocks : [];
    if (!list.length) return res.json({ translations: [] });

    const systemBlocks = buildBlocksSystemPrompt(skill);
    const systemPlain = buildSystemPrompt(skill);
    const input = list.map((b, i) => `[[${i + 1}]]\n${b == null ? '' : String(b)}`).join('\n\n');

    const raw = await runTranslate({ provider, apiKey, model, system: systemBlocks, text: input });
    const out = parseNumbered(raw, list.length);

    // Dự phòng: khối nào thiếu → dịch lẻ (đảm bảo luôn đủ số khối để đè đúng chỗ).
    for (let i = 0; i < out.length; i++) {
      if (out[i] != null && out[i] !== '') continue;
      const src = (list[i] == null ? '' : String(list[i])).trim();
      if (!src) { out[i] = ''; continue; }
      try { out[i] = (await runTranslate({ provider, apiKey, model, system: systemPlain, text: src })).trim(); }
      catch { out[i] = src; }
    }
    res.json({ translations: out });
  } catch (err) {
    console.error('translate-blocks error:', err?.message || err);
    res.status(err?.status === 400 ? 400 : 502).json({ error: normalizeError(err) });
  }
});

async function translateClaude({ apiKey, model, system, text }) {
  const client = new Anthropic({ apiKey });
  const resp = await client.messages.create({
    model: model || 'claude-opus-4-8',
    max_tokens: 8000,
    system,
    messages: [{ role: 'user', content: text }],
  });
  return (resp.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

async function translateGemini({ apiKey, model, system, text }) {
  const m = model || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    system_instruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
  };
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.error?.message || `HTTP ${r.status}`;
    const e = new Error(msg);
    e.status = r.status;
    throw e;
  }
  const cand = data.candidates && data.candidates[0];
  if (!cand) {
    if (data.promptFeedback?.blockReason) {
      throw new Error('Gemini chặn nội dung: ' + data.promptFeedback.blockReason);
    }
    throw new Error('Gemini không trả về kết quả.');
  }
  return (cand.content?.parts || []).map((p) => p.text || '').join('');
}

function normalizeError(err) {
  const s = err?.status || err?.statusCode;
  const msg = err?.message || String(err);
  if (s === 401 || /api key|unauthor|invalid.*key|API_KEY_INVALID/i.test(msg)) {
    return 'API key không hợp lệ hoặc thiếu quyền. Kiểm tra lại key.';
  }
  if (s === 429 || /rate limit|quota|RESOURCE_EXHAUSTED/i.test(msg)) {
    return 'Vượt giới hạn lượt gọi (rate limit / quota). Đợi một chút rồi thử lại.';
  }
  return msg;
}

// --- XUẤT PDF ---
app.post('/api/export', (req, res) => {
  try {
    const { title, pages } = req.body || {};
    const items = Array.isArray(pages) ? pages : [];
    if (!items.length) return res.status(400).json({ error: 'Không có nội dung để xuất.' });

    const doc = new PDFDocument({ size: 'A4', margin: 56, bufferPages: true });
    const fontReg = path.join(__dirname, 'fonts', 'BeVietnamPro-Regular.ttf');
    const fontBold = path.join(__dirname, 'fonts', 'BeVietnamPro-SemiBold.ttf');
    doc.registerFont('VN', fontReg);
    try { doc.registerFont('VN-Bold', fontBold); } catch { doc.registerFont('VN-Bold', fontReg); }

    const safeTitle = (title || 'ban-dich').replace(/[^\p{L}\p{N}\-_ ]/gu, '').trim() || 'ban-dich';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeTitle)}.pdf"`);
    doc.pipe(res);

    const paintPaper = () => {
      doc.save();
      doc.rect(0, 0, doc.page.width, doc.page.height).fill(BRAND.paper);
      doc.restore();
    };
    doc.on('pageAdded', paintPaper);
    paintPaper();

    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Tiêu đề tài liệu
    doc.font('VN-Bold').fontSize(20).fillColor(BRAND.ink)
      .text(title || 'Bản dịch', { width: contentWidth });
    doc.moveDown(0.3);
    doc.save().strokeColor(BRAND.amber).lineWidth(1.5)
      .moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.margins.left + 48, doc.y).stroke().restore();
    doc.moveDown(1);

    // Chuẩn hoá nội dung một trang thành danh sách khối (chữ/ảnh), theo thứ tự.
    // Nhận cả định dạng cũ (chuỗi) lẫn mới ({ blocks: [...] }).
    const pageBlocks = (raw) => {
      if (raw == null) return [];
      if (typeof raw === 'string') return raw.trim() ? [{ type: 'text', text: raw }] : [];
      if (Array.isArray(raw.blocks)) return raw.blocks;
      return [];
    };
    const dataUrlToBuffer = (src) => {
      const m = /^data:[^;]+;base64,(.*)$/.exec(src || '');
      if (!m) return null;
      try { return Buffer.from(m[1], 'base64'); } catch { return null; }
    };
    const clampPct = (p) => Math.min(1, Math.max(0.1, Number(p) || 1));

    items.forEach((raw, i) => {
      const blocks = pageBlocks(raw);
      if (i > 0) {
        doc.moveDown(0.8);
        doc.save().strokeColor(BRAND.amber).lineWidth(0.75)
          .moveTo(doc.page.margins.left, doc.y)
          .lineTo(doc.page.margins.left + contentWidth, doc.y).stroke().restore();
        doc.moveDown(0.6);
      }
      // Nhãn trang nhỏ, màu slate (trung tính)
      doc.font('VN').fontSize(8).fillColor(BRAND.slate)
        .text(`TRANG ${i + 1}`, { width: contentWidth, characterSpacing: 1 });
      doc.moveDown(0.4);

      if (!blocks.length) {
        doc.font('VN').fontSize(11.5).fillColor(BRAND.ink)
          .text('(trống)', { width: contentWidth, align: 'left', lineGap: 3 });
        return;
      }

      blocks.forEach((b, bi) => {
        if (bi > 0) doc.moveDown(0.35);
        if (b && b.type === 'image') {
          const buf = dataUrlToBuffer(b.src);
          if (!buf) return;
          let w = contentWidth * clampPct(b.widthPct);
          let h = (b.w && b.h) ? (w * b.h / b.w) : w;
          const top = doc.page.margins.top;
          const bottom = doc.page.height - doc.page.margins.bottom;
          const maxH = bottom - top;
          if (h > maxH) { w = w * (maxH / h); h = maxH; }   // ảnh cao hơn 1 trang → co vừa
          if (doc.y + h > bottom) doc.addPage();            // không đủ chỗ → sang trang mới
          const x = doc.page.margins.left + (contentWidth - w) / 2; // canh giữa
          try { doc.image(buf, x, doc.y, { width: w, height: h }); doc.y += h; } catch {}
          doc.x = doc.page.margins.left;
        } else {
          const t = (b && b.text != null ? String(b.text) : '').trim();
          if (!t) return;
          doc.font('VN').fontSize(11.5).fillColor(BRAND.ink)
            .text(t, { width: contentWidth, align: 'left', lineGap: 3 });
        }
      });
    });

    // Số trang PDF ở chân trang
    const range = doc.bufferedPageRange();
    for (let p = range.start; p < range.start + range.count; p++) {
      doc.switchToPage(p);
      doc.font('VN').fontSize(8).fillColor(BRAND.slate)
        .text(`${p + 1}`, doc.page.margins.left,
          doc.page.height - doc.page.margins.bottom + 16,
          { width: contentWidth, align: 'center' });
    }

    doc.end();
  } catch (err) {
    console.error('export error:', err?.message || err);
    if (!res.headersSent) res.status(500).json({ error: 'Lỗi khi tạo PDF: ' + (err?.message || err) });
  }
});

// --- XUẤT PDF "ĐÈ TRANG" ---
// Mỗi trang đã được ghép sẵn ở trình duyệt thành 1 ảnh (bản gốc + chữ Việt đè lên).
// Server chỉ việc đặt mỗi ảnh làm một trang PDF đúng khổ (điểm = points).
app.post('/api/export-overlay', (req, res) => {
  try {
    const { title, pages } = req.body || {};
    const items = Array.isArray(pages) ? pages : [];
    if (!items.length) return res.status(400).json({ error: 'Không có nội dung để xuất.' });

    const dataUrlToBuffer = (src) => {
      const m = /^data:[^;]+;base64,(.*)$/.exec(src || '');
      if (!m) return null;
      try { return Buffer.from(m[1], 'base64'); } catch { return null; }
    };
    const sizeOf = (p) => [Math.max(1, Math.round(p.w || 595)), Math.max(1, Math.round(p.h || 842))];

    const first = sizeOf(items[0]);
    const doc = new PDFDocument({ size: first, margin: 0, bufferPages: true });

    const safeTitle = (title || 'ban-dich').replace(/[^\p{L}\p{N}\-_ ]/gu, '').trim() || 'ban-dich';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeTitle)}.pdf"`);
    doc.pipe(res);

    items.forEach((p, i) => {
      const [w, h] = sizeOf(p);
      if (i > 0) doc.addPage({ size: [w, h], margin: 0 });
      const buf = dataUrlToBuffer(p.img);
      if (buf) { try { doc.image(buf, 0, 0, { width: w, height: h }); } catch {} }
    });

    doc.end();
  } catch (err) {
    console.error('export-overlay error:', err?.message || err);
    if (!res.headersSent) res.status(500).json({ error: 'Lỗi khi tạo PDF: ' + (err?.message || err) });
  }
});

// Chạy trực tiếp (local: `npm start`). Trên Vercel serverless thì chỉ export app.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n  PDF Translator đang chạy: http://localhost:${PORT}\n`);
  });
}

module.exports = app;

// server.js — máy chủ cục bộ: phục vụ giao diện, proxy dịch (Gemini/Claude), xuất PDF.
// Không lưu tài liệu, không lưu API key. Mọi thứ chạy trên máy của bạn.

const path = require('path');
const express = require('express');
const PDFDocument = require('pdfkit');
const Anthropic = require('@anthropic-ai/sdk');
const { SKILLS, buildSystemPrompt } = require('./prompts');

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

// --- DỊCH ---
app.post('/api/translate', async (req, res) => {
  try {
    const { provider, apiKey, model, skill, text } = req.body || {};
    if (!apiKey) return res.status(400).json({ error: 'Thiếu API key.' });
    if (!text || !text.trim()) return res.json({ translation: '' });

    const system = buildSystemPrompt(skill);
    let translation;

    if (provider === 'claude') {
      translation = await translateClaude({ apiKey, model, system, text });
    } else if (provider === 'gemini') {
      translation = await translateGemini({ apiKey, model, system, text });
    } else {
      return res.status(400).json({ error: 'provider không hợp lệ (chọn "gemini" hoặc "claude").' });
    }

    res.json({ translation: (translation || '').trim() });
  } catch (err) {
    console.error('translate error:', err?.message || err);
    res.status(502).json({ error: normalizeError(err) });
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

// Chạy trực tiếp (local: `npm start`). Trên Vercel serverless thì chỉ export app.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n  PDF Translator đang chạy: http://localhost:${PORT}\n`);
  });
}

module.exports = app;

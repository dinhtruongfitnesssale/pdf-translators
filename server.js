// server.js — máy chủ cục bộ: phục vụ giao diện, proxy dịch (Gemini/Claude), xuất PDF.
// Không lưu tài liệu, không lưu API key. Mọi thứ chạy trên máy của bạn.

const path = require('path');
const express = require('express');
const PDFDocument = require('pdfkit');
const Anthropic = require('@anthropic-ai/sdk');
const { SKILLS, buildSystemPrompt, buildBlocksSystemPrompt, buildNotesSystemPrompt } = require('./prompts');

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

// --- Model Gemini ---
// Google gỡ model cũ theo lịch: 2.0-flash đã tắt (01/06/2026), 2.5-* sẽ nghỉ hưu tiếp.
// Bảng dưới quy đổi tên đã chết sang tên còn sống, để cài đặt cũ của người dùng vẫn chạy.
const GEMINI_DEFAULT_MODEL = 'gemini-3.7-flash';
const GEMINI_RETIRED = {
  'gemini-2.0-flash': 'gemini-3.6-flash',
  'gemini-2.0-flash-001': 'gemini-3.6-flash',
  'gemini-2.0-flash-lite': 'gemini-3.5-flash-lite',
  'gemini-1.5-flash': 'gemini-3.5-flash-lite',
  'gemini-1.5-flash-8b': 'gemini-3.5-flash-lite',
  'gemini-1.5-pro': 'gemini-3.7-flash',
};
function resolveGeminiModel(m) {
  const name = String(m || '').trim().replace(/^models\//, '') || GEMINI_DEFAULT_MODEL;
  return GEMINI_RETIRED[name] || name;
}

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
    const { provider, apiKey, model, skill, text, keepSci, keepTerms } = req.body || {};
    if (!apiKey) return res.status(400).json({ error: 'Thiếu API key.' });
    if (!text || !text.trim()) return res.json({ translation: '' });
    const system = buildSystemPrompt(skill, { keepSci, keepTerms });
    const translation = await runTranslate({ provider, apiKey, model, system, text });
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
    const { provider, apiKey, model, skill, blocks, keepSci, keepTerms } = req.body || {};
    if (!apiKey) return res.status(400).json({ error: 'Thiếu API key.' });
    const list = Array.isArray(blocks) ? blocks : [];
    if (!list.length) return res.json({ translations: [] });

    // "Giữ nguyên…": tên khoa học / đơn vị / ký hiệu + danh sách thuật ngữ người dùng
    const keep = { keepSci, keepTerms };
    const systemBlocks = buildBlocksSystemPrompt(skill, keep);
    const systemPlain = buildSystemPrompt(skill, keep);
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

// --- TỔNG HỢP GHI CHÚ CORNELL (nút "AI soạn nháp") ---
// Gom Cue + Tóm tắt của từng chương thành một trang ôn tập cho cả cuốn sách.
// Chỉ chạy khi người dùng bấm nút — không tự động gọi để khỏi tốn token.
app.post('/api/synthesize', async (req, res) => {
  try {
    const { provider, apiKey, model, skill, title, text } = req.body || {};
    if (!apiKey) return res.status(400).json({ error: 'Thiếu API key.' });
    if (!text || !text.trim()) return res.status(400).json({ error: 'Chưa có ghi chú chương nào để tổng hợp.' });
    const input = `Tên tài liệu: ${title || '(không rõ)'}\n\nGHI CHÚ THEO CHƯƠNG:\n${text}`;
    const result = await runTranslate({
      provider, apiKey, model, system: buildNotesSystemPrompt(skill), text: input,
    });
    res.json({ result: (result || '').trim() });
  } catch (err) {
    console.error('synthesize error:', err?.message || err);
    res.status(err?.status === 400 ? 400 : 502).json({ error: normalizeError(err) });
  }
});

// --- Model Claude ---
// Từ Claude Opus 5.5 trở đi, model luôn "nghĩ" trước khi trả lời (không tắt được) và phần
// nghĩa cũng tính vào max_tokens → để rộng tay cho bản dịch dài khỏi bị cắt giữa chừng.
const CLAUDE_DEFAULT_MODEL = 'claude-opus-5-5';
// Model có lớp lọc an toàn có thể từ chối nhầm (vd. tài liệu y sinh). Với các model này
// bật "fallbacks": server Anthropic tự chạy lại trên model thay thế phù hợp.
const CLAUDE_FALLBACK_MODELS = new Set([
  'claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5', 'claude-fable-5-1', 'claude-fable-5-2',
]);
const CLAUDE_FALLBACK_BETA = 'server-side-fallback-2026-07-01';

async function translateClaude({ apiKey, model, system, text }) {
  const client = new Anthropic({ apiKey });
  const m = String(model || '').trim() || CLAUDE_DEFAULT_MODEL;
  const params = {
    model: m,
    max_tokens: 16000,
    system,
    messages: [{ role: 'user', content: text }],
  };
  let resp;
  try {
    if (CLAUDE_FALLBACK_MODELS.has(m)) {
      try {
        resp = await client.beta.messages.create({ ...params, betas: [CLAUDE_FALLBACK_BETA], fallbacks: 'default' });
      } catch (e) {
        // Tài khoản/khu vực chưa có tính năng fallback thì gọi lại bình thường, đừng làm hỏng bản dịch.
        if (!(e instanceof Anthropic.BadRequestError && /fallback/i.test(e.message || ''))) throw e;
        resp = await client.messages.create(params);
      }
    } else {
      resp = await client.messages.create(params);
    }
  } catch (e) {
    e.provider = 'claude';
    throw e;
  }
  if (resp.stop_reason === 'refusal') {
    const e = new Error('Claude từ chối đoạn này (bộ lọc an toàn). Thử model khác hoặc chia nhỏ đoạn.');
    e.provider = 'claude';
    throw e;
  }
  const out = (resp.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  if (resp.stop_reason === 'max_tokens') console.warn(`[claude] "${m}" chạm giới hạn max_tokens — bản dịch có thể bị cụt.`);
  return out;
}

// Google quá tải ("high demand" / "overloaded", HTTP 503/500) — lỗi phía máy chủ của Google,
// không phải do key hết hạn mức.
const GEMINI_BUSY_FALLBACK = 'gemini-3.5-flash-lite';
const isGeminiBusy = (e) => [500, 503].includes(e?.status) ||
  /overloaded|high demand|UNAVAILABLE|try again later/i.test(e?.message || '');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function translateGemini({ apiKey, model, system, text }) {
  const m = resolveGeminiModel(model);
  try {
    // Quá tải thường chỉ vài giây: thử lại 2 lần (chờ 1,5s rồi 3s) trước khi bỏ cuộc.
    for (let i = 0; ; i++) {
      try { return await callGemini({ apiKey, model: m, system, text }); }
      catch (e) {
        if (!isGeminiBusy(e) || i >= 2) throw e;
        await wait(1500 * (i + 1));
      }
    }
  } catch (e) {
    // Model bị Google gỡ giữa chừng: thử lại một lần bằng model mặc định còn sống.
    if (e?.status === 404 && m !== GEMINI_DEFAULT_MODEL) {
      const out = await callGemini({ apiKey, model: GEMINI_DEFAULT_MODEL, system, text });
      console.warn(`[gemini] "${m}" không còn khả dụng — đã dịch bằng "${GEMINI_DEFAULT_MODEL}".`);
      return out;
    }
    // Vẫn quá tải: chuyển sang model nhẹ (ít người tranh hơn) cho lượt này.
    if (isGeminiBusy(e) && m !== GEMINI_BUSY_FALLBACK) {
      const out = await callGemini({ apiKey, model: GEMINI_BUSY_FALLBACK, system, text });
      console.warn(`[gemini] "${m}" đang quá tải — đã dịch bằng "${GEMINI_BUSY_FALLBACK}".`);
      return out;
    }
    throw e;
  }
}

async function callGemini({ apiKey, model: m, system, text }) {
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
  if (err?.provider !== 'claude' && isGeminiBusy(err)) {
    return 'Máy chủ Gemini của Google đang quá tải (không phải do key của bạn hết lượt). ' +
      'App đã tự thử lại mà chưa được — đợi 1–2 phút rồi bấm dịch tiếp, hoặc tạm chuyển sang Claude.';
  }
  if (s === 404 || /not found|not supported|NOT_FOUND|is not found for API version/i.test(msg)) {
    if (err?.provider === 'claude') {
      return 'Model Claude này không tồn tại hoặc key chưa được dùng. Chọn model khác, ví dụ "' + CLAUDE_DEFAULT_MODEL + '".';
    }
    return 'Model này không còn khả dụng (Google đã gỡ). Mở Cài đặt và chọn model mới, ví dụ "' + GEMINI_DEFAULT_MODEL + '".';
  }
  return msg;
}

// --- DANH SÁCH MODEL (hỏi thẳng Google / Anthropic bằng key của người dùng) ---
app.post('/api/models', async (req, res) => {
  try {
    const { provider, apiKey } = req.body || {};
    if (!apiKey) return res.status(400).json({ error: 'Thiếu API key.' });
    if (provider === 'claude') {
      // Models API trả về model mới nhất trước; chỉ những model key này được dùng.
      const models = [];
      try {
        for await (const m of new Anthropic({ apiKey }).models.list({ limit: 100 })) {
          if (/^claude-/.test(m.id)) models.push(m.id);
        }
      } catch (e) {
        e.provider = 'claude';
        throw e;
      }
      return res.json({ models, default: CLAUDE_DEFAULT_MODEL });
    }
    if (provider !== 'gemini') return res.json({ models: [] });
    const r = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=' + encodeURIComponent(apiKey)
    );
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const e = new Error(data?.error?.message || `HTTP ${r.status}`);
      e.status = r.status;
      throw e;
    }
    const models = (data.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => String(m.name || '').replace(/^models\//, ''))
      .filter((n) => n && !/embedding|aqa|imagen|veo|tts|image|audio|native-audio|live/i.test(n));
    res.json({ models, default: GEMINI_DEFAULT_MODEL });
  } catch (err) {
    res.status(err?.status === 400 ? 400 : 500).json({ error: normalizeError(err) });
  }
});

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

// (Xuất PDF "Đè trang" nay ghép ngay trong trình duyệt — xem buildImagePdf trong public/js/overlay.js)

// --- XUẤT PDF GHI CHÚ CORNELL ---
// Một tài liệu ôn tập riêng: tổng hợp cả sách + từng chương (Cue | Notes | Summary),
// kèm danh sách câu đã bôi và bookmark.
app.post('/api/export-notes', (req, res) => {
  try {
    const { title, doc: docNote, chapters, highlights, bookmarks } = req.body || {};
    const chaps = Array.isArray(chapters) ? chapters : [];
    const hls = Array.isArray(highlights) ? highlights : [];
    const bms = Array.isArray(bookmarks) ? bookmarks : [];
    const d0 = docNote || {};
    const hasDoc = !!(d0.cue || d0.note || d0.sum);
    if (!hasDoc && !chaps.length && !hls.length && !bms.length) {
      return res.status(400).json({ error: 'Không có ghi chú để xuất.' });
    }

    const doc = new PDFDocument({ size: 'A4', margin: 56, bufferPages: true });
    const fontReg = path.join(__dirname, 'fonts', 'BeVietnamPro-Regular.ttf');
    const fontBold = path.join(__dirname, 'fonts', 'BeVietnamPro-SemiBold.ttf');
    doc.registerFont('VN', fontReg);
    try { doc.registerFont('VN-Bold', fontBold); } catch { doc.registerFont('VN-Bold', fontReg); }

    const safeTitle = (title || 'ghi-chu').replace(/[^\p{L}\p{N}\-_ ]/gu, '').trim() || 'ghi-chu';
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

    const cw = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const room = (need) => {
      if (doc.y + need > doc.page.height - doc.page.margins.bottom) doc.addPage();
    };

    doc.font('VN-Bold').fontSize(20).fillColor(BRAND.ink)
      .text(`${title || 'Ghi chú'} — Ghi chú Cornell`, { width: cw });
    doc.moveDown(0.3);
    doc.save().strokeColor(BRAND.amber).lineWidth(1.5)
      .moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.margins.left + 48, doc.y).stroke().restore();
    doc.moveDown(1);

    const heading = (text, sub) => {
      room(70);
      doc.font('VN-Bold').fontSize(14).fillColor(BRAND.ink).text(text, { width: cw });
      if (sub) doc.font('VN').fontSize(9).fillColor(BRAND.slate).text(sub, { width: cw });
      doc.moveDown(0.4);
    };
    // Một ô Cornell: nhãn nhỏ màu amber + nội dung
    const cell = (label, value) => {
      const t = (value || '').trim();
      if (!t) return;
      room(46);
      doc.font('VN-Bold').fontSize(8).fillColor(BRAND.amber)
        .text(label.toUpperCase(), { width: cw, characterSpacing: 1 });
      doc.moveDown(0.15);
      doc.font('VN').fontSize(11).fillColor(BRAND.ink).text(t, { width: cw, lineGap: 2.5 });
      doc.moveDown(0.5);
    };
    const rule = () => {
      doc.moveDown(0.2);
      doc.save().strokeColor(BRAND.amber).lineWidth(0.6)
        .moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.margins.left + cw, doc.y).stroke().restore();
      doc.moveDown(0.6);
    };

    if (hasDoc) {
      heading('Tổng hợp cả tài liệu');
      cell('Cue', d0.cue);
      cell('Notes', d0.note);
      cell('Summary', d0.sum);
      if (chaps.length) rule();
    }
    chaps.forEach((c, i) => {
      if (i > 0) rule();
      heading(c.title || `Chương ${i + 1}`, c.range || '');
      cell('Cue', c.cue);
      cell('Notes', c.note);
      cell('Summary', c.sum);
    });

    if (hls.length) {
      rule();
      heading('Câu đã bôi', `${hls.length} đoạn`);
      hls.forEach((h) => {
        room(34);
        doc.font('VN').fontSize(8).fillColor(BRAND.slate)
          .text(`TR.${h.p}${h.color ? ' · ' + h.color : ''}`, { width: cw, characterSpacing: 0.6 });
        doc.font('VN').fontSize(11).fillColor(BRAND.ink).text(h.text || '', { width: cw, lineGap: 2 });
        doc.moveDown(0.35);
      });
    }
    if (bms.length) {
      rule();
      heading('Bookmark', `${bms.length} trang`);
      bms.forEach((b) => {
        room(22);
        doc.font('VN').fontSize(11).fillColor(BRAND.ink)
          .text(`tr.${b.p} — ${b.label || ''}`, { width: cw, lineGap: 2 });
      });
    }

    const range = doc.bufferedPageRange();
    for (let p = range.start; p < range.start + range.count; p++) {
      doc.switchToPage(p);
      doc.font('VN').fontSize(8).fillColor(BRAND.slate)
        .text(`${p + 1}`, doc.page.margins.left,
          doc.page.height - doc.page.margins.bottom + 16,
          { width: cw, align: 'center' });
    }
    doc.end();
  } catch (err) {
    console.error('export-notes error:', err?.message || err);
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

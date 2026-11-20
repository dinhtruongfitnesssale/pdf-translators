'use strict';
// Ghi chú Cornell + xuất ghi chú.
// Script thường (không phải module): dùng chung phạm vi toàn cục với các file khác,
// thứ tự nạp nằm trong index.html.

// ---------- Ghi chú Cornell ----------
function getNote(scope) {
  if (!NOTE.notes[scope]) NOTE.notes[scope] = { cue: '', note: '', sum: '' };
  const s = NOTE.notes[scope];
  if (typeof s.cue !== 'string') s.cue = '';
  if (typeof s.note !== 'string') s.note = '';
  if (typeof s.sum !== 'string') s.sum = '';
  return s;
}
function curScope() { return noteScopeEl.value || DOC_SCOPE; }
function renderScopeSelect() {
  const want = noteScopeEl.value;
  const list = sortedChapters();
  let html = `<option value="${DOC_SCOPE}">📕 Cả tài liệu — tổng hợp</option>`;
  list.forEach((c, i) => {
    html += `<option value="${escapeHtml(c.id)}">${i + 1}. ${escapeHtml(chapterLabel(c))}</option>`;
  });
  noteScopeEl.innerHTML = html;
  const p = readingPageIndex();
  const auto = (noteFollow && p >= 0) ? scopeForPage(p) : null;
  const pick = (want && noteScopeEl.querySelector(`option[value="${CSS.escape(want)}"]`)) ? want : (auto || DOC_SCOPE);
  noteScopeEl.value = pick;
  const isChap = pick !== DOC_SCOPE;
  chapRenBtn.disabled = !isChap;
  chapDelBtn.disabled = !isChap;
}
// Chữ ghi chú lưu THUẦN VĂN BẢN; riêng liên kết về trang là token [[p12]] →
// hiển thị thành "tr.13 ↗" bấm được, và xuất file thì thành "(tr.13)".
function noteToHtml(s) {
  return escapeHtml(s || '').replace(/\[\[p(\d+)\]\]/g, (_, n) =>
    `<a class="pref" data-p="${n}" title="Nhảy tới trang ${Number(n) + 1}">tr.${Number(n) + 1} ↗</a>`);
}
function htmlToNote(el) {
  let out = '';
  const walk = (node) => {
    for (const c of node.childNodes) {
      if (c.nodeType === 3) out += c.nodeValue;
      else if (c.nodeType === 1) {
        if (c.tagName === 'BR') { out += '\n'; continue; }
        if (c.classList && c.classList.contains('pref')) { out += `[[p${c.dataset.p}]]`; continue; }
        if (/^(DIV|P|LI|H[1-6]|TR)$/.test(c.tagName) && out && !out.endsWith('\n')) out += '\n';
        walk(c);
      }
    }
  };
  walk(el);
  return out.replace(/ /g, ' '); // trình duyệt hay chèn khoảng trắng cứng khi gõ
}
function loadScopeIntoUI() {
  const st = getNote(curScope());
  for (const f of ['cue', 'note', 'sum']) {
    const el = cwEls[f];
    if (document.activeElement === el) continue; // đang gõ dở thì đừng dựng lại
    el.innerHTML = noteToHtml(st[f]);
  }
  cwEls.note.classList.remove('revealed');
  const scope = curScope();
  const isDoc = scope === DOC_SCOPE;
  noteSynthBtn.hidden = !isDoc;
  noteAIBtn.hidden = !isDoc;
}
function saveField(f) {
  const st = getNote(curScope());
  st[f] = htmlToNote(cwEls[f]);
  scheduleNoteSave();
}
// Ghi chú tự bám chương đang đọc khi cuộn
function syncFollowScope() {
  if (!noteFollow || !drawerOpen() || noteTab !== 'note' || !docId) return;
  if (cornellEl.contains(document.activeElement)) return; // đang gõ → đừng nhảy
  const p = readingPageIndex();
  if (p < 0) return;
  const want = scopeForPage(p);
  if (want === curScope()) return;
  if (!noteScopeEl.querySelector(`option[value="${CSS.escape(want)}"]`)) return;
  noteScopeEl.value = want;
  loadScopeIntoUI();
}
// Gửi một vệt bôi vào cột NOTES của ĐÚNG chương chứa trang đó
async function sendHlToNote(h) {
  let text = (h.q || '').trim();
  if (!text && h.k === 'r') {
    setNoteStat('Đang lấy chữ trong vùng bôi…');
    try { text = await textUnderRect(h.p, h); h.q = text; saveNotes(); } catch {}
  }
  if (!text) { setStatus('Không lấy được chữ trong vùng đã bôi (trang ảnh scan?).', 'error'); return; }
  const scope = scopeForPage(h.p);
  const st = getNote(scope);
  st.note = (st.note ? st.note.replace(/\s+$/, '') + '\n' : '') + `• ${text} [[p${h.p}]]`;
  saveNotes();
  if (!drawerOpen()) setDrawer(true);
  setNoteTab('note');
  renderScopeSelect();
  noteScopeEl.value = scope;
  loadScopeIntoUI();
  const ch = chapterById(scope);
  setNoteStat(`Đã thêm vào NOTES của ${ch ? ch.title : 'ghi chú cả tài liệu'}.`);
}
function setNoteStat(msg) { noteStatEl.textContent = msg || ''; }

// Ghép Cue + Summary của mọi chương thành một trang ôn tập ở note cả tài liệu
function buildSynthText() {
  const parts = [];
  for (const c of sortedChapters()) {
    const st = NOTE.notes[c.id];
    if (!st) continue;
    const cue = (st.cue || '').trim(), sum = (st.sum || '').trim(), note = (st.note || '').trim();
    if (!cue && !sum && !note) continue;
    const [a, b] = chapterRange(c);
    parts.push(`— ${c.title} (tr.${a + 1}–${b + 1}) —`);
    if (cue) parts.push('Cue: ' + cue.replace(/\n+/g, ' / '));
    if (sum) parts.push('Tóm tắt: ' + sum);
    else if (note) parts.push('Ý chính: ' + note);
    parts.push('');
  }
  return parts.join('\n').trim();
}
function doSynth() {
  const t = buildSynthText();
  if (!t) { setNoteStat('Chưa có chương nào được ghi chú — hãy ghi Cue/Tóm tắt cho vài chương trước.'); return; }
  const st = getNote(DOC_SCOPE);
  st.note = (st.note ? st.note.replace(/\s+$/, '') + '\n\n' : '') + t;
  flushNotes();
  noteScopeEl.value = DOC_SCOPE;
  loadScopeIntoUI();
  setNoteStat('Đã ghép ghi chú các chương vào cột NOTES. Giờ tự viết lại phần SUMMARY bằng lời của bạn.');
}
async function doSynthAI() {
  const apiKey = apiKeyEl.value.trim();
  if (!apiKey) { setStatus('Chưa nhập API key.', 'error'); apiKeyEl.focus(); return; }
  const t = buildSynthText();
  if (!t) { setNoteStat('Chưa có chương nào được ghi chú để tổng hợp.'); return; }
  noteAIBtn.disabled = true;
  setNoteStat('Đang nhờ AI soạn bản tổng hợp…');
  setStatus('Đang soạn bản tổng hợp…', 'working');
  try {
    const r = await fetch('/api/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: providerEl.value, apiKey, model: modelEl.value.trim(),
        skill: skillEl.value, title: docTitle, text: t,
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    const st = getNote(DOC_SCOPE);
    st.note = (st.note ? st.note.replace(/\s+$/, '') + '\n\n' : '') + (data.result || '').trim();
    flushNotes();
    noteScopeEl.value = DOC_SCOPE;
    loadScopeIntoUI();
    setNoteStat('AI đã soạn bản nháp — hãy đọc lại và sửa theo ý bạn.');
    setStatus('Đã soạn xong bản tổng hợp.', 'done');
  } catch (err) {
    setNoteStat('');
    setStatus('Không soạn được bản tổng hợp: ' + err.message, 'error');
  } finally {
    noteAIBtn.disabled = false;
  }
}

// ---------- Xuất ghi chú ----------
const plainNote = (s) => String(s || '').replace(/\[\[p(\d+)\]\]/g, (_, n) => `(tr.${Number(n) + 1})`);
function notesPayload() {
  const chapters = sortedChapters().map((c) => {
    const st = NOTE.notes[c.id] || {};
    const [a, b] = chapterRange(c);
    return {
      title: c.title, range: `tr.${a + 1}–${b + 1}`,
      cue: plainNote(st.cue), note: plainNote(st.note), sum: plainNote(st.sum),
    };
  }).filter((c) => c.cue || c.note || c.sum);
  const d = NOTE.notes[DOC_SCOPE] || {};
  return {
    title: docTitle,
    doc: { cue: plainNote(d.cue), note: plainNote(d.note), sum: plainNote(d.sum) },
    chapters,
    highlights: NOTE.highlights.slice().sort((a, b) => a.p - b.p)
      .map((h) => ({ p: h.p + 1, color: HL_NAMES[h.c] || '', text: (h.q || '').trim() }))
      .filter((h) => h.text),
    bookmarks: NOTE.bookmarks.slice().sort((a, b) => a.p - b.p).map((b) => ({ p: b.p + 1, label: b.label || '' })),
  };
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function exportNotesMd() {
  flushNotes();
  const d = notesPayload();
  const cell = (label, v) => (v ? `**${label}**\n\n${v}\n\n` : '');
  let md = `# ${d.title} — Ghi chú Cornell\n\n`;
  if (d.doc.cue || d.doc.note || d.doc.sum) {
    md += `## Tổng hợp cả tài liệu\n\n${cell('Cue', d.doc.cue)}${cell('Notes', d.doc.note)}${cell('Summary', d.doc.sum)}`;
  }
  for (const c of d.chapters) {
    md += `## ${c.title} — ${c.range}\n\n${cell('Cue', c.cue)}${cell('Notes', c.note)}${cell('Summary', c.sum)}`;
  }
  if (d.highlights.length) {
    md += `## Câu đã bôi\n\n` + d.highlights.map((h) => `- (tr.${h.p}) ${h.text}${h.color ? ` _[${h.color}]_` : ''}`).join('\n') + '\n\n';
  }
  if (d.bookmarks.length) {
    md += `## Bookmark\n\n` + d.bookmarks.map((b) => `- tr.${b.p} — ${b.label}`).join('\n') + '\n';
  }
  downloadBlob(new Blob([md], { type: 'text/markdown;charset=utf-8' }), `${d.title || 'ghi-chu'} - ghi chu.md`);
  setNoteStat('Đã tải file .md.');
}
async function exportNotesPdf() {
  flushNotes();
  const d = notesPayload();
  if (!d.chapters.length && !d.highlights.length && !d.doc.note && !d.doc.sum && !d.doc.cue) {
    setNoteStat('Chưa có gì để xuất.');
    return;
  }
  notePdfBtn.disabled = true;
  setStatus('Đang tạo PDF ghi chú…', 'working');
  try {
    const r = await fetch('/api/export-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(d),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error || `HTTP ${r.status}`);
    }
    downloadBlob(await r.blob(), `${d.title || 'ghi-chu'} - ghi chu.pdf`);
    setStatus('Đã tạo PDF ghi chú.', 'done');
    setNoteStat('');
  } catch (err) {
    setStatus('Lỗi tạo PDF ghi chú: ' + err.message, 'error');
  } finally {
    notePdfBtn.disabled = false;
  }
}

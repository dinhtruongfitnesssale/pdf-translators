'use strict';
// Tìm chữ trong tài liệu.
// Script thường (không phải module): dùng chung phạm vi toàn cục với các file khác,
// thứ tự nạp nằm trong index.html.

// =========================================================================
// TÌM CHỮ TRONG TÀI LIỆU
// Tìm cùng lúc ở hai nơi:
//   • BẢN DỊCH — chữ đang nằm sẵn trong bộ nhớ, tìm ra ngay lập tức.
//   • BẢN GỐC  — phải trích chữ + toạ độ từng mẩu chữ của từng trang PDF, nên
//     quét dần theo trang (có báo tiến độ) và nhớ đệm lại cho những lần tìm sau.
// So khớp "dễ tính": bỏ dấu, không phân biệt hoa thường, gộp mọi khoảng trắng →
// gõ "tieng viet" vẫn ra "tiếng Việt" kể cả khi nó bị ngắt qua hai dòng.
// =========================================================================
const FIND_MAX = 400;         // đủ dùng để đọc sách, không làm nghẹt danh sách
const FIND = {
  q: '', qf: '',              // từ khoá thật / từ khoá đã "gấp" để so khớp
  scope: 'both',              // 'both' | 'trans' | 'orig'
  results: [], cur: -1, curM: null,
  byBlock: new Map(),         // 'trang:khối' → [{ s, e, i }] cho cột bản dịch
  boxes: new Map(),           // trang → [{ i, rects }] cho trang gốc
  painted: new Set(),         // các ô chữ đang có vệt tìm (để còn xoá đi)
  run: 0, scanning: false, wantFirst: false,
};

// "Gấp" chữ về dạng dễ so khớp; `map` giữ vị trí gốc của từng ký tự đã gấp để
// đánh dấu lại đúng chỗ trong văn bản thật.
function foldText(s) {
  let out = '';
  const map = [];
  let space = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (/\s/.test(c)) {
      if (out.length && !space) { out += ' '; map.push(i); space = true; }
      continue;
    }
    space = false;
    const f = ((c === 'đ' || c === 'Đ') ? 'd' : c)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    for (let k = 0; k < f.length; k++) { out += f[k]; map.push(i); }
  }
  return { text: out, map };
}
const foldQuery = (q) => foldText(String(q || '')).text.trim();

// Mọi chỗ xuất hiện của `qf` trong `src`, trả về vị trí theo CHỮ THẬT
function matchesIn(src, qf, folded) {
  const out = [];
  if (!src || !qf) return out;
  const fd = folded || foldText(src);
  let at = 0;
  while (out.length < 2000) {
    const i = fd.text.indexOf(qf, at);
    if (i < 0) break;
    const s = fd.map[i];
    let e = fd.map[i + qf.length - 1] + 1;
    while (e < src.length && /[\u0300-\u036f]/.test(src[e])) e++; // ôm trọn dấu rời
    out.push({ s, e });
    at = i + qf.length;
  }
  return out;
}

// Một mẩu chữ ngắn quanh chỗ tìm thấy, in đậm đúng phần khớp
function findSnippet(text, s, e) {
  const cut = (t) => t.replace(/\s+/g, ' ');
  const from = Math.max(0, s - 46), to = Math.min(text.length, e + 74);
  return (from > 0 ? '…' : '') + escapeHtml(cut(text.slice(from, s)))
    + '<b>' + escapeHtml(cut(text.slice(s, e))) + '</b>'
    + escapeHtml(cut(text.slice(e, to))) + (to < text.length ? '…' : '');
}

// Tô chữ tìm thấy trong một đoạn văn bản thuần (dùng cho trang sách đã dàn lại)
function highlightFindHtml(text) {
  const hits = matchesIn(text, FIND.qf);
  if (!hits.length) return escapeHtml(text);
  let html = '', at = 0;
  for (const h of hits) {
    html += escapeHtml(text.slice(at, h.s));
    html += `<mark class="findmark">${escapeHtml(text.slice(h.s, h.e))}</mark>`;
    at = h.e;
  }
  return html + escapeHtml(text.slice(at));
}

// --- Bản gốc: chữ + toạ độ từng mẩu chữ của một trang (nhớ đệm theo trang) ---
async function origPageText(p) {
  const entry = pages[p];
  if (entry && entry.findSrc) return entry.findSrc;
  if (!pdfDoc) return null;
  const page = await pdfDoc.getPage(p + 1);
  const vp = page.getViewport({ scale: 1 });
  const Wp = vp.width, Hp = vp.height;
  const tc = await page.getTextContent();
  let text = '';
  const spans = [];
  let prevRight = null, prevTop = null;
  for (const it of tc.items) {
    if (typeof it.str !== 'string' || !it.str.length) continue;
    const x = it.transform[4];
    const fs = Math.abs(it.transform[3]) || it.height || 10;
    const top = Hp - it.transform[5] - fs;   // đổi sang gốc trên-trái
    const w = it.width || 0;
    if (text) {
      if (prevTop === null || Math.abs(top - prevTop) > fs * 0.6) text += '\n';
      else if (x - prevRight > fs * 0.3) text += ' ';
    }
    spans.push({ s: text.length, e: text.length + it.str.length, x, top, w, fs });
    text += it.str;
    prevRight = x + w;
    prevTop = top;
  }
  const data = { text, spans, Wp, Hp, folded: foldText(text) };
  if (entry) entry.findSrc = data;
  return data;
}
// PDF chỉ cho biết bề rộng CẢ MẨU chữ, không cho biết từng chữ cái nằm đâu. Chia
// đều theo số ký tự thì vệt tô lệch hẳn đi (chữ "i" đâu có rộng bằng chữ "m"), nên
// đo thử bằng canvas rồi lấy TỈ LỆ — sai số font thay thế phần lớn tự triệt tiêu.
let findMeasCtx = null;
function textRatios(str, a, b, fs) {
  const len = str.length || 1;
  const flat = { start: a / len, width: (b - a) / len };
  try {
    if (!findMeasCtx) findMeasCtx = document.createElement('canvas').getContext('2d');
    findMeasCtx.font = Math.max(4, Math.round(fs)) + 'px sans-serif';
    const total = findMeasCtx.measureText(str).width;
    if (!(total > 0)) return flat;
    return {
      start: findMeasCtx.measureText(str.slice(0, a)).width / total,
      width: findMeasCtx.measureText(str.slice(a, b)).width / total,
    };
  } catch { return flat; }
}
// Chỗ tìm thấy → các ô chữ nhật, toạ độ theo BỀ RỘNG trang (giống vệt bôi vùng)
function findRects(data, s, e) {
  const out = [];
  for (const sp of data.spans) {
    if (sp.e <= s || sp.s >= e || sp.w <= 0) continue;
    const str = data.text.slice(sp.s, sp.e);
    const r = textRatios(str, Math.max(s, sp.s) - sp.s, Math.min(e, sp.e) - sp.s, sp.fs);
    out.push({
      x: (sp.x + sp.w * r.start) / data.Wp,
      y: (sp.top - sp.fs * 0.08) / data.Wp,
      w: (sp.w * r.width) / data.Wp,
      h: (sp.fs * 1.2) / data.Wp,
    });
  }
  return out;
}

// --- Quét bản dịch (nhanh, nằm sẵn trong bộ nhớ) ---
function scanTranslations() {
  for (const entry of pages) {
    for (let k = 0; k < entry.blocks.length; k++) {
      const block = entry.blocks[k];
      if (block.type !== 'text') continue;
      const text = block.text || '';
      for (const h of matchesIn(text, FIND.qf)) {
        if (FIND.results.length >= FIND_MAX) return;
        FIND.results.push({
          p: entry.index, k: 't', b: k, s: h.s, e: h.e,
          hit: text.slice(h.s, h.e), html: findSnippet(text, h.s, h.e),
        });
      }
    }
  }
}

function sortFind() {
  FIND.results.sort((a, z) =>
    a.p - z.p || (a.k === z.k ? ((a.b || 0) - (z.b || 0) || a.s - z.s) : (a.k === 'o' ? -1 : 1)));
}
// Dựng lại bảng tra cứu sau mỗi lần danh sách kết quả đổi
function reindexFind() {
  FIND.byBlock = new Map();
  FIND.boxes = new Map();
  FIND.results.forEach((m, i) => {
    m.i = i;
    if (m.k === 't') {
      const key = m.p + ':' + m.b;
      if (!FIND.byBlock.has(key)) FIND.byBlock.set(key, []);
      FIND.byBlock.get(key).push({ s: m.s, e: m.e, i });
    } else {
      if (!FIND.boxes.has(m.p)) FIND.boxes.set(m.p, []);
      FIND.boxes.get(m.p).push({ i, rects: m.rects || [] });
    }
  });
  FIND.cur = FIND.curM ? FIND.results.indexOf(FIND.curM) : -1;
  if (FIND.cur < 0) FIND.curM = null;
}
function findRangesFor(p, b) {
  if (!FIND.qf) return [];
  return FIND.byBlock.get(p + ':' + b) || [];
}

// --- Vẽ vệt tìm thấy ---
function paintFindLayer(entry) {
  const layer = entry.findLayer;
  if (!layer) return;
  const list = FIND.qf ? FIND.boxes.get(entry.index) : null;
  if (!list || !list.length) { if (layer.childElementCount) layer.innerHTML = ''; return; }
  const a = entry.findAspect || entry.aspect || 1.414;
  const asp = (a > 0.05 && Number.isFinite(a)) ? a : 1.414;
  layer.innerHTML = '';
  for (const m of list) {
    for (const r of m.rects) {
      const d = document.createElement('div');
      d.className = 'find-box' + (m.i === FIND.cur ? ' cur' : '');
      d.style.left = (r.x * 100) + '%';
      d.style.width = (r.w * 100) + '%';
      d.style.top = (r.y / asp * 100) + '%';
      d.style.height = (r.h / asp * 100) + '%';
      layer.appendChild(d);
    }
  }
}
// Vẽ thẳng lên canvas — dùng cho chế độ Đọc sách
function paintFindOnCanvas(ctx, p, widthPx) {
  const list = FIND.qf ? FIND.boxes.get(p) : null;
  if (!list || !ctx) return;
  ctx.save();
  ctx.globalAlpha = 0.42;
  for (const m of list) {
    ctx.fillStyle = m.i === FIND.cur ? '#F2A03D' : '#FFE08A';
    for (const r of m.rects) ctx.fillRect(r.x * widthPx, r.y * widthPx, r.w * widthPx, r.h * widthPx);
  }
  ctx.restore();
}
function repaintFind(withBook) {
  const want = new Set(FIND.byBlock.keys());
  for (const key of new Set([...want, ...FIND.painted])) {
    const i = key.indexOf(':');
    const ed = document.querySelector(`.editor[data-p="${key.slice(0, i)}"][data-b="${key.slice(i + 1)}"]`);
    if (ed && document.activeElement !== ed) paintEditor(ed); // đang gõ dở thì để yên
  }
  FIND.painted = want;
  for (const entry of pages) paintFindLayer(entry);
  if (withBook && readMode === 'book' && pdfDoc) renderBook();
}

// --- Chạy tìm ---
let findDebounce = null;
function scheduleFind() {
  if (findDebounce) clearTimeout(findDebounce);
  findDebounce = setTimeout(() => { findDebounce = null; runFind(); }, 240);
}
async function runFind() {
  const token = ++FIND.run;   // lần tìm mới → lần quét đang dở tự bỏ cuộc
  FIND.q = findInput.value.trim();
  FIND.qf = foldQuery(findInput.value);
  FIND.results = [];
  FIND.curM = null;
  FIND.scanning = false;
  reindexFind();
  repaintFind(true);
  renderFindList();
  if (!pdfDoc) { setFindStat('Chưa mở tài liệu nào.'); return; }
  if (FIND.qf.length < 2) { setFindStat(FIND.qf ? 'Gõ ít nhất 2 ký tự.' : ''); return; }

  if (FIND.scope !== 'orig') {
    scanTranslations();
    sortFind(); reindexFind(); renderFindList(); repaintFind(false);
    setFindStat(FIND.results.length
      ? `${FIND.results.length} kết quả trong bản dịch…`
      : 'Chưa thấy trong bản dịch…');
    takeFirstIfWanted();
  }

  if (FIND.scope !== 'trans' && FIND.results.length < FIND_MAX) {
    FIND.scanning = true;
    const total = pages.length;
    for (let p = 0; p < total; p++) {
      if (token !== FIND.run) return;
      let data = null;
      try { data = await origPageText(p); } catch { data = null; }
      if (token !== FIND.run) return;
      if (data) {
        const entry = pages[p];
        if (entry && data.Wp > 0) entry.findAspect = data.Hp / data.Wp;
        for (const h of matchesIn(data.text, FIND.qf, data.folded)) {
          if (FIND.results.length >= FIND_MAX) break;
          FIND.results.push({
            p, k: 'o', s: h.s, e: h.e,
            hit: data.text.slice(h.s, h.e), html: findSnippet(data.text, h.s, h.e),
            rects: findRects(data, h.s, h.e),
          });
        }
      }
      if (FIND.results.length >= FIND_MAX) break;
      // Nhả luồng theo từng nhóm trang: danh sách hiện dần, app không bị đơ
      if (p % 6 === 5 || p === total - 1) {
        sortFind(); reindexFind(); renderFindList(); repaintFind(false);
        setFindStat(`Đang quét bản gốc — trang ${p + 1}/${total}… (${FIND.results.length} kết quả)`);
        takeFirstIfWanted();
        await new Promise((r) => setTimeout(r, 0));
        if (token !== FIND.run) return;
      }
    }
    FIND.scanning = false;
  }
  sortFind(); reindexFind(); renderFindList(); repaintFind(true);
  setFindStat(findSummary());
  takeFirstIfWanted();
}
// Bấm Enter lúc chưa có kết quả nào → nhảy tới kết quả đầu tiên ngay khi có
function takeFirstIfWanted() {
  if (FIND.wantFirst && FIND.results.length) { FIND.wantFirst = false; activateFind(0); }
}
function findSummary() {
  const n = FIND.results.length;
  if (!FIND.qf) return '';
  if (!n) return `Không thấy “${FIND.q}”.`;
  const np = new Set(FIND.results.map((r) => r.p)).size;
  const capped = n >= FIND_MAX ? ` — dừng ở ${FIND_MAX} kết quả đầu` : '';
  const cur = FIND.cur >= 0 ? `Kết quả ${FIND.cur + 1}/${n} · ` : '';
  return `${cur}${n} kết quả trong ${np} trang${capped}. Enter = kết quả sau, Shift+Enter = trước.`;
}
function setFindStat(msg) { if (findStatEl) findStatEl.textContent = msg || ''; }

function renderFindList() {
  if (!findListEl) return;
  findListEl.innerHTML = '';
  findPrevBtn.disabled = findNextBtn.disabled = !FIND.results.length;
  if (!FIND.qf) {
    findListEl.appendChild(emptyMsg(
      'Gõ từ khoá để tìm trong bản gốc và bản dịch. Không cần bỏ dấu cho đúng — gõ "tieng viet" vẫn ra "tiếng Việt".'));
    return;
  }
  if (!FIND.results.length) {
    if (!FIND.scanning) findListEl.appendChild(emptyMsg(`Không thấy “${FIND.q}” trong tài liệu.`));
    return;
  }
  FIND.results.forEach((m, i) => {
    const row = document.createElement('div');
    row.className = 'item' + (i === FIND.cur ? ' cur' : '');
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'item-go';
    go.innerHTML = `<span class="item-p">TRANG ${m.p + 1} · ${m.k === 'o' ? 'BẢN GỐC' : 'BẢN DỊCH'}</span>`
      + `<span class="item-t">${m.html}</span>`;
    go.addEventListener('click', () => { activateFind(i); if (isMobile()) setDrawer(false); });
    row.appendChild(go);
    findListEl.appendChild(row);
  });
}

// --- Nhảy tới một kết quả ---
function activateFind(i) {
  const n = FIND.results.length;
  if (!n) return;
  FIND.cur = ((i % n) + n) % n;
  FIND.curM = FIND.results[FIND.cur];
  gotoFindMatch(FIND.curM); // đã tự vẽ lại trang sách với vệt mới → khỏi vẽ lần nữa
  repaintFind(false);
  renderFindList();
  const row = findListEl && findListEl.children[FIND.cur];
  if (row) row.scrollIntoView({ block: 'nearest' });
  setFindStat(findSummary());
}
function findStep(d) {
  if (!FIND.results.length) return;
  activateFind(FIND.cur < 0 ? (d > 0 ? 0 : FIND.results.length - 1) : FIND.cur + d);
}
// Đưa vệt đang chọn xuống dưới thanh công cụ dính. Không cuộn lên cao hơn đầu
// trang chứa nó (`minTop`), nếu không ô số trang lại nhảy về trang trước đó.
function scrollElIntoReading(el, minTop) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const want = r.top + window.scrollY - stickyOffset() - 120;
  window.scrollTo({ top: Math.max(minTop || 0, want), behavior: 'auto' });
}
function gotoFindMatch(m) {
  if (!pdfDoc) return;
  pageInput.value = String(m.p + 1);

  if (viewMode === 'overlay') {
    suppressScrollSave = true;
    scrollOverlayToPage(m.p);
    setTimeout(() => { suppressScrollSave = false; }, 350);
    return;
  }

  if (readMode === 'book') {
    // Trang sách chỉ hiện được một mặt: đưa chế độ xem về đúng loại kết quả
    const want = m.k === 'o' ? 'orig' : 'trans';
    if (viewMode !== want) setMode(want);
    if (m.k === 'o') bookIndex = m.p;
    else {
      const bp = bookPageOfMatch(m);
      if (bp < 0) { setFindStat('Chưa dàn được trang sách cho kết quả này — thử chế độ Kéo lướt.'); return; }
      bookIndex = bp;
    }
    renderBook();
    return;
  }

  // Kéo lướt: cột chứa kết quả phải đang hiện thì mới thấy vệt tô
  if (m.k === 't' && viewMode === 'orig') setMode('both');
  else if (m.k === 'o' && viewMode === 'trans') setMode('both');

  suppressScrollSave = true;
  scrollToPage(m.p);
  const pageTop = window.scrollY;
  renderVisible();
  requestAnimationFrame(() => {
    const sel = m.k === 't'
      ? `.editor[data-p="${m.p}"][data-b="${m.b}"] mark.find-cur`
      : null;
    const el = sel ? document.querySelector(sel) : (pages[m.p] && pages[m.p].findLayer.querySelector('.find-box.cur'));
    if (el) scrollElIntoReading(el, pageTop);
    pageInput.value = String(m.p + 1);
    renderVisible();
    if (docId) localStorage.setItem(pageKey(docId), String(m.p));
    setTimeout(() => { suppressScrollSave = false; }, 350);
  });
}
// Kết quả thứ mấy trong bản dịch → trang sách thứ mấy (chữ đã dàn lại nhưng vẫn
// đúng thứ tự, nên đếm lần xuất hiện là ra).
function bookPageOfMatch(m) {
  if (!transPages.length) return -1;
  let want = 0;
  for (const r of FIND.results) {
    if (r === m) break;
    if (r.k === 't') want++;
  }
  let seen = 0, last = -1;
  for (let i = 0; i < transPages.length; i++) {
    const t = transPages[i].filter((f) => f.type === 'text').map((f) => f.text).join(' ');
    const n = matchesIn(t, FIND.qf).length;
    if (!n) continue;
    if (seen + n > want) return i;
    seen += n;
    last = i;
  }
  // Dàn lại trang có thể cắt chữ ngay giữa từ khoá → không khớp đủ số lần: lấy
  // trang cuối còn thấy từ khoá, vẫn hơn là đứng im.
  return last;
}

// Mở tài liệu khác / đóng tài liệu → bỏ hết kết quả cũ
function resetFind() {
  FIND.run++;
  FIND.q = ''; FIND.qf = '';
  FIND.results = []; FIND.cur = -1; FIND.curM = null;
  FIND.scanning = false; FIND.wantFirst = false;
  FIND.byBlock = new Map(); FIND.boxes = new Map(); FIND.painted = new Set();
  if (findDebounce) { clearTimeout(findDebounce); findDebounce = null; }
  if (findInput) findInput.value = '';
  renderFindList();
  setFindStat('');
}
function openFindPanel() {
  if (!pdfDoc) return;
  closeNav();
  if (!drawerOpen()) setDrawer(true);
  setNoteTab('find');
  findInput.focus();
  findInput.select();
}

// ---------- Sự kiện tìm chữ ----------
findBtn.addEventListener('click', openFindPanel);
findInput.addEventListener('input', () => { FIND.wantFirst = false; scheduleFind(); });
findInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (FIND.results.length) { findStep(e.shiftKey ? -1 : 1); return; }
    FIND.wantFirst = true;
    if (findDebounce) { clearTimeout(findDebounce); findDebounce = null; runFind(); }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    if (findInput.value) { findInput.value = ''; runFind(); }
    else setDrawer(false);
  }
});
findPrevBtn.addEventListener('click', () => findStep(-1));
findNextBtn.addEventListener('click', () => findStep(1));
findScopeEl.addEventListener('click', (e) => {
  const b = e.target.closest('.seg');
  if (!b) return;
  FIND.scope = b.dataset.fs;
  [...findScopeEl.querySelectorAll('.seg')].forEach((x) => x.classList.toggle('active', x === b));
  FIND.wantFirst = false;
  runFind();
});

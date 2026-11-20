'use strict';
// Thanh trạng thái, cấu hình skill, mở & vẽ PDF (lazy).
// Script thường (không phải module): dùng chung phạm vi toàn cục với các file khác,
// thứ tự nạp nằm trong index.html.

// ---------- Status ----------
function setStatus(msg, kind = '') {
  statusEl.textContent = msg || '';
  statusEl.className = 'status' + (kind ? ' ' + kind : '');
}
function setPageStat(el, msg, kind = '') {
  el.textContent = msg || '';
  el.className = 'pstat' + (kind ? ' ' + kind : '');
}

// ---------- Config (skills) ----------
async function loadConfig() {
  try {
    const r = await fetch('/api/config');
    const cfg = await r.json();
    skillEl.innerHTML = (cfg.skills || [])
      .map((s) => `<option value="${s.key}">${s.label}</option>`).join('');
    if (skillEl.dataset.want) { skillEl.value = skillEl.dataset.want; }
  } catch {
    skillEl.innerHTML = '<option value="fitness">Fitness &amp; Health</option><option value="ld">Learning &amp; Development</option>';
  }
}

// ---------- Open & render PDF ----------
async function openFile(file) {
  const id = makeId(file.name, file.size);
  const lib = loadLibrary();
  const known = lib.some((d) => d.id === id);
  // Đã đủ 3 tài liệu và đây là file mới → chặn, mời gỡ bớt trước
  if (!known && lib.length >= MAX_DOCS) {
    setStatus(`Thư viện đã đủ ${MAX_DOCS} tài liệu. Hãy gỡ bớt một tài liệu rồi mở lại.`, 'error');
    return;
  }
  const ab = await file.arrayBuffer();
  // Lưu file vào thư viện để mở lại bất cứ lúc nào (không rời máy bạn — nằm trong trình duyệt).
  try { await idbSet(id, { id, name: file.name, size: file.size, bytes: ab }); } catch {}
  upsertLibrary({ id, name: file.name, size: file.size, needsFile: false });
  localStorage.setItem(LAST_DOC_KEY, id);
  await openFromBytes(ab, file.name, file.size, false);
  renderLibrary();
}

async function openFromBytes(ab, name, size, restoring) {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
  pdfDoc = pdf;

  // Đừng lưu vị trí trong lúc dựng/khôi phục tài liệu: khi đổi tài liệu (đang cuộn
  // sâu), một lần lưu bị hẹn giờ có thể ghi đè trang đang đọc của tài liệu MỚI bằng
  // vị trí cuộn tạm thời (thường là trang cuối) → mở lại bị nhảy xuống cuối.
  suppressScrollSave = true;
  if (scrollTimer) { clearTimeout(scrollTimer); scrollTimer = null; }
  if (ovScrollTimer) { clearTimeout(ovScrollTimer); ovScrollTimer = null; }

  docTitle = name.replace(/\.pdf$/i, '');
  docId = `${name}::${size}`;
  resetFind(); // kết quả tìm của tài liệu trước không còn đúng nữa
  document.body.classList.add('reading');
  const saved = loadTranslations(docId);
  NOTE = loadNotes(docId); // bookmark + highlight + ghi chú của tài liệu này

  // reset UI
  renderErrorShown = false; // tài liệu mới → cho phép báo lỗi vẽ lại từ đầu
  pages.length = 0;
  [...pagesEl.querySelectorAll('.orig, .trans')].forEach((n) => n.remove());
  if (overlayObserver) { overlayObserver.disconnect(); overlayObserver = null; }
  overlayPages.length = 0;
  overlayEl.innerHTML = '';
  emptyEl.hidden = true;
  pagesEl.hidden = viewMode === 'overlay';

  setStatus(`Đang mở ${pdf.numPages} trang…`);

  // Tỉ lệ khung trang (dùng trang 1 làm mặc định để chừa đúng chỗ trước khi vẽ)
  let defAspect = 1.414; // A4 dọc mặc định
  try {
    const v = (await pdf.getPage(1)).getViewport({ scale: 1 });
    defAspect = v.height / v.width;
  } catch {}

  // Dựng khung tất cả các trang NGAY (không vẽ, không trích chữ) → mở gần như tức thì.
  // Canvas được chừa đúng chiều cao qua reserveAll(); pixel vẽ trễ khi cuộn tới.
  const frag = document.createDocumentFragment();
  for (let i = 1; i <= pdf.numPages; i++) {
    // --- left: original ---
    const orig = document.createElement('div');
    orig.className = 'orig';
    const tag = document.createElement('div');
    tag.className = 'pagetag';
    const tagTxt = document.createElement('span');
    tagTxt.textContent = `Trang ${i} / ${pdf.numPages}`;
    tag.append(tagTxt, makeBookmarkBtn(i - 1));
    const canvas = document.createElement('canvas');
    // Canvas nằm trong khung định vị để lớp highlight đè đúng lên trang
    const cwrap = document.createElement('div');
    cwrap.className = 'canvas-wrap';
    const hlLayer = document.createElement('div');
    hlLayer.className = 'hl-layer';
    hlLayer.dataset.p = String(i - 1);
    // Lớp riêng cho vệt "tìm thấy" — nằm trên lớp bôi vàng, không chắn chuột
    const findLayer = document.createElement('div');
    findLayer.className = 'find-layer';
    cwrap.append(canvas, hlLayer, findLayer);
    orig.append(tag, cwrap);
    frag.appendChild(orig);

    // --- right: translation ---
    const trans = document.createElement('div');
    trans.className = 'trans';
    const bar = document.createElement('div');
    bar.className = 'trans-toolbar';
    const pnum = document.createElement('span');
    pnum.className = 'pnum';
    pnum.textContent = `Trang ${i}`;
    const bmT = makeBookmarkBtn(i - 1);
    const retro = document.createElement('button');
    retro.className = 'retro';
    retro.type = 'button';
    retro.textContent = 'Dịch lại';
    const pstat = document.createElement('span');
    pstat.className = 'pstat';
    const blocksEl = document.createElement('div');
    blocksEl.className = 'blocks';
    bar.append(pnum, bmT, retro, pstat);
    trans.append(bar, blocksEl);
    frag.appendChild(trans);

    const entry = {
      index: i - 1, pageNum: i, canvas,
      origEl: orig, transEl: trans, hlLayer, findLayer,
      sourceText: null, // trích chữ trễ (chỉ khi cần dịch)
      findSrc: null,    // chữ + toạ độ từng mẩu chữ, để tìm kiếm (trích trễ)
      blocks: normalizeBlocks(saved[i - 1]), blocksEl, statEl: pstat,
      aspect: defAspect, rendered: false, renderSig: '', renderingSig: null,
    };
    orig._entry = entry;
    pages.push(entry);
    renderBlocks(entry);

    // restore saved translation
    if (entryHasContent(entry)) setPageStat(pstat, 'đã lưu', 'done');

    retro.addEventListener('click', () => translateOne(entry, true));
  }
  pagesEl.appendChild(frag);

  reserveAll();            // chừa đúng chiều cao mỗi trang → nhảy tới trang đang đọc là chuẩn ngay
  setupRenderObserver();   // vẽ trang theo nhu cầu khi cuộn tới (nhanh + nhẹ RAM)
  for (const e of pages) paintRectLayer(e.hlLayer, e.index, e.aspect, 'orig');
  // Mục lục nhúng trong PDF → chương (chạy nền, xong thì vẽ lại ngăn kéo)
  initChapters().then(() => { renderScopeSelect(); renderDrawer(); });
  setNotesEnabled(true);
  renderDrawer();

  setStatus(restoring ? `Đã mở lại ${pdf.numPages} trang (phiên trước).` : `Đã mở ${pdf.numPages} trang.`, 'done');
  translateBtn.disabled = false;
  exportBtn.disabled = false;
  closeBtn.disabled = false;
  expandBtn.disabled = false;
  if (expandBtnM) expandBtnM.disabled = false;

  // Khôi phục đúng TRANG đang đọc dở (thử vài lần để tránh layout/font dịch chuyển)
  const savedPage = Number(localStorage.getItem(pageKey(docId)) || 0);
  pageTotalEl.textContent = String(pdf.numPages);
  pageInput.max = String(pdf.numPages);
  pageInput.disabled = false;
  pageInput.value = String(Math.min(pdf.numPages, savedPage + 1));
  bookIndex = savedPage;
  if (viewMode === 'overlay') {
    pagesEl.hidden = true;
    bookEl.hidden = true;
    overlayEl.hidden = false;
    renderOverlay(savedPage);
  } else if (readMode === 'book') {
    setReadMode('book');
    suppressScrollSave = false; // chế độ sách tự quản vị trí, gỡ cờ chặn
  } else restoreReadingPosition(savedPage);
}

// ---------- Vẽ canvas theo nhu cầu (lazy): chỉ vẽ trang gần khung nhìn ----------
// Chiều rộng (CSS px) một trang sẽ chiếm — mọi .orig cùng chế độ đều bằng nhau
function colBoxWidth() {
  const w = pages.length ? (pages[0].origEl.clientWidth || 480) : 480;
  return Math.max(200, w) * zoom;
}
// Chữ ký kích thước để biết canvas đã vẽ có còn hợp lệ không (đổi zoom/độ rộng → vẽ lại)
function renderSigFor() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  return Math.round(colBoxWidth()) + 'x' + dpr;
}
// Chừa chỗ (chiều cao) cho một trang chưa vẽ, đúng bằng khổ khi vẽ xong → không giật layout
function reservePlaceholder(e, boxW) {
  if (!e.canvas) return;
  e.canvas.style.width = boxW + 'px';
  e.canvas.style.height = (boxW * e.aspect) + 'px';
}
// Chừa lại chỗ cho MỌI trang theo layout/zoom hiện tại và đánh dấu cần vẽ lại
function reserveAll() {
  if (!pdfDoc || viewMode === 'trans' || readMode === 'book') return;
  const boxW = colBoxWidth();
  for (const e of pages) { e.rendered = false; e.renderSig = ''; reservePlaceholder(e, boxW); }
}
// Vẽ pixel cho một trang nếu chưa vẽ / kích thước đã đổi
async function ensureRendered(e) {
  if (!pdfDoc || viewMode === 'trans' || readMode === 'book') return;
  if (!e.origEl || e.origEl.clientWidth < 10) return; // đang ẩn thì bỏ qua
  const sig = renderSigFor();
  if (e.rendered && e.renderSig === sig) return;
  if (e.renderingSig === sig) return; // đang vẽ dở đúng kích thước này
  // Kích thước đổi giữa chừng (đổi chế độ xem, mở ngăn kéo, nhảy tới kết quả tìm…):
  // phải HUỶ nét vẽ đang dở, vì pdf.js không cho hai lượt vẽ cùng một canvas —
  // gặp vậy nó ném lỗi và trang trơ ra một ô trắng.
  if (e.renderTask) { try { e.renderTask.cancel(); } catch {} e.renderTask = null; }
  e.renderingSig = sig;
  let task = null;
  try {
    const page = await pdfDoc.getPage(e.pageNum);
    const v = page.getViewport({ scale: 1 });
    e.aspect = v.height / v.width; // tỉ lệ thật của trang (phòng trang khác khổ)
    await renderPage(page, e.canvas, e.origEl, (t) => { task = t; e.renderTask = t; });
    e.rendered = true;
    e.renderSig = sig;
    paintRectLayer(e.hlLayer, e.index, e.aspect, 'orig'); // vệt bôi theo đúng tỉ lệ trang
    paintFindLayer(e);                                    // vệt tìm thấy cũng theo tỉ lệ đó
  } catch (err) {
    // Mình chủ động huỷ để vẽ lại cho đúng khổ → không phải lỗi, đừng làm phiền.
    if (!err || err.name !== 'RenderingCancelledException') reportRenderError(e.pageNum, err);
  }
  finally {
    // Chỉ dọn cờ của CHÍNH lượt vẽ này, đừng dọn nhầm lượt vẽ mới hơn
    if (e.renderingSig === sig) e.renderingSig = null;
    if (task && e.renderTask === task) e.renderTask = null;
  }
}
// Vẽ những trang đang (gần) trong khung nhìn
function renderVisible() {
  if (!pdfDoc || viewMode === 'trans' || readMode === 'book') return;
  const vh = window.innerHeight;
  const m = vh; // chừa 1 màn hình trên/dưới
  for (const e of pages) {
    if (!e.origEl) continue;
    const r = e.origEl.getBoundingClientRect();
    if (r.bottom > -m && r.top < vh + m) ensureRendered(e);
  }
}
// Quan sát cuộn để tự vẽ trang khi tới gần
function setupRenderObserver() {
  if (renderObserver) renderObserver.disconnect();
  renderObserver = new IntersectionObserver((ents) => {
    for (const it of ents) {
      if (it.isIntersecting && it.target._entry) ensureRendered(it.target._entry);
    }
  }, { rootMargin: '1200px 0px' });
  for (const e of pages) renderObserver.observe(e.origEl);
}

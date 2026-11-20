'use strict';
// Chế độ xem, chế độ Đọc sách, phóng to / thu nhỏ.
// Script thường (không phải module): dùng chung phạm vi toàn cục với các file khác,
// thứ tự nạp nằm trong index.html.

// ---------- Chế độ xem ----------
function applyScrollLayout(keep) {
  pagesEl.className = 'pages' + (viewMode !== 'both' ? ' mode-' + viewMode : '');
  // rAF để layout (đổi độ rộng cột theo chế độ) áp dụng xong rồi mới đo/chừa chỗ
  requestAnimationFrame(() => {
    if (pdfDoc && viewMode !== 'trans') reserveAll(); // chừa chiều cao theo layout mới
    if (docId && pages.length) {
      scrollToPage(keep);
      localStorage.setItem(pageKey(docId), String(keep));
    }
    renderVisible();
  });
}

// Trang đang xem hiện tại theo đúng chế độ hiện hành (để giữ vị trí khi đổi chế độ).
function getCurrentPageIndex() {
  if (viewMode === 'overlay') return overlayPages.length ? overlayCurrentTop() : 0;
  if (readMode === 'book') return bookIndex;
  if (docId && pages.length) return currentTopPage();
  return 0;
}

function setMode(mode) {
  const keep = getCurrentPageIndex();
  viewMode = mode;
  localStorage.setItem('ptr.mode', mode);
  [...viewmodeEl.querySelectorAll('.seg')].forEach((b) =>
    b.classList.toggle('active', b.dataset.mode === mode));

  // "Đè trang": mặt phẳng riêng, không dùng bố cục cột hay chế độ đọc sách.
  if (mode === 'overlay') {
    pagesEl.hidden = true;
    bookEl.hidden = true;
    overlayEl.hidden = !pdfDoc;
    if (pdfDoc) renderOverlay(keep);
    return;
  }
  overlayEl.hidden = true;

  if (readMode === 'book') {
    pagesEl.hidden = true;
    bookEl.hidden = !pdfDoc;
    transSig = ''; // buộc dàn lại nếu chuyển sang bản dịch
    if (docId) bookIndex = Number(localStorage.getItem((mode === 'trans' ? tPageKey : pageKey)(docId)) || 0);
    if (pdfDoc) renderBook();
    return;
  }
  bookEl.hidden = true;
  pagesEl.hidden = !pdfDoc;
  applyScrollLayout(keep);
}

// ---------- Chế độ Đọc sách ----------
// Gom toàn bộ khối bản dịch của mọi trang thành một dòng chảy (chữ + ảnh) theo thứ tự
function allBlocks() {
  const out = [];
  for (const p of pages) {
    for (const b of p.blocks) {
      if (b.type === 'text') {
        const t = (b.text || '').trim();
        if (t) out.push({ type: 'text', text: t });
      } else if (b.type === 'image' && b.src) {
        out.push({ type: 'image', src: b.src, w: b.w || 0, h: b.h || 0, widthPct: b.widthPct || 1 });
      }
    }
  }
  return out;
}
// Chữ ký nội dung để biết có cần dàn lại trang không
function blocksSignature(blocks) {
  let s = '';
  for (const b of blocks) s += b.type === 'text' ? ('t' + b.text.length) : ('i' + (b.src ? b.src.length : 0));
  return s + '#' + blocks.length;
}

// Dàn dòng chảy khối thành từng trang. Chữ có thể cắt sang trang mới; ảnh là
// một khối nguyên (tự co để vừa khổ trang). Mỗi trang trả về là danh sách mảnh
// { type:'text', text } | { type:'image', src, w, h } với w/h là kích thước hiển thị.
function paginateBlocks(blocks, contentW, contentH, fontPx, lineH) {
  measEl.style.width = contentW + 'px';
  measEl.style.fontFamily = getComputedStyle(document.body).fontFamily;
  measEl.style.fontSize = fontPx + 'px';
  measEl.style.lineHeight = String(lineH);
  const measure = (t) => { measEl.textContent = t; return measEl.scrollHeight; };
  const gap = Math.round(fontPx * 0.7); // khoảng cách giữa hai khối
  const out = [];
  let cur = [];
  let used = 0;
  const flush = () => { if (cur.length) { out.push(cur); cur = []; used = 0; } };
  const gapNow = () => (cur.length ? gap : 0);

  for (const block of blocks) {
    if (block.type === 'image') {
      let dw = contentW * clampPct(block.widthPct);
      let dh = block.w ? (block.h * dw / block.w) : Math.min(contentH, dw);
      if (dh > contentH) { dw = dw * (contentH / dh); dh = contentH; } // cao quá 1 trang → co lại
      if (cur.length && used + gapNow() + dh > contentH) flush();
      used += gapNow() + dh;
      cur.push({ type: 'image', src: block.src, w: Math.round(dw), h: Math.round(dh) });
    } else {
      const toks = block.text.split(/(\s+)/);
      const join = (a, b) => toks.slice(a, b).join('');
      let i = 0;
      while (i < toks.length) {
        const avail = contentH - used - gapNow();
        if (cur.length && avail < fontPx * lineH) { flush(); continue; } // hết chỗ → sang trang
        let lo = i + 1, hi = toks.length, fit = i + 1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (measure(join(i, mid)) <= Math.max(avail, fontPx * lineH)) { fit = mid; lo = mid + 1; }
          else hi = mid - 1;
        }
        if (fit <= i) fit = i + 1;                       // luôn tiến ít nhất 1 token
        const piece = join(i, fit).replace(/^\s+/, '');
        used += gapNow() + measure(piece);
        cur.push({ type: 'text', text: piece });
        i = fit;
        if (i < toks.length) flush();                    // còn dư chữ → sang trang mới
      }
    }
  }
  flush();
  return out.length ? out : [[{ type: 'text', text: '' }]];
}

// Điện thoại: đọc sách chỉ 1 trang/màn hình (2 trang sẽ quá bé)
const isMobile = () => window.matchMedia('(max-width: 720px)').matches;

function bookGeometry() {
  const fs = !!document.fullscreenElement;
  const topbarH = fs ? 0 : document.querySelector('.topbar').offsetHeight;
  const stageH = Math.max(360, window.innerHeight - topbarH - (fs ? 12 : 40));
  const stageW = bookStage.clientWidth || (window.innerWidth - 130);
  return { stageH, stageW };
}

function currentBookMode() {
  if (viewMode === 'trans') return 'trans';
  if (viewMode === 'orig') return 'orig';
  return 'none'; // song ngữ
}
function bookTotal() {
  if (viewMode === 'trans') return transPages.length;
  if (viewMode === 'orig') return pdfDoc ? pdfDoc.numPages : 0;
  return 0;
}

// Hai trang sách dùng đi dùng lại đúng hai canvas: lật nhanh hoặc vẽ lại giữa
// chừng thì phải huỷ nét vẽ cũ trước, không pdf.js sẽ báo lỗi trùng canvas.
const bookTasks = new WeakMap();
async function renderBookPage(canvas, pageNum, maxW, maxH) {
  const prev = bookTasks.get(canvas);
  if (prev) { try { prev.cancel(); } catch {} bookTasks.delete(canvas); }
  const page = await pdfDoc.getPage(pageNum);
  const base = page.getViewport({ scale: 1 });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const fit = Math.max(0.1, Math.min(maxW / base.width, maxH / base.height) * zoom);
  const viewport = page.getViewport({ scale: fit * dpr });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = (viewport.width / dpr) + 'px';
  canvas.style.height = (viewport.height / dpr) + 'px';
  const task = page.render({ canvasContext: canvas.getContext('2d'), viewport });
  bookTasks.set(canvas, task);
  try {
    await task.promise;
  } catch (err) {
    if (!err || err.name !== 'RenderingCancelledException') throw err;
  } finally {
    if (bookTasks.get(canvas) === task) bookTasks.delete(canvas);
  }
}

// ---- Đọc sách: BẢN GỐC (ảnh trang) ----
let bookToken = 0;
async function renderBookOriginal() {
  bookMsg.hidden = true;
  bookTextLeft.hidden = true;
  bookTextRight.hidden = true;
  const token = ++bookToken;
  const total = pdfDoc.numPages;
  bookIndex = Math.min(Math.max(0, bookIndex), total - 1);
  const leftNum = bookIndex + 1;
  const rightNum = bookIndex + 2;

  const { stageH, stageW } = bookGeometry();
  const hasRight = !isMobile() && rightNum <= total; // điện thoại: 1 trang
  const cols = hasRight ? 2 : 1;
  const halfW = Math.max(160, (stageW - (cols === 2 ? 14 : 0)) / cols);

  await renderBookPage(bookLeftCanvas, leftNum, halfW, stageH);
  if (token !== bookToken) return;
  paintRectsOnCanvas(bookLeftCanvas.getContext('2d'), leftNum - 1, bookLeftCanvas.width, 'orig');
  paintFindOnCanvas(bookLeftCanvas.getContext('2d'), leftNum - 1, bookLeftCanvas.width);
  bookLeftCanvas.hidden = false;
  if (hasRight) {
    bookRightCanvas.hidden = false;
    await renderBookPage(bookRightCanvas, rightNum, halfW, stageH);
    if (token !== bookToken) return;
    paintRectsOnCanvas(bookRightCanvas.getContext('2d'), rightNum - 1, bookRightCanvas.width, 'orig');
    paintFindOnCanvas(bookRightCanvas.getContext('2d'), rightNum - 1, bookRightCanvas.width);
  } else {
    bookRightCanvas.hidden = true;
  }

  pageTotalEl.textContent = String(total);
  pageInput.max = String(total);
  pageInput.value = String(leftNum);
  if (docId) localStorage.setItem(pageKey(docId), String(bookIndex));
  bookPrevBtn.disabled = bookIndex <= 0;
  bookNextBtn.disabled = bookIndex >= total - 1;
}

// ---- Đọc sách: BẢN DỊCH (chữ, tự dàn sang trang mới khi dài) ----
function applyPageStyle(el, pageW, pageH, padX, padY, fontPx, lineH) {
  el.style.width = pageW + 'px';
  el.style.height = pageH + 'px';
  el.style.padding = padY + 'px ' + padX + 'px';
  el.style.fontSize = fontPx + 'px';
  el.style.lineHeight = String(lineH);
}
// Đổ các mảnh (chữ/ảnh) của một trang sách vào phần tử trang
function fillBookPage(el, fragments, pageW, pageH, padX, padY, fontPx, lineH) {
  applyPageStyle(el, pageW, pageH, padX, padY, fontPx, lineH);
  el.innerHTML = '';
  const gap = Math.round(fontPx * 0.7);
  fragments.forEach((f, idx) => {
    let node;
    if (f.type === 'image') {
      node = document.createElement('img');
      node.src = f.src;
      node.style.width = f.w + 'px';
      node.style.height = f.h + 'px';
    } else {
      node = document.createElement('div');
      node.className = 'book-frag-text';
      // Đang tìm chữ thì tô luôn trên trang sách (chữ ở đây đã dàn lại nên không
      // dùng được vị trí ký tự của khối gốc — dò thẳng trên đúng mẩu chữ này).
      if (FIND.qf) node.innerHTML = highlightFindHtml(f.text);
      else node.textContent = f.text;
    }
    if (idx > 0) node.style.marginTop = gap + 'px';
    el.appendChild(node);
  });
}
function renderBookTranslation() {
  bookLeftCanvas.hidden = true;
  bookRightCanvas.hidden = true;

  const blocks = allBlocks();
  if (!blocks.length) {
    transPages = [];
    bookTextLeft.hidden = true;
    bookTextRight.hidden = true;
    bookMsg.hidden = false;
    bookMsg.textContent = 'Chưa có bản dịch. Bấm “Dịch tài liệu” trước, rồi quay lại chế độ đọc sách.';
    pageTotalEl.textContent = '—';
    bookPrevBtn.disabled = true;
    bookNextBtn.disabled = true;
    return;
  }
  bookMsg.hidden = true;

  const single = isMobile(); // điện thoại: 1 trang rộng hết khổ
  const { stageH, stageW } = bookGeometry();
  let pageW = Math.min(stageH * 0.72, single ? stageW : (stageW - 14) / 2);
  const pageH = Math.min(stageH, pageW / 0.72);
  const padX = Math.round(pageW * 0.09);
  const padY = Math.round(pageH * 0.07);
  const lineH = 1.62;
  const fontPx = Math.max(12, Math.min(26, pageW * 0.033)) * zoom;
  const contentW = pageW - 2 * padX;
  const contentH = pageH - 2 * padY;

  const sig = [blocksSignature(blocks), Math.round(contentW), Math.round(contentH), Math.round(fontPx * 10)].join('|');
  if (sig !== transSig) {
    transPages = paginateBlocks(blocks, contentW, contentH, fontPx, lineH);
    transSig = sig;
  }
  const total = transPages.length;
  bookIndex = Math.min(Math.max(0, bookIndex), total - 1);

  fillBookPage(bookTextLeft, transPages[bookIndex] || [], pageW, pageH, padX, padY, fontPx, lineH);
  bookTextLeft.hidden = false;

  const rightIdx = bookIndex + 1;
  if (!single && rightIdx < total) {
    fillBookPage(bookTextRight, transPages[rightIdx], pageW, pageH, padX, padY, fontPx, lineH);
    bookTextRight.hidden = false;
  } else {
    bookTextRight.hidden = true;
  }

  pageTotalEl.textContent = String(total);
  pageInput.max = String(total);
  pageInput.value = String(bookIndex + 1);
  if (docId) localStorage.setItem(tPageKey(docId), String(bookIndex));
  bookPrevBtn.disabled = bookIndex <= 0;
  bookNextBtn.disabled = bookIndex >= total - 1;
}

function renderBookNone() {
  bookLeftCanvas.hidden = true;
  bookRightCanvas.hidden = true;
  bookTextLeft.hidden = true;
  bookTextRight.hidden = true;
  bookMsg.hidden = false;
  bookMsg.textContent = 'Chế độ “Song ngữ” không đọc kiểu sách được. Hãy chọn “Bản gốc” hoặc “Bản dịch”.';
  pageTotalEl.textContent = '—';
  bookPrevBtn.disabled = true;
  bookNextBtn.disabled = true;
}

async function renderBook() {
  if (!pdfDoc) return;
  const m = currentBookMode();
  if (m === 'orig') return renderBookOriginal();
  if (m === 'trans') return renderBookTranslation();
  return renderBookNone();
}

function buildFlipFromEl(srcEl, dir) {
  const stageRect = bookStage.getBoundingClientRect();
  const r = srcEl.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'book-flip ' + dir;
  el.style.left = (r.left - stageRect.left) + 'px';
  el.style.top = (r.top - stageRect.top) + 'px';
  el.style.width = r.width + 'px';
  el.style.height = r.height + 'px';
  el.style.transformOrigin = dir === 'next' ? 'left center' : 'right center';
  if (srcEl.tagName === 'CANVAS') {
    const c = document.createElement('canvas');
    c.width = srcEl.width; c.height = srcEl.height;
    c.getContext('2d').drawImage(srcEl, 0, 0);
    c.style.width = '100%'; c.style.height = '100%';
    el.appendChild(c);
  } else {
    const clone = srcEl.cloneNode(true);
    clone.removeAttribute('id');
    clone.hidden = false;
    clone.style.width = '100%';
    clone.style.height = '100%';
    clone.style.boxShadow = 'none';
    el.appendChild(clone);
  }
  const shade = document.createElement('div');
  shade.className = 'book-flip-shade';
  el.appendChild(shade);
  bookStage.appendChild(el);
  return el;
}
function animateFlip(el, dir) {
  const end = dir === 'next' ? -170 : 170;
  const shade = el.querySelector('.book-flip-shade');
  const a = el.animate(
    [{ transform: 'rotateY(0deg)' }, { transform: `rotateY(${end}deg)` }],
    { duration: 620, easing: 'cubic-bezier(.36,.06,.28,1)' }
  );
  if (shade) shade.animate(
    [{ opacity: 0 }, { opacity: 0.55, offset: 0.5 }, { opacity: 0 }],
    { duration: 620, easing: 'ease-in-out' }
  );
  const done = () => el.remove();
  a.onfinish = done;
  a.oncancel = done;
}
async function bookGo(delta) {
  if (!pdfDoc) return;
  const m = currentBookMode();
  if (m === 'none') return;
  const total = bookTotal();
  if (!total) return;
  const ni = Math.min(Math.max(0, bookIndex + delta), total - 1);
  if (ni === bookIndex) return;
  const dir = delta > 0 ? 'next' : 'prev';
  const single = isMobile(); // 1 trang: chỉ có trang trái đang hiện để lật
  const src = m === 'orig'
    ? (single ? bookLeftCanvas : (dir === 'next' ? bookRightCanvas : bookLeftCanvas))
    : (single ? bookTextLeft : (dir === 'next' ? bookTextRight : bookTextLeft));
  const canFlip = src && !src.hidden;
  const snap = canFlip ? buildFlipFromEl(src, dir) : null;
  bookIndex = ni;
  await renderBook();
  if (snap) animateFlip(snap, dir);
}

async function toggleBookFullscreen() {
  if (!pdfDoc) return;
  if (document.fullscreenElement) { document.exitFullscreen(); return; }
  if (readMode !== 'book') setReadMode('book');
  try { await bookEl.requestFullscreen(); }
  catch { setStatus('Trình duyệt không cho vào toàn màn hình.', 'error'); }
}

function setReadMode(mode) {
  readMode = mode;
  localStorage.setItem('ptr.readmode', mode);
  document.body.classList.toggle('read-book', mode === 'book');
  [...readmodeEl.querySelectorAll('.seg')].forEach((b) =>
    b.classList.toggle('active', b.dataset.read === mode));

  // Chế độ "Đè trang" không phân biệt Kéo lướt / Đọc sách — giữ nguyên mặt phẳng đè.
  if (viewMode === 'overlay') {
    pagesEl.hidden = true;
    bookEl.hidden = true;
    overlayEl.hidden = !pdfDoc;
    return;
  }
  overlayEl.hidden = true;

  if (mode === 'book') {
    pagesEl.hidden = true;
    transSig = '';
    if (docId) bookIndex = Number(localStorage.getItem((viewMode === 'trans' ? tPageKey : pageKey)(docId)) || 0);
    bookEl.hidden = !pdfDoc;
    if (pdfDoc) renderBook();
  } else {
    bookEl.hidden = true;
    pagesEl.hidden = !pdfDoc;
    const keep = docId ? Number(localStorage.getItem(pageKey(docId)) || 0) : 0;
    if (pdfDoc) {
      pageTotalEl.textContent = String(pdfDoc.numPages);
      pageInput.max = String(pdfDoc.numPages);
      pageInput.value = String(keep + 1);
      applyScrollLayout(keep);
    }
  }
}

// ---------- Phóng to / thu nhỏ ----------
function applyZoomVar() {
  pagesEl.style.setProperty('--zoom', String(zoom));
  zoomLevelEl.textContent = Math.round(zoom * 100) + '%';
}
function setZoom(next) {
  const keep = getCurrentPageIndex();
  zoom = Math.min(3, Math.max(0.5, Math.round(next * 100) / 100));
  applyZoomVar();
  localStorage.setItem('ptr.zoom', String(zoom));
  if (viewMode === 'overlay') {
    if (pdfDoc) {
      for (const e of overlayPages) e.composed = false;
      requestAnimationFrame(() => { scrollOverlayToPage(keep); composeVisibleOverlay(); });
    }
    return;
  }
  if (readMode === 'book') { if (pdfDoc) renderBook(); return; }
  if (pdfDoc && viewMode !== 'trans') {
    reserveAll(); // đổi zoom → chừa lại chiều cao theo khổ mới
    if (docId && pages.length) scrollToPage(keep);
    renderVisible();
  } else if (docId && pages.length) {
    requestAnimationFrame(() => scrollToPage(keep));
  }
}

'use strict';
// Ngăn kéo bên phải (danh sách bookmark, highlight).
// Script thường (không phải module): dùng chung phạm vi toàn cục với các file khác,
// thứ tự nạp nằm trong index.html.

// ---------- Ngăn kéo ----------
function drawerOpen() { return !drawerEl.hidden; }
function setDrawer(open) {
  const keep = getCurrentPageIndex();
  drawerEl.hidden = !open;
  document.body.classList.toggle('drawer-open', open);
  drawerBtn.setAttribute('aria-expanded', String(open));
  drawerBtn.classList.toggle('btn-primary', open);
  if (open) renderDrawer();
  else hideSelbar();
  relayoutWidth(keep); // khung đọc hẹp/rộng lại → dựng lại khổ trang cho khớp
}
function toggleDrawer() { setDrawer(!drawerOpen()); }
// Mở/đóng ngăn kéo làm đổi bề rộng cột đọc: chừa lại chiều cao và giữ đúng trang
function relayoutWidth(keep) {
  if (!pdfDoc) return;
  if (viewMode === 'overlay') {
    for (const e of overlayPages) e.composed = false;
    requestAnimationFrame(() => { scrollOverlayToPage(keep); composeVisibleOverlay(); });
    return;
  }
  if (readMode === 'book') { renderBook(); return; }
  requestAnimationFrame(() => {
    if (viewMode !== 'trans') reserveAll();
    if (pages.length) scrollToPage(keep);
    renderVisible();
    repaintAllRectLayers();
  });
}
function setNoteTab(tab) {
  noteTab = tab;
  [...drawerEl.querySelectorAll('.dtab')].forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $('paneFind').hidden = tab !== 'find';
  $('paneBm').hidden = tab !== 'bm';
  $('paneHl').hidden = tab !== 'hl';
  $('paneNote').hidden = tab !== 'note';
  renderDrawer();
}
function setNotesEnabled(on) {
  drawerBtn.disabled = !on;
  hlBtn.disabled = !on;
  findBtn.disabled = !on;
  if (!on && hlMode) setHlMode(false);
}
function renderDrawer() {
  if (!drawerOpen()) return;
  if (noteTab === 'find') renderFindList();
  else if (noteTab === 'bm') renderBmList();
  else if (noteTab === 'hl') { renderSwatches(); renderHlList(); }
  else { renderScopeSelect(); loadScopeIntoUI(); syncFollowScope(); }
}
function emptyMsg(text) {
  const d = document.createElement('div');
  d.className = 'list-empty';
  d.textContent = text;
  return d;
}
function renderBmList() {
  bmListEl.innerHTML = '';
  if (!docId) { bmListEl.appendChild(emptyMsg('Chưa mở tài liệu nào.')); return; }
  const list = NOTE.bookmarks.slice().sort((a, b) => a.p - b.p);
  if (!list.length) {
    bmListEl.appendChild(emptyMsg('Chưa có bookmark. Bấm ☆ trên một trang, dùng nút phía trên, hoặc bấm phím B khi đang đọc.'));
    return;
  }
  for (const bm of list) {
    const row = document.createElement('div');
    row.className = 'item';
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'item-go';
    go.innerHTML = `<span class="item-p">TRANG ${bm.p + 1}</span><span class="item-t">${escapeHtml(bm.label || `Trang ${bm.p + 1}`)}</span>`;
    go.addEventListener('click', () => { jumpToPage(bm.p); if (isMobile()) setDrawer(false); });
    const ren = document.createElement('button');
    ren.type = 'button';
    ren.className = 'item-x';
    ren.textContent = '✎';
    ren.title = 'Đổi tên bookmark';
    ren.addEventListener('click', async () => {
      const v = await promptDialog({ eyebrow: 'BOOKMARK', title: `Đặt tên cho trang ${bm.p + 1}`, label: 'Tên bookmark', value: bm.label || '' });
      if (v == null) return;
      bm.label = v || `Trang ${bm.p + 1}`;
      saveNotes();
      renderBmList();
    });
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'item-x';
    del.textContent = '✕';
    del.title = 'Bỏ bookmark';
    del.addEventListener('click', () => toggleBookmark(bm.p));
    row.append(go, ren, del);
    bmListEl.appendChild(row);
  }
}
function renderSwatches() {
  hlSwatchesEl.innerHTML = '';
  for (const c of Object.keys(HL_COLORS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sw' + (c === hlColor ? ' on' : '');
    b.innerHTML = `<i style="background:${HL_COLORS[c]}"></i>${HL_NAMES[c]}`;
    b.addEventListener('click', () => { hlColor = c; renderSwatches(); });
    hlSwatchesEl.appendChild(b);
  }
}
function renderHlList() {
  hlListEl.innerHTML = '';
  if (!docId) { hlListEl.appendChild(emptyMsg('Chưa mở tài liệu nào.')); return; }
  const list = NOTE.highlights.slice().sort((a, b) => a.p - b.p);
  if (!list.length) {
    hlListEl.appendChild(emptyMsg('Chưa bôi gì. Ở cột bản dịch: quét chọn chữ rồi chọn màu. Trên trang gốc: bật nút bôi rồi kéo một vùng.'));
    return;
  }
  for (const h of list) {
    const row = document.createElement('div');
    row.className = 'item';
    const dot = document.createElement('span');
    dot.className = 'item-dot';
    dot.style.background = HL_COLORS[h.c] || HL_COLORS.y;
    dot.title = HL_NAMES[h.c] || '';
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'item-go';
    const q = (h.q || '').trim();
    go.innerHTML = `<span class="item-p">TRANG ${h.p + 1}${h.k === 'r' ? (h.o ? ' · VÙNG (ĐÈ TRANG)' : ' · VÙNG (TRANG GỐC)') : ''}</span>` +
      `<span class="item-t quote">${q ? escapeHtml(q.slice(0, 160)) : '(vùng đã bôi)'}</span>`;
    go.addEventListener('click', () => { jumpToPage(h.p); if (isMobile()) setDrawer(false); });
    const send = document.createElement('button');
    send.type = 'button';
    send.className = 'item-x';
    send.textContent = '→';
    send.title = 'Gửi vào ghi chú Cornell';
    send.addEventListener('click', () => sendHlToNote(h));
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'item-x';
    del.textContent = '✕';
    del.title = 'Xoá vệt bôi';
    del.addEventListener('click', () => removeHl(h.id));
    row.append(dot, go, send, del);
    hlListEl.appendChild(row);
  }
}

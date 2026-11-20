'use strict';
// Sự kiện của ngăn kéo, ghi chú, phím tắt.
// Script thường (không phải module): dùng chung phạm vi toàn cục với các file khác,
// thứ tự nạp nằm trong index.html.

// ---------- Sự kiện của ngăn kéo ----------
drawerBtn.addEventListener('click', () => { closeNav(); toggleDrawer(); });
drawerCloseBtn.addEventListener('click', () => setDrawer(false));
drawerWideBtn.addEventListener('click', () => {
  const keep = getCurrentPageIndex();
  const wide = !document.body.classList.contains('drawer-wide');
  document.body.classList.toggle('drawer-wide', wide);
  drawerEl.classList.toggle('drawer-wide', wide);
  drawerWideBtn.setAttribute('aria-pressed', String(wide));
  relayoutWidth(keep);
});
drawerEl.addEventListener('click', (e) => {
  const t = e.target.closest('.dtab');
  if (t) setNoteTab(t.dataset.tab);
});
hlBtn.addEventListener('click', () => { closeNav(); setHlMode(!hlMode); });
hlToggleBtn.addEventListener('click', () => setHlMode(!hlMode));
bmAddBtn.addEventListener('click', () => toggleBookmark(readingPageIndex()));

noteScopeEl.addEventListener('change', () => { loadScopeIntoUI(); setNoteStat(''); });
noteFollowBtn.addEventListener('click', () => {
  noteFollow = !noteFollow;
  noteFollowBtn.setAttribute('aria-pressed', String(noteFollow));
  noteFollowBtn.title = noteFollow ? 'Đang tự bám chương đang đọc' : 'Không tự đổi chương';
  if (noteFollow) syncFollowScope();
});
chapAddBtn.addEventListener('click', async () => {
  const p = readingPageIndex();
  if (p < 0) { setNoteStat('Không xác định được trang đang đọc ở chế độ này.'); return; }
  if (NOTE.chapters.some((c) => c.from === p)) { setNoteStat(`Trang ${p + 1} đã là mốc bắt đầu của một chương.`); return; }
  const name = await promptDialog({
    eyebrow: 'CẮT CHƯƠNG', title: `Chương mới bắt đầu từ trang ${p + 1}`,
    label: 'Tên chương', value: `Chương ${NOTE.chapters.length + 1}`,
  });
  if (name == null) return;
  NOTE.chapters.push({ id: uid(), title: name || `Chương ${NOTE.chapters.length + 1}`, from: p, src: 'manual' });
  flushNotes();
  renderScopeSelect();
  noteScopeEl.value = scopeForPage(p);
  loadScopeIntoUI();
  setNoteStat('Đã thêm mốc chương.');
});
chapRenBtn.addEventListener('click', async () => {
  const c = chapterById(curScope());
  if (!c) return;
  const name = await promptDialog({ eyebrow: 'ĐỔI TÊN', title: 'Đổi tên chương', label: 'Tên chương', value: c.title });
  if (name == null) return;
  c.title = name || c.title;
  flushNotes();
  renderScopeSelect();
  noteScopeEl.value = c.id;
});
chapDelBtn.addEventListener('click', async () => {
  const c = chapterById(curScope());
  if (!c) return;
  const st = NOTE.notes[c.id];
  const hasNote = st && ((st.cue || '').trim() || (st.note || '').trim() || (st.sum || '').trim());
  const ok = await confirmDialog({
    eyebrow: 'BỎ MỐC CHƯƠNG',
    title: `Bỏ mốc “${c.title}”?`,
    message: hasNote
      ? 'Ghi chú Cornell của chương này sẽ bị xoá theo.'
      : 'Chỉ bỏ mốc chia chương, không ảnh hưởng bản dịch.',
    okText: 'Bỏ mốc', cancelText: 'Giữ lại',
  });
  if (!ok) return;
  NOTE.chapters = NOTE.chapters.filter((x) => x.id !== c.id);
  delete NOTE.notes[c.id];
  flushNotes();
  noteScopeEl.value = DOC_SCOPE;
  renderScopeSelect();
  loadScopeIntoUI();
});
noteReviewBtn.addEventListener('click', () => {
  const on = !cornellEl.classList.contains('review');
  cornellEl.classList.toggle('review', on);
  cwEls.note.classList.remove('revealed');
  noteReviewBtn.setAttribute('aria-pressed', String(on));
  noteReviewBtn.classList.toggle('btn-primary', on);
  setNoteStat(on ? 'Ôn tập: cột NOTES bị che — tự trả lời theo CUE rồi bấm vào vùng mờ để đối chiếu.' : '');
});
cwEls.note.addEventListener('click', () => {
  if (cornellEl.classList.contains('review')) cwEls.note.classList.add('revealed');
});
noteSynthBtn.addEventListener('click', doSynth);
noteAIBtn.addEventListener('click', doSynthAI);
noteMdBtn.addEventListener('click', exportNotesMd);
notePdfBtn.addEventListener('click', exportNotesPdf);

for (const f of ['cue', 'note', 'sum']) {
  const el = cwEls[f];
  el.addEventListener('input', () => saveField(f));
  el.addEventListener('blur', () => { saveField(f); flushNotes(); el.innerHTML = noteToHtml(getNote(curScope())[f]); });
  // Dán luôn về chữ thuần để ô ghi chú không dính định dạng lạ từ nơi khác
  el.addEventListener('paste', (e) => {
    e.preventDefault();
    const t = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, t);
  });
  // Bấm "tr.12 ↗" → nhảy tới trang đó
  el.addEventListener('click', (e) => {
    const a = e.target.closest ? e.target.closest('.pref') : null;
    if (!a) return;
    e.preventDefault();
    jumpToPage(Number(a.dataset.p));
    if (isMobile()) setDrawer(false);
  });
}

// Ctrl+F / F3: tìm chữ ngay trong app thay vì hộp tìm của trình duyệt (trình duyệt
// chỉ thấy phần đang hiện trên màn hình, còn app tìm được cả tài liệu).
document.addEventListener('keydown', (e) => {
  if (!modalEl.hidden || !backupModalEl.hidden || !exportModalEl.hidden || !confirmEl.hidden || !promptEl.hidden) return;
  if (!pdfDoc) return; // chưa mở sách thì cứ để trình duyệt làm việc của nó
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    openFindPanel();
  } else if (e.key === 'F3') {
    e.preventDefault();
    if (FIND.results.length) findStep(e.shiftKey ? -1 : 1);
    else openFindPanel();
  }
});

// Phím tắt: F = tìm chữ, N = ngăn kéo, B = bookmark trang đang đọc, H = bật/tắt bôi,
// P = đồng hồ Pomodoro (chạy được cả khi chưa mở tài liệu)
document.addEventListener('keydown', (e) => {
  if (!modalEl.hidden || !backupModalEl.hidden || !exportModalEl.hidden || !confirmEl.hidden || !promptEl.hidden) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const ae = document.activeElement;
  if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'SELECT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
  if (e.key === 'Escape') {
    if (selCtx) { hideSelbar(); return; }
    if (hlMode) { setHlMode(false); return; }
    if (drawerOpen() && !document.fullscreenElement) { setDrawer(false); return; }
    return;
  }
  if (e.key.toLowerCase() === 'p') { e.preventDefault(); setPomoOpen(!POMO.open); return; }
  if (!pdfDoc) return;
  const k = e.key.toLowerCase();
  if (k === 'f') { e.preventDefault(); openFindPanel(); }
  else if (k === 'n') { e.preventDefault(); toggleDrawer(); }
  else if (k === 'b') { e.preventDefault(); toggleBookmark(readingPageIndex()); }
  else if (k === 'h') { e.preventDefault(); setHlMode(!hlMode); }
});

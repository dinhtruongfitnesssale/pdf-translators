'use strict';
// Nút "Giữ nguyên…": những gì KHÔNG dịch — tên khoa học, đơn vị, ký hiệu hoá học, tên viết tắt
// (bật sẵn) và danh sách từ/cụm người dùng tự thêm. Lưu trong trình duyệt (ptr.keep), gửi kèm
// mỗi lần dịch để server thêm vào lời nhắc cho AI (xem prompts.js → buildKeepRules).
// Script thường (không phải module): dùng chung phạm vi toàn cục với các file khác,
// thứ tự nạp nằm trong index.html.

const KEEP_KEY = 'ptr.keep';
const KEEP_MAX = 300; // số mục tối đa — danh sách dài quá làm lời nhắc nặng, tốn token

function loadKeep() {
  try {
    const k = JSON.parse(localStorage.getItem(KEEP_KEY) || '{}');
    return { sci: k.sci !== false, terms: Array.isArray(k.terms) ? k.terms.map(String) : [] };
  } catch { return { sci: true, terms: [] }; }
}
// "whey, mTOR\nBeef liver" → ['whey', 'mTOR', 'Beef liver'] (bỏ trùng, không phân biệt hoa thường)
function parseKeepTerms(s) {
  const seen = new Set(), out = [];
  for (const raw of String(s || '').split(/[\n,;]+/)) {
    const t = raw.trim().replace(/\s+/g, ' ');
    if (!t || t.length > 80 || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out;
}
// Phần gửi kèm request dịch
function keepPayload() {
  const k = loadKeep();
  return { keepSci: k.sci, keepTerms: k.terms.slice(0, KEEP_MAX) };
}
function updateKeepBtn() {
  const n = loadKeep().terms.length;
  keepBtn.textContent = n ? `Giữ nguyên (${n})…` : 'Giữ nguyên…';
}

function openKeepModal() {
  const k = loadKeep();
  keepSciEl.checked = k.sci;
  keepTermsEl.value = k.terms.join('\n');
  keepHintEl.textContent = '';
  keepHintEl.className = 'modal-hint';
  keepModalEl.hidden = false;
  keepTermsEl.focus();
}
function closeKeepModal() { keepModalEl.hidden = true; }
function saveKeepModal() {
  const terms = parseKeepTerms(keepTermsEl.value);
  if (terms.length > KEEP_MAX) {
    keepHintEl.textContent = `Danh sách có ${terms.length} mục — tối đa ${KEEP_MAX}. Bớt bớt rồi lưu lại nhé.`;
    keepHintEl.className = 'modal-hint error';
    return;
  }
  try { localStorage.setItem(KEEP_KEY, JSON.stringify({ sci: keepSciEl.checked, terms })); }
  catch {
    keepHintEl.textContent = 'Không lưu được (trình duyệt chặn lưu trữ).';
    keepHintEl.className = 'modal-hint error';
    return;
  }
  closeKeepModal();
  updateKeepBtn();
  setStatus(`Đã lưu: ${terms.length} thuật ngữ giữ nguyên` +
    (keepSciEl.checked ? ' + tên khoa học, đơn vị, ký hiệu' : '') +
    '. Áp dụng cho lần dịch tới — trang đã dịch thì bấm "Dịch lại".', 'done');
}

keepBtn.addEventListener('click', openKeepModal);
keepOkBtn.addEventListener('click', saveKeepModal);
keepCancelBtn.addEventListener('click', closeKeepModal);
keepModalEl.addEventListener('click', (e) => { if (e.target === keepModalEl) closeKeepModal(); });
keepTermsEl.addEventListener('input', () => {
  const n = parseKeepTerms(keepTermsEl.value).length;
  keepHintEl.className = n > KEEP_MAX ? 'modal-hint error' : 'modal-hint';
  keepHintEl.textContent = n ? `${n} mục` + (n > KEEP_MAX ? ` — tối đa ${KEEP_MAX}` : '') : '';
});
document.addEventListener('keydown', (e) => {
  if (keepModalEl.hidden) return;
  if (e.key === 'Escape') closeKeepModal();
  else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveKeepModal(); // Enter thường = xuống dòng
});
updateKeepBtn();

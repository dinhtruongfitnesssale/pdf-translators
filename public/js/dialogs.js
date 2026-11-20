'use strict';
// Hộp xác nhận / hộp nhập chữ thay cho confirm() / prompt().
// Script thường (không phải module): dùng chung phạm vi toàn cục với các file khác,
// thứ tự nạp nằm trong index.html.

// Hộp xác nhận theo bộ thương hiệu, thay cho confirm() mặc định của trình duyệt.
// Trả về Promise<boolean>. Đóng bằng Esc / bấm nền = Hủy.
function confirmDialog({ title, message = '', eyebrow = 'XÁC NHẬN', okText = 'Xóa', cancelText = 'Hủy', danger = true } = {}) {
  confirmEyebrowEl.textContent = eyebrow;
  confirmTitleEl.textContent = title;
  confirmMsgEl.textContent = message;
  confirmMsgEl.hidden = !message;
  confirmOkBtn.textContent = okText;
  confirmCancelBtn.textContent = cancelText;
  confirmOkBtn.className = danger ? 'btn btn-danger' : 'btn btn-primary';
  confirmEl.hidden = false;
  confirmOkBtn.focus();

  return new Promise((resolve) => {
    function cleanup(result) {
      confirmEl.hidden = true;
      confirmOkBtn.removeEventListener('click', onOk);
      confirmCancelBtn.removeEventListener('click', onCancel);
      confirmEl.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    function onBackdrop(e) { if (e.target === confirmEl) cleanup(false); }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); cleanup(false); }
      else if (e.key === 'Enter') { e.preventDefault(); cleanup(true); }
    }
    confirmOkBtn.addEventListener('click', onOk);
    confirmCancelBtn.addEventListener('click', onCancel);
    confirmEl.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey);
  });
}

// Hộp nhập một dòng (đặt tên chương…). Trả về Promise<string|null> — null = hủy.
function promptDialog({ title, label = 'Nội dung', value = '', eyebrow = 'NHẬP', okText = 'Xong' } = {}) {
  promptEyebrowEl.textContent = eyebrow;
  promptTitleEl.textContent = title;
  promptLabelEl.textContent = label;
  promptInputEl.value = value;
  promptOkBtn.textContent = okText;
  promptEl.hidden = false;
  promptInputEl.focus();
  promptInputEl.select();

  return new Promise((resolve) => {
    function cleanup(result) {
      promptEl.hidden = true;
      promptOkBtn.removeEventListener('click', onOk);
      promptCancelBtn.removeEventListener('click', onCancel);
      promptEl.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    }
    function onOk() { cleanup(promptInputEl.value.trim()); }
    function onCancel() { cleanup(null); }
    function onBackdrop(e) { if (e.target === promptEl) cleanup(null); }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); cleanup(null); }
      else if (e.key === 'Enter') { e.preventDefault(); cleanup(promptInputEl.value.trim()); }
    }
    promptOkBtn.addEventListener('click', onOk);
    promptCancelBtn.addEventListener('click', onCancel);
    promptEl.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey);
  });
}

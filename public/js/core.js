'use strict';
// Tham chiếu DOM và trạng thái dùng chung của cả app.
// Script thường (không phải module): dùng chung phạm vi toàn cục với các file khác,
// thứ tự nạp nằm trong index.html.

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const providerEl = $('provider');
const apiKeyEl = $('apiKey');
const modelEl = $('model');
const modelComboEl = $('modelCombo');
const modelArrowEl = $('modelArrow');
const modelMenuEl = $('modelMenu');
const skillEl = $('skill');
const rememberEl = $('rememberKey');
const toggleKeyEl = $('toggleKey');
const fileInput = $('fileInput');
const openBtn = $('openBtn');
const translateBtn = $('translateBtn');
const exportBtn = $('exportBtn');
const closeBtn = $('closeBtn');
const viewmodeEl = $('viewmode');
const readmodeEl = $('readmode');
const overlayEl = $('overlay');
const bookEl = $('book');
const bookStage = $('bookStage');
const bookLeftCanvas = $('bookLeft');
const bookRightCanvas = $('bookRight');
const bookTextLeft = $('bookTextLeft');
const bookTextRight = $('bookTextRight');
const bookMsg = $('bookMsg');
const bookPrevBtn = $('bookPrev');
const bookNextBtn = $('bookNext');

// Phần tử ẩn để đo chiều cao chữ khi dàn trang bản dịch
const measEl = document.createElement('div');
measEl.setAttribute('aria-hidden', 'true');
measEl.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;white-space:pre-wrap;word-break:break-word;box-sizing:border-box;';
document.body.appendChild(measEl);
const zoomInBtn = $('zoomIn');
const zoomOutBtn = $('zoomOut');
const zoomLevelEl = $('zoomLevel');
const pageInput = $('pageInput');
const pageTotalEl = $('pageTotal');
const expandBtn = $('expandBtn');
const bookExitBtn = $('bookExit');
const statusEl = $('status');
const emptyEl = $('empty');
const pagesEl = $('pages');
const keyhintEl = $('keyhint');
const libraryEl = $('library');
const topbarEl = document.querySelector('.topbar');
const menuToggle = $('menuToggle');
const expandBtnM = $('expandBtnM');
// Modal chọn phạm vi
const modalEl = $('modal');
const modalTotalEl = $('modalTotal');
const rangeFromEl = $('rangeFrom');
const rangeToEl = $('rangeTo');
const rangeAllEl = $('rangeAll');
const modalHintEl = $('modalHint');
const modalGoBtn = $('modalGo');
const modalCancelBtn = $('modalCancel');
// Xuất PDF Đè trang
const exportModalEl = $('exportModal');
const exTotalEl = $('exTotal');
const exChapterWrap = $('exChapterWrap');
const exChapterEl = $('exChapter');
const exFromEl = $('exFrom');
const exToEl = $('exTo');
const exTextEl = $('exText');
const exHintEl = $('exHint');
const exGoBtn = $('exGo');
const exCancelBtn = $('exCancel');
// Sao lưu / khôi phục
const backupBtn = $('backupBtn');
const restoreBtn = $('restoreBtn');
const restoreInput = $('restoreInput');
const backupModalEl = $('backupModal');
const backupSummaryEl = $('backupSummary');
const backupHintEl = $('backupHint');
const bkKeyEl = $('bkKey');
const bkPdfEl = $('bkPdf');
const backupGoBtn = $('backupGo');
const backupCancelBtn = $('backupCancel');
// Ngăn kéo Bookmark · Highlight · Ghi chú
const drawerEl = $('drawer');
const drawerBtn = $('drawerBtn');
// Tìm chữ
const findBtn = $('findBtn');
const findInput = $('findInput');
const findPrevBtn = $('findPrev');
const findNextBtn = $('findNext');
const findScopeEl = $('findScope');
const findStatEl = $('findStat');
const findListEl = $('findList');
const drawerCloseBtn = $('drawerClose');
const drawerWideBtn = $('drawerWide');
const hlBtn = $('hlBtn');
const hlToggleBtn = $('hlToggle');
const hlSwatchesEl = $('hlSwatches');
const bmAddBtn = $('bmAdd');
const bmListEl = $('bmList');
const hlListEl = $('hlList');
const selbarEl = $('selbar');
const noteScopeEl = $('noteScope');
const noteFollowBtn = $('noteFollow');
const chapAddBtn = $('chapAdd');
const chapRenBtn = $('chapRen');
const chapDelBtn = $('chapDel');
const noteReviewBtn = $('noteReview');
const noteSynthBtn = $('noteSynth');
const noteAIBtn = $('noteAI');
const noteMdBtn = $('noteMd');
const notePdfBtn = $('notePdf');
const noteStatEl = $('noteStat');
const cornellEl = $('cornell');
const cwEls = { cue: $('cwCue'), note: $('cwNote'), sum: $('cwSum') };
// Modal nhập một dòng
const promptEl = $('promptModal');
const promptEyebrowEl = $('promptEyebrow');
const promptTitleEl = $('promptTitle');
const promptLabelEl = $('promptLabel');
const promptInputEl = $('promptInput');
const promptOkBtn = $('promptOk');
const promptCancelBtn = $('promptCancel');
// Modal xác nhận (dùng chung)
const confirmEl = $('confirmModal');
const confirmEyebrowEl = $('confirmEyebrow');
const confirmTitleEl = $('confirmTitle');
const confirmMsgEl = $('confirmMsg');
const confirmOkBtn = $('confirmOk');
const confirmCancelBtn = $('confirmCancel');


// Đừng để trình duyệt tự khôi phục cuộn (nó reset về 0 và cãi với code của mình)
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

// ---------- State ----------
const MODEL_SUGGEST = {
  gemini: ['gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-pro'],
  // Gợi ý sẵn khi chưa có key; có key rồi thì danh sách được hỏi thẳng Anthropic (refreshModelList).
  claude: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-2'],
};
let docId = null;
let docTitle = 'ban-dich';
let pdfDoc = null;
let viewMode = 'both'; // 'both' | 'trans' | 'orig' | 'overlay'
let readMode = 'scroll'; // 'scroll' | 'book'
let bookIndex = 0; // trang bên trái (0-based) ở chế độ Đọc sách
let transPages = []; // bản dịch đã dàn thành từng trang (chuỗi)
let transSig = ''; // chữ ký để cache kết quả dàn trang
let zoom = 1; // 0.5 – 3
const pages = []; // { index, pageNum, canvas, origEl, transEl, sourceText, editor, statEl, aspect, rendered }
let renderObserver = null; // vẽ canvas trễ khi trang cuộn tới gần khung nhìn
// Chế độ "Đè trang": mỗi trang ghép bản gốc + chữ Việt đè đúng vị trí khối gốc.
const overlayPages = []; // { pageNum, el, canvas, statEl, ext, translated, trHash, composed, composing, sig }
let overlayObserver = null;

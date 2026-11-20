'use strict';
// Đồng hồ Pomodoro.
// Script thường (không phải module): dùng chung phạm vi toàn cục với các file khác,
// thứ tự nạp nằm trong index.html.

// ---------- Đồng hồ Pomodoro ----------
// Đọc 25 phút rồi nghỉ 5 phút; xong 4 lượt thì nghỉ dài. Đếm giờ bằng mốc thời
// gian thật (Date.now) chứ không cộng dồn từng nhịp — tab bị trình duyệt ru ngủ
// thì lúc quay lại giờ vẫn đúng.
const pomoEl = $('pomo');
const pomoBtn = $('pomoBtn');
const pomoPhaseEl = $('pomoPhase');
const pomoTimeEl = $('pomoTime');
const pomoArcEl = $('pomoArc');
const pomoStartBtn = $('pomoStart');
const pomoSkipBtn = $('pomoSkip');
const pomoResetBtn = $('pomoReset');
const pomoMinBtn = $('pomoMin');
const pomoCloseBtn = $('pomoClose');
const pomoDotsEl = $('pomoDots');
const pomoStatEl = $('pomoStat');
const pomoPosBtn = $('pomoPos');
const pomoCfgEls = {
  focus: $('pomoCfgFocus'),
  short: $('pomoCfgShort'),
  long: $('pomoCfgLong'),
  auto: $('pomoCfgAuto'),
  sound: $('pomoCfgSound'),
};

const POMO_KEY = 'ptr.pomo';
const POMO_DEF = { focus: 25, short: 5, long: 15, every: 4, auto: true, sound: true };
const POMO_LABEL = { focus: 'TẬP TRUNG', short: 'NGHỈ NGẮN', long: 'NGHỈ DÀI' };
const POMO_DONE_SAY = {
  focus: 'Hết một phiên đọc — đứng dậy, nhìn ra xa cho mắt nghỉ.',
  short: 'Hết giờ nghỉ — quay lại đọc tiếp nào.',
  long: 'Hết giờ nghỉ dài — bắt đầu vòng mới.',
};
const POMO_ARC_C = pomoArcEl ? 2 * Math.PI * Number(pomoArcEl.getAttribute('r') || 0) : 0;
const PAGE_TITLE = document.title;

let POMO = {
  phase: 'focus',            // 'focus' | 'short' | 'long'
  running: false,
  endsAt: 0,                 // mốc kết thúc (ms) khi đang chạy
  left: POMO_DEF.focus * 60, // số giây còn lại khi đang tạm dừng
  done: 0,                   // số phiên tập trung đã xong trong ngày
  day: '',
  open: false,
  mini: false,
  pos: null,                 // {x, y} khi người đọc tự kéo đồng hồ đi chỗ khác
  cfg: { ...POMO_DEF },
};
let pomoTimer = null;
let pomoAudio = null;

const pomoToday = () => new Date().toISOString().slice(0, 10);
const pomoDur = (ph) => Math.max(1, Math.min(180, Math.round(POMO.cfg[ph] || POMO_DEF[ph]))) * 60;
const pomoLeft = () =>
  POMO.running ? Math.max(0, Math.round((POMO.endsAt - Date.now()) / 1000)) : Math.max(0, Math.round(POMO.left));
const pomoClock = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

function pomoSave() {
  try { localStorage.setItem(POMO_KEY, JSON.stringify(POMO)); } catch {}
}
function pomoLoad() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(POMO_KEY) || '{}'); } catch {}
  POMO = { ...POMO, ...s, cfg: { ...POMO_DEF, ...(s.cfg || {}) } };
  if (POMO.day !== pomoToday()) { POMO.done = 0; POMO.day = pomoToday(); }
  let missed = '';
  if (POMO.running && POMO.endsAt <= Date.now()) {
    // Phiên kết thúc trong lúc app đóng: ghi nhận rồi sang phiên mới, không reo chuông muộn.
    missed = POMO_DONE_SAY[POMO.phase];
    pomoAdvance({ silent: true });
  } else if (!POMO.running) {
    POMO.left = Math.min(POMO.left || pomoDur(POMO.phase), pomoDur(POMO.phase));
  }
  for (const k of ['focus', 'short', 'long']) if (pomoCfgEls[k]) pomoCfgEls[k].value = POMO.cfg[k];
  if (pomoCfgEls.auto) pomoCfgEls.auto.checked = !!POMO.cfg.auto;
  if (pomoCfgEls.sound) pomoCfgEls.sound.checked = !!POMO.cfg.sound;
  pomoEl.classList.toggle('mini', !!POMO.mini);
  pomoMinBtn.textContent = POMO.mini ? '⤢' : '–';
  setPomoOpen(!!POMO.open, { silent: true });
  if (POMO.running) pomoLoop();
  pomoRender();
  if (missed) pomoSay('Trong lúc bạn rời đi: ' + missed);
}

function setPomoOpen(v, { silent = false } = {}) {
  POMO.open = !!v;
  pomoEl.hidden = !POMO.open;
  if (pomoBtn) pomoBtn.setAttribute('aria-expanded', String(POMO.open));
  if (POMO.open) { pomoReparent(); pomoApplyPos(); pomoRender(); }
  else document.title = PAGE_TITLE;
  if (!silent) pomoSave();
}

// --- Kéo đồng hồ tới chỗ mình thích ---
// Vị trí lưu theo toạ độ góc trái-trên và luôn được kẹp lại trong màn hình, để
// đổi cỡ cửa sổ hay xoay ngang điện thoại thì đồng hồ không lạc ra ngoài.
function pomoApplyPos() {
  if (!POMO.pos) {
    pomoEl.style.left = '';
    pomoEl.style.top = '';
    pomoEl.style.bottom = '';
    return;
  }
  const r = pomoEl.getBoundingClientRect();
  const w = r.width || 222;
  const h = r.height || 240;
  const m = 8;
  const x = Math.max(m, Math.min(Math.max(m, window.innerWidth - w - m), POMO.pos.x));
  const y = Math.max(m, Math.min(Math.max(m, window.innerHeight - h - m), POMO.pos.y));
  POMO.pos = { x, y };
  pomoEl.style.left = x + 'px';
  pomoEl.style.top = y + 'px';
  pomoEl.style.bottom = 'auto';
}
// Thả gần mép thì cho dính hẳn vào mép cho gọn
function pomoSnapPos() {
  if (!POMO.pos) return;
  const r = pomoEl.getBoundingClientRect();
  const m = 18;
  const near = 30;
  if (POMO.pos.x < near) POMO.pos.x = m;
  else if (window.innerWidth - (POMO.pos.x + r.width) < near) POMO.pos.x = window.innerWidth - r.width - m;
  if (POMO.pos.y < near) POMO.pos.y = m;
  else if (window.innerHeight - (POMO.pos.y + r.height) < near) POMO.pos.y = window.innerHeight - r.height - m;
  pomoApplyPos();
}
function pomoResetPos() {
  POMO.pos = null;
  pomoApplyPos();
  pomoSave();
}

let pomoDrag = null;
pomoEl.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  if (e.target.closest('button, input, select, textarea, summary, a, label')) return; // chừa mấy nút bấm ra
  const r = pomoEl.getBoundingClientRect();
  pomoDrag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false };
  try { pomoEl.setPointerCapture(e.pointerId); } catch {}
  pomoEl.classList.add('dragging');
});
pomoEl.addEventListener('pointermove', (e) => {
  if (!pomoDrag || e.pointerId !== pomoDrag.id) return;
  e.preventDefault();
  pomoDrag.moved = true;
  POMO.pos = { x: e.clientX - pomoDrag.dx, y: e.clientY - pomoDrag.dy };
  pomoApplyPos();
});
function pomoEndDrag(e) {
  if (!pomoDrag || e.pointerId !== pomoDrag.id) return;
  try { pomoEl.releasePointerCapture(e.pointerId); } catch {}
  pomoEl.classList.remove('dragging');
  if (pomoDrag.moved) { pomoSnapPos(); pomoSave(); }
  pomoDrag = null;
}
pomoEl.addEventListener('pointerup', pomoEndDrag);
pomoEl.addEventListener('pointercancel', pomoEndDrag);
window.addEventListener('resize', () => { if (POMO.open) pomoApplyPos(); });
// Đọc toàn màn hình dùng phần tử #book, nên đồng hồ phải chui vào đó mới hiện được.
function pomoReparent() {
  const host = document.fullscreenElement || document.body;
  if (pomoEl.parentElement !== host) host.appendChild(pomoEl);
}

function pomoLoop() {
  clearInterval(pomoTimer);
  pomoTimer = setInterval(pomoTick, 250);
}
function pomoStopLoop() {
  clearInterval(pomoTimer);
  pomoTimer = null;
}
function pomoTick() {
  if (!POMO.running) return pomoStopLoop();
  if (pomoLeft() <= 0) pomoAdvance();
  else pomoRender();
}

function pomoStart() {
  if (POMO.running) return;
  const left = Math.max(1, pomoLeft()); // đọc số giây còn lại TRƯỚC khi bật cờ chạy
  POMO.running = true;
  POMO.endsAt = Date.now() + left * 1000;
  pomoLoop();
  pomoSave();
  pomoRender();
}
function pomoPause() {
  if (!POMO.running) return;
  POMO.left = pomoLeft();
  POMO.running = false;
  POMO.endsAt = 0;
  pomoStopLoop();
  pomoSave();
  pomoRender();
}
function pomoReset() {
  POMO.running = false;
  POMO.endsAt = 0;
  POMO.left = pomoDur(POMO.phase);
  pomoStopLoop();
  pomoSave();
  pomoRender();
}
// Sang phiên kế tiếp. Bấm "Bỏ qua" giữa chừng thì không tính là một phiên đã xong.
function pomoAdvance({ silent = false, count = true } = {}) {
  const from = POMO.phase;
  if (from === 'focus' && count) {
    if (POMO.day !== pomoToday()) { POMO.done = 0; POMO.day = pomoToday(); }
    POMO.done += 1;
  }
  const every = Math.max(1, Math.round(POMO.cfg.every || POMO_DEF.every));
  POMO.phase = from === 'focus' ? (count && POMO.done % every === 0 ? 'long' : 'short') : 'focus';
  POMO.running = false;
  POMO.endsAt = 0;
  POMO.left = pomoDur(POMO.phase);
  pomoStopLoop();
  if (!silent && count) {
    pomoChime(from === 'focus' ? 3 : 2);
    pomoNotify(POMO_DONE_SAY[from]);
  }
  pomoSave();
  pomoRender();
  if (!silent && count) pomoSay(POMO_DONE_SAY[from]);
  if (!silent && POMO.cfg.auto) pomoStart();
}

// Lời nhắn giữ nguyên trên thẻ đồng hồ cho tới nhịp đếm kế tiếp
function pomoSay(msg) {
  pomoStatEl.textContent = msg;
  pomoStatEl.dataset.keep = '1';
  clearTimeout(pomoSay.t);
  pomoSay.t = setTimeout(() => {
    delete pomoStatEl.dataset.keep;
    pomoRender();
  }, 20000);
}

function pomoChime(beeps) {
  if (!POMO.cfg.sound) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    pomoAudio = pomoAudio || new AC();
    if (pomoAudio.state === 'suspended') pomoAudio.resume();
    const t0 = pomoAudio.currentTime + 0.02;
    for (let i = 0; i < beeps; i++) {
      const at = t0 + i * 0.3;
      const osc = pomoAudio.createOscillator();
      const gain = pomoAudio.createGain();
      osc.type = 'sine';
      osc.frequency.value = 620 + i * 130;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.2, at + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.26);
      osc.connect(gain).connect(pomoAudio.destination);
      osc.start(at);
      osc.stop(at + 0.28);
    }
  } catch {}
}
function pomoNotify(msg) {
  setStatus(msg, 'done');
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Pomodoro — ' + POMO_LABEL[POMO.phase].toLowerCase(), { body: msg, tag: 'ptr-pomo' });
    }
  } catch {}
}
function pomoAskNotify() {
  try {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  } catch {}
}

function pomoRender() {
  const left = pomoLeft();
  const total = pomoDur(POMO.phase);
  pomoEl.dataset.phase = POMO.phase;
  pomoEl.classList.toggle('paused', !POMO.running);
  pomoPhaseEl.textContent = POMO_LABEL[POMO.phase];
  pomoTimeEl.textContent = pomoClock(left);
  if (pomoArcEl) {
    pomoArcEl.style.strokeDasharray = POMO_ARC_C;
    pomoArcEl.style.strokeDashoffset = POMO_ARC_C * (1 - Math.max(0, Math.min(1, left / total)));
  }
  const midway = left < total;
  pomoStartBtn.textContent = POMO.running ? '⏸ Dừng' : (midway ? '▶ Tiếp' : '▶ Bắt đầu');
  pomoStartBtn.classList.toggle('btn-primary', !POMO.running);
  const every = Math.max(1, Math.round(POMO.cfg.every || POMO_DEF.every));
  const inRound = POMO.done % every;
  pomoDotsEl.innerHTML = Array.from({ length: every }, (_, i) => '<i class="' + (i < inRound ? 'on' : '') + '"></i>').join('');
  pomoDotsEl.title = 'Đã xong ' + POMO.done + ' phiên đọc hôm nay';
  if (POMO.open) {
    document.title = POMO.running
      ? pomoClock(left) + (POMO.phase === 'focus' ? ' 📖 ' : ' ☕ ') + PAGE_TITLE
      : PAGE_TITLE;
  }
  if (!pomoStatEl.dataset.keep) {
    pomoStatEl.textContent = POMO.done
      ? 'Hôm nay: ' + POMO.done + ' phiên đọc · còn ' + (every - inRound) + ' phiên nữa tới kỳ nghỉ dài'
      : 'Đọc một mạch tới khi hết giờ. Đừng nghỉ giữa phiên.';
  }
}

function pomoCfgChanged() {
  for (const k of ['focus', 'short', 'long']) {
    const el = pomoCfgEls[k];
    if (!el) continue;
    const v = Math.max(1, Math.min(180, Math.round(Number(el.value) || POMO_DEF[k])));
    POMO.cfg[k] = v;
    el.value = v;
  }
  if (pomoCfgEls.auto) POMO.cfg.auto = pomoCfgEls.auto.checked;
  if (pomoCfgEls.sound) POMO.cfg.sound = pomoCfgEls.sound.checked;
  if (!POMO.running) POMO.left = pomoDur(POMO.phase); // đang dừng thì áp giờ mới ngay
  pomoSave();
  pomoRender();
}

if (pomoBtn) pomoBtn.addEventListener('click', () => setPomoOpen(!POMO.open));
pomoCloseBtn.addEventListener('click', () => setPomoOpen(false));
pomoMinBtn.addEventListener('click', () => {
  POMO.mini = !POMO.mini;
  pomoEl.classList.toggle('mini', POMO.mini);
  pomoMinBtn.textContent = POMO.mini ? '⤢' : '–';
  pomoMinBtn.title = POMO.mini ? 'Mở rộng' : 'Thu gọn';
  pomoApplyPos(); // đổi cỡ thẻ thì kẹp lại cho khỏi lòi ra ngoài màn hình
  pomoSave();
});
pomoPosBtn.addEventListener('click', pomoResetPos);
pomoStartBtn.addEventListener('click', () => {
  if (POMO.running) pomoPause();
  else { pomoAskNotify(); pomoStart(); }
});
pomoSkipBtn.addEventListener('click', () => pomoAdvance({ count: false }));
pomoResetBtn.addEventListener('click', pomoReset);
Object.values(pomoCfgEls).forEach((el) => el && el.addEventListener('change', pomoCfgChanged));

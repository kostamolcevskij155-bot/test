/* ============================================================
 *  PIXEL BATTLE LAN — клиент (Vanilla JS, без фреймворков)
 *  ------------------------------------------------------------
 *  Секции файла:
 *    1. Палитра и константы        6. Панорама и зум (ввод)
 *    2. Состояние приложения       7. Палитра: UI и горячие клавиши
 *    3. Звук (WebAudio)            8. Кулдаун
 *    4. Подключение (Socket.IO)    9. Лента событий и счётчики
 *    5. Отрисовка холста (canvas) 10. Оверлей-изображение
 *                                 11. Сохранение PNG, клавиатура
 * ============================================================ */

'use strict';

/* ============ 1. ПАЛИТРА И КОНСТАНТЫ ============ */

// 20 базовых цветов. ВАЖНО: индексы должны совпадать с
// проверкой MAX_COLOR в server.js.
const PALETTE = [
  '#FFFFFF', '#E4E4E4', '#888888', '#333333', '#000000',
  '#FFA7D1', '#E50000', '#E59500', '#A06A42', '#E5D900',
  '#94E044', '#02BE01', '#00D3DD', '#0083C7', '#0000EA',
  '#820080', '#CF6EE4', '#FF69B4', '#808000', '#FF4500',
];

const HEX2RGB = PALETTE.map((h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
]);

/* ============ 2. СОСТОЯНИЕ ============ */

const state = {
  size: 100,                 // придет с сервера в canvas_init
  cooldownMs: 2000,          // придет с сервера
  canvas: null,              // Uint8Array(size*size), индексы палитры
  imgData: null,             // ImageData для офскрин-канваса
  selected: 6,               // выбранный цвет (по умолчанию — красный)
  cooldownUntil: 0,          // timestamp окончания кулдауна
  view: { scale: 8, ox: 0, oy: 0 },   // зум и смещение (в CSS-пикселях)
  hover: null,               // {x, y} ячейка под курсором
  ready: false,              // холст загружен с сервера
  muted: localStorage.getItem('pb_muted') === '1',
  pixelsPlaced: 0,           // сколько пикселей закрашено (не белые)
  // оверлей:
  overlay: { canvas: null, visible: false, opacity: 0.45 },
};

// Эффекты поверх холста (кольца на месте нового пикселя)
const rings = [];

/* ============ DOM-элементы ============ */

const $ = (id) => document.getElementById(id);
const dom = {
  board: $('board'), wrap: $('board-wrap'),
  palette: $('palette'), feed: $('feed'),
  coords: $('coords-chip'), online: $('online-count'), pixels: $('pixels-count'),
  cdFill: $('cooldown-fill'), cdText: $('cooldown-text'), cd: $('cooldown'),
  splash: $('splash'), splashStatus: $('splash-status'), splashFill: $('splash-fill'),
  nick: $('nick'),
  overlayFile: $('overlay-file'), overlayRange: $('overlay-range'),
  overlayToggle: $('overlay-toggle'), overlayClear: $('overlay-clear'),
};

const ctx = dom.board.getContext('2d');

// Офскрин-канвас size×size: в него пишем ImageData, а на главный
// канвас выводим уже растянутым — это быстро при любом зуме.
const off = document.createElement('canvas');
const offCtx = off.getContext('2d');

/* ============ 3. ЗВУК (WebAudio, без файлов) ============ */

let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { /* звук не критичен */ }
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

// Короткий «блип» при постановке пикселя (тон зависит от цвета)
function blip(colorIndex) {
  if (state.muted || !audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(440 + colorIndex * 25, t);
  osc.frequency.exponentialRampToValueAtTime(660 + colorIndex * 25, t + 0.07);
  gain.gain.setValueAtTime(0.07, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t); osc.stop(t + 0.14);
}

// Низкий «отказ», когда кулдаун ещё не прошёл
function denySound() {
  if (state.muted || !audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(130, t);
  osc.frequency.exponentialRampToValueAtTime(70, t + 0.16);
  gain.gain.setValueAtTime(0.06, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t); osc.stop(t + 0.2);
}

// Тихий тик на чужие пиксели (не чаще раза в 300 мс)
let lastTick = 0;
function tickSound() {
  if (state.muted || !audioCtx) return;
  const now = performance.now();
  if (now - lastTick < 300) return;
  lastTick = now;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 950;
  gain.gain.setValueAtTime(0.015, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t); osc.stop(t + 0.07);
}

/* ============ 4. ПОДКЛЮЧЕНИЕ (Socket.IO) ============ */

// Библиотека подключена с того же сервера (/socket.io/socket.io.js),
// поэтому io() доступен глобально. Подключаемся к текущему хосту.
const socket = io();

socket.on('connect', () => {
  setSplash('Подключено. Ждём состояние холста…', 40);
});

socket.on('disconnect', () => {
  state.ready = false;
  dom.splash.classList.remove('hide');
  setSplash('Соединение потеряно. Переподключаемся…', 10);
});

// Сервер присылает ВЕСЬ холст при подключении
socket.on('canvas_init', (data) => {
  state.size = data.size;
  state.cooldownMs = data.cooldown || 2000;
  state.canvas = Uint8Array.from(data.canvas);

  off.width = state.size; off.height = state.size;
  state.imgData = offCtx.createImageData(state.size, state.size);

  // Считаем закрашенные (не белые) пиксели и заполняем ImageData
  state.pixelsPlaced = 0;
  for (let i = 0; i < state.canvas.length; i++) {
    const c = state.canvas[i];
    if (c !== 0) state.pixelsPlaced++;
    writePixel(i % state.size, Math.floor(i / state.size), c);
  }
  offCtx.putImageData(state.imgData, 0, 0);

  state.ready = true;
  updateCounters();
  fitView();
  setSplash('Готово!', 100);
  setTimeout(() => dom.splash.classList.add('hide'), 350);
  addFeed(null, `Холст ${state.size}×${state.size} загружен`, null, null);
});

// Чей-то пиксель (приходит всем, включая автора)
socket.on('pixel_placed', ({ x, y, color, nick }) => {
  const old = state.canvas[y * state.size + x];
  if (old === 0 && color !== 0) state.pixelsPlaced++;
  setCell(x, y, color);
  rings.push({ x, y, t: performance.now(), color: PALETTE[color] });
  updateCounters();
  addFeed(nick, null, { x, y }, color);
  tickSound();
});

// Сервер отклонил пиксель (чаще всего — кулдаун)
socket.on('place_rejected', ({ reason, wait }) => {
  if (reason === 'cooldown') {
    state.cooldownUntil = Date.now() + (wait || 0);
  }
  rejectFx();
});

socket.on('online', (n) => { dom.online.textContent = n; });

/* ============ 5. ОТРИСОВКА ХОЛСТА ============ */

// Записать цвет одного пикселя в ImageData (без вывода на экран)
function writePixel(x, y, color) {
  const [r, g, b] = HEX2RGB[color];
  const i = (y * state.size + x) * 4;
  const d = state.imgData.data;
  d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
}

// Поставить пиксель: состояние + офскрин-канвас
function setCell(x, y, color) {
  state.canvas[y * state.size + x] = color;
  writePixel(x, y, color);
  offCtx.putImageData(state.imgData, 0, 0);
}

// Главный цикл отрисовки
function render() {
  requestAnimationFrame(render);
  const dpr = window.devicePixelRatio || 1;
  const W = dom.board.clientWidth, H = dom.board.clientHeight;
  const { scale, ox, oy } = state.view;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (!state.ready) return;

  // --- холст в мировых координатах ---
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
  ctx.imageSmoothingEnabled = false;   // пиксели остаются квадратными
  ctx.drawImage(off, 0, 0);

  // --- оверлей поверх холста ---
  if (state.overlay.visible && state.overlay.canvas) {
    ctx.globalAlpha = state.overlay.opacity;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(state.overlay.canvas, 0, 0);
    ctx.globalAlpha = 1;
  }

  // --- сетка (когда достаточно крупный зум) ---
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (scale >= 7) {
    ctx.strokeStyle = 'rgba(0,0,0,.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= state.size; i++) {
      const px = Math.round(ox + i * scale) + 0.5;
      const py = Math.round(oy + i * scale) + 0.5;
      if (px >= -1 && px <= W + 1) { ctx.moveTo(px, Math.max(oy, 0)); ctx.lineTo(px, Math.min(oy + state.size * scale, H)); }
      if (py >= -1 && py <= H + 1) { ctx.moveTo(Math.max(ox, 0), py); ctx.lineTo(Math.min(ox + state.size * scale, W), py); }
    }
    ctx.stroke();
  }

  // --- рамка всего холста ---
  ctx.strokeStyle = '#2a3448';
  ctx.lineWidth = 2;
  ctx.strokeRect(ox - 1, oy - 1, state.size * scale + 2, state.size * scale + 2);

  // --- кольца-вспышки на новых пикселях ---
  const now = performance.now();
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    const k = (now - r.t) / 450;               // живёт 450 мс
    if (k >= 1) { rings.splice(i, 1); continue; }
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 2;
    const grow = k * scale * 0.5;
    ctx.strokeRect(ox + r.x * scale - grow, oy + r.y * scale - grow,
                   scale + grow * 2, scale + grow * 2);
    ctx.globalAlpha = 1;
  }

  // --- подсветка ячейки под курсором ---
  if (state.hover) {
    const { x, y } = state.hover;
    ctx.fillStyle = PALETTE[state.selected];
    ctx.globalAlpha = 0.55;
    ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(ox + x * scale + 1, oy + y * scale + 1, scale - 2, scale - 2);
  }

  updateCooldownBar();
}
requestAnimationFrame(render);

// Подгонка канваса под размер окна с учётом DPR
function resizeBoard() {
  const dpr = window.devicePixelRatio || 1;
  dom.board.width = Math.round(dom.board.clientWidth * dpr);
  dom.board.height = Math.round(dom.board.clientHeight * dpr);
}
window.addEventListener('resize', resizeBoard);
resizeBoard();

// Показать весь холст целиком
function fitView() {
  const W = dom.board.clientWidth, H = dom.board.clientHeight;
  const s = Math.max(2, Math.floor(Math.min(W, H) / state.size) - 1);
  state.view.scale = s;
  state.view.ox = Math.round((W - state.size * s) / 2);
  state.view.oy = Math.round((H - state.size * s) / 2);
}

/* ============ 6. ПАНОРАМА, ЗУМ, КЛИК ============ */

const pointers = new Map();   // для pinch-зума на сенсорных экранах
let drag = null;              // текущее перетаскивание
let pinchDist = 0;

function eventCell(e) {
  const rect = dom.board.getBoundingClientRect();
  const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
  const x = Math.floor((sx - state.view.ox) / state.view.scale);
  const y = Math.floor((sy - state.view.oy) / state.view.scale);
  if (x < 0 || y < 0 || x >= state.size || y >= state.size) return null;
  return { x, y };
}

dom.wrap.addEventListener('pointerdown', (e) => {
  ensureAudio();
  dom.wrap.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pointers.size === 2) {                  // начало pinch-зума
    const [a, b] = [...pointers.values()];
    pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    drag = null;
    return;
  }
  drag = { x0: e.clientX, y0: e.clientY, ox: state.view.ox, oy: state.view.oy, moved: false };
});

dom.wrap.addEventListener('pointermove', (e) => {
  state.hover = state.ready ? eventCell(e) : null;
  dom.coords.textContent = state.hover ? `${state.hover.x} : ${state.hover.y}` : '— : —';

  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  // pinch-зум двумя пальцами
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchDist > 0 && d > 0) {
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinchDist);
    }
    pinchDist = d;
    return;
  }

  // панорама мышью/пальцем
  if (drag) {
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moved && Math.hypot(dx, dy) > 5) {
      drag.moved = true;
      dom.wrap.classList.add('panning');
    }
    if (drag.moved) {
      state.view.ox = drag.ox + dx;
      state.view.oy = drag.oy + dy;
    }
  }
});

dom.wrap.addEventListener('pointerup', (e) => {
  pointers.delete(e.pointerId);
  dom.wrap.classList.remove('panning');

  // Короткий клик без сдвига = постановка пикселя
  if (drag && !drag.moved) {
    const cell = eventCell(e);
    if (cell) tryPlace(cell.x, cell.y);
  }
  drag = null;
});

dom.wrap.addEventListener('pointercancel', (e) => {
  pointers.delete(e.pointerId);
  drag = null;
  dom.wrap.classList.remove('panning');
});

// Зум колесом — к курсору
dom.wrap.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rect = dom.board.getBoundingClientRect();
  zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0012));
}, { passive: false });

function zoomAt(sx, sy, factor) {
  const v = state.view;
  const newScale = Math.min(64, Math.max(2, v.scale * factor));
  const k = newScale / v.scale;
  v.ox = sx - (sx - v.ox) * k;   // якорь зума — точка под курсором
  v.oy = sy - (sy - v.oy) * k;
  v.scale = newScale;
}

/* ============ 7. ПАЛИТРА ============ */

function buildPalette() {
  PALETTE.forEach((hex, i) => {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.style.background = hex;
    b.title = `${hex}${i < 10 ? `  (клавиша ${(i + 1) % 10})` : ''}`;
    b.setAttribute('aria-label', `Цвет ${hex}`);
    b.addEventListener('click', () => selectColor(i));
    dom.palette.appendChild(b);
  });
  selectColor(state.selected);
}

function selectColor(i) {
  state.selected = i;
  [...dom.palette.children].forEach((el, j) => el.classList.toggle('selected', j === i));
}
buildPalette();

// Горячие клавиши 1..9, 0 — первые 10 цветов
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;      // не мешаем печатать ник
  const map = { '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6, '8': 7, '9': 8, '0': 9 };
  if (map[e.key] !== undefined) selectColor(map[e.key]);
  if (e.key === 'm' || e.key === 'M' || e.key === 'ь' || e.key === 'Ь') toggleMute();
  if (e.key === 'o' || e.key === 'O' || e.key === 'щ' || e.key === 'Щ') dom.overlayFile.click();
  if (e.key === 'Home') fitView();
  if (e.key === '+' || e.key === '=') zoomAt(dom.board.clientWidth / 2, dom.board.clientHeight / 2, 1.25);
  if (e.key === '-') zoomAt(dom.board.clientWidth / 2, dom.board.clientHeight / 2, 0.8);
});

/* ============ 8. КУЛДАУН ============ */

function updateCooldownBar() {
  const remain = state.cooldownUntil - Date.now();
  if (remain > 0) {
    dom.cdFill.style.width = `${(remain / state.cooldownMs) * 100}%`;
    dom.cdText.textContent = `${(remain / 1000).toFixed(1)} с`;
  } else {
    dom.cdFill.style.width = '100%';
    dom.cdText.textContent = 'готово';
  }
}

// Визуальный отказ: тряска полосы + красный + звук
function rejectFx() {
  denySound();
  dom.cd.classList.add('rejected');
  setTimeout(() => dom.cd.classList.remove('rejected'), 380);
}

// Попытка поставить пиксель
function tryPlace(x, y) {
  if (!state.ready) return;

  // Локальная проверка кулдауна, чтобы не спамить сервер
  if (Date.now() < state.cooldownUntil) { rejectFx(); return; }

  socket.emit('place_pixel', { x, y, color: state.selected, nick: nickValue() });
  state.cooldownUntil = Date.now() + state.cooldownMs;  // оптимистично
  blip(state.selected);
}

/* ============ 9. ЛЕНТА И СЧЁТЧИКИ ============ */

function nickValue() {
  return dom.nick.value.trim() || 'аноним';
}

// Ник сохраняется между перезагрузками
dom.nick.value = localStorage.getItem('pb_nick') || '';
dom.nick.addEventListener('input', () => localStorage.setItem('pb_nick', dom.nick.value.trim()));

function addFeed(nick, message, cell, color) {
  const li = document.createElement('li');
  if (message) {
    li.textContent = message;
  } else {
    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.background = PALETTE[color];
    li.appendChild(sw);
    const txt = document.createElement('span');
    const b = document.createElement('b');
    b.textContent = nick || 'аноним';
    txt.appendChild(b);
    txt.append(` — (${cell.x}, ${cell.y})`);
    li.appendChild(txt);
  }
  dom.feed.prepend(li);
  while (dom.feed.children.length > 8) dom.feed.lastChild.remove();
}

function updateCounters() {
  dom.pixels.textContent = state.pixelsPlaced.toLocaleString('ru-RU');
}

function setSplash(text, percent) {
  dom.splashStatus.textContent = text;
  dom.splashFill.style.width = `${percent}%`;
}

/* ============ 10. ОВЕРЛЕЙ-ИЗОБРАЖЕНИЕ ============
 * Картинка-образец рисуется ПОВЕРХ холста полупрозрачно,
 * чтобы удобно было обводить её пикселями. Всё происходит
 * только в браузере — на сервер ничего не отправляется. */

$('overlay-btn').addEventListener('click', () => dom.overlayFile.click());

dom.overlayFile.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const img = new Image();
  img.onload = () => {
    // Рисуем картинку в офскрин size×size, вписывая с сохранением пропорций
    const c = document.createElement('canvas');
    c.width = state.size; c.height = state.size;
    const octx = c.getContext('2d');
    const k = Math.min(state.size / img.width, state.size / img.height);
    const dw = img.width * k, dh = img.height * k;
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(img, (state.size - dw) / 2, (state.size - dh) / 2, dw, dh);

    state.overlay.canvas = c;
    state.overlay.visible = true;
    dom.overlayToggle.disabled = false;
    dom.overlayClear.disabled = false;
    dom.overlayToggle.textContent = 'скрыть';
    addFeed(null, `Оверлей загружен: ${file.name}`, null, null);
    URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(file);
  e.target.value = '';              // можно загрузить тот же файл повторно
});

// Прозрачность оверлея
dom.overlayRange.addEventListener('input', () => {
  state.overlay.opacity = dom.overlayRange.value / 100;
});

dom.overlayToggle.addEventListener('click', () => {
  state.overlay.visible = !state.overlay.visible;
  dom.overlayToggle.textContent = state.overlay.visible ? 'скрыть' : 'показать';
});

dom.overlayClear.addEventListener('click', () => {
  state.overlay.canvas = null;
  state.overlay.visible = false;
  dom.overlayToggle.disabled = true;
  dom.overlayClear.disabled = true;
  dom.overlayToggle.textContent = 'скрыть';
});

/* ============ 11. СОХРАНЕНИЕ PNG, ЗВУК-КНОПКА ============ */

// Скачать текущий холст как PNG (16 реальных пикселей на ячейку)
$('save-btn').addEventListener('click', () => {
  if (!state.ready) return;
  const k = 16;
  const c = document.createElement('canvas');
  c.width = state.size * k; c.height = state.size * k;
  const cctx = c.getContext('2d');
  cctx.imageSmoothingEnabled = false;
  cctx.drawImage(off, 0, 0, c.width, c.height);
  const a = document.createElement('a');
  a.download = 'pixel-battle.png';
  a.href = c.toDataURL('image/png');
  a.click();
});

// Кнопка звука
function toggleMute() {
  state.muted = !state.muted;
  localStorage.setItem('pb_muted', state.muted ? '1' : '0');
  $('sound-on-ico').hidden = state.muted;
  $('sound-off-ico').hidden = !state.muted;
}
$('sound-btn').addEventListener('click', () => { ensureAudio(); toggleMute(); });
if (state.muted) { $('sound-on-ico').hidden = true; $('sound-off-ico').hidden = false; }

// Кнопки зума
$('zoom-in').addEventListener('click', () => zoomAt(dom.board.clientWidth / 2, dom.board.clientHeight / 2, 1.3));
$('zoom-out').addEventListener('click', () => zoomAt(dom.board.clientWidth / 2, dom.board.clientHeight / 2, 0.75));
$('zoom-fit').addEventListener('click', fitView);

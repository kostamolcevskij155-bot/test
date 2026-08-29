/* ============================================================
 *  PIXEL BATTLE LAN — сервер
 *  Node.js + Express + Socket.IO
 *  ------------------------------------------------------------
 *  • Слушает 0.0.0.0:3000 — доступен всем устройствам в LAN
 *  • Холст SIZE×SIZE хранится в памяти (Uint8Array), значение
 *    ячейки = индекс цвета в палитре (0 = белый)
 *  • Каждому новому клиенту отправляется всё состояние холста
 *  • Кулдаун COOLDOWN_MS на постановку пикселя (по socket.id)
 *  • Никаких внешних зависимостей, кроме npm-пакетов ниже
 * ============================================================ */

'use strict';

const express = require('express');
const http    = require('http');
const os      = require('os');
const path    = require('path');
const { Server } = require('socket.io');

/* ------------------------- НАСТРОЙКИ ------------------------ */

const PORT        = 3000;   // порт сервера
const SIZE        = 100;    // размер холста: SIZE × SIZE пикселей
const COOLDOWN_MS = 2000;   // кулдаун между пикселями одного клиента, мс
const MAX_COLOR   = 19;     // максимальный индекс цвета (должен совпадать
                            // с длиной палитры в public/client.js − 1)

/* --------------------- СОСТОЯНИЕ (в памяти) ------------------ */

// Холст: плоский массив, индекс ячейки = y * SIZE + x.
// Заполнен нулями — это белый цвет (индекс 0 в палитре).
const canvas = new Uint8Array(SIZE * SIZE);

// socket.id -> время последней постановки пикселя (для кулдауна).
// Если хочется ограничивать по IP, используйте socket.handshake.address.
const lastPlace = new Map();

// Множество подключённых сокетов — для счётчика «онлайн».
const online = new Set();

/* ------------------------ HTTP + SOCKETS --------------------- */

const app    = express();
const server = http.createServer(app);

// Socket.IO сам отдаёт клиентскую библиотеку по адресу
// /socket.io/socket.io.js — поэтому внешний CDN не нужен.
const io = new Server(server, {
  cors: { origin: '*' },        // в LAN это безопасно и удобно
  maxHttpBufferSize: 1e6,       // 1 МБ — с запасом
});

// Раздача статики: index.html, style.css, client.js из папки public
app.use(express.static(path.join(__dirname, 'public')));

/* ------------------------- ВАЛИДАЦИЯ ------------------------- */

// Проверка координат и цвета. Возвращает true, если всё корректно.
function isValidPixel(x, y, color) {
  return Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(color) &&
         x >= 0 && x < SIZE &&
         y >= 0 && y < SIZE &&
         color >= 0 && color <= MAX_COLOR;
}

/* ---------------------- ЛОГИКА СОЕДИНЕНИЙ -------------------- */

io.on('connection', (socket) => {
  const ip = socket.handshake.address; // IP клиента (для логов)
  online.add(socket.id);
  console.log(`[+] Подключился ${socket.id} (${ip}). Онлайн: ${online.size}`);

  // 1) Новичку — полную копию холста и параметры сервера.
  socket.emit('canvas_init', {
    size:     SIZE,
    cooldown: COOLDOWN_MS,
    online:   online.size,
    canvas:   Array.from(canvas),   // Uint8Array -> обычный массив для JSON
  });

  // 2) Всем — обновлённый счётчик «онлайн».
  io.emit('online', online.size);

  /* -------- Обработка постановки пикселя -------- */
  socket.on('place_pixel', (data) => {
    const { x, y, color } = data || {};
    const nick = (data && typeof data.nick === 'string')
      ? data.nick.slice(0, 24)      // ограничим длину ника
      : 'аноним';

    // а) Проверяем данные — доверять клиенту нельзя.
    if (!isValidPixel(x, y, color)) {
      socket.emit('place_rejected', { reason: 'invalid', wait: 0 });
      return;
    }

    // б) Кулдаун: не чаще одного пикселя в COOLDOWN_MS с одного сокета.
    const now  = Date.now();
    const last = lastPlace.get(socket.id) || 0;
    if (now - last < COOLDOWN_MS) {
      socket.emit('place_rejected', {
        reason: 'cooldown',
        wait:   COOLDOWN_MS - (now - last),   // сколько осталось ждать
      });
      return;
    }
    lastPlace.set(socket.id, now);

    // в) Записываем пиксель в холст (в памяти).
    canvas[y * SIZE + x] = color;

    // г) Рассылаем событие ВСЕМ клиентам (включая автора) —
    //    так холст у всех всегда синхронен.
    io.emit('pixel_placed', { x, y, color, nick });
  });

  /* -------- Клиент отключился -------- */
  socket.on('disconnect', () => {
    online.delete(socket.id);
    lastPlace.delete(socket.id);
    io.emit('online', online.size);
    console.log(`[-] Отключился ${socket.id}. Онлайн: ${online.size}`);
  });
});

/* --------------------------- СТАРТ --------------------------- */

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║        PIXEL BATTLE LAN — сервер запущен      ║');
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log(`  Холст:      ${SIZE}×${SIZE} пикселей (в памяти)`);
  console.log(`  Кулдаун:    ${COOLDOWN_MS} мс на пиксель`);
  console.log(`  Локально:   http://localhost:${PORT}`);

  // Печатаем реальные IP машины, чтобы было понятно,
  // какой адрес открывать на других устройствах.
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const i of ifaces[name] || []) {
      if (i.family === 'IPv4' && !i.internal) {
        console.log(`  В сети LAN: http://${i.address}:${PORT}  (интерфейс ${name})`);
      }
    }
  }
  console.log('');
});

import { useEffect, useRef, useState } from "react";

/* ============================================================
 *  PixelDemo — играбельная демо-версия Pixel Battle.
 *  Повторяет поведение LAN-клиента: холст 100×100, палитра,
 *  кулдаун 2 с, оверлей-изображение. «Другие игроки» — боты,
 *  которые рисуют узнаваемые пиксель-арты прямо на глазах.
 * ============================================================ */

export const PALETTE = [
  "#FFFFFF", "#E4E4E4", "#888888", "#333333", "#000000",
  "#FFA7D1", "#E50000", "#E59500", "#A06A42", "#E5D900",
  "#94E044", "#02BE01", "#00D3DD", "#0083C7", "#0000EA",
  "#820080", "#CF6EE4", "#FF69B4", "#808000", "#FF4500",
];

const HEX2RGB = PALETTE.map((h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
]);

const SIZE = 100;
const COOLDOWN = 2000;

/* ---------------- звук (WebAudio, без файлов) ---------------- */

let actx: AudioContext | null = null;
function ensureAudio() {
  if (!actx) {
    try {
      actx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      /* не критично */
    }
  }
  if (actx && actx.state === "suspended") actx.resume();
}
function sfxBlip(color: number, muted: boolean) {
  if (muted || !actx) return;
  const t = actx.currentTime;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = "square";
  o.frequency.setValueAtTime(430 + color * 26, t);
  o.frequency.exponentialRampToValueAtTime(650 + color * 26, t + 0.07);
  g.gain.setValueAtTime(0.06, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
  o.connect(g).connect(actx.destination);
  o.start(t);
  o.stop(t + 0.14);
}
function sfxDeny(muted: boolean) {
  if (muted || !actx) return;
  const t = actx.currentTime;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(130, t);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.16);
  g.gain.setValueAtTime(0.055, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g).connect(actx.destination);
  o.start(t);
  o.stop(t + 0.2);
}
let lastTick = 0;
function sfxTick(muted: boolean) {
  if (muted || !actx) return;
  const now = performance.now();
  if (now - lastTick < 340) return;
  lastTick = now;
  const t = actx.currentTime;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = "sine";
  o.frequency.value = 920;
  g.gain.setValueAtTime(0.014, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  o.connect(g).connect(actx.destination);
  o.start(t);
  o.stop(t + 0.07);
}

/* ---------------- пиксель-арты ботов ---------------- */

const HEART = [".RR.RR.", "RRRRRRR", "RRRRRRR", ".RRRRR.", "..RRR..", "...R..."];
const INVADER = [
  "..G...G..", "...G.G...", "..GGGGG..", ".GG.G.GG.",
  "GGGGGGGGG", "G.GGGGG.G", "G.G...G.G", "..GG.GG..",
];
const SMILEY = [
  "..YYYYY..", ".YYYYYYY.", "YYBYYYBYY", "YYYYYYYYY", "YYYYYYYYY",
  "YBYYYYYBY", "YYBBBBBYY", ".YYYYYYY.", "..YYYYY..",
];
const L = ["X..", "X..", "X..", "X..", "XXX"];
const A = [".X.", "X.X", "XXX", "X.X", "X.X"];
const N = ["X..X", "XX.X", "X.XX", "X..X", "X..X"];

function spriteCells(
  rows: string[],
  x0: number,
  y0: number,
  map: Record<string, number>
): number[] {
  const out: number[] = [];
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      const c = map[row[dx]];
      if (c !== undefined) out.push(x0 + dx, y0 + dy, c);
    }
  });
  return out;
}

function ballCells(cx: number, cy: number, r: number, ramp: number[]): number[] {
  const out: number[] = [];
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d <= r) {
        const c = ramp[Math.min(ramp.length - 1, Math.floor((d / r) * ramp.length))];
        out.push(cx + x, cy + y, c);
      }
    }
  }
  return out;
}

const WAVE_RAMP = [6, 7, 9, 11, 12, 13, 16];
function waveCells(x0: number, y0: number, w: number, h: number): number[] {
  const out: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      out.push(x0 + x, y0 + y, WAVE_RAMP[Math.floor((x + y) / 2) % WAVE_RAMP.length]);
    }
  }
  return out;
}

function noiseCells(n: number): number[] {
  const out: number[] = [];
  const cx = 10 + Math.floor(Math.random() * (SIZE - 20));
  const cy = 10 + Math.floor(Math.random() * (SIZE - 20));
  for (let i = 0; i < n; i++) {
    out.push(
      Math.max(0, Math.min(SIZE - 1, cx + Math.floor((Math.random() - 0.5) * 24))),
      Math.max(0, Math.min(SIZE - 1, cy + Math.floor((Math.random() - 0.5) * 24))),
      1 + Math.floor(Math.random() * 19)
    );
  }
  return out;
}

const clampPos = (v: number, span: number) =>
  Math.max(1, Math.min(SIZE - span - 1, v));

function randomArt(): number[] {
  const kind = Math.floor(Math.random() * 7);
  const hearts = [6, 17, 5];
  const invaders = [11, 12, 10];
  const txt = [13, 12, 4, 3, 14];
  const ramps = [
    [6, 7, 9, 10, 12, 13, 16],
    [12, 13, 14, 16, 17, 5, 0],
    [19, 7, 9, 11, 12, 13, 14],
  ];
  switch (kind) {
    case 0:
      return spriteCells(HEART, clampPos(Math.random() * SIZE, 7), clampPos(Math.random() * SIZE, 6), {
        R: hearts[Math.floor(Math.random() * hearts.length)],
      });
    case 1:
      return spriteCells(INVADER, clampPos(Math.random() * SIZE, 9), clampPos(Math.random() * SIZE, 8), {
        G: invaders[Math.floor(Math.random() * invaders.length)],
      });
    case 2:
      return spriteCells(SMILEY, clampPos(Math.random() * SIZE, 9), clampPos(Math.random() * SIZE, 9), {
        Y: 9, B: 4,
      });
    case 3: {
      const x = clampPos(Math.random() * SIZE, 13);
      const y = clampPos(Math.random() * SIZE, 5);
      const c = txt[Math.floor(Math.random() * txt.length)];
      return [
        ...spriteCells(L, x, y, { X: c }),
        ...spriteCells(A, x + 4, y, { X: c }),
        ...spriteCells(N, x + 8, y, { X: c }),
      ];
    }
    case 4: {
      const r = 5 + Math.floor(Math.random() * 5);
      return ballCells(
        clampPos(Math.random() * SIZE, r * 2) + r,
        clampPos(Math.random() * SIZE, r * 2) + r,
        r,
        ramps[Math.floor(Math.random() * ramps.length)]
      );
    }
    case 5:
      return waveCells(clampPos(Math.random() * SIZE, 26), clampPos(Math.random() * SIZE, 6), 26, 6);
    default:
      return noiseCells(20 + Math.floor(Math.random() * 26));
  }
}

const BOT_NAMES = ["zxc_artem", "pixel_pasha", "maria.k", "dendi_fan", "neon_owl", "kot_vasya"];

type FeedItem = {
  id: number;
  nick: string | null;
  msg: string | null;
  x?: number;
  y?: number;
  color?: number;
};

type Phase = "join" | "connecting" | "live";

/* ============================================================ */

export function PixelDemo() {
  /* -------- DOM-refs -------- */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const cdFillRef = useRef<HTMLDivElement>(null);
  const cdTextRef = useRef<HTMLSpanElement>(null);
  const cdWrapRef = useRef<HTMLDivElement>(null);
  const coordsRef = useRef<HTMLSpanElement>(null);
  const zoomRef = useRef<HTMLSpanElement>(null);
  const totalRef = useRef<HTMLSpanElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* -------- движок (всё в refs, чтобы rAF-цикл не устаревал) -------- */
  const gridRef = useRef<Uint8Array>(new Uint8Array(SIZE * SIZE));
  const offRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<ImageData | null>(null);
  const viewRef = useRef({ scale: 8, ox: 0, oy: 0 });
  const hoverRef = useRef<{ x: number; y: number } | null>(null);
  const ringsRef = useRef<{ x: number; y: number; t: number; color: string }[]>([]);
  const partsRef = useRef<{ x: number; y: number; vx: number; vy: number; life: number; c: string }[]>([]);
  const botsRef = useRef<{ name: string; queue: number[]; nextAt: number }[]>([]);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayVisibleRef = useRef(false);
  const overlayOpacityRef = useRef(0.45);
  const cooldownUntilRef = useRef(0);
  const liveRef = useRef(false);
  const pausedRef = useRef(false);
  const mutedRef = useRef(false);
  const selectedRef = useRef(6);
  const totalCntRef = useRef(0);
  const feedIdRef = useRef(0);
  const aliveRef = useRef(true);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const dragRef = useRef<{ x0: number; y0: number; ox: number; oy: number; moved: boolean } | null>(null);
  const pinchRef = useRef(0);

  /* -------- React-состояние (только для UI) -------- */
  const [phase, setPhase] = useState<Phase>("join");
  const [nick, setNick] = useState(() => `guest_${100 + Math.floor(Math.random() * 900)}`);
  const [lanIp] = useState(() => `192.168.1.${2 + Math.floor(Math.random() * 250)}`);
  const [steps, setSteps] = useState<{ t: string; done: boolean }[]>([]);
  const [selected, setSelected] = useState(6);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [online, setOnline] = useState(0);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [ovlOpen, setOvlOpen] = useState(false);
  const [ovlInfo, setOvlInfo] = useState<{ name: string; visible: boolean; opacity: number } | null>(null);

  selectedRef.current = selected;
  mutedRef.current = muted;
  pausedRef.current = paused;

  /* ---------------- движок: базовые операции ---------------- */

  const writePixel = (x: number, y: number, c: number) => {
    const img = imgRef.current;
    if (!img) return;
    const [r, g, b] = HEX2RGB[c];
    const i = (y * SIZE + x) * 4;
    img.data[i] = r;
    img.data[i + 1] = g;
    img.data[i + 2] = b;
    img.data[i + 3] = 255;
  };

  const setCell = (x: number, y: number, c: number) => {
    const old = gridRef.current[y * SIZE + x];
    if (old === 0 && c !== 0) totalCntRef.current++;
    gridRef.current[y * SIZE + x] = c;
    writePixel(x, y, c);
    offRef.current?.getContext("2d")?.putImageData(imgRef.current!, 0, 0);
  };

  const spawnFx = (x: number, y: number, c: number) => {
    ringsRef.current.push({ x, y, t: performance.now(), color: PALETTE[c] });
    if (ringsRef.current.length > 40) ringsRef.current.shift();
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 4 + Math.random() * 9;
      partsRef.current.push({
        x: x + 0.5, y: y + 0.5,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3,
        life: 0.45 + Math.random() * 0.25,
        c: PALETTE[c],
      });
    }
    if (partsRef.current.length > 240) partsRef.current.splice(0, 60);
  };

  const addFeed = (nickName: string | null, msg: string | null, x?: number, y?: number, color?: number) => {
    const id = ++feedIdRef.current;
    setFeed((f) => [{ id, nick: nickName, msg, x, y, color }, ...f].slice(0, 7));
  };

  const place = (x: number, y: number, c: number, by: string) => {
    setCell(x, y, c);
    spawnFx(x, y, c);
    if (by !== "вы") {
      sfxTick(mutedRef.current);
      addFeed(by, null, x, y, c);
    } else {
      addFeed(by, null, x, y, c);
    }
  };

  /* ---------------- попытка игрока (с кулдауном) ---------------- */

  const rejectFx = () => {
    sfxDeny(mutedRef.current);
    const d = dockRef.current;
    const fill = cdFillRef.current;
    if (d) {
      d.classList.remove("dock-shake");
      void d.offsetWidth;
      d.classList.add("dock-shake");
    }
    if (fill) {
      fill.style.background = "#e50000";
      setTimeout(() => (fill.style.background = ""), 400);
    }
  };

  const tryPlace = (x: number, y: number) => {
    if (!liveRef.current) return;
    if (Date.now() < cooldownUntilRef.current) {
      rejectFx();
      return;
    }
    cooldownUntilRef.current = Date.now() + COOLDOWN;
    place(x, y, selectedRef.current, "вы");
    sfxBlip(selectedRef.current, mutedRef.current);
  };

  /* ---------------- боты ---------------- */

  const botStep = (now: number) => {
    for (const bot of botsRef.current) {
      if (now < bot.nextAt) continue;
      if (bot.queue.length === 0) bot.queue = randomArt();
      const x = bot.queue.shift()!;
      const y = bot.queue.shift()!;
      const c = bot.queue.shift()!;
      if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) place(x, y, c, bot.name);
      bot.nextAt = now + 550 + Math.random() * 1500;
    }
  };

  const preseed = () => {
    const arts: number[][] = [
      spriteCells(HEART, 10, 8, { R: 6 }),
      spriteCells(INVADER, 74, 10, { G: 11 }),
      spriteCells(SMILEY, 45, 70, { Y: 9, B: 4 }),
      [
        ...spriteCells(L, 34, 16, { X: 13 }),
        ...spriteCells(A, 38, 16, { X: 13 }),
        ...spriteCells(N, 42, 16, { X: 13 }),
      ],
      ballCells(85, 79, 7, [6, 7, 9, 10, 12, 13, 16]),
      waveCells(8, 88, 28, 6),
      noiseCells(230),
    ];
    for (const art of arts) {
      for (let i = 0; i < art.length; i += 3) {
        const x = art[i], y = art[i + 1], c = art[i + 2];
        if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) {
          if (gridRef.current[y * SIZE + x] === 0 && c !== 0) totalCntRef.current++;
          gridRef.current[y * SIZE + x] = c;
          writePixel(x, y, c);
        }
      }
    }
    offRef.current?.getContext("2d")?.putImageData(imgRef.current!, 0, 0);
  };

  /* ---------------- вид: панорама/зум ---------------- */

  const fitView = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    const W = cv.clientWidth, H = cv.clientHeight;
    const s = Math.max(2, Math.floor(Math.min(W, H) / SIZE) - 1);
    viewRef.current = { scale: s, ox: Math.round((W - SIZE * s) / 2), oy: Math.round((H - SIZE * s) / 2) };
  };

  const zoomAt = (sx: number, sy: number, factor: number) => {
    const v = viewRef.current;
    const ns = Math.min(64, Math.max(2, v.scale * factor));
    const k = ns / v.scale;
    v.ox = sx - (sx - v.ox) * k;
    v.oy = sy - (sy - v.oy) * k;
    v.scale = ns;
  };

  const eventCell = (clientX: number, clientY: number) => {
    const cv = canvasRef.current;
    if (!cv) return null;
    const r = cv.getBoundingClientRect();
    const { scale, ox, oy } = viewRef.current;
    const x = Math.floor((clientX - r.left - ox) / scale);
    const y = Math.floor((clientY - r.top - oy) / scale);
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return null;
    return { x, y };
  };

  /* ---------------- главный цикл отрисовки ---------------- */

  useEffect(() => {
    aliveRef.current = true;

    const off = document.createElement("canvas");
    off.width = SIZE;
    off.height = SIZE;
    offRef.current = off;
    imgRef.current = off.getContext("2d")!.createImageData(SIZE, SIZE);
    preseed();
    botsRef.current = BOT_NAMES.map((name) => ({ name, queue: [], nextAt: 0 }));
    fitView();

    const cv = canvasRef.current!;
    const ctx = cv.getContext("2d")!;
    let raf = 0;
    let last = performance.now();
    let lastTotal = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(cv.clientWidth * dpr);
      cv.height = Math.round(cv.clientHeight * dpr);
      fitView();
    };
    resize();
    window.addEventListener("resize", resize);

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const dpr = window.devicePixelRatio || 1;
      const W = cv.clientWidth, H = cv.clientHeight;
      const { scale, ox, oy } = viewRef.current;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // холст
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0);

      // оверлей
      if (overlayVisibleRef.current && overlayCanvasRef.current) {
        ctx.globalAlpha = overlayOpacityRef.current;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(overlayCanvasRef.current, 0, 0);
        ctx.globalAlpha = 1;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // сетка
      if (scale >= 7) {
        ctx.strokeStyle = "rgba(0,0,0,.16)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= SIZE; i++) {
          const px = Math.round(ox + i * scale) + 0.5;
          const py = Math.round(oy + i * scale) + 0.5;
          if (px >= -1 && px <= W + 1) { ctx.moveTo(px, Math.max(oy, 0)); ctx.lineTo(px, Math.min(oy + SIZE * scale, H)); }
          if (py >= -1 && py <= H + 1) { ctx.moveTo(Math.max(ox, 0), py); ctx.lineTo(Math.min(ox + SIZE * scale, W), py); }
        }
        ctx.stroke();
      }

      // рамка холста
      ctx.strokeStyle = "#34405e";
      ctx.lineWidth = 2;
      ctx.strokeRect(ox - 1, oy - 1, SIZE * scale + 2, SIZE * scale + 2);

      // кольца-вспышки
      for (let i = ringsRef.current.length - 1; i >= 0; i--) {
        const r = ringsRef.current[i];
        const k = (now - r.t) / 450;
        if (k >= 1) { ringsRef.current.splice(i, 1); continue; }
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 2;
        const g = k * scale * 0.5;
        ctx.strokeRect(ox + r.x * scale - g, oy + r.y * scale - g, scale + g * 2, scale + g * 2);
      }
      ctx.globalAlpha = 1;

      // частицы
      for (let i = partsRef.current.length - 1; i >= 0; i--) {
        const p = partsRef.current[i];
        p.life -= dt;
        if (p.life <= 0) { partsRef.current.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 14 * dt;
        ctx.globalAlpha = Math.min(1, p.life * 2.4);
        ctx.fillStyle = p.c;
        const s = Math.max(2, scale * 0.18);
        ctx.fillRect(ox + p.x * scale - s / 2, oy + p.y * scale - s / 2, s, s);
      }
      ctx.globalAlpha = 1;

      // ячейка под курсором
      const hv = hoverRef.current;
      if (hv && liveRef.current) {
        ctx.fillStyle = PALETTE[selectedRef.current];
        ctx.globalAlpha = 0.5;
        ctx.fillRect(ox + hv.x * scale, oy + hv.y * scale, scale, scale);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.strokeRect(ox + hv.x * scale + 1, oy + hv.y * scale + 1, scale - 2, scale - 2);
      }

      // боты
      if (liveRef.current && !pausedRef.current) botStep(now);

      // HUD (прямым DOM-доступом, без ре-рендеров)
      const remain = cooldownUntilRef.current - Date.now();
      if (cdFillRef.current && cdTextRef.current) {
        if (remain > 0) {
          cdFillRef.current.style.width = `${(remain / COOLDOWN) * 100}%`;
          cdTextRef.current.textContent = `${(remain / 1000).toFixed(1)} с`;
        } else {
          cdFillRef.current.style.width = "100%";
          cdTextRef.current.textContent = "готово";
        }
      }
      if (zoomRef.current) zoomRef.current.textContent = `${Math.round(scale * 10) / 10}×`;
      if (totalRef.current && now - lastTotal > 250) {
        lastTotal = now;
        totalRef.current.textContent = totalCntRef.current.toLocaleString("ru-RU");
      }

      void dt;
    };
    raf = requestAnimationFrame(loop);

    // колесо мыши — зум к курсору (non-passive, чтобы гасить скролл)
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0012));
    };
    cv.addEventListener("wheel", onWheel, { passive: false });

    // клавиатура
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const digit = "1234567890".indexOf(e.key);
      if (digit !== -1) setSelected(digit);
      const v = viewRef.current;
      const pan = 60;
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "ф") v.ox += pan;
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "в") v.ox -= pan;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "ц") v.oy += pan;
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "ы") v.oy -= pan;
      if (e.key === "+" || e.key === "=") zoomAt(cv.clientWidth / 2, cv.clientHeight / 2, 1.25);
      if (e.key === "-") zoomAt(cv.clientWidth / 2, cv.clientHeight / 2, 0.8);
      if (e.key === "Home") fitView();
      if (e.key === "p" || e.key === "P" || e.key === "з" || e.key === "З") setPaused((p) => !p);
      if (e.key === "m" || e.key === "M" || e.key === "ь" || e.key === "Ь") setMuted((m) => !m);
      if (e.key === "o" || e.key === "O" || e.key === "щ" || e.key === "Щ") fileRef.current?.click();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      aliveRef.current = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKey);
      cv.removeEventListener("wheel", onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- флуктуация «онлайна» ---------------- */

  useEffect(() => {
    if (phase !== "live") return;
    const t = setInterval(() => {
      setOnline((o) => Math.max(6, Math.min(14, o + Math.floor(Math.random() * 3) - 1)));
    }, 4000);
    return () => clearInterval(t);
  }, [phase]);

  /* ---------------- вход в игру ---------------- */

  const startConnect = async () => {
    ensureAudio();
    setPhase("connecting");
    const texts = [
      `Подключение к ws://${lanIp}:3000 …`,
      "Получение холста 100×100 (10 000 ячеек) …",
      "Синхронизация палитры — 20 цветов …",
      "Готово. Добро пожаловать в битву!",
    ];
    setSteps(texts.map((t) => ({ t, done: false })));
    for (let i = 0; i < texts.length; i++) {
      await new Promise((r) => setTimeout(r, 480 + Math.random() * 260));
      if (!aliveRef.current) return;
      setSteps((s) => s.map((st, j) => (j === i ? { ...st, done: true } : st)));
    }
    await new Promise((r) => setTimeout(r, 380));
    if (!aliveRef.current) return;
    liveRef.current = true;
    setPhase("live");
    setOnline(8 + Math.floor(Math.random() * 4));
    botsRef.current.forEach((b, i) => {
      b.queue = randomArt();
      b.nextAt = performance.now() + 600 + i * 350;
    });
    addFeed(null, `${nick || "вы"} входит в битву`);
  };

  /* ---------------- указатель: клик/панорама/pinch ---------------- */

  const onPointerDown = (e: React.PointerEvent) => {
    ensureAudio();
    wrapRef.current?.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      pinchRef.current = Math.hypot(a.x - b.x, a.y - b.y);
      dragRef.current = null;
      return;
    }
    dragRef.current = {
      x0: e.clientX, y0: e.clientY,
      ox: viewRef.current.ox, oy: viewRef.current.oy,
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    hoverRef.current = eventCell(e.clientX, e.clientY);
    if (coordsRef.current) {
      coordsRef.current.textContent = hoverRef.current
        ? `${hoverRef.current.x} : ${hoverRef.current.y}`
        : "— : —";
    }
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchRef.current > 0 && d > 0) {
        const cv = canvasRef.current!;
        const r = cv.getBoundingClientRect();
        zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, d / pinchRef.current);
      }
      pinchRef.current = d;
      return;
    }
    const d = dragRef.current;
    if (d) {
      const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
      if (!d.moved && Math.hypot(dx, dy) > 5) d.moved = true;
      if (d.moved) {
        viewRef.current.ox = d.ox + dx;
        viewRef.current.oy = d.oy + dy;
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    const d = dragRef.current;
    if (d && !d.moved) {
      const cell = eventCell(e.clientX, e.clientY);
      if (cell) tryPlace(cell.x, cell.y);
    }
    dragRef.current = null;
  };

  /* ---------------- оверлей ---------------- */

  const onOverlayFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = SIZE;
      c.height = SIZE;
      const octx = c.getContext("2d")!;
      const k = Math.min(SIZE / img.width, SIZE / img.height);
      const dw = img.width * k, dh = img.height * k;
      octx.imageSmoothingEnabled = true;
      octx.drawImage(img, (SIZE - dw) / 2, (SIZE - dh) / 2, dw, dh);
      overlayCanvasRef.current = c;
      overlayVisibleRef.current = true;
      setOvlInfo({ name: file.name, visible: true, opacity: overlayOpacityRef.current });
      addFeed(null, `Оверлей загружен: ${file.name}`);
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
    e.target.value = "";
  };

  /* ============================================================ */

  return (
    <section id="demo" className="relative h-[calc(100vh-56px)] min-h-[620px] overflow-hidden bg-blueprint">
      {/* ======= холст ======= */}
      <div
        ref={wrapRef}
        className="absolute inset-0 cursor-crosshair touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>

      {/* ======= HUD слева сверху ======= */}
      <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 rounded-md border border-line bg-panel/90 px-3 py-1.5 font-mono text-[11px]">
          <span className="dot-live h-2 w-2 rounded-full bg-[#02be01]" />
          <span className="text-fog">ОНЛАЙН</span>
          <span className="font-bold text-paper">{phase === "live" ? online : "—"}</span>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-line bg-panel/90 px-3 py-1.5 font-mono text-[11px]">
          <svg viewBox="0 0 16 16" className="h-3 w-3 fill-fog"><rect x="1" y="1" width="6" height="6" /><rect x="9" y="1" width="6" height="6" /><rect x="1" y="9" width="6" height="6" /><rect x="9" y="9" width="6" height="6" /></svg>
          <span className="text-fog">ПИКСЕЛЕЙ</span>
          <span ref={totalRef} className="font-bold text-lemon">0</span>
        </div>
        <div className="flex items-center gap-3 rounded-md border border-line bg-panel/90 px-3 py-1.5 font-mono text-[11px]">
          <span className="text-fog">КУРСОР <span ref={coordsRef} className="text-lagoon">— : —</span></span>
          <span className="text-fog">ЗУМ <span ref={zoomRef} className="text-lagoon">8×</span></span>
        </div>
      </div>

      {/* ======= кнопки справа сверху + лента ======= */}
      <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
        <div className="flex gap-2">
          <button
            onClick={() => setPaused((p) => !p)}
            title="Пауза ботов (P)"
            className="pixel-btn flex h-9 w-9 items-center justify-center bg-panel/90 text-fog hover:border-lagoon hover:text-lagoon"
          >
            {paused ? (
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current"><path d="M4 2l10 6-10 6z" /></svg>
            ) : (
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current"><rect x="3" y="2" width="4" height="12" /><rect x="9" y="2" width="4" height="12" /></svg>
            )}
          </button>
          <button
            onClick={() => { ensureAudio(); setMuted((m) => !m); }}
            title="Звук (M)"
            className={`pixel-btn flex h-9 w-9 items-center justify-center bg-panel/90 ${muted ? "text-ember" : "text-fog hover:border-lagoon hover:text-lagoon"}`}
          >
            {muted ? (
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5"><path d="M2 6h3l4-3v10L5 10H2z" fill="currentColor" /><path d="M11 6l4 4m0-4l-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg>
            ) : (
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5"><path d="M2 6h3l4-3v10L5 10H2z" fill="currentColor" /><path d="M11 5c1.5 1.5 1.5 4.5 0 6" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg>
            )}
          </button>
          <button
            onClick={fitView}
            title="Показать весь холст (Home)"
            className="pixel-btn flex h-9 w-9 items-center justify-center bg-panel/90 text-fog hover:border-lagoon hover:text-lagoon"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5"><path d="M2 8l6-6 6 6M4 7v7h8V7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>

        {paused && (
          <div className="rounded-md border border-lemon/40 bg-panel/90 px-2.5 py-1 font-mono text-[10px] tracking-widest text-lemon">
            БОТЫ: ПАУЗА
          </div>
        )}

        <ul className="mt-1 flex w-[248px] flex-col gap-1.5">
          {feed.map((f) => (
            <li key={f.id} className="feed-in flex items-center gap-2 rounded-md border border-line bg-panel/85 px-2.5 py-1.5 font-mono text-[11px] text-fog">
              {f.msg ? (
                <span className="text-lagoon">{f.msg}</span>
              ) : (
                <>
                  <span
                    className="h-3 w-3 flex-none rounded-[3px]"
                    style={{ background: PALETTE[f.color ?? 0], boxShadow: "inset 0 0 0 1px rgba(0,0,0,.35)" }}
                  />
                  <span className="truncate">
                    <b className={f.nick === "вы" ? "text-ember" : "text-paper"}>{f.nick}</b>
                    {" "}— ({f.x}, {f.y})
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* ======= зум-кнопки ======= */}
      <div className="absolute bottom-[150px] right-4 flex flex-col gap-1.5">
        {[
          { t: "Приблизить (+)", fn: () => { const cv = canvasRef.current!; zoomAt(cv.clientWidth / 2, cv.clientHeight / 2, 1.3); }, svg: <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /> },
          { t: "Отдалить (−)", fn: () => { const cv = canvasRef.current!; zoomAt(cv.clientWidth / 2, cv.clientHeight / 2, 0.75); }, svg: <path d="M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /> },
          { t: "Вписать (Home)", fn: fitView, svg: <path d="M3 6V3h3M13 6V3h-3M3 10v3h3M13 10v3h-3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" /> },
        ].map((b) => (
          <button
            key={b.t}
            title={b.t}
            onClick={b.fn}
            className="pixel-btn flex h-10 w-10 items-center justify-center bg-panel/90 text-fog hover:border-ember hover:text-ember"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4">{b.svg}</svg>
          </button>
        ))}
      </div>

      {/* ======= нижняя панель: кулдаун + палитра ======= */}
      <div ref={dockRef} className="absolute inset-x-0 bottom-0 z-10 border-t border-line bg-panel/95">
        <div className="relative h-6 overflow-hidden bg-panel2">
          <div
            ref={cdFillRef}
            className="absolute inset-y-0 left-0 w-full"
            style={{ background: "linear-gradient(90deg, #ff6b35, #2dd4bf)" }}
          />
          <span ref={cdTextRef} className="absolute inset-0 flex items-center justify-center font-mono text-[10px] font-bold uppercase tracking-[3px] text-paper [text-shadow:0_1px_2px_rgba(0,0,0,.8)]">
            готово
          </span>
        </div>

        <div className="flex items-center gap-4 px-4 py-3">
          {/* текущий цвет + ник */}
          <div className="hidden flex-none flex-col items-center gap-1 sm:flex">
            <div
              className="h-10 w-10 rounded-lg border border-line2 transition-transform duration-150"
              style={{ background: PALETTE[selected], boxShadow: `0 6px 18px -4px ${PALETTE[selected]}66` }}
            />
            <span className="max-w-[90px] truncate font-mono text-[10px] text-fog">{nick}</span>
          </div>

          {/* палитра */}
          <div className="grid flex-none grid-cols-10 gap-1.5">
            {PALETTE.map((hex, i) => (
              <button
                key={hex}
                onClick={() => setSelected(i)}
                title={`${hex}${i < 10 ? ` — клавиша ${(i + 1) % 10}` : ""}`}
                className={`h-6 w-6 rounded-[6px] border border-black/40 transition-all duration-100 hover:-translate-y-0.5 hover:scale-110 md:h-7 md:w-7 ${
                  selected === i ? "z-10 -translate-y-1 scale-110 ring-2 ring-ember ring-offset-2 ring-offset-panel" : ""
                }`}
                style={{ background: hex }}
              />
            ))}
          </div>

          {/* оверлей */}
          <div className="ml-auto flex flex-none items-center gap-2">
            <button
              onClick={() => setOvlOpen((v) => !v)}
              className={`pixel-btn flex items-center gap-2 px-3 py-2 text-[10px] ${
                ovlOpen ? "border-lagoon bg-lagoon/10 text-lagoon" : "bg-panel2 text-fog hover:border-lagoon hover:text-lagoon"
              }`}
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5">
                <path d="M2 12l3.5-4 2.5 3 2-2.5L14 12z" fill="currentColor" />
                <circle cx="5.5" cy="5" r="1.5" fill="currentColor" />
              </svg>
              оверлей
            </button>
          </div>
        </div>
      </div>

      {/* ======= панель оверлея ======= */}
      {ovlOpen && (
        <div className="absolute bottom-[132px] left-4 z-10 w-[270px] rounded-lg border border-line bg-panel/95 p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-display text-[9px] tracking-wider text-lagoon">ОВЕРЛЕЙ-ОБРАЗЕЦ</span>
            <button onClick={() => setOvlOpen(false)} className="text-fog transition-colors hover:text-ember">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5"><path d="M4 4l8 8m0-8l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
          </div>

          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onOverlayFile} />
          <button
            onClick={() => fileRef.current?.click()}
            className="pixel-btn mb-3 flex w-full items-center justify-center gap-2 bg-panel2 px-3 py-2.5 text-[10px] text-paper hover:border-lagoon"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5"><path d="M8 11V3m0 0L5 6m3-3l3 3M3 13h10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            загрузить картинку
          </button>

          {ovlInfo && (
            <>
              <div className="mb-2 truncate font-mono text-[10px] text-fog" title={ovlInfo.name}>
                файл: <span className="text-paper">{ovlInfo.name}</span>
              </div>
              <label className="mb-3 flex items-center gap-2 font-mono text-[10px] text-fog">
                прозрачность
                <input
                  type="range"
                  min={10}
                  max={90}
                  defaultValue={Math.round(ovlInfo.opacity * 100)}
                  className="ovl-range flex-1"
                  onChange={(e) => {
                    overlayOpacityRef.current = Number(e.target.value) / 100;
                    setOvlInfo((o) => (o ? { ...o, opacity: overlayOpacityRef.current } : o));
                  }}
                />
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    overlayVisibleRef.current = !overlayVisibleRef.current;
                    setOvlInfo((o) => (o ? { ...o, visible: overlayVisibleRef.current } : o));
                  }}
                  className="pixel-btn flex-1 bg-panel2 px-2 py-2 text-[10px] text-paper hover:border-lagoon"
                >
                  {ovlInfo.visible ? "скрыть" : "показать"}
                </button>
                <button
                  onClick={() => {
                    overlayCanvasRef.current = null;
                    overlayVisibleRef.current = false;
                    setOvlInfo(null);
                  }}
                  className="pixel-btn flex-1 bg-panel2 px-2 py-2 text-[10px] text-fog hover:border-ember hover:text-ember"
                >
                  убрать
                </button>
              </div>
            </>
          )}
          <p className="mt-3 text-[11px] leading-snug text-fog">
            Картинка ложится полупрозрачным слоем на холст — удобно обводить пикселями.
            Обрабатывается только в браузере, на сервер не уходит.
          </p>
        </div>
      )}

      {/* ======= подсказка по управлению ======= */}
      {phase === "live" && (
        <div className="pointer-events-none absolute bottom-[132px] left-1/2 hidden -translate-x-1/2 items-center gap-3 rounded-md border border-line bg-panel/85 px-3 py-1.5 font-mono text-[10px] text-fog lg:flex">
          <span><span className="kbd">ЛКМ</span> пиксель</span>
          <span><span className="kbd">drag</span> панорама</span>
          <span><span className="kbd">колесо</span> зум</span>
          <span><span className="kbd">O</span> оверлей</span>
          <span><span className="kbd">P</span> пауза ботов</span>
          <span><span className="kbd">M</span> звук</span>
        </div>
      )}

      {/* ======= экран входа ======= */}
      {phase !== "live" && (
        <div className="scanlines absolute inset-0 z-20 flex items-center justify-center bg-ink/90 backdrop-blur-[2px]">
          <div className="w-full max-w-md px-6">
            <div className="mb-2 flex items-center justify-center gap-3">
              <svg viewBox="0 0 16 16" className="floaty h-8 w-8">
                <rect width="8" height="8" fill="#ff4500" /><rect x="8" width="8" height="8" fill="#00d3dd" />
                <rect y="8" width="8" height="8" fill="#e5d900" /><rect x="8" y="8" width="8" height="8" fill="#02be01" />
              </svg>
              <h1 className="font-display text-xl text-paper md:text-2xl">PIXEL BATTLE</h1>
            </div>
            <p className="mb-8 text-center font-mono text-[11px] text-fog">
              демо-клиент · сервер <span className="text-lagoon">ws://{lanIp}:3000</span>
              <span className="caret-blink text-lagoon">▍</span>
            </p>

            {phase === "join" ? (
              <>
                <label className="mb-5 block">
                  <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[2px] text-fog">ваш ник</span>
                  <input
                    value={nick}
                    onChange={(e) => setNick(e.target.value.slice(0, 20))}
                    className="w-full rounded-lg border border-line bg-panel px-4 py-3 font-mono text-sm text-paper outline-none transition-colors focus:border-ember"
                    placeholder="guest_000"
                  />
                </label>
                <button
                  onClick={startConnect}
                  className="pixel-btn mb-6 w-full bg-ember px-4 py-4 text-[12px] text-ink hover:bg-lemon hover:shadow-[0_0_30px_-6px_rgba(255,209,102,.6)]"
                >
                  войти в битву
                </button>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-line bg-panel/70 p-4 font-mono text-[10px] text-fog">
                  <span><span className="kbd">ЛКМ</span> — пиксель</span>
                  <span><span className="kbd">drag</span> — панорама</span>
                  <span><span className="kbd">колесо</span> — зум</span>
                  <span><span className="kbd">1–0</span> — цвета</span>
                  <span><span className="kbd">O</span> — оверлей</span>
                  <span><span className="kbd">P</span> — пауза ботов</span>
                </div>
                <p className="mt-4 text-center text-[11px] leading-snug text-fog">
                  Это симуляция: шестеро «игроков» рисуют прямо на холсте.
                  Полная версия — в LAN-проекте ниже, на реальном Socket.IO.
                </p>
              </>
            ) : (
              <div className="rounded-lg border border-line bg-panel/80 p-5">
                {steps.map((s, i) => (
                  <div key={i} className="flex items-center gap-2.5 py-1.5 font-mono text-[11px]">
                    <span className={`flex h-4 w-4 flex-none items-center justify-center rounded-sm border ${s.done ? "border-[#02be01] bg-[#02be01]/15 text-[#02be01]" : "border-line2 text-transparent"}`}>
                      <svg viewBox="0 0 16 16" className="h-2.5 w-2.5"><path d="M3 8.5l3.5 3.5L13 4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
                    </span>
                    <span className={s.done ? "text-paper" : "text-fog"}>{s.t}</span>
                  </div>
                ))}
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-panel2">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(steps.filter((s) => s.done).length / Math.max(1, steps.length)) * 100}%`,
                      background: "linear-gradient(90deg, #ff6b35, #2dd4bf)",
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

import { PixelDemo } from "./components/PixelDemo";
import { RunGuide } from "./components/RunGuide";
import { CodeSection } from "./components/CodeSection";

/* ============================================================
 *  Pixel Battle LAN — витрина проекта:
 *  1) играбельное демо клиента (боты вместо других игроков),
 *  2) инструкция по запуску в локальной сети,
 *  3) полный исходный код всех файлов с подсветкой.
 * ============================================================ */

function Logo() {
  return (
    <a href="#demo" className="flex items-center gap-2.5">
      <svg viewBox="0 0 16 16" className="h-6 w-6 transition-transform duration-300 hover:rotate-90">
        <rect width="8" height="8" fill="#ff4500" />
        <rect x="8" width="8" height="8" fill="#00d3dd" />
        <rect y="8" width="8" height="8" fill="#e5d900" />
        <rect x="8" y="8" width="8" height="8" fill="#02be01" />
      </svg>
      <span className="font-display text-[11px] tracking-wider text-paper">
        PIXEL<span className="text-ember">BATTLE</span>
      </span>
      <span className="rounded bg-ember px-1.5 py-0.5 font-display text-[7px] tracking-widest text-ink">LAN</span>
    </a>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-ink text-paper">
      {/* ======= шапка-HUD ======= */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-ink/85 px-4 backdrop-blur-md md:px-6">
        <Logo />
        <nav className="hidden items-center gap-6 font-mono text-[12px] text-fog md:flex">
          <a href="#demo" className="transition-colors hover:text-ember">демо</a>
          <a href="#run" className="transition-colors hover:text-ember">запуск</a>
          <a href="#code" className="transition-colors hover:text-ember">исходники</a>
        </nav>
        <div className="flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-1.5 font-mono text-[11px]">
          <span className="dot-live h-2 w-2 rounded-full bg-[#02be01]" />
          <span className="hidden text-fog sm:inline">только локальная сеть</span>
          <span className="text-lagoon">0.0.0.0:3000</span>
        </div>
      </header>

      <main>
        <PixelDemo />
        <RunGuide />
        <CodeSection />
      </main>

      {/* ======= футер ======= */}
      <footer className="border-t border-line bg-coal/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 font-mono text-[11px] text-fog md:px-8">
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 16 16" className="h-4 w-4">
              <rect width="8" height="8" fill="#ff4500" />
              <rect x="8" width="8" height="8" fill="#00d3dd" />
              <rect y="8" width="8" height="8" fill="#e5d900" />
              <rect x="8" y="8" width="8" height="8" fill="#02be01" />
            </svg>
            <span>
              Pixel Battle LAN — Node.js + Express + Socket.IO · холст в памяти · 0 внешних сервисов
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-fog">все файлы — в папке</span>
            <code className="rounded border border-line bg-panel px-2 py-1 text-lemon">pixel-battle-lan/</code>
          </div>
        </div>
      </footer>
    </div>
  );
}

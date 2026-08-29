import { useState } from "react";
import { SOURCE_FILES } from "../data/sources";
import { CodeView, CopyButton } from "./Highlight";
import { Reveal } from "./Reveal";

/* ============================================================
 *  Секция «Полный исходный код»: табы по файлам LAN-проекта,
 *  подсветка, номера строк, копирование и скачивание.
 * ============================================================ */

function downloadFile(name: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function CodeSection() {
  const [active, setActive] = useState(0);
  const file = SOURCE_FILES[active];
  const lineCount = file.code.split("\n").length;

  return (
    <section id="code" className="relative mx-auto max-w-6xl px-4 py-20 md:px-8">
      <Reveal>
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <span className="font-display text-[10px] tracking-widest text-lagoon">02 / ИСХОДНИКИ</span>
              <span className="h-px w-16 bg-line2" />
            </div>
            <h2 className="text-3xl font-black leading-tight text-paper md:text-4xl">
              Шесть файлов —<br />
              <span className="text-ember">и сервер готов</span>
            </h2>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fog">
              Всё, что нужно для запуска. Комментарии — на русском, зависимости — только
              <span className="font-mono text-[13px] text-lemon"> express</span> и
              <span className="font-mono text-[13px] text-lemon"> socket.io</span>.
              Скопируйте файлы в одну папку, как на схеме справа.
            </p>
          </div>

          {/* дерево проекта */}
          <div className="rounded-lg border border-line bg-panel p-4 font-mono text-[12px] leading-relaxed">
            <div className="mb-2 font-display text-[8px] tracking-widest text-fog">СТРУКТУРА</div>
            <div className="text-paper">
              <span className="text-lagoon">pixel-battle-lan/</span>
            </div>
            <div className="pl-4 text-fog">
              ├── <span className="text-lemon">package.json</span>
              <br />
              ├── <span className="text-ember">server.js</span>
              <br />
              └── <span className="text-lagoon">public/</span>
              <div className="pl-6">
                ├── <span className="text-paper">index.html</span>
                <br />
                ├── <span className="text-paper">style.css</span>
                <br />
                └── <span className="text-paper">client.js</span>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal delay={120}>
        <div className="overflow-hidden rounded-xl border border-line bg-coal shadow-[0_30px_80px_-30px_rgba(0,0,0,.8)]">
          {/* табы */}
          <div className="flex items-center gap-1 overflow-x-auto border-b border-line bg-panel px-2 pt-2">
            {SOURCE_FILES.map((f, i) => (
              <button
                key={f.path}
                onClick={() => setActive(i)}
                className={`relative flex-none rounded-t-lg px-3.5 py-2.5 font-mono text-[12px] transition-colors ${
                  i === active ? "bg-coal text-paper" : "text-fog hover:text-paper"
                }`}
              >
                {i === active && <span className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-ember" />}
                {f.name}
              </button>
            ))}
            <div className="ml-auto flex flex-none items-center gap-2 pb-2 pl-3">
              <CopyButton text={file.code} />
              <button
                onClick={() => downloadFile(file.name, file.code)}
                className="pixel-btn flex items-center gap-1.5 bg-panel2 px-3 py-1.5 text-[9px] text-fog hover:border-ember hover:text-ember"
              >
                <svg viewBox="0 0 16 16" className="h-3 w-3">
                  <path d="M8 2v8m0 0L5 7m3 3l3-3M3 13h10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                скачать
              </button>
            </div>
          </div>

          {/* шапка файла */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-coal px-4 py-2.5">
            <span className="font-mono text-[11px] text-lagoon">{file.path}</span>
            <span className="font-mono text-[11px] text-fog">· {lineCount} строк</span>
            <span className="hidden font-mono text-[11px] text-fog sm:inline">· {file.note}</span>
          </div>

          {/* код */}
          <div className="bg-coal py-3">
            <CodeView code={file.code} lang={file.lang} />
          </div>
        </div>
      </Reveal>
    </section>
  );
}

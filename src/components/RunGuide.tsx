import { useState } from "react";
import { CopyButton } from "./Highlight";
import { Reveal } from "./Reveal";

/* ============================================================
 *  Секция «Запуск»: шаги установки, команды для каждой ОС,
 *  схема работы и советы по локальной сети.
 * ============================================================ */

function Command({ cmd, comment }: { cmd: string; comment?: string }) {
  return (
    <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-ink px-3.5 py-2.5">
      <span className="select-none font-mono text-[13px] text-lagoon">$</span>
      <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-[13px] text-paper">{cmd}</code>
      <CopyButton text={cmd} label="копировать" />
      {comment && <span className="hidden font-mono text-[11px] text-fog lg:inline"># {comment}</span>}
    </div>
  );
}

const OS_TABS = [
  {
    os: "Windows",
    cmd: "ipconfig",
    hint: "Ищите строку «IPv4-адрес» у активного адаптера (Wi-Fi или Ethernet) — например, 192.168.1.42. Когда брандмауэр спросит разрешение для Node.js — разрешите для частных сетей.",
  },
  {
    os: "macOS",
    cmd: "ipconfig getifaddr en0",
    hint: "en0 — обычно Wi-Fi. Если команда вернула пустоту, попробуйте en1 (или откройте Системные настройки → Wi-Fi → Подробнее → TCP/IP).",
  },
  {
    os: "Linux",
    cmd: "hostname -I",
    hint: "Первый адрес в выводе — ваш локальный IP. Альтернатива: ip -4 addr show | grep inet. Если порт закрыт: sudo ufw allow 3000.",
  },
];

function ArchDiagram() {
  return (
    <svg viewBox="0 0 520 300" className="w-full">
      {/* клиенты */}
      {[
        { y: 30, label: "Ноутбук — браузер", color: "#ff6b35" },
        { y: 125, label: "Телефон — браузер", color: "#2dd4bf" },
        { y: 220, label: "Планшет — браузер", color: "#ffd166" },
      ].map((c) => (
        <g key={c.label}>
          <rect x="14" y={c.y} width="150" height="50" rx="8" fill="#141926" stroke="#252e42" />
          <rect x="28" y={c.y + 14} width="22" height="22" rx="3" fill={c.color} opacity="0.9" />
          <text x="60" y={c.y + 29} fill="#e9edf5" fontSize="11" fontFamily="JetBrains Mono, monospace">
            {c.label}
          </text>
          {/* линия к серверу */}
          <line
            x1="164" y1={c.y + 25} x2="306" y2="150"
            stroke="#34405e" strokeWidth="1.5"
            strokeDasharray="5 7" className="dash-flow"
          />
        </g>
      ))}

      {/* сервер */}
      <rect x="306" y="95" width="200" height="110" rx="10" fill="#1a2132" stroke="#ff6b35" strokeWidth="1.5" />
      <text x="406" y="122" textAnchor="middle" fill="#ff6b35" fontSize="12" fontWeight="800" fontFamily="JetBrains Mono, monospace">
        server.js
      </text>
      <text x="406" y="142" textAnchor="middle" fill="#8d97ac" fontSize="10" fontFamily="JetBrains Mono, monospace">
        Express + Socket.IO
      </text>
      <text x="406" y="158" textAnchor="middle" fill="#8d97ac" fontSize="10" fontFamily="JetBrains Mono, monospace">
        0.0.0.0:3000
      </text>
      {/* память */}
      <rect x="336" y="170" width="140" height="24" rx="5" fill="#0b0e14" stroke="#34405e" />
      <text x="406" y="186" textAnchor="middle" fill="#7ee0c2" fontSize="10" fontFamily="JetBrains Mono, monospace">
        Uint8Array 100×100
      </text>

      {/* подписи протокола */}
      <text x="238" y="82" textAnchor="middle" fill="#2dd4bf" fontSize="9" fontFamily="JetBrains Mono, monospace">
        place_pixel →
      </text>
      <text x="238" y="222" textAnchor="middle" fill="#ffd166" fontSize="9" fontFamily="JetBrains Mono, monospace">
        ← pixel_placed (всем)
      </text>
    </svg>
  );
}

export function RunGuide() {
  const [osIdx, setOsIdx] = useState(0);

  return (
    <section id="run" className="relative border-t border-line bg-coal/60">
      <div className="mx-auto max-w-6xl px-4 py-20 md:px-8">
        <Reveal>
          <div className="mb-12">
            <div className="mb-3 flex items-center gap-3">
              <span className="font-display text-[10px] tracking-widest text-lagoon">01 / ЗАПУСК</span>
              <span className="h-px w-16 bg-line2" />
            </div>
            <h2 className="text-3xl font-black leading-tight text-paper md:text-4xl">
              От нуля до битвы —<br />
              <span className="text-lagoon">за 60 секунд</span>
            </h2>
          </div>
        </Reveal>

        <div className="grid gap-10 lg:grid-cols-[1.15fr_.85fr]">
          {/* -------- шаги -------- */}
          <div className="flex flex-col gap-5">
            {[
              {
                n: "1",
                title: "Установите Node.js",
                body: (
                  <>
                    Скачайте LTS-версию с <span className="font-mono text-[13px] text-lemon">nodejs.org</span> и
                    установите как обычную программу. Проверьте:
                    <Command cmd="node -v" comment="должно быть v16 или новее" />
                  </>
                ),
              },
              {
                n: "2",
                title: "Соберите папку проекта",
                body: (
                  <>
                    Создайте папку <span className="font-mono text-[13px] text-lemon">pixel-battle-lan</span>, положите
                    в неё <span className="font-mono text-[13px] text-paper">server.js</span> и{" "}
                    <span className="font-mono text-[13px] text-paper">package.json</span>, а внутрь подпапки{" "}
                    <span className="font-mono text-[13px] text-paper">public/</span> — файлы клиента
                    (структура и код — в секции ниже).
                  </>
                ),
              },
              {
                n: "3",
                title: "Установите зависимости",
                body: (
                  <>
                    В папке проекта выполните — npm сам поставит express и socket.io:
                    <Command cmd="npm install" comment="появится папка node_modules" />
                    <p className="mt-3 text-[13px] leading-relaxed text-fog">
                      Собираете с нуля без готового package.json? Тогда так:
                    </p>
                    <Command cmd="npm init -y && npm install express socket.io" />
                  </>
                ),
              },
              {
                n: "4",
                title: "Запустите сервер",
                body: (
                  <>
                    <Command cmd="npm start" comment="слушает 0.0.0.0:3000" />
                    <p className="mt-3 text-[13px] leading-relaxed text-fog">
                      В консоли сервер сам напечатает локальные адреса машины — строка
                      <span className="font-mono text-[12px] text-lagoon"> «В сети LAN: http://192.168.x.x:3000»</span>.
                    </p>
                  </>
                ),
              },
              {
                n: "5",
                title: "Позовите остальных",
                body: (
                  <>
                    На машине-сервере откройте{" "}
                    <span className="font-mono text-[13px] text-lemon">http://localhost:3000</span>. Все остальные
                    устройства в том же Wi-Fi открывают{" "}
                    <span className="font-mono text-[13px] text-lemon">http://&lt;ваш-IP&gt;:3000</span>. IP узнаётся
                    одной командой:
                  </>
                ),
              },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 70}>
                <div className="group flex gap-4 rounded-xl border border-line bg-panel p-5 transition-colors hover:border-line2">
                  <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-line2 bg-panel2 font-display text-[12px] text-ember transition-colors group-hover:border-ember">
                    {s.n}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="mb-1 text-[16px] font-bold text-paper">{s.title}</h3>
                    <div className="text-[14px] leading-relaxed text-fog">{s.body}</div>
                  </div>
                </div>
              </Reveal>
            ))}

            {/* -------- вкладки ОС -------- */}
            <Reveal delay={120}>
              <div className="rounded-xl border border-line bg-panel p-5">
                <div className="mb-4 font-display text-[9px] tracking-widest text-fog">КАК УЗНАТЬ ЛОКАЛЬНЫЙ IP</div>
                <div className="mb-4 flex gap-2">
                  {OS_TABS.map((t, i) => (
                    <button
                      key={t.os}
                      onClick={() => setOsIdx(i)}
                      className={`pixel-btn px-4 py-2 text-[10px] ${
                        i === osIdx ? "border-lagoon bg-lagoon/10 text-lagoon" : "bg-panel2 text-fog hover:text-paper"
                      }`}
                    >
                      {t.os}
                    </button>
                  ))}
                </div>
                <Command cmd={OS_TABS[osIdx].cmd} />
                <p className="mt-3 text-[13px] leading-relaxed text-fog">{OS_TABS[osIdx].hint}</p>
              </div>
            </Reveal>
          </div>

          {/* -------- схема + советы -------- */}
          <div className="flex flex-col gap-5">
            <Reveal delay={100}>
              <div className="rounded-xl border border-line bg-panel p-5">
                <div className="mb-4 font-display text-[9px] tracking-widest text-fog">КАК ЭТО РАБОТАЕТ</div>
                <ArchDiagram />
                <ul className="mt-4 flex flex-col gap-2.5 text-[13px] leading-relaxed text-fog">
                  <li className="flex gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-ember" />
                    Сервер держит холст <b className="text-paper">Uint8Array 100×100</b> в оперативной памяти — без баз данных.
                  </li>
                  <li className="flex gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-lagoon" />
                    Новичок при подключении получает <b className="text-paper">весь холст</b> событием{" "}
                    <span className="font-mono text-[12px] text-lemon">canvas_init</span>.
                  </li>
                  <li className="flex gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-lemon" />
                    Каждый пиксель проходит валидацию и кулдаун <b className="text-paper">2 сек</b> на socket.id, затем
                    рассылается всем событием <span className="font-mono text-[12px] text-lemon">pixel_placed</span>.
                  </li>
                </ul>
              </div>
            </Reveal>

            <Reveal delay={180}>
              <div className="rounded-xl border border-line bg-panel p-5">
                <div className="mb-4 font-display text-[9px] tracking-widest text-fog">ЕСЛИ ЧТО-ТО НЕ ТАК</div>
                <ul className="flex flex-col gap-3 text-[13px] leading-relaxed text-fog">
                  <li className="flex gap-2.5">
                    <span className="kbd flex-none">сеть</span>
                    Сервер и клиенты должны быть в одной подсети — один роутер/Wi-Fi. Гостевые сети часто изолируют
                    устройства друг от друга.
                  </li>
                  <li className="flex gap-2.5">
                    <span className="kbd flex-none">порт</span>
                    Брандмауэр может блокировать порт 3000. Разрешите Node.js доступ при первом запуске или откройте
                    порт вручную.
                  </li>
                  <li className="flex gap-2.5">
                    <span className="kbd flex-none">перезапуск</span>
                    Холст живёт в памяти: перезапуск сервера очистит рисунок. Для сохранения хватит{" "}
                    <span className="font-mono text-[12px] text-lemon">fs.writeFileSync</span> с JSON-дампом массива.
                  </li>
                  <li className="flex gap-2.5">
                    <span className="kbd flex-none">интернет</span>
                    Не нужен вообще: клиентская библиотека Socket.IO раздаётся самим сервером, внешних CDN нет.
                  </li>
                </ul>
              </div>
            </Reveal>

            <Reveal delay={240}>
              <div className="rounded-xl border border-ember/30 bg-gradient-to-br from-panel to-panel2 p-5">
                <div className="mb-3 font-display text-[9px] tracking-widest text-ember">НАСТРОЙКА ПОД СЕБЯ</div>
                <div className="overflow-hidden rounded-lg border border-line">
                  <table className="w-full font-mono text-[12px]">
                    <tbody>
                      {[
                        ["PORT", "3000", "порт сервера"],
                        ["SIZE", "100", "сторона холста (можно 200)"],
                        ["COOLDOWN_MS", "2000", "кулдаун на пиксель"],
                        ["MAX_COLOR", "19", "макс. индекс палитры"],
                      ].map(([k, v, d]) => (
                        <tr key={k} className="border-b border-line last:border-0">
                          <td className="bg-ink/50 px-3 py-2 text-lemon">{k}</td>
                          <td className="px-3 py-2 text-lagoon">{v}</td>
                          <td className="px-3 py-2 font-body text-[12px] text-fog">{d}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-fog">
                  Все константы — в шапке <span className="font-mono text-lemon">server.js</span>. Палитра из 20 цветов
                  задаётся массивом <span className="font-mono text-lemon">PALETTE</span> в клиенте.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

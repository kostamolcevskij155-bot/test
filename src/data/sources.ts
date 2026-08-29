/**
 * Исходники LAN-проекта импортируются как сырые строки (?raw),
 * чтобы витрина показывала ровно те файлы, что лежат в pixel-battle-lan/.
 */
import pkgRaw from "../../pixel-battle-lan/package.json?raw";
import serverRaw from "../../pixel-battle-lan/server.js?raw";
import htmlRaw from "../../pixel-battle-lan/public/index.html?raw";
import cssRaw from "../../pixel-battle-lan/public/style.css?raw";
import clientRaw from "../../pixel-battle-lan/public/client.js?raw";
import readmeRaw from "../../pixel-battle-lan/README.md?raw";

export type SourceFile = {
  name: string;
  path: string;
  lang: "js" | "json" | "html" | "css" | "md";
  code: string;
  note: string;
};

export const SOURCE_FILES: SourceFile[] = [
  {
    name: "server.js",
    path: "pixel-battle-lan/server.js",
    lang: "js",
    code: serverRaw,
    note: "Express + Socket.IO, холст в памяти, кулдаун, валидация",
  },
  {
    name: "client.js",
    path: "pixel-battle-lan/public/client.js",
    lang: "js",
    code: clientRaw,
    note: "Canvas-рендер, панорама/зум, палитра, оверлей, звук",
  },
  {
    name: "index.html",
    path: "pixel-battle-lan/public/index.html",
    lang: "html",
    code: htmlRaw,
    note: "Разметка клиента: HUD, холст, палитра, панель оверлея",
  },
  {
    name: "style.css",
    path: "pixel-battle-lan/public/style.css",
    lang: "css",
    code: cssRaw,
    note: "Тёмная тема клиента, только системные шрифты",
  },
  {
    name: "package.json",
    path: "pixel-battle-lan/package.json",
    lang: "json",
    code: pkgRaw,
    note: "Две зависимости: express и socket.io — и всё",
  },
  {
    name: "README.md",
    path: "pixel-battle-lan/README.md",
    lang: "md",
    code: readmeRaw,
    note: "Полная инструкция: установка, локальный IP, настройка",
  },
];

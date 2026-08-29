import { useMemo, useState, type ReactNode } from "react";

/* ============================================================
 *  Мини-подсветка синтаксиса без внешних библиотек.
 *  Работает через один «мастер-регулярник» на язык:
 *  порядок альтернатив задаёт приоритет токенов.
 * ============================================================ */

type Tok = { t: string; c?: string };

function tokenize(code: string, re: RegExp, classMap: Record<number, string>): Tok[] {
  const out: Tok[] = [];
  let last = 0;
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    if (m.index > last) out.push({ t: code.slice(last, m.index) });
    let cls: string | undefined;
    for (let g = 1; g < m.length; g++) {
      if (m[g] !== undefined) {
        cls = classMap[g];
        break;
      }
    }
    out.push({ t: m[0], c: cls });
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
  }
  if (last < code.length) out.push({ t: code.slice(last) });
  return out;
}

const RE: Record<string, RegExp> = {
  js: /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(const|let|var|function|return|if|else|for|while|do|new|class|extends|import|from|export|require|module|typeof|instanceof|of|in|switch|case|default|break|continue|try|catch|finally|throw|async|await|yield|this|null|undefined|true|false|void|delete)\b|(\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?\b)|([A-Za-z_$][\w$]*)(?=\s*\()/g,
  json: /("(?:[^"\\]|\\.)*")(?=\s*:)|("(?:[^"\\]|\\.)*")|(-?\b\d+(?:\.\d+)?\b)|\b(true|false|null)\b/g,
  html: /(<!--[\s\S]*?-->)|(<!DOCTYPE[^>]*>)|(<\/?[a-zA-Z][^>]*>|\/?>)/gi,
  css: /(\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(#[0-9a-fA-F]{3,8}\b)|(-?\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|s|ms|fr|deg)?)|(@[\w-]+)|([-a-zA-Z]+)(?=\s*:)|(!important)/g,
  md: /(```[\s\S]*?```)|(^#{1,6}[^\n]*)|(`[^`\n]*`)|(\*\*[^*\n]+\*\*)/gm,
};

const CLASS: Record<string, Record<number, string>> = {
  js: { 1: "tk-c", 2: "tk-s", 3: "tk-k", 4: "tk-n", 5: "tk-f" },
  json: { 1: "tk-a", 2: "tk-s", 3: "tk-n", 4: "tk-k" },
  html: { 1: "tk-c", 2: "tk-k", 3: "tk-t" },
  css: { 1: "tk-c", 2: "tk-s", 3: "tk-f", 4: "tk-n", 5: "tk-k", 6: "tk-a", 7: "tk-k" },
  md: { 1: "tk-c", 2: "tk-h", 3: "tk-s", 4: "tk-n" },
};

/* Внутри HTML-тега дополнительно красим имя тега, атрибуты и строки */
const TAG_RE = /(<\/?[a-zA-Z][\w-]*|\/?>)|([\w-]+(?==))|("(?:[^"])*")/g;

function renderTok(tok: Tok, key: number): ReactNode {
  if (tok.c === "tk-t") {
    const parts: ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    TAG_RE.lastIndex = 0;
    while ((m = TAG_RE.exec(tok.t))) {
      if (m.index > last) parts.push(tok.t.slice(last, m.index));
      const cls = m[1] ? "tk-t" : m[2] ? "tk-a" : "tk-s";
      parts.push(
        <span key={`${key}-${i++}`} className={cls}>
          {m[0]}
        </span>
      );
      last = m.index + m[0].length;
    }
    if (last < tok.t.length) parts.push(tok.t.slice(last));
    return <span key={key}>{parts}</span>;
  }
  return tok.c ? (
    <span key={key} className={tok.c}>
      {tok.t}
    </span>
  ) : (
    tok.t
  );
}

/** Подсвеченный код с номерами строк */
export function CodeView({ code, lang }: { code: string; lang: string }) {
  const lines = useMemo(() => {
    const toks = tokenize(code, RE[lang] ?? RE.js, CLASS[lang] ?? CLASS.js);
    const rows: ReactNode[][] = [[]];
    toks.forEach((tok, ti) => {
      const chunks = tok.t.split("\n");
      chunks.forEach((chunk, ci) => {
        if (ci > 0) rows.push([]);
        if (chunk) rows[rows.length - 1].push(renderTok({ t: chunk, c: tok.c }, ti * 100 + ci));
      });
    });
    return rows;
  }, [code, lang]);

  return (
    <div className="overflow-auto font-mono text-[12px] leading-[1.65]" style={{ maxHeight: 560 }}>
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((row, i) => (
            <tr key={i} className="align-top hover:bg-white/[.025]">
              <td className="w-10 select-none border-r border-line pr-3 text-right text-[11px] text-fog/50">
                {i + 1}
              </td>
              <td className="whitespace-pre pl-4 pr-6 text-paper/90">{row.length ? row : " "}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Кнопка «скопировать» с обратной связью */
export function CopyButton({ text, label = "скопировать" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setOk(true);
    setTimeout(() => setOk(false), 1600);
  };
  return (
    <button
      onClick={copy}
      className={`pixel-btn flex items-center gap-1.5 px-3 py-1.5 text-[9px] ${
        ok ? "border-[#02be01] bg-[#02be01]/10 text-[#02be01]" : "bg-panel2 text-fog hover:border-lagoon hover:text-lagoon"
      }`}
    >
      {ok ? (
        <svg viewBox="0 0 16 16" className="h-3 w-3"><path d="M3 8.5l3.5 3.5L13 4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
      ) : (
        <svg viewBox="0 0 16 16" className="h-3 w-3"><rect x="5" y="5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
      )}
      {ok ? "скопировано" : label}
    </button>
  );
}

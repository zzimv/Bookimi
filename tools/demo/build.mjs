// Сборка демо-стенда в один HTML: node tools/demo/build.mjs → tools/demo/out/bookimi-demo.html
//
// Демо запускает настоящие модули сайта в браузере: страницы витрины (серверные компоненты), анкету,
// путь книги, оформление, оплату, путь заказа и графики админки. React заменён мини-рантаймом
// (tools/demo/shims/react.ts), Next — заглушками (link/navigation/headers), база — хранилищем браузера,
// API — tools/demo/api.ts (перехват fetch). Системные промпты голосов в бандл не попадают (заглушка
// text-styles), описания сцен для иллюстраций вырезаются из сюжетов — демо они не нужны.
import { build, transform } from "esbuild";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const shim = (f) => join(here, "shims", f);

/** text-styles.ts → только id, название и признак стихов (без systemPrompt, правил и примеров). */
function textStylesStub(src) {
  const verse = {};
  for (const m of src.matchAll(/id:\s*"([^"]+)",\s*verse:\s*(true|false)/g)) verse[m[1]] = m[2] === "true";
  if (Object.keys(verse).length < 10) throw new Error("text-styles: не нашёл признаки verse — проверьте формат DRAFTS");
  return `import { TEXT_STYLE_IDS } from "./profiles";
const VERSE = ${JSON.stringify(verse)};
export const SHARED_RULES = "";
export const TEXT_STYLES = TEXT_STYLE_IDS.map((m) => ({ id: m.id, title: m.title, oneLine: m.oneLine, audiences: m.audiences, systemPrompt: "", rules: [], example: "", verse: !!VERSE[m.id] }));
`;
}

const STRING = String.raw`("(?:[^"\\]|\\.)*"|\x60(?:[^\x60\\]|\\.)*\x60)`;
const SCENES = new RegExp(String.raw`\b(scene|coverScene|openingScene|closingScene):\s*` + STRING, "g");

/** Длинные английские строки (промпты и негативы Qwen) — демо их не использует. */
const EN_PROSE = new RegExp(STRING, "g");
const stripEnglish = (src) =>
  src.replace(EN_PROSE, (m) => {
    const body = m.slice(1, -1);
    if (body.length < 60 || /[<>#{}$\u0400-\u04ff]/.test(body) || (body.match(/ /g) ?? []).length < 6) return m;
    return /^[A-Za-z0-9 ,.;:'()\-\/!?&+%]+$/.test(body) ? '""' : m;
  });
const MOOD_PROMPTS = new RegExp(String.raw`\b(promptAdd|negativeAdd):\s*` + STRING, "g");
const SEGMENT_PROSE = new RegExp(String.raw`\b(readingSituation|buyer|recipient|priceNote|vocabulary|sentenceStyle|tone):\s*` + STRING, "g");
const SEGMENT_LISTS = /\b(motivations|plotIdeas|channels|taboo):\s*\[[^\]]*\]/g;

/**
 * Длинные строковые литералы модуля (SVG-пути и разметка рисовальщиков) — в одну сжатую таблицу: deflate сжимает
 * их втрое. Литерал "…" или `…` без подстановок заменяется на __S[n]. Небольшой сканер исходника: комментарии,
 * строки, шаблоны с ${…} (текст шаблона не трогаем), регулярные выражения; ключи объектов и пути импортов — как есть.
 */
function packStrings(src) {
  const table = [];
  let out = "";
  let i = 0;
  const stack = []; // глубина фигурных скобок внутри ${…} шаблонов
  let lastSig = "";
  const n = src.length;
  const readQuoted = (q) => {
    let j = i + 1;
    while (j < n && src[j] !== q) j += src[j] === "\\" ? 2 : 1;
    return src.slice(i, j + 1);
  };
  // Текст шаблона от позиции i (после ` или }) до ` или ${; возвращает [текст, конец, закрыт ли шаблон]
  const readTemplate = (from) => {
    let j = from;
    while (j < n) {
      if (src[j] === "\\") j += 2;
      else if (src[j] === "`") return [j + 1, true];
      else if (src[j] === "$" && src[j + 1] === "{") return [j + 2, false];
      else j++;
    }
    return [n, true];
  };
  const cook = (t) => t.replace(/\\([`\\$])/g, "$1").replace(/\\n/g, "\n");
  // Текст шаблона между ` / } и ` / ${: длинный кусок → ${__S[n]}
  const chunk = (t) => {
    if (t.length < 30 || /\\[^`\\$n]/.test(t)) return t;
    table.push(cook(t));
    return "${__S[" + (table.length - 1) + "]}";
  };
  const emitTemplate = (open, end, closed) => {
    const startText = open + 1;
    const stopText = closed ? end - 1 : end - 2;
    out += src[open] + chunk(src.slice(startText, stopText)) + src.slice(stopText, end);
  };
  while (i < n) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") {
      const e = src.indexOf("\n", i);
      const end = e < 0 ? n : e;
      out += src.slice(i, end);
      i = end;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      const e = src.indexOf("*/", i + 2) + 2;
      out += src.slice(i, e);
      i = e;
      continue;
    }
    if (c === "/" && (lastSig === "" || "(,=:[!&|?{};+-*%<>~^".includes(lastSig))) {
      // регулярное выражение
      let j = i + 1;
      let cls = false;
      while (j < n && (src[j] !== "/" || cls)) {
        if (src[j] === "\\") j++;
        else if (src[j] === "[") cls = true;
        else if (src[j] === "]") cls = false;
        j++;
      }
      j++;
      while (/[a-z]/i.test(src[j] ?? "")) j++;
      out += src.slice(i, j);
      i = j;
      lastSig = "x";
      continue;
    }
    if (c === '"' || c === "'") {
      const lit = readQuoted(c);
      const before = out.slice(-12);
      const after = src.slice(i + lit.length).match(/^\s*(.)/)?.[1];
      if (c === '"' && lit.length >= 30 && after !== ":" && !/(from\s*|import\(\s*)$/.test(before)) {
        table.push(JSON.parse(lit));
        out += `__S[${table.length - 1}]`;
      } else out += lit;
      i += lit.length;
      lastSig = "x";
      continue;
    }
    if (c === "`") {
      const [end, closed] = readTemplate(i + 1);
      const lit = src.slice(i, end);
      if (closed && lit.length >= 30) {
        table.push(lit.slice(1, -1).replace(/\\([`\\$])/g, "$1"));
        out += `__S[${table.length - 1}]`;
      } else {
        emitTemplate(i, end, closed);
        if (!closed) stack.push(0);
      }
      i = end;
      lastSig = "x";
      continue;
    }
    if (stack.length && c === "{") stack[stack.length - 1]++;
    if (stack.length && c === "}") {
      if (stack[stack.length - 1] === 0) {
        // конец ${…}: продолжение текста шаблона
        stack.pop();
        const [end, closed] = readTemplate(i + 1);
        emitTemplate(i, end, closed);
        if (!closed) stack.push(0);
        i = end;
        lastSig = "x";
        continue;
      }
      stack[stack.length - 1]--;
    }
    out += c;
    if (!/\s/.test(c)) lastSig = /[\w$)\]]/.test(c) ? "x" : c;
    i++;
  }
  if (!table.length) return src;
  return `import { unpack as __unpack } from ${JSON.stringify(shim("unpack.ts"))};\nconst __S = __unpack(${JSON.stringify(pack(table))});\n` + out;
}

/** Сюжеты — чистые данные: вычисляем модуль при сборке, вырезаем сцены, сжимаем (распаковка — shims/unpack.ts). */
async function evalModule(file, contents) {
  const r = await build({ stdin: { contents, loader: "ts", resolveDir: dirname(file), sourcefile: file }, bundle: true, format: "cjs", platform: "node", write: false, logLevel: "error" });
  const mod = { exports: {} };
  new Function("module", "exports", "require", r.outputFiles[0].text)(mod, mod.exports, () => ({}));
  return mod.exports;
}
const pack = (v) => deflateRawSync(Buffer.from(JSON.stringify(v)), { level: 9 }).toString("base64");
/** Модуль только с данными → сжатые данные. */
async function packedData(file, contents) {
  const ex = await evalModule(file, contents);
  let src = `import { unpack } from ${JSON.stringify(shim("unpack.ts"))};\n`;
  for (const [name, v] of Object.entries(ex)) src += `export const ${name} = unpack(${JSON.stringify(pack(v))});\n`;
  return src;
}
async function packedPlots(file) {
  const r = await build({ entryPoints: [file], bundle: true, format: "cjs", platform: "node", write: false, logLevel: "error" });
  const mod = { exports: {} };
  new Function("module", "exports", "require", r.outputFiles[0].text)(mod, mod.exports, () => ({}));
  const strip = (h) => (h ? { ...h, openingScene: "", closingScene: "" } : h);
  let src = `import { unpack } from ${JSON.stringify(shim("unpack.ts"))};\n`;
  for (const [name, plots] of Object.entries(mod.exports)) {
    const lean = plots.map((p) => ({
      ...p,
      coverScene: "",
      // Сцены не нужны — кроме метки {GROUP}: по ней демо рисует толпу группы (groupSpreadIndexes)
      spreads: p.spreads.map((s) => ({ ...s, scene: /\{GROUP\}/.test(s.scene) ? "{GROUP}" : "" })),
      occasionHooks: p.occasionHooks && Object.fromEntries(Object.entries(p.occasionHooks).map(([k, h]) => [k, strip(h)])),
    }));
    const b64 = deflateRawSync(Buffer.from(JSON.stringify(lean)), { level: 9 }).toString("base64");
    src += `export const ${name} = unpack(${JSON.stringify(b64)});\n`;
  }
  return src;
}

const demoPlugin = {
  name: "bookimi-demo",
  setup(b) {
    // React → мини-рантайм, Next → заглушки
    b.onResolve({ filter: /^react(\/jsx-runtime|\/jsx-dev-runtime)?$/ }, () => ({ path: shim("react.ts") }));
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: shim("next-link.ts") }));
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: shim("next-navigation.ts") }));
    b.onResolve({ filter: /^next\/headers$/ }, () => ({ path: shim("next-headers.ts") }));
    b.onResolve({ filter: /^server-only$/ }, () => ({ path: shim("empty.cjs") }));
    b.onResolve({ filter: /^node:/ }, () => ({ path: shim("empty.cjs") }));
    b.onResolve({ filter: /^@prisma\/client$/ }, () => ({ path: shim("empty.cjs") }));
    // Серверные зависимости (очередь, почта, драйвер БД) — если их потянет общий модуль, в браузере они не нужны
    b.onResolve({ filter: /^(pg|pg-boss|nodemailer|@prisma\/adapter-pg)$/ }, () => ({ path: shim("empty.cjs") }));
    // База данных: в демо её нет (hasDatabase = false → настройки и каталог по умолчанию)
    b.onResolve({ filter: /(^|\/)db$/ }, (a) => (a.importer.includes(`${join(root, "src")}`) ? { path: shim("db.ts") } : undefined));
    b.onResolve({ filter: /(^|\/)prisma-client$/ }, () => ({ path: shim("empty.cjs") }));
    // Стили компонентов подключаются в HTML целиком
    b.onResolve({ filter: /\.css$/ }, () => ({ path: shim("empty.cjs") }));
    b.onLoad({ filter: /src[\\/]content[\\/]text-styles\.ts$/ }, (a) => ({ contents: textStylesStub(readFileSync(a.path, "utf8")), loader: "ts", resolveDir: dirname(a.path) }));
    b.onResolve({ filter: /^zod$/ }, () => ({ path: shim("zod.ts") }));
    // Русские сообщения zod: у мини-zod они свои
    b.onResolve({ filter: /(^|\/)zod-ru$/ }, () => ({ path: shim("empty.cjs") }));
    // Офлайн-список городов (доставка): в демо — 400 крупнейших (строки уже по убыванию населения), сжатым, как сюжеты
    b.onLoad({ filter: /src[\\/]lib[\\/]cities\.json$/ }, (a) => {
      const c = JSON.parse(readFileSync(a.path, "utf8"));
      return { contents: `import { unpack } from ${JSON.stringify(shim("unpack.ts"))};\nexport default unpack(${JSON.stringify(pack({ ...c, rows: c.rows.slice(0, 400) }))});`, loader: "ts", resolveDir: dirname(a.path) };
    });
    // Общие крючки поводов: английские описания сцен демо не нужны
    b.onLoad({ filter: /src[\\/]content[\\/]occasions\.ts$/ }, (a) => ({ contents: packStrings(readFileSync(a.path, "utf8").replace(SCENES, '$1: ""')), loader: "ts", resolveDir: dirname(a.path) }));
    // Тексты витрины (FAQ, поводы, посвящения) — тоже сжатой таблицей строк
    b.onLoad({ filter: /src[\\/]lib[\\/](catalog-defaults|dedications|storefront)\.ts$/ }, (a) => ({ contents: packStrings(readFileSync(a.path, "utf8")), loader: "ts", resolveDir: dirname(a.path) }));
    b.onLoad({ filter: /src[\\/]content[\\/](art[\\/][a-z]+|moods)\.ts$/ }, (a) => ({ contents: packStrings(stripEnglish(readFileSync(a.path, "utf8")).replace(MOOD_PROMPTS, '$1: ""')), loader: "ts", resolveDir: dirname(a.path) }));
    b.onLoad({ filter: /src[\\/]content[\\/]profiles\.ts$/ }, async (a) => ({ contents: await packedData(a.path, readFileSync(a.path, "utf8").replace(SEGMENT_PROSE, '$1: ""').replace(SEGMENT_LISTS, "$1: []")), loader: "ts", resolveDir: dirname(a.path) }));
    b.onLoad({ filter: /src[\\/]content[\\/]plots[\\/][a-z]+\.ts$/ }, async (a) => ({ contents: await packedPlots(a.path), loader: "ts", resolveDir: dirname(a.path) }));
  },
};

const res = await build({
  entryPoints: [join(here, "app.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  charset: "utf8",
  write: false,
  jsx: "automatic",
  jsxImportSource: "react",
  tsconfig: join(root, "tsconfig.json"),
  plugins: [demoPlugin],
  define: { "process.env.NODE_ENV": '"production"' },
  banner: { js: "var process={env:{DEMO_MODE:'1'}};" },
  logLevel: "warning",
  metafile: true,
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

const cssFiles = ["src/app/globals.css", "src/components/charts/charts.css", "src/app/zakaz/journey.css", "src/app/kabinet/kabinet.css"].map((f) => readFileSync(join(root, f), "utf8"));
const css = (await transform([...cssFiles, readFileSync(join(here, "style.css"), "utf8")].join("\n"), { loader: "css", minify: true, charset: "utf8" })).code;

// Шрифты — свои, без Google Fonts: подмножества Nunito 800 и Manrope 400/700 (tools/demo/fonts/subset.sh).
// Nunito 700 и Manrope 600 браузер берёт из ближайшего более жирного начертания.
const CYR = "U+0401,U+0410-044F,U+0451,U+2116";
const LAT = "U+0020-007E,U+00A0,U+00AB,U+00BB,U+00B7,U+00D7,U+00A9,U+2010-2014,U+2018-201E,U+2026,U+20BD,U+2212,U+2190-2193,U+00B0,U+2009,U+202F";
const fontCss = [["Nunito", "nunito", 800], ["Manrope", "manrope", 400], ["Manrope", "manrope", 700]]
  .flatMap(([family, file, w]) => [["cyr", CYR], ["lat", LAT]].map(([sub, range]) => {
    const b64 = readFileSync(join(here, "fonts", `${file}-${sub}-${w}.woff2`)).toString("base64");
    return `@font-face{font-family:${family};font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${b64}) format("woff2");unicode-range:${range}}`;
  }))
  .join("");
// rev 19: шрифты книги — Yeseva One (имя, ключевые слова) и Lora 400 / 400 italic (текст), подмножества (subset.sh)
const PUN = "U+0020-0040,U+005B-0060,U+007B-007E,U+00A0,U+00AB,U+00BB,U+00B7,U+2010-2014,U+2018-201E,U+2026,U+2116,U+2009,U+202F,U+2605,U+2726,U+2767";
const bookFontCss = [["Yeseva One", "yeseva-one-%s-400", "normal"], ["Lora", "lora-%s-400", "normal"], ["Lora", "lora-%s-400-italic", "italic"]]
  .flatMap(([family, file, style]) => [["cyr", CYR], ["lat", PUN]].map(([sub, range]) => {
    const b64 = readFileSync(join(here, "fonts", `${file.replace("%s", sub)}.woff2`)).toString("base64");
    return `@font-face{font-family:"${family}";font-style:${style};font-weight:400;font-display:swap;src:url(data:font/woff2;base64,${b64}) format("woff2");unicode-range:${range}}`;
  }))
  .join("");

// Тема до первой отрисовки — как THEME_SCRIPT в src/app/layout.tsx
const themeScript = `try{var t=localStorage.getItem("bk_theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
const html = `<!doctype html>
<html lang="ru" data-theme="auto">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>БУКИМИ демо rev 19</title>
<meta name="description" content="Интерактивный демо-стенд БУКИМИ: витрина, анкета, книга, оплата, кабинет и админка — без сервера.">
<meta name="claude:viewport-fit-sides" content="cover">
<script>${themeScript}</script>
<style>${fontCss}${bookFontCss}${css}</style>
</head>
<body>
<div id="app"><p style="padding:40px 16px;text-align:center;font-family:system-ui">Загружаем демо-стенд…</p></div>
<script>${js}</script>
</body>
</html>
`;
mkdirSync(join(here, "out"), { recursive: true });
writeFileSync(join(here, "out", "bookimi-demo.html"), html);
const bytes = Buffer.byteLength(html);
console.log(`ok: ${(bytes / 1024).toFixed(0)} КБ (${bytes} байт)`);
if (process.argv.includes("--sizes")) {
  const ins = Object.values(res.metafile.outputs)[0].inputs;
  const agg = {};
  for (const [k, v] of Object.entries(ins)) {
    const key = k.includes("node_modules") ? "node_modules/" + k.split("node_modules/")[1].split("/")[0] : k.replace(/^.*?(src|tools)\//, "$1/");
    agg[key] = (agg[key] ?? 0) + v.bytesInOutput;
  }
  console.log(Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 90).map(([k, v]) => `${String((v / 1024).toFixed(1)).padStart(7)} КБ  ${k}`).join("\n"));
  console.log(`css ${(Buffer.byteLength(css) / 1024).toFixed(0)} КБ, шрифты ${(Buffer.byteLength(fontCss) / 1024).toFixed(0)} КБ`);
}

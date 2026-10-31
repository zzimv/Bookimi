// rev 07, решение владелицы: «убери везде ссылки на нейросети». Покупатель и сотрудники не должны видеть
// «нейросеть», «ИИ», «искусственный интеллект», «модель рисует», «сгенерирует», названия моделей и т. п.
// Сканируем исходники, тексты которых видят люди (страницы, компоненты, юридические тексты, письма и триггеры,
// витрина, llms.txt / agents.md / catalog.json), и собранный демо-стенд, если он есть.
// Комментарии в коде не сканируем. Технические id провайдеров («yandexgpt», «qwen» — значения настроек,
// в админке они показываются серым тегом <code>) пишутся строчными и в проверку названий не попадают.
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");

/** Русские слова — без учёта регистра, граница слова через (?<![а-яё]). */
const FORBIDDEN: { name: string; re: RegExp }[] = [
  { name: "нейросеть", re: /(?<![а-яё])нейро\s*сет/giu },
  { name: "нейронная сеть", re: /(?<![а-яё])нейронн/giu },
  // «ИИ» — заглавными (строчное «ии» — окончание слова, в том числе в коде склонений: пр: "ии")
  { name: "ИИ", re: /(?<![а-яёА-ЯЁa-zA-Z])ИИ(?![а-яёА-ЯЁa-zA-Z])/gu },
  { name: "искусственный интеллект", re: /(?<![а-яё])искусственн[а-яё]*\s+интеллект/giu },
  { name: "AI", re: /(?<![A-Za-z_$.#"'`-])AI(?![A-Za-z0-9_])/gu },
  { name: "модель", re: /(?<![а-яё])модел(ь|и|ью|ей|ям|ями|ях)(?![а-яё])/giu },
  { name: "генерат…", re: /(?<![а-яё])генерат/giu },
  { name: "(с)генерир…", re: /(?<![а-яё])(с|пере)?генерир/giu },
  { name: "генерация", re: /(?<![а-яё])генерац/giu },
  // Названия сервисов — с заглавной, как их написали бы в тексте; строчные id настроек разрешены.
  { name: "провайдер", re: /\b(Qwen|YandexGPT|Kandinsky|SpeechKit|SaluteSpeech)\b/gu },
];

/** Где разрешено (путь, подстрока строки): технические места, которые люди не видят как текст. */
const ALLOW: { file: RegExp; line: RegExp }[] = [];

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|mdx?)$/.test(n)) out.push(p);
  }
  return out;
}

/** Убираем комментарии: блочные (в том числе JSX {/* *\/}) и строчные «// …» после пробела или с начала строки. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .split("\n")
    .map((l) => l.replace(/(^|\s)\/\/.*$/, "$1"))
    .join("\n");
}

function scan(text: string): { name: string; line: number; text: string }[] {
  const hits: { name: string; line: number; text: string }[] = [];
  const lines = text.split("\n");
  lines.forEach((l, i) => {
    for (const f of FORBIDDEN) {
      f.re.lastIndex = 0;
      const m = f.re.exec(l);
      if (m) hits.push({ name: f.name, line: i + 1, text: l.slice(Math.max(0, m.index - 40), m.index + 40).trim() });
    }
  });
  return hits;
}

const SOURCES = [
  ...walk(join(ROOT, "src/app")),
  ...walk(join(ROOT, "src/components")),
  ...[
    "src/lib/legal.tsx",
    "src/lib/notify.ts",
    "src/lib/triggers.ts",
    "src/lib/storefront.ts",
    "src/lib/catalog-defaults.ts",
    "src/lib/geo.ts",
    "src/lib/og.ts",
    "src/lib/holidays-core.ts",
    "src/lib/settings.ts",
    "src/lib/settings-validate.ts",
    "tools/demo/app.tsx",
    "tools/demo/pages.tsx",
    "tools/demo/admin.tsx",
    "tools/demo/holidays.tsx",
    "tools/demo/cartoon.tsx",
    "tools/demo/api.ts",
  ].map((p) => join(ROOT, p)),
].filter((p) => existsSync(p));

describe("без упоминаний нейросетей (rev 07)", () => {
  it("видимые тексты сайта, админки, писем и юридических документов", () => {
    expect(SOURCES.length).toBeGreaterThan(50);
    const bad: string[] = [];
    for (const p of SOURCES) {
      const rel = relative(ROOT, p);
      for (const h of scan(stripComments(readFileSync(p, "utf8")))) {
        if (ALLOW.some((a) => a.file.test(rel) && a.line.test(h.text))) continue;
        bad.push(`${rel}:${h.line} «${h.name}»: ${h.text}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("правило ловит запрещённые слова и не трогает обычные", () => {
    const names = (s: string) => scan(s).map((h) => h.name);
    expect(names("Нейросеть нарисует героя")).toEqual(["нейросеть"]);
    expect(names("ИИ-провайдеры")).toEqual(["ИИ"]);
    expect(names("Искусственный интеллект сочинит")).toEqual(["искусственный интеллект"]);
    expect(names("Мы сгенерируем книгу")).toEqual(["(с)генерир…"]);
    expect(names("Наш AI рисует")).toEqual(["AI"]);
    expect(names("модель рисует")).toEqual(["модель"]);
    expect(names("Qwen-Image-Edit")).toEqual(["провайдер"]);
    // обычные слова и технические id — не ловим
    expect(names("истории, линии, Мои герои, Россия")).toEqual([]);
    expect(names('cfg("ai"); s.ai.text; ["yandexgpt", "qwen"]; #ai; YANDEX_CLOUD_API_KEY')).toEqual([]);
    expect(names("иллюстрации рисуем по фото в выбранном стиле")).toEqual([]);
  });

  const demo = join(ROOT, "tools/demo/out/bookimi-demo.html");
  it.skipIf(!existsSync(demo))("собранный демо-стенд (видимые строки)", () => {
    // В бандле есть код и технические id; проверяем русские слова и названия сервисов с заглавной.
    const html = readFileSync(demo, "utf8");
    const hits = scan(html.replace(/\/\*[\s\S]*?\*\//g, "")).filter((h) => h.name !== "AI");
    expect(hits.map((h) => `${h.name}: ${h.text}`)).toEqual([]);
  });
});

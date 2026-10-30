// Регрессия по повторной проверке 30.10.2026 (rev 05) — без БД. 2FA под параллельными запросами — в fixes-db.test.ts.
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const cache = vi.hoisted(() => ({ paths: [] as string[] }));
vi.mock("next/cache", () => ({ revalidatePath: (p: string, t?: string) => void cache.paths.push(t ? `${p}|${t}` : p), revalidateTag: () => {} }));

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("микрофон: Permissions-Policy", () => {
  it("microphone=(self) — запись голоса на своём сайте; камера и геолокация выключены", async () => {
    const cfg = (await import("../next.config")).default;
    const rules = await cfg.headers!();
    const pp = rules[0].headers.find((h) => h.key === "Permissions-Policy")!.value;
    expect(pp).toContain("microphone=(self)");
    expect(pp).toContain("camera=()");
    expect(pp).toContain("geolocation=()");
    expect(pp).not.toContain("microphone=()");
  });
});

describe("праздники: правка сбрасывает кэш страниц", () => {
  it("/prazdniki, главная, машиночитаемые файлы и общий макет (полоса промо)", async () => {
    const { revalidateHolidays } = await import("@/lib/holidays-revalidate");
    cache.paths.length = 0;
    revalidateHolidays();
    expect(cache.paths).toEqual(expect.arrayContaining(["/prazdniki", "/", "/llms.txt", "/agents.md", "/catalog.json", "/|layout"]));
  });
  it("ошибки формы праздника — по-русски (zod), с названием поля", async () => {
    const { parseHoliday } = await import("@/lib/holidays-core");
    const base = { title: "Тест", occasionKey: "test-a", rule: { kind: "fixed", month: 1, day: 1 }, giftDeadlineDays: "" };
    const e1 = parseHoliday({ ...base, showFromDays: "-5" });
    expect(e1).toEqual({ ok: false, error: "Показывать за (дней): число должно быть не меньше 1" });
    const e2 = parseHoliday({ ...base, rule: { kind: "fixed", month: 13, day: 1 }, showFromDays: "5" });
    expect(e2).toEqual({ ok: false, error: "Месяц: число должно быть не больше 12" });
    const e3 = parseHoliday({ ...base, rule: { kind: "fixed", month: 1.5, day: 1 }, showFromDays: "5" });
    expect(e3.ok).toBe(false);
    for (const e of [e1, e2, e3]) expect((e as { error: string }).error).not.toMatch(/[A-Za-z]{3,}/);
  });
  it("zod по-русски глобально: любые схемы (API, настройки)", async () => {
    await import("@/lib/zod-ru");
    const { z } = await import("zod");
    const r = z.object({ n: z.number().int().min(1).max(5), s: z.string().min(3), e: z.enum(["a", "b"]) }).safeParse({ n: 9, s: "x", e: "c" });
    expect(r.success).toBe(false);
    const msgs = r.success ? [] : r.error.issues.map((i) => i.message);
    expect(msgs).toEqual(["Число должно быть не больше 5", "Не меньше 3 символов", "Выберите вариант из списка"]);
  });
});

describe("группа: вставка списка больше лимита", () => {
  it("40 имён в детсадовскую группу (до 30 с героем): 29 добавлены, 11 не добавлены — сообщение с именами", async () => {
    const { addWithLimit, parseNames } = await import("@/lib/roster");
    const names = Array.from({ length: 40 }, (_, i) => `Ребёнок${i + 1}`).join("\n");
    const r = addWithLimit(0, parseNames(names), 29, "группа");
    expect(r.added).toHaveLength(29);
    expect(r.overflow.map((x) => x.name)).toEqual(Array.from({ length: 11 }, (_, i) => `Ребёнок${i + 30}`));
    expect(r.message).toMatch(/^В группе детского сада — до 30 детей вместе с героем; лишние имена не добавлены: Ребёнок30, Ребёнок31/);
    const cls = addWithLimit(35, parseNames("Аня, Боря, Вика, Гоша, Даша"), 39, "класс");
    expect(cls.added).toHaveLength(4);
    expect(cls.message).toMatch(/^В классе — до 40 детей/);
    expect(addWithLimit(0, parseNames("Аня, Боря"), 29, "группа").message).toBeNull();
  });
  it("в форме: сообщение и не поместившиеся имена остаются в поле вставки", () => {
    const src = read("src/components/quiz/GroupStep.tsx");
    expect(src).toContain("addWithLimit(");
    expect(src).toContain('setPaste(r.overflow.map((x) => x.name).join("\\n"))');
    expect(src).toContain("data-roster-overflow");
  });
});

describe("поиск города: сокращения", () => {
  it("спб, питер, мск, екб, нск, нн, с-пб, санкт петербург → крупный город первым", async () => {
    const { searchCities } = await import("@/lib/cities");
    const first = (q: string) => searchCities(q, 3)[0]?.name;
    expect(first("спб")).toBe("Санкт-Петербург");
    expect(first("СПб")).toBe("Санкт-Петербург");
    expect(first("с-пб")).toBe("Санкт-Петербург");
    expect(first("питер")).toBe("Санкт-Петербург");
    expect(first("санкт петербург")).toBe("Санкт-Петербург");
    expect(first("мск")).toBe("Москва");
    expect(first("екб")).toBe("Екатеринбург");
    expect(first("нск")).toBe("Новосибирск");
    expect(first("нн")).toBe("Нижний Новгород");
    expect(first("ростов на дону")).toBe("Ростов-на-Дону");
    // Обычный поиск не сломан
    expect(first("королев")).toBe("Королёв");
    expect(first("нижн нов")).toBe("Нижний Новгород");
  });
});

describe("тексты: имена и склонения", () => {
  it("«Саша К.» в конце фразы: одна точка, многоточие не трогаем", async () => {
    const { fillTags } = await import("@/lib/declension");
    const hero = { name: "Саша К.", gender: "boy" as const };
    expect(fillTags("Это был {ГЕРОЙ.им}.", { hero })).toBe("Это был Саша К.");
    expect(fillTags("Это был {ГЕРОЙ.им}...", { hero })).toBe("Это был Саша К....");
    expect(fillTags("Ну и дела... {ГЕРОЙ.им} молчал.", { hero: { name: "Петя", gender: "boy" } })).toBe("Ну и дела... Петя молчал.");
  });
  it("отчества в творительном: Ильичом, Кузьмичом, Лукичом, Фомичом; Петровичем, Сергеевичем, Саввичем", async () => {
    const { declineName } = await import("@/lib/declension");
    expect(declineName("Владимир Ильич", "тв", "boy")).toBe("Владимиром Ильичом");
    expect(declineName("Пётр Кузьмич", "тв", "boy")).toBe("Петром Кузьмичом");
    expect(declineName("Сергей Лукич", "тв", "boy")).toBe("Сергеем Лукичом");
    expect(declineName("Фома Фомич", "тв", "boy")).toBe("Фомой Фомичом");
    expect(declineName("Иван Петрович", "тв", "boy")).toBe("Иваном Петровичем");
    expect(declineName("Олег Сергеевич", "тв", "boy")).toBe("Олегом Сергеевичем");
    expect(declineName("Никита Саввич", "тв", "boy")).toBe("Никитой Саввичем");
    expect(declineName("Владимир Ильич", "род", "boy")).toBe("Владимира Ильича");
  });
  it("имена латиницей: Anna, Maria, Sofia — девочки; Nikita, Ilya, Ivan — мальчики; Sasha в списке группы — спросить", async () => {
    const { guessGender } = await import("@/lib/declension");
    const { guessChildGender } = await import("@/lib/roster");
    for (const n of ["Anna", "Maria", "Sofia", "Daria", "Mila", "Kate", "Ann", "Sophie"]) expect(guessGender(n), n).toBe("girl");
    for (const n of ["Nikita", "Ilya", "Ivan", "Alexey", "Luca", "Misha", "Leo"]) expect(guessGender(n), n).toBe("boy");
    expect(guessChildGender("Anna")).toBe("girl");
    expect(guessChildGender("Sasha")).toBeNull();
    expect(guessChildGender("Zhenya")).toBeNull();
    // Кириллица — как раньше
    expect(guessGender("Анна")).toBe("girl");
    expect(guessGender("Никита")).toBe("boy");
  });
  it("кабинет: приветствие только по «Как к вам обращаться»", async () => {
    const { greetName, greeting } = await import("@/lib/first-name");
    expect(greeting(greetName("Анна Петровна"))).toBe("Здравствуйте, Анна Петровна!");
    expect(greeting(greetName(""))).toBe("Здравствуйте!");
    expect(greeting(greetName(null))).toBe("Здравствуйте!");
    for (const f of ["src/app/kabinet/page.tsx", "tools/demo/pages.tsx"]) {
      const src = read(f);
      expect(src, f).not.toMatch(/contactName\)/);
      expect(src, f).toContain("greetName(user.firstName)");
    }
  });
});

/** WAV 16 бит моно: синус amp (0..1) на 1,5 с — amp 0 — тишина. */
function wav(amp: number, sec = 1.5, rate = 48000) {
  const n = Math.round(sec * rate);
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 220 * i) / rate) * amp * 32767 + (Math.random() - 0.5) * 2), 44 + i * 2);
  return b;
}
const hasFfmpeg = (() => {
  try {
    execFileSync(process.env.FFMPEG_PATH || "ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe("запись голоса: беззвучную не принимаем", () => {
  it("браузер: накопитель уровня отличает тишину от голоса", async () => {
    const { isSilent, levelMeter } = await import("@/lib/cartoon-guide");
    const quiet = levelMeter();
    quiet.add(new Float32Array(4800).map(() => (Math.random() - 0.5) * 0.001));
    expect(isSilent(quiet.result())).toBe(true);
    const voice = levelMeter();
    voice.add(new Float32Array(4800).map((_, i) => Math.sin(i / 10) * 0.3));
    expect(isSilent(voice.result())).toBe(false);
    // «Тихо, но слышно» (−35 dBFS) — не тишина: только предупреждение
    const soft = levelMeter();
    soft.add(new Float32Array(4800).map((_, i) => Math.sin(i / 10) * 0.025));
    expect(isSilent(soft.result())).toBe(false);
  });
  it.skipIf(!hasFfmpeg)("сервер: замер ffmpeg — тишина отклоняется, голос проходит", async () => {
    const { levels } = await import("@/lib/gen/cartoon-voice");
    const { isSilent } = await import("@/lib/cartoon-guide");
    const dir = mkdtempSync(join(tmpdir(), "bk-silent-"));
    writeFileSync(join(dir, "silent.wav"), wav(0));
    writeFileSync(join(dir, "ok.wav"), wav(0.3));
    expect(isSilent(await levels(join(dir, "silent.wav")))).toBe(true);
    expect(isSilent(await levels(join(dir, "ok.wav")))).toBe(false);
  });
  it.skipIf(!hasFfmpeg)("запись браузера (WebM потоком, без длительности в заголовке) — длительность по декодированию, не «Запись пустая»", async () => {
    const { probe } = await import("@/lib/gen/cartoon-render");
    const { checkVoiceMeta } = await import("@/lib/cartoon-guide");
    const dir = mkdtempSync(join(tmpdir(), "bk-webm-"));
    const f = join(dir, "rec.webm");
    // Как MediaRecorder: WebM/Opus, записанный в поток (без Duration)
    writeFileSync(f, execFileSync(process.env.FFMPEG_PATH || "ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "sine=f=440:d=2", "-c:a", "libopus", "-f", "webm", "pipe:1"]));
    const m = await probe(f);
    expect(m.duration).toBeGreaterThan(1.8);
    expect(m.duration).toBeLessThan(2.3);
    expect(checkVoiceMeta(m)).toBeNull();
  });
  it("CSP: своя запись (blob:) слушается и рисуется, мультфильм из Object Storage играет", async () => {
    const cfg = (await import("../next.config")).default;
    const csp = (await cfg.headers!())[0].headers.find((h) => h.key === "Content-Security-Policy")!.value;
    expect(csp).toMatch(/media-src 'self' blob: https:\/\/\*\.yandexcloud\.net/);
    expect(csp).toMatch(/connect-src 'self' blob:/);
  });
  it("обе записи (мультфильм и «Читаю сам») проверяются в браузере и на сервере", () => {
    expect(read("src/app/api/books/[id]/cartoon/voice/route.ts")).toContain("isSilent(await levels(v.file))");
    expect(read("src/app/api/books/[id]/voice/route.ts")).toContain("if (await silent(buf)) return err(SILENT_ERROR)");
    expect(read("src/app/kabinet/kniga/[id]/mult/OwnVoice.tsx")).toContain("isSilent(lv)");
    expect(read("src/app/kabinet/kniga/[id]/BookCabinet.tsx")).toContain("isSilent(lv)");
  });
});

describe("фото: почти однотонный кадр не темнеет от автоуровней", () => {
  it("однотонный светлый кадр — без растяжки; обычный — с ней", async () => {
    const { levelsWanted, makePortrait } = await import("@/lib/photo-process");
    const W = 600;
    const flat = Buffer.alloc(W * W * 3);
    for (let i = 0; i < flat.length; i++) flat[i] = 200 + Math.floor(Math.random() * 8);
    const flatJpg = await sharp(flat, { raw: { width: W, height: W, channels: 3 } }).jpeg().toBuffer();
    const g = await sharp(flatJpg).resize(128, 128).greyscale().raw().toBuffer();
    expect(levelsWanted(g)).toBe(false);
    const out = await makePortrait(flatJpg, W, W, null, "human");
    const mean = async (b: Buffer) => (await sharp(b).greyscale().stats()).channels[0].mean;
    const [before, after] = [await mean(flatJpg), await mean(out)];
    expect(Math.abs(after - before)).toBeLessThan(6);
    // Обычный контрастный кадр — уровни нужны
    const grad = Buffer.alloc(128 * 128);
    for (let i = 0; i < grad.length; i++) grad[i] = 30 + Math.floor(((i % 128) / 128) * 180);
    expect(levelsWanted(grad)).toBe(true);
  });
});

describe("окружение, образ, контраст, демо", () => {
  it(".env.example: нереализованные интеграции — только в закомментированном блоке; YC_IAM_TOKEN есть", () => {
    const env = read(".env.example");
    const active = env.split("\n").filter((l) => /^[A-Z_0-9]+=/.test(l)).map((l) => l.split("=")[0]);
    for (const v of ["WHATSAPP_ENABLED", "WHATSAPP_API_KEY", "POCHTA_ACCESS_TOKEN", "YANDEX_DELIVERY_TOKEN", "GIGACHAT_CLIENT_ID", "SBER_KANDINSKY_API_KEY"]) expect(active).not.toContain(v);
    expect(env).toMatch(/Не реализовано/);
    expect(active).toContain("YC_IAM_TOKEN");
  });
  it("Dockerfile: в итоговом образе только production-зависимости; воркер на tsx (prod-зависимость)", () => {
    const df = read("Dockerfile");
    const pkg = JSON.parse(read("package.json"));
    expect(df).toMatch(/npm ci --omit=dev/);
    const runtime = df.slice(df.lastIndexOf("FROM "));
    expect(runtime).toContain("COPY --from=prod-deps --chown=app /app/node_modules ./node_modules");
    expect(runtime).not.toContain("COPY --from=build --chown=app /app/node_modules");
    expect(runtime).toContain(".next/standalone");
    expect(runtime).toContain("tsconfig.json");
    expect(pkg.dependencies.tsx).toBeTruthy();
    expect(pkg.dependencies.pg).toBeTruthy(); // scripts/migrate.mjs
  });
  it("золото «звёзды и точка логотипа» ≥ 4,5:1 к фонам обеих тем", () => {
    const css = read("src/app/globals.css");
    const lum = (h: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const cr = (a: string, b: string) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    const light = css.slice(0, css.indexOf(":root[data-theme=\"dark\"]"));
    const dark = css.slice(css.indexOf(":root[data-theme=\"dark\"]"), css.indexOf("@media (prefers-color-scheme: dark)"));
    const tok = (block: string, name: string) => block.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"))![1];
    for (const block of [light, dark]) {
      const mark = tok(block, "gold-mark");
      for (const bg of ["paper", "surface", "gold-soft"]) expect(cr(mark, tok(block, bg)), `${mark} / ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("демо: подпись версии rev 05; значок «пробный» заметный", () => {
    expect(read("tools/demo/app.tsx")).toContain('<span className="demo-rev">rev 05</span>');
    expect(read("tools/demo/build.mjs")).toContain("<title>БУКИМИ демо rev 05</title>");
    expect(read("src/app/globals.css")).toMatch(/\.badge--trial \{ background: var\(--gold-soft\); color: var\(--gold-ink\)/);
  });
});

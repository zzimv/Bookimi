// «Мультфильм по книге»: сценарий (бюджет слов, реплики, имена, посвящение), расчёт времени сцен, субтитры,
// разрезание записи по паузам, цены допа и «своим голосом», проверка файлов по сигнатуре, срок удаления записей.
// На БД (DATABASE_URL): докупка из кабинета, согласие на голос, удаление записей по сроку, ссылка «Поделиться».
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { AnswersV2 } from "@/lib/quiz";
import { DemoTextProvider, dedicationText, personalize, plotForAnswers } from "@/lib/gen/text";
import {
  CARTOON_TIMING,
  cartoonScript,
  cartoonTimeline,
  countWords,
  estimateSpeechSec,
  particlesFor,
  sentences,
  splitBySilences,
  subtitleChunks,
  validScript,
  wordBudget,
} from "@/lib/gen/cartoon-script";
import { quote, toggleAddon, type CatalogAddon, type CatalogFormat } from "@/lib/pricing";
import { checkVoiceMeta, sniffAudio, voiceDueForPurge, voicePurgeDate, VOICE_LIMITS, OWN_VOICE_FORMAT } from "@/lib/cartoon-guide";
import { planCamera, wrapLines } from "@/lib/gen/cartoon-render";

const BOOKS = {
  ny: { audience: "CHILD", hero: { name: "Маша", gender: "girl", ageGroup: "4-5" }, occasion: { key: "novyj-god" }, story: { slug: "novogodnee-puteshestvie-s-dedom-morozom" }, extras: [{ role: "pet", name: "Пушок", species: "cat" }], dedication: "Машенька, пусть в твоей жизни всегда будет место чуду! С любовью, мама и папа." },
  cat: { audience: "PET", hero: { name: "Барсик", gender: "boy" }, pet: { species: "cat", furColor: "рыжий" }, occasion: { key: "den-koshek" }, story: { slug: "skazanie-o-divane" }, extras: [{ role: "owner", name: "Аня" }], dedication: "Нашему рыжему князю — от верной княгини-кормилицы." },
  teen: { audience: "TEEN", hero: { name: "Артём", gender: "boy", age: 12 }, occasion: { key: "den-rozhdeniya" }, story: { slug: "uroven-kotorogo-net" } },
} as const;

async function scriptOf(raw: unknown, targetSec?: number) {
  const a = AnswersV2.parse(raw);
  const t = personalize((await new DemoTextProvider().write(a, plotForAnswers(a), 0)).raw, a);
  return { a, t, s: cartoonScript({ title: t.title, spreads: t.spreads, dedication: dedicationText(a) }, { targetSec }) };
}

describe("сценарий мультфильма", () => {
  for (const [k, raw] of Object.entries(BOOKS)) {
    it(`${k}: 14 реплик, 200–260 слов на 2 минуты, имена и посвящение на месте`, async () => {
      const { a, s } = await scriptOf(raw);
      expect(s.cues).toHaveLength(14);
      expect(s.cues.map((c) => c.kind)).toEqual(["title", ...Array(12).fill("spread"), "end"]);
      expect(s.cues.map((c) => c.n)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
      expect(s.words).toBeGreaterThanOrEqual(200);
      expect(s.words).toBeLessThanOrEqual(260);
      const all = s.cues.map((c) => c.text).join(" ");
      expect(all).not.toMatch(/[{}]|\[Имя\]/);
      expect(all).toContain(a.hero.name);
      if (a.dedication) expect(s.cues[13].text).toContain(dedicationText(a).split(/[!.]/)[0]);
      for (const c of s.cues) {
        expect(c.targetSec).toBeGreaterThan(0.5);
        expect(c.text).toMatch(/[.!?…»]$/);
      }
      // По оценке темпа — 1:40…2:20
      expect(s.estSec).toBeGreaterThan(100);
      expect(s.estSec).toBeLessThan(140);
    });
  }
  it("бюджет масштабируется с длительностью (90 и 150 секунд)", async () => {
    const short = (await scriptOf(BOOKS.ny, 90)).s;
    const long = (await scriptOf(BOOKS.ny, 150)).s;
    expect(wordBudget(90)).toBeLessThan(wordBudget(150));
    expect(short.words).toBeLessThan(long.words);
    expect(short.words).toBeLessThanOrEqual(wordBudget(90) * 1.12);
  });
  it("предложения: реплика диалога с ремаркой — одно предложение", () => {
    expect(sentences("— Беда, Маша! — вздохнул Дед Мороз. — Сани сломались.")).toEqual(["— Беда, Маша! — вздохнул Дед Мороз.", "— Сани сломались."]);
    expect(sentences("«Как же нам перебраться?» — задумался Дед Мороз. Снег.")).toHaveLength(2);
  });
  it("ответ модели проверяется: число реплик, метки, бюджет", () => {
    const ok = Array.from({ length: 14 }, () => ({ text: "раз два три четыре пять шесть семь восемь девять десять одиннадцать двенадцать тринадцать четырнадцать пятнадцать шестнадцать" }));
    expect(validScript(ok, 14, 224)).toBe(true);
    expect(validScript(ok.slice(1), 14, 224)).toBe(false);
    expect(validScript([...ok.slice(1), { text: "Привет, {ГЕРОЙ.им}" }], 14, 224)).toBe(false);
    expect(validScript(ok, 14, 400)).toBe(false);
  });
  it("оценка речи растёт с длиной текста", () => {
    expect(estimateSpeechSec("Мама.")).toBeLessThan(estimateSpeechSec("Мама мыла раму, а папа читал сказку."));
    expect(countWords("Жила-была Маша, и всё.")).toBe(4);
  });
  it("частицы по теме: зима — снег, ночь — светлячки, праздник — искорки", () => {
    expect(particlesFor("winter", "")).toBe("snow");
    expect(particlesFor("meadow", "ночью светила луна")).toBe("fireflies");
    expect(particlesFor("castle", "день рождения и торт")).toBe("sparkles");
    expect(particlesFor("pet-home", "диван и плед")).toBe("dust");
  });
});

describe("время сцен", () => {
  const kinds = ["title", ...Array(12).fill("spread"), "end"] as ("title" | "spread" | "end")[];
  it("сцена = пауза + реплика + пауза + переход; сцены идут встык с наплывом", () => {
    const v = [2.5, ...Array(12).fill(7.5), 5];
    const tl = cartoonTimeline(v, kinds);
    const t = CARTOON_TIMING;
    expect(tl.scenes).toHaveLength(14);
    for (let i = 1; i < 14; i++) expect(tl.scenes[i].start).toBeCloseTo(tl.scenes[i - 1].start + tl.scenes[i - 1].dur - t.xfade, 1);
    tl.scenes.forEach((s, i) => {
      // реплика целиком внутри сцены и заканчивается до следующего перехода
      expect(s.voiceAt).toBeGreaterThanOrEqual(s.start);
      const next = tl.scenes[i + 1];
      expect(s.voiceAt + s.voiceSec).toBeLessThanOrEqual((next ? next.start : s.start + s.dur) + 0.01);
    });
    expect(tl.scenes[0].dur).toBeGreaterThanOrEqual(t.titleMin);
    expect(tl.total).toBeCloseTo(tl.scenes[13].start + tl.scenes[13].dur, 1);
    expect(tl.total).toBeGreaterThan(110);
    expect(tl.total).toBeLessThan(125);
    expect(tl.stretch).toBe(1);
  });
  it("короткая озвучка растягивается до минимума (90 с), длинная — сжимает паузы, сверх — помечается", () => {
    const short = cartoonTimeline([1, ...Array(12).fill(3), 2], kinds);
    expect(short.total).toBeGreaterThanOrEqual(CARTOON_TIMING.minSec - 0.1);
    expect(short.stretch).toBeGreaterThan(1);
    const long = cartoonTimeline([3, ...Array(12).fill(11), 6], kinds);
    expect(long.total).toBeLessThan(cartoonTimeline([3, ...Array(12).fill(11), 6], kinds, { ...CARTOON_TIMING, maxSec: 999 }).total);
    const over = cartoonTimeline([3, ...Array(12).fill(14), 6], kinds);
    expect(over.over).toBe(true);
  });
  it("субтитры: не больше двух строк, время делится по слогам без пропусков", () => {
    const text = "Снежинка рассыпалась тысячей искр и проложила по льду сверкающую дорожку. Олени пошли вперёд.";
    const ch = subtitleChunks(text, 8);
    expect(ch.length).toBeGreaterThan(1);
    for (const c of ch) {
      expect(c.text.split("\n").length).toBeLessThanOrEqual(2);
      for (const l of c.text.split("\n")) expect(l.length).toBeLessThanOrEqual(41);
    }
    expect(ch[0].from).toBe(0);
    expect(ch.at(-1)!.to).toBeCloseTo(8, 1);
    for (let i = 1; i < ch.length; i++) expect(ch[i].from).toBeCloseTo(ch[i - 1].to, 2);
    expect(ch.map((c) => c.text.replace(/\n/g, " ")).join(" ")).toBe(text);
    expect(wrapLines("Новогоднее путешествие с Дедом Морозом", 22)).toEqual(["Новогоднее путешествие", "с Дедом Морозом"]);
  });
  it("камера держит героев в кадре на любой панораме", () => {
    const box = { x0: 1500, x1: 1900, y0: 500, y1: 1100 };
    for (let page = 1; page <= 12; page++) {
      const p = planCamera("spread", page, 2560, 1280, { x: 1700, y: 700 }, true, box);
      for (const [z, cx] of [[p.z0, p.cx0], [p.z1, p.cx1]] as const) {
        const hw = 1280 / z / 2;
        expect(cx - hw).toBeLessThanOrEqual(box.x0);
        expect(cx + hw).toBeGreaterThanOrEqual(box.x1);
        expect(cx - hw).toBeGreaterThanOrEqual(0);
        expect(cx + hw).toBeLessThanOrEqual(2560);
      }
    }
  });
  it("одна запись режется по паузам у ожидаемых границ", () => {
    const expected = [2, 4, 4, 2];
    const sil: [number, number][] = [[2.1, 2.9], [5.0, 5.3], [7.2, 8.0], [10.6, 11.4], [12.5, 12.9]];
    const parts = splitBySilences(sil, 14, expected);
    expect(parts).toHaveLength(4);
    expect(parts[0]).toEqual([0, 2.1]);
    expect(parts[1][0]).toBe(2.9);
    expect(parts[2][0]).toBe(8);
    expect(parts[3][1]).toBe(14);
    for (let i = 1; i < parts.length; i++) expect(parts[i][0]).toBeGreaterThanOrEqual(parts[i - 1][1]);
    // Пауз нет — режем по пропорции
    const none = splitBySilences([], 12, [1, 1, 1]);
    expect(none.map((p) => Math.round(p[1]))).toEqual([4, 8, 12]);
  });
});

const FORMATS: CatalogFormat[] = [{ key: "pdf", kind: "PDF", title: "PDF", priceRub: 990 }];
const ADDONS: CatalogAddon[] = [
  { key: "cartoon", kind: "DIGITAL", title: "Мультфильм", priceRub: 690, percentOff: null, requiresPrint: false },
  { key: "cartoon-own-voice", kind: "MODIFIER", title: "Своим голосом", priceRub: 400, percentOff: null, requiresPrint: false },
  { key: "poster", kind: "PHYSICAL", title: "Постер", priceRub: 590, percentOff: null, requiresPrint: true },
];

describe("цены мультфильма", () => {
  it("PDF + мультфильм + своим голосом = 990 + 690 + 400", () => {
    const q = quote({ whoPrints: "self", addons: ["cartoon", "cartoon-own-voice"] }, FORMATS, ADDONS);
    expect(q.errors).toEqual([]);
    expect(q.totalRub).toBe(2080);
  });
  it("«своим голосом» без мультфильма — ошибка; к уже купленному мультфильму — можно", () => {
    expect(quote({ whoPrints: "self", addons: ["cartoon-own-voice"] }, FORMATS, ADDONS).errors[0]).toMatch(/дополнение к «Оживлению книги»/);
    const later = quote({ whoPrints: "self", addons: ["cartoon-own-voice"], addonsOnly: true, cartoonPaid: true }, FORMATS, ADDONS);
    expect(later.errors).toEqual([]);
    expect(later.totalRub).toBe(400);
  });
  it("докупка из кабинета: без формата, физические допы нельзя, мультфильм дважды нельзя", () => {
    const q = quote({ whoPrints: "self", addons: ["cartoon"], addonsOnly: true }, FORMATS, ADDONS);
    expect(q.lines.map((l) => l.key)).toEqual(["cartoon"]);
    expect(q.totalRub).toBe(690);
    expect(quote({ whoPrints: "self", addons: ["poster"], addonsOnly: true }, FORMATS, ADDONS).errors.length).toBe(1);
    expect(quote({ whoPrints: "self", addons: [], addonsOnly: true }, FORMATS, ADDONS).errors.length).toBe(1);
    expect(quote({ whoPrints: "self", addons: ["cartoon"], addonsOnly: true, cartoonPaid: true }, FORMATS, ADDONS).errors[0]).toMatch(/уже куплен/);
  });
  it("скидка промокода распространяется и на мультфильм", () => {
    const q = quote({ whoPrints: "self", addons: ["cartoon"], discountPct: 10 }, FORMATS, ADDONS);
    expect(q.discountRub).toBe(Math.round((990 + 690) * 0.1));
  });
  it("корзина: «своим голосом» добавляет мультфильм, снятие мультфильма снимает и голос", () => {
    expect(toggleAddon([], "cartoon-own-voice")).toEqual(["cartoon", "cartoon-own-voice"]);
    expect(toggleAddon(["cartoon", "cartoon-own-voice"], "cartoon")).toEqual([]);
    expect(toggleAddon(["cartoon", "cartoon-own-voice"], "cartoon-own-voice")).toEqual(["cartoon"]);
    expect(toggleAddon([], "cartoon-own-voice", true)).toEqual(["cartoon-own-voice"]);
  });
});

describe("записи своего голоса", () => {
  const head = (...b: (number | string)[]) => {
    const out: number[] = [];
    for (const x of b) typeof x === "string" ? out.push(...[...x].map((c) => c.charCodeAt(0))) : out.push(x);
    while (out.length < 32) out.push(0);
    return new Uint8Array(out);
  };
  it("формат — по сигнатуре, а не по расширению", () => {
    expect(sniffAudio(head("RIFF", 0, 0, 0, 0, "WAVE")).format).toBe("wav");
    expect(sniffAudio(head("OggS")).format).toBe("ogg");
    expect(sniffAudio(head(0x1a, 0x45, 0xdf, 0xa3)).format).toBe("webm");
    expect(sniffAudio(head(0, 0, 0, 0x20, "ftypM4A ")).format).toBe("m4a");
    expect(sniffAudio(head(0, 0, 0, 0x20, "ftypisom")).format).toBe("m4a");
    expect(sniffAudio(head("ID3", 4, 0)).format).toBe("mp3");
    expect(sniffAudio(head(0xff, 0xfb, 0x90)).format).toBe("mp3");
    expect(sniffAudio(head(0xff, 0xf1, 0x50)).format).toBe("aac");
    // PNG, PDF, текст с «.mp3» в имени — отклоняются
    expect(sniffAudio(head(0x89, "PNG")).ok).toBe(false);
    expect(sniffAudio(head("%PDF-1.7")).ok).toBe(false);
    expect(sniffAudio(new TextEncoder().encode("это не звук, хоть и называется voice.mp3 ...")).ok).toBe(false);
    expect(sniffAudio(new Uint8Array(4)).ok).toBe(false);
  });
  it("параметры записи: частота ≥ 22,05 кГц, моно/стерео, до 3 минут", () => {
    expect(checkVoiceMeta({ duration: 8, sampleRate: 48000, channels: 1 })).toBeNull();
    expect(checkVoiceMeta({ duration: 8, sampleRate: 44100, channels: 2 })).toBeNull();
    expect(checkVoiceMeta({ duration: 8, sampleRate: 16000, channels: 1 })).toMatch(/22 кГц/);
    expect(checkVoiceMeta({ duration: 200, sampleRate: 48000, channels: 1 })).toMatch(/3 минут/);
    expect(checkVoiceMeta({ duration: 8, sampleRate: 48000, channels: 6 })).toMatch(/моно/);
    expect(checkVoiceMeta({ duration: 0.1, sampleRate: 48000, channels: 1 })).toMatch(/пустая/);
    expect(OWN_VOICE_FORMAT.join(" ")).toMatch(/WAV, MP3, M4A\/AAC, OGG\/Opus, WebM/);
  });
  it("удаление записей: через 30 дней после выдачи, один раз", () => {
    const delivered = new Date("2026-11-01T12:00:00Z");
    const at = voicePurgeDate(delivered);
    expect(at.toISOString()).toBe("2026-12-01T12:00:00.000Z");
    expect(VOICE_LIMITS.purgeDays).toBe(30);
    expect(voiceDueForPurge({ voicePurgeAt: at, voicePurgedAt: null }, new Date("2026-11-30T12:00:00Z"))).toBe(false);
    expect(voiceDueForPurge({ voicePurgeAt: at, voicePurgedAt: null }, new Date("2026-12-01T12:00:01Z"))).toBe(true);
    expect(voiceDueForPurge({ voicePurgeAt: at, voicePurgedAt: new Date() }, new Date("2027-01-01"))).toBe(false);
    expect(voiceDueForPurge({ voicePurgeAt: null, voicePurgedAt: null })).toBe(false);
  });
});

const enabled = Boolean(process.env.DATABASE_URL);
const d = enabled ? describe : describe.skip;

d("мультфильм: БД", async () => {
  process.env.DEMO_MODE = "1";
  process.env.STORAGE_DRIVER = "local";
  const { db } = await import("@/lib/db");
  const orders = await import("@/lib/orders");
  const cartoon = await import("@/lib/cartoon");
  const { hasConsent } = await import("@/lib/consent");
  const { putFile, fileExists } = await import("@/lib/storage");
  const tag = randomUUID().slice(0, 8);
  let user: { id: string };
  let book: { id: string };
  /** Своя готовая книга (и мультфильм) для теста — тесты не зависят от порядка (vitest --sequence.shuffle). */
  async function readyBook(withCartoon = false) {
    const story = await db.story.findFirstOrThrow({ where: { isActive: true } });
    const b = await db.book.create({
      data: { userId: user.id, storyId: story.id, styleKey: "kind-classic", params: { hero: { name: "Маша", gender: "girl" } }, status: "FULL_READY", paidFull: true, text: { title: "Тест", spreads: [] } },
    });
    if (withCartoon) await db.cartoon.create({ data: { bookId: b.id, ownVoicePaid: true } });
    return b;
  }
  beforeAll(async () => {
    user = await db.user.create({ data: { email: `cartoon-${tag}@test.local`, referralCode: `C${tag}`.slice(0, 12).toUpperCase() } });
    book = await readyBook();
    // «Оживление книги» по умолчанию «скоро» (enabled: false) — для проверки продаж включаем
    const { saveSetting, DEFAULTS } = await import("@/lib/settings");
    await saveSetting("cartoon", { ...DEFAULTS.cartoon, enabled: true });
  });

  afterAll(async () => {
    const { getBoss } = await import("@/lib/queue");
    await (await getBoss()).stop({ graceful: false }).catch(() => {});
  });

  it("докупка из кабинета: заказ только с мультфильмом и голосом, цена из настроек", async () => {
    const o = await orders.createOrder(user.id, { bookId: book.id, whoPrints: "self", addons: ["cartoon", "cartoon-own-voice"], addonsOnly: true, contact: { name: "Тест" } });
    const items = await db.orderItem.findMany({ where: { orderId: o.id } });
    expect(items.map((i) => i.refKey).sort()).toEqual(["cartoon", "cartoon-own-voice"]);
    expect(o.totalRub).toBe(690 + 400 - o.discountRub);
    // «Оплачено» → мультфильм создан и поставлен в очередь, генерация книги не нужна
    await db.order.update({ where: { id: o.id }, data: { status: "PAID", paidAt: new Date() } });
    expect(await cartoon.onCartoonPaid(book.id, items)).toBe(true);
    const c = await db.cartoon.findUniqueOrThrow({ where: { bookId: book.id } });
    expect(c.ownVoicePaid).toBe(true);
    expect(c.status).toBe("QUEUED");
    expect(await orders.cartoonPaidFor(book.id)).toBe(true);
    // Второй раз мультфильм не продаём
    await expect(orders.createOrder(user.id, { bookId: book.id, whoPrints: "self", addons: ["cartoon"], addonsOnly: true, contact: { name: "Тест" } })).rejects.toThrow(/уже куплен/);
  });

  it("согласие на голос: отдельная запись VOICE, отзыв — последняя запись", async () => {
    expect(await hasConsent("VOICE", { userId: user.id })).toBe(false);
    await db.consent.create({ data: { userId: user.id, type: "VOICE", docVersion: "voice-test", granted: true } });
    expect(await hasConsent("VOICE", { userId: user.id })).toBe(true);
    await new Promise((r) => setTimeout(r, 5));
    await db.consent.create({ data: { userId: user.id, type: "VOICE", docVersion: "voice-test", granted: false } });
    expect(await hasConsent("VOICE", { userId: user.id })).toBe(false);
  });

  it("записи голоса удаляются по сроку, мультфильм остаётся", async () => {
    const book = await readyBook(true);
    const key = `${book.id}/cartoon-voice/cartoon-cue-01-test.webm`;
    await putFile("books", key, Buffer.from("OggS-test"), "audio/ogg");
    await db.bookFile.create({ data: { bookId: book.id, kind: cartoon.cueKind(1), storageKey: key } });
    await db.bookFile.create({ data: { bookId: book.id, kind: "cartoon", storageKey: `${book.id}/cartoon/x.mp4` } });
    await db.cartoon.update({ where: { bookId: book.id }, data: { voiceCues: { "1": { sec: 3, warnings: [] } }, voicePurgeAt: new Date(Date.now() + 86400_000) } });
    expect(await cartoon.purgeCartoonVoices()).toBe(0); // срок не наступил
    await db.cartoon.update({ where: { bookId: book.id }, data: { voicePurgeAt: new Date(Date.now() - 1000) } });
    expect(await cartoon.purgeCartoonVoices()).toBe(1);
    expect(await fileExists("books", key)).toBe(false);
    const c = await db.cartoon.findUniqueOrThrow({ where: { bookId: book.id } });
    expect(c.voicePurgedAt).not.toBeNull();
    expect(c.voiceCues).toEqual({});
    expect(await db.bookFile.count({ where: { bookId: book.id, kind: "cartoon" } })).toBe(1);
    expect(await cartoon.purgeCartoonVoices()).toBe(0); // повторно ничего
  });

  it("ссылка «Поделиться»: 30 дней, только готовый мультфильм, отзыв", async () => {
    const book = await readyBook(true);
    await db.cartoon.update({ where: { bookId: book.id }, data: { status: "READY" } });
    const s = await cartoon.createShare(book.id);
    expect(s.token.length).toBeGreaterThanOrEqual(22);
    expect(Math.round((s.expiresAt.getTime() - Date.now()) / 86400_000)).toBe(30);
    expect((await cartoon.sharedCartoon(s.token))?.bookId).toBe(book.id);
    expect(await cartoon.sharedCartoon("короткий")).toBeNull();
    await cartoon.revokeShare(book.id);
    expect(await cartoon.sharedCartoon(s.token)).toBeNull();
  });
});

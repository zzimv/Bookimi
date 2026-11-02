// TextProvider: книга по анкете (4 аудитории). Имя героя во внешний сервис не отправляется —
// модель пишет метки {ГЕРОЙ.падеж}, {ДОП1.им}, {Р:…}, {ПОВОД}…; подстановка — у нас (fillTags, declension.ts).
//  YandexGPT — системный промпт голоса (text-styles.ts) + бриф: сегмент (длина, запреты), герой, повод, план сюжета.
//  Demo      — заранее написанные развороты сюжета + крючки повода + доп. герои и увлечения.
// Без Node API: модуль собирается и в демо-стенд (tools/demo).
import { applyGroupScenes, applyOccasion, getPlots, groupMembersMax, groupSlotCount, hooksFor, plotBySlug, textStyle } from "../../content/registry";
import { occasionWord } from "../../content/occasions";
import { titleTemplate } from "../../content/title";
import { OCCASIONS, type Segment } from "../../content/profiles";
import type { Plot, TextStyle } from "../../content/types";
import { appearanceLine, exactAge, extraGender, EXTRA_ROLE_LABELS, heroAge, segmentFor, type QuizAnswers } from "../quiz";
import { fillTags, guessGender, resolveGroupBlocks, type TagContext } from "../declension";
import { personsOf, redactForText } from "./redact";
import { extraMentions, extraVoiceFor } from "./extras";

export interface StoryText {
  title: string;
  spreads: { index: number; text: string; scene: string }[];
}
export interface TextResult {
  raw: StoryText; // с метками
  costKopecks: number;
  provider: string;
}

export interface TextProvider {
  name: string;
  /** plot — готовый сюжет; null — «своя история» по идее покупателя. */
  write(a: QuizAnswers, plot: Plot | null, variant: number): Promise<TextResult>;
  ideas(idea: string, a: QuizAnswers): Promise<{ title: string; summary: string }[]>;
}

/** Группа анкеты, обрезанная по лимитам сюжета (дети — до group.max − 1, взрослые — до includeAdults.max). */
export function groupOf(a: QuizAnswers, plot: Plot | null) {
  if (!plot?.group || !a.group) return { members: [], adults: [] } as NonNullable<QuizAnswers["group"]>;
  return { members: a.group.members.slice(0, groupMembersMax(plot)), adults: a.group.adults.slice(0, plot.group.includeAdults?.max ?? 0) };
}

/** Сюжет из анкеты (null — своя идея). */
export function plotForAnswers(a: QuizAnswers): Plot | null {
  return a.story.slug ? plotBySlug(a.story.slug) : null;
}

/** Голос книги: выбор покупателя → голос сюжета → первый голос сегмента (своя идея). */
export function textStyleFor(a: QuizAnswers, plot: Plot | null): TextStyle | null {
  const seg = segmentFor(a, plot?.segments);
  return textStyle(a.textStyle) ?? (plot ? textStyle(plot.textStyle) : null) ?? textStyle(seg?.textStyleIds[0] ?? "") ?? null;
}

/** Сюжет-основа демо-текста для своей идеи: сюжет сегмента в его первом голосе, иначе любой сюжет аудитории. */
function demoBasePlot(a: QuizAnswers, variant: number): Plot {
  const seg = segmentFor(a);
  const pool = getPlots({ audience: a.audience, segment: seg?.id });
  const voiced = pool.filter((p) => p.textStyle === seg?.textStyleIds[0]);
  const list = voiced.length ? voiced : pool.length ? pool : getPlots({ audience: a.audience });
  return list[variant % list.length] ?? getPlots()[0];
}

// Увлечения (детям) — одна фраза во втором развороте демо-текста
const INTEREST_LINES: Record<string, string> = {
  динозавры: "С собой {ГЕРОЙ.им} взял{Р:|а} любимого плюшевого динозавра — на удачу.",
  космос: "В кармане у {ГЕРОЙ.род} лежала карта звёздного неба — так, на всякий случай.",
  принцессы: "На голове у {ГЕРОЙ.род} сверкала маленькая корона — с ней {Р:он|она} никогда не расставал{Р:ся|ась}.",
  машины: "Рядом катилась любимая машинка {ГЕРОЙ.род} — без неё ни одно приключение не начинается.",
  животные: "Все звери вокруг сразу узнавали {ГЕРОЙ.вин}: {Р:он|она} умеет дружить с животными.",
  спорт: "{ГЕРОЙ.им} бегал{Р:|а} быстрее всех — это ещё не раз пригодится.",
  рисование: "В кармане у {ГЕРОЙ.род} были волшебные мелки: всё, что ими нарисуешь, оживает.",
  музыка: "{ГЕРОЙ.им} тихонько напевал{Р:|а} любимую песенку — от неё становилось теплее.",
  супергерои: "За спиной у {ГЕРОЙ.род} развевался плащ супергероя. Главная суперсила — доброта.",
  море: "На шее у {ГЕРОЙ.род} висела ракушка — если приложить её к уху, слышно море.",
};

// Как назвать доп. героя в демо-фразах («мама Оля»)
const EXTRA_WORD: Record<string, string> = { mom: "мама", dad: "папа", grandma: "бабушка", grandpa: "дедушка" };

/**
 * Какие доп. герои уже названы текстом сюжета: номера слотов 1..3; {ДОПЫ} называет всех. Остальных (2-го и 3-го,
 * если сюжет знает только {ДОП1}) — дописываем своими фразами, а не «всё или ничего».
 */
export function extrasNamedByPlot(spreads: { text: string }[], count: number): Set<number> {
  const all = spreads.map((s) => s.text).join("\n");
  if (/\{ДОПЫ[.}]/.test(all)) return new Set(Array.from({ length: count }, (_, i) => i + 1));
  return new Set([1, 2, 3].filter((n) => new RegExp(`\\{ДОП${n}[.}]`).test(all)));
}

/** Сколько разворотов сюжета уже называют доп. героя n ({ДОПn.*} или {ДОПЫ.*}). */
export function extrasMentionedByPlot(spreads: { text: string }[], count: number): Map<number, number> {
  const m = new Map<number, number>();
  for (let n = 1; n <= Math.min(count, 3); n++) m.set(n, spreads.filter((s) => new RegExp(`\\{ДОП(${n}|Ы)[.}]`).test(s.text)).length);
  return m;
}

/** Строка-обращение для стихов: «— {ДОП1.им}!», «— {ДОП2.им} и {ДОП3.им}!» (кроме меток — одно слово «и»). */
export function extrasAddressLine(count: number, named: Set<number>): string | null {
  const tags = Array.from({ length: Math.min(count, 3) }, (_, i) => i + 1).filter((n) => !named.has(n)).map((n) => `{ДОП${n}.им}`);
  if (!tags.length) return null;
  return `— ${tags.length === 1 ? tags[0] : `${tags.slice(0, -1).join(", ")} и ${tags.at(-1)}`}!`;
}

/** Сказки-цепочки и колыбельные: свой ритм — вставки про увлечения и доп. героев его ломают. */
const NO_INSERT_STYLES = new Set(["cumulative-bedtime", "gentle-bedtime"]);

// Доп. герои, которых сюжет не знает: каждому — своя фраза в начале и в финале, без повторов формулировок.
// {X} — «мама {ДОПn.им}», {N} — номер героя (для {ДОПn.род}, {Рn:…}).
const EXTRA_OPEN = [
  "Рядом стоял{РN:|а} {X} и подмигивал{РN:|а}: ну что, начинаем?",
  "{X} тоже был{РN:|а} тут — куда же без {РN:него|неё}!",
  "{X} был{РN:|а} рядом — с {РN:ним|ней} никогда не бывает скучно.",
  "А {X} уже был{РN:|а} тут как тут: такие дела веселее делать вместе.",
  "Конечно же, {X} был{РN:|а} в деле — такое пропустить нельзя.",
  "{X} шепнул{РN:|а}: «Я с тобой» — и стало совсем не страшно.",
];
const EXTRA_CLOSE = [
  "{X} радовал{РN:ся|ась} громче всех.",
  "И {ГЕРОЙ.им} крепко обнял{Р:|а} {ДОПN.вин}: без {РN:него|неё} ничего бы не получилось.",
  "{X} всё это время был{РN:|а} рядом — и это было самое тёплое чувство на свете.",
  "А {X} улыбнул{РN:ся|ась}: «Я знал{РN:|а}, что у тебя всё получится».",
  "{X} потом ещё долго рассказывал{РN:|а} всем, как это было.",
];
const pickDistinct = (pool: string[], n: number, seed: number) => {
  const out: string[] = [];
  for (let i = 0; out.length < Math.min(n, pool.length); i++) {
    const t = pool[(seed + i * 7) % pool.length];
    if (!out.includes(t)) out.push(t);
  }
  return out;
};
const seedOf = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Фразы про доп. героев: [номер разворота (0..11), текст] — разные шаблоны, разные развороты. */
export function extraLines(extras: { role: string; name: string }[], variant: number, named: Set<number> = new Set()): [number, string][] {
  const n = Math.min(extras.length, 3);
  if (!n || named.size >= n) return [];
  const seed = seedOf(extras.map((e) => e.name).join("|")) + variant;
  const open = pickDistinct(EXTRA_OPEN, n, seed);
  const close = pickDistinct(EXTRA_CLOSE, n, seed + 3);
  const out: [number, string][] = [];
  for (let i = 0; i < n; i++) {
    if (named.has(i + 1)) continue; // уже назван(а) текстом сюжета
    const role = EXTRA_WORD[extras[i].role];
    const put = (t: string, atStart: boolean) =>
      t
        .replace(/\{X\}/g, () => (role ? `${atStart && t.startsWith("{X}") ? role[0].toUpperCase() + role.slice(1) : role} ` : "") + `{ДОП${i + 1}.им}`)
        .replace(/N([:.}])/g, `${i + 1}$1`);
    out.push([i, put(open[i], true)]);
    out.push([n > 1 && i === n - 1 ? 9 : 10, put(close[i], true)]);
  }
  return out;
}

// «Своя история» в демо: сюжет по выбранному варианту идеи (тайна, путешествие, доброе дело).
// {И} — идея покупателя как есть, первой фразой («Лёва строит ракету из коробок и летит к бабушке на Луну»);
// {И1} — её начало до «и»/«а»/запятой («Лёва строит ракету из коробок»). Обе стоят после двоеточия или тире —
// так подходит и фраза-действие, и название («дракон, который боится темноты»). Идея звучит в каждом третьем развороте.
const IDEA_KINDS: { title: string; summary: string; beats: string[] }[] = [
  {
    title: "Тайна",
    summary: "Загадка вокруг вашей идеи — {И} — и герой шаг за шагом раскрывает её вместе с друзьями.",
    beats: [
      "Всё началось в самый обычный день. Задумка была такая: {И}. Но {ГЕРОЙ.им} сразу почувствовал{Р:|а}: здесь кроется тайна.",
      "«Тут что-то не так», — решил{Р:|а} {ГЕРОЙ.им} и достал{Р:|а} блокнот для самых важных записей.",
      "Первая подсказка нашлась там, где её совсем не ждали, — под старым листком у окна.",
      "На листке было всего несколько слов: «{И1} — это только начало».",
      "Вторая подсказка оказалась хитрее: её пришлось разгадывать вслух, по буквам, вместе с друзьями.",
      "Однажды след оборвался. {ГЕРОЙ.им} сел{Р:|а}, подумал{Р:|а} — и вспомнил{Р:|а} мелочь, которую все пропустили.",
      "Мелочь и оказалась ключом. Всё сходилось к одному: {И}.",
      "Друзья шли рядом, а {ГЕРОЙ.им} вёл{Р:|а} — смело и внимательно, как настоящий сыщик.",
      "Последняя дверца поддалась не силе, а терпению.",
      "За ней было то, ради чего всё затевалось: {И}! Лучше любого сокровища.",
      "Тайна раскрылась, и все ахнули: так вот в чём было дело!",
      "Вечером {ГЕРОЙ.им} записал{Р:|а} в блокнот: «Разгадано!» И ниже, мелко: «Жду новую тайну».",
    ],
  },
  {
    title: "Большое путешествие",
    summary: "Ваша идея — {И} — превращается в путешествие через три удивительных места, где герою помогают смелость и смекалка.",
    beats: [
      "Однажды {ГЕРОЙ.им} понял{Р:|а}: пора в путь. План был простой: {И}.",
      "Рюкзак собрался сам собой: фонарик, яблоко, карта и немного смелости.",
      "Первое место оказалось шумным и пёстрым — здесь {ГЕРОЙ.им} впервые почувствовал{Р:|а}, как далеко ушёл{Р:|а}.",
      "Там подсказали дорогу и дали в подарок маленький компас. «Главное — не сворачивай», — сказали на прощание.",
      "Второе место было тихим, как утро. Самое время вспомнить, ради чего всё: {И1}.",
      "Смекалка не подвела: нашлась обходная тропинка, о которой не знал никто.",
      "Третье место было самым удивительным. Именно здесь {ГЕРОЙ.им} поверил{Р:|а} по-настоящему: {И}.",
      "На пути встретилась преграда. {ГЕРОЙ.им} глубоко вдохнул{Р:|а} — и шагнул{Р:|а} вперёд.",
      "Оказалось, смелость — это когда страшно, но ты всё равно идёшь.",
      "И получилось — всё как задумано: {И}.",
      "Дорога домой всегда короче. Дома ждали, обнимали и слушали, не перебивая.",
      "А на карте с тех пор горят три новые отметки — и место для четвёртой.",
    ],
  },
  {
    title: "Добрая история",
    summary: "Тёплая история: ваша идея — {И} — получается, потому что герою помогают все вокруг.",
    beats: [
      "Утром {ГЕРОЙ.им} проснул{Р:ся|ась} с хорошей мыслью: {И}.",
      "Одному такое не сделать. Значит, нужно позвать тех, кто рядом.",
      "Сначала откликнулся сосед: «Чем помочь?» А за ним — ещё двое.",
      "Работы хватило всем. Начали с главного: {И1}.",
      "Не всё получалось сразу. Но {ГЕРОЙ.им} не сдавал{Р:ся|ась} — ведь задумано было по-настоящему.",
      "Кто-то принёс краски, кто-то — пироги, а кто-то просто пришёл помочь.",
      "Дело спорилось. Ещё чуть-чуть — и задумка сбудется: {И}.",
      "Вокруг стало светлее — будто кто-то включил ещё одно солнце.",
      "«Это ты придумал{Р:|а}?» — спрашивали все. {ГЕРОЙ.им} только смущённо кивал{Р:|а}.",
      "Вечером все собрались вместе и долго не хотели расходиться.",
      "Вспоминали, как всё начиналось — с одной мысли: {И1}. И смеялись.",
      "Так {ГЕРОЙ.им} узнал{Р:|а} главный секрет: всё получается, если делать вместе.",
    ],
  },
];

/** Служебное начало идеи: «Хочу сказку про…», «История о том, как…», «Пусть…». */
const IDEA_FILLER = /^(?:(?:я\s+)?(?:хочу|хотим|хотелось бы)\s+)?(?:(?:историю|история|сказку|сказка|книгу|книга|книжку|книжка|рассказ)\s+)?(?:(?:(?:о|об)\s+том|про\s+то),?\s+(?:как|что)\s+|как\s+|чтобы\s+|пусть\s+)?/i;
/** Слова, на которых нельзя обрывать название. */
const TAIL_WORDS = /\s+(?:и|а|но|или|в|во|на|с|со|к|ко|о|об|у|за|по|из|от|до|для|про|под|над|при|без|через|который|которая|которое|которые|что|чтобы|как|где|когда|его|её|их|не)$/i;

/** Первая фраза идеи без служебного начала, с заглавной буквы — как в тексте (имена не трогаем). */
export function ideaTopic(idea: string): string {
  const first = (idea.replace(/\s+/g, " ").trim().split(/[.!?;\n]/)[0] ?? "").trim();
  const t = first.replace(IDEA_FILLER, "").replace(/[,:—-]+$/, "").trim() || first;
  return t ? capFirst(t) : "Волшебное приключение";
}

/** Начало идеи — до первого «и»/«а»/«но»/запятой («Лёва строит ракету из коробок»). */
export function ideaHead(idea: string): string {
  const t = ideaTopic(idea);
  const m = t.match(/^(.{8,}?)(?:,\s|\s+(?:и|а|но|чтобы)\s)/);
  return m ? m[1] : t;
}

/**
 * Название книги по идее: начало идеи с заглавной, не длиннее 40 символов, обрезано по границе слова
 * и не на предлоге/союзе («Лёва строит ракету из коробок», «Дракон, который боится темноты»).
 */
export function ideaTitle(idea: string, max = 40): string {
  let t = ideaTopic(idea);
  if (t.length > max) {
    const head = ideaHead(idea);
    t = head.length <= max && head.length >= 12 ? head : t.slice(0, max + 1).replace(/\s+\S*$/, "");
  }
  for (let i = 0; i < 4 && TAIL_WORDS.test(t); i++) t = t.replace(TAIL_WORDS, "");
  return capFirst(t.replace(/[,:;—-]+$/, "").trim());
}
const capFirst = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Развороты «своей истории» по выбранному варианту идеи (демо). */
function ideaSpreads(a: QuizAnswers): string[] | null {
  const idea = a.story.idea?.trim();
  if (!idea) return null;
  const choice = a.story.ideaChoice;
  const kind = IDEA_KINDS.find((k) => choice?.title.startsWith(k.title)) ?? IDEA_KINDS[0];
  // «Про дракона…» в повествовании — «история про дракона…» (после двоеточия иначе повиснет предлог)
  const asStory = (x: string) => (/^(про|о|об)\s/i.test(x) ? `история ${x[0].toLowerCase()}${x.slice(1)}` : x);
  const full = asStory(ideaTopic(idea));
  const head = asStory(ideaHead(idea));
  // После двоеточия — со строчной, если это не имя (сверяем с героем и доп. героями). Идея начинается с имени героя
  // («Лёва строит ракету…») — в повествовании имя меняем на «он/она», чтобы не повторять его дважды в фразе.
  const word1 = (x: string) => x.split(/[\s,]+/)[0].toLowerCase();
  const hero = (a.hero.name ?? "").trim().split(/\s+/)[0].toLowerCase();
  const names = [a.hero.name, ...a.extras.map((e) => e.name)].filter(Boolean).map((x) => x.trim().split(/\s+/)[0].toLowerCase());
  const narr = (x: string) => {
    if (hero && word1(x) === hero) return `{Р:он|она}${x.slice(x.split(/[\s,]/)[0].length)}`;
    return names.includes(word1(x)) ? x : x[0].toLowerCase() + x.slice(1);
  };
  return kind.beats.map((b) =>
    b
      .replace(/«\{И1\}/g, `«${head}`)
      .replace(/\{И1\}/g, narr(head))
      .replace(/\{И\}/g, narr(full)),
  );
}

/** Демо-генерация без внешних сервисов: развороты сюжета + повод + увлечения + доп. герои. */
export class DemoTextProvider implements TextProvider {
  name = "demo";

  async write(a: QuizAnswers, plot: Plot | null, variant: number): Promise<TextResult> {
    let base = plot ?? demoBasePlot(a, variant);
    // Своя идея: развороты — по варианту идеи; картинки (сцены) — от сюжета-основы
    const own = plot ? null : ideaSpreads(a);
    if (own) base = { ...base, textStyle: "", spreads: base.spreads.map((s, i) => ({ ...s, text: own[i] ?? s.text })) };
    const g = groupOf(a, base);
    const spreads = applyGroupScenes(base, applyOccasion(base, a.occasion.key, a.occasion.custom), g.members.length, g.adults.length).map((s, i) => ({ index: i + 1, text: s.text, scene: s.scene }));
    const verse = !!textStyle(base.textStyle)?.verse;
    // Вставки по сцене: увлечения — не в стихах, колыбельных и сказках-цепочках («бегал быстрее всех» в колыбельной);
    // фразы о доп. героях — не в стихах и цепочках (ритм), в колыбельной — можно (они спокойные и без места действия)
    const rhythm = verse || base.textStyle === "cumulative-bedtime";
    const inserts = !rhythm && !NO_INSERT_STYLES.has(base.textStyle);
    if (a.audience === "CHILD" && inserts) {
      const interest = [...a.interests, a.interestCustom].map((x) => INTEREST_LINES[x?.toLowerCase?.() ?? ""]).find(Boolean);
      if (interest) spreads[1].text += " " + interest;
    }
    // Детские книги: каждый доп. герой — минимум трижды (начало, середина, финал) готовыми фразами по роли (extras.ts),
    // во всех голосах: проза — фразой в конце разворота, колыбельные и цепочки — тихой строкой, стихи — загадкой с именем
    // отдельной строкой. Сюжет, который сам называет {ДОПn}, получает столько фраз, сколько не хватает до трёх.
    if (a.audience === "CHILD" && a.extras.length) {
      const voice = extraVoiceFor(base.textStyle, verse);
      const sep = voice === "prose" || base.textStyle === "gentle-bedtime" ? " " : "\n";
      for (const m of extraMentions(a.extras, voice, variant, extrasMentionedByPlot(base.spreads, a.extras.length))) spreads[m.spread].text += sep + m.text;
    }
    // Доп. герои, которых сюжет не называет (по слотам: 2-й и 3-й — даже если 1-й уже в сюжете)
    const named = extrasNamedByPlot(base.spreads, a.extras.length);
    if (a.audience !== "CHILD" && a.extras.length && !rhythm) {
      for (const [i, line] of extraLines(a.extras, variant, named)) spreads[i].text += " " + line;
    }
    // Стихи и цепочки: не названные сюжетом доп. герои — отдельной строкой-обращением вне метра («— {ДОП2.им}!»)
    if (a.audience !== "CHILD" && a.extras.length && rhythm) {
      const line = extrasAddressLine(a.extras.length, named);
      if (line) spreads[1].text += `\n${line}`;
    }
    if (variant > 0 && inserts) spreads[11].text = spreads[11].text + " Это была самая лучшая история.";
    let title = titleTemplate(base.title);
    if (!plot) {
      // Вариант демо («Тайна: …») — название по самой идее; настоящее название варианта (YandexGPT) — как есть
      const ct = a.story.ideaChoice?.title;
      const demoChoice = !!ct && IDEA_KINDS.some((k) => ct.startsWith(`${k.title}:`));
      title = ct && !demoChoice ? ct : a.story.idea?.trim() ? ideaTitle(a.story.idea) : "История по вашей идее";
    }
    return { raw: { title, spreads }, costKopecks: 0, provider: this.name };
  }

  async ideas(idea: string) {
    const title = ideaTitle(idea);
    const topic = ideaTopic(idea);
    return IDEA_KINDS.map((k) => ({ title: `${k.title}: ${title}`, summary: k.summary.replace("{И}", `«${topic}»`) }));
  }
}

const GENDER_WORD: Record<string, [string, string]> = {
  CHILD: ["мальчик", "девочка"],
  TEEN: ["парень", "девушка"],
  ADULT: ["мужчина", "женщина"],
  PET: ["он (самец)", "она (самка)"],
};

function segmentBlock(seg: Segment | undefined) {
  if (!seg) return [];
  return [
    `Сегмент: ${seg.title} (${seg.id}). Кому: ${seg.recipient}.`,
    `Длина: ${seg.text.wordsPerSpread[0]}–${seg.text.wordsPerSpread[1]} слов на разворот; ${seg.text.sentenceStyle}. Лексика: ${seg.text.vocabulary}.`,
    `Тон: ${seg.tone}.`,
    `Запреты сегмента: ${seg.taboo.join("; ")}.`,
  ];
}

/** Бриф для YandexGPT: без имён — только метки, роли, возраст, детали анкеты. */
export function brief(a: QuizAnswers, plot: Plot | null, style: TextStyle | null) {
  const seg = segmentFor(a, plot?.segments);
  // Свободный текст покупателя: имена → метки, контакты и ссылки — прочь (redact.ts)
  const persons = personsOf(a, (e) => extraGender(e as QuizAnswers["extras"][number], guessGender));
  const clean = (t: string | undefined | null) => redactForText(t, persons);
  const g = GENDER_WORD[a.audience] ?? GENDER_WORD.CHILD;
  const lines: string[] = [...segmentBlock(seg)];
  lines.push(`Главный герой: {ГЕРОЙ.им}, ${a.hero.gender === "girl" ? g[1] : g[0]}.`);
  if (a.audience === "CHILD" || a.audience === "TEEN") lines.push(`Возраст героя: ${heroAge(a)}.`);
  if (a.audience === "PET") {
    const sp = a.pet.species === "cat" ? "кошка" : a.pet.species === "dog" ? "собака" : "домашний питомец";
    const breed = clean(a.pet.breed), fur = clean(a.pet.furColor);
    lines.push(`Питомец: ${sp}${breed ? `, порода: ${breed}` : ""}${fur ? `, окрас: ${fur}` : ""}.`);
    if (a.pet.traits) lines.push(`Характер и привычки: ${clean(a.pet.traits)}.`);
  }
  if (a.audience === "ADULT") {
    const d = a.adult;
    if (d.profession) lines.push(`Чем занимается: ${clean(d.profession)}.`);
    if (d.relation) lines.push(`Кем приходится дарителю: ${clean(d.relation)}.`);
    if (d.howMet) lines.push(`Как познакомились: ${clean(d.howMet)}.`);
    if (d.memories.length) lines.push(`Общие воспоминания: ${d.memories.map(clean).join(" / ")}.`);
  }
  const interests = [...a.interests, a.interestCustom].filter(Boolean).map(clean);
  if (interests.length) lines.push(`Увлечения: ${interests.join(", ")}.`);
  const look = clean(appearanceLine(a));
  if (look) lines.push(`Внешность (для описаний сцен): ${look}.`);
  lines.push(
    a.extras.length
      ? `Дополнительные герои: ${a.extras.map((e, i) => `{ДОП${i + 1}} — ${EXTRA_ROLE_LABELS[e.role] ?? e.role}${e.what ? ` (${clean(e.what)})` : ""}${e.description ? `: ${clean(e.description)}` : ""}`).join("; ")}. Все вместе — {ДОПЫ}. Каждого назови не меньше трёх раз — в начале, в середине и в финале, на разных разворотах${style?.verse ? " (в стихах — отдельной строкой-обращением: «— {ДОП2.им}!»)" : ""}.`
      : "Дополнительных героев нет.",
  );
  const grp = groupOf(a, plot);
  if (plot?.group) {
    const S = groupSlotCount(plot);
    const n = grp.members.length;
    lines.push(
      n
        ? `Группа (${plot.group.label}): кроме героя ещё ${n} ${n % 10 === 1 && n % 100 !== 11 ? "ребёнок" : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "ребёнка" : "детей"}. Имена — только метками слотов из плана: {ДРУГ1}…{ДРУГ${Math.min(S, n)}} (слот может означать нескольких детей — согласуй слова формами {РДn:м|ж|мн}). Каждый слот из плана сохрани: так каждый ребёнок будет назван. Ведомость {ПЕРЕКЛИЧКА} не меняй. Не придумывай других имён детей.`
        : `Группа (${plot.group.label}): других детей в анкете нет — пиши «ребята», «друзья», без имён.`,
    );
    if (grp.adults.length) lines.push(`Взрослые группы: ${grp.adults.map((x, i) => `{ВОСПИТАТЕЛЬ${i + 1}} — ${x.role}`).join("; ")} (зови по имени-отчеству метками; род — {РВn:м|ж}).`);
  }
  const occ = OCCASIONS.find((o) => o.key === a.occasion.key);
  // «Свой повод» — свободный текст: и в строке повода, и в заготовках/плане сюжета — только очищенный
  const occCustom = clean(a.occasion.custom);
  if (a.occasion.key && a.occasion.key !== "bez" && (a.occasion.key !== "svoj" || a.occasion.custom)) {
    const w = occasionWord(a.occasion.key, a.occasion.key === "svoj" ? occCustom : "");
    const grammar = w && a.occasion.key !== "svoj" ? ` (в тексте это слово «${w.им}», ${w.gender === "f" ? "женский" : w.gender === "n" ? "средний" : "мужской"} род; в падеже — {ПОВОД.род}, {ПОВОД.дат}…; не ставь рядом с меткой прилагательные по роду)` : "";
    lines.push(`Повод: ${a.occasion.key === "svoj" ? occCustom : occ?.label}. В тексте повод — метка {ПОВОД}${grammar}.`);
    const h = plot ? hooksFor(plot, a.occasion.key, occCustom) : null;
    if (h && (h.opening || h.closing)) lines.push(`Заготовки повода (перепиши своим голосом): начало — «${h.opening.replace(/\n/g, " / ")}»; финал — «${h.closing.replace(/\n/g, " / ")}».`);
  } else lines.push("Повода нет.");
  if (style) lines.push(`Голос книги: «${style.title}»${style.verse ? " (стихи)" : ""}.`);
  if (plot) {
    lines.push(`Сюжет «${titleTemplate(plot.title)}». Следуй плану по разворотам (можно менять детали и формулировки, сохраняя ход событий):`);
    // План группы — под её размер (лишние слоты выпали, блоки раскрыты), имён нет — только метки
    const counts = { members: grp.members.length, adults: grp.adults.length, slots: groupSlotCount(plot) };
    applyOccasion(plot, a.occasion.key, occCustom).forEach((s, i) => lines.push(`${i + 1}. ${resolveGroupBlocks(s.text, counts).replace(/\n/g, " / ")}`));
  } else {
    const idea = a.story.ideaChoice ? `${a.story.ideaChoice.title}: ${a.story.ideaChoice.summary}` : a.story.idea;
    lines.push(`Сюжет по идее покупателя: ${clean(idea)}`);
  }
  return lines.join("\n");
}

/** YandexGPT (Yandex AI Studio). Ключ и каталог — в .env. Стоимость — по токенам из настроек. */
export class YandexGptProvider implements TextProvider {
  name = "yandexgpt";
  constructor(private rubPer1kTokens = Number(process.env.YANDEXGPT_RUB_PER_1K ?? 1.2)) {}

  private async complete(system: string, user: string, temperature = 0.7) {
    const folder = process.env.YANDEX_CLOUD_FOLDER_ID;
    const key = process.env.YANDEX_CLOUD_API_KEY;
    if (!folder || !key) throw new Error("YandexGPT: не заданы YANDEX_CLOUD_FOLDER_ID / YANDEX_CLOUD_API_KEY");
    const r = await fetch("https://llm.api.cloud.yandex.net/foundationModels/v1/completion", {
      method: "POST",
      headers: { Authorization: `Api-Key ${key}`, "x-folder-id": folder, "Content-Type": "application/json" },
      body: JSON.stringify({
        modelUri: `gpt://${folder}/${process.env.YANDEXGPT_MODEL ?? "yandexgpt/latest"}`,
        completionOptions: { stream: false, temperature, maxTokens: "8000" },
        messages: [
          { role: "system", text: system },
          { role: "user", text: user },
        ],
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!r.ok) throw new Error(`YandexGPT ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const j = (await r.json()) as { result: { alternatives: { message: { text: string } }[]; usage?: { totalTokens?: string } } };
    const tokens = Number(j.result.usage?.totalTokens ?? 0);
    return { text: j.result.alternatives[0].message.text, costKopecks: Math.round((tokens / 1000) * this.rubPer1kTokens * 100) };
  }

  /** Свободный запрос (сценарий мультфильма): текст уже обезличен — только метки {ГЕРОЙ.*}. */
  async chat(system: string, user: string, temperature = 0.4) {
    return this.complete(system, user, temperature);
  }

  async write(a: QuizAnswers, plot: Plot | null, variant: number): Promise<TextResult> {
    const style = textStyleFor(a, plot);
    if (!style) throw new Error("нет голоса книги для этой анкеты");
    const user = brief(a, plot, style) + (variant ? `\nВариант ${variant + 1}: напиши по-новому.` : "");
    const { text, costKopecks } = await this.complete(style.systemPrompt, user, 0.6 + variant * 0.15);
    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const parsed = JSON.parse(json) as { title: string; spreads: { text: string; scene: string }[] };
    if (!Array.isArray(parsed.spreads) || parsed.spreads.length < 10) throw new Error("YandexGPT: неполный ответ");
    // Для готовых сюжетов — проверенные описания сцен (с реквизитом повода)
    const g = groupOf(a, plot);
    const planned = plot ? applyGroupScenes(plot, applyOccasion(plot, a.occasion.key, a.occasion.custom), g.members.length, g.adults.length) : null;
    const spreads = parsed.spreads.slice(0, 12).map((s, i) => ({ index: i + 1, text: s.text, scene: planned?.[i]?.scene ?? s.scene }));
    return { raw: { title: plot ? titleTemplate(plot.title) : parsed.title, spreads }, costKopecks, provider: this.name };
  }

  async ideas(idea: string, a: QuizAnswers) {
    const seg = segmentFor(a);
    const who = { CHILD: "ребёнок", TEEN: "подросток", ADULT: "взрослый близкий человек", PET: "домашний питомец" }[a.audience];
    const { text } = await this.complete(
      "Ты — автор персональных иллюстрированных книг. Предложи 3 разных сюжета для персональной книги. Ответ — только JSON: [{\"title\":\"...\",\"summary\":\"...\"}]. Без имён, без страшного, без брендов и чужих персонажей.",
      `Идея покупателя: ${ideaForModel(idea, a)}\nГлавный герой: ${who}${a.audience === "CHILD" || a.audience === "TEEN" ? `, возраст ${heroAge(a)}` : ""}. ${seg ? `Сегмент: ${seg.title}. Запреты: ${seg.taboo.join("; ")}.` : ""}`,
      0.9,
    );
    return (JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1)) as { title: string; summary: string }[]).slice(0, 3);
  }
}

/** Идея «своей истории» для модели: имена → метки, контакты прочь. */
export function ideaForModel(idea: string, a: QuizAnswers) {
  return redactForText(idea, personsOf(a, (e) => extraGender(e as QuizAnswers["extras"][number], guessGender)));
}

export function textProvider(name: string): TextProvider {
  return name === "yandexgpt" ? new YandexGptProvider() : new DemoTextProvider();
}

/** Контекст меток анкеты: герой, доп. герои с родом, повод, возраст. */
export function tagContext(a: QuizAnswers): TagContext {
  const plot = plotForAnswers(a);
  const g = groupOf(a, plot);
  return {
    group: plot?.group
      ? {
          members: g.members.map((m) => ({ name: m.name, gender: m.gender ?? guessGender(m.name) })),
          adults: g.adults.map((x) => ({ name: x.name, gender: x.gender ?? guessGender(x.name) })),
          slots: groupSlotCount(plot),
        }
      : undefined,
    hero: { name: a.hero.name, nickname: a.hero.nickname || a.hero.name, gender: a.hero.gender },
    extras: a.extras.map((e) => ({ name: e.name, gender: extraGender(e, guessGender) })),
    occasion: occasionWord(a.occasion.key, a.occasion.custom) ?? "",
    age: exactAge(a),
  };
}

/** Подстановка имён, рода, повода и возраста — финальный текст для показа покупателю. */
export function personalize(raw: StoryText, a: QuizAnswers): StoryText {
  const ctx = tagContext(a);
  const f = (t: string) => fillTags(titleTemplate(t), ctx);
  return { title: f(raw.title), spreads: raw.spreads.map((s) => ({ ...s, text: f(s.text) })) };
}

export function dedicationText(a: QuizAnswers) {
  if (!a.dedication) return "";
  return personalize({ title: a.dedication, spreads: [] }, a).title;
}


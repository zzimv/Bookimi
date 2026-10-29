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
  принцессы: "На голове у {ГЕРОЙ.род} сверкала маленькая корона — {ГЕРОЙ.им} никогда с ней не расставал{Р:ся|ась}.",
  машины: "Рядом катилась любимая машинка {ГЕРОЙ.род} — без неё ни одно приключение не начинается.",
  животные: "Все звери вокруг сразу узнавали {ГЕРОЙ.вин}: {ГЕРОЙ.им} умеет дружить с животными.",
  спорт: "{ГЕРОЙ.им} бегал{Р:|а} быстрее всех — это ещё не раз пригодится.",
  рисование: "В кармане у {ГЕРОЙ.род} были волшебные мелки: всё, что ими нарисуешь, оживает.",
  музыка: "{ГЕРОЙ.им} тихонько напевал{Р:|а} любимую песенку — от неё становилось теплее.",
  супергерои: "За спиной у {ГЕРОЙ.род} развевался плащ супергероя. Главная суперсила — доброта.",
  море: "На шее у {ГЕРОЙ.род} висела ракушка — если приложить её к уху, слышно море.",
};

// Как назвать доп. героя в демо-фразе «Рядом был(и) …»
const EXTRA_WORD: Record<string, string> = { mom: "мама", dad: "папа", grandma: "бабушка", grandpa: "дедушка" };

/** Ссылается ли текст сюжета на доп. героев (тогда они уже вплетены в сюжет). */
const usesExtras = (spreads: { text: string }[]) => spreads.some((s) => /\{(ДОП[1-3]|ДОПЫ)[.}]/.test(s.text));

/** Демо-генерация без внешних сервисов: развороты сюжета + повод + увлечения + доп. герои. */
export class DemoTextProvider implements TextProvider {
  name = "demo";

  async write(a: QuizAnswers, plot: Plot | null, variant: number): Promise<TextResult> {
    const base = plot ?? demoBasePlot(a, variant);
    const g = groupOf(a, base);
    const spreads = applyGroupScenes(base, applyOccasion(base, a.occasion.key, a.occasion.custom), g.members.length, g.adults.length).map((s, i) => ({ index: i + 1, text: s.text, scene: s.scene }));
    const verse = !!textStyle(base.textStyle)?.verse;
    if (a.audience === "CHILD" && !verse) {
      const interest = [...a.interests, a.interestCustom].map((x) => INTEREST_LINES[x?.toLowerCase?.() ?? ""]).find(Boolean);
      if (interest) spreads[1].text += " " + interest;
    }
    // Доп. герои, которых сюжет не знает, — одной фразой в начале и в конце (стихи не трогаем)
    if (a.extras.length && !usesExtras(base.spreads) && !verse) {
      const names = a.extras.map((e, i) => `${EXTRA_WORD[e.role] ? EXTRA_WORD[e.role] + " " : ""}{ДОП${i + 1}.им}`.trim());
      const list = names.length > 1 ? names.slice(0, -1).join(", ") + " и " + names.at(-1) : names[0];
      spreads[0].text += ` Рядом, конечно, был${a.extras.length > 1 ? "и" : ""} ${list}.`;
      // «И Облако, и Робот Бип — тоже рядом»: перечисление с повторяющимся «и» — через запятую
      spreads[10].text += names.length > 1 ? ` И ${names.join(", и ")} — тоже рядом.` : ` И ${list} — тоже рядом.`;
    }
    if (variant > 0 && !verse) spreads[11].text = spreads[11].text + " Это была самая лучшая история.";
    let title = titleTemplate(base.title);
    if (!plot) title = a.story.ideaChoice?.title ?? "История по вашей идее";
    return { raw: { title, spreads }, costKopecks: 0, provider: this.name };
  }

  async ideas(idea: string) {
    const base = idea.replace(/\s+/g, " ").trim().slice(0, 80) || "волшебное приключение";
    return [
      { title: `Тайна: ${base}`, summary: `Герой находит загадку, связанную с идеей «${base}», и шаг за шагом раскрывает её с друзьями.` },
      { title: `Большое путешествие`, summary: `Идея «${base}» превращается в путешествие через три удивительных места, где герою помогают смелость и смекалка.` },
      { title: `Добрая история`, summary: `Тёплая история о том, как герой делает доброе дело, вдохновлённое идеей «${base}», и мир становится чуточку лучше.` },
    ];
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
    lines.push(`Питомец: ${sp}${a.pet.breed ? `, порода: ${a.pet.breed}` : ""}${a.pet.furColor ? `, окрас: ${a.pet.furColor}` : ""}.`);
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
      ? `Дополнительные герои: ${a.extras.map((e, i) => `{ДОП${i + 1}} — ${EXTRA_ROLE_LABELS[e.role] ?? e.role}${e.what ? ` (${clean(e.what)})` : ""}${e.description ? `: ${clean(e.description)}` : ""}`).join("; ")}. Все вместе — {ДОПЫ}.`
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
  if (a.occasion.key && a.occasion.key !== "bez" && (a.occasion.key !== "svoj" || a.occasion.custom)) {
    const w = occasionWord(a.occasion.key, a.occasion.key === "svoj" ? clean(a.occasion.custom) : "");
    const grammar = w && a.occasion.key !== "svoj" ? ` (в тексте это слово «${w.им}», ${w.gender === "f" ? "женский" : w.gender === "n" ? "средний" : "мужской"} род; в падеже — {ПОВОД.род}, {ПОВОД.дат}…; не ставь рядом с меткой прилагательные по роду)` : "";
    lines.push(`Повод: ${a.occasion.key === "svoj" ? clean(a.occasion.custom) : occ?.label}. В тексте повод — метка {ПОВОД}${grammar}.`);
    const h = plot ? hooksFor(plot, a.occasion.key, a.occasion.custom) : null;
    if (h && (h.opening || h.closing)) lines.push(`Заготовки повода (перепиши своим голосом): начало — «${h.opening.replace(/\n/g, " / ")}»; финал — «${h.closing.replace(/\n/g, " / ")}».`);
  } else lines.push("Повода нет.");
  if (style) lines.push(`Голос книги: «${style.title}»${style.verse ? " (стихи)" : ""}.`);
  if (plot) {
    lines.push(`Сюжет «${titleTemplate(plot.title)}». Следуй плану по разворотам (можно менять детали и формулировки, сохраняя ход событий):`);
    // План группы — под её размер (лишние слоты выпали, блоки раскрыты), имён нет — только метки
    const counts = { members: grp.members.length, adults: grp.adults.length, slots: groupSlotCount(plot) };
    applyOccasion(plot, a.occasion.key, a.occasion.custom).forEach((s, i) => lines.push(`${i + 1}. ${resolveGroupBlocks(s.text, counts).replace(/\n/g, " / ")}`));
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


// TextProvider: книга по анкете (4 аудитории). Имя героя во внешний сервис не отправляется —
// модель пишет метки {ГЕРОЙ.падеж}, {ДОП1.им}, {Р:…}, {ПОВОД}…; подстановка — у нас (fillTags, declension.ts).
//  YandexGPT — системный промпт голоса (text-styles.ts) + бриф: сегмент (длина, запреты), герой, повод, план сюжета.
//  Demo      — заранее написанные развороты сюжета + крючки повода + доп. герои и увлечения.
// Без Node API: модуль собирается и в демо-стенд (tools/demo).
import { applyOccasion, getPlots, hooksFor, plotBySlug, textStyle } from "../../content/registry";
import { occasionText } from "../../content/occasions";
import { OCCASIONS, type Segment } from "../../content/profiles";
import type { Plot, TextStyle } from "../../content/types";
import { appearanceLine, exactAge, extraGender, EXTRA_ROLE_LABELS, heroAge, segmentFor, type QuizAnswers } from "../quiz";
import { fillTags, guessGender, type TagContext } from "../declension";

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
    const spreads = applyOccasion(base, a.occasion.key, a.occasion.custom).map((s, i) => ({ index: i + 1, text: s.text, scene: s.scene }));
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
      spreads[10].text += ` И ${list} — тоже рядом.`;
    }
    if (variant > 0 && !verse) spreads[11].text = spreads[11].text + " Это была самая лучшая история.";
    let title = base.title.replace("[Имя]", "{ГЕРОЙ.им}");
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
  const g = GENDER_WORD[a.audience] ?? GENDER_WORD.CHILD;
  const lines: string[] = [...segmentBlock(seg)];
  lines.push(`Главный герой: {ГЕРОЙ.им}, ${a.hero.gender === "girl" ? g[1] : g[0]}.`);
  if (a.audience === "CHILD" || a.audience === "TEEN") lines.push(`Возраст героя: ${heroAge(a)}.`);
  if (a.audience === "PET") {
    const sp = a.pet.species === "cat" ? "кошка" : a.pet.species === "dog" ? "собака" : "домашний питомец";
    lines.push(`Питомец: ${sp}${a.pet.breed ? `, порода: ${a.pet.breed}` : ""}${a.pet.furColor ? `, окрас: ${a.pet.furColor}` : ""}.`);
    if (a.pet.traits) lines.push(`Характер и привычки: ${a.pet.traits}.`);
  }
  if (a.audience === "ADULT") {
    const d = a.adult;
    if (d.profession) lines.push(`Чем занимается: ${d.profession}.`);
    if (d.relation) lines.push(`Кем приходится дарителю: ${d.relation}.`);
    if (d.howMet) lines.push(`Как познакомились: ${d.howMet}.`);
    if (d.memories.length) lines.push(`Общие воспоминания: ${d.memories.join(" / ")}.`);
  }
  const interests = [...a.interests, a.interestCustom].filter(Boolean);
  if (interests.length) lines.push(`Увлечения: ${interests.join(", ")}.`);
  const look = appearanceLine(a);
  if (look) lines.push(`Внешность (для описаний сцен): ${look}.`);
  lines.push(
    a.extras.length
      ? `Дополнительные герои: ${a.extras.map((e, i) => `{ДОП${i + 1}} — ${EXTRA_ROLE_LABELS[e.role] ?? e.role}${e.what ? ` (${e.what})` : ""}${e.description ? `: ${e.description}` : ""}`).join("; ")}. Все вместе — {ДОПЫ}.`
      : "Дополнительных героев нет.",
  );
  const occ = OCCASIONS.find((o) => o.key === a.occasion.key);
  if (a.occasion.key && a.occasion.key !== "bez" && (a.occasion.key !== "svoj" || a.occasion.custom)) {
    lines.push(`Повод: ${a.occasion.key === "svoj" ? a.occasion.custom : occ?.label}. В тексте повод — метка {ПОВОД}.`);
    const h = plot ? hooksFor(plot, a.occasion.key, a.occasion.custom) : null;
    if (h && (h.opening || h.closing)) lines.push(`Заготовки повода (перепиши своим голосом): начало — «${h.opening}»; финал — «${h.closing}».`);
  } else lines.push("Повода нет.");
  if (style) lines.push(`Голос книги: «${style.title}»${style.verse ? " (стихи)" : ""}.`);
  if (plot) {
    lines.push(`Сюжет «${plot.title.replace("[Имя]", "{ГЕРОЙ.им}")}». Следуй плану по разворотам (можно менять детали и формулировки, сохраняя ход событий):`);
    applyOccasion(plot, a.occasion.key, a.occasion.custom).forEach((s, i) => lines.push(`${i + 1}. ${s.text.replace(/\n/g, " / ")}`));
  } else {
    const idea = a.story.ideaChoice ? `${a.story.ideaChoice.title}: ${a.story.ideaChoice.summary}` : a.story.idea;
    lines.push(`Сюжет по идее покупателя: ${idea}`);
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
    const planned = plot ? applyOccasion(plot, a.occasion.key, a.occasion.custom) : null;
    const spreads = parsed.spreads.slice(0, 12).map((s, i) => ({ index: i + 1, text: s.text, scene: planned?.[i]?.scene ?? s.scene }));
    return { raw: { title: plot ? plot.title.replace("[Имя]", "{ГЕРОЙ.им}") : parsed.title, spreads }, costKopecks, provider: this.name };
  }

  async ideas(idea: string, a: QuizAnswers) {
    const seg = segmentFor(a);
    const who = { CHILD: "ребёнок", TEEN: "подросток", ADULT: "взрослый близкий человек", PET: "домашний питомец" }[a.audience];
    const { text } = await this.complete(
      "Ты — автор персональных иллюстрированных книг. Предложи 3 разных сюжета для персональной книги. Ответ — только JSON: [{\"title\":\"...\",\"summary\":\"...\"}]. Без имён, без страшного, без брендов и чужих персонажей.",
      `Идея покупателя: ${idea}\nГлавный герой: ${who}${a.audience === "CHILD" || a.audience === "TEEN" ? `, возраст ${heroAge(a)}` : ""}. ${seg ? `Сегмент: ${seg.title}. Запреты: ${seg.taboo.join("; ")}.` : ""}`,
      0.9,
    );
    return (JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1)) as { title: string; summary: string }[]).slice(0, 3);
  }
}

export function textProvider(name: string): TextProvider {
  return name === "yandexgpt" ? new YandexGptProvider() : new DemoTextProvider();
}

/** Контекст меток анкеты: герой, доп. герои с родом, повод, возраст. */
export function tagContext(a: QuizAnswers): TagContext {
  return {
    hero: { name: a.hero.name, nickname: a.hero.nickname || a.hero.name, gender: a.hero.gender },
    extras: a.extras.map((e) => ({ name: e.name, gender: extraGender(e, guessGender) })),
    occasion: occasionText(a.occasion.key, a.occasion.custom),
    age: exactAge(a),
  };
}

/** Подстановка имён, рода, повода и возраста — финальный текст для показа покупателю. */
export function personalize(raw: StoryText, a: QuizAnswers): StoryText {
  const ctx = tagContext(a);
  const f = (t: string) => fillTags(t, ctx).replace(/\[Имя\]/g, a.hero.name);
  return { title: f(raw.title), spreads: raw.spreads.map((s) => ({ ...s, text: f(s.text) })) };
}

export function dedicationText(a: QuizAnswers) {
  if (!a.dedication) return "";
  return personalize({ title: a.dedication, spreads: [] }, a).title;
}


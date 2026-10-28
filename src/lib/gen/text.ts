// TextProvider: сказка по анкете. Имя ребёнка во внешний сервис не отправляется —
// модель пишет метки {ГЕРОЙ.падеж}, имена подставляются у нас (declension.ts).
import { applyGender, planFor, STORY_PLANS, type StoryPlan } from "../story-plans";
import { appearanceLine, heroAge, OCCASION_CHIPS, type QuizAnswers } from "../quiz";
import { fillNames } from "../declension";

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
  write(a: QuizAnswers, storyTitle: string, plan: StoryPlan | null, variant: number): Promise<TextResult>;
  ideas(idea: string, a: QuizAnswers): Promise<{ title: string; summary: string }[]>;
}

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

const EXTRA_WORD: Record<string, string> = {
  sibling: "", mom: "мама", dad: "папа", grandma: "бабушка", grandpa: "дедушка", pet: "",
};

/** Демо-генерация без внешних сервисов: план сюжета + увлечения + доп. герои. */
export class DemoTextProvider implements TextProvider {
  name = "demo";

  async write(a: QuizAnswers, storyTitle: string, plan: StoryPlan | null, variant: number): Promise<TextResult> {
    const p = plan ?? STORY_PLANS[variant % STORY_PLANS.length];
    const spreads = p.spreads.map((s, i) => ({ index: i + 1, text: s.text, scene: s.scene }));
    const interest = [...a.interests, a.interestCustom].map((x) => INTEREST_LINES[x?.toLowerCase?.() ?? ""]).find(Boolean);
    if (interest) spreads[1].text += " " + interest;
    if (a.extras.length) {
      const names = a.extras.map((e, i) => `${EXTRA_WORD[e.role] ? EXTRA_WORD[e.role] + " " : ""}{ДОП${i + 1}.им}`.trim());
      const list = names.length > 1 ? names.slice(0, -1).join(", ") + " и " + names.at(-1) : names[0];
      spreads[0].text += ` Рядом, конечно, был${a.extras.length > 1 ? "и" : ""} ${list}.`;
      spreads[10].text += ` И ${list} — тоже рядом.`;
    }
    if (variant > 0) spreads[11].text = spreads[11].text.replace(/!$/, "!") + " Это была самая лучшая история.";
    const title = storyTitle.replace("[Имя]", "{ГЕРОЙ.им}");
    return { raw: { title, spreads }, costKopecks: 0, provider: this.name };
  }

  async ideas(idea: string) {
    const base = idea.replace(/\s+/g, " ").trim().slice(0, 80) || "волшебное приключение";
    return [
      { title: `Тайна: ${base}`, summary: `Герой находит загадку, связанную с идеей «${base}», и шаг за шагом раскрывает её с новыми друзьями.` },
      { title: `Большое путешествие`, summary: `Идея «${base}» превращается в путешествие через три волшебные страны, где герою помогают смелость и смекалка.` },
      { title: `Добрая история`, summary: `Тихая история о том, как герой делает доброе дело, вдохновлённое идеей «${base}», и мир становится чуточку лучше.` },
    ];
  }
}

const SYSTEM = `Ты — детский писатель. Пишешь тёплые, простые, добрые сказки на русском языке, на «ты» с читателем не обращаешься.
Правила:
- Имя главного героя НЕ пиши. Вместо него ставь метки с падежом: {ГЕРОЙ.им}, {ГЕРОЙ.род}, {ГЕРОЙ.дат}, {ГЕРОЙ.вин}, {ГЕРОЙ.тв}, {ГЕРОЙ.пр}. Ласковое домашнее имя — {ЛАСКОВО.им} и т.д. Дополнительные герои — {ДОП1.им}, {ДОП2.дат} и т.п.
- Глаголы прошедшего времени героя ставь в нужном роде (пол указан).
- Ровно 12 разворотов, в каждом 2–4 предложения. Для детей 2–5 лет — короткие простые фразы и повторы.
- Без страшного, насилия, рекламы, брендов и чужих персонажей.
- Для каждого разворота дай описание иллюстрации на английском (scene): что делает герой, где, кто рядом. Без имён.
Ответ — только JSON: {"title": "...", "spreads": [{"text": "...", "scene": "..."}]}`;

function brief(a: QuizAnswers, storyTitle: string, plan: StoryPlan | null) {
  const occ = OCCASION_CHIPS.find((o) => o.key === a.occasion.key);
  const lines = [
    `Пол героя: ${a.hero.gender === "girl" ? "девочка" : "мальчик"}. Возраст: ${heroAge(a)} лет.`,
    `Увлечения: ${[...a.interests, a.interestCustom].filter(Boolean).join(", ") || "не указаны"}.`,
    `Внешность (для иллюстраций): ${appearanceLine(a) || "не указана"}.`,
    `Повод: ${a.occasion.key === "svoj" ? a.occasion.custom : occ?.label ?? "без повода"}.`,
    a.extras.length
      ? `Дополнительные герои: ${a.extras.map((e, i) => `{ДОП${i + 1}} — ${e.role}${e.description ? ` (${e.description})` : ""}`).join("; ")}.`
      : "Дополнительных героев нет.",
  ];
  if (plan) {
    lines.push(`Сюжет «${storyTitle}». Следуй плану по разворотам (можно менять детали, сохраняя ход событий):`);
    plan.spreads.forEach((s, i) => lines.push(`${i + 1}. ${applyGender(s.text, a.hero.gender)}`));
  } else {
    const idea = a.story.ideaChoice ? `${a.story.ideaChoice.title}: ${a.story.ideaChoice.summary}` : a.story.idea;
    lines.push(`Сюжет по идее родителя: ${idea}`);
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
        completionOptions: { stream: false, temperature, maxTokens: "6000" },
        messages: [
          { role: "system", text: system },
          { role: "user", text: user },
        ],
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!r.ok) throw new Error(`YandexGPT ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const j = (await r.json()) as { result: { alternatives: { message: { text: string } }[]; usage?: { totalTokens?: string } } };
    const tokens = Number(j.result.usage?.totalTokens ?? 0);
    return { text: j.result.alternatives[0].message.text, costKopecks: Math.round((tokens / 1000) * this.rubPer1kTokens * 100) };
  }

  async write(a: QuizAnswers, storyTitle: string, plan: StoryPlan | null, variant: number): Promise<TextResult> {
    const { text, costKopecks } = await this.complete(SYSTEM, brief(a, storyTitle, plan) + (variant ? `\nВариант ${variant + 1}: напиши по-новому.` : ""), 0.6 + variant * 0.15);
    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const parsed = JSON.parse(json) as { title: string; spreads: { text: string; scene: string }[] };
    if (!Array.isArray(parsed.spreads) || parsed.spreads.length < 10) throw new Error("YandexGPT: неполный ответ");
    const spreads = parsed.spreads.slice(0, 12).map((s, i) => ({
      index: i + 1,
      text: s.text,
      scene: plan?.spreads[i]?.scene ?? s.scene, // для готовых сюжетов — проверенные описания сцен
    }));
    return { raw: { title: plan ? storyTitle.replace("[Имя]", "{ГЕРОЙ.им}") : parsed.title, spreads }, costKopecks, provider: this.name };
  }

  async ideas(idea: string, a: QuizAnswers) {
    const { text } = await this.complete(
      "Ты — детский писатель. Предложи 3 разных сюжета для персональной детской сказки. Ответ — только JSON: [{\"title\":\"...\",\"summary\":\"...\"}]. Без имён, без страшного.",
      `Идея родителя: ${idea}\nВозраст ребёнка: ${heroAge(a)}. Пол: ${a.hero.gender === "girl" ? "девочка" : "мальчик"}.`,
      0.9,
    );
    return (JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1)) as { title: string; summary: string }[]).slice(0, 3);
  }
}

export function textProvider(name: string): TextProvider {
  return name === "yandexgpt" ? new YandexGptProvider() : new DemoTextProvider();
}

/** Подстановка имён и формы по полу — финальный текст для показа родителю. */
export function personalize(raw: StoryText, a: QuizAnswers): StoryText {
  const hero = { name: a.hero.name, nickname: a.hero.nickname || a.hero.name, gender: a.hero.gender };
  const extras = a.extras.map((e, i) => ({ key: `ДОП${i + 1}`, name: e.name, gender: ["mom", "grandma"].includes(e.role) ? "girl" : undefined }));
  const f = (t: string) => fillNames(applyGender(t, a.hero.gender), hero, extras).replace(/\{ДОП\d\}/g, "");
  return { title: f(raw.title), spreads: raw.spreads.map((s) => ({ ...s, text: f(s.text) })) };
}

export function planForAnswers(a: QuizAnswers) {
  return a.story.slug ? planFor(a.story.slug) : null;
}

export function dedicationText(a: QuizAnswers) {
  if (!a.dedication) return "";
  return personalize({ title: a.dedication, spreads: [] }, a).title;
}

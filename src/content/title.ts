// Название сюжета с «[Имя]» (владелец — агент 1). Один помощник для всех мест: текст книги (gen/text.ts),
// бриф модели, живая обложка анкеты, карточки каталога, страница книги, PDF. Безопасен для клиента.
//
// Падеж имени выбирается по предлогу перед [Имя]:
//   о / об / обо / при / на / в → предложный («Былина об Ане»);  для / у / от / без / до / из / около / ради → родительный;
//   к / ко / по → дательный;  с / со / над / под / за / перед / между → творительный;  про / через → винительный;
//   иначе — именительный («[Имя] и Месяц ясный»).
// Предлог «о» → «об» перед гласной ставит fillTags (src/lib/declension.ts) уже после подстановки имени.

export type TitleCase = "им" | "род" | "дат" | "вин" | "тв" | "пр";

const PREP_CASE: Record<string, TitleCase> = {
  о: "пр", об: "пр", обо: "пр", при: "пр",
  для: "род", у: "род", от: "род", без: "род", до: "род", из: "род", около: "род", ради: "род",
  к: "дат", ко: "дат", по: "дат",
  с: "тв", со: "тв", над: "тв", под: "тв", за: "тв", перед: "тв", между: "тв",
  про: "вин", через: "вин",
};

/** Падеж имени по слову перед ним (предлогу); без предлога — именительный. */
export function caseAfter(prevWord: string | undefined): TitleCase {
  return PREP_CASE[(prevWord ?? "").toLowerCase().replace(/[^а-яё]/g, "")] ?? "им";
}

/** Заменяет каждое «[Имя]» функцией от падежа (падеж — по предыдущему слову). */
function replaceName(title: string, put: (c: TitleCase, atStart: boolean) => string) {
  return title.replace(/\[Имя\]/g, (_m, offset: number) => {
    const before = title.slice(0, offset);
    const prev = before.match(/([А-Яа-яЁё]+)\s+$/)?.[1];
    return put(caseAfter(prev), !before.trim());
  });
}

/** Название для текста книги и брифа: «Былина о [Имя]…» → «Былина о {ГЕРОЙ.пр}…». */
export function titleTemplate(title: string, tag = "ГЕРОЙ"): string {
  return replaceName(title, (c) => `{${tag}.${c}}`);
}

/** Название с готовым именем (имя склоняется функцией decline — declineName из lib/declension). */
export function titleWithName(title: string, decline: (c: TitleCase) => string): string {
  return replaceName(title, (c) => decline(c));
}

/** «Ваш ребёнок / Ваш герой / Ваш питомец» во всех падежах — для витрины, пока имени нет. */
const HERO_PLACEHOLDER: Record<string, Record<TitleCase, string>> = {
  CHILD: { им: "ваш ребёнок", род: "вашего ребёнка", дат: "вашему ребёнку", вин: "вашего ребёнка", тв: "вашим ребёнком", пр: "вашем ребёнке" },
  TEEN: { им: "ваш герой", род: "вашего героя", дат: "вашему герою", вин: "вашего героя", тв: "вашим героем", пр: "вашем герое" },
  ADULT: { им: "ваш герой", род: "вашего героя", дат: "вашему герою", вин: "вашего героя", тв: "вашим героем", пр: "вашем герое" },
  PET: { им: "ваш питомец", род: "вашего питомца", дат: "вашему питомцу", вин: "вашего питомца", тв: "вашим питомцем", пр: "вашем питомце" },
};

const capFirst = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Название для каталога без имени: «[Имя] и Месяц ясный» → «Ваш ребёнок и Месяц ясный», «Былина о вашем герое…»; {Р:м|ж} → м. */
export function titleForCatalog(title: string, audience: string = "CHILD"): string {
  const forms = HERO_PLACEHOLDER[audience] ?? HERO_PLACEHOLDER.CHILD;
  // Форма рода в названии («ты {Р:появился|появилась}») — по слову-заглушке: «ваш …» мужского рода
  const neutral = title.replace(/\{Р:([^|{}]*)\|[^{}]*\}/g, "$1");
  return replaceName(neutral, (c, atStart) => (atStart ? capFirst(forms[c]) : forms[c]));
}

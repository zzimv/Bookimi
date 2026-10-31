// Имена везде: с заглавной буквы и в правильном падеже — в анкете, книге, посвящении, мультфильме, письмах,
// кабинете, пути заказа, PDF; одна нормализация на всех входах (схемы API), латиница — без русских окончаний.
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { CASES, declineName, fillTags, guessGender, normalizeName, type Case } from "@/lib/declension";
import { cyrillicSuggestion, fullNameError, isLatinName, nameError, nameFix, normalizeSignature } from "@/lib/names";
import { AnswersV2 } from "@/content/answers";
import { PLOTS } from "@/content/registry";
import { DemoTextProvider, dedicationText, personalize } from "@/lib/gen/text";
import { dedicationsFor } from "@/lib/dedications";
import { Checkout } from "@/lib/checkout-schema";
import { SavedAddressSchema, pickPrefill } from "@/lib/delivery";
import { checkFirstName, greetName, greeting } from "@/lib/first-name";
import { cleanFirstName } from "@/lib/auth";
import { parseNames, rosterIssues } from "@/lib/roster";
import { fill as triggerFill } from "@/lib/triggers";
import { heroAcc, heroOf } from "@/app/zakaz/journey-data";
import { journeyLine } from "@/app/zakaz/journey";
import { nextOccasion } from "@/app/kabinet/occasion";
import { upcomingBirthdays } from "@/lib/holidays-core";
import { cartoonScript } from "@/lib/gen/cartoon-script";
import { plainSpread } from "@/lib/spread-markup";
import { addonHtml, addonFileSpecs } from "@/lib/addon-files";
import { bookHtml, bookWording, renderPdf, type BookPageData } from "@/lib/pdf";
import { titleWithName } from "@/content/title";

// ---------------------------------------------------------------------------
// 1. Таблица склонения: имя, род, 6 падежей (им род дат вин тв пр)
// ---------------------------------------------------------------------------
type Row = [name: string, gender: "boy" | "girl", forms: string];
const TABLE: Row[] = [
  // женские на -а/-я
  ["Маша", "girl", "Маша Маши Маше Машу Машей Маше"],
  ["Ева", "girl", "Ева Евы Еве Еву Евой Еве"],
  ["Анна", "girl", "Анна Анны Анне Анну Анной Анне"],
  ["Лиза", "girl", "Лиза Лизы Лизе Лизу Лизой Лизе"],
  ["Ольга", "girl", "Ольга Ольги Ольге Ольгу Ольгой Ольге"],
  ["Алёна", "girl", "Алёна Алёны Алёне Алёну Алёной Алёне"],
  ["Даша", "girl", "Даша Даши Даше Дашу Дашей Даше"],
  ["Соня", "girl", "Соня Сони Соне Соню Соней Соне"],
  ["Катя", "girl", "Катя Кати Кате Катю Катей Кате"],
  ["Наталья", "girl", "Наталья Натальи Наталье Наталью Натальей Наталье"],
  ["Дарья", "girl", "Дарья Дарьи Дарье Дарью Дарьей Дарье"],
  ["Софья", "girl", "Софья Софьи Софье Софью Софьей Софье"],
  ["Мария", "girl", "Мария Марии Марии Марию Марией Марии"],
  ["Наталия", "girl", "Наталия Наталии Наталии Наталию Наталией Наталии"],
  ["Виктория", "girl", "Виктория Виктории Виктории Викторию Викторией Виктории"],
  ["Ия", "girl", "Ия Ии Ии Ию Ией Ии"],
  ["Лия", "girl", "Лия Лии Лии Лию Лией Лии"],
  ["Зоя", "girl", "Зоя Зои Зое Зою Зоей Зое"],
  ["Майя", "girl", "Майя Майи Майе Майю Майей Майе"],
  ["Рая", "girl", "Рая Раи Рае Раю Раей Рае"],
  ["Злата", "girl", "Злата Златы Злате Злату Златой Злате"],
  ["Полина", "girl", "Полина Полины Полине Полину Полиной Полине"],
  ["Вера", "girl", "Вера Веры Вере Веру Верой Вере"],
  ["Надя", "girl", "Надя Нади Наде Надю Надей Наде"],
  ["Люба", "girl", "Люба Любы Любе Любу Любой Любе"],
  ["Варвара", "girl", "Варвара Варвары Варваре Варвару Варварой Варваре"],
  ["Алиса", "girl", "Алиса Алисы Алисе Алису Алисой Алисе"],
  ["Милана", "girl", "Милана Миланы Милане Милану Миланой Милане"],
  ["Вика", "girl", "Вика Вики Вике Вику Викой Вике"],
  ["Ксюша", "girl", "Ксюша Ксюши Ксюше Ксюшу Ксюшей Ксюше"],
  ["Наташа", "girl", "Наташа Наташи Наташе Наташу Наташей Наташе"],
  ["Лена", "girl", "Лена Лены Лене Лену Леной Лене"],
  ["Таня", "girl", "Таня Тани Тане Таню Таней Тане"],
  ["Настя", "girl", "Настя Насти Насте Настю Настей Насте"],
  ["Юля", "girl", "Юля Юли Юле Юлю Юлей Юле"],
  ["Аня", "girl", "Аня Ани Ане Аню Аней Ане"],
  ["Оля", "girl", "Оля Оли Оле Олю Олей Оле"],
  ["Василиса", "girl", "Василиса Василисы Василисе Василису Василисой Василисе"],
  ["Ульяна", "girl", "Ульяна Ульяны Ульяне Ульяну Ульяной Ульяне"],
  ["Арина", "girl", "Арина Арины Арине Арину Ариной Арине"],
  // женские на -ь
  ["Любовь", "girl", "Любовь Любови Любови Любовь Любовью Любови"],
  ["Адель", "girl", "Адель Адели Адели Адель Аделью Адели"],
  ["Нинель", "girl", "Нинель Нинели Нинели Нинель Нинелью Нинели"],
  ["Ассоль", "girl", "Ассоль Ассоли Ассоли Ассоль Ассолью Ассоли"],
  ["Рахиль", "girl", "Рахиль Рахили Рахили Рахиль Рахилью Рахили"],
  ["Николь", "girl", "Николь Николи Николи Николь Николью Николи"],
  // женские несклоняемые
  ["Кармен", "girl", "Кармен Кармен Кармен Кармен Кармен Кармен"],
  ["Ирэн", "girl", "Ирэн Ирэн Ирэн Ирэн Ирэн Ирэн"],
  ["Эстер", "girl", "Эстер Эстер Эстер Эстер Эстер Эстер"],
  ["Мари", "girl", "Мари Мари Мари Мари Мари Мари"],
  ["Элли", "girl", "Элли Элли Элли Элли Элли Элли"],
  // мужские на согласную
  ["Марк", "boy", "Марк Марка Марку Марка Марком Марке"],
  ["Иван", "boy", "Иван Ивана Ивану Ивана Иваном Иване"],
  ["Глеб", "boy", "Глеб Глеба Глебу Глеба Глебом Глебе"],
  ["Артём", "boy", "Артём Артёма Артёму Артёма Артёмом Артёме"],
  ["Фёдор", "boy", "Фёдор Фёдора Фёдору Фёдора Фёдором Фёдоре"],
  ["Семён", "boy", "Семён Семёна Семёну Семёна Семёном Семёне"],
  ["Тимур", "boy", "Тимур Тимура Тимуру Тимура Тимуром Тимуре"],
  ["Максим", "boy", "Максим Максима Максиму Максима Максимом Максиме"],
  ["Ярослав", "boy", "Ярослав Ярослава Ярославу Ярослава Ярославом Ярославе"],
  ["Святослав", "boy", "Святослав Святослава Святославу Святослава Святославом Святославе"],
  ["Мирон", "boy", "Мирон Мирона Мирону Мирона Мироном Мироне"],
  ["Давид", "boy", "Давид Давида Давиду Давида Давидом Давиде"],
  ["Адам", "boy", "Адам Адама Адаму Адама Адамом Адаме"],
  ["Леон", "boy", "Леон Леона Леону Леона Леоном Леоне"],
  ["Платон", "boy", "Платон Платона Платону Платона Платоном Платоне"],
  ["Демид", "boy", "Демид Демида Демиду Демида Демидом Демиде"],
  ["Роман", "boy", "Роман Романа Роману Романа Романом Романе"],
  ["Кирилл", "boy", "Кирилл Кирилла Кириллу Кирилла Кириллом Кирилле"],
  ["Егор", "boy", "Егор Егора Егору Егора Егором Егоре"],
  ["Олег", "boy", "Олег Олега Олегу Олега Олегом Олеге"],
  // мужские на -й / -ий / -ь
  ["Андрей", "boy", "Андрей Андрея Андрею Андрея Андреем Андрее"],
  ["Тимофей", "boy", "Тимофей Тимофея Тимофею Тимофея Тимофеем Тимофее"],
  ["Матвей", "boy", "Матвей Матвея Матвею Матвея Матвеем Матвее"],
  ["Алексей", "boy", "Алексей Алексея Алексею Алексея Алексеем Алексее"],
  ["Николай", "boy", "Николай Николая Николаю Николая Николаем Николае"],
  ["Дмитрий", "boy", "Дмитрий Дмитрия Дмитрию Дмитрия Дмитрием Дмитрии"],
  ["Арсений", "boy", "Арсений Арсения Арсению Арсения Арсением Арсении"],
  ["Георгий", "boy", "Георгий Георгия Георгию Георгия Георгием Георгии"],
  ["Евгений", "boy", "Евгений Евгения Евгению Евгения Евгением Евгении"],
  ["Василий", "boy", "Василий Василия Василию Василия Василием Василии"],
  ["Игорь", "boy", "Игорь Игоря Игорю Игоря Игорем Игоре"],
  // беглые гласные
  ["Лев", "boy", "Лев Льва Льву Льва Львом Льве"],
  ["Павел", "boy", "Павел Павла Павлу Павла Павлом Павле"],
  ["Пётр", "boy", "Пётр Петра Петру Петра Петром Петре"],
  // мужские на -а/-я
  ["Илья", "boy", "Илья Ильи Илье Илью Ильёй Илье"],
  ["Никита", "boy", "Никита Никиты Никите Никиту Никитой Никите"],
  ["Миша", "boy", "Миша Миши Мише Мишу Мишей Мише"],
  ["Саша", "boy", "Саша Саши Саше Сашу Сашей Саше"],
  ["Фома", "boy", "Фома Фомы Фоме Фому Фомой Фоме"],
  ["Лука", "boy", "Лука Луки Луке Луку Лукой Луке"],
  ["Кузьма", "boy", "Кузьма Кузьмы Кузьме Кузьму Кузьмой Кузьме"],
  ["Ваня", "boy", "Ваня Вани Ване Ваню Ваней Ване"],
  ["Добрыня", "boy", "Добрыня Добрыни Добрыне Добрыню Добрыней Добрыне"],
  ["Савва", "boy", "Савва Саввы Савве Савву Саввой Савве"],
  // мужские несклоняемые
  ["Лео", "boy", "Лео Лео Лео Лео Лео Лео"],
  ["Хосе", "boy", "Хосе Хосе Хосе Хосе Хосе Хосе"],
  ["Сантьяго", "boy", "Сантьяго Сантьяго Сантьяго Сантьяго Сантьяго Сантьяго"],
  ["Тео", "boy", "Тео Тео Тео Тео Тео Тео"],
  ["Луи", "boy", "Луи Луи Луи Луи Луи Луи"],
  ["Франсуа", "boy", "Франсуа Франсуа Франсуа Франсуа Франсуа Франсуа"],
  // имя-отчество (воспитатели, учителя)
  ["Мария Ивановна", "girl", "Мария Ивановна|Марии Ивановны|Марии Ивановне|Марию Ивановну|Марией Ивановной|Марии Ивановне"],
  ["Иван Петрович", "boy", "Иван Петрович|Ивана Петровича|Ивану Петровичу|Ивана Петровича|Иваном Петровичем|Иване Петровиче"],
  ["Илья Ильич", "boy", "Илья Ильич|Ильи Ильича|Илье Ильичу|Илью Ильича|Ильёй Ильичом|Илье Ильиче"],
  ["Анна Сергеевна", "girl", "Анна Сергеевна|Анны Сергеевны|Анне Сергеевне|Анну Сергеевну|Анной Сергеевной|Анне Сергеевне"],
  ["Олег Николаевич", "boy", "Олег Николаевич|Олега Николаевича|Олегу Николаевичу|Олега Николаевича|Олегом Николаевичем|Олеге Николаевиче"],
  ["Наталья Ильинична", "girl", "Наталья Ильинична|Натальи Ильиничны|Наталье Ильиничне|Наталью Ильиничну|Натальей Ильиничной|Наталье Ильиничне"],
  // двойные имена и инициал
  ["Анна-Мария", "girl", "Анна-Мария Анны-Марии Анне-Марии Анну-Марию Анной-Марией Анне-Марии"],
  ["Жан-Поль", "boy", "Жан-Поль Жана-Поля Жану-Полю Жана-Поля Жаном-Полем Жане-Поле"],
  ["Саша К.", "girl", "Саша К.|Саши К.|Саше К.|Сашу К.|Сашей К.|Саше К."],
  // клички: беглые гласные, ударное «-ом» после шипящей
  ["Пушок", "boy", "Пушок Пушка Пушку Пушка Пушком Пушке"],
  ["Пушочек", "boy", "Пушочек Пушочка Пушочку Пушочка Пушочком Пушочке"],
  ["Дружочек", "boy", "Дружочек Дружочка Дружочку Дружочка Дружочком Дружочке"],
  ["Дружок", "boy", "Дружок Дружка Дружку Дружка Дружком Дружке"],
  ["Колобок", "boy", "Колобок Колобка Колобку Колобка Колобком Колобке"],
  ["Снежок", "boy", "Снежок Снежка Снежку Снежка Снежком Снежке"],
  ["Уголёк", "boy", "Уголёк Уголька Угольку Уголька Угольком Угольке"],
  ["Огонёк", "boy", "Огонёк Огонька Огоньку Огонька Огоньком Огоньке"],
  ["Котёнок", "boy", "Котёнок Котёнка Котёнку Котёнка Котёнком Котёнке"],
  ["Малыш", "boy", "Малыш Малыша Малышу Малыша Малышом Малыше"],
  ["Черныш", "boy", "Черныш Черныша Чернышу Черныша Чернышом Черныше"],
  ["Карандаш", "boy", "Карандаш Карандаша Карандашу Карандаша Карандашом Карандаше"],
  ["Кураж", "boy", "Кураж Куража Куражу Куража Куражом Кураже"],
  ["Ёж", "boy", "Ёж Ежа Ежу Ежа Ежом Еже"],
  ["Чиж", "boy", "Чиж Чижа Чижу Чижа Чижом Чиже"],
  ["Барсик", "boy", "Барсик Барсика Барсику Барсика Барсиком Барсике"],
  ["Мурзик", "boy", "Мурзик Мурзика Мурзику Мурзика Мурзиком Мурзике"],
  ["Шарик", "boy", "Шарик Шарика Шарику Шарика Шариком Шарике"],
  ["Рыжик", "boy", "Рыжик Рыжика Рыжику Рыжика Рыжиком Рыжике"],
  ["Мурка", "girl", "Мурка Мурки Мурке Мурку Муркой Мурке"],
  ["Жучка", "girl", "Жучка Жучки Жучке Жучку Жучкой Жучке"],
  ["Белка", "girl", "Белка Белки Белке Белку Белкой Белке"],
  // латиница — как есть, без русских окончаний
  ["Anna", "girl", "Anna Anna Anna Anna Anna Anna"],
  ["Mark", "boy", "Mark Mark Mark Mark Mark Mark"],
  ["Nikita", "boy", "Nikita Nikita Nikita Nikita Nikita Nikita"],
  ["Sofia", "girl", "Sofia Sofia Sofia Sofia Sofia Sofia"],
  ["Leo", "boy", "Leo Leo Leo Leo Leo Leo"],
  // как ввели: строчные, ПРОПИСНЫЕ, ё
  ["маша", "girl", "Маша Маши Маше Машу Машей Маше"],
  ["ЕВА", "girl", "Ева Евы Еве Еву Евой Еве"],
  ["пушочек", "boy", "Пушочек Пушочка Пушочку Пушочка Пушочком Пушочке"],
  ["anna", "girl", "Anna Anna Anna Anna Anna Anna"],
  ["анна-мария", "girl", "Анна-Мария Анны-Марии Анне-Марии Анну-Марию Анной-Марией Анне-Марии"],
  ["ПЁТР", "boy", "Пётр Петра Петру Петра Петром Петре"],
  ["  илья  ", "boy", "Илья Ильи Илье Илью Ильёй Илье"],
];

describe("склонение: таблица имён × 6 падежей", () => {
  it(`в таблице ≥ 120 имён (${TABLE.length})`, () => expect(TABLE.length).toBeGreaterThanOrEqual(120));
  for (const [name, g, forms] of TABLE) {
    it(`${name.trim()} (${g})`, () => {
      const want = forms.includes("|") ? forms.split("|") : forms.split(" ");
      expect(want).toHaveLength(6);
      expect(CASES.map((c) => declineName(name, c, g))).toEqual(want);
    });
  }
});

describe("нормализация имени", () => {
  it.each([
    ["маша", "Маша"],
    ["ЕВА", "Ева"],
    ["  анна   мария ", "Анна Мария"],
    ["анна - мария", "Анна-Мария"],
    ["анна—мария", "Анна-Мария"],
    ["мАША", "Маша"],
    ["мария ивановна", "Мария Ивановна"],
    ["ибрагим оглы", "Ибрагим оглы"],
    ["лейла кызы", "Лейла кызы"],
    ["людвиг ван бетховен", "Людвиг ван Бетховен"],
    ["анна де вер", "Анна де Вер"],
    ["ДЕ ГОЛЛЬ", "Де Голль"],
    ["o'brien", "O'Brien"],
    ["д’артаньян", "Д'Артаньян"],
    ["mcdonald", "McDonald"],
    ["McDonald", "McDonald"],
    ["робот бип", "Робот Бип"],
    ["саша к.", "Саша К."],
    ["анна петрова", "Анна Петрова"],
    ["ёжик", "Ёжик"],
  ])("%s → %s", (raw, want) => expect(normalizeName(raw)).toBe(want));

  it("проверка знаков", () => {
    expect(nameError("Маша")).toBeNull();
    expect(nameError("Маша!")).toMatch(/только буквы/);
    expect(nameError("<b>Маша</b>")).toMatch(/только буквы/);
    expect(nameError("Робот Бип-2", "free")).toBeNull();
    expect(nameError("Бип2")).toMatch(/только буквы/);
    expect(nameError("123", "free")).toMatch(/буквы/);
  });
  it("получатель — имя и фамилия", () => {
    expect(fullNameError("анна")).toMatch(/имя и фамилию/);
    expect(fullNameError("анна петрова")).toBeNull();
    expect(fullNameError("Анна П.")).toMatch(/имя и фамилию/);
    expect(fullNameError("Анна http://x.ru")).toMatch(/без ссылок/);
  });
  it("латиница: подсказка по-русски", () => {
    expect(isLatinName("Anna")).toBe(true);
    expect(isLatinName("Анна")).toBe(false);
    for (const [lat, cyr] of [["anna", "Анна"], ["Mark", "Марк"], ["nikita", "Никита"], ["Ilya", "Илья"], ["leo", "Лео"], ["Sofia", "София"], ["MARIA", "Мария"], ["alice", "Алиса"], ["anna-maria", "Анна-Мария"]]) {
      expect(cyrillicSuggestion(lat), lat).toBe(cyr);
    }
    expect(cyrillicSuggestion("Xzibit")).toBeNull();
    expect(cyrillicSuggestion("Анна")).toBeNull();
  });
  it("миграция: nameFix", () => {
    expect(nameFix("анна")).toBe("Анна");
    expect(nameFix("Анна")).toBeNull();
    expect(nameFix(null)).toBeNull();
    expect(nameFix("анна петрова")).toBe("Анна Петрова");
    expect(nameFix("<script>")).toBeNull();
  });
  it("подпись отзыва", () => expect(normalizeSignature("  ольга,   мама Вари ")).toBe("Ольга, мама Вари"));
});

// ---------------------------------------------------------------------------
// 2. Все входы: строчные и ПРОПИСНЫЕ приводятся к «Маша»
// ---------------------------------------------------------------------------
describe("нормализация на входе каждой схемы", () => {
  it("анкета: герой, ласковое имя, доп. герои (в т. ч. «свой вариант»), дети и взрослые группы", () => {
    const a = AnswersV2.parse({
      hero: { name: "МАША", nickname: "машенька", gender: "girl", ageGroup: "4-5" },
      extras: [
        { role: "mom", name: "оля" },
        { role: "custom", name: "робот бип", what: "робот" },
        { role: "partner", name: "ИГОРЬ" },
      ],
      group: { members: [{ name: "ваня" }, { name: "САША К." }], adults: [{ name: "мария ивановна", role: "воспитатель" }] },
    });
    expect(a.hero.name).toBe("Маша");
    expect(a.hero.nickname).toBe("Машенька");
    expect(a.extras.map((e) => e.name)).toEqual(["Оля", "Робот Бип", "Игорь"]);
    expect(a.group!.members.map((m) => m.name)).toEqual(["Ваня", "Саша К."]);
    expect(a.group!.adults[0].name).toBe("Мария Ивановна");
    const pet = AnswersV2.parse({ audience: "PET", hero: { name: "пушочек", gender: "boy" } });
    expect(pet.hero.name).toBe("Пушочек");
  });
  it("анкета: недопустимые знаки — ошибка по-русски", () => {
    const r = AnswersV2.safeParse({ hero: { name: "Маша<script>", gender: "girl" } });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/Имя/);
  });
  it("«Как к вам обращаться» (вход и кабинет)", () => {
    expect(cleanFirstName("анна")).toBe("Анна");
    expect(cleanFirstName("АННА")).toBe("Анна");
    expect(checkFirstName("анна-мария")).toBe("Анна-Мария");
    expect(greetName("анна")).toBe("Анна");
    expect(greeting(greetName("анна"))).toBe("Здравствуйте, Анна!");
  });
  it("оформление: получатель «Имя и фамилия»", () => {
    const c = Checkout.parse({ bookId: "00000000-0000-4000-8000-000000000000", whoPrints: "bookimi", contact: { name: "анна   ПЕТРОВА", phone: "+79123456789" } });
    expect(c.contact.name).toBe("Анна Петрова");
  });
  it("адресная книга: получатель нормализуется и при чтении старых записей", () => {
    const s = SavedAddressSchema.parse({ id: "x", savedAt: "2026-10-01", method: "cdek_pvz", city: "Москва", name: "анна петрова", phone: "" });
    expect(s.name).toBe("Анна Петрова");
    const p = pickPrefill({ saved: null, profile: { name: "анна", phone: "" }, methods: ["cdek_pvz"] });
    expect(p.contact.name).toBe("Анна");
  });
  it("вставка списка группы", () => {
    expect(parseNames("маша, ПЕТЯ\n3) анна-мария (ж)\nсаша к. м").map((x) => x.name)).toEqual(["Маша", "Петя", "Анна-Мария", "Саша К."]);
    const issues = rosterIssues([{ name: "маша", gender: "girl" }, { name: "Маша", gender: "girl" }]);
    expect(issues.find((x) => x.kind === "duplicate")?.message).toMatch(/^Маша — уже есть/);
  });
});

// ---------------------------------------------------------------------------
// 3. Генерация: все сюжеты × имена × пол × группа
// ---------------------------------------------------------------------------
const HERO_NAMES: Record<string, string[]> = { CHILD: ["маша", "ЕВА", "anna", "илья"], TEEN: ["ЕВА", "anna", "илья"], ADULT: ["маша", "anna", "мария ивановна"], PET: ["пушочек", "ЧЕРНЫШ", "anna"] };
const BASE: Record<string, object> = {
  CHILD: { audience: "CHILD", hero: { ageGroup: "4-5" } },
  TEEN: { audience: "TEEN", hero: { age: 13 } },
  ADULT: { audience: "ADULT", hero: { age: 40 } },
  PET: { audience: "PET", pet: { species: "cat" } },
};

/** Все формы имени (6 падежей), набранные строчными или ПРОПИСНЫМИ, — их в тексте быть не должно. */
function badForms(raw: string, gender: string): RegExp | null {
  const n = normalizeName(raw);
  const forms = new Set<string>();
  for (const c of CASES) {
    const f = declineName(n, c, gender);
    // Имя из нескольких слов («Робот Бип», «Мария Ивановна») ищем целиком: «робот» само по себе — обычное слово
    for (const w of n.includes(" ") ? [f] : f.split("-")) {
      if (w.replace(/[^\p{L}]/gu, "").length < 3) continue;
      forms.add(w.toLowerCase());
      forms.add(w.toUpperCase());
    }
  }
  if (!forms.size) return null;
  return new RegExp(`(?<![\\p{L}])(${[...forms].map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\p{L}])`, "u");
}

describe("генерация: имена с заглавной, в падеже, без русских окончаний у латиницы, без меток", () => {
  const provider = new DemoTextProvider();
  let books = 0;
  for (const plot of PLOTS) {
    it(plot.slug, async () => {
      const aud = plot.audience as string;
      for (const raw of HERO_NAMES[aud] ?? HERO_NAMES.CHILD) {
        for (const gender of ["boy", "girl"] as const) {
          const extras = [
            ...(plot.extras?.min ? [{ role: plot.extras.roles[0], name: "оля", gender: "girl" }] : []),
            ...(plot.extras && plot.extras.max > (plot.extras.min ?? 0) && plot.extras.roles.includes("custom") ? [{ role: "custom", name: "робот бип", what: "робот", gender: "boy" }] : []),
          ];
          const base = BASE[aud] as { hero?: object };
          const answers = AnswersV2.parse({
            ...base,
            hero: { ...(base.hero ?? {}), name: raw, nickname: raw === "маша" ? "машенька" : "", gender },
            story: { slug: plot.slug },
            occasion: { key: "rozhdestvo" },
            extras,
            group: plot.group ? { members: [{ name: "ваня", gender: "boy" }, { name: "САША К.", gender: "girl" }, { name: "anna", gender: "girl" }, { name: "лев", gender: "boy" }], adults: [{ name: "мария ивановна", role: plot.group.includeAdults?.roles[0] ?? "воспитатель" }] } : undefined,
            dedication: dedicationsFor(aud as "CHILD", "rozhdestvo")[0],
          });
          const r = await provider.write(answers as never, plot as never, 0);
          const t = personalize(r.raw, answers as never);
          const ded = dedicationText(answers as never);
          const cues = cartoonScript({ title: t.title, spreads: t.spreads.map((s) => ({ index: s.index, text: plainSpread(s.text) })), dedication: ded }).cues.map((c) => c.text);
          const all = [t.title, ...t.spreads.map((s) => s.text), ded, ...cues].join("\n");
          const where = `${plot.slug} / ${raw} / ${gender}`;
          expect(all, where).not.toMatch(/\{[А-ЯЁ]|\[\[\?|\[Имя\]/u);
          expect(all, where).not.toMatch(/[A-Za-z][а-яё]/u);
          for (const n of [raw, answers.hero.nickname, ...answers.extras.map((e) => e.name), ...(answers.group?.members.map((m) => m.name) ?? [])]) {
            if (!n) continue;
            const re = badForms(n, gender);
            if (re) expect(all.match(re)?.[0] ?? null, `${where}: «${n}»`).toBeNull();
          }
          // Имя героя прозвучало с заглавной
          expect(all, where).toContain(normalizeName(raw).split(" ")[0].slice(0, 2));
          if (gender === "girl") expect(all, where).not.toMatch(/ты такой, какой есть/);
          books++;
        }
      }
    }, 60_000);
  }
  it("книг проверено", () => expect(books).toBeGreaterThan(100));
});

// ---------------------------------------------------------------------------
// 4. Письма, триггеры, путь заказа, кабинет, повод
// ---------------------------------------------------------------------------
describe("уведомления, путь заказа и кабинет", () => {
  it("триггеры: падеж по предлогу, заглавная, «со Львом»", () => {
    expect(triggerFill("Ровно через месяц, {date}, день рождения у {name}. Новая книга, где {name} — {hero_role}.", { name: "маша", gender: "girl", date: "1 ноября" })).toBe(
      "Ровно через месяц, 1 ноября, день рождения у Маши. Новая книга, где Маша — главная героиня.",
    );
    expect(triggerFill("Сказка про {name} ждёт", { name: "ПЁТР", gender: "boy", audience: "CHILD" })).toBe("Сказка про Петра ждёт");
    expect(triggerFill("Книга о {name}", { name: "аня", gender: "girl" })).toBe("Книга об Ане");
    expect(triggerFill("Прогулка с {name}", { name: "лев", gender: "boy" })).toBe("Прогулка со Львом");
    expect(triggerFill("Сказка для {name}", { name: "anna", gender: "girl" })).toBe("Сказка для Anna");
    expect(triggerFill("Книга про {name}", { name: "пушочек", gender: "boy" })).toBe("Книга про Пушочка");
  });
  it("путь заказа: «книгу про Машу»", () => {
    const params = { hero: { name: "маша", gender: "girl" } };
    expect(heroOf(params).name).toBe("Маша");
    expect(heroAcc(params)).toBe("Машу");
    const line = journeyLine({ status: "PAID", whoPrints: "self", createdAt: new Date(), paidAt: new Date(), readyDate: null, bookReadyAt: null, heroAcc: heroAcc(params), shipment: null } as never);
    expect(line).toContain("книгу про Машу");
  });
  it("кабинет: приветствие и ближайшие дни рождения", () => {
    expect(greeting(greetName("анна"))).toBe("Здравствуйте, Анна!");
    const now = new Date("2026-10-31T09:00:00Z");
    const list = upcomingBirthdays([{ id: "h1", userId: "u", name: "маша", birthDate: new Date("2020-11-12T00:00:00Z") }], now, 60);
    expect(list[0].name).toBe("Маша");
    expect(list[0].daysLeft).toBe(12);
    const hint = nextOccasion({ now: new Date("2026-06-01T09:00:00Z"), birthdays: [{ name: "маша", date: new Date("2020-07-05T00:00:00Z") }] });
    expect(hint?.title).toBe("День рождения Маши");
    expect(hint?.text).toContain("день рождения Маши");
  });
  it("названия с [Имя] — в падеже по предлогу", () => {
    expect(titleWithName("Сказка про [Имя]", (c) => declineName("маша", c, "girl"))).toBe("Сказка про Машу");
    expect(titleWithName("Былина о [Имя]", (c) => declineName("лев", c, "boy"))).toBe("Былина о Льве");
  });
  it("род героя без явного пола — по имени", () => {
    expect(guessGender("Мария Ивановна")).toBe("girl");
    expect(fillTags("{ВОСПИТАТЕЛЬ.тв}", { hero: { name: "Маша", gender: "girl" }, group: { members: [], adults: [{ name: "мария ивановна" }] } })).toBe("Марией Ивановной");
  });
});

// ---------------------------------------------------------------------------
// 5. PDF и допы
// ---------------------------------------------------------------------------
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
function pageData(name: string, gender: string, audience: BookPageData["audience"] = "CHILD"): BookPageData {
  const img = { data: PNG, contentType: "image/png" };
  const n = normalizeName(name);
  return {
    title: `Сказка про ${declineName(name, "вин", gender)}`,
    dedication: `${declineName(name, "дат", gender)} — с любовью.`,
    heroName: name,
    audience,
    heroGender: gender,
    cover: img,
    spreads: Array.from({ length: 12 }, (_, i) => ({ text: i === 0 ? `Жил-был ${n}. Все знали ${declineName(name, "вин", gender)}.` : `Разворот ${i + 1}.`, image: img })),
  };
}

describe("PDF и файлы допов", () => {
  it("подписи книги и допов — имя с заглавной, слова по роду", () => {
    expect(bookWording({ heroName: "маша", audience: "CHILD", heroGender: "girl" }).madeFor).toBe("Эта книга создана специально для героини по имени Маша.");
    const html = bookHtml(pageData("маша", "girl"), { kind: "screen" }).html;
    expect(html).toContain("Сказка про Машу");
    expect(html).not.toMatch(/(?<![\p{L}])маш[аиуеой]/u);
    const a = { ...pageData("ЕВА", "girl", "TEEN"), pet: undefined };
    const poster = addonHtml("teen-poster", addonFileSpecs("teen-poster")[0], a)!.html;
    expect(poster).toContain("ЕВА · ГЛАВНАЯ ГЕРОИНЯ");
    const stickers = addonHtml("teen-stickers", addonFileSpecs("teen-stickers")[0], a)!.html;
    expect(stickers).toMatch(/>\s*Ева\s*</);
    expect(stickers).toContain("Главная героиня");
    expect(stickers).not.toMatch(/Главный герой/);
    const pet = { ...pageData("пушочек", "girl", "PET"), pet: { species: "cat" } };
    const st = addonHtml("pet-postcards", addonFileSpecs("pet-postcards")[1], pet)!.html;
    expect(st).toContain("Пушочек");
    expect(st).toContain("Я тут главная");
  });

  const chrome = (() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const p = require("playwright").chromium.executablePath() as string;
      return existsSync(p) ? p : null;
    } catch {
      return process.env.CHROMIUM_PATH ?? null;
    }
  })();
  let pdftotext = false;
  try {
    execFileSync("pdftotext", ["-v"], { stdio: "ignore" });
    pdftotext = true;
  } catch {}

  it.skipIf(!chrome || !pdftotext)("PDF: в извлечённом тексте — склонённое имя с заглавной", async () => {
    process.env.CHROMIUM_PATH ||= chrome!;
    const pdf = await renderPdf(pageData("маша", "girl"), { kind: "screen" });
    const { writeFileSync, mkdtempSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const f = join(mkdtempSync(join(tmpdir(), "names-")), "book.pdf");
    writeFileSync(f, pdf);
    const text = execFileSync("pdftotext", ["-enc", "UTF-8", f, "-"]).toString("utf8").replace(/\s+/g, " ");
    expect(text).toContain("Сказка про Машу");
    expect(text).toContain("Маше — с любовью");
    expect(text).toContain("по имени Маша");
    expect(text).not.toMatch(/(?<![\p{L}])маш[аиуеой](?![\p{L}])/u);
  }, 120_000);
});

// Падежи, которые проверяли тестировщики движка (отчёт ENGINE-2026-10-31: H4, M5)
describe("находки отчёта движка", () => {
  it.each([
    ["Mark", "род", "Mark"],
    ["Nikita", "тв", "Nikita"],
    ["Пушочек", "род", "Пушочка"],
    ["Малыш", "тв", "Малышом"],
    ["Черныш", "тв", "Чернышом"],
  ] as [string, Case, string][])("%s.%s → %s", (n, c, want) => expect(declineName(n, c, "boy")).toBe(want));
});

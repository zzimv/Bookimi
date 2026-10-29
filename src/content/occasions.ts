// Общие крючки поводов (владелец — агент 1): чем дополнить разворот 1 и 12, если у сюжета нет своего
// крючка для выбранного повода. Нейтральная проза, подходит для любой аудитории повода.
// Сюжеты в стихах и с ярким голосом должны давать свои occasionHooks (хотя бы "default" с {ПОВОД}).

import { OCCASIONS } from "./profiles";
import type { OccasionHook } from "./types";

export const GENERIC_HOOKS: Record<string, OccasionHook> = {
  "den-rozhdeniya": {
    opening: "В тот день у {ГЕРОЙ.род} был день рождения — и с самого утра чувствовалось, что случится что-то необыкновенное.",
    closing: "С днём рождения, {ЛАСКОВО.им}! Пусть новый год жизни будет таким же удивительным, как эта история.",
    openingScene: "balloons and a small birthday cake with candles nearby",
    closingScene: "a birthday celebration with a cake with candles and balloons",
  },
  "novyj-god": {
    opening: "Дело было под Новый год: за окнами кружил снег, пахло мандаринами и хвоей.",
    closing: "С Новым годом, {ЛАСКОВО.им}! Пусть в новом году чудес будет ещё больше.",
    openingScene: "a decorated New Year fir tree with garlands, tangerines on the table, snow outside the window",
    closingScene: "New Year celebration, a fir tree with warm lights, gifts, snow falling outside",
  },
  // Рождество (7 января) — тёплый зимний праздник: свет в окнах, тишина, семья; без религиозных утверждений
  rozhdestvo: {
    opening: "Стояли тихие январские дни: снег укрыл крыши, в окнах горели огоньки, и весь дом ждал Рождества.",
    closing: "С Рождеством, {ЛАСКОВО.им}! Пусть в доме всегда будет светло, тепло и спокойно.",
    openingScene: "a quiet snowy winter evening, warm lights glowing in the windows, gingerbread cookies and a candle in a glass holder on the table",
    closingScene: "a cozy winter holiday evening with family at a festive table, warm string lights, snow falling outside",
  },
  "staryj-novyj-god": {
    opening: "Ёлка всё ещё стояла в углу, а праздник и не думал заканчиваться: впереди был Старый Новый год — время загадать ещё одно желание.",
    closing: "Со Старым Новым годом, {ЛАСКОВО.им}! Пусть и второе желание сбудется.",
    openingScene: "a decorated fir tree still standing in mid-January, tangerines and a garland on the windowsill, snowy evening outside",
    closingScene: "a cheerful family winter evening by a decorated fir tree, tangerines on the table, snowflakes outside",
  },
  "vypusknoj-v-sadu": {
    opening: "Совсем скоро {ГЕРОЙ.дат} прощаться с детским садом — {Р:он|она} уже совсем {Р:большой|большая}.",
    closing: "До свидания, детский сад! Здравствуй, новое большое приключение, {ЛАСКОВО.им}!",
    openingScene: "kindergarten graduation balloons and a festive ribbon",
    closingScene: "kindergarten graduation party with balloons and a big ribbon",
  },
  "pervyj-klass": {
    opening: "Совсем скоро {ГЕРОЙ.дат} в первый класс — новый рюкзак уже ждёт у двери.",
    closing: "Первое сентября, {ЛАСКОВО.им}, — это начало самого интересного приключения. Ты справишься!",
    openingScene: "a new school backpack and a bouquet of autumn flowers by the door",
    closingScene: "first day of school, a bouquet of flowers, a school building with balloons",
  },
  "rozhdenie-brata-ili-sestry": {
    opening: "В тот год в семье {ГЕРОЙ.род} появилось самое маленькое и самое важное чудо — малыш.",
    closing: "Теперь {ГЕРОЙ.им} — {Р:старший брат|старшая сестра}. И это, пожалуй, самое большое приключение на свете.",
    openingScene: "a cozy room with a cradle and a tiny sleeping baby",
    closingScene: "a gentle family moment with a tiny baby in a blanket",
  },
  "vypusknoj-v-shkole": {
    opening: "Школа позади: впереди выпускной, лето и целая жизнь, которую {ГЕРОЙ.им} напишет {Р:сам|сама}.",
    closing: "С выпуском, {ЛАСКОВО.им}! Дальше — своя дорога, и она обязательно будет интересной.",
    openingScene: "graduation ribbons and a school building in the background",
    closingScene: "graduation celebration at dawn, friends with ribbons",
  },
  "8-marta": {
    opening: "Был тот самый день в начале весны, когда в воздухе пахнет мимозой.",
    closing: "С 8 Марта, {ЛАСКОВО.им}! Пусть весна приносит радость каждый день.",
    openingScene: "a bouquet of yellow mimosa in a vase, early spring sunlight",
    closingScene: "spring flowers and yellow mimosa, warm sunlight",
  },
  "23-fevralya": {
    opening: "Стоял конец февраля — время благодарить тех, на кого всегда можно положиться.",
    closing: "С 23 Февраля, {ЛАСКОВО.им}! Спасибо, что с тобой так надёжно и так интересно.",
    openingScene: "a festive card and ribbons on a table, winter light",
    closingScene: "a festive family moment with a card and ribbons",
  },
  "den-vlyublennyh": {
    opening: "Был февраль, и весь город будто сговорился: в витринах — сердечки, в кофейнях — пары.",
    closing: "С Днём всех влюблённых! Эта история — о тебе и о нас.",
    openingScene: "a winter street with heart decorations in shop windows",
    closingScene: "two cups of cocoa and small paper hearts",
  },
  "den-semi": {
    opening: "Стояло июльское лето, цвели ромашки — самое время вспомнить, как много значит семья.",
    closing: "С Днём семьи, любви и верности! Спасибо, что мы — вместе.",
    openingScene: "a summer meadow with chamomile flowers",
    closingScene: "a family picnic among chamomile flowers",
  },
  godovshchina: {
    opening: "Прошёл ещё один год вместе — а кажется, будто всё началось вчера.",
    closing: "С годовщиной! Впереди ещё много глав, и в каждой мы рядом.",
    openingScene: "two cups of tea and a small cake with one candle",
    closingScene: "a cozy anniversary evening with candles and flowers",
  },
  svadba: {
    opening: "Скоро прозвучит самое важное «да» — а пока вот история о том, как всё начиналось.",
    closing: "Совет да любовь! Пусть эта книга будет первой в вашей семейной библиотеке.",
    openingScene: "wedding flowers and two rings on a ribbon",
    closingScene: "a joyful wedding celebration with flowers and garlands",
  },
  "den-materi": {
    opening: "В конце ноября есть особенный день — день, когда всем мамам говорят спасибо.",
    closing: "С Днём матери, {ЛАСКОВО.им}! Спасибо за всё, что ты делаешь, — и за то, что ты просто есть.",
    openingScene: "a bouquet of autumn flowers and a handmade card",
    closingScene: "a warm family hug with flowers and a handmade card",
  },
  "den-otca": {
    opening: "В октябре есть день, когда весь мир говорит папам спасибо.",
    closing: "С Днём отца, {ЛАСКОВО.им}! Ты наш самый надёжный герой.",
    openingScene: "an autumn morning, a handmade card on the table",
    closingScene: "a warm family moment in autumn, a handmade card",
  },
  "den-babushek-i-dedushek": {
    opening: "В конце октября, когда листья уже золотые, наступает день бабушек и дедушек.",
    closing: "С праздником, {ЛАСКОВО.им}! Спасибо за тепло, мудрость и самые добрые истории.",
    openingScene: "golden autumn leaves outside a cozy window",
    closingScene: "a cozy family gathering with golden autumn leaves outside",
  },
  yubilej: {
    opening: "У {ГЕРОЙ.род} — юбилей, круглая дата, а значит, самое время рассказать историю, достойную праздника.",
    closing: "С юбилеем, {ЛАСКОВО.им}! Пусть лучшие главы ещё впереди.",
    openingScene: "a festive table with a cake and garlands",
    closingScene: "a jubilee celebration with friends, garlands and a cake",
  },
  pensiya: {
    opening: "Позади — годы большой работы, впереди — время для всего, на что раньше не хватало времени.",
    closing: "С новым этапом, {ЛАСКОВО.им}! Теперь у тебя есть время для самых интересных приключений.",
    openingScene: "an open road and a suitcase, morning light",
    closingScene: "a cheerful farewell party with flowers and a travel map",
  },
  "novaya-rabota": {
    opening: "У {ГЕРОЙ.род} начиналась новая глава — новая работа и новые высоты.",
    closing: "Поздравляем, {ЛАСКОВО.им}! Новые задачи по плечу тому, кто так умеет удивлять.",
    openingScene: "a new office desk with a plant and a cup of coffee",
    closingScene: "colleagues celebrating with balloons in an office",
  },
  pereezd: {
    opening: "Коробки, скотч, новый ключ на связке — начиналась жизнь на новом месте.",
    closing: "С новосельем! Пусть новый дом будет тёплым, а в нём — много счастливых историй.",
    openingScene: "cardboard boxes and a new key in a bright empty room",
    closingScene: "a cozy new home with warm lights in the windows",
  },
  "den-pitomca": {
    opening: "В конце ноября есть праздник для самых пушистых членов семьи — День домашних животных.",
    closing: "С праздником, {ЛАСКОВО.им}! Без тебя дом был бы просто квартирой.",
    openingScene: "a festive bow and a new toy on a cozy pet bed",
    closingScene: "a happy pet with a festive bow surrounded by family",
  },
  "den-koshek": {
    opening: "Первого марта — День кошек, а значит, сегодня {Р:главный|главная} в доме официально {ГЕРОЙ.им}.",
    closing: "С Днём кошек, {ЛАСКОВО.им}! Мур.",
    openingScene: "a sunny windowsill with a festive bow",
    closingScene: "the cat on a sunny windowsill wearing a festive bow",
  },
  "poyavlenie-pitomca": {
    opening: "В этот день {ГЕРОЙ.им} когда-то впервые {Р:вошёл|вошла} в наш дом — и дом сразу стал другим.",
    closing: "С годовщиной, {ЛАСКОВО.им}! Как хорошо, что ты у нас есть.",
    openingScene: "a doorway with a welcome mat and a new pet bed",
    closingScene: "a cozy home celebration with a small cake for the pet",
  },
  svoj: {
    opening: "Эта история — к особенному дню: {ПОВОД}.",
    closing: "С праздником, {ЛАСКОВО.им}! Пусть этот день — {ПОВОД} — запомнится надолго.",
  },
};

/** Повод в тексте книги: падежные формы, род и число (для {ПОВОД}, {ПОВОД.род}… и подсказки модели). */
export interface OccasionWord {
  им: string;
  род: string;
  дат: string;
  вин: string;
  тв: string;
  пр: string;
  /** Грамматический род: м / ж / ср; plural — множественное число. */
  gender: "m" | "f" | "n";
  plural?: boolean;
}

/** «день X» → все падежи (X не меняется). */
const den = (rest: string, cap = true): OccasionWord => {
  const d = cap ? "Д" : "д";
  return { им: `${d}ень ${rest}`, род: `${d}ня ${rest}`, дат: `${d}ню ${rest}`, вин: `${d}ень ${rest}`, тв: `${d}нём ${rest}`, пр: `${d}не ${rest}`, gender: "m" };
};
/** Несклоняемое («8 Марта»). */
const fixed = (w: string, gender: OccasionWord["gender"] = "n"): OccasionWord => ({ им: w, род: w, дат: w, вин: w, тв: w, пр: w, gender });

/**
 * Короткая форма повода для текста книги: не название раздела сайта («Переезд, новоселье»), а слово,
 * которое встаёт во фразу: «новоселье», «годовщина», «выход на пенсию». Имена собственные — с заглавной.
 */
export const OCCASION_WORDS: Record<string, OccasionWord> = {
  "den-rozhdeniya": den("рождения", false),
  "novyj-god": { им: "Новый год", род: "Нового года", дат: "Новому году", вин: "Новый год", тв: "Новым годом", пр: "Новом году", gender: "m" },
  rozhdestvo: { им: "Рождество", род: "Рождества", дат: "Рождеству", вин: "Рождество", тв: "Рождеством", пр: "Рождестве", gender: "n" },
  "staryj-novyj-god": { им: "Старый Новый год", род: "Старого Нового года", дат: "Старому Новому году", вин: "Старый Новый год", тв: "Старым Новым годом", пр: "Старом Новом году", gender: "m" },
  "vypusknoj-v-sadu": { им: "выпускной в детском саду", род: "выпускного в детском саду", дат: "выпускному в детском саду", вин: "выпускной в детском саду", тв: "выпускным в детском саду", пр: "выпускном в детском саду", gender: "m" },
  "pervyj-klass": { им: "первое сентября", род: "первого сентября", дат: "первому сентября", вин: "первое сентября", тв: "первым сентября", пр: "первом сентября", gender: "n" },
  "rozhdenie-brata-ili-sestry": { им: "рождение братика или сестрёнки", род: "рождения братика или сестрёнки", дат: "рождению братика или сестрёнки", вин: "рождение братика или сестрёнки", тв: "рождением братика или сестрёнки", пр: "рождении братика или сестрёнки", gender: "n" },
  "vypusknoj-v-shkole": { им: "выпускной", род: "выпускного", дат: "выпускному", вин: "выпускной", тв: "выпускным", пр: "выпускном", gender: "m" },
  "8-marta": fixed("8 Марта"),
  "23-fevralya": fixed("23 Февраля"),
  "den-vlyublennyh": den("всех влюблённых"),
  "den-semi": den("семьи, любви и верности"),
  godovshchina: { им: "годовщина", род: "годовщины", дат: "годовщине", вин: "годовщину", тв: "годовщиной", пр: "годовщине", gender: "f" },
  svadba: { им: "свадьба", род: "свадьбы", дат: "свадьбе", вин: "свадьбу", тв: "свадьбой", пр: "свадьбе", gender: "f" },
  "den-materi": den("матери"),
  "den-otca": den("отца"),
  "den-babushek-i-dedushek": den("бабушек и дедушек"),
  yubilej: { им: "юбилей", род: "юбилея", дат: "юбилею", вин: "юбилей", тв: "юбилеем", пр: "юбилее", gender: "m" },
  pensiya: { им: "выход на пенсию", род: "выхода на пенсию", дат: "выходу на пенсию", вин: "выход на пенсию", тв: "выходом на пенсию", пр: "выходе на пенсию", gender: "m" },
  "novaya-rabota": { им: "новая работа", род: "новой работы", дат: "новой работе", вин: "новую работу", тв: "новой работой", пр: "новой работе", gender: "f" },
  pereezd: { им: "новоселье", род: "новоселья", дат: "новоселью", вин: "новоселье", тв: "новосельем", пр: "новоселье", gender: "n" },
  "den-pitomca": den("домашних животных"),
  "den-koshek": den("кошек"),
  "poyavlenie-pitomca": { им: "годовщина появления в семье", род: "годовщины появления в семье", дат: "годовщине появления в семье", вин: "годовщину появления в семье", тв: "годовщиной появления в семье", пр: "годовщине появления в семье", gender: "f" },
};

/** Формы повода для {ПОВОД.падеж}: свой повод не склоняем (текст покупателя как есть), без повода — null. */
export function occasionWord(key: string, custom?: string): OccasionWord | null {
  if (key === "svoj" && custom?.trim()) return fixed(custom.trim());
  if (!key || key === "bez" || key === "svoj") return null;
  const w = OCCASION_WORDS[key];
  if (w) return w;
  const o = OCCASIONS.find((x) => x.key === key);
  return o ? fixed(o.label[0].toLowerCase() + o.label.slice(1), "m") : null;
}

/** Текст для {ПОВОД}: свой повод как есть, иначе короткая форма повода в середине фразы («новоселье», «Новый год»). */
export function occasionText(key: string, custom?: string): string {
  return occasionWord(key, custom)?.им ?? "";
}

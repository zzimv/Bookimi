// Новогодние книги для всех аудиторий (отдельный файл, чтобы не пересекаться с правками plots/*.ts).
//
// Решение владельца (2 ноября): тексты ФИКСИРОВАННЫЕ — покупатель получает ровно этот текст, меняются только
// имена, формы рода и крючки повода. Поэтому всё здесь — окончательная, вычитанная проза.
//
// Книги (coreOccasions: novyj-god; к Рождеству и Старому Новому году — свои крючки):
//  1. imya-i-lesnaya-yolochka      — малыши 2–4, «Повторялка на ночь»: ёлочку у дома наряжают всем лесом.
//  2. odinnadcat-polunochej        — дети 8–10, уютное приключение с фактами: 11 часовых поясов России.
//  3. devyat-etazhej-do-polunochi  — подростки, квест с юмором: праздник на площади отменили — делаем свой во дворе.
//  4. nash-novyj-god               — пара, «Наша история»: год в двенадцати месяцах до полуночного желания.
//  5. novogodnee-pismo             — мама/папа/бабушка/дедушка, письмо от детей или внуков о семейных традициях.
//  6. imya-vstrechaet-novyj-god    — собака или кошка, от первого лица: ёлка, коробки, салют без страха.
//
// Правила: в прозе не больше одной метки героя на абзац там, где можно; формы рода — полными словами
// ({Р:нашёл|нашла}); сцены — по-английски, без имён; у книги для собак и кошек нет видовых примет («гав», «мяу»).

import type { Plot } from "../types";

const NY_OCCASIONS = ["novyj-god", "rozhdestvo", "staryj-novyj-god"];

export const NEWYEAR_PLOTS: Plot[] = [
  // ───────────────────────────── 1. Малыши · Ёлочка у опушки ─────────────────────────────
  {
    slug: "imya-i-lesnaya-yolochka",
    audience: "CHILD",
    segments: ["kids-2-4"],
    title: "[Имя] и лесная ёлочка",
    tagline: "Маленькая ёлочка без игрушек — и целый лес друзей, которые придут её нарядить.",
    description:
      "Тихая новогодняя сказка-цепочка для самых маленьких. У дома растёт ёлочка без шариков и огоньков, и ваш малыш решает её нарядить. Хруп-хруп — прискакал зайка с шишкой, цок-цок — белочка с орешком, потом снегирь, лисичка и сонный мишка со звездой. Повторы, звуки и ласковый финал — под одеяло и спать.",
    ageMin: 2,
    ageMax: 4,
    occasions: NY_OCCASIONS,
    coreOccasions: ["novyj-god"],
    textStyle: "cumulative-bedtime",
    artStyles: ["watercolor-air", "soft-gouache", "naive-watercolor", "kind-classic"],
    theme: "winter",
    heroKind: "child",
    extras: { roles: ["sibling", "toy", "pet", "friend"], min: 0, max: 2, note: "Брат, сестра или любимая игрушка могут прийти к ёлочке вместе с малышом" },
    interests: ["животные", "природа"],
    coverScene:
      "a toddler in a knitted hat and mittens next to a small fir tree at the edge of a snowy forest, a hare, a squirrel, a bullfinch, a fox and a sleepy bear cub gathered around, soft evening snow, a cozy house window glowing nearby",
    spreads: [
      {
        text: "Зима. Тихо-тихо. У самого дома, на опушке, растёт маленькая ёлочка — без шариков, без огоньков. {ГЕРОЙ.им} погладил{Р:|а} колючую веточку:\n— Не грусти, ёлочка! Скоро Новый год. Мы тебя нарядим!",
        scene: "a toddler in warm winter clothes gently touching a branch of a small bare fir tree at the edge of a snowy forest, a house with a glowing window right behind, quiet falling snow", cast: [],
      },
      {
        text: "Хруп-хруп — скачет по снегу зайка-попрыгайка.\n— Кто-кто у ёлочки стоит?\n— Это я, {ГЕРОЙ.им}. Ёлочку наряжаю.\n— А можно с тобой?\n— Иди!\nПрыг — и зайка повесил на ветку шишку.",
        scene: "a white hare hopping through the snow toward the toddler by the little fir tree, the hare hanging a pine cone on a low branch", cast: ["hare"],
      },
      {
        text: "Цок-цок — спускается с сосны белочка-хлопотунья.\n— Кто-кто у ёлочки стоит?\n— Это мы: {ГЕРОЙ.им} да зайка.\n— А можно с вами?\n— Иди!\nБелочка повесила на ветку золотой орешек. Блестит!",
        scene: "a red squirrel climbing down a tall pine trunk, hanging a small golden nut on the little fir tree, the toddler and the hare watching happily", cast: ["hare", "squirrel"],
      },
      {
        text: "Чик-чирик — прилетел снегирь-красногрудик.\n— Кто-кто у ёлочки стоит?\n— {ГЕРОЙ.им}, зайка да белочка.\n— А можно с вами?\n— Лети!\nСнегирь принёс бусы из рябины — красные-красные.",
        scene: "a round red-breasted bullfinch flying in with a string of red rowan berries in its beak, draping it over the little fir tree, the toddler, hare and squirrel looking up", cast: ["hare", "squirrel", "bullfinch"],
      },
      {
        text: "Шурх-шурх — идёт лисичка-сестричка, хвост пушистый.\n— Кто-кто у ёлочки стоит?\n— {ГЕРОЙ.им}, зайка, белочка да снегирь.\n— А можно с вами?\n— Иди!\nЛисичка повязала на ёлочку рыжий бантик.",
        scene: "a friendly fox with a fluffy tail tying an orange ribbon bow on the little fir tree, the toddler, hare, squirrel and bullfinch around it in the snow", cast: ["hare", "squirrel", "bullfinch", "fox"],
      },
      {
        text: "Топ-топ — идёт мишка-топтыжка, сонный-сонный: проснулся на минуточку, на Новый год посмотреть.\n— Кто-кто у ёлочки стоит?\n— Это мы, все-все-все!\n— А можно с вами?\n— Иди!\nМишка принёс звезду — большую, блестящую.",
        scene: "a sleepy bear cub in the snow carrying a big shiny star, yawning, the toddler and all the little forest animals welcoming him by the fir tree", cast: ["hare", "squirrel", "bullfinch", "fox", "bear-cub"],
      },
      {
        text: "Шишка от зайки, орешек от белочки, бусы от снегиря, бантик от лисички. А звезду — куда? На самую макушку! Зайка прыгал — не достал. Белочка тянулась — не дотянулась.",
        scene: "the little fir tree decorated with a pine cone, a golden nut, rowan beads and an orange bow, the hare jumping and the squirrel stretching toward the top, the toddler holding the star", cast: ["hare", "squirrel", "bullfinch", "fox", "bear-cub"],
      },
      {
        text: "Мишка поднял {ГЕРОЙ.вин} высоко-высоко — выше зайки, выше белочки, выше лисьего хвоста. Раз — и звезда на макушке! Вот так!",
        scene: "the gentle bear cub lifting the smiling toddler up high, the toddler placing the big star on top of the little fir tree, the animals cheering below", cast: ["hare", "squirrel", "bullfinch", "fox", "bear-cub"],
      },
      {
        text: "— Ой, а огоньков-то нет! — вздохнул зайка.\nТут из-за облачка выглянул месяц.\n— Кто-кто у ёлочки стоит?\n— Это мы, все-все-все!\n— А можно с вами?\n— Свети!",
        scene: "a smiling crescent moon peeking out from behind a soft cloud above the snowy edge of the forest, the toddler and the animals by the fir tree looking up at it", cast: ["moon", "hare", "squirrel", "bullfinch", "fox", "bear-cub"],
      },
      {
        text: "Месяц рассыпал по веточкам звёздочки — динь-динь, динь-динь! Засияла ёлочка: шишка, орешек, бусы, бантик, звезда — и огоньки.\n— С Новым годом! — закричали все-все-все.",
        scene: "the little fir tree glowing with tiny golden star lights scattered by the moon, the toddler and all the forest animals dancing around it, gentle snowfall", cast: ["hare", "squirrel", "bullfinch", "fox", "bear-cub"],
      },
      {
        text: "Падает снег. Тихо-тихо. Зайка зевает. Белочка зевает. Снегирь прячет нос в пёрышки. А мишка зевает громче всех: а-а-ах! Пора спать.",
        scene: "the forest animals growing sleepy around the glowing fir tree, the bear cub yawning widely, the bullfinch tucking its beak into its feathers, soft blue evening", cast: ["hare", "squirrel", "bullfinch", "fox", "bear-cub"],
      },
      {
        text: "— {ЛАСКОВО.им}, домой! — зовут из окошка.\nТёплая кроватка, мягкая подушка. А за окном светится маленькая ёлочка. Зима. Тихо-тихо. С Новым годом!",
        scene: "the toddler tucked into a cozy bed under a warm blanket, through the window the little decorated fir tree glowing softly at the edge of the snowy forest", cast: [],
      },
    ],
    occasionHooks: {
      "novyj-god": { opening: "", closing: "" },
      rozhdestvo: {
        opening: "Эту сказку хорошо читать в Рождество. А случилась она под Новый год.",
        closing: "С Рождеством, {ЛАСКОВО.им}! Сладких снов.",
        openingScene: "warm lights in the windows of the house, a candle on the windowsill",
        closingScene: "a candle glowing softly on the windowsill next to the sleeping toddler",
      },
      "staryj-novyj-god": {
        opening: "Ёлка ещё стоит — значит, можно рассказать сказку про ёлочку ещё разок.",
        closing: "Со Старым Новым годом, {ЛАСКОВО.им}! Сладких снов.",
        openingScene: "a decorated fir tree still standing in the room in mid-January",
        closingScene: "a decorated fir tree glowing in the dark room next to the sleeping toddler",
      },
      default: {
        opening: "Сегодня у нас праздник — {ПОВОД}. А сказка у нас — зимняя.",
        closing: "И пусть праздник — {ПОВОД} — будет тёплым, как эта сказка. Сладких снов, {ЛАСКОВО.им}!",
      },
    },
  },

  // ───────────────────────────── 2. Дети 8–10 · Одиннадцать полуночей ─────────────────────────────
  {
    slug: "odinnadcat-polunochej",
    audience: "CHILD",
    segments: ["kids-8-10"],
    title: "[Имя] и одиннадцать полуночей",
    tagline: "Новый год приходит в Россию одиннадцать раз — и кто-то должен проследить, чтобы ни одна полночь не опоздала.",
    description:
      "Тридцать первого декабря, без пяти три, из глобуса выкатывается крошечная Минутка из Службы Новогодней Полуночи: сквозняк перепутал всё расписание! Ваш ребёнок разбирается, почему Новый год начинается на Камчатке, где на острове Ратманова в четырёх километрах «ещё вчера», чем знаменит Байкал и где проходит граница Европы и Азии. Улики, логика, пропавшая карточка — и одиннадцать встреченных полуночей за одну ночь.",
    ageMin: 8,
    ageMax: 10,
    occasions: NY_OCCASIONS,
    coreOccasions: ["novyj-god"],
    textStyle: "cozy-adventure",
    artStyles: ["cozy-detail", "ink-humor", "kind-classic", "pen-ink-1920s"],
    theme: "winter",
    heroKind: "child",
    extras: { roles: ["sibling", "friend", "pet", "toy"], min: 0, max: 3, note: "Брат, сестра или друг могут помогать разбирать карточки" },
    interests: ["география", "наука", "путешествия", "загадки"],
    coverScene:
      "a child kneeling by a big glowing globe on the floor of a cozy room on New Year's Eve, a tiny girl the size of a thimble in a pompom hat sitting on top of the globe holding a pocket watch, colorful cards scattered on the rug, tiny fireworks rising from the globe",
    spreads: [
      {
        text: "Тридцать первое декабря, без пяти три. {ГЕРОЙ.им} {Р:клеил|клеила} на окно бумажную снежинку, когда старый глобус на полке вдруг зажужжал и закрутился сам собой. На Камчатке вспыхнула искра. А потом оттуда выкатилась девочка ростом с напёрсток — в шапке с помпоном, с часами на цепочке и с охапкой разноцветных карточек. Снежинка на окне так и осталась приклеенной наполовину.",
        scene: "a child sticking a paper snowflake on a window in the afternoon, turning in surprise toward an old globe on a shelf that spins by itself, a spark on the far east of the map and a tiny girl in a pompom hat tumbling out with an armful of colorful cards", cast: ["tiny-girl"],
      },
      {
        text: "— Минутка, Служба Новогодней Полуночи, — представилась гостья и чихнула. — Беда! Сквозняк перепутал всё расписание. Новый год ведь приходит не везде сразу: он шагает по стране с востока на запад, из одного часового пояса в другой. А у России их одиннадцать! Одиннадцать полуночей — и каждую нужно встретить вовремя. Первая — через пять минут. Поможешь?",
        scene: "the tiny girl in a pompom hat standing on the desk next to a pocket watch, pointing at a globe with eleven glowing stripes across Russia, the child leaning in to listen", cast: ["tiny-girl"],
      },
      {
        text: "Карточки разлетелись по ковру: Москва, Якутск, Калининград, Камчатка… С какой начать? «Земля вращается с запада на восток, — рассуждал{Р:|а} {ГЕРОЙ.им}. — Значит, восток первым встречает утро. И полночь — тоже. Всё по очереди, как в хороводе». На глобус легла карточка «Камчатка и Чукотка».\n— Пятнадцать ноль-ноль по Москве — на Камчатке полночь! — пискнула Минутка.",
        scene: "the child sitting on the rug among scattered colorful cards, thoughtfully placing one card on the far eastern tip of the globe, the tiny girl holding up her pocket watch showing three o'clock", cast: ["tiny-girl"],
      },
      {
        text: "— Ура-а! — донеслось из глобуса. А на кухне пахло оливье: здесь до Нового года было ещё далеко.\n— Смотри, — Минутка показала на крошечный остров у Чукотки. — Это остров Ратманова. В четырёх километрах от него — остров, где уже Америка. Между ними почти сутки разницы: у нас Новый год, а там ещё вчера.\n— Значит, можно сплавать во вчера?\n— Лёд, граница, и никто не разрешит, — вздохнула Минутка.",
        scene: "a close-up of the globe with two tiny islands in a frozen strait, one with festive fireworks and one in calm morning light, the tiny girl pointing at them and the child grinning, a bowl of salad visible through the kitchen door", cast: ["tiny-girl"],
      },
      {
        text: "Четыре часа — полночь в Магадане и на Сахалине. Пять — во Владивостоке. И тут из стопки выпрыгнула карточка «Екатеринбург»:\n— Теперь я! Я большой город!\n— Большой — не значит первый, — {Р:сказал|сказала} {ГЕРОЙ.им}. — Важно, где ты на глобусе. Сначала Якутск: он восточнее.\nКарточка подумала и вежливо отползла в конец очереди. А Минутка что-то черкнула в блокноте — кажется, «помощник толковый».",
        scene: "a paper card with a little face jumping up impatiently from a stack, the child holding up a finger and explaining calmly while pointing at the globe, the tiny girl laughing", cast: ["tiny-girl"],
      },
      {
        text: "Шесть часов — полночь в Якутии. Из глобуса дохнуло таким морозом, что снежинка на окне покрылась инеем.\n— Тут зимой бывает и минус пятьдесят, — гордо сказала Минутка. — А люди всё равно выходят к ёлке на площадь. В шубах до пят!\nСемь часов — Иркутск и Байкал, самое глубокое озеро на Земле: больше полутора километров воды подо льдом, а на льду — хоровод.",
        scene: "frosty breath swirling out of the globe and frost covering the paper snowflake on the window, inside the globe a tiny scene of people in long fur coats dancing around a fir tree on the clear ice of a huge lake", cast: [],
      },
      {
        text: "И тут {ГЕРОЙ.им} {Р:нахмурился|нахмурилась}. Часовых поясов — одиннадцать. А карточек… раз, два, три… На одну меньше! Пересчитали ещё раз. И ещё. Не помогло: не хватало карточки «Красноярск и Новосибирск». До их полуночи — восьми часов по Москве — оставалось двадцать минут. Минутка так побледнела, что стала похожа на снежинку.",
        scene: "the child counting cards laid out in a row on the rug with a puzzled frown, one empty gap in the row, the tiny girl turned pale and wringing her hands, a wall clock showing twenty to eight", cast: ["tiny-girl"],
      },
      {
        text: "Пришлось браться за дело по-сыщицки. Улика первая: на ковре — оранжевая корочка. Улика вторая: на пальцах — липко и сладко. Улика третья: Минутка принюхалась и сказала: «Пахнет Новым годом». И тут {ГЕРОЙ.им} {Р:вспомнил|вспомнила}: утром {Р:он|она} {Р:носил|носила} мимо глобуса миску с мандаринами. Миску подняли — и на донышке, приклеенная мандариновым соком, нашлась карточка! Без пяти восемь. Успели!",
        scene: "the child lifting a bowl of tangerines from the kitchen table and finding a paper card stuck to the bottom, an orange peel on the rug as a clue, the tiny girl cheering on the edge of the bowl", cast: ["tiny-girl"],
      },
      {
        text: "Восемь — Красноярск и Новосибирск. Девять — Омск. Десять — Екатеринбург, тот самый нетерпеливый. Глобус загорался полоска за полоской, как ступеньки.\n— А знаешь, что тут особенного? — спросила Минутка. — Рядом с ним проходит граница Европы и Азии. Новый год только что перешагнул из одной части света в другую!\n— Одной ногой, — уточнил{Р:|а} {ГЕРОЙ.им}.\nВ одиннадцать полночь пришла в Самару.",
        scene: "the globe glowing stripe after stripe from east to west, a tiny marker post on the Ural mountains with one side labeled by a European tree and the other by an Asian tree, the child and the tiny girl watching a glowing footprint step across", cast: ["tiny-girl"],
      },
      {
        text: "Одна из одиннадцати полуночей была особенной — своя. Когда очередь дошла до часового пояса, где живёт {ГЕРОЙ.им}, Минутка спрятала карточки за спину:\n— Эту полночь не зажигают. Её встречают.\nЗа столом сидела вся семья. Часы пробили двенадцать, и {Р:он|она} успел{Р:|а} загадать желание на седьмом ударе — с запасом. Минутка на подоконнике тоже что-то загадала, но не сказала что.",
        scene: "the child at a festive family table at midnight, everyone raising cups and smiling, a clock showing twelve, the tiny girl hiding cards behind her back on the windowsill and winking", cast: ["tiny-girl"],
      },
      {
        text: "Полночь в Москве — бьют куранты, и полстраны хором кричит «Ура!». А последняя полночь приходит в Калининград, когда в Москве уже час ночи. Её Минутка зажгла сама и уселась на Северный полюс глобуса. Глобус тихонько гудел, как довольный кот.\n— Десять часов пути через всю страну, — сказала она. — И ни одной полуночи не потеряли.",
        scene: "late at night, the whole globe glowing with eleven lit stripes, the tiny girl sitting on the North Pole of the globe swinging her legs, the sleepy child resting their chin on folded arms beside it", cast: ["tiny-girl"],
      },
      {
        text: "Утром на Северном полюсе глобуса лежала золотая карточка: «Почётный сотрудник Службы Новогодней Полуночи. Следующее дежурство — 31 декабря, 15:00 по Москве». Карточку {ГЕРОЙ.им} {Р:спрятал|спрятала} в самый надёжный ящик. Ещё бы: не каждый за одну ночь встречает Новый год одиннадцать раз! А Минутка, говорят, теперь хранит запасное расписание в банке из-под мандаринов. На всякий случай. С Новым годом, {ЛАСКОВО.им}!",
        scene: "New Year morning, snowy light through the window, the child holding a small golden card found on top of the quiet globe, the paper snowflake still on the glass", cast: [],
      },
    ],
    occasionHooks: {
      "novyj-god": { opening: "", closing: "" },
      rozhdestvo: {
        opening: "Эта история случилась под Новый год, а рассказать её лучше всего в тихие рождественские дни.",
        closing: "И с Рождеством! Пусть чудеса приходят вовремя — в любом часовом поясе.",
        openingScene: "a candle and gingerbread cookies on the windowsill beside the globe",
        closingScene: "a quiet snowy evening, a candle glowing next to the globe and the golden card",
      },
      "staryj-novyj-god": {
        opening: "Знаешь, откуда взялся Старый Новый год? Когда-то в России жили по старому календарю, и Новый год наступал на тринадцать дней позже. Праздник остался — как второй шанс. А первый был вот такой.",
        closing: "А со Старым Новым годом — отдельно! Вторая полночь тоже строго по расписанию.",
        openingScene: "an old paper calendar with January pages next to the globe",
        closingScene: "the decorated fir tree in mid-January and the globe glowing softly again",
      },
      default: {
        opening: "В этой книге — Новый год. А у нас сегодня ещё и {ПОВОД}.",
        closing: "Пусть и этот праздник — {ПОВОД} — наступит точно вовремя, как полночь по расписанию.",
      },
    },
  },

  // ───────────────────────────── 3. Подростки · Девять этажей до полуночи ─────────────────────────────
  {
    slug: "devyat-etazhej-do-polunochi",
    audience: "TEEN",
    segments: ["teens-11-13", "teens-14-17"],
    title: "[Имя] и девять этажей до полуночи",
    tagline: "Праздник на площади отменили из-за снегопада. Значит, будет свой — во дворе. Девять этажей, девять уровней, лифт не работает.",
    description:
      "Тридцать первое декабря, три часа дня: городской праздник отменён, сцену не довезли. Ваш подросток и друг с «очень опасным выражением лица» решают устроить Новый год во дворе собственного дома. Каждый этаж — уровень: откопать двор, оживить гирлянду из прошлого века двоичным поиском, уговорить трубача, который будил всех по утрам, и пройти финального босса — строгого старшего по дому. Смешно, по-соседски тепло и без нравоучений.",
    ageMin: 11,
    ageMax: 17,
    occasions: NY_OCCASIONS,
    coreOccasions: ["novyj-god"],
    textStyle: "quest-fantasy-humor",
    artStyles: ["graphic-novel", "risograph-zine", "ink-humor", "painterly-fantasy"],
    theme: "city-night",
    heroKind: "teen",
    extras: {
      roles: ["friend", "sibling"],
      min: 1,
      max: 3,
      note: "Первый — друг или подруга, напарник по операции «Двор»; остальные помогают на уровнях",
    },
    interests: ["организация", "техника", "математика", "музыка"],
    coverScene:
      "a nine-story apartment building at night with every window lit like a giant New Year tree, a courtyard below with a glowing fir tree, an ice slide and neighbors gathered, two teens in winter hats standing in front with a clipboard, a huge countdown number projected on a blank wall, graphic novel style",
    spreads: [
      {
        text: "31 декабря, 15:02. Сообщение в чате дома: «Из-за снегопада праздник на главной площади отменяется. Сцену не довезли. Встречайте Новый год дома!»\n«Прекрасно, — подумал{Р:|а} {ГЕРОЙ.им}. — Весь город ждал, а праздник замело».\nЧерез минуту в дверь позвонили. На пороге {Р1:стоял|стояла} {ДОП1.им} — в шапке набекрень и с очень опасным выражением лица. С выражением «у меня есть план».",
        scene: "a teen in a hoodie reading a phone message by a window with heavy snowfall outside, then opening the apartment door to a friend in a crooked winter hat with a mischievous determined grin",
      },
      {
        text: "— Площадь замело? — {ДОП1.им} {Р1:нарисовал|нарисовала} на запотевшем окне квадрат. — Значит, праздник будет во дворе. Ёлка у нас есть — у третьего подъезда. Нужны огоньки, музыка, часы для отсчёта, горячий чай. И люди. В доме девять этажей.\nПеред глазами будто вспыхнула надпись: «Уровень 1 из 9. До полуночи — 8 ч 58 мин. Лифт: на техобслуживании».\n«Ну конечно», — вздохнул внутренний голос.",
        scene: "the friend drawing a square on a fogged kitchen window with a finger, the teen beside them, a glowing game-style status message floating in the air between them, snowy courtyard with a fir tree visible outside",
      },
      {
        text: "Уровень 1. Двор. Снега — по колено, лопат — две. {ДОП1.им} {Р1:написал|написала} в чат: «Кто хочет покидать снег на законных основаниях?» Через двадцать минут во дворе работала бригада из семи школьников, дворника и соседа-таксиста в отпуске. Из лишнего снега слепили ледяную горку. {ГЕРОЙ.им} {Р:взял|взяла} на себя дорожку к подъезду и через час впервые в жизни {Р:понял|поняла}, зачем людям варежки потолще.\n«Уровень пройден. Получено: двор. Бонус: горка».",
        scene: "a snowy apartment courtyard in the late afternoon, a cheerful crew of kids, a yard keeper and a neighbor in a fur hat shoveling paths around a fir tree, the teen and the friend directing, a fresh snow slide rising in the corner",
      },
      {
        text: "Уровень 2 пропустили: весь второй этаж уехал на дачу.\nУровень 3. Нина Аркадьевна, квартира 12. Коробка с надписью «Не трогать. Трогать бережно» и гирлянды за полвека. Самая длинная, на сто огоньков, не горела.\n— Огоньки соединены последовательно, — {Р:объяснил|объяснила} {ГЕРОЙ.им}. — Перегорит одна лампочка — разорвётся вся цепь.\n— И что, проверять все сто? — {Р1:ужаснулся|ужаснулась} {ДОП1.им}.",
        scene: "a cozy old apartment hallway, an elderly neighbor in a knitted shawl holding a big cardboard box of vintage garlands, the teen holding up a long string of old bulbs and explaining, the friend looking horrified",
      },
      {
        text: "— Не все. Делим пополам.\nПервая половина — горит, значит, беда во второй. Потом половина половины. Потом ещё. Семь проверок вместо ста: так программисты ищут ошибки в коде, и называется это двоичным поиском. Лампочка номер 73 сдалась. Запасная нашлась в той же коробке.\n— Она не горела с прошлого века, — ахнула Нина Аркадьевна.\n«Уровень пройден. Получено: 100 огоньков и уважение третьего этажа».",
        scene: "the old garland lying across a kitchen table divided into glowing and dark halves, the teen replacing a single tiny bulb with focus, the elderly neighbor clasping her hands in delight as the whole string lights up",
      },
      {
        text: "Уровень 5. Квартира 20. Отсюда весь год ровно в семь утра звучала труба, и чат дома писал жалобы. Дверь открыл долговязый студент с трубой под мышкой.\n— Нужна музыка, — {Р:сказал|сказала} {ГЕРОЙ.им}. — На весь двор.\n— На весь двор? — у него загорелись глаза. — Я три года этого ждал. У меня есть колонки. И вальс.\n«Получен союзник: Трубач. Особое умение: громко».",
        scene: "a lanky music student opening an apartment door with a shiny trumpet under his arm and eyes lighting up, the teen and the friend on the landing, sheet music and speakers visible inside",
      },
      {
        text: "Уровень 7. Финальный босс. Геннадий Семёнович — старший по дому, автор сорока объявлений «Соблюдайте тишину» и хозяин ключа от щитка во дворе. Без щитка нет электричества, без электричества — ни огоньков, ни музыки.\n— Шум после одиннадцати? — он посмотрел поверх очков. — Не положено.\n{ДОП1.им} уже {Р1:открыл|открыла} рот, чтобы спорить. {ГЕРОЙ.им} мягко {Р:наступил|наступила} {Р1:ему|ей} на ногу. Спорить с боссом — плохая тактика. Надо понять, чего он хочет на самом деле.",
        scene: "a stern older man in glasses and a cardigan standing in his doorway holding a key on a big ring, a notice board with many neat announcements behind him, the friend about to argue and the teen quietly stepping on their foot",
      },
      {
        text: "{ГЕРОЙ.им} {Р:огляделся|огляделась}. В прихожей — одна пара тапок. На кухне — одна чашка. На холодильнике — старая фотография: мальчик в костюме зайца на новогоднем утреннике, очень серьёзный, с морковкой в руке.\n— Геннадий Семёнович, — {Р:сказал|сказала} {Р:он|она}, — нам нужен человек, который будет вести обратный отсчёт. Громко, серьёзно, по правилам. Чтобы никто не сбился. Это ответственная должность.\nСтарший по дому долго молчал. Потом снял с гвоздя ключ.",
        scene: "a neat small apartment hallway with a single pair of slippers and a single cup in the kitchen, an old photo on the fridge of a boy in a bunny costume at a children's New Year party, the stern man slowly taking a key off a nail",
      },
      {
        text: "Уровень 9. Близнецы из 36-й: «У нас есть проектор. Обычно мы показываем кино на потолок». Решено: отсчёт будет на глухой стене соседней котельной — цифрами высотой в три этажа.\nА чай взял на себя весь подъезд. К десяти вечера во дворе стояли четыре термоса, самовар и столько пирогов, что под них пришлось выносить второй стол.\n«Уровень пройден. Получено: всё. Почти всё».",
        scene: "twin teens on the top floor aiming a projector out of a window at the blank brick wall of a small building across the courtyard, a giant test number glowing on it, below neighbors carrying thermoses, a samovar and plates of pies to a table by the fir tree",
      },
      {
        text: "23:40. Двор не узнать. Ёлка в ста огоньках Нины Аркадьевны. Трубач разыгрывается у подъезда, малыши летают с горки, взрослые разливают чай. Пришли даже соседи из дома напротив, а кто-то из малышей уже в третий раз спросил, скоро ли полночь.\n{ГЕРОЙ.им} стоял{Р:|а} посреди всего этого с пустым списком дел и не понимал{Р:|а}, что делать с руками.\n— Ничего не делать, — {Р1:сказал|сказала} {ДОП1.им}. — Это называется «получилось».",
        scene: "a lively snowy courtyard at night, the fir tree glowing with an old-fashioned garland, a trumpeter warming up, children sliding down an ice slide, neighbors with steaming cups, the teen standing in the middle with an empty checklist and the friend grinning beside them",
      },
      {
        text: "23:59:50. На стене котельной вспыхнула огромная десятка. Геннадий Семёнович поправил шапку и скомандовал так, что услышал весь район:\n— Десять!\n— Девять! — подхватил двор.\n…\n— Один!\nТрубач грянул вальс, а в окнах всех девяти этажей разом зажёгся свет. Дом стал похож на огромную ёлку.\n«Квест пройден. Награда: Новый год».",
        scene: "midnight, a giant glowing number one projected on a brick wall, the stern older man counting with his arm raised and a big smile, the whole courtyard cheering, the trumpeter playing, every window of the nine-story building lit up like a giant fir tree",
      },
      {
        text: "В половине первого {ГЕРОЙ.им} и {ДОП1.им} сидели на верхушке ледяной горки и пили чай из крышек от термоса. В чате дома было двести сообщений и ни одной жалобы. Последнее — от Геннадия Семёновича: «Предлагаю сделать традицией. Ответственные назначены».\n— Кажется, нас повысили, — {Р1:сказал|сказала} {ДОП1.им}.\n— До главных по двору, — кивнул{Р:|а} {ГЕРОЙ.им}. — С Новым годом, {Р1:напарник|напарница}.",
        scene: "the teen and the friend sitting on top of the ice slide after midnight drinking tea from thermos cups, the glowing courtyard and lit windows behind them, gentle snow, a phone screen full of happy messages",
      },
    ],
    occasionHooks: {
      "novyj-god": { opening: "", closing: "" },
      rozhdestvo: {
        opening: "Рождество — самое время рассказать, как в этом году двор чуть не остался без Нового года.",
        closing: "С Рождеством! Ёлка у третьего подъезда всё ещё горит: Нина Аркадьевна не разрешает её выключать.",
        openingScene: "a quiet snowy January courtyard with the fir tree still glowing",
        closingScene: "the courtyard fir tree with the old garland glowing on a calm January evening",
      },
      "staryj-novyj-god": {
        opening: "Старый Новый год — это когда праздник даёт второй шанс. Но в этом году первый шанс двор использовал на все сто.",
        closing: "Со Старым Новым годом! Геннадий Семёнович уже объявил повтор: сегодня, в полночь, во дворе.",
        openingScene: "a notice on the building door with a festive drawing of a fir tree",
        closingScene: "neighbors gathering again in the snowy courtyard around the glowing fir tree",
      },
      default: {
        opening: "Сегодня — {ПОВОД}, а значит, пора рассказать, как {ГЕРОЙ.им} {Р:спас|спасла} Новый год целого дома.",
        closing: "Пусть и этот день — {ПОВОД} — будет таким же: шумным, тёплым и со своими людьми рядом.",
      },
    },
  },

  // ───────────────────────────── 4. Пара · Наш Новый год ─────────────────────────────
  {
    slug: "nash-novyj-god",
    audience: "ADULT",
    segments: ["adult-couple"],
    title: "Наш Новый год",
    tagline: "Двенадцать месяцев вдвоём — и одно желание на двенадцатом ударе курантов.",
    description:
      "Тёплая книга-воспоминание от лица второй половинки: один год пары, месяц за месяцем. Первое января в пустом белом городе, две руки в одном кармане, ливень без зонта, окно, открытое на всю ночь, августовский звездопад с тайным желанием, записка «Хлеб. Молоко. Обнять» — и полночь, когда это желание наконец звучит вслух.",
    occasions: NY_OCCASIONS,
    coreOccasions: ["novyj-god"],
    textStyle: "our-story-memoir",
    artStyles: ["naive-watercolor", "linocut", "ink-humor", "retro-poster"],
    theme: "home",
    heroKind: "adult",
    extras: { roles: ["partner"], min: 1, max: 1, note: "Вторая половинка — обязательно: книга звучит от её лица" },
    interests: ["прогулки", "путешествия", "уют"],
    coverScene:
      "a couple standing close at a frosty window on New Year's Eve, wrapped in one blanket, a small decorated fir tree and a clock near midnight behind them, a wreath of twelve tiny vignettes of the seasons around the window",
    spreads: [
      {
        text: "Наш год начался первого января, ближе к полудню. Город ещё спал, на столе ждал вчерашний салат, а мы вышли на улицу — в пустой, белый, совершенно новый мир. «Давай в этом году больше гулять», — {Р:сказал|сказала} ты, {ЛАСКОВО.им}. Я {Р1:кивнул|кивнула}. Тогда я ещё не знал{Р1:|а}, что это лучший план года.",
        scene: "the couple walking down an empty snowy city street on a quiet January late morning, holding hands, fresh untouched snow and pale winter sun",
      },
      {
        text: "В феврале было так холодно, что ты {Р:спрятал|спрятала} мою руку в свой карман и не {Р:отпускал|отпускала} до самого дома. В одном кармане — две руки, идти приходилось боком, как двум крабам. Прохожие оглядывались. Нам было всё равно: нам было тепло.",
        scene: "the couple walking sideways along a frosty street at dusk, the hero holding the partner's hand inside one coat pocket, both laughing, passers-by glancing at them",
      },
      {
        text: "В марте ещё лежал снег, но ты упрямо {Р:объявил|объявила}: «Весна». И в доказательство поставил{Р:|а} на подоконник веточку вербы в банке. Через неделю на ней проклюнулись пушистые серые комочки. Ты был{Р:|а} прав{Р:|а}. Насчёт весны ты почти всегда прав{Р:|а}.",
        scene: "a sunny windowsill in early spring with a jar holding pussy willow branches covered in fluffy buds, melting snow outside, the hero pointing at the buds with a triumphant smile",
      },
      {
        text: "Апрель запомнился ливнем. Он начался, когда мы были на полпути к дому, а зонт, конечно, остался в прихожей. Сначала мы бежали. Потом поняли, что промокли насквозь, — и пошли медленно, прямо по лужам, смеясь, как дети. Дома были горячий чай и два полотенца на головах.",
        scene: "the couple walking slowly through a spring downpour, completely soaked, laughing and splashing through puddles, then a small inset of them at home with towels on their heads and cups of tea",
      },
      {
        text: "В мае мы впервые оставили окно открытым на всю ночь. Пахло черёмухой и мокрым асфальтом, а во дворе кто-то учился играть на гитаре — одну и ту же песню, раз двадцать подряд. К полуночи мы знали её наизусть и подпевали шёпотом.",
        scene: "a dark bedroom with a wide open window on a May night, white bird-cherry blossoms outside, the couple lying side by side and quietly singing along, a distant figure with a guitar on a bench in the courtyard",
      },
      {
        text: "В июне дни стали такими длинными, что вечер забыл наступить. Мы гуляли до темноты — а темнота всё не приходила. В половине одиннадцатого ты {Р:остановился|остановилась} посреди улицы: «Давай ещё немного». Мы гуляли ещё два часа. По-моему, это и было «немного».",
        scene: "the couple strolling along a river embankment under a pale glowing June night sky that never gets dark, street lamps on but the sky still light",
      },
      {
        text: "В июле у нас была дорога. Неважно куда: главное — окно, бутерброды в фольге и ты, {Р:уснувший|уснувшая} у меня на плече на сороковой минуте пути. Я боял{Р1:ся|ась} пошевелиться. Так и ехал{Р1:|а} — с затёкшей рукой и самым довольным лицом на свете.",
        scene: "a summer journey, sunlit fields passing in a window, the hero asleep on the partner's shoulder, the partner sitting very still with a blissful smile, sandwiches in foil on the little table",
      },
      {
        text: "В августе мы лежали на пледе и смотрели на звездопад: в эти ночи Земля проходит сквозь пыльный след кометы, и небо будто чиркает спичками. Мы насчитали девять падающих звёзд. На пятой ты загадал{Р:|а} желание — и ничего мне не {Р:сказал|сказала}. Только улыбнул{Р:ся|ась}: «В декабре узнаешь».",
        scene: "the couple lying on a blanket in a summer field at night watching a meteor shower, streaks of light across a starry sky, the hero with eyes closed making a wish",
      },
      {
        text: "Сентябрь вернул будни: будильники, дела, списки покупок на холодильнике. Но в каждом списке внизу, твоим почерком, было что-то лишнее: «Хлеб. Молоко. Обнять». Я выполнял{Р1:|а} все пункты. Особенно последний.",
        scene: "a close-up of a handwritten shopping list on a fridge door held by a magnet, and in the kitchen the partner hugging the hero from behind while they unpack groceries",
      },
      {
        text: "Был в октябре и трудный день — такой, когда всё валится из рук и не хочется разговаривать. Ты ни о чём не {Р:спрашивал|спрашивала}. Ты просто {Р:сварил|сварила} суп, {Р:сел|села} рядом и {Р:включил|включила} ту самую песню из майского двора. И день, который не задался с утра, закончился хорошо.",
        scene: "a rainy October evening in a cozy kitchen, two bowls of steaming soup on the table, the hero sitting close beside the tired partner, a small speaker playing music, warm lamplight",
      },
      {
        text: "В ноябре темнело в пять, а ночью выпал первый снег. Ты {Р:разбудил|разбудила} меня в два часа: «Смотри!» Мы стояли у окна, завернувшись в одно одеяло, и смотрели, как двор становится белым. Я подумал{Р1:|а}: вот бы запомнить эту минуту навсегда. Кажется, получилось.",
        scene: "the couple wrapped together in one blanket at a dark window at night, watching the first snow fall and cover a quiet courtyard under a street lamp",
      },
      {
        text: "И вот — тридцать первое декабря. Бьют куранты, ты держишь меня за руку и шепчешь: «Помнишь август? Я загадал{Р:|а}, чтобы следующий год был таким же». {ЛАСКОВО.им}, вот моё желание, на двенадцатом ударе: ещё один такой год. И ещё. И ещё. Все — с тобой.\nС Новым годом.\n{Р1:Твой|Твоя} {ДОП1.им}",
        scene: "New Year's Eve at midnight, the couple holding hands by a small glowing fir tree, a clock striking twelve, snow outside the window, the hero whispering into the partner's ear",
      },
    ],
    occasionHooks: {
      "novyj-god": { opening: "", closing: "" },
      rozhdestvo: {
        opening: "Я дарю тебе эту книгу в Рождество — в самые тихие дни года, когда так хорошо вспоминать.",
        closing: "\nP. S. С Рождеством, {ЛАСКОВО.им}. Пусть у нас дома всегда будет так же тепло и светло.",
        openingScene: "a candle and a small gift wrapped in paper on the windowsill on a quiet snowy evening",
        closingScene: "the couple by candlelight on a calm winter evening, snow outside",
      },
      "staryj-novyj-god": {
        opening: "Говорят, в Старый Новый год можно загадать ещё одно желание. Своё я уже знаю. А пока — вспомню, каким он был, этот год.",
        closing: "\nP. S. Со Старым Новым годом! Второе желание — то же самое, что и первое.",
        openingScene: "the fir tree still standing in mid-January, tangerines on the table",
        closingScene: "the couple by the fir tree in mid-January, smiling, snow outside",
      },
      default: {
        opening: "Сегодня — {ПОВОД}, а мне хочется вспомнить всё, что было с нами за год. Месяц за месяцем.",
        closing: "\nP. S. Пусть этот день — {ПОВОД} — станет началом ещё одного такого года.",
      },
    },
  },

  // ───────────────────────────── 5. Мама, папа, бабушка, дедушка · Новогоднее письмо ─────────────────────────────
  {
    slug: "novogodnee-pismo",
    audience: "ADULT",
    segments: ["adult-parent", "adult-grandparent"],
    title: "Новогоднее письмо",
    tagline: "Коробка с игрушками в газетах, мандариновая спираль, «один кубик в рот» — спасибо за все наши Новые годы.",
    description:
      "Письмо от детей или внуков маме, папе, бабушке или дедушке — о том, как в нашей семье встречали Новый год. Стеклянная сосулька с верхней полки, кривоватая ёлка «лучшей стороной к комнате», оливье всей семьёй, бесконечное тридцать первое, самодельные открытки, двенадцать ударов курантов и самое тихое утро в году. А в конце — то, что мы поняли, когда выросли: новогоднее чудо всегда делал один человек.",
    occasions: NY_OCCASIONS,
    coreOccasions: ["novyj-god"],
    textStyle: "our-story-memoir",
    artStyles: ["kind-classic", "vintage-postcard", "pen-ink-1920s", "naive-watercolor"],
    theme: "home",
    heroKind: "adult",
    extras: { roles: ["child", "grandchild"], min: 1, max: 3, note: "Дети или внуки — авторы письма; в конце все подписываются" },
    interests: ["семья", "традиции", "праздники"],
    coverScene:
      "a warm family room on New Year's Eve, a decorated fir tree with old glass ornaments, a bowl of tangerines and an open handwritten letter on the table, the hero smiling with children of different ages gathered around",
    spreads: [
      {
        text: "Дорог{Р:ой|ая} {ЛАСКОВО.им}!\nЭто письмо мы пишем в декабре, когда темнеет рано, а в магазинах уже пахнет мандаринами. Мы долго думали, что тебе подарить. А потом поняли: лучше всего — вспомнить. Все наши Новые годы, которые ты для нас {Р:устроил|устроила}. Вот они.",
        scene: "children of different ages writing a letter together at a kitchen table on a dark December evening, a bowl of tangerines, snow outside the window, an old photo album open beside them",
      },
      {
        text: "Помнишь коробку с ёлочными игрушками? Она жила на самой верхней полке, и каждый декабрь ты {Р:доставал|доставала} её торжественно, как сокровище. Игрушки были завёрнуты в старые газеты: стеклянная сосулька, шишка с облезлой позолотой, домик с окошком. Про каждую ты знал{Р:|а} историю. Мы разворачивали газеты и замирали: а вдруг разбилась?",
        scene: "the hero lifting a worn cardboard box down from a high shelf, children unwrapping old glass ornaments from newspaper with great care, a glass icicle and a little glass house in small hands",
      },
      {
        text: "Потом — ёлка. Она всегда оказывалась чуть-чуть кривой, и ты долго {Р:поворачивал|поворачивала} её «лучшей стороной к комнате». Нам разрешалось вешать игрушки только на нижние ветки. А когда мы подросли, ты {Р:доверил|доверила} нам верхушку. Это было как получить ключи от взрослой жизни.",
        scene: "the hero turning a slightly crooked fir tree in its stand to find its best side, small children hanging ornaments on the lowest branches, and an inset of an older child on tiptoe placing the star on top",
      },
      {
        text: "Мандарины пахли Новым годом с первой корочки. Ты {Р:умел|умела} снимать кожуру одной длинной спиралью — и никто из нас так и не научился. А корочки мы раскладывали сушиться на батарее, и весь дом пах праздником до самого Старого Нового года.",
        scene: "the hero peeling a tangerine in one long unbroken spiral while children watch in awe, tangerine peels drying on a warm radiator under a frosty window",
      },
      {
        text: "Тридцать первого с утра начинался оливье. Огромная миска, доски, ножи — и все за одним столом: кто чистит, кто режет, кто «пробует». Ты {Р:командовал|командовала} кубиками: «Мельче! Ровнее!» Правило было одно: один кубик — в рот, два — в миску. Мы его, конечно, нарушали. Ты, кажется, тоже.",
        scene: "the whole family around a kitchen table chopping vegetables into a huge salad bowl, the hero conducting with a wooden spoon, a child sneakily popping a cube into their mouth, everyone laughing",
      },
      {
        text: "Тридцать первое декабря — самый длинный день в году, это знает каждый ребёнок. Чтобы мы не изводились, ты {Р:придумывал|придумывала} задания: вырезать снежинки, разложить вилки, проверить, не стоит ли Дед Мороз под окном. Мы проверяли раз двадцать. Время шло быстрее. Теперь-то мы понимаем, что это была хитрость.",
        scene: "children cutting paper snowflakes and laying out forks on a festive table, one child pressing their nose to the window looking for Grandfather Frost outside, the hero handing out tasks with a sly smile",
      },
      {
        text: "Под ёлкой всегда лежали наши самодельные открытки: кривые снеговики и блёстки, которые потом находились по всему дому до весны. Мы были уверены, что ты понятия не имеешь, что мы там клеим за закрытой дверью. Теперь понимаем: всё ты знал{Р:|а}. И всё равно ахал{Р:|а} по-настоящему.",
        scene: "the hero holding a handmade glittery card with a lopsided snowman and gasping in delight, children beaming proudly, glitter scattered on the floor under the fir tree",
      },
      {
        text: "А потом — без пяти двенадцать. Все за столом, все замолчали. Ты {Р:поднимал|поднимала} палец: «Тихо! Загадываем!» Двенадцать ударов курантов — совсем немного, чтобы успеть самое главное. Мы шевелили губами и боялись не успеть. А ты смотрел{Р:|а} на нас — и, кажется, загадывал{Р:|а} что-то про нас.",
        scene: "a festive family table just before midnight, everyone silent with eyes closed making wishes, the hero holding up a finger and looking tenderly at the children, a clock showing almost twelve",
      },
      {
        text: "После полуночи мы выходили во двор. Снег скрипел, вдалеке взлетали салюты, и соседи — даже самые строгие — поздравляли друг друга. Ты {Р:держал|держала} нас за руки, чтобы мы не убежали в сугроб. А мы всё равно убегали. И ты смеял{Р:ся|ась}.",
        scene: "a snowy courtyard after midnight, distant fireworks in the sky, neighbors greeting each other, children running into a snowdrift and the hero laughing with outstretched hands",
      },
      {
        text: "Первое января было самым тихим утром года. Можно было спать сколько угодно, есть оливье на завтрак и не снимать пижаму до обеда. Ты {Р:говорил|говорила}: «Сегодня ничего не делаем — это тоже праздник». По-нашему, это лучшее правило из всех.",
        scene: "a quiet snowy New Year morning, children in pajamas eating salad for breakfast at the kitchen table, the hero in a cozy sweater with a cup of tea, the fir tree in the next room",
      },
      {
        text: "Мы долго думали, что новогоднее чудо приносит Дед Мороз. Потом выросли и узнали, кто на самом деле прятал подарки под ёлку, кто вставал раньше всех и ложился позже всех, чтобы праздник получился. Это был{Р:|а} ты. Всегда — ты. А теперь мы и сами ставим ёлки — и поворачиваем их лучшей стороной к комнате.",
        scene: "the hero quietly placing wrapped gifts under the fir tree late at night while the house sleeps, and an inset of the grown children now setting up their own fir tree, turning it to its best side",
      },
      {
        text: "Спасибо тебе за все наши Новые годы: за стеклянную сосульку в газете, за мандариновую спираль, за «один кубик в рот», за двенадцать ударов, которые ты всегда {Р:ждал|ждала} вместе с нами. В этом году мы загадаем одно: снова сидеть за одним столом — с тобой.\nС Новым годом, {ЛАСКОВО.им}!\nС любовью — {ДОПЫ.им}",
        scene: "the whole family gathered around the hero at a festive table by the fir tree, the old glass icicle ornament shining on a branch, tangerines and the handwritten letter on the table",
      },
    ],
    occasionHooks: {
      "novyj-god": { opening: "", closing: "" },
      rozhdestvo: {
        opening: "",
        closing: "\nP. S. Письмо дошло к Рождеству — и это хорошо: ёлка ещё стоит, а праздник всё длится. С Рождеством! Пусть в доме будет тепло и светло — как всегда, когда ты рядом.",
        openingScene: "a candle and gingerbread cookies on the windowsill beside the fir tree",
        closingScene: "a calm winter evening, the family by candlelight and the glowing fir tree",
      },
      "staryj-novyj-god": {
        opening: "",
        closing: "\nP. S. Это письмо мы приберегли к Старому Новому году — чтобы праздник у тебя был дважды. А корочки на батарее, наверное, ещё пахнут.",
        openingScene: "the fir tree still standing in mid-January, tangerine peels on the radiator",
        closingScene: "tangerine peels drying on a radiator and the family smiling by the fir tree",
      },
      default: {
        opening: "",
        closing: "\nP. S. А сегодня — ещё и {ПОВОД}. Пусть этот день будет таким же тёплым, как наши Новые годы.",
      },
    },
  },

  // ───────────────────────────── 6. Собака или кошка · Новый год от первого лица ─────────────────────────────
  {
    slug: "imya-vstrechaet-novyj-god",
    audience: "PET",
    segments: ["pet-dog", "pet-cat"],
    title: "[Имя] встречает Новый год",
    tagline: "В доме выросло дерево, под ним — коробки, а кто такой Новый год, никто толком не объясняет. Придётся разбираться самому.",
    description:
      "Новогодний рассказ от лица вашей собаки или кошки. Откуда в комнате дерево и почему оно моё? Зачем на нём шарики, если их нельзя трогать? Кого сторожить под ёлкой и когда наконец придёт этот Новый год — может, позвонит в дверь? Смешно, по-домашнему, с бережным салютом: когда за окном бабахает, хозяева рядом, шторы задёрнуты и под пледом совсем не страшно.",
    occasions: NY_OCCASIONS,
    coreOccasions: ["novyj-god"],
    textStyle: "pet-first-person",
    artStyles: ["pet-cartoon", "soft-gouache", "vintage-postcard", "watercolor-air"],
    theme: "pet-home",
    heroKind: "pet",
    extras: { roles: ["owner", "child", "partner", "sibling"], min: 1, max: 3, note: "Хозяева — «мои люди»; первый в списке — главный человек питомца" },
    interests: ["игрушки", "коробки", "вкусняшки"],
    coverScene:
      "the pet sitting proudly under a decorated New Year fir tree among wrapped gift boxes, a strand of tinsel draped over its back, warm garland lights, snow falling outside the window",
    spreads: [
      {
        text: "Меня зовут {ГЕРОЙ.им}, и я знаю про свой дом всё. Но в декабре мои люди стали вести себя подозрительно. Шуршат пакетами. Прячут коробки в шкаф. Шепчутся и пахнут мандаринами. Я {Р:насторожился|насторожилась}. Что-то готовится. И без меня это явно не обойдётся.",
        scene: "the pet watching suspiciously from the sofa as the owner sneaks rustling shopping bags into a wardrobe, tangerines on the table, early winter evening",
      },
      {
        text: "Однажды {ДОП1.им} {Р1:принёс|принесла} домой дерево. Настоящее, из леса! И {Р1:поставил|поставила} его прямо посреди комнаты. Я {Р:обнюхал|обнюхала} его со всех сторон: пахнет смолой, морозом и приключениями. Вывод очевиден: дерево моё. Всё новое в этом доме сначала моё, а уже потом общее.",
        scene: "the owner carrying a snowy fir tree into the living room, the pet circling it and sniffing the branches with great seriousness",
      },
      {
        text: "Потом мои люди стали вешать на дерево блестящие шарики. Шарики! На дереве! Будто специально для меня. Я тронул{Р:|а} один лапой — он сказал «дзынь» и закачался.\n— {ГЕРОЙ.им}, нельзя! — {Р1:сказал|сказала} {ДОП1.им}.\nЯ понимаю «нельзя» по-своему: «пока кто-то смотрит».",
        scene: "the owner hanging shiny ornaments on the fir tree, the pet reaching up with one paw to tap a swinging ball, the owner turning around with a mock-stern face",
      },
      {
        text: "Ночью, когда все уснули, я {Р:провёл|провела} проверку. {Р:Забрался|Забралась} под самые нижние ветки — там тихо, пахнет лесом и шарики блестят в свете фонаря из окна. Очень уютно. Утром меня нашли там: в мишуре и с иголкой на носу.\n— Смотрите, у нас новая ёлочная игрушка! — засмеялись мои люди. Я не спорил{Р:|а}.",
        scene: "morning light, the pet curled up under the lowest branches of the fir tree with tinsel draped over it and a pine needle on its nose, the owners laughing and peeking in",
      },
      {
        text: "Самой интересной на дереве оказалась мишура — блестящая шуршащая верёвочка. Я {Р:носил|носила} её по квартире, как знамя. Мои люди почему-то сразу перевесили мишуру повыше. И правильно: мишуру есть нельзя, это знает каждый уважающий себя питомец. Её можно только охранять. Издалека.",
        scene: "the pet proudly parading through the apartment with a strand of shiny tinsel like a banner, then the owner hanging the tinsel high on the tree while the pet watches from a distance",
      },
      {
        text: "Под деревом стали появляться коробки. Шуршащие, с бантиками — каждый день новая. Я {Р:лёг|легла} рядом и {Р:начал|начала} сторожить. Днём — с открытыми глазами. Ночью — с закрытыми, но очень внимательно. Ни одна коробка не пропала. Считаю, это моя заслуга.",
        scene: "the pet lying watchfully beside a pile of wrapped gift boxes with bows under the fir tree, one eye open, garland lights glowing softly",
      },
      {
        text: "Одна коробка пахла мной. Я знаю точно: я {Р:обнюхал|обнюхала} её сорок раз. Но {ДОП1.им} {Р1:сказал|сказала}: «Это — когда придёт Новый год». Кто такой Новый год и когда он приходит, мне не объяснили. На всякий случай я {Р:сел|села} ждать его у двери. Вдруг позвонит.",
        scene: "the pet sitting patiently and seriously by the front door, looking at it expectantly, a single wrapped gift box under the fir tree visible in the room behind",
      },
      {
        text: "Тридцать первого с утра на кухне что-то резали, варили и пекли. Я {Р:дежурил|дежурила} у стола. Ничего не упало. Ни-че-го. Зато мне дали кусочек варёной морковки. Морковка — это вам не котлета, но я {Р:сделал|сделала} вид, что счастлив{Р:|а}. Люди должны чувствовать, что стараются не зря.",
        scene: "a busy festive kitchen, the pet sitting on duty beside the table gazing upward, the owner handing it a small piece of boiled carrot",
      },
      {
        text: "Вечером мои люди нарядились, зажгли на дереве огоньки и сели за праздничный стол. Огоньки мигали: красный, зелёный, золотой. Я {Р:устроился|устроилась} у ног {ДОП1.род} и смотрел{Р:|а}, как они отражаются в шариках. Кажется, я начинаю понимать, зачем людям дерево в комнате.",
        scene: "a festive evening, the owners dressed up at a holiday table, the fir tree glowing with colorful lights, the pet resting at the owner's feet gazing at reflections in the ornaments",
      },
      {
        text: "А потом большие часы где-то в телевизоре пробили двенадцать раз. Все закричали «Ура!» и стали обниматься. Обнимали и меня — по очереди и все сразу. Так вот он какой, Новый год! Он не звонит в дверь. Он приходит, когда все обнимаются.",
        scene: "midnight, the owners cheering and hugging, the pet in the middle of a group hug looking surprised and pleased, the glowing fir tree behind them",
      },
      {
        text: "И тут за окном загрохотало: бах! бах-бабах! Я прижал{Р:|а} уши. Но {ДОП1.им} сразу {Р1:задёрнул|задёрнула} шторы, {Р1:сел|села} рядом со мной на пол, укрыл{Р1:|а} нас обоих пледом и {Р1:зашептал|зашептала}: «Это просто праздник шумит. Мы дома. Мы вместе». Под пледом грохот стал далёким. Почти уютным.",
        scene: "the owner sitting on the floor with the pet under a soft plaid blanket by closed curtains, gently stroking it, the pet calm with ears relaxed, faint colorful glow of distant fireworks at the edge of the curtains",
      },
      {
        text: "Потом мне открыли мою коробку. Там была новая игрушка — мягкая, шуршащая и пахнущая моими людьми. Я {Р:уснул|уснула} под деревом, среди обрывков бумаги. Вот что я понял{Р:|а} про Новый год: шарики — хорошо, коробки — отлично. Но лучше всего — когда все мои люди дома. Пусть Новый год приходит почаще. Хоть каждую неделю.",
        scene: "the pet asleep under the glowing fir tree with a new soft toy among scraps of wrapping paper, the owners smiling down at it, snow falling outside the window",
      },
    ],
    occasionHooks: {
      "novyj-god": { opening: "", closing: "" },
      rozhdestvo: {
        opening: "Мои люди говорят, что сейчас Рождество. Дерево всё ещё стоит в комнате — значит, можно рассказать, как оно здесь появилось.",
        closing: "С Рождеством, мои люди! Дерево можно не убирать. Я за ним присмотрю.",
        openingScene: "a candle on the windowsill and the fir tree still glowing in January",
        closingScene: "the pet keeping watch under the fir tree on a calm January evening",
      },
      "staryj-novyj-god": {
        opening: "Мои люди говорят, что Новый год бывает два раза: обычный и старый. Я за. Пусть будет хоть пять.",
        closing: "Со Старым Новым годом! Надеюсь, дерево остаётся.",
        openingScene: "the fir tree still standing in mid-January, tangerines on the table",
        closingScene: "the pet curled up under the fir tree in mid-January, snow outside",
      },
      default: {
        opening: "Сегодня у моих людей особенный день — {ПОВОД}. А я хочу рассказать про самый шуршащий праздник в году.",
        closing: "Пусть этот день — {ПОВОД} — будет таким же тёплым, как наш Новый год. Я рядом.",
      },
    },
  },
];

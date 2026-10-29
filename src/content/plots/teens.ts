// ВЛАДЕЛЕЦ: агент 4 (подростковые сюжеты). Никто другой этот файл не меняет.
//
// TEEN_PLOTS — сюжеты для TEEN, оба сегмента (teens-11-13, teens-14-17).
// Контракт Plot (src/content/types.ts): heroKind "teen", ageMin/ageMax обязательны, ровно 12 разворотов,
// метки — по docs/content/ARCHITECTURE.md, textStyle из TEXT_STYLE_IDS (голоса подростков:
// quest-fantasy-humor, detective, sci-fi, comic-captions, mock-epic, pushkin-verse), artStyles из
// ART_STYLE_IDS, theme из DEMO_THEME_KEYS (только ключи teens), occasions из OCCASIONS, occasionHooks
// для главных поводов сегмента + "default" с {ПОВОД}.
// Запреты сегментов: для 11–13 — никакой романтики; для 14–17 — максимум лёгкая симпатия;
// для всех — без насилия, алкоголя, брендов, реальных игр, соцсетей и франшиз.
// Обложка и сцены — «взрослая» подача (the teen, not the child). Проверка: validateContent().
//
// Сюжеты:
//   11–13: uroven-kotorogo-net (квест), tajna-nochnogo-muzeya (детектив, 11–15), stazher-orbity (фантастика)
//   14–17: tajna-nochnogo-muzeya, nochnoj-koncert (комикс), pereval-vybora (квест), bylina-o-treh-podvigah (эпос)
//
// requests (просьбы к интегратору, агенту 11): —

import type { Plot } from "../types";

export const TEEN_PLOTS: Plot[] = [
  // ───────────────────────────── 11–13 · Фэнтези-квест ─────────────────────────────
  {
    slug: "uroven-kotorogo-net",
    audience: "TEEN",
    segments: ["teens-11-13"],
    title: "[Имя] и Уровень, которого нет",
    tagline: "Старая приставка затягивает героя внутрь недописанной игры, где побеждает не сила, а голова.",
    description:
      "На антресолях находится серая приставка без названия. Стоит нажать единственную кнопку — и ваш подросток оказывается внутри игры, которую никто не дописал. Обидчивый мост, лабиринт зеркал, город бесконечных правил, башня без лестницы, ехидный квадратный кот-напарник и финальный босс, которому просто не с кем поговорить. Пройти можно только смекалкой, наблюдательностью и чувством юмора.",
    ageMin: 11,
    ageMax: 13,
    occasions: ["den-rozhdeniya", "novyj-god", "23-fevralya", "8-marta", "bez"],
    textStyle: "quest-fantasy-humor",
    artStyles: ["risograph-zine", "painterly-fantasy", "ink-humor"],
    theme: "game-world",
    heroKind: "teen",
    extras: {
      roles: ["friend", "sibling", "pet"],
      min: 0,
      max: 2,
      note: "Друг, брат или сестра — пиксельные жители, которые помогают строить лестницу; питомец может заменить кота-напарника.",
    },
    interests: ["игры", "программирование", "рисование", "конструкторы"],
    coverScene:
      "a teen standing confidently on a floating block of pixel grass above a vast pixelated world of bridges, mirror mazes and a tower in the clouds, a square-shaped cat on the shoulder, dramatic green light",
    spreads: [
      {
        text: "Суббота началась с дождя и поручения: разобрать наконец коробку с антресолей. В коробке нашлась приставка — серая, без названия, с единственной красной кнопкой. «Ну конечно, — подумал{Р:|а} {ГЕРОЙ.им}. — Сейчас нажму, и ничего не будет». {Р:Он|Она} нажал{Р:|а}. Экран телевизора мигнул, комнату залило зелёным светом, и в воздухе повисла строчка: «Игрок найден. Загрузка… 99%». Последний процент почему-то грузился прямо из-под ковра.",
        scene: "a teen in a messy bedroom on a rainy afternoon kneeling by an open cardboard box, holding an old grey game console with one red button, the TV screen flooding the room with green light",
      },
      {
        text: "Пол исчез, и {ГЕРОЙ.им} приземлил{Р:ся|ась} на квадратную траву. Небо было из пикселей, облака — из пикселей, даже ветер дул ступеньками. На камне сидел кот. Тоже квадратный.\n— Наконец-то, — сказал кот. — Я Байт, твой напарник. Правила простые: четыре уровня, финальный босс, выход. Сила здесь не работает, работает голова.\n— А если я не пройду?\n— Тогда будешь вечно разбирать ту коробку, — пожал плечами Байт. — Шучу. Наверное.",
        scene: "the teen landing on blocky pixel grass under a pixelated sky with square clouds, a square-shaped cat sitting on a stone looking unimpressed",
      },
      {
        text: "«Уровень 1. Мост Обидчивых Досок. Условие: перейти на другой берег». Мост выглядел надёжно, но первая же доска под ногой взвизгнула: «Можно было и поздороваться!» — и демонстративно рухнула в реку. Вторая сделала то же самое. Байт зевал так, будто видел это тысячу раз.\n«Отлично, — подумал{Р:|а} {ГЕРОЙ.им}. — Мост с чувствами. Ничего необычного». И тут {Р:он|она} заметил{Р:|а}: на каждой доске аккуратно вырезан номер.",
        scene: "the teen at the edge of a wooden pixel bridge over a river, one plank dramatically falling into the water, the square cat yawning nearby",
      },
      {
        text: "— Привет, Доска Номер Один, — серьёзно сказал{Р:|а} {ГЕРОЙ.им}. — Привет, Номер Два. Отличный цвет, кстати.\nДоски замерли. Потом зарделись. Потом выстроились в ровную дорожку, а самая старая даже прошептала: «Нас тут сто лет никто по имени не звал».\nНа том берегу вспыхнуло: «Уровень пройден. Получен навык: Вежливость. Открывает больше дверей, чем отмычка».\n— Неплохо для новичка, — проворчал Байт. Но хвостом всё-таки вильнул.",
        scene: "the teen walking across a bridge of happily blushing wooden planks, golden sparkles on the far bank, the square cat following with its tail up",
      },
      {
        text: "«Уровень 2. Лабиринт Зеркал. Условие: найти выход, не потеряв себя». В каждом зеркале было отражение {ГЕРОЙ.род} — только немного не такое: одно хмурилось, другое хвасталось, третье без конца извинялось. Все показывали в разные стороны и кричали: «Сюда! Нет, сюда!»\n— Подсказок не будет, — предупредил Байт. — Это личное.\n«Прекрасно, — подумал{Р:|а} {Р:герой|героиня}. — Целый хор меня, и ни один не знает дорогу».",
        scene: "the teen in a maze of tall mirrors, each reflection showing a different exaggerated expression, all of them pointing in different directions",
      },
      {
        text: "Тогда {ГЕРОЙ.им} сделал{Р:|а} то, чего лабиринт явно не ожидал: сел{Р:|а} на пол и спокойно занял{Р:ся|ась} любимым делом — тем, которое всегда помогает думать. Отражения растерянно замолчали. Одно за другим они тоже сели и занялись тем же самым. И только одно зеркало осталось пустым — за ним был выход.\n— Дошло, — хмыкнул Байт. — Себя находят не в споре, а в деле.\n«Уровень пройден. Навык: Спокойствие. Перезаряжается от чая».",
        scene: "the teen sitting cross-legged on the floor of the mirror maze absorbed in a favorite hobby, reflections calmly copying, one empty mirror glowing softly as an exit",
      },
      {
        text: "«Уровень 3. Город Правил». Здесь всё было запрещено: нельзя бегать, нельзя стоять, нельзя громко думать. Жители ходили на цыпочках и выглядели очень уставшими. У ворот дремал робот-стражник со свитком правил длиной в целую улицу.\n— Пройти нельзя, — сообщил он, не открывая глаз. — Правило сорок семь.\n— А что написано в правиле сорок восемь? — спросил{Р:|а} {ГЕРОЙ.им}.\nРобот открыл один глаз. Похоже, этот вопрос ему задавали впервые.",
        scene: "a gloomy pixel town full of signs with crossed-out pictograms, tired townsfolk tiptoeing, a drowsy robot guard at the gate holding a scroll that stretches down the whole street",
      },
      {
        text: "Читали вместе. Долго. Правило сто двенадцать отменяло правило сорок семь по вторникам. Правило триста разрешало всё, если ты помогаешь соседу. А последнее, мелким шрифтом, гласило: «Все правила можно пересмотреть, если кто-нибудь наконец дочитает до конца».\n— Сегодня вторник? — уточнил{Р:|а} {ГЕРОЙ.им}.\n— Здесь всегда вторник, — растерялся робот.\nЗапреты с грохотом посыпались со стен, и жители впервые за сто лет пробежались по улице.\n«Навык: Внимательность к мелкому шрифту. Редкий».",
        scene: "the teen and the robot guard sitting on the pavement reading the endless scroll together, signs falling off the walls, pixel townsfolk joyfully running down the street",
      },
      {
        text: "«Уровень 4. Башня Без Лестницы. Условие: подняться наверх». Башня уходила в облака, и в ней не было ни одной ступеньки — только кирпичики, рассыпанные по траве.\n— Это издевательство, — сказал Байт.\n— Это конструктор, — сказал{Р:|а} {ГЕРОЙ.им} и засучил{Р:|а} рукава.\nИ тут из-за кустов выглянули жители Города Правил — те самые, которых {Р:он|она} выручил{Р:|а}. Каждый держал в руках по кирпичику и смущённо улыбался.",
        scene: "the teen rolling up sleeves before a tall pixel tower with no stairs, bricks scattered on the grass, pixel townsfolk peeking out of bushes, each holding a brick",
      },
      {
        text: "Строили всей толпой: один подавал, другой держал, третий отвечал за шутки. Лестница росла виток за витком, и через час {ГЕРОЙ.им} уже стоял{Р:|а} на вершине, откуда был виден весь мир игры — мост, зеркала, город. «Навык: Команда. Работает только вместе с другими. Это не баг», — всплыло сообщение.\n— Я бы и сам залез, — заметил Байт. — Но так веселее.\nПиксельное солнце сделало вид, что это оно всё придумало.",
        scene: "the teen at the top of a freshly built spiral staircase wrapped around the tower, pixel townsfolk cheering below, a wide view of the whole pixel world at sunset",
      },
      {
        text: "На вершине ждал финальный босс — огромный дракон из тёмных пикселей. Он не рычал. Он сидел, обхватив хвост, и грустно смотрел вниз.\n— Меня так и не дописали, — сказал он. — Автор бросил игру на мне. Я не знаю, какой у меня конец.\n«Драться — точно не вариант», — подумал{Р:|а} {ГЕРОЙ.им} и сел{Р:|а} рядом.\n— Давай придумаем его вместе. Каким ты хочешь быть?\nДракон думал долго. А потом впервые улыбнулся — и засветился всеми цветами сразу.",
        scene: "a huge dragon made of dark pixels sitting sadly at the top of the tower hugging its tail, the teen sitting beside it and talking, the dragon starting to glow in many colors",
      },
      {
        text: "«Игра пройдена. Концовка: дружеская. Таких ещё не было». Комната вернулась на место, дождь кончился, коробка так и стояла неразобранной. В руке у {ГЕРОЙ.род} был крошечный пиксельный кот-брелок, и он, кажется, подмигнул.\nНавыки никуда не делись: вежливость, спокойствие, внимательность и умение собрать команду. В обычной жизни они работают даже лучше.\n«А коробку, — решил{Р:|а} {ГЕРОЙ.им}, — разберу завтра. Это тоже навык: знать, когда остановиться».",
        scene: "the teen back in the bedroom after the rain, sunlight through the window, holding a tiny pixel cat keychain that seems to wink, the old console on the floor",
      },
    ],
    occasionHooks: {
      "den-rozhdeniya": {
        opening: "В день рождения положено ждать чудес. {ГЕРОЙ.им} ждал{Р:|а} их до обеда, а потом решил{Р:|а}, что чудеса — это для малышей.",
        closing: "Вечером, когда задули свечи, брелок мигнул ещё раз: «Новый уровень разблокирован. Награда: плюс год опыта. С днём рождения, {ЛАСКОВО.им}!»",
        openingScene: "a birthday cake waiting on the kitchen table in the background",
        closingScene: "a birthday cake with blown-out candles, the pixel cat keychain glowing beside it",
      },
      "novyj-god": {
        opening: "Тридцать первое декабря, до курантов — целый день, а ёлочные игрушки, как назло, лежат в коробках на антресолях.",
        closing: "В полночь, под бой курантов, брелок мигнул: «Сохранение создано. Новый год — новая игра. С праздником, {ЛАСКОВО.им}!»",
        openingScene: "a half-decorated New Year fir tree and boxes of ornaments in the room",
        closingScene: "a decorated New Year fir tree with warm lights, the pixel cat keychain hanging on a branch",
      },
      default: {
        opening: "Это случилось как раз перед важным днём — {ПОВОД}. Никто не ждал от него приключений. Особенно сам{Р:|а} {Р:герой|героиня}.",
        closing: "«Достижение получено: {ПОВОД}, — мигнул брелок. — Редкое. Поздравляем, {ЛАСКОВО.им}!»",
      },
    },
  },

  // ───────────────────────────── 11–15 · Детектив ─────────────────────────────
  {
    slug: "tajna-nochnogo-muzeya",
    audience: "TEEN",
    segments: ["teens-11-13", "teens-14-17"],
    title: "[Имя] и тайна ночного музея",
    tagline: "Каждое утро экспонаты городского музея стоят не там, где их оставили.",
    description:
      "В краеведческом музее творится странное: по ночам кто-то переставляет экспонаты. Ваш подросток вместе с напарником берётся за расследование — с блокнотом, уликами, ложным следом и разгадкой, которой не ожидал никто. Честный детектив: все улики на виду, и читатель может разгадать тайну раньше героя.",
    ageMin: 11,
    ageMax: 15,
    occasions: ["den-rozhdeniya", "novyj-god", "23-fevralya", "8-marta", "bez"],
    textStyle: "detective",
    artStyles: ["graphic-novel", "risograph-zine", "painterly-fantasy"],
    theme: "museum",
    heroKind: "teen",
    extras: {
      roles: ["friend", "sibling"],
      min: 1,
      max: 2,
      note: "Напарник по расследованию (первый доп. герой) — друг, брат или сестра; обязательно. Второй может появиться среди свидетелей.",
    },
    interests: ["детективы", "история", "головоломки", "техника"],
    coverScene:
      "a teen with a flashlight and a notebook and a friend peeking from behind a museum display case at night, long shadows, a soft blue glow under a distant storeroom door, cinematic mystery mood",
    spreads: [
      {
        text: "Директор краеведческого музея говорил шёпотом, хотя в зале никого не было:\n— Третье утро подряд. Самовар стоит у окна. Чучело совы — на лестнице. А зуб мамонта уехал в зал космонавтики.\n{ГЕРОЙ.им} и {ДОП1.им} переглянулись. Обычная экскурсия только что превратилась в дело.\n{ГЕРОЙ.им} достал{Р:|а} блокнот и вывел{Р:|а} на первой странице: «Дело № 1. Кто двигает экспонаты?»",
        scene: "a worried museum director whispering to the teen and a friend in a hall of a local history museum, a brass samovar standing oddly by the window, the teen opening a notebook",
      },
      {
        text: "Место происшествия выглядело невинно: витрины целы, замки целы, сигнализация молчала всю ночь. Но {ГЕРОЙ.им} присел{Р:|а} у самовара и посветил{Р:|а} фонариком вдоль пола.\nВ пыли тянулись две тонкие параллельные полоски — будто кто-то проехал на очень маленьких колёсиках. Полоски вели от самовара к двери в конце зала.\n«Улика № 1: следы колёс, ширина — четыре сантиметра, — записал{Р:|а} сыщик. — Ходить экспонаты не умеют. Ездить, видимо, тоже не должны».",
        scene: "the teen crouching by a samovar with a flashlight, two thin parallel wheel tracks visible in the dust on a museum floor leading toward a door at the end of the hall",
      },
      {
        text: "Свидетелей опрашивали вдвоём: {ДОП1.им} задавал{Р1:|а} вопросы, {ГЕРОЙ.им} записывал{Р:|а}.\nУборщица сказала, что по утрам в зале пахнет машинным маслом — «как в гараже у моего деда».\nДиректор вспомнил: всё началось ровно месяц назад, сразу после того как на крыше поставили солнечные панели.\nЭкскурсовод ничего не помнила, зато угостила всех сушками.\n«Улика № 2: запах масла. Вопрос: при чём тут крыша?» — записал{Р:|а} сыщик и взял{Р:|а} ещё сушку. Для мозга.",
        scene: "the teen taking notes while a friend interviews a museum cleaner holding a mop, the director and a smiling tour guide offering a plate of bagels in the background",
      },
      {
        text: "Подозреваемый нашёлся быстро — даже слишком. Новый ночной сторож приезжал на смену на велосипеде, а в его каморке стояла маслёнка. Колёса, масло, ночь — всё сходится.\n— Зовём директора? — шёпотом спросил{Р1:|а} {ДОП1.им}.\n— Сначала проверяем, — ответил{Р:|а} {ГЕРОЙ.им}. — Сыщик без проверки — это просто человек с подозрениями.\nВелосипед стоял у входа. {ГЕРОЙ.им} достал{Р:|а} рулетку.",
        scene: "the teen measuring the tire of a bicycle parked at the museum entrance with a tape measure, a friend watching, a small oil can visible through the open door of the guard's room",
      },
      {
        text: "Шина велосипеда оказалась шириной пять сантиметров, а не четыре. К тому же весь последний месяц сторож дежурил в соседнем здании, в архиве, а маслёнка нужна была ему для скрипучей двери, а не для тайных дел.\n{ГЕРОЙ.им} покраснел{Р:|а} и честно извинил{Р:ся|ась}. Сторож рассмеялся и выдал сыщикам по ириске:\n— Первый раз меня подозревают. Даже приятно.\n«Ложный след, — записал{Р:|а} {ГЕРОЙ.им}. — Вывод: проверять до, а не после».",
        scene: "a friendly night guard laughing and handing out toffees to the embarrassed teen and a friend, a bicycle and a squeaky door in the background",
      },
      {
        text: "Третья улика ждала в архиве. Пока {ДОП1.им} листал{Р1:|а} старые журналы посещений, {ГЕРОЙ.им} наткнул{Р:ся|ась} на пожелтевший буклет 1985 года: «Выставка „Город будущего“». На последней странице — план залов.\nСамовар у окна. Сова на лестнице. Зуб мамонта — в зале космонавтики. Точь-в-точь как этим утром.\n— Кто-то расставляет музей так, как он стоял сорок лет назад, — медленно сказал{Р:|а} {ГЕРОЙ.им}. — Кто-то с очень хорошей памятью.",
        scene: "the teen and a friend in a dusty archive room, the teen holding an old yellowed brochure open to a floor plan, stacks of old journals all around",
      },
      {
        text: "Эксперимент провели в тот же день. С разрешения директора {ДОП1.им} насыпал{Р1:|а} у дверей зала тонкую дорожку муки: если кто-то проедет, следы останутся. А {ГЕРОЙ.им} {Р:пошёл|пошла} по колёсным полоскам до конца.\nОни обрывались у двери с надписью «Хранилище № 3». Под дверью была щель — ровно такая, чтобы проехало что-то невысокое. А на двери висел список: «Макеты и экспонаты выставки „Город будущего“, 1985».\n— Все дороги ведут сюда, — сказал{Р:|а} {ГЕРОЙ.им}.",
        scene: "a friend sprinkling a thin line of flour on the museum floor, the teen kneeling to inspect a gap under an old storeroom door, wheel tracks ending at the threshold",
      },
      {
        text: "В семь вечера музей закрылся, свет в залах погас. В засаде сидели четверо: {ГЕРОЙ.им}, {ДОП1.им}, директор и сторож с термосом чая. Сидели за витриной с минералами, в полной безопасности и почти в полной тишине — сторож шуршал фантиками.\nРовно в 19:05 за дверью хранилища что-то щёлкнуло и зажужжало, а в щели под дверью зажёгся мягкий голубой свет. Директор крепко вцепился в термос.",
        scene: "the teen, a friend, the museum director and the night guard hiding safely behind a mineral display case in a dim museum hall in the evening, a soft blue light glowing under a storeroom door",
      },
      {
        text: "— Подождите, — прошептал{Р:|а} {ГЕРОЙ.им}. — Соберём всё вместе. Следы маленьких колёс. Запах машинного масла. Всё началось, когда на крыше поставили солнечные панели, — значит, у кого-то появилось электричество. Экспонаты расставляют по плану 1985 года. И это «что-то» включается, когда гаснет свет, сразу после закрытия.\n{Р:Он|Она} посмотрел{Р:|а} на дверь хранилища.\n— Это не вор. Это экспонат. И он просто делает свою работу.",
        scene: "the teen whispering and counting clues on fingers, the friend and the two adults listening intently in the dim hall, blue light spilling under the storeroom door",
      },
      {
        text: "Дверь приоткрылась, и в зал выкатился робот — круглый, серебристый, с лампочкой вместо носа и табличкой на груди: «Гид-85». Он вежливо объехал витрину, взял сову и бережно повёз её к лестнице.\n— Готовлю экспозицию, — проскрипел он. — Открытие выставки «Город будущего» — завтра в десять.\nРобот-экскурсовод сорок лет простоял в хранилище. А месяц назад новые провода с крыши прошли прямо через его розетку — и он проснулся. И продолжил с того места, где остановился.",
        scene: "a round silver retro robot with a light bulb nose rolling out of a storeroom, carefully carrying a stuffed owl, the teen and a friend watching in delight",
      },
      {
        text: "Никого не наказали — даже провода. Директор сказал, что такого экскурсовода у музея не было никогда. Робота смазали, обновили ему программу и поставили у входа. Теперь «Гид-85» днём водит экскурсии и рассказывает, каким в 1985 году представляли будущее. Посетители смеются, а робот гордится.\nСамовар вернулся на своё место, сова — на шкаф. А зуб мамонта робот попросил оставить в зале космонавтики. Говорит, там ему интереснее.",
        scene: "the restored silver robot guide at the museum entrance leading a group of visitors, the teen and a friend laughing nearby, the director beaming",
      },
      {
        text: "Вечером {ГЕРОЙ.им} открыл{Р:|а} блокнот и аккуратно написал{Р:|а}: «Дело № 1 закрыто. Виновник — экспонат. Мотив — ответственность».\n{ДОП1.им} заглянул{Р1:|а} через плечо:\n— А дело № 2 у нас будет?\nИ тут телефон звякнул. Писал директор: «Срочно. Робот говорит, что в 1985 году у нас был планетарий. И что он знает, где от него ключ».\nСыщик перевернул{Р:|а} страницу.",
        scene: "the teen at a desk by a window in the evening writing in a notebook, a friend peeking over the shoulder, a phone lighting up on the desk",
      },
    ],
    occasionHooks: {
      "den-rozhdeniya": {
        opening: "На свой день рождения {ГЕРОЙ.им} выбрал{Р:|а} не кафе, а экскурсию в музей. Друзья удивились. Через час удивляться пришлось всем.",
        closing: "А вечером на торте рядом со свечами стояла маленькая сахарная сова — подарок от музея и от «Гида-85». С днём рождения, {ЛАСКОВО.им}! Новое дело уже ждёт.",
        openingScene: "a small birthday badge pinned to the teen's jacket",
        closingScene: "a birthday cake with candles and a tiny sugar owl on top, the notebook beside it",
      },
      "novyj-god": {
        opening: "За неделю до Нового года, когда в музее уже нарядили ёлку, кто-то начал по ночам переставлять экспонаты.",
        closing: "В новогоднюю ночь «Гид-85» впервые за сорок лет встречал праздник не в хранилище, а у ёлки. С Новым годом, {ЛАСКОВО.им}! В новом году дел будет ещё больше.",
        openingScene: "a decorated New Year fir tree in the museum hall",
        closingScene: "the silver robot standing proudly next to a decorated New Year tree in the museum lobby",
      },
      default: {
        opening: "Это дело случилось как раз накануне важного дня — {ПОВОД}.",
        closing: "Внизу страницы сыщик приписал{Р:|а}: «{ПОВОД} — отметить. Это не улика, это приказ». Поздравляем, {ЛАСКОВО.им}!",
      },
    },
  },

  // ───────────────────────────── 11–13 · Научная фантастика ─────────────────────────────
  {
    slug: "stazher-orbity",
    audience: "TEEN",
    segments: ["teens-11-13"],
    title: "[Имя] — стажёр орбитальной станции",
    tagline: "Главный компьютер станции ушёл в перезагрузку, и спасать миссию придётся самому юному члену экипажа.",
    description:
      "Ваш подросток — единственный стажёр орбитальной станции «Заря-7». В первую же смену главный компьютер уходит в перезагрузку, а где-то рядом пищит потерянный спутник. Навигация по звёздам, водяные шарики в невесомости, тонкая работа манипулятором и находка, которая связывает два поколения мечтателей. Настоящая физика простыми словами и робот-напарник с чувством юмора.",
    ageMin: 11,
    ageMax: 13,
    occasions: ["den-rozhdeniya", "novyj-god", "23-fevralya", "bez"],
    textStyle: "sci-fi",
    artStyles: ["graphic-novel", "painterly-fantasy", "risograph-zine"],
    theme: "orbit",
    heroKind: "teen",
    extras: {
      roles: ["friend", "sibling", "mom", "dad"],
      min: 0,
      max: 2,
      note: "Друг, брат или сестра — члены экипажа; мама или папа — голос из центра управления полётами.",
    },
    interests: ["космос", "физика", "техника", "роботы"],
    coverScene:
      "a teen in a sleek flight suit floating by a large round porthole of an orbital station, the blue curve of Earth below, a suitcase-sized helper robot with six arms beside, cinematic lighting",
    spreads: [
      {
        text: "В 2051 году на орбиту летают так же буднично, как раньше ездили в летний лагерь. Но стажёров на станцию «Заря-7» всё равно берут по одному в год — и в этом году взяли {ГЕРОЙ.вин}.\nПервое утро в невесомости: зубная паста уплывает, носки летают по каюте, а сам{Р:|а} {ГЕРОЙ.им} висит вверх ногами и делает вид, что так и задумано.\n«Станция всё время падает, — вспомнил{Р:|а} {Р:он|она} лекцию. — Просто летит вбок так быстро, что промахивается мимо Земли».",
        scene: "a teen floating upside down in a small cabin of an orbital station, socks and a toothpaste tube drifting around, Earth visible in a round porthole",
      },
      {
        text: "— Задание на смену, стажёр, — сказала командир станции. — Неделю назад с радаров пропал маленький спутник. Найти, понять, что с ним, доложить. Работаешь с Шурупом.\nШуруп — бортовой робот размером с чемодан — помахал всеми шестью манипуляторами.\n— Я заменяю справочник, калькулятор и чувство юмора экипажа, — представился он. — Последнее — по совместительству.\n{ГЕРОЙ.им} кивнул{Р:|а} с серьёзным видом. Кивать в невесомости оказалось непросто: кивок тянул за собой всё тело.",
        scene: "the station commander handing a tablet to the teen in the command module, a suitcase-sized robot with six manipulator arms waving cheerfully",
      },
      {
        text: "На посту наблюдения {ГЕРОЙ.им} насчитал{Р:|а} уже третий рассвет за смену.\n— Солнце что, сломалось?\n— Мы облетаем Землю за полтора часа, — отозвался Шуруп. — Шестнадцать рассветов в сутки. Тут даже утро торопится.\nИ вдруг экраны мигнули и погасли. По станции прокатился спокойный голос: «Главный компьютер уходит на перезагрузку. Расчётное время — шесть часов».\n— Шесть часов без навигации, — сказал Шуруп. — А спутник ждать не будет.",
        scene: "the teen at an observation window watching a sunrise over the curved Earth horizon, screens around suddenly going dark, the robot looking alarmed",
      },
      {
        text: "Без компьютера станция не знала, куда смотрит. Зато у {ГЕРОЙ.род} были глаза, бумажная звёздная карта из аварийного шкафа и старый добрый транспортир.\n— Моряки находили дорогу по звёздам сотни лет, — сказал{Р:|а} {ГЕРОЙ.им}. — Чем мы хуже?\nТри яркие звезды в иллюминаторе, три угла, одна схема на коленке. Шуруп проверил расчёт и уважительно щёлкнул манипулятором: ошибка — меньше градуса.\nСтанция знала, куда смотрит. Осталось понять, куда смотреть.",
        scene: "the teen floating by a porthole full of stars measuring angles with a protractor against a paper star chart, the robot leaning over the calculations",
      },
      {
        text: "В наушниках зашуршало. Сквозь помехи пробивался писк: короткий, короткий, длинный… Шуруп выдвинул версию «инопланетяне» и сам же её отклонил как ненаучную.\n— Это азбука Морзе! — {ГЕРОЙ.им} схватил{Р:|а} карандаш. — Точка, точка, тире…\nНа бумаге сложилось: «ПРИВЕТ ОРБИТА МЫ ИЗ 7Б».\n— Не инопланетяне, — сказал{Р:|а} {ГЕРОЙ.им}. — Семиклассники.\n— По моим данным, это почти одно и то же, — заметил Шуруп.",
        scene: "the teen wearing headphones writing dots and dashes on paper with a pencil, the robot scratching its head with a manipulator",
      },
      {
        text: "Спутник оказался школьным: десять лет назад его собрали ученики одной самой обычной школы и отправили на орбиту попутным грузом. Он должен был проработать год, а проработал десять — и всё это время передавал одно и то же приветствие.\n— Радиосигнал летит со скоростью света, — сказал Шуруп. — Мы слышим его почти мгновенно. А вот добраться до него — сорок минут манёвров.\n— Значит, манёвры, — ответил{Р:|а} {ГЕРОЙ.им}. И тут где-то в отсеке тихо зажурчало.",
        scene: "a tiny cube-shaped satellite with small solar panels drifting against the black sky, seen through the porthole, the teen pointing at it excitedly",
      },
      {
        text: "Журчала вода. Из треснувшего шланга системы охлаждения выплывали дрожащие шарики: в невесомости вода не течёт вниз, а собирается в капли-мячики и плывёт куда хочет.\n— Если они доберутся до приборов, будет замыкание, — сказал Шуруп, не меняя голоса. О плохом он всегда говорил спокойно.\n{ГЕРОЙ.им} {Р:огляделся|огляделась}. В аварийном шкафу — полотенца, скотч и пустые пакеты для еды. Маловато для подвига. Но достаточно для идеи.",
        scene: "trembling spheres of water floating out of a cracked hose in a station module, the teen looking around at an open emergency locker with towels and tape",
      },
      {
        text: "Капли не падают — значит, их не надо вытирать. Их надо ловить. {ГЕРОЙ.им} натянул{Р:|а} пакет на шланг воздушного фильтра, и шарики один за другим нырнули внутрь, как рыбки в сачок. Трещину замотали скотчем в три слоя.\n— Поверхностное натяжение, — одобрил Шуруп. — Молекулы воды цепляются друг за друга, поэтому капля держит форму шара. Ты только что применил{Р:|а} физику вместо тряпки.\n— Записать в отчёт?\n— Записать в легенды станции.",
        scene: "the teen catching floating water spheres into a bag attached to an air-filter hose, the robot holding a roll of tape around the cracked pipe",
      },
      {
        text: "До спутника оставались метры. Манипулятор полагалось вести через компьютер, а компьютер всё ещё спал. Значит — вручную, с пульта, по миллиметру.\n— Здесь нельзя «чуть-чуть толкнуть», — предупредил Шуруп. — В космосе нет трения: что толкнул, то улетело.\n{ГЕРОЙ.им} дышал{Р:|а} медленно, как перед прыжком в воду. Рука станции раскрылась, коснулась спутника — и мягко сомкнулась.\n— Захват, — сказал{Р:|а} {Р:он|она} и только тогда заметил{Р:|а}, что не дышит.",
        scene: "the teen at a control panel gently steering the station's robotic arm, outside the window the arm closing around the small cube satellite with Earth below",
      },
      {
        text: "Внутри спутника нашлась карта памяти. На ней — голоса тех самых семиклассников: «Если нас кто-то нашёл — привет из прошлого! Мы мечтаем стать инженерами, врачами, космонавтами. Расскажи, получилось ли».\nТут ожил главный компьютер. Первым делом он спросил: «Пока меня не было, что-нибудь произошло?»\nКомандир прочитала отчёт стажёра и долго молчала.\n— За шесть часов ты сделал{Р:|а} работу всей смены, — сказала она наконец. — И, кажется, {Р:нашёл|нашла} кое-что поважнее спутника.",
        scene: "the teen holding a small memory card next to the opened cube satellite, the commander reading a report on a tablet with a proud smile, screens glowing back on",
      },
      {
        text: "Спутнику поменяли батарею и отправили обратно — с новым сообщением. Его записал{Р:|а} {ГЕРОЙ.им}: «Привет, бывший 7Б. Вас нашли». А через час из центра управления пришёл ответ. Дежурный инженер, принимавший отчёт, когда-то учился в том самом 7Б.\nВнизу проплывала Земля. Её атмосфера с орбиты — тонкая голубая каёмка, тоньше кожуры на яблоке. Шестнадцатый рассвет за сутки {ГЕРОЙ.им} встречал{Р:|а} уже не новичком.",
        scene: "the robotic arm releasing the repaired cube satellite back into orbit, the teen watching from the porthole, a thin glowing blue line of atmosphere along Earth's curve",
      },
      {
        text: "Вечером Шуруп торжественно выдал справку: «Навыки стажёра: навигация по звёздам, ловля воды, спокойствие при перезагрузках».\n{ГЕРОЙ.им} смотрел{Р:|а} на ночную Землю в огоньках городов и думал{Р:|а}: когда-нибудь и {Р:его|её} голос найдут через десять лет. И к тому времени хорошо бы успеть сделать что-нибудь, о чём не стыдно рассказать.\n— Мечтаешь? — спросил Шуруп.\n— Планирую, — ответил{Р:|а} {ГЕРОЙ.им}.",
        scene: "the teen floating peacefully by a large porthole looking at Earth at night covered with city lights, the robot beside holding a printed certificate",
      },
    ],
    occasionHooks: {
      "den-rozhdeniya": {
        opening: "Свой день рождения {ГЕРОЙ.им} впервые встречал{Р:|а} на орбите — шестнадцать раз подряд, по числу рассветов.",
        closing: "А вечером экипаж собрался у иллюминатора: торт в невесомости — это когда свечи заменяют фонариками, а крошки ловят пылесосом. С днём рождения, {ЛАСКОВО.им}! Земля передаёт привет.",
        openingScene: "a small birthday cupcake floating in the cabin",
        closingScene: "the crew gathered around a floating birthday cake with tiny lights instead of candles",
      },
      "novyj-god": {
        opening: "Новый год на орбите наступает много раз — над каждым часовым поясом заново. Экипаж «Зари-7» решил праздновать каждый.",
        closing: "В полночь по московскому времени экипаж поднял пакетики с соком — с трубочками, чтобы не уплыл. Внизу, над городами, вспыхивали крошечные салюты. С Новым годом, {ЛАСКОВО.им}!",
        openingScene: "a tiny New Year fir tree strapped to the cabin wall with floating ornaments",
        closingScene: "the crew celebrating New Year by the porthole with juice pouches, tiny fireworks visible over cities below",
      },
      default: {
        opening: "Эта смена выпала как раз на особенный день — {ПОВОД}. На орбите он тоже считается.",
        closing: "А с Земли пришла радиограмма: «Поздравляем стажёра — {ПОВОД}! Центр управления гордится». И мы тоже, {ЛАСКОВО.им}.",
      },
    },
  },

  // ───────────────────────────── 14–17 · Комикс ─────────────────────────────
  {
    slug: "nochnoj-koncert",
    audience: "TEEN",
    segments: ["teens-14-17"],
    title: "[Имя] и концерт, который всё-таки случился",
    tagline: "Три часа до школьного концерта: зал закрыт, ведущего нет, барабанщик без палочек. Вызов принят.",
    description:
      "Комикс о том, как ваш старшеклассник спасает главный школьный концерт года. Лопнувшая батарея, переезд в спортзал живой цепочкой, барабанные палочки из линеек, прожектор, который светит только красным, и внезапная темнота посреди песни. Суперсилы — не паниковать, превращать поломки в идеи и звать с собой других. Сквозной герой — старый школьный микрофон, который фонит в самый неподходящий момент.",
    ageMin: 14,
    ageMax: 17,
    occasions: ["vypusknoj-v-shkole", "den-rozhdeniya", "novyj-god", "23-fevralya", "8-marta"],
    textStyle: "comic-captions",
    artStyles: ["graphic-novel", "risograph-zine", "retro-poster"],
    theme: "stage",
    heroKind: "teen",
    extras: {
      roles: ["friend", "sibling", "mom", "dad"],
      min: 0,
      max: 3,
      note: "Друзья — команда концерта (барабанщик, осветитель, ведущий); брат, сестра или родители — в первом ряду.",
    },
    interests: ["музыка", "сцена", "организация", "техника"],
    coverScene:
      "dynamic low-angle comic-style shot of a teen on a school stage in a red spotlight, an old microphone in hand, a crowd raising hundreds of phone flashlights like stars, halftone shadows",
    spreads: [
      {
        text: "[Это {ГЕРОЙ.им}. Днём — {Р:обычный старшеклассник|обычная старшеклассница}.]\n[Вечером — человек, на котором держится главный школьный концерт года.]\n{ГЕРОЙ.им}: — Звук, свет, порядок номеров. Ничего сложного.\nВЖЖЖЖ!\n(Старый школьный микрофон думает: а вот и я.)",
        scene: "dynamic low-angle shot of the teen standing on a school assembly stage with a clipboard and a headset around the neck, an old microphone on a stand squealing with feedback",
      },
      {
        text: "[Пятница. До концерта — три часа.]\nЗавуч: — Звукорежиссёр стоит в пробке. Ведущий уехал на олимпиаду. Барабанщик забыл палочки.\n{ГЕРОЙ.им}: — Это всё?\nПШШШШ!\n[В актовом зале лопается батарея. Зал закрыт. Теперь — всё.]",
        scene: "the teen and a stressed deputy principal in a school corridor, steam bursting from a radiator through the open doors of the assembly hall behind them",
      },
      {
        text: "[Эпизод 1. Миссия «Переезд».]\n{ГЕРОЙ.им}: — Переезжаем в спортзал. Нужны двадцать человек и все стулья школы.\n[Через минуту в чате класса — сорок сообщений. Через десять — живая цепочка из рук через три коридора.]\n(Стулья думают: мы тоже хотим на концерт.)\nВЖЖЖ! [Микрофон несли отдельно. С почестями.]",
        scene: "a human chain of teenagers passing chairs hand to hand down a long school corridor into a gym, the teen directing from the doorway, someone carrying the old microphone like a trophy",
      },
      {
        text: "[Эпизод 2. Миссия «Ритм».]\nБарабанщик: — Без палочек я просто человек рядом с барабаном.\n{ГЕРОЙ.им}: — Кабинет математики. Две деревянные линейки. Бегом!\n[Учительница выдаёт линейки под честное слово. Линейкам сорок лет. Они дубовые.]\nТУК-ТУК-ТРРРАМ!\nБарабанщик: — Это… лучше моих палочек.",
        scene: "a drummer in a school gym enthusiastically playing a drum kit with two old wooden rulers, the teen giving a thumbs up, a math teacher watching from the door",
      },
      {
        text: "[Эпизод 3. Миссия «Голос».]\n[Ведущего нет. Желающих тоже нет.]\n{ГЕРОЙ.им}: — Тогда веду я.\n({ГЕРОЙ.им} думает: я? Перед всей школой? Отличная идея. Наверное.)\nВЖЖЖ!\n[Даже микрофон в шоке.]",
        scene: "the teen alone backstage in front of a mirror rehearsing with the old microphone, nervous but determined, a crumpled script in hand",
      },
      {
        text: "[Эпизод 4. Миссия «Свет».]\n[Прожектор горит. Но только красным.]\nОсветитель-семиклассник: — Он так с прошлого года. Остальные цвета сломаны.\n{ГЕРОЙ.им}: — Значит, у нас концерт в стиле «закат». Это не поломка, это концепция.\n[Суперсила № 2: превращать поломки в идеи.]",
        scene: "a young lighting assistant and the teen on a ladder adjusting a stage spotlight that glows only red, the whole gym bathed in sunset-red light",
      },
      {
        text: "[18:58. Зал полон. Родители, учителя, вся параллель.]\nЗвукорежиссёр (по телефону): — Я всё ещё в пробке! Держитесь!\n{ГЕРОЙ.им}: — Держимся.\n(Микрофон думает: сейчас будет моё соло.)\nВЖЖЖЖЖ!\n[В зале смеются. Не по сценарию.]",
        scene: "a packed school gym seen from the wings, parents and teachers in rows, the teen holding a phone to the ear backstage, the old microphone waiting on its stand",
      },
      {
        text: "{ГЕРОЙ.им}: — Добрый вечер! Это наш главный концерт года, и техника решила выступить первой.\n[Смех. Аплодисменты. Кто-то во втором ряду улыбается особенно широко.]\n({ГЕРОЙ.им} думает: не отвлекаться. Совершенно не отвлекаться.)\nВЖЖ… [Микрофон стыдливо замолкает.]",
        scene: "the teen on stage in a red sunset spotlight addressing the audience with a confident grin, the audience laughing and clapping",
      },
      {
        text: "[Третий номер. Группа старшеклассников. Линейки в деле.]\nТУК-ТРРРАМ!\nЩЁЛК.\n[Свет гаснет во всей школе. Тишина. Двести человек в темноте.]\n{ГЕРОЙ.им}: — Никто не расходится.",
        scene: "a school gym plunged into darkness mid-concert, a band frozen on stage, the teen's silhouette stepping forward to the edge of the stage",
      },
      {
        text: "{ГЕРОЙ.им}: — Включите фонарики. Все. Поднимите вверх.\n[Двести огоньков. Спортзал становится звёздным небом.]\n{ГЕРОЙ.им}: — А теперь без микрофона. Подпевайте!\n[Зал поёт. Акустика спортзала, оказывается, идеальна.]\n(Микрофон думает: ну и ладно. Ну и пожалуйста.)",
        scene: "a dark gym filled with hundreds of raised phone flashlights like a starry sky, the teen at the center of the stage singing along with the band and the whole audience",
      },
      {
        text: "[Свет вернулся ровно на последнем аккорде.]\nЗвукорежиссёр (вбегая с проводами): — Я успел?!\nВсе: — Нет!\n[Команда обнимается на сцене: барабанщик, осветитель, завуч и сорок человек со стульями.]\n{ГЕРОЙ.им}: — Лучший провал в истории школы.",
        scene: "the whole team hugging and cheering on stage as the lights come back on, a breathless sound engineer running in with cables, confetti in the air",
      },
      {
        text: "[Говорят, супергерой — это тот, у кого есть суперсила.]\n[Мы знаем точно: твоя суперсила — не бояться, когда страшно, и звать с собой других.]\n[Мы гордимся тобой. И всегда будем в первом ряду.]\nВЖЖЖ!\n(Микрофон думает: я тоже горжусь.)",
        scene: "the teen alone on the empty stage after the concert, holding the old microphone, warm light, chairs scattered, a peaceful proud smile",
      },
    ],
    occasionHooks: {
      "vypusknoj-v-shkole": {
        opening: "[Июнь. Выпускной. Последний школьный концерт — и последний шанс, что всё пойдёт не по плану.]",
        closing: "[С выпуском, {ЛАСКОВО.им}! Дальше — большая сцена.]",
        openingScene: "graduation ribbons hanging over the stage",
        closingScene: "graduation ribbons and balloons on the empty stage at night",
      },
      "den-rozhdeniya": {
        opening: "[Кстати, сегодня у {ГЕРОЙ.род} день рождения. Но об этом — потом.]",
        closing: "[И ещё: с днём рождения, {ЛАСКОВО.им}! Зал поёт второй раз. Догадайся, что.]",
        openingScene: "a small birthday balloon tied to the teen's clipboard",
        closingScene: "the team bringing a birthday cake with candles onto the stage",
      },
      "novyj-god": {
        opening: "[Декабрь. Новогодний концерт. Ёлка уже стоит, гирлянды уже мигают. Пока что.]",
        closing: "[С Новым годом, {ЛАСКОВО.им}! Пусть в новом году всё ломается только к лучшему.]",
        openingScene: "a decorated New Year fir tree with garlands next to the stage",
        closingScene: "a New Year fir tree glowing on the stage, snow outside the gym windows",
      },
      default: {
        opening: "[Повод особенный: {ПОВОД}. И концерт тоже.]",
        closing: "[Поздравляем, {ЛАСКОВО.им}: {ПОВОД}! Стоя. С фонариками.]",
      },
    },
  },

  // ───────────────────────────── 14–17 · Фэнтези-квест ─────────────────────────────
  {
    slug: "pereval-vybora",
    audience: "TEEN",
    segments: ["teens-14-17"],
    title: "[Имя] и Перевал Выбора",
    tagline: "Карта, нарисованная от руки, ведёт через горы к вопросу «И что дальше?».",
    description:
      "Вопрос «Кем ты будешь?» задают все — от родных до случайных попутчиков. Однажды вашему старшекласснику приходит карта без обратного адреса: Перевал Выбора. Ущелье чужих советов, мост, который кричит «последний шанс!», ярмарка талантов, туманный гребень и Страж Перевала, сплетённый из чужих ожиданий. Квест с иронией о том, что дорогу видно, только когда идёшь, и что твоё любимое дело — уже талант.",
    ageMin: 14,
    ageMax: 17,
    occasions: ["vypusknoj-v-shkole", "den-rozhdeniya", "novyj-god", "bez"],
    coreOccasions: ["vypusknoj-v-shkole"],
    textStyle: "quest-fantasy-humor",
    artStyles: ["painterly-fantasy", "graphic-novel", "retro-poster"],
    theme: "mountains",
    heroKind: "teen",
    extras: {
      roles: ["friend", "pet", "sibling"],
      min: 0,
      max: 2,
      note: "Друг может пройти тропу вместе с героем; питомец — заменить ворона-картографа; брат или сестра — встретиться на ярмарке талантов.",
    },
    interests: ["походы", "путешествия", "выбор профессии", "рисование", "музыка"],
    coverScene:
      "a teen standing on a sunlit mountain ridge above a sea of clouds holding an unfolded hand-drawn map, a raven in tiny spectacles on the shoulder, a distant glowing gate at the summit, epic painterly light",
    spreads: [
      {
        text: "Лето только началось, а вопрос «И что дальше?» уже ходил за {ГЕРОЙ.тв} по пятам. Вопрос был большой, неудобный и, кажется, заразный: его задавали все родственники.\nВ почтовом ящике лежал свёрток без марки. Внутри — карта, нарисованная от руки: горы, тропа, крестик на вершине. И подпись: «Перевал Выбора. Для тех, кто пока не знает. Это нормально».\n«Отлично, — подумал{Р:|а} {ГЕРОЙ.им}. — Даже карта меня успокаивает».",
        scene: "a teen at a home mailbox unwrapping a hand-drawn map of mountains with a dotted trail and a cross on the summit, early summer evening light",
      },
      {
        text: "Карта развернулась сама — и вместе с ней развернулся мир. {ГЕРОЙ.им} стоял{Р:|а} у подножия гор, а на камне сидел ворон в крошечных очках.\n— Масштаб, картограф, — представился он. — Правила: четыре участка тропы, на вершине — Страж Перевала. Карта показывает дорогу, только если идёшь своими ногами. Чужими не показывает, проверено.\nНад тропой зажглось: «Уровень 1. Ущелье Советов».\n— Звучит безобидно, — сказал{Р:|а} {ГЕРОЙ.им}.\nВорон поправил очки и промолчал. Очень выразительно.",
        scene: "the teen at the foot of dramatic mountains at golden hour, a raven wearing tiny spectacles perched on a boulder, a winding trail leading up",
      },
      {
        text: "Ущелье было узким, а эхо в нём — очень разговорчивым. Стоило сделать шаг, как со всех сторон загремело: «Иди в экономисты — надёжно!», «Только не в экономисты!», «Главное — английский!», «Вот в наше время…».\nЭхо говорило голосами дальних родственников, соседей и одного очень уверенного таксиста. Советы сталкивались в воздухе и падали камнями на тропу.\n«Прекрасно, — подумал{Р:|а} {ГЕРОЙ.им}. — Меня сейчас завалит чужими мнениями. Буквально».",
        scene: "the teen in a narrow canyon as boulders tumble down from the echoing walls and block the path, the raven covering its ears with its wings",
      },
      {
        text: "Перекричать эхо было невозможно. Тогда {ГЕРОЙ.им} сделал{Р:|а} то, чего эхо не умело: задал{Р:|а} вопрос.\n— А чего хочу я?\nУщелье озадаченно замолчало. Эхо умеет повторять, но не умеет отвечать за других. Камни-советы рассыпались в песок, и тропа очистилась.\n«Уровень пройден. Получено: Право на свой вопрос. Не отбирается, даже если очень хочется».\n— Неплохо, — признал Масштаб. — Обычно здесь застревают лет на пять.",
        scene: "the teen standing calmly in the canyon as the boulders crumble into sand, the trail clearing ahead, the raven looking impressed",
      },
      {
        text: "«Уровень 2. Мост Последнего Шанса». Мост был ветхий, раскачивался на ветру и вопил на всё ущелье: «Скорее! Сейчас или никогда! Больше мостов не будет!» Перед ним толпились путники, толкались и нервно поглядывали на часы.\nУ {ГЕРОЙ.род} задрожали коленки. Все торопятся — значит, и {Р:ему|ей} надо?\nНо тут {Р:он|она} вспомнил{Р:|а} про карту. Карта, в отличие от моста, не кричала. Она просто лежала в кармане.",
        scene: "a rickety rope bridge swaying over a deep gorge, a crowd of anxious travelers pushing to cross, the teen pausing to pull a map from a pocket",
      },
      {
        text: "На карте через ущелье вели ещё семь мостов. Один — каменный, крепкий, в получасе ходьбы. Другой — подвесной, с видом на водопад. Третий выглядел как радуга, но, может, это было пятно от чая.\n— Мост преувеличивает, — сказал{Р:|а} {ГЕРОЙ.им} толпе. — Шансов больше, чем кажется. Кто со мной?\nПоловина путников пошла следом. Мост Последнего Шанса обиженно скрипнул и замолчал.\n«Навык: Спокойная проверка фактов. Защищает от паники и громких объявлений».",
        scene: "the teen leading a group of relieved travelers along a cliff path toward a sturdy stone bridge near a waterfall, the old rope bridge sulking behind",
      },
      {
        text: "«Уровень 3. Ярмарка Талантов». На горном плато шумел базар. Торговцы продавали таланты в баночках: «Усидчивость, почти новая!», «Чувство юмора, слегка поношенное!», «Музыкальный слух — последний!».\n— А у тебя что? — подмигнул торговец. — Меняю на что угодно.\n{ГЕРОЙ.им} вывернул{Р:|а} карманы. Там нашлись только мелочи: то, что {Р:он|она} любит делать по вечерам, то, о чём может говорить часами, и то, с чем друзья всегда просят помочь.\n— Ерунда, — вздохнул{Р:|а} {ГЕРОЙ.им}.\nТорговец почему-то перестал улыбаться.",
        scene: "a lively mountain plateau bazaar with stalls of glowing jars, a merchant leaning toward the teen who is emptying pockets of small glowing trinkets",
      },
      {
        text: "— Ерунда? — переспросил торговец и поднёс находки к свету. Они засияли ярче всех его баночек. — Это же настоящее. Дело, о котором говоришь часами, и есть талант, просто без этикетки. Отдай мне — и я разбогатею.\n— Не отдам, — сказал{Р:|а} {ГЕРОЙ.им} и {Р:сам удивился|сама удивилась}, как твёрдо это прозвучало.\n«Уровень пройден. Открыто: Знание, что у тебя уже что-то есть».\nМасштаб одобрительно каркнул. Это было его первое карканье за день.",
        scene: "the merchant holding the teen's small trinkets up to the light where they shine brighter than all the jars, the teen firmly taking them back, the raven cawing approvingly",
      },
      {
        text: "«Уровень 4. Туманный Гребень». Здесь тропа терялась в облаке, а карта показывала только три следующих шага. Не больше.\n— А дальше? — возмутил{Р:ся|ась} {ГЕРОЙ.им}.\n— А дальше станет видно, когда сделаешь эти три, — ответил Масштаб. — Так у всех. Даже у тех, кто делает вид, что видит до самой вершины.\n{ГЕРОЙ.им} вздохнул{Р:|а} и шагнул{Р:|а}. Раз, два, три. Карта послушно дорисовала ещё три шага. Потом ещё.",
        scene: "the teen walking along a narrow mountain ridge in thick fog, the glowing map lighting only a few steps ahead, the raven flying close",
      },
      {
        text: "Туман растаял, и {ГЕРОЙ.им} {Р:оказался|оказалась} на гребне над всеми горами. Внизу было видно всё пройденное: ущелье, мосты, ярмарку. Сверху путь не казался страшным. Сверху он казался даже красивым.\n«Навык: Три шага. Работает в тумане, в незнакомом городе и в любой непонятной ситуации», — всплыло сообщение.\n— Знаешь, в чём секрет? — спросил Масштаб. — Никто не видит всю дорогу. Просто некоторые идут.",
        scene: "the teen on a sunlit ridge above a sea of clouds looking back at the whole journey below — canyon, bridges, bazaar — the raven on the teen's shoulder",
      },
      {
        text: "У ворот перевала лежал Страж — огромный дракон, сплетённый из тысяч «надо», «должен» и «а вот у других». Он не рычал, только тяжело вздыхал.\n— Я храню чужие ожидания, — сказал он. — Их столько, что я не могу пошевелиться.\n{ГЕРОЙ.им} подумал{Р:|а} — и начал{Р:|а} разбирать. Вот это — от тех, кто любит: его стоит взять с собой. Это — чья-то старая мечта: её можно вернуть с благодарностью. А это просто чужая тревога, её пора отпустить.\nДракон становился всё легче — и наконец сел {ГЕРОЙ.дат} на плечо, крошечный, как воробей.",
        scene: "a huge sighing dragon woven from heavy tangled ribbons lying at a mountain gate, the teen gently untangling the ribbons, the dragon shrinking to the size of a sparrow",
      },
      {
        text: "Ворота открылись, а за ними была не одна дорога, а целая долина дорог. Карта больше не показывала маршрут. Теперь на ней было написано: «Дальше рисуй {Р:сам|сама}».\n{ГЕРОЙ.им} {Р:очнулся|очнулась} у почтового ящика. Вопрос «И что дальше?» никуда не делся. Но теперь он звучал не страшно, а интересно.\n— Решил{Р:|а}, кем будешь? — спросили вечером родные.\n— Решил{Р:|а}, что буду идти, — ответил{Р:|а} {ГЕРОЙ.им}. А дракончик в кармане одобрительно чихнул.",
        scene: "the gate at the summit opening onto a wide valley of many sunlit paths, the teen holding a blank map, a tiny dragon peeking out of a pocket",
      },
    ],
    occasionHooks: {
      "vypusknoj-v-shkole": {
        opening: "Последний звонок отзвенел, ленты сфотографированы со всех ракурсов, а вопрос «И что дальше?» всё равно никуда не делся.",
        closing: "С выпуском, {ЛАСКОВО.им}! Карта теперь твоя — рисуй смело. А если понадобится ворон в очках, мы рядом.",
        openingScene: "graduation ribbons and a school building in the background",
        closingScene: "the valley of paths at dawn, a graduation ribbon fluttering on the teen's backpack",
      },
      "den-rozhdeniya": {
        opening: "В день рождения положено загадывать желание. {ГЕРОЙ.им} стоял{Р:|а} над тортом и честно не знал{Р:|а}, что загадать: желаний было много, и все немного чужие.",
        closing: "А желание {ГЕРОЙ.им} в тот вечер всё-таки загадал{Р:|а} — своё собственное. С днём рождения, {ЛАСКОВО.им}! Пусть сбудется.",
        openingScene: "a birthday cake with unlit candles on the table in the background",
        closingScene: "a birthday cake with lit candles, the tiny dragon sitting next to it",
      },
      "novyj-god": {
        opening: "Под Новый год все строят планы. Даже кот. Только у {ГЕРОЙ.род} вместо плана был вопрос.",
        closing: "В полночь, под бой курантов, {ГЕРОЙ.им} загадал{Р:|а} не «кем быть», а «куда сделать следующие три шага». С Новым годом, {ЛАСКОВО.им}!",
        openingScene: "a decorated New Year fir tree and snow outside the window",
        closingScene: "a New Year fir tree with warm lights, snowy mountains glowing on the unfolded map",
      },
      default: {
        opening: "Всё случилось накануне важного дня — {ПОВОД}.",
        closing: "А на обороте карты кто-то приписал: «Поздравляем — {ПОВОД}! Дальше — только твоя дорога, {ЛАСКОВО.им}».",
      },
    },
  },

  // ───────────────────────────── 14–17 · Шуточный эпос ─────────────────────────────
  {
    slug: "bylina-o-treh-podvigah",
    audience: "TEEN",
    segments: ["teens-14-17"],
    title: "Былина о [Имя] и трёх подвигах",
    tagline: "Будильник Окаянный, Змей Беспорядочный и Тесто Убегающее — всё за один день до прихода гостей.",
    description:
      "Шуточная былина о старшекласснике: в полночь приходит весть, что завтра нагрянут друзья, а в горнице — поле после бури. Кот-сказитель предрекает три подвига: одолеть Будильник Окаянный, усмирить трёхголового Змея Беспорядочного и укротить Тесто Убегающее. Высокий былинный слог о самых бытовых делах — и тёплый, совсем не шуточный финал.",
    ageMin: 14,
    ageMax: 17,
    occasions: ["den-rozhdeniya", "23-fevralya", "8-marta", "novyj-god", "vypusknoj-v-shkole"],
    textStyle: "mock-epic",
    artStyles: ["retro-poster", "risograph-zine", "graphic-novel"],
    theme: "city-night",
    heroKind: "teen",
    extras: {
      roles: ["pet", "friend", "sibling", "grandma"],
      min: 0,
      max: 3,
      note: "Питомец станет котом-сказителем или псом-воеводой; друзья — гостями зваными; бабушка — «силой дальней», что спасает пирог.",
    },
    interests: ["музыка", "кулинария", "друзья", "юмор"],
    coverScene:
      "a teen in a hoodie posed heroically like an epic folk hero on a night rooftop over a glowing city, holding a tray like a shield, a striped cat on a chimney, a three-headed serpent of socks and cables curled sleepily nearby, retro poster style",
    spreads: [
      {
        text: "Как во славном во городе, во каменном,\nГде огни горят до самой полуночи,\nГде трамваи звенят, будто гусельки,\nПроживал{Р:|а} {Р:удалой молодец|красна девица} —\nСвет {ГЕРОЙ.им}, ума палата,\nНа седьмом этаже, во светлой горнице.\nСила у {Р:него|неё} — богатырская:\nС вечера спать — не уложишь,\nПоутру встать — не поднимешь.\nА кто силушку ту проверить хочет —\nПусть послушает нашу былину.",
        scene: "a night city of lit windows and tram lines seen from above, one window on the seventh floor glowing warmly, the teen visible inside posed like a hero in an epic tableau",
      },
      {
        text: "Не туча грозная над городом сгущается,\nНе гром гремит над крышами железными, —\nТо в полночный час весть прилетела:\n«Завтра ввечеру мы к тебе пожалуем,\nДруги верные, товарищи школьные!»\nОглянулась горница — и ахнула:\nНоски лежат, как туман над рекою,\nЧашки стоят, как дозор на заставе,\nПровода вьются, как тропы звериные.\nА до вечера — всего-то денёчек.",
        scene: "a messy teen bedroom at midnight lit by a glowing phone screen, socks strewn like fog, cups lined up on the desk like sentries, tangled cables everywhere",
      },
      {
        text: "Тут с высокого шкафа, как с дуба векового,\nПодал голос кот-сказитель, полосатый:\n«Ох ты гой еси, {Р:добрый молодец|красна девица}!\nТри подвига тебя завтра дожидаются:\nОдолеть Будильник Окаянный,\nУсмирить Змея Беспорядочного,\nУкротить Тесто Убегающее.\nНе мечом их брать, а смекалкою,\nНе силой брать, а духом богатырским».\nМолвил — и уснул, как мудрецам положено.",
        scene: "a wise striped cat perched on top of a tall wardrobe as if on an ancient oak, speaking solemnly to the teen sitting on the bed at night",
      },
      {
        text: "Поутру было, ранёшенько,\nЗаревел Будильник Окаянный:\nЗвенит-гремит, аж стёкла дрожат,\nАж голуби с карниза разлетаются.\nСемь раз {ГЕРОЙ.им} его в подушку прятал{Р:|а},\nСемь раз выкатывался Будильник из-под подушки,\nДа всё громче, да всё злее, окаянный.\nНе возьмёшь супостата силою:\nЧем сильней жмёшь кнопку — тем он хитрее.",
        scene: "early morning, a furious old-fashioned alarm clock ringing and bouncing on the nightstand, pigeons scattering from the window ledge, the teen buried under a pillow",
      },
      {
        text: "Призадумал{Р:ся|ась} {ГЕРОЙ.им} думу крепкую:\nА не в том ли сила Будильникова,\nЧто лежит он близко, под рукою?\nВстал{Р:|а} — да и отнёс{Р:|ла} его на дальний подоконник.\nГлядь — а встать-то уже и встал{Р:|а}!\nТак хитростью и побеждён супостат.\nОблачил{Р:ся|ась} тогда {Р:богатырь|богатырша} в доспехи:\nВ худи мягкое — кольчугу дворовую,\nВ тапки-скороходы о двух помпонах.\nА кот на шкафу одобрительно мяукнул.",
        scene: "the teen at the far windowsill silencing the alarm clock, now fully awake in morning sun, wearing a soft hoodie and pom-pom slippers, the cat approving from the wardrobe",
      },
      {
        text: "Тут из-под кровати, из тёмной пещеры,\nПоднял головы Змей Беспорядочный.\nПервая голова — Носочная,\nВторая голова — Проводная,\nТретья голова — Чашечная, звонкая.\nШипит Змей: «Не убрать меня до вечера!\nУберёшь одно — вырастет двое:\nРазберёшь носки — провода запутаются,\nРаспутаешь провода — чашки посыплются!»",
        scene: "a comic three-headed serpent made of socks, tangled cables and clinking cups rising from under the bed, the teen in a hoodie facing it with hands on hips",
      },
      {
        text: "Не стал{Р:|а} {ГЕРОЙ.им} со Змеем силой меряться,\nА включил{Р:|а} музыку походную, звонкую,\nДа расставил{Р:|а} три короба по углам горницы:\nПервый короб — носочный, второй — проводной,\nА третий — на кухню, чашечный.\nКаждой голове — свой дом и место,\nИ не спорят головы, и не множатся.\nЗа три песни Змей и свернулся,\nСвернулся калачиком, задремал в шкафу.\nТолько кот-сказитель ворчит: «Шкаф-то был мой».",
        scene: "the teen dancing while sorting things into three boxes, the sock-cable-cup serpent curling up sleepily inside the open wardrobe, the cat grumbling on top",
      },
      {
        text: "А как солнце за полдень перевалило,\nПодступило испытание третье, тяжкое:\nПирог испечь для гостей дорогих.\nЗамесил{Р:|а} {ГЕРОЙ.им} тесто по рецепту бабушкину,\nА тесто-то не простое — Убегающее:\nЧерез край ползёт, по столу стелется,\nТянет лапы к полу, к коту, к двери,\nПыхтит, как печь, норов показывает:\n«Не родился ещё тот пекарь,\nЧто меня, Тесто вольное, удержит!»",
        scene: "a kitchen in the afternoon, a huge living blob of dough creeping out of a bowl across the table toward the floor, the teen in an apron staring, the cat fleeing",
      },
      {
        text: "Не растерял{Р:ся|ась} {Р:добрый молодец|красна девица},\nПризвал{Р:|а} на подмогу силу дальнюю —\nПозвонил{Р:|а} бабушке за тридевять районов.\nМолвила бабушка голосом ласковым:\n«Не беда это, светик, — тесто подошло.\nОбомни его ладонями, не бойся,\nДа в форму клади, да в печь отправляй».\nТак и сделал{Р:|а}. Присмирело Тесто,\nЗарумянилось пирогом высоким,\nИ запахло на весь подъезд — до первого этажа.",
        scene: "the teen on a video call with grandma on a tablet propped on the counter, calmly kneading the dough, a tall golden pie visible through the oven window",
      },
      {
        text: "Ввечеру собрались гости званые,\nДруги верные, товарищи школьные.\nВходят в горницу — и дивятся:\nГорница чистая, светлая,\nБудильник на подоконнике молчит, как вкопанный,\nЗмей в шкафу посапывает смирненько,\nА на столе — пирог, высокий, как терем.\nПили чай с вареньем да с лимонадом,\nХохотали так, что люстра покачивалась,\nПировали весь вечер — до звёздочек.",
        scene: "friends gathered around a table in a tidy cozy room in the evening, a tall golden pie in the center, tea and lemonade, everyone laughing, city lights through the window",
      },
      {
        text: "А слава пошла по всему городу:\nКурлычут голуби на проводах,\nШепчутся соседи на лавочках,\nПеремигиваются окна многоэтажные:\n«Слыхали ли, люди добрые,\nКак {ГЕРОЙ.им} в един день три подвига совершил{Р:|а}?\nБудильник смирил{Р:|а}, Змея уложил{Р:|а},\nТесто вольное пирогом сделал{Р:|а}!»\nИ трамваи звенели в {Р:его|её} честь,\nБудто гусли звончатые, до полуночи.",
        scene: "a night city panorama, pigeons on wires, neighbors chatting on benches below glowing windows, a tram ringing as it passes under the teen's lit window",
      },
      {
        text: "Тут и сказу конец, а нам — слово молвить,\nСлово молвить без шуток, по-честному.\nПодвиги ведь не в будильниках, не в пирогах.\nПодвиг — когда трудно, а ты всё равно шутишь.\nКогда друзья идут к тебе, потому что с тобой тепло.\nКогда просишь помощи — и не стесняешься.\nМы гордимся тобой, {ЛАСКОВО.им},\nИ не за подвиги вовсе —\nА за то, что ты такой, какой есть.\nИ мы всегда рядом.",
        scene: "the teen on a rooftop at night overlooking the glowing city, the striped cat curled beside, a calm and warm moment under the stars",
      },
    ],
    occasionHooks: {
      "den-rozhdeniya": {
        opening: "Ой вы гой еси, люди добрые! Не простой нынче день, а день рождения: в этот день у {ГЕРОЙ.род} силушки на целый год прибавилось.",
        closing: "А как задули свечи на пироге, грянули гости величальную: «С днём рождения, {ЛАСКОВО.им}! Расти, сила богатырская, на долгие лета!»",
        openingScene: "birthday balloons tied to the bedroom window",
        closingScene: "friends cheering as the candles on the tall golden pie are blown out",
      },
      "novyj-god": {
        opening: "Дело было под самый Новый год, когда во славном городе ёлки на площадях загораются.",
        closing: "А в полночь ударили куранты, будто колокола вечевые, и весь город грянул: «С Новым годом, {ЛАСКОВО.им}! Новых подвигов тебе — да полегче!»",
        openingScene: "a decorated New Year fir tree glowing on a city square below the window",
        closingScene: "New Year fireworks over the night city, a fir tree with warm lights in the room",
      },
      "vypusknoj-v-shkole": {
        opening: "Дело было в пору выпускную, когда школа провожает богатырей своих во чисто поле — во взрослую жизнь.",
        closing: "С выпуском, {ЛАСКОВО.им}! Впереди — поле широкое, а силушки у тебя на всё хватит.",
        openingScene: "graduation ribbons hanging on the bedroom door",
        closingScene: "graduation ribbons on the rooftop, dawn breaking over the city",
      },
      "23-fevralya": {
        opening: "Дело было в день защитников — в тот самый день, когда всякий богатырь вспоминает, что он богатырь.",
        closing: "С 23 Февраля, {ЛАСКОВО.им}! Защищай своих, как горницу от Змея, — смекалкой и добрым сердцем.",
        openingScene: "a festive card on the desk, winter light",
        closingScene: "a festive card and ribbons on the table with the pie",
      },
      "8-marta": {
        opening: "Дело было по весне, в тот самый день, когда мимозой пахнут даже трамваи.",
        closing: "С 8 Марта, {ЛАСКОВО.им}! Пусть весна будет тебе дружиной верною.",
        openingScene: "a bouquet of yellow mimosa in a vase on the windowsill",
        closingScene: "yellow mimosa on the festive table next to the pie",
      },
      default: {
        opening: "Дело было накануне дня особенного — {ПОВОД}.",
        closing: "Поздравляем, {ЛАСКОВО.им}: {ПОВОД}! Славься, сила богатырская, на долгие лета!",
      },
    },
  },
];

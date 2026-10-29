// ВЛАДЕЛЕЦ: агент 6 (сюжеты для взрослых). Никто другой этот файл не меняет.
//
// Должно быть: ADULT_PLOTS — не меньше 5 сюжетов для ADULT, все четыре сегмента (adult-couple,
// adult-parent, adult-grandparent, adult-friend) — хотя бы по одному. Контракт Plot (src/content/types.ts):
// heroKind "adult", ровно 12 разворотов, метки — по docs/content/ARCHITECTURE.md.
// Пары: второй главный герой — {ДОП1.*} с ролью partner (extras.min = 1, roles: ["partner"]), его род —
// {Р1:м|ж}. Книги «от детей/внуков/коллег»: дарители — доп. герои (roles child/grandchild/friend/colleague),
// все вместе — {ДОПЫ.им}, согласование числа — {МН:один|много}; текст должен читаться и без них
// (extras.min = 0), если сюжет их не требует. textStyle из TEXT_STYLE_IDS (our-story-memoir,
// lyrical-verse, mock-epic, pushkin-verse, folk-tale-prose, comic-captions), artStyles из ART_STYLE_IDS,
// theme из DEMO_THEME_KEYS, occasions из OCCASIONS, occasionHooks для главных поводов + "default" с {ПОВОД}.
// Анкетные детали (howMet, memories, profession) — плейсхолдеры не нужны: YandexGPT вплетает их по брифу;
// демо-текст пишите так, чтобы он был хорош и без них. Проверка: validateContent().
//
// Заметки автора:
// — В стихах (lyrical-verse, pushkin-verse) глаголы прошедшего времени героя не используются: «сказал/сказала»
//   различаются числом слогов и ломают метр. Пишем настоящим временем, «мы»-формами и равносложными
//   парами ({Р:дедушка|бабушка}, {МН:прибегает|прибегают}).
// — Рассказчик в парных книгах — вторая половинка ({ДОП1}, род {Р1:…}), герой — «ты».
//
// requests (просьбы к интегратору, агенту 11): —

import type { Plot } from "../types";

export const ADULT_PLOTS: Plot[] = [
  // ───────────────────────────── 1. Пара · Наша история ─────────────────────────────
  {
    slug: "nasha-istoriya",
    audience: "ADULT",
    segments: ["adult-couple"],
    title: "Наша история",
    tagline: "От первого «привет» до общей кружки по утрам — двенадцать глав про вас двоих.",
    description:
      "Тёплая книга-воспоминание от лица второй половинки: первая встреча, прогулка до закрытия всех кафе, ужин на полу среди коробок, полка с четырьмя лишними винтиками и маленькие домашние законы. Смешно, нежно и очень по-вашему — а детали из анкеты станут отдельными сценами.",
    occasions: ["godovshchina", "den-vlyublennyh", "svadba", "den-rozhdeniya", "8-marta", "23-fevralya", "den-semi"],
    coreOccasions: ["godovshchina", "svadba"],
    textStyle: "our-story-memoir",
    artStyles: ["naive-watercolor", "retro-poster", "ink-humor", "linocut"],
    theme: "romance-city",
    heroKind: "adult",
    extras: { roles: ["partner"], min: 1, max: 1, note: "Вторая половинка — обязательно: книга рассказана от её лица" },
    interests: ["путешествия", "кулинария", "кино"],
    coverScene:
      "the hero and the partner walking side by side along an evening city embankment under warm streetlights, sharing a laugh, a small dog trotting past",
    spreads: [
      {
        text: "Помнишь тот день, когда мы встретились? Я совсем не собирал{Р1:ся|ась} ни с кем знакомиться: у меня были планы, дела и, кажется, даже плохое настроение. А потом рядом оказал{Р:ся|ась} ты — и все мои планы тихо отошли в сторонку, как вежливые гости. Я до сих пор не помню, что именно ты тогда сказал{Р:|а}. Помню только, что мне ужасно захотелось ответить.",
        scene: "the hero and the partner meeting for the first time on a busy city street at dusk, both a little shy, warm light from shop windows",
      },
      {
        text: "Мы гуляли, пока не закрылись все кафе, а потом ещё немного — просто потому, что было жалко расходиться. Ты рассказывал{Р:|а} смешную историю из детства, я смеял{Р1:ся|ась} так громко, что на нас оглянулся прохожий с собакой. Собака, кстати, нас одобрила. С тех пор, когда всё идёт правильно, мы говорим друг другу: «Собака одобрила».",
        scene: "the couple walking late at night past closed cafes, laughing, a passer-by with a small dog looking back at them, the dog wagging its tail approvingly",
      },
      {
        text: "На следующую встречу я {Р1:пришёл|пришла} на двадцать минут раньше и сделал{Р1:|а} вид, что оказал{Р1:ся|ась} рядом случайно. Ты {Р:пришёл|пришла} на пятнадцать минут раньше — и сделал{Р:|а} точно такой же вид. Мы долго стояли и старательно удивлялись друг другу. Тогда я и понял{Р1:|а}: с этим человеком будет интересно говорить и совсем не страшно молчать.",
        scene: "the hero and the partner standing near a city clock, both pretending to be surprised to see each other, holding back smiles",
      },
      {
        text: "Потом у нас появился общий дом. Первый вечер мы сидели на полу среди коробок и ели прямо из кастрюли — тарелки ехали где-то в другой коробке. Лампочка была одна, стул тоже один, и мы честно сидели на нём по очереди. Это был самый неудобный и самый счастливый ужин в моей жизни.",
        scene: "the couple sitting on the floor of an empty new apartment among cardboard boxes, eating from one pot, a single bare light bulb, one lonely chair",
      },
      {
        text: "Помнишь нашу первую полку? Инструкция была на трёх языках, и ни один из них не был понятен. В конце осталось четыре лишних винтика. Мы торжественно сложили их в баночку — «на всякий случай». Полка стоит до сих пор. Баночка тоже. Иногда мне кажется, что именно эти винтики и держат весь наш дом.",
        scene: "the hero and the partner proudly standing next to a slightly crooked assembled shelf, a small glass jar with four leftover screws in the foreground",
      },
      {
        text: "У нас появились свои законы. Кто первым проснулся — ставит чайник. Кто вторым — говорит «доброе утро» так, будто это свежая новость. А твою нелепую кружку с котом нельзя трогать никому, даже мне. Я пробовал{Р1:|а} подарить тебе красивый сервиз. Сервиз стоит в шкафу. Кружка с котом — на столе.",
        scene: "a sunny kitchen morning, the hero sleepy with a funny mug with a cat on it, the partner pouring tea from a kettle, an unopened elegant tea set in a cupboard behind",
      },
      {
        text: "А ещё были дороги. Поезда, где за окном полдня тянулся один и тот же лес, а нам не было скучно ни минуты. Чемоданы, которые я собираю неделю, а ты — десять минут, и почему-то мы всё равно забываем одно и то же: зарядку. Я давно понял{Р1:|а}: неважно, куда мы едем. Важно, что обратно — вместе.",
        scene: "the couple by a train window with a long forest passing outside, sharing snacks and a map, two suitcases on the rack",
      },
      {
        text: "Бывали и трудные дни — когда всё валится из рук, а за окном третью неделю ноябрь. В такие вечера ты не говорил{Р:|а} громких слов. Ты просто ставил{Р:|а} рядом чай, укрывал{Р:|а} меня пледом и включал{Р:|а} какой-нибудь старый смешной фильм. К середине фильма мир обычно вставал на место.",
        scene: "a rainy evening, the partner wrapped in a plaid blanket on a sofa, the hero bringing a cup of tea, a soft glow from a screen, rain on the window",
      },
      {
        text: "У нас есть слова, которых нет ни в одном словаре. Мы понимаем друг друга по одному взгляду через весь шумный праздничный стол. Друзья уверяют, что мы разговариваем бровями. Это неправда. Иногда мы разговариваем ещё и плечами.",
        scene: "a noisy festive dinner with friends, the hero and the partner exchanging a knowing look across the table with raised eyebrows, friends laughing",
      },
      {
        text: "Знаешь, что ты для меня? Это не про красивые слова. Это когда ты оставляешь мне последний кусок пирога и уверяешь, что уже наел{Р:ся|ась}. Когда помнишь, что я не люблю лук. Когда в любой толпе первым делом ищешь глазами меня — я видел{Р1:|а}, не отпирайся.",
        scene: "the hero in a crowded place searching for someone with their eyes and lighting up on spotting the partner, warm golden light",
      },
      {
        text: "А сегодня у нас праздник. Свечи, цветы — всё как положено. Мы сидим за нашим столом, тем самым, который так долго затаскивали по лестнице, и я смотрю на тебя так же, как в тот первый вечер. Только теперь я точно знаю, что ты скажешь, — и всё равно жду. Та собака, если бы нас видела, точно бы одобрила.",
        scene: "the couple at a festive table at home with candles and flowers, the partner gazing at the hero, a small dog-shaped figurine on the shelf behind",
      },
      {
        text: "Спасибо тебе за каждое утро и каждый чайник, за винтики в баночке, за кружку с котом и за то, что с тобой даже ноябрь похож на приключение. Я тебя люблю — просто, без громких слов, каждый день чуть больше. Впереди столько глав. Давай напишем их вместе — ты и я, {ГЕРОЙ.им} и {ДОП1.им}.",
        scene: "the hero and the partner hugging by a window at night, city lights below, a jar of screws and a cat mug on the windowsill",
      },
    ],
    occasionHooks: {
      godovshchina: {
        opening: "Сегодня наша годовщина, и я решил{Р1:|а} собрать в одну книгу всё, что мы успели вместе. Начну с самого начала.",
        closing: "С годовщиной, {ЛАСКОВО.им}! Ещё один год — а мне всё так же интересно, что ты скажешь дальше.",
        openingScene: "two cups of tea and a small cake with one candle",
        closingScene: "anniversary candles and a bouquet on the windowsill",
      },
      "den-vlyublennyh": {
        opening: "Четырнадцатое февраля: все дарят друг другу сердечки, а я решил{Р1:|а} подарить тебе всю нашу историю целиком.",
        closing: "С Днём всех влюблённых, {ЛАСКОВО.им}! Моё сердечко — вот оно, в этой книге. Оно давно твоё.",
        openingScene: "shop windows with paper hearts on a winter street",
        closingScene: "small paper hearts scattered on the windowsill",
      },
      svadba: {
        opening: "Совсем скоро мы скажем друг другу самое важное «да». А пока — история о том, как мы к нему шли.",
        closing: "До нашего «да» осталось совсем немного. Я {Р1:готов|готова}. Кажется, ещё с того самого первого вечера.",
        openingScene: "two wedding rings tied with a ribbon",
        closingScene: "wedding flowers and garlands in the window light",
      },
      "den-rozhdeniya": {
        opening: "Сегодня твой день рождения, и я дарю тебе не вещь, а нашу историю.",
        closing: "С днём рождения, {ЛАСКОВО.им}! Пусть этот год станет ещё одной счастливой главой — нашей.",
        openingScene: "a birthday cake with candles",
        closingScene: "a birthday cake with candles on the windowsill",
      },
      default: {
        opening: "Сегодня особенный день — {ПОВОД}. И я хочу рассказать тебе нашу историю.",
        closing: "С праздником, {ЛАСКОВО.им}! Пусть {ПОВОД} станет ещё одной тёплой страницей нашей книги.",
      },
    },
  },

  // ───────────────────────────── 2. Пара · Лирические стихи ─────────────────────────────
  {
    slug: "dve-planety",
    audience: "ADULT",
    segments: ["adult-couple"],
    title: "Две планеты",
    tagline: "Жили-были две маленькие планеты — и однажды между ними протянулся мост.",
    description:
      "Нежные стихи о паре как о двух крошечных планетах: окно, горящее вдалеке, мост от кометы, разговоры до рассвета, общий дом с двумя кружками и одной калиткой. Простые образы вместо громких слов — книга, которую читают вдвоём вслух.",
    occasions: ["den-vlyublennyh", "godovshchina", "svadba", "den-rozhdeniya", "8-marta"],
    coreOccasions: ["den-vlyublennyh"],
    textStyle: "lyrical-verse",
    artStyles: ["naive-watercolor", "linocut", "retro-poster"],
    theme: "starry-sky",
    heroKind: "adult",
    extras: { roles: ["partner"], min: 1, max: 1, note: "Вторая половинка — обязательно: она второй герой книги" },
    interests: ["звёзды", "путешествия", "книги"],
    coverScene:
      "two tiny planets in a starry sky connected by a glowing bridge, the hero and the partner meeting in the middle, a lantern between them, dreamy pastel night",
    spreads: [
      {
        text: "Была у каждого планета —\nсвоя, размером с огород.\nМоя — в ромашках, в пятнах света,\nтвоя — где чай и рыжий кот.",
        scene: "two tiny separate planets in a starry sky, one covered with daisies and patches of light, the other with a small house, a teapot and a ginger cat, the hero on one and the partner on the other",
      },
      {
        text: "Бывало, вечером я сяду\nна край скамьи, на край крыльца —\nа где-то там, совсем не рядом,\nгорит окно. И без конца\nя всё гадаю: кто не спит\nв окне, что так светло горит?",
        scene: "the partner sitting on the edge of a porch on a tiny planet at night, looking at a distant warm window glowing on another planet",
      },
      {
        text: "А дальше — я не знаю точно,\nкак это вышло, почему:\nкомета пролетела ночью,\nа следом — мост. И по нему,\nс двух разных краешков вселенной,\nмы шли — неловко, постепенно.",
        scene: "a comet streaking across the night sky leaving a glowing bridge between two tiny planets, the hero and the partner stepping onto it from opposite ends",
      },
      {
        text: "Мы говорили про погоду,\nпро звёзды, мост и про кота —\nи рассмеялись мимоходом\nнад тем же самым, как всегда.",
        scene: "the hero and the partner standing in the middle of a starlit bridge, talking and suddenly laughing at the same moment",
      },
      {
        text: "Мы шли по Млечному Пути,\nи было некуда спешить,\nи до рассвета, до шести,\nмы не могли никак решить,\nкому кого же провожать, —\nи начинали всё опять.",
        scene: "the couple strolling along a milky starry path toward a pale dawn, walking back and forth, small stars under their feet",
      },
      {
        text: "Потом мы взяли две планеты,\nсвязали лентой голубой —\nи вышел дом: с котом, со светом,\nс одной калиткой — и с тобой.\nНа подоконнике — две кружки,\nа на диване — две подушки.",
        scene: "two tiny planets tied together with a long blue ribbon, one small cozy house on top with a garden gate, two mugs on the windowsill and a ginger cat",
      },
      {
        text: "Кто раньше встанет — ставит чайник.\nКто позже — говорит «привет».\nЗакон простой, почти случайный,\nи в нём ни разу сбоя нет.",
        scene: "a soft morning inside the little planet house, the hero putting a kettle on, the partner sleepily waving hello from under a blanket",
      },
      {
        text: "Бывало всякое: дожди\nиз метеоров, ветер, стужа.\nНо ты мне скажешь: «Подожди,\nсейчас починим». И не хуже,\nа даже крепче, чем была,\nстоит планета. И светла.",
        scene: "a gentle meteor shower over the tiny planet, the hero and the partner patching the roof of their house together under one plaid blanket, a lantern glowing",
      },
      {
        text: "У нас слова свои, смешные,\nкоторых нет у словарей,\nи взгляды — тихие, сквозные —\nсквозь шумный праздник у друзей.\nДрузья вздыхают: «Ну, опять\nбровями начали болтать».",
        scene: "a lively party with friends among the stars, the hero and the partner exchanging a quiet look over everyone's heads, friends rolling their eyes fondly",
      },
      {
        text: "Где были камни — там сирень,\nгде было тихо — смех и чай.\nТы просто рядом каждый день —\nи всё цветёт, как невзначай.",
        scene: "the tiny planet now covered in blooming lilac where there used to be stones, the hero and the partner having tea on the grass",
      },
      {
        text: "Сегодня — праздник. На планете\nгорят фонарики в саду,\nи звёзды, как большие дети,\nпришли и сели на виду.\nИ ты смеёшься — так же точно,\nкак в первый вечер, тот, полночный.",
        scene: "a festive night on the tiny planet, paper lanterns in the garden, stars with little faces gathered around like curious guests, the hero laughing",
      },
      {
        text: "Я не умею говорить\nкрасиво — да и ни к чему.\nЯ буду просто чай варить\nи ждать тебя. И потому\nскажу как есть — совсем простое.\n{ЛАСКОВО.им}.\nЛюблю. Ты — здесь. Нас — двое.",
        scene: "the hero and the partner sitting close on the edge of their tiny planet, legs dangling over the starry sky, two mugs of tea, a calm sleeping cat",
      },
    ],
    occasionHooks: {
      godovshchina: {
        opening: "Сегодня — наша годовщина,\nа значит — повод и причина\nвернуться в самое начало,\nкогда нас вместе не бывало.",
        closing: "Ещё один наш год — в цвету.\nИ пусть их будет без подсчёта.\nУ нас на маленьком мосту\nромашки сеять — вот работа.",
        openingScene: "a small anniversary cake with one candle on the edge of a planet",
        closingScene: "daisies growing along the starlit bridge",
      },
      "den-vlyublennyh": {
        opening: "Февраль. В витринах — сто сердечек,\nи город весь — в цветах и свете.\nА я — без лишних слов и свечек —\nпро нас: про две смешных планеты.",
        closing: "С Днём всех влюблённых. Пусть горит\nфонарь у нашего порога\nи тихо-тихо говорит:\nнас двое. Этого — так много.",
        openingScene: "tiny paper hearts floating among the stars",
        closingScene: "a lantern glowing by the door of the little house, paper hearts around",
      },
      default: {
        opening: "{ПОВОД}.\nА вот — рассказ\nо том, как всё нашлось у нас.",
        closing: "{ПОВОД}.\nИ пусть горит\nфонарь над нашею планетой,\nи пусть он тихо говорит,\nчто мы ещё в начале лета.",
      },
    },
  },

  // ───────────────────────────── 3. Мама или папа · Шуточный эпос ─────────────────────────────
  {
    slug: "bylina-o-domashnih-podvigah",
    audience: "ADULT",
    segments: ["adult-parent"],
    title: "[Имя]: былина о домашних подвигах",
    tagline: "Утро Понедельничное, Задача Трёхголовая и Сон-Непоседа — враги грозные, но наш богатырь сильнее.",
    description:
      "Шуточная былина от детей о маме или папе: один обычный день воспет как подвиги богатыря. Великий Сбор за семь минут, задача про два поезда, сказка, которая усыпляет даже Сон-Непоседу, и пир блинами. А в финале — без всякой иронии: спасибо, что ты у нас есть.",
    occasions: ["den-materi", "den-otca", "8-marta", "23-fevralya", "den-rozhdeniya"],
    coreOccasions: ["den-materi", "den-otca"],
    textStyle: "mock-epic",
    artStyles: ["kind-classic", "ink-humor", "naive-watercolor"],
    theme: "home",
    heroKind: "adult",
    extras: { roles: ["child"], min: 1, max: 3, note: "Дети — дарители книги и «верная дружина»" },
    interests: ["семья", "ремонт", "сказки"],
    coverScene:
      "the hero standing proudly in a cozy apartment hallway like a legendary knight, a ring of keys raised like a sword, a pot lid as a shield, children lined up behind as a loyal squad",
    spreads: [
      {
        text: "Как во славном во городе, во доме нашем белокаменном жил{Р:|а}-был{Р:|а} {ГЕРОЙ.им} — {Р:богатырь могучий|поляница удалая}. Силушка у {Р:него|неё} не от каши, а от сердца великого. Встаёт {Р:он|она} раньше солнышка красного: солнышку-то спешить некуда, а у {Р:нашего богатыря|нашей поляницы} дел — на тридцать три царства.",
        scene: "the hero waking before sunrise in a cozy home, stretching heroically by the window as the sun only begins to rise, epic storybook mood",
      },
      {
        text: "Не туча грозная над полем стелется, не гром гремит над белокаменной прихожею — то подступает Утро Понедельничное, Окаянное. До выхода семь минут, а у дружины один ботинок на всех, шарф пропал без вести, рюкзак не собран со вчерашнего вечера. Ахнули стены, задрожали вешалки: не бывать, видно, никому вовремя!",
        scene: "a chaotic hallway on a Monday morning, one lonely shoe, a scarf dangling from a lamp, open backpacks, a wall clock showing almost eight, dramatic storm clouds drawn on the wallpaper",
      },
      {
        text: "Снаряжается {ГЕРОЙ.им} во доспехи богатырские: шелом — шапку тёплую, кольчугу — куртку непромокаемую, а заместо меча — связку ключей звонкую. А при {Р:нём|ней} — дружина верная: {ДОПЫ.им}. Глаза у дружины ещё слипаются, зато сердце уже храброе.",
        scene: "the hero putting on a warm hat and a jacket like knight's armor, holding a ring of keys like a sword, sleepy children standing behind in a row like a loyal squad",
      },
      {
        text: "Первый подвиг — Великий Сбор. Затаился в доме Ботинок-Невидимка, расползлись варежки по тёмным углам, а Шарф Беглый и вовсе ушёл в бега. Иной бы богатырь тут закручинился, сел бы на сундук да опустил руки. Но не {Р:таков|такова} {ГЕРОЙ.им}!",
        scene: "the hero scanning the hallway like a hero-scout, a shoe peeking from under a sofa, mittens hiding in corners, a striped scarf sneaking toward the door",
      },
      {
        text: "Хлопнул{Р:|а} {ГЕРОЙ.им} в ладоши и молвил{Р:|а} слово заветное: «Кто быстрей оденется — тому первая песня в дороге!» Тут ботинок сам из-под дивана выкатился, варежки на руки запрыгнули, а шарф, устыдившись, вернулся с повинной. Ровно в семь пятьдесят дружина стояла у двери — обутая, одетая, хохочущая.",
        scene: "everyone fully dressed and laughing at the front door, the hero clapping hands, the runaway scarf wrapping itself back around a child's neck, bright morning light",
      },
      {
        text: "Второй подвиг пострашнее. Вечером выползла из рюкзака Задача Трёхголовая — про два поезда, что вышли навстречу друг другу и никак не встретятся. Вздыхает над ней дружина, тетрадка мокнет, ластик стёрт до основания. А Задача говорит человечьим голосом: «Не решить вам меня ни до утра, ни до лета!»",
        scene: "a three-headed paper creature made of math problems rising from a school backpack over an evening table, children looking worried, a desk lamp glowing",
      },
      {
        text: "Да не на {Р:того|ту} напала! Сел{Р:|а} {ГЕРОЙ.им} рядом, нарисовал{Р:|а} на листке два паровозика с глазками, рельсы да станцию с буфетом. Пошли паровозики навстречу, загудели — и встретились ровно на середине, у буфета, чай пить. Ахнула Задача, сложилась вчетверо и сама легла в тетрадку — с ответом.",
        scene: "the hero at a desk drawing two smiling little trains meeting at a tiny station, children leaning in amazed, the paper creature folding itself into a notebook",
      },
      {
        text: "А третий подвиг — самый трудный. Ночь на дворе, звёзды по небу рассыпались, а в детской не спит Сон-Непоседа: скачет по подушкам, щекочет пятки, просит воды, потом ещё воды, потом спросить, почему небо синее. Уж на что богатыри крепки — и те бы сдались. А {ГЕРОЙ.им} не сдаётся.",
        scene: "a children's bedroom at night, a tiny mischievous sleep sprite bouncing on the pillows, children wide awake, stars in the window, the hero standing calmly in the doorway",
      },
      {
        text: "Присел{Р:|а} {ГЕРОЙ.им} на краешек кровати и {Р:завёл|завела} сказку — тихую, долгую, про кота, который искал, где ночует луна. На третьем слове Сон-Непоседа зевнул. На пятом — свернулся клубочком. А на десятом спала вся дружина, и сам Сон тоже — прямо на краю одеяла.",
        scene: "the hero sitting on the edge of a bed telling a story by a small lamp, children asleep, the little sleep sprite curled up asleep on the corner of the blanket",
      },
      {
        text: "А в выходной был пир на весь мир! Блины пекли всей дружиной: кто тесто мешал, кто муку сеял, а кто и сам в муке оказался — по самые уши. Блины вышли кто круглый, кто квадратный, а один — в форме Африки. Съели всё до крошки. И Африку тоже.",
        scene: "a joyful weekend feast at home, the whole family making pancakes together, flour everywhere, one pancake shaped like a continent, everyone laughing",
      },
      {
        text: "И пошла о {ГЕРОЙ.пр} слава по всему подъезду, по всему двору, по всем окрестным лавочкам. Гусляры поют, соседи дивятся: «Как у {Р:него|неё} всё успевается? Где {Р:он|она} силушку берёт?» А дружина знает, да не говорит. Секрет простой: силушка у {Р:него|неё} — от нас, а у нас — от {Р:него|неё}.",
        scene: "neighbors in a sunny courtyard gathered admiringly, a musician playing a psaltery on a bench, the hero modestly waving, the children proudly smiling",
      },
      {
        text: "А теперь — без былинных слов. {ЛАСКОВО.им}, спасибо тебе за каждое утро, которое ты {Р:спас|спасла}, за задачки, сказки и блины в форме Африки. С тобой любой понедельник — праздник, а любая беда — просто приключение. {ДОПЫ.им} {МН:тебя очень любит|тебя очень любят}.",
        scene: "the children hugging the hero tightly in a warm living room in the evening, a handmade card in small hands, soft lamplight",
      },
    ],
    occasionHooks: {
      "den-materi": {
        opening: "Это не простая сказка, а былина — сложенная в честь Дня матери, праздника великого.",
        closing: "С Днём матери, {ЛАСКОВО.им}! Слава тебе — от дружины, от гусляров и от всего подъезда.",
        openingScene: "autumn flowers and a handmade card on a hallway shelf",
        closingScene: "a bouquet of autumn flowers and a handmade card",
      },
      "den-otca": {
        opening: "Это не простая сказка, а былина — сложенная в честь Дня отца, праздника великого.",
        closing: "С Днём отца, {ЛАСКОВО.им}! Слава тебе — от дружины, от гусляров и от всего подъезда.",
        openingScene: "a handmade card propped on a hallway shelf, autumn light",
        closingScene: "a handmade card and autumn leaves on the table",
      },
      "8-marta": {
        opening: "Было то ранней весной, когда сугробы ещё стоят стеной, а мимоза уже в каждом окне, — сложили мы былину в честь Восьмого марта.",
        closing: "С 8 Марта, {ЛАСКОВО.им}! Пусть подвиги будут лёгкими, а пиры — частыми.",
        openingScene: "a vase of yellow mimosa on the windowsill",
        closingScene: "yellow mimosa and spring sunlight",
      },
      "23-fevralya": {
        opening: "Было то в конце февраля, когда защитников поминают добрым словом, — сложили мы былину о {Р:главном защитнике|главной защитнице} нашего дома.",
        closing: "С 23 Февраля, {ЛАСКОВО.им}! С тобой наш дом — крепость, а каждый день — приключение.",
        openingScene: "a festive card with ribbons in the hallway",
        closingScene: "a festive card with ribbons on the table",
      },
      "den-rozhdeniya": {
        opening: "В день рождения {ГЕРОЙ.род} сложили мы про {Р:него|неё} былину — чтобы гусляры пели, а соседи завидовали.",
        closing: "С днём рождения, {ЛАСКОВО.им}! Многая лета — и лёгких подвигов!",
        openingScene: "balloons tied to the coat rack",
        closingScene: "a birthday cake with candles among the pancakes",
      },
      default: {
        opening: "Было то в день особенный — {ПОВОД}, — и сложили мы о {ГЕРОЙ.пр} былину.",
        closing: "Пусть этот праздник — {ПОВОД} — будет таким же славным, как все твои подвиги, {ЛАСКОВО.им}!",
      },
    },
  },

  // ───────────────────────────── 4. Мама или папа · Лирические стихи ─────────────────────────────
  {
    slug: "dvenadcat-urokov",
    audience: "ADULT",
    segments: ["adult-parent"],
    title: "Двенадцать твоих уроков",
    tagline: "Не бояться темноты, завязывать шнурки, смеяться над собой — всему этому нас научил один человек.",
    description:
      "Книга в стихах от выросших (или растущих) детей маме или папе: двенадцать маленьких уроков, которые не задают в школе. Щёлка света в двери, кролик вокруг пенька, мандарин на всех, зонт вверх тормашками — простые сцены, от которых щиплет в носу.",
    occasions: ["den-materi", "den-otca", "den-rozhdeniya", "yubilej", "8-marta", "23-fevralya"],
    coreOccasions: ["den-materi", "den-otca"],
    textStyle: "lyrical-verse",
    artStyles: ["naive-watercolor", "kind-classic", "pen-ink-1920s"],
    theme: "home",
    heroKind: "adult",
    extras: { roles: ["child"], min: 0, max: 3, note: "Дети — дарители; книга звучит от их лица («мы»)" },
    interests: ["семья", "детство"],
    coverScene:
      "the hero sitting on a cozy sofa with children of different ages around, an old photo album open, a bowl of tangerines, warm lamplight",
    spreads: [
      {
        text: "Урок один: не бойся ночи.\nТы оставляешь щёлку света —\nи шкаф, большой и тёмный очень,\nвсего лишь шкаф. И страха нету.",
        scene: "a child's bedroom at night, a strip of warm light from a half-open door, the hero peeking in, a big wardrobe that looks friendly in the light",
      },
      {
        text: "Урок второй: шнурки и петли.\nТут кролик бегает вокруг\nпенька — и прячется. А если\nне вышло — снова, снова… Вдруг!",
        scene: "the hero kneeling beside a small child on a doorstep teaching how to tie shoelaces, a tiny imaginary rabbit hopping around the laces",
      },
      {
        text: "Урок про то, что можно падать,\nно важно — встать и снова в путь.\nТы держишь сзади — и, как надо,\nотпустишь в нужный миг. Чуть-чуть.",
        scene: "the hero running behind a child on a small bicycle in a summer park, hand just letting go of the seat, the child pedaling forward proudly",
      },
      {
        text: "Урок: сказать «прости» — не страшно.\nИ первым — тоже не беда.\nТы это делаешь отважно\nи просто — так, как и всегда.",
        scene: "the hero crouching to a child's eye level in a kitchen, both smiling after making up, two cups of cocoa on the table",
      },
      {
        text: "Урок про дождь: он не помеха,\nа повод лужи измерять.\nИ в сапогах, давясь от смеха,\nмы прыгаем — и ты опять.",
        scene: "a rainy autumn yard, children in rubber boots jumping into puddles, the hero jumping too with an umbrella, everyone laughing",
      },
      {
        text: "Урок: делиться. Мандарин\nты чистишь, делишь по-соседски:\nнам — по шести, себе — один,\nи улыбаешься по-детски.",
        scene: "the hero peeling a tangerine at a winter table, handing slices to children, keeping only one slice, snow outside the window",
      },
      {
        text: "Урок про слово: «обещаю» —\nи значит, будет. Точно в срок.\nТы держишь слово, не считая,\nчто это трудно. Вот урок.",
        scene: "the hero arriving through a snowy evening exactly on time to a school concert, a child on stage beaming at the door",
      },
      {
        text: "Урок: смеяться над собой,\nкогда пирог сгорел до корки\nи зонт от ветра — вверх трубой, —\nа мы хохочем, как на горке.",
        scene: "a windy street, the hero's umbrella turned inside out, a slightly burnt pie in a basket, the hero and the children laughing together",
      },
      {
        text: "Урок про чудо: это просто —\nснежинки вырезать вдвоём\nи клеить на окно по росту,\nчтоб засветился весь наш дом.",
        scene: "the hero and children cutting paper snowflakes at a table and sticking them on a window in a row from small to big, warm evening glow",
      },
      {
        text: "А главному — не учишь вовсе:\nты просто любишь каждый день.\nИ даже в дождь, и даже в осень\nс тобою — май, тепло, сирень.",
        scene: "an autumn window with rain outside, inside the hero hugging the children on the sofa, a vase of lilac on the table as if spring came indoors",
      },
      {
        text: "Сегодня мы — уже большие,\nи наш черёд — тебе сказать\nслова — простые и родные:\nих можно сто раз повторять.",
        scene: "grown-up children gathered around the hero at a festive family table, raising cups of tea, the hero touched and smiling",
      },
      {
        text: "{ЛАСКОВО.им}!\nСпасибо за твои уроки,\nза мандарины, за дожди,\nза все шнурки и все дороги.\nМы любим. Столько впереди.",
        scene: "the hero holding an open album of old photos, the children hugging from both sides, a bowl of tangerines and a small paper snowflake on the table",
      },
    ],
    occasionHooks: {
      "den-materi": {
        opening: "Сегодня — мамин день. И снова\nмы вспоминаем — слово в слово.",
        closing: "С Днём матери! За всё, что знаем, —\nтебе спасибо. Обнимаем.",
        openingScene: "autumn flowers and a handmade card on the windowsill",
        closingScene: "a bouquet of autumn flowers and a handmade card",
      },
      "den-otca": {
        opening: "Сегодня — папин день. И снова\nмы вспоминаем — слово в слово.",
        closing: "Ну, с Днём отца! За всё, что знаем, —\nтебе спасибо. Обнимаем.",
        openingScene: "a handmade card on the windowsill in autumn light",
        closingScene: "a handmade card and autumn leaves",
      },
      default: {
        opening: "{ПОВОД}.\nСегодня снова\nмы вспоминаем — слово в слово.",
        closing: "{ПОВОД}.\nИ мы-то знаем,\nза что спасибо. Обнимаем.",
      },
    },
  },

  // ───────────────────────────── 5. Бабушка или дедушка · Пушкинская сказка ─────────────────────────────
  {
    slug: "skazka-pro-carya-nesmeyana",
    audience: "ADULT",
    segments: ["adult-grandparent"],
    title: "[Имя] и царь Несмеян",
    tagline: "Царь разучился смеяться — и только один человек в царстве знает, как ему помочь.",
    description:
      "Сказка в стихах о бабушке или дедушке с золотыми руками и добрым сердцем. Царь Несмеян объявляет три испытания: оживить засохший сад, завести остановившиеся часы и рассмешить его самого. Помогает скворушка, а главное чудо случается, когда герой рассказывает царю про своих внуков.",
    occasions: ["den-babushek-i-dedushek", "yubilej", "den-rozhdeniya", "pensiya", "8-marta", "23-fevralya"],
    coreOccasions: ["den-babushek-i-dedushek"],
    textStyle: "pushkin-verse",
    artStyles: ["folk-lubok", "pen-ink-1920s", "vintage-postcard", "kind-classic"],
    theme: "dacha",
    heroKind: "adult",
    extras: { roles: ["grandchild"], min: 1, max: 3, note: "Внуки — помощники героя и дарители книги" },
    interests: ["сад", "дача", "мастерить", "сказки"],
    coverScene:
      "the grandparent in a fairy-tale Russian village garden with a starling on the shoulder, grandchildren around, a carved wooden house and a distant tsar's palace with onion domes",
    spreads: [
      {
        text: "За лесами, за горами,\nЗа высокими холмами,\nВозле речки, у дубравы,\nДом стоит — резной, на славу.\nКто живёт там? Угадай!\n— {ГЕРОЙ.им}!\nСказку слушай, не зевай:\nНе простую — золотую,\nС добрым словом, не пустую.",
        scene: "a carved wooden house by a river next to an oak grove, fairy-tale countryside, the grandparent on the porch in morning light",
      },
      {
        text: "Руки — золото, не руки,\nНи минуты нет для скуки:\nСад цветёт, скрипит крылечко,\nПироги пыхтят на печке.\nА к крыльцу со всей округи\nХодят за советом други.\n{МН:Непоседа|Непоседы} — тут с утра,\nИ в саду звенит: «Ура!»",
        scene: "the grandparent working in a blooming garden by the carved porch, neighbors coming for advice, grandchildren running through the gate cheering",
      },
      {
        text: "А в столице, во светлице,\nНесмеян, наш царь, томится:\nПесен нет и сказок нет —\nТишь да скука много лет.\nИ летит указ по свету:\n«Кто вернёт улыбку эту,\nКто царя развеселит —\nТот и будет знаменит!»",
        scene: "a gloomy tsar on a throne in an ornate palace chamber, chin on hand, a herald reading a decree from a scroll, messengers riding out",
      },
      {
        text: "Только солнышко встаёт —\nСлышен топот у ворот:\n«Царь грустит! Такой указ!»\nМолвит {Р:дедушка|бабушка}: «Сейчас!\nТолько сумку соберём\nДа краюшку — и пойдём».",
        scene: "grandchildren bursting into the cozy house at dawn waving a decree, the grandparent calmly packing a cloth bag with a loaf of bread",
      },
      {
        text: "Долго ль, коротко ль шагали —\nГлядь, скворца в траве видали:\nЛапку ниткой он запутал,\nПлачет: «Кто бы мне распутал?»\n{Р:Дедушка|Бабушка} — скорей к нему:\n«Не пугайся, я сниму».\nСкворушка: «Спасибо! Знай:\nПозовёшь — я тут. Встречай!»",
        scene: "on a country road the grandparent kneeling in the grass gently freeing a starling's leg from a thread, the grandchildren watching",
      },
      {
        text: "Вот дворец. А в нём — беда:\nСад засох, пуста гряда.\nМолвит царь: «Хочу — до света —\nЧтобы здесь настало лето!»\nНочь. Луна. Крыльцо. Прохлада.\nШепчет {Р:дедушка|бабушка} у сада:\n«Скворушка, дружок пернатый,\nПрилети к окну с утра ты!»",
        scene: "a withered royal garden at night under the moon, the tsar pointing at dry branches, the grandparent standing by the garden fence calling softly to the sky",
      },
      {
        text: "Прилетел скворец — и с ним\nСтая, словно лёгкий дым.\nНосят капли из колодца,\nБудят землю, будят солнце,\nА уж руки золотые\nВетки лечат молодые.\nГлядь — к утру весь сад в цвету!\nЦарь глядит на красоту:\n«Славно, — молвит, — только вот:\nНе смеётся мой народ…»",
        scene: "a flock of starlings carrying water drops, the grandparent tending young branches, the royal garden bursting into bloom at sunrise, the tsar looking impressed but still unsmiling",
      },
      {
        text: "Новый день — опять задача,\nЦарь-то наш едва не плачет:\nВ башне встали все часы,\nСпят две стрелки, как лисы.\n«Скворушка, дружок пернатый,\nПрилети к окну с утра ты!»\nКлючик скворушка приносит,\nНичего взамен не просит.\nЩёлк! — и стрелочки бегут,\nБьют часы: «Динь-дон! Мы тут!»",
        scene: "a palace clock tower with stopped hands, the starling bringing a tiny golden key in its beak, the grandparent winding the clock, the hands starting to move",
      },
      {
        text: "Царь вздыхает: «Всё чудесно,\nТолько мне — всё так же пресно.\nТретья служба — всех трудней:\nРассмешите — поскорей!»\n«Скворушка, дружок пернатый,\nПрилети к окну с утра ты!»\nСкворушка в ответ смеётся:\n«Тут уменье не даётся —\nНе крылом, не ремеслом,\nА рассказом — о родном!»",
        scene: "the tsar sighing on his throne, the grandparent by the palace window with the starling perched on the sill, the bird looking wise and amused",
      },
      {
        text: "{Р:Дедушка|Бабушка} к царю садится,\nПро своих рассказ струится:\nКак в саду искали клад,\nА нашли — сто лягушат,\nКак варенье пропадало\nИ с усов кота свисало…\nЦарь сперва молчит, потом\nУлыбается тайком,\nА потом как засмеётся —\nАж корона набок гнётся!",
        scene: "the grandparent sitting beside the tsar telling a story with lively gestures, little scenes of frogs and a cat with jam on its whiskers floating above, the tsar laughing so hard his crown tilts",
      },
      {
        text: "Тут и песни зазвенели,\nСказки в царство прилетели,\nПир — на весь честной народ:\nПироги, кисель и мёд!\n{Р:Дедушка|Бабушка} — в большом почёте,\nЦарь — и тот уж в хороводе,\nА скворец, лихой певец,\nСвищет песни во дворец.",
        scene: "a joyful palace feast with long tables of pies, the grandparent seated in the place of honor, the tsar dancing in a round dance with the grandchildren, the starling singing on a chandelier",
      },
      {
        text: "Тут и сказочке конец,\nА намёк — для всех сердец:\nНе богатство и не трон,\nА тепло, в котором дом,\nГде умеют слушать, ждать,\nСказкой горе прогонять.\nЭто — ты: и сад, и свет.\n— {ЛАСКОВО.им},\nНам тебя дороже нет!",
        scene: "evening at the carved wooden house by the river, the grandparent on the porch with the grandchildren snuggled close, the starling on the railing, the garden in bloom",
      },
    ],
    occasionHooks: {
      "den-babushek-i-dedushek": {
        opening: "Осень. Листья золотые.\nДни — особые, родные:\nДень, когда со всех сторон\n{Р:Дедушке|Бабушке} — поклон!",
        closing: "С праздником! Пусть сад цветёт,\nПусть скворец с утра поёт,\nПусть звенит весь дом от смеха —\nЭто лучшая утеха.",
        openingScene: "golden autumn leaves falling around the carved house",
        closingScene: "golden autumn leaves and a festive table on the porch",
      },
      yubilej: {
        opening: "Нынче праздник — юбилей!\nСказку слушай поскорей:",
        closing: "С юбилеем! Пир горой,\nИ весь мир — за нас с тобой!",
        openingScene: "festive garlands on the carved porch",
        closingScene: "a jubilee cake with garlands at the palace feast",
      },
      "den-rozhdeniya": {
        opening: "Нынче — день рожденья! Вот\nСказка в гости к нам идёт.",
        closing: "С днём рожденья! Много лет\nСаду — цвесть, а дому — свет!",
        openingScene: "a birthday pie with candles on the windowsill",
        closingScene: "a birthday pie with candles on the porch table",
      },
      default: {
        opening: "Нынче праздник у ворот:\n{ПОВОД}!\nСказка в гости к нам идёт.",
        closing: "С праздником! Пусть день твой светел,\nКак в саду весенний ветер!",
      },
    },
  },

  // ───────────────────────────── 6. Друг или коллега · Шуточный эпос ─────────────────────────────
  {
    slug: "bylina-o-bogatyre-otdela",
    audience: "ADULT",
    segments: ["adult-friend"],
    title: "Былина о богатыре отдела",
    tagline: "Квартальный Отчёт о трёх головах, Змей Совещанище и Принтер Окаянный — и один герой, который всех победил.",
    description:
      "Шуточная былина для коллеги, друга или начальника: офисные будни воспеты высоким слогом. Герой укрощает бесконечное совещание песочными часами, договаривается с капризным принтером и сдаёт отчёт ровно в шесть. В финале — тёплые слова от всей команды. Идеально на юбилей, повышение или проводы.",
    occasions: ["yubilej", "novaya-rabota", "den-rozhdeniya", "pensiya", "23-fevralya", "8-marta"],
    coreOccasions: ["novaya-rabota"],
    textStyle: "mock-epic",
    artStyles: ["ink-humor", "retro-poster", "graphic-novel", "risograph-zine"],
    theme: "office",
    heroKind: "adult",
    extras: { roles: ["colleague", "friend"], min: 0, max: 3, note: "Коллеги — «дружина» героя; имена можно не указывать" },
    interests: ["работа", "кофе", "порядок"],
    coverScene:
      "the hero riding an office chair like a noble steed down a corridor of a glass office tower, a laptop as a shield and a pen as a spear, a three-headed paper report monster in the background, epic comic mood",
    spreads: [
      {
        text: "Ой ты гой еси, народ честной! Расскажем мы былину — о том, как во славном во городе, во высокой башне стеклянной трудил{Р:ся|ась} {ГЕРОЙ.им} — {Р:богатырь|поляница} всего отдела. Силушки у {Р:него|неё} — на семерых, терпения — на двенадцать, а чувства юмора хватит на весь бизнес-центр.",
        scene: "a tall glass office tower in morning light, the hero standing in front of it like a legendary warrior, colleagues waving from the windows",
      },
      {
        text: "Да пришла беда неминучая: в пятницу, под самый вечер, выполз из-за горизонта Квартальный Отчёт о трёх головах. Одна голова цифры путает, другая сроки двигает, а третья требует всё «ещё вчера». Задрожали стены стеклянные, попрятались стажёры под столы, а кофемашина со страху выдала чай.",
        scene: "a giant three-headed monster made of papers and spreadsheets looming over an open-plan office, interns hiding under desks, a coffee machine pouring tea in panic",
      },
      {
        text: "Снаряжается {ГЕРОЙ.им} в поход: кольчуга — пиджак парадный, щит — ноутбук, копьё — ручка счастливая, та самая, что никому не даётся. А при {Р:нём|ней} — конь верный: кресло офисное на пяти колёсах, ретивое, по коридору быстрее ветра катится.",
        scene: "the hero putting on a smart jacket like armor, holding a laptop like a shield and a pen like a spear, an office chair waiting like a loyal horse",
      },
      {
        text: "Первым выходит навстречу Змей Совещанище Бесконечное. Длинен Змей, как очередь в столовую: на каждое слово у него десять слов, на каждый вопрос — новое совещание. Кто в него вошёл — тот до вечера не вышел.",
        scene: "a long serpent made of meeting chairs and sticky notes coiling around a conference room table, tired colleagues trapped inside, a wall clock spinning",
      },
      {
        text: "Не стал{Р:|а} {ГЕРОЙ.им} со Змеем биться. Поставил{Р:|а} на стол песочные часы да молвил{Р:|а}: «Десять минут — и по делу». Поперхнулся Змей своим хвостом, уложился в девять — и впервые за сто лет весь отдел ушёл на обед вовремя.",
        scene: "the hero calmly placing an hourglass on the conference table, the meeting serpent shrinking in surprise, colleagues cheering on their way to lunch",
      },
      {
        text: "Второе чудище — Принтер Окаянный, что стоит в углу на перекрёстке трёх коридоров. Жуёт он бумагу, мигает глазом красным и бормочет: «Замятие, замятие». Многие богатыри к нему подходили — никто с распечаткой не возвращался.",
        scene: "a grumpy old printer in a dim corridor corner with a blinking red light like an eye, crumpled paper around it, brave colleagues retreating",
      },
      {
        text: "А {ГЕРОЙ.им} {Р:подошёл|подошла} без страха, погладил{Р:|а} Принтер по крышке, лоток подровнял{Р:|а} да шепнул{Р:|а} слово заветное. Вздохнул Принтер, отдал всю бумагу, что за год нажевал, — и напечатал отчёт с первого раза. Говорят, до сих пор ждёт {Р:его|её} по утрам и тихо урчит.",
        scene: "the hero gently patting the printer, which now purrs and happily prints a neat stack of pages, a green light glowing",
      },
      {
        text: "Остался сам Квартальный Отчёт о трёх головах. Ревёт он: «Не сдадите меня до полуночи!» А на часах — без пяти шесть, и вся дружина уже косится на дверь.",
        scene: "the three-headed paper report monster roaring at the hero in the evening office, a clock showing five to six, colleagues glancing toward the exit",
      },
      {
        text: "Тут {ГЕРОЙ.им} засучил{Р:|а} рукава. Первой голове — таблицу с формулами, второй — сроки по полочкам, третьей — улыбку и чашку кофе. Растерялись головы, переглянулись да и сложились в одну аккуратную папку. Ровно в шесть Отчёт лежал где надо, а дружина шла домой — засветло!",
        scene: "the hero handing a spreadsheet, a calendar and a cup of coffee to the three heads, the monster folding into a neat folder, colleagues leaving in golden evening light",
      },
      {
        text: "И был пир на весь отдел! Торт принесли такой, что пришлось открывать вторую дверь переговорной. Чай лился рекой, пироги стояли горой, а бухгалтерия впервые за квартал смеялась вслух.",
        scene: "an office celebration with a huge cake squeezed through the conference room doors, tea and pies on the table, colleagues laughing together",
      },
      {
        text: "Пошла о {ГЕРОЙ.пр} слава по всем этажам. Гусляры в столовой поют, охрана на входе честь отдаёт, а лифт, говорят, сам приезжает, едва {Р:он|она} к нему подойдёт. И сложили про {Р:него|неё} поговорку: «С таким человеком — хоть в огонь, хоть на совещание».",
        scene: "the hero walking through the office lobby, a musician playing a psaltery near the cafeteria, the security guard saluting, elevator doors opening by themselves",
      },
      {
        text: "А если без былинного слога — {ЛАСКОВО.им}, с тобой работается легко, а живётся весело. Ты умеешь и дело сделать, и людей сберечь, и в самую трудную пятницу всех рассмешить. Спасибо тебе за это. Мы очень рады, что ты есть — в нашем отделе и в нашей жизни.",
        scene: "the whole team gathered around the hero in the office at sunset, giving a group hug and a handmade card, warm light through the glass walls",
      },
    ],
    occasionHooks: {
      yubilej: {
        opening: "Нынче у {ГЕРОЙ.род} юбилей — дата круглая, как щит богатырский, — а потому слушайте былину!",
        closing: "С юбилеем, {ЛАСКОВО.им}! Многая лета, лёгких отчётов и коротких совещаний!",
        openingScene: "festive garlands across the office ceiling",
        closingScene: "a jubilee cake and garlands in the office",
      },
      "novaya-rabota": {
        opening: "Нынче у {ГЕРОЙ.род} новый рубеж — высота новая, дела новые. А былины о таких людях надо слагать загодя.",
        closing: "С новой высотой, {ЛАСКОВО.им}! Новые Отчёты уже трепещут.",
        openingScene: "a new desk with a plant and a cup of coffee by the window",
        closingScene: "balloons tied to a new office chair",
      },
      pensiya: {
        opening: "Нынче {ГЕРОЙ.им} слагает доспехи рабочие — уходит на отдых заслуженный, к делам вольным и приятным. Но прежде — былина о том, как всё было.",
        closing: "Отдыхай, {ЛАСКОВО.им}, по-богатырски! А отдел будет помнить — и звать на пироги.",
        openingScene: "a suitcase and a travel map leaning against the office desk",
        closingScene: "a farewell party with flowers and a travel map",
      },
      "den-rozhdeniya": {
        opening: "Нынче у {ГЕРОЙ.род} день рождения — праздник великий, всеотдельский.",
        closing: "С днём рождения, {ЛАСКОВО.им}! Слава тебе — и торта побольше.",
        openingScene: "balloons tied to the hero's office chair",
        closingScene: "a birthday cake with candles on the conference table",
      },
      default: {
        opening: "Нынче повод славный — {ПОВОД}, — а значит, пора спеть былину о {ГЕРОЙ.пр}.",
        closing: "Пусть {ПОВОД} запомнится надолго, {ЛАСКОВО.им}, — как подвиги твои!",
      },
    },
  },

  // ───────────────────────────── 7. Друг или коллега · Комикс ─────────────────────────────
  {
    slug: "missiya-svoboda",
    audience: "ADULT",
    segments: ["adult-friend"],
    title: "Миссия: свобода",
    tagline: "Супергерой офиса уходит на пенсию — и открывает в себе новые суперсилы.",
    description:
      "Комикс для коллеги или друга, который уходит на заслуженный отдых. Последний день и передача суперсил, будильник, который никак не смирится, неспешный завтрак, кабачки по росту, танцы по вторникам и билет в одну сторону. Смешно до самого конца — а конец искренний.",
    occasions: ["pensiya", "yubilej", "den-rozhdeniya"],
    coreOccasions: ["pensiya"],
    textStyle: "comic-captions",
    artStyles: ["retro-poster", "ink-humor", "risograph-zine", "graphic-novel"],
    theme: "travel-map",
    heroKind: "adult",
    extras: { roles: ["colleague", "friend"], min: 0, max: 3, note: "Коллеги и друзья — «команда» в репликах" },
    interests: ["путешествия", "сад", "танцы", "рыбалка"],
    coverScene:
      "the hero in a superhero pose with a cardigan flying like a cape, a suitcase in one hand and a watering can in the other, a big travel map with dotted routes behind, retro comic cover",
    spreads: [
      {
        text: "[Много лет этот офис спал спокойно.]\n[Потому что на посту был{Р:|а} {ГЕРОЙ.им}.]\nКоманда: — Кто всё найдёт, починит и всех рассмешит?\n{ГЕРОЙ.им}: — Работа такая.",
        scene: "the hero in an office in a superhero pose, a cardigan fluttering like a cape, colleagues looking up admiringly, dynamic low angle",
      },
      {
        text: "[Но однажды пришло письмо с пометкой «Срочно».]\nДЗЫНЬ!\n{ГЕРОЙ.им}: — Новый отчёт? Новый дедлайн?\n[Нет. Приказ: отдыхать. Бессрочно.]\n(А так можно было?)",
        scene: "close-up of the hero at a desk reading a letter in total surprise, eyebrows raised, the screen glowing, comic speed lines",
      },
      {
        text: "[Последний день. Передача суперсил.]\n{ГЕРОЙ.им}: — Степлер — направо. Чайник — налево. Пароль от всего — на обороте календаря.\nКоманда: — Мы справимся!\n[Пауза.]\nКоманда: — …Наверное.",
        scene: "the hero ceremonially handing a stapler to a nervous colleague, a desk calendar on the table, the team standing at attention",
      },
      {
        text: "[Утро первой свободы. 7:00.]\nДЗЫНЬ!\n{ГЕРОЙ.им}: — Будильник, ты тоже на пенсии. Отбой.\n(Будильник думает: это мы ещё посмотрим.)",
        scene: "a sunny bedroom at seven in the morning, the hero sleepily pointing at a ringing alarm clock, the alarm clock looking stubborn",
      },
      {
        text: "[Открыта суперсила № 1: неспешный завтрак.]\n{ГЕРОЙ.им}: — Оказывается, чай можно пить горячим. И сидя.\nПШШШ!\n[Чайник в шоке. Город тоже.]",
        scene: "the hero relaxing at a breakfast table with a steaming cup of tea and a newspaper, a kettle with a shocked face, the city skyline in the window",
      },
      {
        text: "[Суперсила № 2: свой сад.]\n{ГЕРОЙ.им}: — Кабачки, становись! По росту!\nКабачки: — …\n[Кабачки построились. Попробуй тут не построиться.]",
        scene: "the hero in a garden hat commanding a row of zucchini lined up from small to big like soldiers, a watering can in hand",
      },
      {
        text: "[Суперсила № 3: учиться новому.]\n{ГЕРОЙ.им}: — В понедельник — танцы. Во вторник — испанский. В среду — гитара.\n(Где вы были, свободные вторники, всю мою жизнь?)",
        scene: "a split panel of the hero dancing, studying with a phrasebook and playing a guitar, a calendar full of happy stickers",
      },
      {
        text: "[Суперсила № 4: дорога.]\nВЖУХ!\n{ГЕРОЙ.им}: — Билет туда. Обратный? Решу на месте.\n[Чемодан собран за рекордные четыре минуты.]",
        scene: "the hero zipping a suitcase in a blur of motion, a big travel map with a dotted route on the wall, a ticket sticking out of a pocket",
      },
      {
        text: "[Тем временем будильник не сдавался.]\nДЗЫНЬ! ДЗЫНЬ! ДЗЫНЬ!\n{ГЕРОЙ.им}: — Ладно. Будешь звонить, когда пора к друзьям.\nБудильник: — Дзынь! (Счастлив.)",
        scene: "the hero holding the alarm clock at eye level negotiating with it, the alarm clock beaming with joy, a calendar with friends' meetings circled",
      },
      {
        text: "[Пятница. 17:58. В офисе — паника.]\nКоманда: — Спасай! Пароль от всего пропал!\n{ГЕРОЙ.им}: — Обратная сторона календаря. Как всегда.\n[Офис спасён одним звонком. Прямо из гамака.]",
        scene: "the hero lying in a hammock between garden trees answering a phone call, a small inset panel of the panicked office team flipping a desk calendar",
      },
      {
        text: "[Вечер. Двор. Вся команда в сборе.]\nБАХ! (Это хлопушка.)\nКоманда: — За героя свободного времени! Чай горячий, торт огромный!\n{ГЕРОЙ.им}: — Я думал{Р:|а}, супергерои не уходят на пенсию.\nКоманда: — Они просто меняют костюм.",
        scene: "a cheerful evening party in a courtyard, confetti from a party popper, the team raising cups of tea around a huge cake, the hero in a garden hat instead of a cape",
      },
      {
        text: "[А теперь — без шуток.]\n[{ЛАСКОВО.им}, с тобой было надёжно, весело и тепло. Спасибо за все годы рядом.]\n[Теперь время — твоё. Ты {Р:его заслужил|его заслужила}.]\nДЗЫНЬ! (Будильник: — Это я напоминаю: мы тебя любим.)",
        scene: "the hero at sunset on a porch with a suitcase and a watering can nearby, the team waving goodbye, the alarm clock on the railing glowing warmly",
      },
    ],
    occasionHooks: {
      pensiya: { opening: "", closing: "" },
      yubilej: {
        opening: "[Особый выпуск. Сегодня у {ГЕРОЙ.род} юбилей.]",
        closing: "[С юбилеем, {ЛАСКОВО.им}! Новые суперсилы — в комплекте.]",
        openingScene: "jubilee garlands across the comic panel",
        closingScene: "a jubilee cake with garlands",
      },
      "den-rozhdeniya": {
        opening: "[Особый выпуск. Сегодня у {ГЕРОЙ.род} день рождения.]",
        closing: "[С днём рождения, {ЛАСКОВО.им}! Следующая серия — ещё интереснее.]",
        openingScene: "balloons in the corner of the panel",
        closingScene: "a birthday cake with candles",
      },
      default: {
        opening: "[Особый выпуск. Повод — {ПОВОД}.]",
        closing: "[С праздником, {ЛАСКОВО.им}! Пусть {ПОВОД} откроет ещё одну суперсилу.]",
      },
    },
  },
];

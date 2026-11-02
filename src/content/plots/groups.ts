// Сюжеты про группу: выпускной в детском саду, первый класс, выпускной в школе.
// В каждом по имени звучат все дети группы (plot.group): слоты {ДРУГ1..14} в блоках [[?ДРУГn: … || иначе]],
// формы {РДn:мальчик|девочка|несколько детей}, взрослые {ВОСПИТАТЕЛЬn} в блоках [[?ВОСПИТАТЕЛЬn: … || без взрослых]],
// ведомость «Наш класс» — {ПЕРЕКЛИЧКА} (разворот 11). Сцены — {GROUP} / {GROUP_ADULTS} (applyGroupScenes).
// Правила — docs/content/ARCHITECTURE.md, раздел «Группа».
//
// Размер группы (вместе с героем): детский сад — до 30 (старшие и подготовительные группы в России обычно
// 20–30 детей), класс — до 40. Детей больше, чем слотов (14), — слот называет нескольких подряд
// («Ваня, Петя и Оля построили…»); никто не назван дважды, пока не прозвучали все.

import type { Plot } from "../types";

const KINDERGARTEN_GROUP = {
  min: 1,
  max: 30,
  label: "группа",
  includeAdults: { roles: ["воспитатель", "помощник воспитателя"], max: 3 },
  note: "Впишите ребят из группы (до 29 имён, без героя) и воспитателей — каждый появится в книге по имени",
} satisfies Plot["group"];

export const KIDS_GROUP_PLOTS: Plot[] = [
  // ───────────────── Выпускной в саду · тёплая проза ─────────────────
  {
    slug: "poslednij-den-v-nashej-gruppe",
    audience: "CHILD",
    segments: ["kids-5-7"],
    title: "Последний день в нашей группе",
    tagline: "Записка на шкафчике, тайник под старой берёзой и подарок для малышей — от всей группы.",
    description:
      "За несколько дней до выпускного ваш ребёнок находит на своём шкафчике загадочный конверт. Вместе со всей группой он ищет подсказки — в спальне на тихом часе, в музыкальном зале, на прогулочном участке — и находит тайник, который оставили прошлые выпускники. А потом ребята решают оставить свой подарок тем, кто придёт в группу после них. Книга называет по имени каждого ребёнка группы (до 30 человек) и воспитателей, а на общей фотографии подписаны все.",
    ageMin: 5,
    ageMax: 7,
    occasions: ["vypusknoj-v-sadu"],
    coreOccasions: ["vypusknoj-v-sadu"],
    textStyle: "cozy-adventure",
    artStyles: ["kind-classic", "cozy-detail", "watercolor-air"],
    theme: "meadow",
    heroKind: "child",
    extras: { roles: ["toy", "sibling"], min: 0, max: 1, note: "Друзья из группы — в отдельном списке «Наша группа»" },
    group: KINDERGARTEN_GROUP,
    interests: ["рисование", "музыка", "животные"],
    coverScene: "the child and a whole group of kindergarten children under an old birch tree on a sunny kindergarten playground, opening an old tin box together, balloons tied to a small wooden veranda",
    spreads: [
      {
        text: "В тот майский день {ГЕРОЙ.им} {Р:пришёл|пришла} в детский сад {Р:самым первым|самой первой}. Раздевалка была пустая и тихая. А на шкафчике {ГЕРОЙ.род}, прямо под картинкой, белел конверт. На нём кто-то вывел крупными буквами: «Тем, кто вырос. Ищите там, где спят, где поют и где гуляют».",
        scene: "the child alone in a quiet kindergarten cloakroom in the morning, rows of small wooden lockers with picture stickers on the doors, a white envelope taped to one locker",
      },
      {
        text: "Скоро раздевалка наполнилась голосами — пришла вся группа. [[?ДРУГ1:{ДРУГ1.им} {РД1:прочитал|прочитала|прочитали} записку вслух — по слогам, зато без единой ошибки. || Записку прочитали вслух — по слогам, зато без единой ошибки.]] [[?ДРУГ2:— Где спят — это же спальня! — {РД2:догадался|догадалась|догадались} {ДРУГ2.им}. || — Где спят — это же спальня! — догадал{Р:ся|ась} {ГЕРОЙ.им}.]] Значит, искать нужно на тихом часе.",
        scene: "{GROUP} crowding around the child in the kindergarten cloakroom, everyone looking at an open envelope with a note, morning light",
      },
      {
        text: "Наступил тихий час. Никто, конечно, не спал по-настоящему: все ждали. [[?ДРУГ3:{ДРУГ3.им} {РД3:считал|считала|считали} овечек и {РД3:досчитал|досчитала|досчитали} до тысячи.]] [[?ДРУГ4:А {ДРУГ4.им} {РД4:заметил|заметила|заметили}, что одна кроватка у окна скрипит не так, как все. || А {ГЕРОЙ.им} заметил{Р:|а}, что одна кроватка у окна скрипит не так, как все.]] Под ней, у самой стены, нашлись ключик на синей ленточке и вторая записка: «Где поют».",
        scene: "a cozy kindergarten nap room with rows of small beds and striped blankets, {GROUP} peeking from under the blankets, the child kneeling by a bed near the window finding a small key on a blue ribbon",
      },
      {
        text: "После полдника все пошли в музыкальный зал — репетировать песню к выпускному. [[?ДРУГ5:{ДРУГ5.им} {РД5:пел|пела|пели} громче всех — даже люстра звенела в такт.]] [[?ДРУГ6:А {ДРУГ6.им} так ловко {РД6:стучал|стучала|стучали} в бубен, что все пустились в пляс.]] Когда песня кончилась, {ГЕРОЙ.им} заглянул{Р:|а} внутрь старого барабана. Там лежала третья записка: «Где гуляют. Под самым старым деревом».",
        scene: "a bright kindergarten music hall with a piano and a chandelier, {GROUP} singing and playing tambourines, the child peeking into an old big drum",
      },
      {
        text: "На прогулке группа побежала на свой участок — к веранде, песочнице и старой берёзе. [[?ДРУГ7:{ДРУГ7.им} {РД7:принёс|принесла|принесли} лопатки из песочницы.]] [[?ДРУГ8:{ДРУГ8.им} {РД8:нашёл|нашла|нашли} под берёзой камень с нарисованной звездой. || Под берёзой нашёлся камень с нарисованной звездой.]] Копали по очереди и осторожно, как настоящие археологи.",
        scene: "a kindergarten playground on a sunny May day with a small wooden veranda, a sandbox and an old birch tree, {GROUP} digging carefully with toy shovels under the birch, the child holding a stone with a painted star",
      },
      {
        text: "Лопатка стукнула обо что-то железное. Коробка из-под печенья! В ней лежали рисунки, засушенный кленовый лист и письмо: «Мы тоже были этой группой. Мы выросли и пошли в школу. Теперь ваша очередь оставить что-нибудь хорошее тем, кто придёт после вас». [[?ДРУГ9:{ДРУГ9.им} только {РД9:ахнул|ахнула|ахнули}: вот это клад!]]",
        scene: "{GROUP} gathered around an old tin cookie box opened under the birch tree, inside are children's drawings, a dried maple leaf and a letter, the child reading the letter",
      },
      {
        text: "— А что оставим мы? — спросил{Р:|а} {ГЕРОЙ.им}. [[?ВОСПИТАТЕЛЬ1:{ВОСПИТАТЕЛЬ.им} улыбнул{РВ:ся|ась}: «Подумайте, что вы умеете лучше всего». || Воспитательница улыбнулась: «Подумайте, что вы умеете лучше всего».]] [[?ДРУГ10:{ДРУГ10.им} {РД10:предложил|предложила|предложили} нарисовать самые лучшие рисунки.]] И ребята решили: каждый положит в коробку то, что сделает сам.",
        scene: "the child asking a question, {GROUP_ADULTS} smiling and listening, {GROUP} sitting in a circle on the playground",
      },
      {
        text: "До самого вечера в группе кипела работа. [[?ДРУГ11:{ДРУГ11.им} {РД11:нарисовал|нарисовала|нарисовали} радугу во весь лист.]] [[?ДРУГ12:{ДРУГ12.им} {РД12:слепил|слепила|слепили} из пластилина ёжика, а потом ещё одного — про запас.]] А {ГЕРОЙ.им} написал{Р:|а} письмо — печатными буквами, немножко вкривь, зато от всего сердца: «Не бойтесь. Здесь хорошо».",
        scene: "a busy kindergarten group room in the afternoon, {GROUP} drawing rainbows and modeling plasticine hedgehogs at small tables, the child writing a letter in big block letters",
      },
      {
        text: "Коробку снова закопали под берёзой — уже с новыми сокровищами. [[?ДРУГ13:{ДРУГ13.им} {РД13:утоптал|утоптала|утоптали} землю, чтобы никто не нашёл раньше времени.]] [[?ДРУГ14:А {ДРУГ14.им} {РД14:воткнул|воткнула|воткнули} рядом веточку — вместо флажка.]] Все переглянулись: теперь у группы есть своя тайна.",
        scene: "{GROUP} burying the tin box under the birch tree again, soil being pressed down, a small twig stuck in the ground like a flag, warm evening light",
      },
      {
        text: "Вечером за ребятами приходили мамы, папы и бабушки. {ГЕРОЙ.им} в последний раз {Р:открыл|открыла} свой шкафчик и погладил{Р:|а} картинку ладошкой. [[?ВОСПИТАТЕЛЬ1:{ВОСПИТАТЕЛЬ.им} {РВ:обнимал|обнимала} каждого на прощание. || Воспитательница обнимала каждого на прощание.]] Скоро здесь появится чья-то новая картинка — и кто-то маленький найдёт под берёзой коробку.",
        scene: "evening in the kindergarten cloakroom, parents arriving, the child touching the picture sticker on a small locker door, {GROUP_ADULTS} hugging children goodbye",
      },
      {
        text: "[[?ГРУППА:А на память осталась фотография. На ней — вся наша группа, все до одного: {ПЕРЕКЛИЧКА}. || А на память осталась фотография: {ГЕРОЙ.им} и {Р:его|её} друзья из группы — все до одного.]] [[?ВОСПИТАТЕЛЬ1:И, конечно, {ВОСПИТАТЕЛИ.им} — рядом с нами.]]",
        scene: "a group photo: {GROUP} standing in rows on the kindergarten steps with balloons, the child in the very middle of the front row, {GROUP_ADULTS} at the sides, everyone smiling",
      },
      {
        text: "На выпускном группа пела ту самую песню, а {ГЕРОЙ.им} знал{Р:|а} секрет: под старой берёзой спит коробка, полная хорошего. Детский сад остаётся тем, кто придёт следом. А {ГЕРОЙ.им} теперь {Р:большой|большая}, и впереди — школа. До свидания, наша группа!",
        scene: "the kindergarten graduation party in the music hall with balloons and ribbons, {GROUP} singing together, the child smiling and glancing out of the window at the birch tree",
      },
    ],
    occasionHooks: {
      "vypusknoj-v-sadu": { opening: "", closing: "" },
      default: { opening: "Это случилось накануне особенного дня: совсем скоро — {ПОВОД}.", closing: "А этот день — {ПОВОД} — группа запомнит надолго." },
    },
  },

  // ───────────────── Выпускной в саду · весёлые стихи ─────────────────
  {
    slug: "my-vyrosli",
    audience: "CHILD",
    segments: ["kids-5-7"],
    title: "Мы выросли!",
    tagline: "Весёлая перекличка всей группы: кто что умеет — и кто вырос выше всех.",
    description:
      "Звонкие смешные стихи к выпускному в детском саду. Шкафчики, тихий час, утренник в музыкальном зале, прогулка на участке — и загадки-перекличка: «Кто шнурки завяжет сам и поможет малышам?» Ответ каждый раз — имя кого-то из группы. Каждый ребёнок (до 30 человек) получает свою строчку, воспитатели — своё «спасибо», а в конце — общая фотография со всеми именами.",
    ageMin: 5,
    ageMax: 7,
    occasions: ["vypusknoj-v-sadu"],
    coreOccasions: ["vypusknoj-v-sadu"],
    textStyle: "funny-verse",
    artStyles: ["ink-humor", "kind-classic", "watercolor-air"],
    theme: "meadow",
    heroKind: "child",
    extras: { roles: ["toy", "sibling"], min: 0, max: 1, note: "Друзья из группы — в отдельном списке «Наша группа»" },
    group: KINDERGARTEN_GROUP,
    interests: ["игры", "музыка", "спорт"],
    coverScene: "the child standing on tiptoe next to a small kindergarten locker that is now too small, a whole group of kindergarten children laughing and jumping around, balloons and a festive ribbon",
    spreads: [
      {
        text: "Утром в садик — топ-топ-топ!\nВырос кто-то прямо — хлоп!\nВ шкафчик больше не влезает,\nЛампу носом задевает!\nКто же это? Угадай-ка!\n— {ГЕРОЙ.им}!\nА за {Р:ним|ней} — вся наша стайка!",
        scene: "the child in a kindergarten cloakroom comically too tall for a tiny locker, nose touching a lamp, {GROUP} peeking from behind, morning light",
      },
      {
        text: "Раньше мама одевала,\nЛожкой кашу подавала.\nА теперь? Ну-ка, угадай:\nВсё мы сами! Проверяй!\n[[?ДРУГ1:Кто шнурки завяжет сам\nИ поможет малышам?\n— {ДРУГ1.им}!]]\n[[?ДРУГ2:Кто тарелку каши — хвать! —\nИ давай добавки ждать?\n— {ДРУГ2.им}!]]",
        scene: "{GROUP} in the kindergarten cloakroom proudly tying their own shoelaces, then at small tables eating porridge and holding out bowls for more, the child laughing",
      },
      {
        text: "Тихий час. Подушки в ряд.\nВсе лежат и все сопят.\nА проснулись — вот те раз! —\nВыросли за тихий час!\n[[?ДРУГ3:Кто на тихом часе спит\nИ во сне стихи твердит?\n— {ДРУГ3.им}!]]\n[[?ДРУГ4:Кто рисует, как художник, —\nДаже солнце, даже дождик?\n— {ДРУГ4.им}!]]",
        scene: "a kindergarten nap room with pillows in a row, {GROUP} waking up and stretching comically taller, drawings of the sun and rain pinned to the wall",
      },
      {
        text: "В зале музыка играет,\nНа утренник приглашает.\nКто танцует, кто поёт,\nКто в ладоши громко бьёт!\n[[?ДРУГ5:Кто на утреннике пел\nТак, что зал весь онемел?\n— {ДРУГ5.им}!]]\n[[?ДРУГ6:Кто зарядку делал так,\nЧто запрыгал даже шкаф?\n— {ДРУГ6.им}!]]",
        scene: "a kindergarten music hall with a piano, {GROUP} singing, dancing and clapping, a cupboard comically hopping along with the morning exercises",
      },
      {
        text: "На прогулку — всей гурьбой,\nНа участок, на родной!\nТам веранда, там качели,\nТам вороны прилетели.\n[[?ДРУГ7:Кто по горке — вжух! — летит\nИ от счастья всё кричит?\n— {ДРУГ7.им}!]]\n[[?ДРУГ8:Кто построит из песка\nБашню выше потолка?\n— {ДРУГ8.им}!]]",
        scene: "a kindergarten playground with a wooden veranda, swings, a slide and a sandbox, {GROUP} sliding down and building a towering sandcastle, curious crows on the fence",
      },
      {
        text: "В группе дел — невпроворот:\nКто-то клеит, кто-то шьёт,\nКто-то лепит пирожок,\nКто-то строит теремок.\n[[?ДРУГ9:Кто цветы на подоконнике\nПоливает, как садовники?\n— {ДРУГ9.им}!]]\n[[?ДРУГ10:Кто считает до ста раз —\nИ обратно, в тот же час?\n— {ДРУГ10.им}!]]",
        scene: "a busy kindergarten group room, {GROUP} gluing, sewing, modeling plasticine and building a block tower, watering flowers on the windowsill, counting on fingers",
      },
      {
        text: "Вечер. Скоро по домам.\nНо порядок — тут и там!\nМишки — в ряд, машинки — в ряд,\nКубики в коробке спят.\n[[?ДРУГ11:Кто игрушки соберёт\nБыстро-быстро, в свой черёд?\n— {ДРУГ11.им}!]]\n[[?ДРУГ12:Кто так шутит, что до слёз\nХохотал весь наш завхоз?\n— {ДРУГ12.им}!]]",
        scene: "a kindergarten group room in the evening, {GROUP} tidying toys into neat rows, teddy bears and toy cars lined up, a kindly caretaker laughing in the doorway",
      },
      {
        text: "Скоро в школу — вот дела!\nДаже кошка поняла:\nВыросли мы, подросли —\nЧуть до неба не дошли!\n[[?ДРУГ13:Кто читает по слогам\nВсем-всем книжки по утрам?\n— {ДРУГ13.им}!]]\n[[?ДРУГ14:Кто обнимет крепче всех —\nТак, что слышен общий смех?\n— {ДРУГ14.им}!]]",
        scene: "{GROUP} standing on tiptoe reaching up to the clouds outside the kindergarten, a surprised cat on the fence, one child reading a picture book aloud, a big group hug",
      },
      {
        text: "Кто нам песни пел и сказки,\nКто в тарелку клал добавки,\nКто нам вытирал носы —\nЗнаем все, конечно, мы:\n[[?ВОСПИТАТЕЛЬ1:— {ВОСПИТАТЕЛЬ1.им}!]]\n[[?ВОСПИТАТЕЛЬ2:— {ВОСПИТАТЕЛЬ2.им}!]]\n[[?ВОСПИТАТЕЛЬ3:— {ВОСПИТАТЕЛЬ3.им}!]]\n[[?ВОСПИТАТЕЛИ: || — Наши воспитатели!]]\nВам — спасибо в сто сердец!\nВам — букет и леденец!",
        scene: "{GROUP} giving flowers and candy to {GROUP_ADULTS} in the kindergarten music hall, hearts drawn on a big card, warm light",
      },
      {
        text: "Кто же вырос всех сильней —\nВыше сосен, тополей?\n— {ГЕРОЙ.им}!\nДа и все мы — посмотри:\nВыросли! Раз-два-три!",
        scene: "the child and {GROUP} standing on tiptoe in a row on the playground comparing heights with tall pines and poplars, a growth chart painted on the fence",
      },
      {
        text: "Встали дружно — в три ряда.\nУлыбнулись: «Чи-и-из!» — да!\n[[?ГРУППА:Это мы — смотрите, вот —\nНаш весёлый, наш народ:\n{ПЕРЕКЛИЧКА} || Это мы — смотрите, вот —\nНаш весёлый, наш народ!]]",
        scene: "a kindergarten group photo: {GROUP} standing in three rows on the steps saying cheese, the child in the very middle of the front row, {GROUP_ADULTS} at the sides, balloons",
      },
      {
        text: "До свиданья, детский сад!\nМы теперь — большой отряд.\nНо тебя мы не забудем:\nНавещать тебя мы будем!\nА пока — ура! Вперёд!\nШкола, жди: идёт народ!",
        scene: "the kindergarten graduation party with balloons and ribbons, {GROUP} marching out of the kindergarten gate waving goodbye, a school building on the horizon",
      },
    ],
    occasionHooks: {
      "vypusknoj-v-sadu": { opening: "", closing: "" },
      default: { opening: "Нынче праздник — вот какой:\n{ПОВОД}!\nЗапевай, народ, со мной!", closing: "Праздник! Значит — пой, пляши,\nВеселись от всей души!" },
    },
  },

  // ───────────────── Выпускной в саду · народная сказка ─────────────────
  {
    slug: "volshebnyj-shkafchik",
    audience: "CHILD",
    segments: ["kids-5-7"],
    title: "Волшебный шкафчик",
    tagline: "Дверца шкафчика с картинкой открывает дорогу в Страну Школу — для всей группы.",
    description:
      "Сказка о том, как однажды вечером шкафчик в раздевалке распахнулся сам собой — а за ним вместо курток засветилась дорожка в Страну Школу. Вся группа отправляется в путь: переплыть Сонную реку тихо, как на тихом часе, спеть Горе-Молчунье песню с утренника, распутать Лес Перепутанных Шнурков. Помогает старый Портфель, а встречает Королева Первого Звонка. Каждый ребёнок группы (до 30 человек) делает в сказке своё дело и назван по имени.",
    ageMin: 5,
    ageMax: 7,
    occasions: ["vypusknoj-v-sadu"],
    coreOccasions: ["vypusknoj-v-sadu"],
    textStyle: "folk-tale-prose",
    artStyles: ["folk-lubok", "kind-classic", "cozy-detail"],
    theme: "school",
    heroKind: "child",
    extras: { roles: ["toy", "sibling"], min: 0, max: 1, note: "Друзья из группы — в отдельном списке «Наша группа»" },
    group: KINDERGARTEN_GROUP,
    interests: ["принцессы", "рисование", "животные"],
    coverScene: "a small kindergarten locker with a picture sticker swinging open, a glowing path leading into a fairy-tale Land of School with pencil-case houses, the child and a whole group of kindergarten children stepping onto the path",
    spreads: [
      {
        text: "В некотором городе, в детском саду за зелёным забором, в группе с весёлыми шкафчиками {Р:жил-был|жила-была} {ГЕРОЙ.им}. На {Р:его|её} шкафчике была картинка — и однажды вечером, когда все уже одевались домой, картинка вдруг подмигнула. Дверца скрипнула и сама собой распахнулась, а за ней, вместо курток и сменных тапочек, засветилась дорожка.",
        scene: "a kindergarten cloakroom in the evening, a small wooden locker with a picture sticker glowing, its door open and a shining path leading inside instead of coats",
      },
      {
        text: "— Что там? — зашептались ребята и сгрудились у шкафчика. [[?ДРУГ1:{ДРУГ1.им} {РД1:заглянул|заглянула|заглянули} внутрь и {РД1:ахнул|ахнула|ахнули}: «Там целая страна!»]] [[?ДРУГ2:{ДРУГ2.им} {РД2:взял|взяла|взяли} {ГЕРОЙ.вин} за руку: «Вместе не страшно».]] Над дорожкой висела табличка: «В Страну Школу. Пройдёт тот, кто вырос».",
        scene: "{GROUP} crowding around the glowing open locker, peeking in with wide eyes, a wooden sign above a shining path",
      },
      {
        text: "Долго ли, коротко ли шли ребята по дорожке — пришли к Сонной реке. Моста нет, только лодочка-кроватка покачивается у берега, а на корме дремлет Сова-Тихоня: «Перевезу того, кто умеет лежать тихо, как на тихом часе». [[?ДРУГ3:{ДРУГ3.им} {РД3:улёгся|улеглась|улеглись} в лодочку и даже не {РД3:шелохнулся|шелохнулась|шелохнулись}.]] [[?ДРУГ4:А {ДРУГ4.им} так сладко {РД4:зевнул|зевнула|зевнули}, что Сова сама задремала.]] Так все и переплыли — тихо-тихо, как мышки.",
        scene: "a calm sleepy river at dusk, a little boat shaped like a bed with a striped blanket, a sleepy owl on the stern, {GROUP} lying quietly in the boat, the child at the front",
      },
      {
        text: "На другом берегу стояла Гора-Молчунья. Давно на ней никто не пел, оттого и тропинка заросла. «Спойте мне, — гудит гора, — тогда пропущу». [[?ДРУГ5:{ДРУГ5.им} {РД5:запел|запела|запели} песню с утренника.]] [[?ДРУГ6:{ДРУГ6.им} {РД6:подхватил|подхватила|подхватили} — да так звонко, что по склонам распустились колокольчики.]] Подпели все, и {ГЕРОЙ.им} — громче всех. Гора заулыбалась и сама разложила под ногами ступеньки.",
        scene: "a big friendly mountain with a sleepy face, {GROUP} singing loudly at its foot, bluebells blooming along a path of stone steps, the child singing in front",
      },
      {
        text: "На вершине ждал старый Портфель с медными застёжками. — Я провожу вас в Страну Школу, — проскрипел он. — Только в пути пригодится всё, чему вы научились в саду. [[?ДРУГ7:{ДРУГ7.им} {РД7:показал|показала|показали}, как ловко {РД7:умеет|умеет|умеют} застёгивать пуговицы. || Ребята показали, как ловко умеют застёгивать пуговицы и считать до двадцати.]] [[?ДРУГ8:{ДРУГ8.им} {РД8:сосчитал|сосчитала|сосчитали} до двадцати и обратно.]] Портфель одобрительно щёлкнул застёжкой: «Годится!»",
        scene: "an old talking leather school satchel with brass clasps on a hilltop, {GROUP} showing it how they button coats and count on fingers, the child laughing",
      },
      {
        text: "Третье испытание ждало в Лесу Перепутанных Шнурков: ветки там переплелись, как шнурки у малыша. [[?ДРУГ9:{ДРУГ9.им} {РД9:развязал|развязала|развязали} первый узел.]] [[?ДРУГ10:{ДРУГ10.им} {РД10:завязал|завязала|завязали} ветку бантиком — для красоты.]] А {ГЕРОЙ.им} догадал{Р:ся|ась}: распутывать надо по одному узелку, не торопясь. Так и сделали — и лес расступился.",
        scene: "a whimsical forest where branches are tangled like shoelaces, {GROUP} patiently untangling knots and tying bows, the child pointing at the next knot",
      },
      {
        text: "За лесом показалась Страна Школа. Домики там были похожи на пеналы, дорожки — на линейки, а над крышами летали бумажные самолётики. Буквы гуляли по улицам парами, цифры играли в классики. [[?ДРУГ11:{ДРУГ11.им} {РД11:поймал|поймала|поймали} букву «А» — она оказалась щекотной.]] [[?ДРУГ12:{ДРУГ12.им} {РД12:сыграл|сыграла|сыграли} с цифрой Семь в классики и {РД12:выиграл|выиграла|выиграли}.]]",
        scene: "a cheerful Land of School with houses shaped like pencil cases, streets like rulers, paper planes over rooftops, letters and numbers walking around like little people, {GROUP} playing hopscotch with a number seven",
      },
      {
        text: "В самом большом доме, похожем на раскрытую книгу, жила Королева Первого Звонка. Она звякнула серебряным колокольчиком: — Вы прошли все испытания, значит, выросли. Осенью двери моей страны откроются для вас по-настоящему. [[?ДРУГ13:{ДРУГ13.им} {РД13:спросил|спросила|спросили}: «А там не страшно?» || — А там не страшно? — спросил{Р:|а} {ГЕРОЙ.им}.]] Королева улыбнулась: «Страшно бывает только до первого урока. А потом — интересно».",
        scene: "a kind queen in a dress patterned with letters standing in a house shaped like an open book, ringing a small silver bell, {GROUP} listening, the child in front",
      },
      {
        text: "На прощание каждый получил подарок — цветной карандаш, который никогда не ломается. [[?ДРУГ14:{ДРУГ14.им} тут же {РД14:нарисовал|нарисовала|нарисовали} солнце прямо в воздухе — и оно засияло.]] А {ГЕРОЙ.дат} Королева дала ещё и ключик: «Это от твоего шкафчика. Пусть он помнит дорогу».",
        scene: "the queen handing out colorful pencils to {GROUP}, a sun drawn in the air glowing, the child receiving a tiny golden key",
      },
      {
        text: "Портфель довёл ребят обратно до шкафчика — тем же путём, только короче, как всегда бывает дорога домой. Дверца тихо закрылась. [[?ВОСПИТАТЕЛЬ1:В раздевалку заглянул{РВ:|а} {ВОСПИТАТЕЛЬ.им}: «Ребята, за вами пришли!» || В раздевалку заглянула воспитательница: «Ребята, за вами пришли!»]] [[?ВОСПИТАТЕЛЬ2:{ВОСПИТАТЕЛЬ2.им} {РВ2:помог|помогла} застегнуть куртки и подмигнул{РВ2:|а}: «Что-то у вас глаза сияют».]] [[?ВОСПИТАТЕЛЬ3:А {ВОСПИТАТЕЛЬ3.им} {РВ3:раздал|раздала} всем забытые варежки.]] Никто ничего не сказал — только переглянулись: это их общая тайна.",
        scene: "the kindergarten cloakroom in the evening again, the locker door closing softly, {GROUP_ADULTS} peeking in the doorway, {GROUP} exchanging secret smiles",
      },
      {
        text: "[[?ГРУППА:А на выпускном вся группа встала для общей фотографии — те самые путешественники в Страну Школу: {ПЕРЕКЛИЧКА}. || А на выпускном {ГЕРОЙ.им} и {Р:его|её} друзья — те самые путешественники в Страну Школу — встали для общей фотографии.]] И у каждого в кармане был карандаш, который никогда не ломается.",
        scene: "a kindergarten graduation group photo: {GROUP} standing in rows with balloons and ribbons, the child in the very middle of the front row, each child holding a colorful pencil",
      },
      {
        text: "Вот и сказке конец. Осенью {ГЕРОЙ.им} {Р:пошёл|пошла} в Страну Школу по-настоящему — с новым портфелем и с тем самым ключиком на шнурке. А шкафчик с картинкой остался ждать нового малыша. Говорят, иногда он подмигивает — тем, кто готов вырасти.",
        scene: "an autumn morning, the child with a new school satchel and a tiny key on a string walking toward a school, a small locker with a picture sticker visible through a kindergarten window behind",
      },
    ],
    occasionHooks: {
      "vypusknoj-v-sadu": { opening: "", closing: "" },
      default: { opening: "Случилось это в особенный день — {ПОВОД}.", closing: "А тот день — {ПОВОД} — в группе вспоминают до сих пор." },
    },
  },

  // ───────────────── Первый класс · уютное приключение ─────────────────
  {
    slug: "nash-pervyj-klass",
    audience: "CHILD",
    segments: ["kids-5-7"],
    title: "Наш первый класс",
    tagline: "У школьного колокольчика пропал голос — и только первый класс может его вернуть.",
    description:
      "Первое сентября, линейка — а колокольчик молчит: он стесняется новеньких. Ваш ребёнок и весь его новый класс показывают колокольчику школу — класс, библиотеку, спортзал с эхом, столовую с булочками, — и он звенит так, что с деревьев слетают листья. В книге по имени звучит каждый одноклассник (до 40 человек) и учитель, а в конце — фотография класса со всеми именами.",
    ageMin: 5,
    ageMax: 7,
    occasions: ["pervyj-klass"],
    coreOccasions: ["pervyj-klass"],
    textStyle: "cozy-adventure",
    artStyles: ["cozy-detail", "kind-classic", "ink-humor"],
    theme: "school",
    heroKind: "child",
    extras: { roles: ["sibling", "toy"], min: 0, max: 1, note: "Одноклассники — в отдельном списке «Наш класс»" },
    group: {
      min: 1,
      max: 40,
      label: "класс",
      includeAdults: { roles: ["учитель"], max: 2 },
      note: "Впишите одноклассников (до 39 имён, без героя) и учителя — каждый появится в книге по имени",
    },
    interests: ["музыка", "спорт", "рисование"],
    coverScene: "the child holding a shy brass school bell with a ribbon in front of a festive school on September 1st, a whole group of classmates with big bouquets around, autumn leaves and balloons",
    spreads: [
      {
        text: "Первого сентября {ГЕРОЙ.им} {Р:шёл|шла} в школу с букетом почти в свой рост. Новый рюкзак, новые ботинки, новые слова: «урок», «перемена», «{Р:первоклассник|первоклассница}». Сердце стучало: тук-тук — как будто тоже собиралось учиться.",
        scene: "the child walking to school on September 1st holding a huge bouquet of autumn flowers almost as tall as them, a new backpack, a school building with balloons ahead",
      },
      {
        text: "На школьном дворе стояли такие же нарядные ребята — это был {Р:его|её} класс. [[?ДРУГ1:{ДРУГ1.им} {РД1:держал|держала|держали} табличку «1 класс» — гордо, как флаг.]] [[?ДРУГ2:{ДРУГ2.им} {РД2:протянул|протянула|протянули} {ГЕРОЙ.дат} {РД2:ладошку|ладошку|ладошки}: «Будем дружить?»]] [[?ВОСПИТАТЕЛЬ1:А впереди стоял{РВ:|а} {ВОСПИТАТЕЛЬ.им} — {РВ:наш учитель|наша учительница}. || А впереди стояла учительница.]]",
        scene: "a festive school yard, {GROUP} in neat school uniforms with bouquets, a sign with the number one held up like a flag, {GROUP_ADULTS} smiling in front",
      },
      {
        text: "Но линейка всё не начиналась. Старшеклассники растерянно шептались: у школьного колокольчика пропал голос! Его качали, трясли — а он только сипел: «Пш-ш». [[?ДРУГ3:{ДРУГ3.им} {РД3:предложил|предложила|предложили} подуть на него, как на горячий чай.]] [[?ДРУГ4:{ДРУГ4.им} {РД4:прислушался|прислушалась|прислушались} и {РД4:сказал|сказала|сказали}: «Он не сломался. Он просто стесняется».]]",
        scene: "a school assembly in the yard, an older pupil holding a big brass hand bell that makes no sound, {GROUP} looking curious, the child stepping forward",
      },
      {
        text: "{ГЕРОЙ.им} взял{Р:|а} колокольчик в ладони, и тот тихонько заговорил: — Я каждый год звоню для новеньких. А вдруг вы меня не полюбите? Вдруг я слишком громкий? — Мы тоже волнуемся, — честно сказал{Р:|а} {ГЕРОЙ.им}. — Давай волноваться вместе. Мы покажем тебе школу. [[?ДРУГ5:{ДРУГ5.им} бережно {РД5:поправил|поправила|поправили} колокольчику бантик.]]",
        scene: "the child holding the shy brass school bell with a ribbon in cupped hands, the bell has a tiny worried face, {GROUP} gathered close",
      },
      {
        text: "Первым делом пошли в класс. Парты стояли ровно, как солдатики, а на доске было написано: «Здравствуйте, ребята!» [[?ДРУГ6:{ДРУГ6.им} {РД6:сел|села|сели} за первую парту и {РД6:показал|показала|показали} колокольчику новую тетрадку.]] [[?ДРУГ7:{ДРУГ7.им} {РД7:нарисовал|нарисовала|нарисовали} в уголке доски маленький колокольчик — с улыбкой.]] Колокольчик впервые звякнул — совсем чуть-чуть.",
        scene: "a bright first-grade classroom with neat rows of desks and a chalkboard with a greeting, {GROUP} at the desks showing notebooks to the little bell, a chalk drawing of a smiling bell",
      },
      {
        text: "Потом заглянули в библиотеку. Там пахло бумагой и тайнами. [[?ДРУГ8:{ДРУГ8.им} {РД8:нашёл|нашла|нашли} книжку про колокола всего света.]] [[?ДРУГ9:{ДРУГ9.им} {РД9:прочитал|прочитала|прочитали} по слогам: «Ко-ло-коль-чик — са-мый глав-ный в шко-ле».]] Колокольчик зарделся и звякнул погромче.",
        scene: "a cozy school library with tall shelves, {GROUP} reading a big picture book about bells, the brass bell blushing with a tiny smile",
      },
      {
        text: "В спортзале жило эхо — огромное, как в пещере. [[?ДРУГ10:{ДРУГ10.им} {РД10:крикнул|крикнула|крикнули} «Ау!» — и эхо ответило пять раз.]] [[?ДРУГ11:{ДРУГ11.им} {РД11:кувыркнулся|кувыркнулась|кувыркнулись} на мате — для настроения.]] — Ого, — сказал колокольчик. — Здесь и я могу погромче.",
        scene: "a big school gym with mats and climbing bars, {GROUP} shouting to the echo and doing somersaults on a mat, the brass bell looking braver",
      },
      {
        text: "В столовой повара как раз пекли булочки с корицей. [[?ДРУГ12:{ДРУГ12.им} {РД12:угостил|угостила|угостили} колокольчик крошкой — понарошку, конечно.]] [[?ДРУГ13:{ДРУГ13.им} {РД13:объявил|объявила|объявили}: «Колокольчик, теперь ты наш — из первого класса!»]] И колокольчик засмеялся — звонко-звонко, на всю столовую.",
        scene: "a school canteen with cooks baking cinnamon buns, {GROUP} laughing at a long table with the brass bell, warm light",
      },
      {
        text: "— Я готов, — сказал колокольчик. — Только пусть меня держит кто-то из новеньких. Держать доверили {ГЕРОЙ.дат}: ведь это {Р:он|она} {Р:первым|первой} с ним заговорил{Р:|а}. [[?ДРУГ14:{ДРУГ14.им} {РД14:встал|встала|встали} рядом — помогать.]]",
        scene: "the school yard again, the child holding the brass bell high, {GROUP} standing around cheering, balloons",
      },
      {
        text: "Динь-динь-динь! Колокольчик зазвенел так звонко, что с деревьев слетели листья, а голуби захлопали крыльями. Это был первый звонок — для {ГЕРОЙ.род} и для всего класса. [[?ВОСПИТАТЕЛЬ1:{ВОСПИТАТЕЛЬ.им} {РВ:сказал|сказала}: «Вот теперь — пора на урок». || Учительница сказала: «Вот теперь — пора на урок».]] [[?ВОСПИТАТЕЛЬ2:{ВОСПИТАТЕЛЬ2.им} {РВ2:открыл|открыла} дверь в класс и улыбнул{РВ2:ся|ась}: «Добро пожаловать!»]]",
        scene: "the child ringing the brass bell loudly, autumn leaves flying and pigeons fluttering, {GROUP} and {GROUP_ADULTS} heading to the school door",
      },
      {
        text: "[[?ГРУППА:После уроков весь класс сфотографировали на школьном крыльце. Вот мы все, по именам: {ПЕРЕКЛИЧКА}. || После уроков {ГЕРОЙ.им} и {Р:его|её} новые друзья сфотографировались на школьном крыльце — всем классом.]] Колокольчик тоже попал в кадр: он висел у двери и сиял.",
        scene: "a first-grade class photo on the school steps: {GROUP} standing in rows with bouquets, the child in the very middle of the front row, {GROUP_ADULTS} at the side, a shining brass bell by the door",
      },
      {
        text: "Вечером {ГЕРОЙ.им} рассказывал{Р:|а} дома про всё: про парты-солдатики, про эхо, про булочки. И про то, что у {Р:него|неё} теперь есть класс — свой, настоящий. А колокольчик звенит каждое утро. И каждый раз — немножко для {Р:него|неё}.",
        scene: "evening at home, the child excitedly telling the family about the first school day, a backpack by the door, a class photo on the table",
      },
    ],
    occasionHooks: {
      "pervyj-klass": { opening: "", closing: "" },
      default: { opening: "Это случилось в особенный день — {ПОВОД}.", closing: "А этот день — {ПОВОД} — класс запомнит надолго." },
    },
  },
];

export const TEEN_GROUP_PLOTS: Plot[] = [
  // ───────────────── Выпускной в школе · квест с иронией ─────────────────
  {
    slug: "muzej-nashego-klassa",
    audience: "TEEN",
    segments: ["teens-14-17"],
    title: "Музей одного класса",
    tagline: "За ночь до выпускного школа превращается в музей. Экспонаты — одиннадцать лет вашего класса.",
    description:
      "Ваш выпускник возвращается в школу за забытой толстовкой — и находит на двери кабинета табличку «Музей одного класса. Открыт одну ночь». Внутри — весь класс и витрины с экспонатами: букет первоклассника, самая страшная контрольная, закопчённый котелок из похода, недоигранная новогодняя сценка, последняя парта с надписями. Чтобы выйти, нужно собрать все экспонаты — а главный окажется совсем не в витрине. Ирония, воспоминания и прощание как надо. По имени звучит каждый одноклассник (до 40 человек) и классный руководитель.",
    ageMin: 15,
    ageMax: 17,
    occasions: ["vypusknoj-v-shkole"],
    coreOccasions: ["vypusknoj-v-shkole"],
    textStyle: "quest-fantasy-humor",
    artStyles: ["graphic-novel", "risograph-zine", "painterly-fantasy"],
    theme: "museum",
    heroKind: "teen",
    extras: { roles: ["sibling", "pet"], min: 0, max: 1, note: "Одноклассники — в отдельном списке «Наш класс»" },
    group: {
      min: 1,
      max: 40,
      label: "класс",
      includeAdults: { roles: ["учитель"], max: 3 },
      note: "Впишите одноклассников (до 39 имён, без героя) и классного руководителя — каждый появится в книге",
    },
    interests: ["музыка", "походы", "сцена", "фотография"],
    coverScene: "a teen standing in a dark school corridor turned into a night museum with glowing showcases, a whole group of classmates silhouetted behind, graduation ribbons, moonlight",
    spreads: [
      {
        text: "За ночь до выпускного {ГЕРОЙ.им} вернул{Р:ся|ась} в школу за забытой толстовкой. Охранник махнул рукой: «Пять минут». Коридор был тёмный и подозрительно чистый. А на двери родного кабинета висела табличка, которой утром точно не было: «Музей одного класса. Открыт одну ночь. Вход — для своих». «Отлично, — подумал{Р:|а} {ГЕРОЙ.им}. — Одиннадцать лет учёбы, и вот она — финальная локация».",
        scene: "a teen in an empty dark school corridor at night, a mysterious glowing sign on a classroom door, moonlight through the windows",
      },
      {
        text: "За дверью оказался не кабинет, а музей: витрины, бархатные канаты, таблички. И знакомые лица — приглашения, похоже, получили все. [[?ДРУГ1:{ДРУГ1.им} уже {РД1:стоял|стояла|стояли} у первой витрины с лицом {РД1:«я ничего не трогал»|«я ничего не трогала»|«мы ничего не трогали»}.]] [[?ДРУГ2:{ДРУГ2.им} {РД2:снимал|снимала|снимали} всё на телефон, хотя экран упорно показывал только помехи.]] Над входом мигнула надпись: «Чтобы выйти, соберите все экспонаты».",
        scene: "a classroom transformed into a night museum with glass showcases, velvet ropes and little plaques, {GROUP} arriving in casual clothes, some filming with phones, a glowing sign above the entrance",
      },
      {
        text: "Экспонат первый: «Букет, с которым мы пришли в первый класс». Букет был размером с человека и всё ещё пах астрами. [[?ДРУГ3:{ДРУГ3.им} {РД3:узнал|узнала|узнали} себя на старой фотографии — с самым серьёзным лицом в истории школы — и {РД3:потребовал|потребовала|потребовали} убрать экспонат.]] [[?ДРУГ4:{ДРУГ4.им} {РД4:вспомнил|вспомнила|вспомнили}, как на линейке табличка «1 класс» улетела прямо в лужу. || Рядом лежала табличка «1 класс» — та самая, что на линейке улетела прямо в лужу.]] Табличка в витрине до сих пор была в разводах. Экспонат засчитан.",
        scene: "a glass showcase holding a giant bouquet of asters and an old first-grade photo, {GROUP} laughing and pointing, a muddy sign with the number one",
      },
      {
        text: "Экспонат второй: «Самая страшная контрольная». Листок лежал под стеклом и излучал тревогу. Внутренний голос {ГЕРОЙ.род} сразу заявил: «Я туда не пойду». [[?ДРУГ5:{ДРУГ5.им} {РД5:вспомнил|вспомнила|вспомнили} задачу про два поезда: тогда весь класс приехал на разные станции.]] [[?ДРУГ6:{ДРУГ6.им} {РД6:решил|решила|решили} её маркером прямо на стекле — за минуту. Видимо, поезда наконец доехали.]] Витрина одобрительно пискнула.",
        scene: "a museum showcase with an old math test paper glowing ominously, {GROUP} gathered around, a math problem being solved with a marker on the glass",
      },
      {
        text: "Экспонат третий: «Котелок из похода в восьмом классе». Котелок был закопчён, помят и очень горд собой. [[?ДРУГ7:{ДРУГ7.им} {РД7:признался|призналась|признались}: та гречка с дымом до сих пор — лучшее, что {РД7:он|она|они} {РД7:ел|ела|ели} в жизни.]] [[?ДРУГ8:{ДРУГ8.им} {РД8:показал|показала|показали}, как ставили палатку под дождём, — и витрина на всякий случай отодвинулась.]] Палатка тогда, кстати, падала дважды. Экспонат засчитан.",
        scene: "a dented sooty camping pot in a showcase lit like a treasure, {GROUP} reenacting pitching a tent with lots of laughter",
      },
      {
        text: "Экспонат четвёртый: «Новогодняя сценка, которую мы так и не доиграли». Картонная ёлка, бумажные короны, сценарий с пометками на полях. [[?ДРУГ9:{ДРУГ9.им} {РД9:вспомнил|вспомнила|вспомнили} все слова роли — все три.]] [[?ДРУГ10:{ДРУГ10.им} с пугающей точностью {РД10:изобразил|изобразила|изобразили} ёлку, которая тогда рухнула в первый ряд.]] На этот раз доиграли до конца. Витрины зааплодировали.",
        scene: "a small stage corner in the museum with a cardboard New Year tree and paper crowns, {GROUP} finally performing an old school play, the showcase lights flashing like applause",
      },
      {
        text: "Экспонат пятый: «Последняя парта». Её покрывали надписи за одиннадцать лет: формулы, рожицы, даты и загадочное «не забудь». [[?ДРУГ11:{ДРУГ11.им} {РД11:нашёл|нашла|нашли} свою подпись из пятого класса и {РД11:сделал|сделала|сделали} вид, что видит её впервые.]] [[?ДРУГ12:{ДРУГ12.им} {РД12:дописал|дописала|дописали} внизу: «Мы были тут. И это было неплохо».]] «Не забудь — что?» — подумал{Р:|а} {ГЕРОЙ.им}. Ответ, похоже, ждал в последнем зале.",
        scene: "an old school desk covered with eleven years of doodles and formulas displayed on a pedestal, {GROUP} reading the scribbles, a new line being written at the bottom",
      },
      {
        text: "В последнем зале было пусто. Только пьедестал и табличка: «Главный экспонат — не здесь». [[?ДРУГ13:{ДРУГ13.им} {РД13:предположил|предположила|предположили}, что музей просто сломался.]] [[?ДРУГ14:{ДРУГ14.им} {РД14:предложил|предложила|предложили} поискать под пьедесталом — привычка с контрольных.]] И тут {ГЕРОЙ.им} понял{Р:|а}: главный экспонат — это они. Все вместе, в одной комнате, в последний раз перед тем, как разойтись по своим дорогам.",
        scene: "an empty museum hall with a single plaque on an empty pedestal, {GROUP} standing together in the middle, the teen realizing something, soft light",
      },
      {
        text: "[[?ВОСПИТАТЕЛЬ1:В дверях стоял{РВ:|а} {ВОСПИТАТЕЛЬ.им} — с той самой папкой и той самой улыбкой. — Я так и знал{РВ:|а}, что вы здесь, — сказал{РВ:|а} {РВ:он|она}. — Одиннадцать лет вы опаздывали. Сегодня впервые пришли раньше. || В дверях стояла классная руководительница — с той самой папкой и той самой улыбкой. — Я так и знала, что вы здесь, — сказала она. — Одиннадцать лет вы опаздывали. Сегодня впервые пришли раньше.]] [[?ВОСПИТАТЕЛЬ2:За {РВ:его|её} плечом {РВ2:показался|показалась} {ВОСПИТАТЕЛЬ2.им} — и сразу узнал{РВ2:|а} каждого, будто и не было этих лет.]] [[?ВОСПИТАТЕЛЬ3:{ВОСПИТАТЕЛЬ3.им} {РВ3:принёс|принесла} старый классный журнал — «для экспозиции».]] Табличка у пустого пьедестала мигнула и сменила надпись: «Экспонат: наш класс. Бесценно».",
        scene: "{GROUP_ADULTS} standing in the museum doorway with a folder and a warm smile, {GROUP} turning around surprised, the plaque on the pedestal glowing with new words",
      },
      {
        text: "Они ещё долго сидели прямо на полу музея: вспоминали, перебивали друг друга, смеялись до икоты. Внутренний голос {ГЕРОЙ.род} впервые за вечер молчал — ему тоже было хорошо. Под утро витрины начали тускнеть: музей одной ночи закрывался. «Ну и ладно, — подумал{Р:|а} {ГЕРОЙ.им}. — Экспонаты мы забираем с собой».",
        scene: "{GROUP} sitting on the floor of the museum hall talking and laughing, the showcases slowly fading at dawn, the teen smiling",
      },
      {
        text: "[[?ГРУППА:На выходе висела последняя табличка — опись экспонатов. Каждый нашёл там своё имя: {ПЕРЕКЛИЧКА}. || На выходе висела последняя табличка — опись экспонатов. Там было имя {ГЕРОЙ.род} — и место для всех, с кем {Р:он|она} одиннадцать лет делил{Р:|а} один класс.]]",
        scene: "a class photo at dawn on the school steps: {GROUP} standing in rows in graduation clothes with ribbons, the teen in the very middle of the front row, {GROUP_ADULTS} at the side",
      },
      {
        text: "А вечером был выпускной: музыка, ленты, рассвет над крышами. {ГЕРОЙ.им} смотрел{Р:|а} на свой класс и знал{Р:|а} секрет, которого не знали родители: этой ночью они уже попрощались — по-настоящему, как надо. Дальше у каждого своя дорога. Но экспонаты, как известно, не теряются. Они просто переезжают в новые залы.",
        scene: "graduation night: {GROUP} with ribbons watching the dawn over city rooftops, the teen in the middle, balloons and confetti",
      },
    ],
    occasionHooks: {
      "vypusknoj-v-shkole": { opening: "", closing: "" },
      default: { opening: "Музей открылся в особенную ночь: совсем скоро — {ПОВОД}.", closing: "И пусть этот день — {ПОВОД} — станет ещё одним экспонатом, который не потеряется." },
    },
  },
];

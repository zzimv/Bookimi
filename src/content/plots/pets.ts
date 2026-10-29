// ВЛАДЕЛЕЦ: агент 8 (сюжеты о питомцах). Никто другой этот файл не меняет.
//
// Должно быть: PET_PLOTS — не меньше 4 сюжетов для PET, оба сегмента (pet-dog, pet-cat).
// Контракт Plot (src/content/types.ts): heroKind "pet", ровно 12 разворотов, метки — по
// docs/content/ARCHITECTURE.md. Герой — питомец: {ГЕРОЙ.*} — кличка, {Р:он|она} — по полу питомца
// (кот/кошка, пёс/собака). Хозяева — доп. герои с ролью owner: {ДОП1.*}, {ДОП2.*}, все — {ДОПЫ.*};
// если текст на них опирается — extras.min ≥ 1. Сюжет для собаки или кошки — через segments
// (можно оба, если текст подходит обоим: тогда без «гав»/«мяу» в обязательных местах).
// textStyle из TEXT_STYLE_IDS (pet-first-person, cozy-adventure, funny-verse, mock-epic, gentle-bedtime,
// pushkin-verse), artStyles из ART_STYLE_IDS, theme из DEMO_THEME_KEYS, occasions из OCCASIONS,
// occasionHooks для главных поводов + "default" с {ПОВОД}. Запреты PET_TABOO — строго.
// Сцены: «the dog» / «the cat», хозяева — «the owner». Проверка: validateContent().
//
// Сюжеты: 3 для собак (moj-chelovek, bolshaya-progulka, nosochnyj-klad), 2 для кошек (skazanie-o-divane,
// nochnoj-dozor), 1 для обоих (den-kogda-ty-poyavilsya — без видовых примет, сцены «the pet»).
// Род хозяина {ДОП1} — через {Р1:м|ж}; всегда полные формы ({Р:принёс|принесла}), не окончания.
//
// requests (просьбы к интегратору, агенту 11): —

import type { Plot } from "../types";

const OWNER_ROLES: Plot["extras"]["roles"] = ["owner", "child", "partner", "sibling"];

export const PET_PLOTS: Plot[] = [
  // ───────────────────────────── Собака: дневник «Мой человек» ─────────────────────────────
  {
    slug: "moj-chelovek",
    audience: "PET",
    segments: ["pet-dog"],
    title: "Мой человек",
    tagline: "Дневник собаки об одном очень важном дне и о самом лучшем человеке на свете.",
    description:
      "Ваша собака рассказывает сама: кто такой её человек, какие в доме правила и что делать, если человек ушёл «на пять минут». А ещё — как помогать с сюрпризом, побеждать курьера и находить потерянные ключи. Смешно, честно и очень по-собачьи.",
    occasions: ["den-rozhdeniya", "poyavlenie-pitomca", "den-pitomca", "bez"],
    textStyle: "pet-first-person",
    artStyles: ["pet-cartoon", "soft-gouache", "watercolor-air"],
    theme: "pet-home",
    heroKind: "pet",
    extras: { roles: OWNER_ROLES, min: 1, max: 3, note: "Хозяин или хозяйка — «мой человек»; первый в списке — главный" },
    interests: ["прогулки", "игрушки", "вкусняшки"],
    coverScene:
      "the dog sitting proudly beside the owner on a cozy living-room rug, looking up at the owner with adoring eyes, a notebook with paw prints nearby",
    spreads: [
      {
        text: "Меня зовут {ГЕРОЙ.им}, и у меня есть человек. Не какой-нибудь, а мой собственный: {ДОП1.им}. Люди думают, что это они меня выбрали. Ха! Это я {Р:выбрал|выбрала} {Р1:его|её}. С первого нюха.",
        scene: "the dog sitting proudly next to an open notebook covered in paw prints, the owner smiling in the background of a cozy apartment",
      },
      {
        text: "Мой человек почти идеален. У {Р1:него|неё} тёплые руки, громкий смех и карманы, в которых иногда бывает сыр. Нюх, правда, никудышный: {Р1:он|она} даже не знает, кто проходил под окном вчера вечером. Но я не ругаюсь. Я {Р1:его|её} воспитываю.",
        scene: "the owner laughing and patting the dog, the dog sniffing the owner's coat pocket with great interest",
      },
      {
        text: "Правила в нашем доме простые. Первое: когда человек приходит, надо прыгать. Второе: когда человек уходит, надо смотреть на дверь, пока она снова не откроется. Третье: всё, что упало на пол, — моё. Человек думает, что правил больше. Пусть думает.",
        scene: "the dog staring devotedly at the front door, a pair of slippers beside it, warm hallway light",
      },
      {
        text: "Сегодня у нас Важный День. Я {Р:понял|поняла} это по трём признакам. Мой человек встал раньше будильника. {Р1:Он|Она} {Р1:достал|достала} с верхней полки большую коробку. И {Р1:сказал|сказала} загадочное слово: «Сюрприз». Я не знаю, что такое сюрприз. Но я сразу {Р:решил|решила} помогать.",
        scene: "the owner taking a big box down from a high shelf in the morning, the dog watching with ears perked and tail wagging",
      },
      {
        text: "Человек сел на пол с шуршащим рулоном и лентой. Шуршащее — это добыча, это знает каждая собака. Я {Р:помогал|помогала} изо всех сил: {Р:держал|держала} ленту зубами, {Р:ложился|ложилась} на бумагу, чтобы не убежала, и {Р:проверял|проверяла} носом каждый угол.",
        scene: "the owner sitting on the floor wrapping a present while the dog lies on the wrapping paper holding a ribbon in its mouth",
      },
      {
        text: "Через десять минут мой человек был упакован лучше любой коробки. — {ГЕРОЙ.им}, ну кто так помогает! — {Р1:засмеялся|засмеялась} {Р1:он|она} и почесал{Р1:|а} меня за ухом. Раз чешут за ухом — значит, помогаю правильно.",
        scene: "the owner tangled in ribbon and wrapping paper, laughing, scratching the happy dog behind the ear",
      },
      {
        text: "Потом мой человек ушёл «на пять минут». Пять минут — это очень долго. Я {Р:лежал|лежала} у двери. Я {Р:вздыхал|вздыхала}. Я {Р:проверил|проверила} тапки: они пахли моим человеком, и стало чуть-чуть легче. Но совсем чуть-чуть.",
        scene: "the dog lying by the closed front door with its chin on the owner's slipper, sighing, a clock on the wall",
      },
      {
        text: "Когда дверь открылась, я {Р:встретил|встретила} человека так, будто {Р1:он не был|она не была} дома целый год. Потому что пять минут по-собачьи — это почти год. Я {Р:прыгал|прыгала}, {Р:крутился|крутилась} и {Р:вилял|виляла} всем, чем только можно вилять.",
        scene: "the dog leaping joyfully to greet the owner coming through the door with a shopping bag, spinning with happiness",
      },
      {
        text: "А потом раздался звонок: дзинь! Я сразу {Р:понял|поняла}: чужой! Я {Р:встал|встала} у двери и гавкнул{Р:|а} самым грозным голосом. За дверью был человек в кепке с огромной коробкой. Он поставил коробку и быстро ушёл. Я {Р:победил|победила}. Опять.",
        scene: "the dog standing guard bravely in the hallway barking, a courier in a cap leaving a large parcel at the open door",
      },
      {
        text: "— Где ключи? Мы опоздаем! — мой человек бегал по квартире и заглядывал под подушки. Люди… Ключи же пахнут {Р1:им|ею}! Я {Р:сунул|сунула} нос под диван, потом в карман куртки — и {Р:принёс|принесла} их прямо в руки.",
        scene: "the dog proudly carrying a bunch of keys in its mouth to the surprised owner, cushions scattered around the room",
      },
      {
        text: "А сюрприз, оказывается, был для меня! В большой коробке лежала новая мягкая лежанка, а в парке нас ждали мячик и самая длинная прогулка в моей жизни. — Ты мой герой, {ЛАСКОВО.им}, — сказал мой человек. Я {Р:сделал|сделала} вид, что мне всё равно. Но хвост меня выдал.",
        scene: "the dog in a sunny park with a new ball, the owner kneeling to hug the dog, a cozy new pet bed with a bow visible at home",
      },
      {
        text: "Вот что я {Р:понял|поняла} за этот день. Сюрприз — это хорошо. Новая лежанка — отлично. Но лучшее на свете — мой человек. Я {Р1:его|её} очень люблю. Только {Р1:ему|ей} не говорите. Хотя, кажется, {Р1:он|она} и так знает.",
        scene: "the dog and the owner curled up together on the new pet bed in the evening, warm lamp light, the dog resting its head on the owner's knee",
      },
    ],
    occasionHooks: {
      "den-rozhdeniya": {
        opening: "Сегодня, между прочим, мой день рождения. Я {Р:узнал|узнала} об этом последн{Р:им|ей} в доме — по запаху пирога.",
        closing: "Вечером мне спели песню и зажгли свечку. Я не {Р:понял|поняла} зачем, но мне понравилось. С днём рождения меня!",
        openingScene: "a small birthday cake for the dog on the kitchen table",
        closingScene: "the family singing to the dog wearing a party hat, a small cake with one candle",
      },
      "poyavlenie-pitomca": {
        opening: "Сегодня особенный день: когда-то именно в этот день я {Р:поселился|поселилась} у своего человека. Люди называют это «годовщина». Я называю это «лучшее, что со мной случилось».",
        closing: "С годовщиной нас! Это был лучший выбор в моей жизни. И в {Р1:его|её} — тоже.",
        openingScene: "a framed photo of the owner and the dog on the wall",
        closingScene: "the owner and the dog celebrating with a small treat cake and a festive bow",
      },
      "den-pitomca": {
        opening: "Сегодня День домашних животных. Это значит, что сегодня праздник у меня. Хотя, если честно, у меня праздник каждый день, когда мой человек дома.",
        closing: "С Днём домашних животных! Особенно — меня.",
        openingScene: "a festive bow on the dog's collar",
        closingScene: "the dog with a festive bow on its collar surrounded by its family",
      },
      "novyj-god": {
        opening: "Под Новый год в доме выросло дерево. Прямо в комнате! Оно пахнет лесом и звенит, если задеть хвостом. Я {Р:решил|решила}: в этот раз сюрприз будет особенным.",
        closing: "А в полночь все кричали «ура», а я — «гав». По-моему, это одно и то же. С Новым годом!",
        openingScene: "a decorated New Year tree with garlands in the living room",
        closingScene: "New Year night, a glowing fir tree, gifts, snow behind the window",
      },
      default: {
        opening: "Сегодня у моих людей особенный день: {ПОВОД}. Я не знаю точно, что это значит, но пахнет пирогом и все улыбаются.",
        closing: "Вот такой у нас был праздник — {ПОВОД}. Если что — я рядом. Я всегда рядом.",
      },
    },
  },

  // ───────────────────────────── Собака: уютное приключение в парке ─────────────────────────────
  {
    slug: "bolshaya-progulka",
    audience: "PET",
    segments: ["pet-dog"],
    title: "Подарок для моего человека",
    tagline: "Собака отправляется на большую прогулку, чтобы найти подарок к празднику.",
    description:
      "В доме пахнет пирогом, все прячут свёртки с бантиками — а у собаки подарка нет! Вместе с хозяином она отправляется в парк, где придётся протащить палку через калитку, помочь девочке найти варежку и допрыгнуть до самой лучшей шишки. Добрая история с хвостом, носом и смекалкой.",
    occasions: ["den-rozhdeniya", "den-pitomca", "novyj-god", "bez"],
    textStyle: "cozy-adventure",
    artStyles: ["soft-gouache", "watercolor-air", "pet-cartoon", "vintage-postcard"],
    theme: "park",
    heroKind: "pet",
    extras: { roles: OWNER_ROLES, min: 1, max: 3, note: "Хозяин или хозяйка гуляет вместе с собакой" },
    interests: ["прогулки", "палки", "игры с мячом"],
    coverScene:
      "the dog trotting happily along a park path holding a pinecone tied with a red ribbon in its mouth, the owner walking beside with a leash, lanterns along the alley",
    spreads: [
      {
        text: "{ГЕРОЙ.им} проснул{Р:ся|ась} от запаха ванили. На кухне что-то пеклось, по углам шуршали пакеты, а {ДОП1.им} прятал{Р1:|а} за спиной свёрток с бантиком. «Вечером праздник», — понял{Р:|а} {ГЕРОЙ.им}. А на праздник все приходят с подарками. Все, кроме собак. Непорядок!",
        scene: "the dog waking up on its bed and sniffing the air, the owner in the kitchen hiding a wrapped gift with a bow behind their back",
      },
      {
        text: "Подарок надо найти до того, как в парке зажгутся фонари: в это время все сядут за стол. А где ищут подарки? Конечно, на прогулке! {ГЕРОЙ.им} {Р:принёс|принесла} поводок и положил{Р:|а} его у ног хозяина. — Уже гулять? — удивил{Р1:ся|ась} {ДОП1.им}. — Ну, пойдём.",
        scene: "the dog holding its leash in its mouth and looking up hopefully at the surprised owner in the hallway",
      },
      {
        text: "У входа в парк на скамейке сидел воробей и чистил пёрышки. — Подарок? — чирикнул он. — Лучшие сокровища в парке лежат у калитки, у детской горки и под старой ёлкой у пруда. Только не опоздай!",
        scene: "a small sparrow on a park bench chirping to the dog, the owner holding the leash, a park gate and alleys behind",
      },
      {
        text: "У калитки лежала Палка. Не какая-нибудь, а великолепная: длинная, ровная, с сучком посередине. {ГЕРОЙ.им} схватил{Р:|а} её поперёк — и застрял{Р:|а}. Палка в калитку не проходила. Ни так, ни этак.",
        scene: "the dog holding a very long stick crosswise in its mouth, stuck in a narrow park gate, the owner trying not to laugh",
      },
      {
        text: "{ГЕРОЙ.им} подумал{Р:|а}, перехватил{Р:|а} палку за самый кончик — и она прошла вдоль, как по линеечке. — Ну ты голова! — восхитил{Р1:ся|ась} {ДОП1.им}. Правда, потом выяснилось, что люди палки почему-то не дарят. Палку оставили до завтра.",
        scene: "the dog cleverly carrying the long stick by its end through the gate, the owner applauding",
      },
      {
        text: "Возле детской горки плакала девочка. — Варежку потеряла, — всхлипывала она. — Красную, с оленем… {ГЕРОЙ.им} понюхал{Р:|а} вторую варежку, {Р:ткнулся|ткнулась} носом в кусты, потом под скамейку — и через минуту {Р:принёс|принесла} пропажу.",
        scene: "a little girl near a playground slide holding one red mitten, the dog sniffing under a bench, the owner beside them",
      },
      {
        text: "Девочка засмеялась, обняла {ГЕРОЙ.вин} и развязала ленточку со своей косички. — Это тебе. Для подарка! Лента была красная, как варежка, и шелковистая, как ухо. {ГЕРОЙ.им} {Р:понёс|понесла} её бережно, будто она стеклянная.",
        scene: "the little girl hugging the dog and handing over a red ribbon, the dog holding the ribbon carefully in its mouth",
      },
      {
        text: "Под старой ёлкой у пруда лежала сотня шишек. А какая из них лучшая? {ГЕРОЙ.им} нюхал{Р:|а} одну за другой. Эта пахнет сыростью, эта — белкой… И вдруг — вот она! Пахнет смолой, солнцем и немножко праздником. Только висит высоко, на нижней ветке.",
        scene: "the dog sniffing pinecones under a big fir tree by a pond, looking up at one perfect pinecone hanging on a low branch",
      },
      {
        text: "{ГЕРОЙ.им} подпрыгнул{Р:|а} — мимо. Подпрыгнул{Р:|а} ещё раз — опять мимо. Вдали один за другим зажигались фонари. Тогда {ГЕРОЙ.им} разбежал{Р:ся|ась}, как за любимым мячиком, {Р:оттолкнулся|оттолкнулась} всеми лапами — и хоп! Шишка в зубах!",
        scene: "the dog leaping high in the air to catch a pinecone from a fir branch, park lanterns lighting up one by one in the distance",
      },
      {
        text: "{ДОП1.им} всё понял{Р1:|а} без слов: присел{Р1:|а} на корточки и завязал{Р1:|а} на шишке красную ленточку — бантиком. Получился самый настоящий подарок. Последний фонарь в аллее как раз зажёгся. Успели!",
        scene: "the owner crouching and tying a red ribbon bow around the pinecone while the dog watches proudly, the lantern-lit alley behind",
      },
      {
        text: "Дома было тепло и светло. Все дарили друг другу подарки, шуршали бумагой и ахали. А потом {ГЕРОЙ.им} {Р:подошёл|подошла} к столу и {Р:положил|положила} свою шишку прямо в центр. — Это от меня, — сказал хвост. И все ахнули громче всего.",
        scene: "a warm festive table at home, the family gathered, the dog placing a pinecone with a red ribbon in the center of the table",
      },
      {
        text: "С тех пор шишка с красной ленточкой стоит на самой видной полке. Иногда {ДОП1.им} берёт её в руки и улыбается. А {ГЕРОЙ.им} знает: лучший подарок — не тот, что в коробке, а тот, за которым ты прыгал{Р:|а} изо всех сил.",
        scene: "a pinecone with a red ribbon on a shelf in a cozy living room, the dog sleeping happily below it, the owner smiling",
      },
    ],
    occasionHooks: {
      "den-rozhdeniya": {
        opening: "В этот день у {ДОП1.род} был день рождения — и об этом знала вся квартира. Даже собачья миска.",
        closing: "С днём рождения! От всего сердца, от всех четырёх лап и от хвоста.",
        openingScene: "balloons tied to a chair and a birthday cake on the kitchen table",
        closingScene: "a birthday cake with candles next to the pinecone with a red ribbon",
      },
      "den-pitomca": {
        opening: "Был конец ноября — День домашних животных. Люди готовили подарки для {ГЕРОЙ.род}, а {ГЕРОЙ.им} решил{Р:|а}, что тоже не останется в долгу.",
        closing: "С Днём домашних животных, {ЛАСКОВО.им}! Самые добрые подарки дарят те, у кого хвост.",
        openingScene: "a new toy with a festive bow on the dog's bed",
        closingScene: "the dog with a festive bow on its collar surrounded by its family",
      },
      "novyj-god": {
        opening: "Дело было под Новый год: на улице хрустел снег, а дома пахло мандаринами и хвоей.",
        closing: "А шишку с красной ленточкой повесили прямо на ёлку — на самое видное место. С Новым годом!",
        openingScene: "a decorated New Year tree at home, snow outside",
        closingScene: "the pinecone with a red ribbon hanging on a decorated New Year tree, snow falling outside",
      },
      default: {
        opening: "В тот день в доме готовились к особенному дню: {ПОВОД}.",
        closing: "Пусть этот праздник — {ПОВОД} — будет таким же тёплым, как этот вечер, когда собака принесла свой первый подарок.",
      },
    },
  },

  // ───────────────────────────── Собака: весёлые стихи про носки ─────────────────────────────
  {
    slug: "nosochnyj-klad",
    audience: "PET",
    segments: ["pet-dog"],
    title: "Носочный клад",
    tagline: "Весёлые стихи о том, куда пропадают носки, если в доме живёт собака.",
    description:
      "В доме исчезают носки — в горошек, в клетку и в полоску. Начинается настоящее следствие с лупой! Ночью тайна раскрывается: под диваном — целый клад, а у собаки есть очень трогательная причина. Смешные стихи для чтения вслух всей семьёй.",
    occasions: ["den-rozhdeniya", "den-pitomca", "poyavlenie-pitomca", "novyj-god", "bez"],
    textStyle: "funny-verse",
    artStyles: ["pet-cartoon", "soft-gouache", "watercolor-air"],
    theme: "pet-home",
    heroKind: "pet",
    extras: { roles: OWNER_ROLES, min: 1, max: 3, note: "Хозяева — свидетели и сыщики" },
    interests: ["носки", "игрушки"],
    coverScene:
      "the dog peeking out from under a sofa with a striped sock in its mouth, a colorful pile of socks behind it, playful cartoon mood",
    spreads: [
      {
        text: "Утром, ровно в семь часов,\nДом остался без носков.\nИщут все — в шкафу, в комоде,\nПод кроватью и в проходе:\n«Был носок, а нынче — нет!\nГде носок? Пропал и след!»",
        scene: "the owner in pajamas searching a chest of drawers and under the bed for a missing sock, morning light",
      },
      {
        text: "Под столом, свернувшись в ком,\nКто там дремлет сладким сном?\n— {ГЕРОЙ.им}!\nУхо дрогнет, хвост — тук-тук:\nВидно, снится лучший друг.",
        scene: "the dog curled up asleep under the kitchen table, one ear twitching, tail thumping, innocent face",
      },
      {
        text: "Днём пропал носок в полоску,\nВечером — носок-матроска,\nА к субботе — вот беда! —\nВсе исчезли без следа.\n«Где носок? — кричит весь дом. —\nМы без них не проживём!»",
        scene: "the family holding up single unmatched socks in dismay, an empty laundry basket, the dog watching from the corner",
      },
      {
        text: "Начинается дознанье:\nЛупа, шляпа, расписанье.\nКто был дома? Кто не спал?\nКто последним убегал?\nТолько кто-то у дверей\nСмотрит всех других честней.",
        scene: "the owner as a detective with a magnifying glass and a hat examining the floor, the dog sitting by the door with the most innocent expression",
      },
      {
        text: "Ночью — тишь, луна в окне,\nВсе сопят, и всё во сне.\nТолько — топ-топ — в коридор\nПробирается, как вор…\nШорох, шелест, скрип и хлоп —\nКто-то лезет в стирку… Стоп!",
        scene: "a dark hallway at night lit by moonlight, a dog-shaped shadow tiptoeing toward the laundry basket",
      },
      {
        text: "Щёлк! — и вспыхнул свет вокруг.\nКто попался? Лучший друг!\nДержит в пасти два носка,\nМорда — честная пока.",
        scene: "the light switched on, the owner in the doorway, the dog frozen mid-step with two socks in its mouth and an innocent face",
      },
      {
        text: "Все за хвостиком — гуськом,\nПод диван — ползком, ползком.\nА под тем диваном — склад:\nВсе носки в рядок лежат!",
        scene: "the family crawling on the floor following the dog, lifting the edge of the sofa to discover rows of neatly arranged socks",
      },
      {
        text: "Тут носки в горошек, в клетку,\nПульт, перчатка и салфетка,\nШарф, ключи, заколка, тапки —\nВсё уложено в охапки!",
        scene: "a funny treasure pile under the sofa: polka-dot and checkered socks, a TV remote, a glove, a scarf, keys, a hair clip and slippers",
      },
      {
        text: "Почему? Да всё понятно:\nЛюди пахнут так приятно!\nДнём, когда пустеет дом,\nХорошо лежать с носком.",
        scene: "the dog alone at home during the day, lying peacefully with its nose in a sock, sunlight on the floor, the empty hallway",
      },
      {
        text: "Засмеялась вся семья,\nДаже кактус и скамья!\n«Пусть лежит! А ты, дружок,\nОхраняй и наш носок!»",
        scene: "the whole family laughing and hugging the dog, a potted cactus and a little bench drawn with smiling faces in a cartoon way",
      },
      {
        text: "Утром каждый, уходя,\nОставляет, не шутя,\nСвой носок у края пледа:\n«Сторожи нас до обеда!»",
        scene: "family members leaving one sock each on the dog's blanket in the morning, the dog proudly guarding them",
      },
      {
        text: "Все носки теперь на месте,\nДом смеётся, все мы вместе.\nА спроси: «Ну, где носок?» —\nЗнает точно, назубок,\n— {ГЕРОЙ.им}!",
        scene: "the family relaxing together on the sofa, everyone wearing matching socks, the dog in the middle with one sock of its own",
      },
    ],
    occasionHooks: {
      "den-rozhdeniya": {
        opening: "В доме праздник, шум и смех:\nДень рождения — лучше всех!",
        closing: "С днём рожденья, наш дружок!\nВот подарок — свой носок!",
        openingScene: "balloons and a birthday cake in the living room",
        closingScene: "the dog unwrapping a gift with a big colorful sock inside, birthday balloons",
      },
      "novyj-god": {
        opening: "Новый год стучится в дом,\nЁлка светится огнём.",
        closing: "С Новым годом! Ёлка, свет —\nИ носков пропавших нет!",
        openingScene: "a decorated New Year tree with lights in the living room",
        closingScene: "Christmas-style stockings hanging by the New Year tree, the dog guarding them happily",
      },
      "poyavlenie-pitomca": {
        opening: "В этот день — вот это да! —\n{Р:Ты пришёл|Ты пришла} к нам навсегда.",
        closing: "С годовщиной, наш дружок!\nМы тебе — любой носок!",
        openingScene: "a welcome mat and a new dog bed by the door",
        closingScene: "the family celebrating with a small treat cake for the dog and a pile of colorful socks",
      },
      "den-pitomca": {
        opening: "Нынче праздник всех хвостов,\nВсех ушей и всех носов!",
        closing: "С праздником тебя, дружок, —\nИ держи ещё носок!",
        openingScene: "a festive bow on the dog's collar",
        closingScene: "the dog with a festive bow surrounded by its family",
      },
      default: {
        opening: "Шум и гам — с утра, с утра:\nВ доме праздник! Ну, ура!\n— {ПОВОД}!",
        closing: "Пусть же этот день для всех\nБудет — праздник, свет и смех!",
      },
    },
  },

  // ───────────────────────────── Кошка: шуточный эпос о диване ─────────────────────────────
  {
    slug: "skazanie-o-divane",
    audience: "PET",
    segments: ["pet-cat"],
    title: "Сказание о великом диване",
    tagline: "Былина о том, как кошка завоевала новый диван — хитростью, терпением и мурлыканьем.",
    description:
      "В дом внесли новый диван и строго сказали: «Чур, не лазить!» Но кошачье сердце не дрогнуло. Три подвига ждут героя: Плёнка Шуршащая, Змей Пылесосыч и самый неприступный Угол Заветный. Торжественно, смешно — и очень нежно в финале.",
    occasions: ["den-koshek", "den-rozhdeniya", "pereezd", "bez"],
    textStyle: "mock-epic",
    artStyles: ["vintage-postcard", "pen-ink-1920s", "pet-cartoon"],
    theme: "pet-home",
    heroKind: "pet",
    extras: { roles: OWNER_ROLES, min: 1, max: 3, note: "Хозяин или хозяйка — «князь-кормилец» или «княгиня-кормилица»" },
    interests: ["диван", "плед", "коробки"],
    coverScene:
      "the cat sitting majestically in the middle of a big new sofa like a ruler on a throne, a cozy plaid draped like a royal mantle, decorative old-postcard frame",
    spreads: [
      {
        text: "Как во славном во городе, во квартире светлой, {Р:жил-был|жила-была} {ГЕРОЙ.им} — {Р:кот усами грозный, хвостом гибкий|кошка усами грозная, хвостом гибкая}, нравом царск{Р:ий|ая}. Подоконник был {Р:ему|ей} вотчиной, коробка — теремом. И правил{Р:|а} {Р:он|она} домом мудро и справедливо, а главное — лёжа.",
        scene: "the cat lounging regally on a sunny windowsill, a cardboard box like a little palace nearby, cozy apartment",
      },
      {
        text: "Но однажды поутру, ранёшенько, распахнулись двери дубовые: внесли добры молодцы Диван — велик, широк, мягок, аки облако. И молвил{Р1:|а} {ДОП1.им}, {Р1:князь-кормилец|княгиня-кормилица}: «Чур, на диван не лазить!» Не гроза над полем гремит — то {ГЕРОЙ.им} думу думает: как же так?",
        scene: "two movers carrying a huge new sofa into the apartment, the owner wagging a finger, the cat watching from the doorway with narrowed eyes",
      },
      {
        text: "Стал{Р:|а} {ГЕРОЙ.им} к подвигу снаряжаться. Наточил{Р:|а} когти богатырские о когтеточку дубовую, умыл{Р:ся|ась} трижды — справа, слева и за ухом. И взял{Р:|а} в верные спутники клубок шерстяной по прозванию Катышек. Покатился Катышек вперёд — путь указывать.",
        scene: "the cat sharpening its claws on a scratching post with great ceremony, then washing behind its ear, a ball of yarn rolling ahead like a loyal companion",
      },
      {
        text: "Первой на страже стояла Плёнка Шуршащая — змея прозрачная о тысяче шорохов. Укрыла она Диван от спинки до ножек и шипела на всякого, кто приближался: «Шшш-шурх! Не пущу!»",
        scene: "the new sofa completely wrapped in shiny crinkly plastic film, the cat approaching it cautiously with one paw raised",
      },
      {
        text: "Не стал{Р:|а} {ГЕРОЙ.им} с ней биться. Сел{Р:|а} на неё — и сидел{Р:|а}. День сидел{Р:|а}, другой сидел{Р:|а}, глядел{Р:|а} строго. Шуршала Плёнка, шуршала, да и сдалась: сняли её люди и вынесли вон. Первая победа!",
        scene: "the cat sitting stubbornly and calmly on top of the plastic-wrapped sofa, then the owner peeling off the film while the cat looks triumphant",
      },
      {
        text: "Тут взревел в чулане Змей Пылесосыч — о трёх насадках, о хоботе длинном. Пополз он по дому, глотая пыль и крошки, и рычал так, что дрожали тапки. И пополз прямо к Дивану.",
        scene: "a vacuum cleaner drawn like a comical long-nosed dragon roaring across the living room toward the sofa, slippers trembling",
      },
      {
        text: "Не дрогнул{Р:|а} {ГЕРОЙ.им}. {Р:Взошёл|Взошла} на шкаф высокий и переждал{Р:|а} грозу, аки мудрый воевода. А как уполз Змей восвояси, спустил{Р:ся|ась} {Р:он|она} и {Р:возлёг|возлегла} на чистую подушку — {Р:первым|первой} из всех. Вторая победа!",
        scene: "the cat sitting calmly on top of a tall wardrobe watching the vacuum leave, then lying luxuriously on a freshly cleaned sofa cushion",
      },
      {
        text: "Остался последний рубеж — Угол Заветный. Каждый вечер садится туда {ДОП1.им} с пледом и чаем. Тот угол не взять ни хитростью, ни терпением: место занято, и занято крепко.",
        scene: "the owner sitting in the corner of the sofa in the evening with a plaid and a cup of tea, the cat studying the situation from the armrest",
      },
      {
        text: "И тогда {ГЕРОЙ.им} сделал{Р:|а} то, на что способны лишь величайшие. {Р:Подошёл|Подошла} неспешно, поглядел{Р:|а} в глаза — и {Р:лёг|легла} прямо на колени. Замурлыкал{Р:|а}. И сдалась крепость без единого выстрела: и угол, и плед, и колени — всё отныне {Р:его|её}.",
        scene: "the cat curled up on the owner's lap in the corner of the sofa, purring, the owner melting with tenderness under the plaid",
      },
      {
        text: "И был пир на весь мир: {ДОП1.дат} — чай с вареньем, {ГЕРОЙ.дат} — угощенье в миске серебряной да плед на двоих. Скрипнул Диван довольно: понял наконец, кто ему хозяин.",
        scene: "a cozy evening feast on the sofa: the owner with tea and jam, the cat with its bowl, sharing one plaid, warm lamp light",
      },
      {
        text: "С той поры о подвиге том поют батареи зимними вечерами. Гости, приходя, спрашивают с почтением: «Можно присесть?» И {ГЕРОЙ.им} милостиво дозволяет: «Садитесь. С краешку».",
        scene: "guests standing politely in front of the sofa where the cat lies in the middle, one guest perching on the very edge, humorous old-postcard style",
      },
      {
        text: "А если без шуток, то вот что. Диван — это просто диван. Но с тех пор как на нём спит {ГЕРОЙ.им}, он стал самым тёплым местом в доме. Потому что дом — это там, где тебя ждут, мурлычут и греют колени. Спасибо, что ты у нас есть, {ЛАСКОВО.им}.",
        scene: "the cat asleep on the sofa in a warm pool of evening light, the owner gently stroking it, a quiet tender moment",
      },
    ],
    occasionHooks: {
      "den-koshek": {
        opening: "А случилось то первого марта, в День кошек — праздник великий, когда всякая кошка в своём доме царствует по закону.",
        closing: "С Днём кошек, {ЛАСКОВО.им}! Диван — твой, колени — твои, и сердца наши — тоже.",
        openingScene: "a festive bow on the windowsill in early spring sunlight",
        closingScene: "the cat wearing a festive bow, enthroned on the sofa, spring sunlight",
      },
      "den-rozhdeniya": {
        opening: "А случилось то в день рождения {ГЕРОЙ.род} — в день, когда сами звёзды велели угождать герою.",
        closing: "Слава {ГЕРОЙ.дат}, слава великая! С днём рождения, {ЛАСКОВО.им}, — царствуй долго и мурлычь громко.",
        openingScene: "a tiny birthday cake for the cat and a festive garland",
        closingScene: "the cat on the sofa wearing a tiny paper crown, a small birthday treat in front of it",
      },
      pereezd: {
        opening: "А случилось то на новом месте, в новых хоромах, куда переехало всё княжество — с коробками, узлами и {Р:котом|кошкой} в переноске.",
        closing: "С новосельем! Новый дом становится домом, когда в нём находится самый тёплый угол — и тот, кто его займёт.",
        openingScene: "cardboard boxes in a bright new apartment",
        closingScene: "the cat asleep on the sofa among half-unpacked boxes, warm light in the new home",
      },
      default: {
        opening: "А случилось то в день особенный, праздничный — {ПОВОД}, — когда пироги в печи румянились и весь дом ждал чуда.",
        closing: "Слава {ГЕРОЙ.дат}, слава великая! И пусть этот праздник — {ПОВОД} — будет таким же тёплым, как диван, на котором {Р:он|она} спит.",
      },
    },
  },

  // ───────────────────────────── Кошка: тихая сказка «Ночной дозор» ─────────────────────────────
  {
    slug: "nochnoj-dozor",
    audience: "PET",
    segments: ["pet-cat"],
    title: "Ночной дозор",
    tagline: "Тихая сказка на ночь: пока все спят, кошка охраняет дом.",
    description:
      "Когда в доме гаснет свет, кошка выходит на службу: обходит комнаты, здоровается с луной, строго успокаивает тени под кроватью и мурлычет тем, кому снится грустное. Мягкая сказка перед сном для детей и взрослых, у которых дома живёт ночной сторож с усами.",
    occasions: ["den-koshek", "poyavlenie-pitomca", "novyj-god", "bez"],
    textStyle: "gentle-bedtime",
    artStyles: ["pen-ink-1920s", "soft-gouache", "vintage-postcard"],
    theme: "pet-night",
    heroKind: "pet",
    extras: { roles: OWNER_ROLES, min: 1, max: 3, note: "Хозяин или хозяйка, чей сон охраняет кошка" },
    interests: ["подоконник", "сон", "луна"],
    coverScene:
      "the cat sitting on a moonlit windowsill at night watching over a sleeping home, a big round moon outside, soft quiet atmosphere",
    spreads: [
      {
        text: "Когда в доме гаснет свет, {ГЕРОЙ.им} открывает глаза. Днём {Р:он|она} спит — это тоже работа, и очень важная. А ночью у {Р:него|неё} служба поважнее. Ночной дозор.",
        scene: "the cat opening its eyes in a darkened living room, the last lamp just switched off, soft blue night light",
      },
      {
        text: "Сначала надо умыться. Лапкой — за ушком, лапкой — по усам. Медленно, не спеша. Дозорный должен быть красивым, даже если никто не видит.",
        scene: "the cat washing its face with a paw in a patch of moonlight on the floor",
      },
      {
        text: "Потом — обход. Мягкие лапы ступают тихо-тихо: ни одна половица не скрипнет. Вот коридор. Вот кухня. На кухне негромко урчит холодильник — он тоже не спит. {ГЕРОЙ.им} кивает ему: свой.",
        scene: "the cat walking softly through a dark kitchen, a refrigerator glowing faintly, the cat nodding to it",
      },
      {
        text: "Теперь — подоконник. Отсюда видно луну, круглую, как пуговица от пижамы. {ГЕРОЙ.им} смотрит на неё долго-долго. Луна тоже смотрит. Они давно знакомы и понимают друг друга без слов.",
        scene: "the cat sitting on the windowsill gazing at a big round moon, the moon with a gentle face looking back",
      },
      {
        text: "Под кроватью живут тени — маленькие, серые, пушистые. Днём их не видно, а ночью они шевелятся. {ГЕРОЙ.им} садится рядом и смотрит строго, но по-доброму. Тени ёжатся, зевают и засыпают.",
        scene: "the cat sitting by the bed looking kindly at tiny fluffy grey dust shadows under it, which are yawning and falling asleep",
      },
      {
        text: "Пора проверить людей. {ДОП1.им} спит, обняв подушку. Одеяло съехало на пол. {ГЕРОЙ.им} забирается на край кровати и ложится прямо на уголок одеяла. Теперь оно никуда не сползёт. Так-то лучше.",
        scene: "the owner asleep hugging a pillow, the cat lying on the edge of the blanket to keep it in place",
      },
      {
        text: "Кто-то во сне вздохнул. Может быть, снится грустное? {ГЕРОЙ.им} подходит ближе и начинает мурлыкать. Тихо-тихо, будто где-то далеко закипает маленький чайник. Мур-р… мур-р… И дыхание снова становится ровным.",
        scene: "the cat purring next to a sleeping person's face, small soft musical waves drawn in the air, peaceful",
      },
      {
        text: "В ванной капает кран: кап… кап… Говорят, люди считают овечек, чтобы уснуть. А кошки считают капли. Раз — кап. Два — кап. Три… Нет, дозорному спать нельзя.",
        scene: "the cat sitting by a bathroom sink watching a slow drop fall from the tap, half-closed sleepy eyes",
      },
      {
        text: "В прихожей что-то шуршит. Пакет! {ГЕРОЙ.им} подкрадывается, замирает… и забирается внутрь. Проверено: в пакете никого нет. Кроме {Р:него самого|неё самой}.",
        scene: "the cat peeking out of a paper bag in the dark hallway with a satisfied expression",
      },
      {
        text: "Под утро небо светлеет — сначала серым, потом розовым. Это самая трудная часть дозора: не уснуть раньше людей. {ГЕРОЙ.им} сворачивается клубочком у тёплых ног и держится изо всех сил.",
        scene: "dawn light turning the window pink, the cat curled up at the foot of the bed struggling to keep its eyes open",
      },
      {
        text: "Звенит будильник. {ДОП1.им} открывает глаза — а рядом тёплый сонный клубок. «Опять ты всю ночь проспал{Р:|а}, соня», — улыбается {ДОП1.им}. {ГЕРОЙ.им} не спорит. Настоящие дозорные не хвастаются.",
        scene: "the owner waking up in the morning and smiling at the cat curled up beside them, an alarm clock on the nightstand",
      },
      {
        text: "Днём {ГЕРОЙ.им} будет спать на солнечном пятне. А когда ты ляжешь спать, {Р:он|она} снова выйдет в дозор. Так что закрывай глаза и ничего не бойся. В доме есть кто-то, кто бережёт твой сон. Спокойной ночи.",
        scene: "the cat sitting watchfully at the doorway of a dim bedroom at night, a child asleep in bed, stars outside the window",
      },
    ],
    occasionHooks: {
      "den-koshek": {
        opening: "Сегодня День кошек. Весь день {ГЕРОЙ.им} принимал{Р:|а} поздравления и угощения. Но праздник праздником, а служба — службой.",
        closing: "С Днём кошек, {ЛАСКОВО.им}, наш ночной сторож. Спасибо за каждую тихую ночь.",
        openingScene: "a festive bow and a small treat bowl near the cat's bed",
        closingScene: "the cat with a festive bow keeping watch over the sleeping home",
      },
      "poyavlenie-pitomca": {
        opening: "С того дня, как {ГЕРОЙ.им} появил{Р:ся|ась} в нашем доме, по ночам у нас всегда кто-то дежурит.",
        closing: "Сколько ночей ты уже бережёшь наш сон, {ЛАСКОВО.им}? С годовщиной — и спасибо.",
        openingScene: "a framed photo of the cat as a newcomer on the shelf",
        closingScene: "the cat curled up at the family's feet, a small celebratory bow on its collar",
      },
      "novyj-god": {
        opening: "Это была новогодняя ночь. На ёлке тихо мигали огоньки, а под ней спали коробки с подарками.",
        closing: "С Новым годом, {ЛАСКОВО.им}! Пусть в новом году все ночи будут такими же спокойными.",
        openingScene: "a softly glowing New Year tree in a dark room with wrapped gifts",
        closingScene: "the cat watching over the sleeping home next to the twinkling New Year tree, snow outside",
      },
      default: {
        opening: "Вечер выдался особенный — {ПОВОД}. Гости разошлись, свет погас, и дом стал тихим-тихим.",
        closing: "Пусть {ПОВОД} закончится сладким сном. А ночной дозор, как всегда, на посту.",
      },
    },
  },

  // ───────────────────────────── Собака или кошка: «День, когда ты появился у нас» ─────────────────────────────
  {
    slug: "den-kogda-ty-poyavilsya",
    audience: "PET",
    segments: ["pet-dog", "pet-cat"],
    title: "День, когда ты {Р:появился|появилась} у нас",
    tagline: "Нежная история о том дне, когда в доме появился питомец — и дом стал домом.",
    description:
      "Книга-письмо от семьи своему питомцу — собаке или кошке. Как мы готовились, как ты обнюхал каждый угол, как прошла первая ночь и как мы учились понимать друг друга. Тёплый подарок к годовщине появления питомца в семье — читать вслух и хранить.",
    occasions: ["poyavlenie-pitomca", "den-pitomca", "den-rozhdeniya", "bez"],
    textStyle: "gentle-bedtime",
    artStyles: ["soft-gouache", "watercolor-air", "vintage-postcard", "pen-ink-1920s"],
    theme: "pet-home",
    heroKind: "pet",
    extras: { roles: OWNER_ROLES, min: 1, max: 3, note: "Хозяева — от их лица написана книга" },
    interests: ["дом", "семья"],
    coverScene:
      "the pet stepping for the first time through the open front door of a cozy home, the owner kneeling to welcome it, warm golden light",
    spreads: [
      {
        text: "Помнишь тот день, {ЛАСКОВО.им}? Наверное, не помнишь. А мы помним всё: какая была погода, что мы ели на завтрак и как стучало сердце, когда мы ехали за тобой.",
        scene: "the owner by a window in the morning holding a cup, looking excited and slightly nervous, a new pet bed and bowls ready nearby",
      },
      {
        text: "Мы долго готовились. {ДОП1.им} купил{Р1:|а} мягкую лежанку и две миски — для воды и для еды. Мы спорили, где тебе будет теплее, и выбирали самый уютный угол. Дом ждал тебя, хотя ещё не знал, кого ждёт.",
        scene: "the owner arranging a soft pet bed and two bowls in a cozy corner of the apartment",
      },
      {
        text: "И вот ты здесь. Ты оказал{Р:ся|ась} совсем не {Р:таким|такой}, как мы думали. Ты оказал{Р:ся|ась} лучше.",
        scene: "the pet standing on the doormat of the open front door for the first time, the owner kneeling with open arms",
      },
      {
        text: "Первым делом ты всё обнюхал{Р:|а}. Коврик. Тапки. Угол за шкафом. Ноги {ДОП1.род}. Ты знакомил{Р:ся|ась} с домом, а дом — с тобой. Кажется, вы друг другу сразу понравились.",
        scene: "the pet curiously sniffing slippers and the corner behind a wardrobe, the owner watching with a smile",
      },
      {
        text: "Лежанку ты {Р:обошёл|обошла} стороной и {Р:выбрал|выбрала} себе совсем другое место — самое неожиданное. Мы засмеялись. Значит, ты уже {Р:решил|решила}, что здесь твой дом и ты сам{Р:|а} знаешь, где в нём лучше.",
        scene: "the pet curled up in an unexpected spot like a laundry basket or an armchair, the new pet bed empty nearby, the owner laughing",
      },
      {
        text: "Первая ночь. Всё вокруг было новым: запахи, звуки, тиканье часов. Ты долго не спал{Р:|а}. А потом кто-то из нас тихо сел рядом — и ты уснул{Р:|а}, уткнувшись носом в тёплую ладонь.",
        scene: "night, a dim lamp, the owner sitting on the floor beside the pet, the pet falling asleep with its nose against the owner's hand",
      },
      {
        text: "Мы учились понимать тебя: когда ты {Р:голоден|голодна}, когда хочешь играть, а когда — чтобы тебя просто не трогали. А ты учил{Р:ся|ась} понимать нас. По-моему, у тебя получалось быстрее.",
        scene: "the owner and the pet looking at each other attentively, a toy and a bowl between them, a gentle learning moment",
      },
      {
        text: "С тобой дом зазвучал по-новому. Шорох лап в коридоре. Звон миски. Сонное сопение по вечерам. Мы и не знали, как тихо у нас было раньше.",
        scene: "the pet trotting along the hallway, a bowl on the kitchen floor, evening light, a cozy lived-in home",
      },
      {
        text: "Ты научил{Р:|а} нас простым вещам. Что утро начинается с радости. Что солнечное пятно на полу — лучшее место на свете. Что обниматься можно без всякого повода.",
        scene: "the pet stretched out in a warm patch of sunlight on the floor, the owner lying down next to it",
      },
      {
        text: "Иногда ты шалишь. Пропадают носки, на тёмном свитере появляется шерсть, а на столе — следы лап. Мы ворчим понарошку. Потому что даже твои шалости — уже часть нашего дома.",
        scene: "the pet looking innocent next to a stolen sock, pet hair on a dark sweater, the owner pretending to be stern but smiling",
      },
      {
        text: "Теперь трудно вспомнить, как мы жили без тебя. {ДОП1.им} говорит: «Это не мы тебя выбрали. Это ты выбрал{Р:|а} нас». И, кажется, это правда.",
        scene: "the owner sitting on the sofa with the pet on their lap, looking at old photos together",
      },
      {
        text: "Вот и вся история, {ЛАСКОВО.им}. История о том, как в один обычный день наш дом стал по-настоящему домом. Спи сладко. Мы рядом.",
        scene: "the pet asleep in its favorite spot in the evening, the owner covering it gently with a soft blanket, warm lamp light",
      },
    ],
    occasionHooks: {
      "poyavlenie-pitomca": { opening: "", closing: "" },
      "den-rozhdeniya": {
        opening: "Сегодня твой день рождения, {ЛАСКОВО.им}. И это лучший повод вспомнить ещё один важный день — тот, когда ты {Р:пришёл|пришла} в наш дом.",
        closing: "С днём рождения, {ЛАСКОВО.им}! Мы так рады, что ты у нас есть.",
        openingScene: "a small birthday treat with a candle next to the pet bed",
        closingScene: "the family celebrating the pet's birthday with a small treat cake and a festive bow",
      },
      "den-pitomca": {
        opening: "Сегодня День домашних животных. А значит, сегодня твой праздник, {ЛАСКОВО.им}, — и самое время рассказать тебе одну историю.",
        closing: "С праздником, {ЛАСКОВО.им}! Без тебя наш дом был бы просто квартирой.",
        openingScene: "a festive bow and a new toy on the pet bed",
        closingScene: "the pet with a festive bow surrounded by its family",
      },
      "novyj-god": {
        opening: "Под Новый год, когда в доме пахнет хвоей и мандаринами, хорошо вспоминать самое важное, что случилось с нами.",
        closing: "С Новым годом, {ЛАСКОВО.им}! Пусть он будет таким же тёплым, как тот самый первый день.",
        openingScene: "a decorated New Year tree in the corner, snow outside",
        closingScene: "the pet asleep under the glowing New Year tree, snow falling outside",
      },
      default: {
        opening: "Сегодня у нас особенный день — {ПОВОД}. И это самый подходящий повод рассказать тебе одну историю.",
        closing: "Пусть этот праздник — {ПОВОД} — будет таким же тёплым, как тот самый первый день, когда ты {Р:пришёл|пришла} в наш дом.",
      },
    },
  },
];

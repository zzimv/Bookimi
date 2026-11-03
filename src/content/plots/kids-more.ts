// Детские сюжеты, добавленные 02.11.2026 (решение владелицы: три возрастные группы, ≥ 7 тем в каждой).
// Каждая книга — ровно одна группа: kids-2-4 (2–4), kids-5-7 (5–7) или kids-8-10 (8–10). Тексты фиксированы:
// покупатель получает ровно этот текст — подставляются только имена, формы рода, доп. герои и крючки поводов.
// Правила меток — docs/content/ARCHITECTURE.md; группа (класс) — раздел «Группа».
//
// 2–4: «[Имя] и большая лужа» (повторялка), «[Имя] идёт в садик» (весёлые стихи).
// 8–10: «Пока, начальная школа!» (класс, до 40 имён), «[Имя] и загадка каменных следов» (детектив),
//       «[Имя] и космодром во дворе» (научная история), «[Имя] и команда с нашего двора» (уютное приключение).
//
// requests (интегратору): для выпускного из начальной школы нет детского повода — «vypusknoj-v-shkole» только TEEN.
// Книга «Пока, начальная школа!» пока на поводе «bez» (и «свой повод»); нужен ключ вроде «vypusknoj-iz-nachalnoj-shkoly»
// (CHILD, май) или CHILD в аудиториях «vypusknoj-v-shkole» — тогда добавить его в occasions/coreOccasions.

import type { Plot } from "../types";

export const KIDS_MORE_PLOTS: Plot[] = [
  // ───────────────────────────── 2–4 · Большая лужа · повторялка ─────────────────────────────
  {
    slug: "imya-i-bolshaya-luzha",
    audience: "CHILD",
    segments: ["kids-2-4"],
    title: "[Имя] и большая лужа",
    tagline: "Сказка-цепочка про дождик: шлёп-шлёп — и в лужу к малышу прыгают все-все-все.",
    description:
      "Дождик кончился, а во дворе — лужа, большая-пребольшая! Ваш малыш в резиновых сапожках шлёпает в самую серединку, и к нему по одному прыгают воробей, уточка, лягушка, щенок, котёнок-чистюля, гусь и самая медленная улитка. Раз, два, три — бульк! — и над лужей радуга. Повторы, звукоподражания и тёплый сонный финал.",
    ageMin: 2,
    ageMax: 4,
    occasions: ["bez", "den-rozhdeniya", "rozhdenie-brata-ili-sestry"],
    textStyle: "cumulative-bedtime",
    artStyles: ["watercolor-air", "soft-gouache", "naive-watercolor"],
    theme: "yard",
    heroKind: "child",
    extras: { roles: ["sibling", "pet", "friend", "toy", "mom", "dad"], min: 0, max: 3 },
    interests: ["животные", "прогулки"],
    coverScene:
      "the child in yellow rubber boots and a raincoat jumping into a huge puddle in a green courtyard after rain, a sparrow, a duck, a frog, a puppy, a kitten, a goose and a snail lined up behind, a rainbow in the sky",
    spreads: [
      {
        text: "Кап-кап-кап — прошёл дождик.\nА во дворе — лужа. Большая-пребольшая!\n{ГЕРОЙ.им} в резиновых сапожках — топ-топ —\nи шлёп! Прямо в серединку.",
        scene: "a green courtyard after rain with a huge puddle, the child in yellow rubber boots and a raincoat stepping into the middle with a splash", cast: [],
      },
      {
        text: "Чик-чирик — воробей-скакунок.\n— Кто-кто в луже шлёпает?\n— Я, {ГЕРОЙ.им}! Прыгай ко мне!\nВоробей — за {ГЕРОЙ.тв}. Шлёп-шлёп!",
        scene: "a little sparrow hopping into the puddle behind the child, both splashing happily", cast: ["sparrow"],
      },
      {
        text: "Кря-кря — уточка-плескуша.\n— Кто-кто в луже шлёпает?\n— Мы шлёпаем! Прыгай к нам!\nУточка — за воробьём, воробей — за {ГЕРОЙ.тв}. Шлёп-шлёп!",
        scene: "a duck waddling into the puddle behind the sparrow, the child at the front splashing", cast: ["sparrow", "duck"],
      },
      {
        text: "Ква-ква — лягушка-квакушка.\n— Кто-кто в луже шлёпает?\n— Мы шлёпаем! Прыгай к нам!\nЛягушка — за уточкой, уточка — за воробьём, воробей — за {ГЕРОЙ.тв}. Шлёп-шлёп!",
        scene: "a green frog leaping into the puddle and joining the line behind the duck and the sparrow, the child leading", cast: ["sparrow", "duck", "frog"],
      },
      {
        text: "Гав-гав — щенок-лохматик.\n— Кто-кто в луже шлёпает?\n— Мы шлёпаем! Прыгай к нам!\nЩенок — за лягушкой, лягушка — за уточкой, уточка — за воробьём, воробей — за {ГЕРОЙ.тв}. Шлёп-шлёп!",
        scene: "a shaggy puppy bounding into the puddle at the end of the line of animals, water splashing, the child laughing", cast: ["sparrow", "duck", "frog", "dog"],
      },
      {
        text: "Мяу — котёнок-чистюля.\n— Кто-кто в луже шлёпает?\n— Мы шлёпаем! Прыгай к нам!\n— Мяу… Только одной лапкой!\nКотёнок — за щенком, и все-все-все — за {ГЕРОЙ.тв}. Шлёп — чуть-чуть.",
        scene: "a neat little kitten carefully dipping just one paw into the puddle behind the puppy, the line of animals and the child smiling", cast: ["sparrow", "duck", "frog", "dog", "cat"],
      },
      {
        text: "Га-га-га — гусь-гоготун.\n— Кто-кто в луже шлёпает?\n— Мы шлёпаем! Прыгай к нам!\nГусь — за котёнком, и все-все-все — за {ГЕРОЙ.тв}. Шлёп-шлёп!",
        scene: "a big white goose marching into the puddle behind the kitten, the long happy line of animals behind the child", cast: ["sparrow", "duck", "frog", "dog", "cat", "goose"],
      },
      {
        text: "Тихо-тихо — улитка-тихоня. Самая медленная.\n— Кто-кто в луже шлёпает?\n— Мы шлёпаем! Ползи к нам!\nУлитка — за гусем, и все-все-все — за {ГЕРОЙ.тв}.\nЖдём… ждём… Приползла!",
        scene: "a tiny snail slowly crawling to the edge of the puddle at the end of the line, all the animals and the child waiting patiently", cast: ["sparrow", "duck", "frog", "dog", "cat", "goose", "snail"],
      },
      {
        text: "Все в ряд. Все в луже. Все готовы.\n{ГЕРОЙ.им} считает:\n— Раз… два… ТРИ!",
        scene: "the child and all the animals standing in a row in the puddle, ready to jump, the child counting on fingers", cast: ["sparrow", "duck", "frog", "dog", "cat", "goose", "snail"],
      },
      {
        text: "БУЛЬК! — прыгнули все-все-все!\nБрызги — до самого неба.\nА на небе — радуга.\nВот это лужа!",
        scene: "a huge joyful splash as the child and all the animals jump together, water drops flying, a bright rainbow appearing in the sky", cast: ["sparrow", "duck", "frog", "dog", "cat", "goose", "snail"],
      },
      {
        text: "Выглянуло солнышко.\nВоробей отряхнулся. Щенок отряхнулся. Гусь отряхнулся.\nКотёнок умывается — он ведь чистюля.\nА улитка… всё ещё ползёт. Пока, лужа!",
        scene: "the sun coming out over the courtyard, the animals shaking off water, the kitten washing its face, the snail still crawling, the child waving goodbye to the puddle", cast: ["sparrow", "duck", "frog", "dog", "cat", "goose", "snail"],
      },
      {
        text: "Сапожки сохнут у двери.\nНоски — тёплые. Одеяло — мягкое.\nЗа окном опять: кап-кап-кап…\nСпи, {ЛАСКОВО.им}. Завтра будет новая лужа.",
        scene: "a cozy bedroom in the evening, yellow rubber boots drying by the door, the child asleep under a soft blanket, gentle rain on the window", cast: [],
      },
    ],
    occasionHooks: {
      "den-rozhdeniya": {
        opening: "Сегодня у {ГЕРОЙ.род} день рождения. Ура!",
        closing: "Пусть и во сне будет праздник. С днём рождения, {ЛАСКОВО.им}!",
        openingScene: "a few colorful balloons tied to a courtyard bench",
        closingScene: "a small birthday cake with candles on the windowsill",
      },
      "rozhdenie-brata-ili-sestry": {
        opening: "Скоро у {ГЕРОЙ.род} будет малыш — братик или сестричка.",
        closing: "А когда малыш подрастёт, {ГЕРОЙ.им} покажет ему самую большую лужу. Шлёп-шлёп — вместе веселей!",
        openingScene: "a tiny knitted baby hat on the courtyard bench",
        closingScene: "a little cradle next to the bed",
      },
      default: { opening: "Сегодня особенный день — {ПОВОД}.", closing: "Пусть и праздник — {ПОВОД} — снится до утра." },
    },
  },

  // ───────────────────────────── 2–4 · Идёт в садик · весёлые стихи ─────────────────────────────
  {
    slug: "imya-idyot-v-sadik",
    audience: "CHILD",
    segments: ["kids-2-4"],
    title: "[Имя] идёт в садик",
    tagline: "Весёлые стихи про первый день в детском саду: шкафчик с вишенкой, новые друзья и обещание — вечером домой.",
    description:
      "Первый день в садике — большое событие. Ваш малыш берёт с собой плюшевого зайку и смело идёт знакомиться: шкафчик с вишенкой, горка и кубики, музыка, обед, прогулка, тихий час и рисунок для дома. А вечером, как и обещали, за ним приходят. Звонкие стихи помогают привыкнуть к саду и ждать завтрашнего утра.",
    ageMin: 2,
    ageMax: 4,
    occasions: ["bez", "den-rozhdeniya"],
    textStyle: "funny-verse",
    artStyles: ["kind-classic", "watercolor-air", "soft-gouache"],
    theme: "school",
    heroKind: "child",
    extras: { roles: ["mom", "dad", "grandma", "grandpa", "sibling", "toy"], min: 0, max: 3 },
    interests: ["игры", "музыка", "рисование"],
    coverScene:
      "the child holding a plush bunny walking into a bright kindergarten in the morning, colorful lockers with fruit pictures, toys and a small slide visible through the open door",
    spreads: [
      {
        text: "Утро. Солнышко встаёт.\nКто сегодня в сад идёт?\n— {ГЕРОЙ.им}!\nЗайка — тоже, он со мной.\nВечером пойдём домой!",
        scene: "morning, the child getting ready to go to kindergarten for the first time, holding a plush bunny, sunlight through the window", cast: ["hare"],
      },
      {
        text: "Вот и садик. Тук-тук-тук!\nШкафчик с вишенкой — мой друг.\nШапку, куртку и сапожки\nСпрячем. Тапочки — на ножки!",
        scene: "a kindergarten cloakroom with small colorful lockers with fruit pictures, the child putting boots into a locker with a cherry picture and putting on slippers, the bunny peeking out", cast: ["hare"],
      },
      {
        text: "Ах, какая группа! Вот:\nМяч, лошадка, самолёт,\nКубики, большая горка,\nБарабан, совок, ведёрко!",
        scene: "a bright kindergarten playroom full of toys: a ball, a rocking horse, a toy plane, blocks, a small slide, a drum, a bucket and spade, the child looking around in delight", cast: [],
      },
      {
        text: "Нас встречают: «Здравствуй, друг!\nСтановись скорей в наш круг!»\nХлоп — ладошки! Топ — ногами!\nЗайка тоже пляшет с нами.",
        scene: "a kind kindergarten teacher welcoming the child, children standing in a circle clapping and stamping, the plush bunny dancing in the circle too", cast: ["hare"],
      },
      {
        text: "Строим башню — выше всех!\nКубик, кубик… Бух! — и смех.\nТут же новые друзья:\n«Строим снова! Ты и я!»",
        scene: "the child and two new little friends building a tall tower of colorful blocks that tumbles down, everyone laughing", cast: [],
      },
      {
        text: "Музыкальный зал! Дин-дон!\nКолокольчик, бубен, звон.\nВсе поют: «Ля-ля-ля-ля!»\nДаже зайка. Даже я!",
        scene: "a kindergarten music room with a piano, children singing and playing little bells and tambourines, the child singing loudly holding the bunny", cast: ["hare"],
      },
      {
        text: "Время кушать! Ложка — дзынь!\nСуп, подуем: «Фу! Остынь!»\nКаша — ам! И хлеба крошка —\nЗайке тоже. Понарошку.",
        scene: "children at small tables at lunch in kindergarten, the child blowing on a spoon of soup and pretending to feed the plush bunny a crumb", cast: ["hare"],
      },
      {
        text: "На прогулку! Вжух — качели:\nВверх и вниз — и полетели!\nА в песочнице — пирог,\nПирожок и колобок!",
        scene: "a kindergarten playground, the child flying high on a swing, sand pies and a sand bun in a sandbox with new friends", cast: [],
      },
      {
        text: "Тихий час. Подушка. Плед.\nШторы прячут солнца свет.\nЗайка рядом, зайка мой…\nВечером пойдём домой.",
        scene: "nap time in a cozy kindergarten bedroom with small beds and drawn curtains, the child dozing off hugging the bunny", cast: ["hare"],
      },
      {
        text: "Краски, кисточка, листок:\nСолнце, домик и цветок.\nНарисую — и потом\nОтнесу рисунок в дом.",
        scene: "the child painting a picture of a sun, a house and a flower at a small table, paints and brushes around, the bunny watching", cast: ["hare"],
      },
      {
        text: "Вот и вечер. Скрип — и вот:\n— {ГЕРОЙ.им}!\n«За тобой пришли!» Вперёд!\nКрепко обнимаю — ах!\nЗайка тоже — на руках.",
        scene: "evening at the kindergarten door, a family member arriving with open arms, the child running into a big hug holding the bunny and the painting", cast: ["hare"],
      },
      {
        text: "Дома — ужин, сказка, плед.\n«Ну, как садик?» — «Лучше нет!\nЗавтра снова в сад пойдём —\nЯ и зайка. Мы вдвоём!»",
        scene: "a cozy evening at home, the child in pajamas telling the family about kindergarten, the painting on the fridge, the bunny on the pillow", cast: ["hare"],
      },
    ],
    occasionHooks: {
      "den-rozhdeniya": {
        opening: "День рождения! Ура!\nВ садик нам идти пора.",
        closing: "Торт на блюдце, в торте — свечи.\nФу! — задули… Чудный вечер!",
        openingScene: "balloons tied to the bed and a small gift box",
        closingScene: "a birthday cake with candles on the family table",
      },
      default: {
        opening: "Нынче — праздник! Вот какой:\n{ПОВОД}!",
        closing: "Ну а праздник — праздник наш!\nЗайка, пляшем! Ну-ка, марш!",
      },
    },
  },

  // ───────────────────────────── 8–10 · Выпускной из начальной школы · класс ─────────────────────────────
  {
    slug: "poka-nachalnaya-shkola",
    audience: "CHILD",
    segments: ["kids-8-10"],
    title: "Пока, начальная школа!",
    tagline: "Капсула времени из первого класса, пять заданий от себя семилетних — и последняя неделя начальной школы всем классом.",
    description:
      "За пять дней до выпускного из начальной школы первый учитель класса достаёт из шкафа коробку с надписью «Открыть в 4 классе». Это капсула времени, которую ребята собрали в первую неделю первого класса, а в ней — пять заданий от себя семилетних: узнать, сколько будет семью восемь, проверить, дорос ли фикус до потолка, обыграть в футбол соседний класс, разведать третий этаж и сказать первой учительнице большое спасибо. Тёплая и смешная книга о четырёх годах вместе и о переходе в пятый класс. По имени звучит каждый одноклассник (до 40 человек) и учителя, а в конце — фотография класса со всеми именами.",
    ageMin: 8,
    ageMax: 10,
    occasions: ["okonchanie-nachalnoj-shkoly", "bez"],
    coreOccasions: ["okonchanie-nachalnoj-shkoly"],
    textStyle: "cozy-adventure",
    artStyles: ["cozy-detail", "ink-humor", "kind-classic"],
    theme: "school",
    heroKind: "child",
    extras: { roles: ["sibling", "mom", "dad", "pet"], min: 0, max: 3, note: "Одноклассники и учителя — в отдельном списке «Наш класс»" },
    group: {
      min: 1,
      max: 40,
      label: "класс",
      includeAdults: { roles: ["учитель"], max: 3 },
      note: "Впишите одноклассников (до 39 имён, без героя) и первого учителя — каждый появится в книге по имени",
    },
    interests: ["спорт", "растения", "математика", "школа"],
    coverScene:
      "a fourth-grade class on the steps of a primary school in late May with balloons and ribbons, the child in the middle holding an old opened cardboard time capsule box, a tall potted ficus beside, a kind teacher smiling",
    spreads: [
      {
        text: "До выпускного из начальной школы оставалось пять дней. {ГЕРОЙ.им} оглядел{Р:|а} класс и вдруг понял{Р:|а}: четыре года — в одном кабинете, за одной партой у окна, под один и тот же скрип третьей половицы. А в сентябре — пятый класс: другой этаж, у каждого предмета свой кабинет и свой учитель. Здорово! Только как же наш класс? [[?ВОСПИТАТЕЛЬ1:И тут {ВОСПИТАТЕЛЬ.им} {РВ:достал|достала} из шкафа коробку, заклеенную крест-накрест. || И тут наша первая учительница достала из шкафа коробку, заклеенную крест-накрест.]] На крышке было выведено: «Открыть в 4 классе».",
        scene: "a sunny primary school classroom in late May, the child at a desk by the window looking around thoughtfully, {GROUP_ADULTS} taking a taped cardboard box out of a cupboard, {GROUP} at their desks", cast: [],
      },
      {
        text: "Это была капсула времени! Её собрали в первую неделю первого класса — и честно забыли. Внутри лежали рисунки, фотографии и записки, написанные огромными буквами. [[?ДРУГ1:{ДРУГ1.им} {РД1:вытащил|вытащила|вытащили} рисунок «Мы в 4 классе»: великаны с портфелями, ростом до облаков.]] [[?ДРУГ2:{ДРУГ2.им} {РД2:узнал|узнала|узнали} себя на фотографии с первой линейки и {РД2:потребовал|потребовала|потребовали} немедленно её засекретить.]] А на самом дне нашёлся листок в клеточку: «Задание для 4 класса. Проверить пять вещей».",
        scene: "{GROUP} gathered around an opened time capsule box on a desk, old children's drawings of giants with backpacks, photos from the first day of school, a sheet of checked paper with a big handwritten list", cast: [],
      },
      {
        text: "Пункт первый: «Узнать, сколько будет семью восемь». В первом классе это казалось главной тайной вселенной. [[?ДРУГ3:{ДРУГ3.им} {РД3:ответил|ответила|ответили} раньше, чем пункт дочитали до конца: «Пятьдесят шесть!»]] [[?ДРУГ4:{ДРУГ4.им} тут же {РД4:поделился|поделилась|поделились} секретным способом: пишешь подряд 5, 6, 7, 8 — и получается 56 = 7 × 8.]] {ГЕРОЙ.им} поставил{Р:|а} первую галочку. Задачка, над которой когда-то думали всем классом, теперь решалась за секунду. Значит, за четыре года кое-что всё-таки изменилось.",
        scene: "a chalkboard with the numbers 5 6 7 8 and 56 = 7 x 8 written in chalk, {GROUP} laughing and raising hands, the child ticking the first item on the list", cast: [],
      },
      {
        text: "Пункт второй: «Проверить, дорос ли наш фикус до потолка». Фикус Фёдор приехал в класс веточкой в стаканчике, а теперь стоял в большом горшке и упирался листьями в карниз. [[?ДРУГ5:{ДРУГ5.им} {РД5:принёс|принесла|принесли} рулетку: метр восемьдесят!]] [[?ДРУГ6:{ДРУГ6.им} {РД6:напомнил|напомнила|напомнили}, почему Фёдора каждую неделю поворачивали: растения тянутся к свету, иначе он вырос бы боком. Учёные называют это фототропизмом.]] До потолка Фёдор не дорос. «Засчитываем, — решил{Р:|а} {ГЕРОЙ.им}. — Он очень старался».",
        scene: "a tall ficus plant in a big pot reaching up to the curtain rail by the classroom window, {GROUP} measuring it with a tape measure, the child laughing", cast: [],
      },
      {
        text: "Пункт третий: «Обыграть в футбол соседний класс». Вызов отправили по всем правилам: на тетрадном листе, с печатью из ластика. После уроков у школьной площадки собрались болельщики. [[?ДРУГ7:{ДРУГ7.им} {РД7:стоял|стояла|стояли по очереди} на воротах и {РД7:взял|взяла|взяли} пенальти в прыжке — как на фотографии из спортивного журнала.]] [[?ДРУГ8:{ДРУГ8.им} {РД8:забил|забила|забили} гол пяткой — случайно, но очень красиво.]] Матч закончился вничью, 3:3. Посовещавшись, оба класса решили: ничья — тоже победа, если четыре года гоняешь мяч на одной площадке.",
        scene: "a school sports ground after lessons, a friendly football match between two classes, {GROUP} playing and cheering, a goalkeeper diving for a penalty, the child running with the ball", cast: [],
      },
      {
        text: "Пункт четвёртый: «Разведать, что на третьем этаже». Там учились пятиклассники, и про этаж ходили легенды. Класс отправился на разведку. Легенды подтвердились: в кабинете географии висела карта мира во всю стену, а в кабинете биологии жила черепаха по имени Профессор. [[?ДРУГ9:{ДРУГ9.им} {РД9:выяснил|выяснила|выяснили}, что в пятом классе появятся история, биология и география.]] [[?ДРУГ10:{ДРУГ10.им} {РД10:сосчитал|сосчитала|сосчитали} кабинеты: у каждого предмета — свой, и на переменах придётся переходить из кабинета в кабинет, как в университете.]] Выглядело это как начало большого приключения.",
        scene: "a school corridor on the third floor, {GROUP} peeking into a geography classroom with a wall-sized world map and a biology classroom with a tortoise in a terrarium, the child leading the expedition", cast: [],
      },
      {
        text: "Оставался последний пункт, выведенный самыми большими буквами: [[?ВОСПИТАТЕЛЬ1:«Сказать спасибо {ВОСПИТАТЕЛЬ.дат}. БОЛЬШОЕ!» || «Сказать спасибо нашей учительнице. БОЛЬШОЕ!»]] Просто сказать — мало: за четыре года всего набралось слишком много. {ГЕРОЙ.им} предложил{Р:|а} сделать книгу «Чему мы научились», где у каждого будет своя страница. [[?ДРУГ11:{ДРУГ11.им} {РД11:написал|написала|написали}: «Выходить к доске и не терять голос».]] [[?ДРУГ12:{ДРУГ12.им} {РД12:написал|написала|написали}: «Спорить можно. Ссориться — необязательно».]]",
        scene: "{GROUP} secretly making a handmade book at their desks, colored pencils, paper pages and glue, the child holding up the cover", cast: [],
      },
      {
        text: "Книгу делали тайно: на переменах, в библиотеке и под партами. Это оказалось сложнее любой контрольной. [[?ДРУГ13:{ДРУГ13.им} {РД13:рисовал|рисовала|рисовали} обложку и {РД13:прятал|прятала|прятали} её в папку «Скучные таблицы» — туда точно никто не заглянет.]] [[?ВОСПИТАТЕЛЬ1:Однажды {ВОСПИТАТЕЛЬ.им} {РВ:вошёл|вошла} в класс в самый разгар работы. || Однажды учительница вошла в класс в самый разгар работы.]] [[?ДРУГ14:{РД14:Первым нашёлся|Первой нашлась|Первыми нашлись} {ДРУГ14.им}: «А мы репетируем!» || Кто-то шепнул: «Мы репетируем!»]] Весь класс тут же запел — громко и почти в лад. Песню потом пришлось выучить по-настоящему.",
        scene: "{GROUP} hiding drawings and pages under desks and in folders, {GROUP_ADULTS} entering the classroom, the whole class suddenly singing with wide innocent eyes, the child conducting", cast: [],
      },
      {
        text: "В пятницу актовый зал украсили шарами. Первоклассники читали стихи, родители снимали на телефоны, а четвёртый класс волновался так, что скрипели стулья. Когда пришла их очередь, {ГЕРОЙ.им} {Р:вышел|вышла} вперёд с книгой в руках. [[?ВОСПИТАТЕЛЬ1:— Это вам, {ВОСПИТАТЕЛЬ.им}. Пункт пятый. || — Это вам. Пункт пятый.]] [[?ВОСПИТАТЕЛЬ2:{ВОСПИТАТЕЛЬ2.им} одобрительно {РВ2:кивнул|кивнула} из первого ряда.]] [[?ВОСПИТАТЕЛЬ3:{ВОСПИТАТЕЛЬ3.им} {РВ3:показал|показала} большой палец.]] В зале стало очень тихо.",
        scene: "a school assembly hall decorated with balloons for the primary school graduation, parents with phones, the child stepping forward and handing a handmade book to {GROUP_ADULTS}, {GROUP} watching excitedly", cast: [],
      },
      {
        text: "[[?ВОСПИТАТЕЛЬ1:{ВОСПИТАТЕЛЬ.им} {РВ:листал|листала} книгу долго и всё время отворачивал{РВ:ся|ась} к окну. А потом {РВ:достал|достала} старую тетрадь: — А это мой список. Я составил{РВ:|а} его первого сентября, четыре года назад. || Учительница листала книгу долго и всё время отворачивалась к окну. А потом достала старую тетрадь: — А это мой список. Я составила его первого сентября, четыре года назад.]] Напротив каждого имени было написано, кто о чём мечтал и чего стеснялся. А рядом стояли свежие галочки. Оказывается, проверку проводили с двух сторон.",
        scene: "{GROUP_ADULTS} holding the handmade book and an old notebook with a list of names, touched and smiling, {GROUP} gathered close looking at fresh tick marks next to their names", cast: [],
      },
      {
        text: "[[?ГРУППА:После праздника весь класс сфотографировался на школьном крыльце — на память о начальной школе. Вот мы все, по именам: {ПЕРЕКЛИЧКА}. || После праздника {ГЕРОЙ.им} и {Р:его|её} одноклассники сфотографировались на школьном крыльце — всем классом.]] [[?ВОСПИТАТЕЛЬ1:Рядом — {ВОСПИТАТЕЛЬ.им}, как все четыре года. || Рядом — наша первая учительница, как все четыре года.]] Фикус Фёдор тоже попал в кадр: его вынесли на крыльцо специально.",
        scene: "a class photo on the school steps after the primary school graduation: {GROUP} standing in rows with flowers and ribbons, the child in the very middle of the front row, {GROUP_ADULTS} beside them, a tall potted ficus at the edge", cast: [],
      },
      {
        text: "Вечером {ГЕРОЙ.им} писал{Р:|а} письмо для новой капсулы — её решили открыть в одиннадцатом классе. «Привет из четвёртого! Проверь: семью восемь — всё ещё пятьдесят шесть? Фёдор дорос до потолка? Мы всё ещё здороваемся, когда встречаемся в коридоре?» {ГЕРОЙ.им} подумал{Р:|а} и дописал{Р:|а}: «Пятый класс — это много новых дверей. Но наш класс — всё равно наш». И поставил{Р:|а} подпись.",
        scene: "evening at home, the child at a desk writing a letter for a new time capsule, the class photo propped up by the lamp, a small box ready on the shelf", cast: [],
      },
    ],
    occasionHooks: {
      "okonchanie-nachalnoj-shkoly": { opening: "", closing: "" },
      bez: { opening: "", closing: "" },
      default: { opening: "", closing: "А этот день — {ПОВОД} — класс тоже запомнит надолго." },
    },
  },

  // ───────────────────────────── 8–10 · Загадка каменных следов · детектив ─────────────────────────────
  {
    slug: "imya-i-zagadka-kamennyh-sledov",
    audience: "CHILD",
    segments: ["kids-8-10"],
    title: "[Имя] и загадка каменных следов",
    tagline: "Палеонтологический детектив: кто прошёл по берегу древнего озера — и почему вдруг замедлил шаг?",
    description:
      "Летом ваш ребёнок едет с палеонтологической экспедицией к старому карьеру у реки. После ливня на плите песчаника проступает цепочка трёхпалых следов. Кто их оставил? Какого он был роста? Шёл или бежал? Сыщик проверяет улики настоящими методами палеонтологов: меряет следы, ставит опыт на мокром песке, ждёт низкого вечернего солнца — и раскрывает самую тёплую тайну юрского периода. Честная загадка, ложный след и настоящие научные факты.",
    ageMin: 8,
    ageMax: 10,
    occasions: ["bez", "den-rozhdeniya"],
    textStyle: "detective",
    artStyles: ["cozy-detail", "ink-humor", "pen-ink-1920s"],
    theme: "dino",
    heroKind: "child",
    extras: { roles: ["friend", "sibling", "dad", "mom", "grandpa", "grandma"], min: 0, max: 3 },
    interests: ["динозавры", "наука", "природа", "загадки"],
    coverScene:
      "the child with a notebook and a tape measure kneeling on a big sandstone slab with a trail of large three-toed dinosaur footprints and a trail of small ones beside it, a quarry by a river in golden evening light, a scientist and a scruffy dog nearby",
    spreads: [
      {
        text: "Летом {ГЕРОЙ.им} {Р:поехал|поехала} с палеонтологической экспедицией к старому карьеру у реки. Начальница экспедиции Нина Петровна говорила, что здешним камням больше ста пятидесяти миллионов лет. Ночью прошёл ливень, а утром вода смыла глину с большой плиты песчаника — и на ней проступила цепочка следов. Три пальца, как у огромной курицы. {ГЕРОЙ.им} открыл{Р:|а} блокнот и записал{Р:|а}: «Дело: кто здесь прошёл?»",
        scene: "a sandy quarry by a river after rain, a big sandstone slab washed clean with a trail of large three-toed footprints, a scientist woman in a wide hat, the child opening a notebook", cast: ["scientist", "tracks"],
      },
      {
        text: "Расследование началось с места происшествия. Каждый след — длиной с большую школьную линейку, тридцать сантиметров. Пальцы узкие, а на концах — острые отметины когтей. «Улика № 1», — записал{Р:|а} {ГЕРОЙ.им}. Нина Петровна кивнула: — У хищных динозавров, тероподов, следы узкие и с когтями. У растительноядных пальцы широкие и тупые, как варежки. — Значит, хищник, — сказал{Р:|а} {Р:он|она}. — Но очень давний. Можно не волноваться.",
        scene: "close-up of the child measuring a three-toed footprint with a ruler, sharp claw marks at the tips, the scientist explaining with a sketch of a theropod foot", cast: ["scientist", "tracks"],
      },
      {
        text: "Свидетелей не было: последний ушёл миллионы лет назад. Пришлось допрашивать камень. По плите тянулись волнистые бороздки — рябь, как на песке у самого берега, когда по мелководью бегут волны. «Улика № 2: здесь был берег озера», — записал{Р:|а} {ГЕРОЙ.им}. А Нина Петровна подсказала правило палеонтологов: длина следа, умноженная на четыре, — примерно высота ноги до бедра. Тридцать на четыре — метр двадцать. Одна нога — почти как первоклассник целиком!",
        scene: "the sandstone slab with wavy ripple marks like a lake shore, the child holding up a measuring stick 1.2 meters tall, a funny notebook drawing of a dinosaur leg next to a first-grader", cast: ["tracks"],
      },
      {
        text: "И тут практикант Гоша закричал с другого конца плиты: — Сюда! Здесь был кто-то огромный! В песчанике темнела круглая вмятина размером с таз. «Завропод, — решил{Р:|а} {ГЕРОЙ.им}. — Длинная шея, ноги-колонны». В блокноте появилась строчка: «Подозреваемый: завропод. Размер: очень большой». Но что-то не сходилось. След был один — ни до, ни после. А края у него были подозрительно свежие.",
        scene: "a young student in a cap pointing excitedly at a big round hollow in the stone the size of a washbasin, the child crouching with a notebook, looking suspicious", cast: ["tracks"],
      },
      {
        text: "Настоящий сыщик не обвиняет, а проверяет. {ГЕРОЙ.им} потрогал{Р:|а} вмятину: внутри была мягкая свежая глина. А рядом темнело ровное мокрое кольцо. Тут Гоша хлопнул себя по лбу: вчера на этом месте стояла бочка с водой для промывки находок! Подозрение было снято. — Извини, завропод, — серьёзно сказал{Р:|а} {ГЕРОЙ.им}. — И ты, бочка, извини. — Бочка не обижается, — заверил Гоша.",
        scene: "the child touching soft fresh clay in the round hollow, a wet ring mark on the ground beside it, the student laughing and pointing at a water barrel standing nearby", cast: [],
      },
      {
        text: "Тут {ГЕРОЙ.им} заметил{Р:|а} то, что пропустили все. Рядом с большими следами шла вторая цепочка — следы втрое меньше, длиной с ладонь. Маленькие шаги шли часто-часто. «Улика № 3», — появилось в блокноте. Дважды подчёркнуто. А ещё оказалось, что в начале плиты большие следы стоят далеко друг от друга, а там, где появились маленькие, — гораздо ближе. Большой динозавр почему-то пошёл медленнее.",
        scene: "the child kneeling and pointing at a second trail of small three-toed footprints running beside the large ones, the large footprints getting closer together, a tape measure stretched along", cast: ["tracks"],
      },
      {
        text: "Догадку надо было проверить опытом. На мокром песке у реки {ГЕРОЙ.им} сначала {Р:прошёл|прошла} шагом, а потом пробежал{Р:|а}. Нина Петровна измерила следы рулеткой. Полный шаг — от следа левой ноги до следующего следа той же ноги — на бегу вышел вдвое длиннее. Учёные пользуются правилом: если полный шаг короче двух высот ноги, животное шло, а если длиннее трёх — бежало. Правило работает и для людей, и для динозавров.",
        scene: "the child running along wet river sand leaving footprints, the scientist measuring the distance between footprints with a long tape measure, a scruffy dog running along", cast: ["scientist", "dog", "tracks"],
      },
      {
        text: "Вечером экспедиция вернулась к плите. Палеонтологи любят низкое солнце: длинные тени ложатся в каждую ямку, и проступают следы, которых днём не видно. Так и вышло. Когда солнце опустилось к реке, обе цепочки потянулись дальше — до самого обрыва. Пёс экспедиции Гравий на всякий случай обнюхал каждый след. «Наблюдение, — записал{Р:|а} {ГЕРОЙ.им}. — Свидетель Гравий ничего не сообщил».",
        scene: "the quarry at sunset, low golden light revealing many more footprints on the stone with deep shadows, two trails leading to a cliff edge, the child and the scientist watching, a dog sniffing a footprint", cast: ["scientist", "dog", "tracks"],
      },
      {
        text: "{ГЕРОЙ.им} разложил{Р:|а} улики вслух: — Нога большого — метр двадцать. Сначала его полный шаг был два шестьдесят: больше двух высот ноги, но меньше трёх. Значит, шёл быстрым шагом. Потом рядом появились маленькие следы, и шаг большого стал всего полтора метра. Он замедлился. А маленький семенил рядом. Большой шёл медленнее, чтобы маленький успевал. Как взрослые, когда гуляют с малышом.",
        scene: "the child explaining with the notebook showing two trails, arrows and numbers, the scientist and the student listening with amazement in the evening light", cast: ["scientist"],
      },
      {
        text: "Нина Петровна долго молчала, а потом улыбнулась: — Доказать на сто процентов нельзя. Но очень похоже на правду: взрослый и детёныш не спеша шли по берегу озера. Такие парные цепочки — большая редкость. Кстати, многие небольшие динозавры были покрыты перьями или пухом. В Забайкалье нашли кулиндадромеуса — маленького динозавра с пухом и чешуёй. Может, и эти двое были пушистыми. Разгадка оказалась тёплой — во всех смыслах.",
        scene: "a dreamy imagined scene above the child and the scientist: a feathered adult dinosaur walking slowly along an ancient lake shore with a fluffy baby dinosaur hurrying beside it", cast: ["dinosaur", "scientist"],
      },
      {
        text: "Следы сфотографировали, зарисовали и сняли с них гипсовые слепки — так палеонтологи сохраняют находку целиком. Слепок маленького следа Нина Петровна вручила {ГЕРОЙ.дат}: «Для школьного музея. Автор открытия должен хранить свою улику». А Гравий наступил в таз с остатками гипса — и в коллекции появился ещё один экспонат. Теперь их было два: одному больше ста пятидесяти миллионов лет, другому — пять минут.",
        scene: "the expedition making white plaster casts of the footprints, the scientist handing the child a plaster cast of a small footprint, the dog stepping into a basin of leftover plaster and leaving a paw print, everyone laughing", cast: ["scientist", "dog"],
      },
      {
        text: "Ночью в палатке было тихо: у входа сопел Гравий, на подушке белел гипсовый слепок. {ГЕРОЙ.им} при свете фонарика дописывал{Р:|а} блокнот: «Дело о каменных следах закрыто. Прошли: двое, взрослый и малыш. Скорость: прогулочная. Причина медленного шага: тот, кто идёт рядом». Потом подумал{Р:|а} и добавил{Р:|а}: «На соседнем камне — отпечаток, похожий на перо. Новое дело?» И подчеркнул{Р:|а} дважды.",
        scene: "night in a cozy expedition tent, the child writing in a notebook by flashlight, the plaster cast of the small footprint beside the pillow, the dog asleep at the entrance, stars outside", cast: ["dog"],
      },
    ],
    occasionHooks: {
      "den-rozhdeniya": {
        opening: "На день рождения {ГЕРОЙ.дат} подарили путёвку в настоящую экспедицию, полевой блокнот и рулетку. Подарок оказался с секретом.",
        closing: "А утром за завтраком вся экспедиция спела {ГЕРОЙ.дат} «С днём рождения». Лучший подарок в тот год оказался старше ста пятидесяти миллионов лет. С днём рождения, {ЛАСКОВО.им}!",
        openingScene: "a birthday card with a dinosaur footprint drawn on it and a new field notebook",
        closingScene: "a camp breakfast table outside the tents with a small birthday cake with candles",
      },
      default: {
        opening: "Эта история случилась накануне особенного дня: совсем скоро — {ПОВОД}.",
        closing: "А на полях блокнота появилась пометка: «{ПОВОД} — не забыть отпраздновать!»",
      },
    },
  },

  // ───────────────────────────── 8–10 · Космодром во дворе · научная история ─────────────────────────────
  {
    slug: "imya-i-kosmodrom-vo-dvore",
    audience: "CHILD",
    segments: ["kids-8-10"],
    title: "[Имя] и космодром во дворе",
    tagline: "Ракета из бутылки, яйцо-космонавт и десять дней до городских стартов — инженерная история с настоящей физикой.",
    description:
      "Через десять дней в городе — соревнования водяных ракет: кто запустит свою выше и вернёт на землю целым сырое яйцо-«космонавта». Ваш ребёнок вместе с соседом, инженером на пенсии, превращает двор в космодром. Ракета кувыркается, падает в клумбу и путает стропы парашюта, а каждую задачу решает настоящая физика: реактивная сила, центр тяжести, сопротивление воздуха и даже немного геометрии.",
    ageMin: 8,
    ageMax: 10,
    occasions: ["bez", "den-rozhdeniya"],
    textStyle: "sci-fi",
    artStyles: ["ink-humor", "cozy-detail", "pen-ink-1920s"],
    theme: "yard",
    heroKind: "child",
    extras: { roles: ["friend", "sibling", "dad", "mom", "grandpa", "grandma"], min: 0, max: 3 },
    interests: ["космос", "наука", "техника", "конструирование"],
    coverScene:
      "a homemade water rocket made from a plastic bottle with red fins blasting off with a spray of water above a green courtyard between apartment blocks, the child counting down by a launch pad with a bicycle pump, an elderly engineer neighbor in a cap watching through binoculars",
    spreads: [
      {
        text: "{ГЕРОЙ.им} давно решил{Р:|а} стать конструктором ракет. Пока что в {Р:его|её} распоряжении были велосипедный насос, моток изоленты и двор между тремя пятиэтажками. А в понедельник на двери подъезда появилось объявление: «Городские старты водяных ракет. Через десять дней. Условие: подняться выше всех и вернуть на землю целым сырое яйцо-космонавта». {ГЕРОЙ.им} перечитал{Р:|а} объявление три раза. Космодром был. Не хватало ракеты.",
        scene: "a courtyard between three five-story apartment blocks, the child reading a bright poster about a water rocket competition on an entrance door, holding a bicycle pump", cast: ["rocket"],
      },
      {
        text: "Главным консультантом стал сосед с пятого этажа Аркадий Львович — инженер на пенсии, который сорок лет конструировал самолёты. Он выслушал {ГЕРОЙ.вин} и достал из кладовки пустую двухлитровую бутылку. — Задача ясна, — сказал он. — Корпус, сопло, стабилизаторы и парашют. А яйцо — отдельная ответственность. Яйцу нарисовали лицо и назвали его Желтком. Так у экипажа появился первый космонавт. До стартов — десять дней.",
        scene: "an elderly engineer neighbor in a knitted vest and glasses holding an empty two-liter plastic bottle in a storage room full of tools, the child holding a raw egg with a tiny drawn face", cast: ["engineer"],
      },
      {
        text: "Первую ракету собрали за вечер: бутылка горлышком вниз, пробка с ниппелем, треть воды. Насос — пш-пш-пш — накачивает воздух, давление растёт, пробка срывается, и вода с силой бьёт вниз. Вода — вниз, ракета — вверх: сила действия равна силе противодействия. Так плавает кальмар и так летают настоящие ракеты. Первая поднялась метра на три, кувыркнулась и шлёпнулась в клумбу. — Отличный старт, — сказал Аркадий Львович. — Теперь мы знаем, что чинить.",
        scene: "a first test launch in the courtyard, a bottle rocket tumbling in the air three meters up with a splash of water, the child and the engineer neighbor watching, a flowerbed below", cast: ["rocket", "engineer"],
      },
      {
        text: "Почему кувыркается? {ГЕРОЙ.им} нарисовал{Р:|а} схему. У ракеты две важные точки: центр тяжести — где она уравновешивается на пальце, и центр давления — куда в полёте давит встречный воздух. Ракета летит ровно, только если центр тяжести впереди центра давления. У них было наоборот. В нос положили комок пластилина, а сзади приклеили три стабилизатора из картонной папки. Теперь ракета летела, как бадминтонный волан: тяжёлым носом вперёд.",
        scene: "the child drawing a rocket diagram with two marked points on graph paper and balancing the bottle rocket on one finger, the engineer gluing three cardboard fins, a lump of modeling clay in the nose cone, a badminton shuttlecock on the table", cast: ["engineer"],
      },
      {
        text: "Следующая задача — сколько наливать воды. Мало — ракете нечем толкаться. Много — она слишком тяжёлая. {ГЕРОЙ.им} {Р:завёл|завела} таблицу: десятая часть бутылки, четверть, треть, половина. Высоту прикидывали по этажам: каждый — примерно три метра. Лучше всего вышло с третью: ракета долетела до четвёртого этажа. Соседка с четвёртого помахала из окна и вежливо попросила не направлять следующий запуск в её герань.",
        scene: "the child writing test results in a table on a clipboard, bottles filled with different amounts of water lined up, the rocket flying past fourth-floor windows, a neighbor waving from a window with geraniums", cast: ["rocket"],
      },
      {
        text: "Третья задача — посадка. На тренировках вместо Желтка летала картофелина, и от неё давно осталось бы пюре. Нужен парашют. Но как ему раскрыться вовремя? {ГЕРОЙ.им} заметил{Р:|а}: в самой высокой точке ракета на миг замирает и разворачивается носом вниз. Значит, обтекатель не надо приклеивать — только надеть сверху. Наверху он соскользнёт и выпустит парашют. Настоящие спускаемые аппараты тоже садятся на парашюте: площадь его купола — около тысячи квадратных метров.",
        scene: "the child folding a small parachute from a plastic bag into the rocket nose, a potato in a tiny harness sitting on the table as a test passenger, a picture of a space capsule descending under a huge parachute pinned on the wall", cast: [],
      },
      {
        text: "Испытание с картофелиной удалось наполовину. Обтекатель слетел, а парашют — нет: стропы перепутались, и купол вывалился комком. Ракета ушла в клумбу второй раз. — Клумба становится космодромом номер два, — вздохнул Аркадий Львович. Вечером {ГЕРОЙ.им} думал{Р:|а} и придумал{Р:|а}: купол складывать гармошкой, стропы укладывать отдельно, а плёнку присыпать тальком, чтобы не слипалась. Так делают ракетомоделисты. Следующая картофелина приземлилась мягко, как на подушку.",
        scene: "the child at a desk in the evening carefully folding a small parachute like an accordion and dusting it with powder, a lamp, the rocket model beside, the courtyard flowerbed visible from the window", cast: [],
      },
      {
        text: "За день до стартов подул ветер. Аркадий Львович прищурился: — Устойчивая ракета, как флюгер, поворачивает нос против ветра. Значит, стартовую трубу надо чуть-чуть наклонить по ветру, и полёт выровняется. {ГЕРОЙ.им} проверил{Р:|а}: из десяти пробных запусков девять ушли ровно вверх, а десятый — в клумбу, но уже по привычке. Последнюю ночь Желток провёл в холодильнике, в коробке с надписью «Космонавт. Не жарить».",
        scene: "a windy courtyard, the engineer neighbor holding up a wet finger to feel the wind, the child adjusting the angle of a launch tube made of plastic pipe, laundry flapping on balconies", cast: ["engineer"],
      },
      {
        text: "В субботу на стадионе собрались девятнадцать экипажей. Ракеты были всех цветов: в полоску, в звёздах, одна — с хвостом из мишуры. Одна ушла вбок и окатила судей, другая не взлетела вовсе и обиженно булькнула. Судьи вытерлись и сказали: «Следующий!» {ГЕРОЙ.им} поставил{Р:|а} ракету на старт, Аркадий Львович накачал давление. — Ключ на старт! — скомандовал{Р:|а} {ГЕРОЙ.им}, как на настоящем космодроме. — Три… два… один…",
        scene: "a school stadium with many children and their homemade bottle rockets of all colors, one rocket spraying water on laughing judges, the child placing the rocket on the launch pad, the engineer pumping air", cast: ["engineer", "rocket"],
      },
      {
        text: "Пуск! Ракета ушла вверх со свистом и облаком брызг. В верхней точке обтекатель соскочил — и над стадионом раскрылся парашют. Высоту судьи мерили по-инженерному: отошли от старта на двадцать метров и измерили угол до верхней точки полёта. Сорок пять градусов. А при таком угле высота равна расстоянию до старта — двадцать метров! Желток спускался медленно и важно, как настоящий космонавт. И приземлился целым.",
        scene: "the bottle rocket at the top of its flight above the stadium with a colorful parachute opening, a judge measuring the angle with a large protractor from a distance, the child jumping with joy", cast: ["rocket"],
      },
      {
        text: "По высоте ракета {ГЕРОЙ.род} стала второй: первая взлетела на двадцать два метра, но её космонавт превратился в омлет. А приз «Мягкая посадка» достался только одному экипажу. Желтка торжественно показали всему стадиону. Аркадий Львович пожал {ГЕРОЙ.дат} руку, как коллеге: — Инженер — это тот, кто ошибся сто раз и каждый раз разобрался почему. Вы, коллега, разобрались.",
        scene: "an award moment at the stadium, the child holding a small trophy and the intact egg with a drawn face, the engineer neighbor shaking the child's hand respectfully, other teams applauding", cast: ["engineer"],
      },
      {
        text: "Вечером {ГЕРОЙ.им} рисовал{Р:|а} новую схему: две бутылки, одна над другой. Настоящие ракеты делают из нескольких ступеней: пустую ступень сбрасывают, чтобы не тащить лишний вес, и оставшаяся часть летит быстрее и дальше. Желток вернулся в холодильник — с новой надписью: «Космонавт. Заслуженный. Не жарить». А на схеме появилась подпись: «Проект „Две ступени“. Космодром во дворе — это только начало».",
        scene: "evening at home, the child drawing a two-stage bottle rocket diagram at a desk, a small trophy on the shelf, the window showing the courtyard at dusk", cast: [],
      },
    ],
    occasionHooks: {
      "den-rozhdeniya": {
        opening: "На день рождения {ГЕРОЙ.дат} подарили настоящий манометр — прибор, который показывает давление. Очень скоро он пригодился.",
        closing: "А дома ждал торт со свечами. {ГЕРОЙ.им} задул{Р:|а} их одним выдохом — реактивная тяга, не иначе. С днём рождения, {ЛАСКОВО.им}!",
        openingScene: "a gift box with a pressure gauge and a ribbon on the kitchen table",
        closingScene: "a birthday cake with candles and a little paper rocket on top",
      },
      default: {
        opening: "Это случилось накануне особенного дня: совсем скоро — {ПОВОД}.",
        closing: "А в бортовом журнале экипажа появилась запись: «{ПОВОД} — отмечено. Полёт нормальный».",
      },
    },
  },

  // ───────────────────────────── 8–10 · Команда с нашего двора · уютное приключение ─────────────────────────────
  {
    slug: "imya-i-komanda-s-nashego-dvora",
    audience: "CHILD",
    segments: ["kids-8-10"],
    title: "[Имя] и команда с нашего двора",
    tagline: "Три недели до турнира дворовых команд: залить каток, собрать команду и научиться играть вместе.",
    description:
      "В декабре на двери подъезда появляется объявление: через три недели — турнир дворовых хоккейных команд. У вашего ребёнка нет ни катка, ни команды. Зато есть двор, шланг, соседи и характер. Вместе с ребятами герой заливает лёд тонкими слоями, учится отдавать пас, получает от соседки форму и узнаёт, почему шайбу хранят в морозилке. Спортивная история о команде, где важен каждый, — с юмором и настоящими фактами.",
    ageMin: 8,
    ageMax: 10,
    occasions: ["bez", "novyj-god", "den-rozhdeniya"],
    textStyle: "cozy-adventure",
    artStyles: ["cozy-detail", "ink-humor", "kind-classic"],
    theme: "winter",
    heroKind: "child",
    extras: { roles: ["friend", "sibling", "dad", "mom", "grandpa", "pet"], min: 0, max: 3 },
    interests: ["спорт", "хоккей", "коньки"],
    coverScene:
      "a snowy courtyard ice rink between apartment blocks lit by street lamps in the evening, the child in a yellow and black striped knitted hat holding a hockey stick, a small team of kids in matching hats cheering by a homemade goal",
    spreads: [
      {
        text: "В декабре на двери подъезда появилось объявление: «Турнир дворовых команд по хоккею. Через три недели. Свой каток и своя команда — обязательно». {ГЕРОЙ.им} перечитал{Р:|а} его дважды и посмотрел{Р:|а} во двор. Двор был белый, ровный и совершенно бесхоккейный: ни катка, ни ворот, ни команды. Только сугробы, качели и кот на гараже. «Отлично, — подумал{Р:|а} {ГЕРОЙ.им}. — Значит, начнём с нуля».",
        scene: "a snowy courtyard between apartment blocks in December, the child reading a hockey tournament poster on an entrance door, snowdrifts, swings and a cat on a garage roof", cast: ["cat"],
      },
      {
        text: "Команду собирали по подъездам. Тимур с третьего этажа знал все правила хоккея, но на коньках стоял, как табуретка. Варя занималась фигурным катанием и ездила спиной вперёд лучше, чем лицом. Сёма был самым высоким и спокойным, как сугроб, — готовый вратарь. А Даня из второго подъезда ни разу не вставал на коньки, зато бегал быстрее всех. Вместе с {ГЕРОЙ.тв} — пятеро. Команда была. Катка не было.",
        scene: "five kids gathering in a snowy courtyard: a boy with a rule book wobbling on skates, a girl figure skater gliding backwards, a tall calm boy, a fast boy in winter boots, the child in the center with a hockey stick", cast: [],
      },
      {
        text: "Каток помог залить дворник дядя Рустам. Он объяснил: сначала снег утаптывают ногами — плотно, как тесто. Потом заливают водой тонкими слоями, когда мороз крепче десяти градусов: тонкий слой промерзает насквозь быстро, а толстый схватится коркой, и под ней останется вода. Ребята топтали снег до самого вечера, а ночью двор шипел шлангом и пах морозом. К утру появился лёд. Правда, бугристый, как стиральная доска.",
        scene: "night in the courtyard, a kind janitor in a fur hat holding a hose spraying water over a flattened snow area, the child and friends stomping the snow, frosty air and lamp light", cast: ["janitor"],
      },
      {
        text: "На бугристом льду шайба прыгала, как кузнечик. Дядя Рустам почесал затылок: вода из шланга бьёт струёй и застывает волнами. {ГЕРОЙ.им} вспомнил{Р:|а}, как поливают грядки из лейки, и придумал{Р:|а}: надеть на конец шланга старый мешок из мешковины. Вода стала растекаться тонко и ровно. Через три ночи каток блестел, как зеркало. Кот с гаража впервые спустился посмотреть — и сразу уехал на пузе к воротам.",
        scene: "the janitor spraying water through a burlap sack tied to the hose, the ice becoming a smooth shining mirror, a cat sliding on its belly across the rink", cast: ["janitor", "cat"],
      },
      {
        text: "Первая тренировка показала главное: каждый играл сам за себя. Варя крутила восьмёрки, Даня носился по льду в ботинках, Тимур громко объявлял нарушения, а шайба тем временем скучала в сугробе. Зато у Тимура в морозилке появилась коробка с надписью «Шайбы. Не есть». Хоккеисты замораживают шайбы перед игрой: холодная шайба меньше прыгает и лучше скользит. Шайбы лежали рядом с пельменями — и это всех устраивало.",
        scene: "a chaotic first training on the courtyard rink, kids going in all directions, a puck lying forgotten in a snowdrift, an open freezer with a box for hockey pucks next to bags of dumplings", cast: [],
      },
      {
        text: "Зинаида Павловна с первого этажа каждый день ходила через двор за хлебом и каждый раз осторожно семенила по скользкой дорожке. {ГЕРОЙ.им} предложил{Р:|а} расчистить ей тропинку и посыпать песком. — Спасибо, хоккеисты, — сказала Зинаида Павловна. — А форма у вас есть? Формы не было. Через неделю она вынесла пять вязаных шапок в жёлто-чёрную полоску и такие же шарфы. Оказалось, тридцать лет назад она сама играла в хоккей.",
        scene: "kids clearing a snowy path and sprinkling sand for an elderly neighbor with a bread bag, then the same neighbor handing out yellow and black striped knitted hats and scarves to the delighted team", cast: [],
      },
      {
        text: "Полоски подсказали название: «Шмели». Тимур, конечно, тут же всё выяснил: шмели — одни из немногих насекомых, которые летают в холод. Перед полётом шмель дрожит мышцами и разогревается, как спортсмен на разминке. — Значит, дрожать перед игрой — нормально, — сказал Сёма. — Это разминка. «Шмели» придумали речёвку: «Жжж — и в ворота!» Соседи на балконах делали вид, что не слышат, но подпевали.",
        scene: "the team in matching striped hats in a huddle on the rink shouting a cheer, a homemade banner with a cartoon bumblebee, neighbors on balconies smiling", cast: [],
      },
      {
        text: "За неделю до турнира «Шмели» сыграли товарищеский матч со старшими ребятами — и проиграли 0:5. Все расстроились. А {ГЕРОЙ.им} {Р:сел|села} на лавку и стал{Р:|а} прокручивать игру в голове, как кино. — Мы бегаем за шайбой толпой, — сказал{Р:|а} {Р:он|она} наконец. — А шайба скользит быстрее любого из нас. Пусть каждый держит свою зону, а шайбу передаём. Пас быстрее бега. Назавтра «Шмели» учились одному: отдавать.",
        scene: "the child sitting on a snowy bench drawing a hockey plan with zones and arrows in a notebook, teammates gathering around, the older team skating away in the background", cast: [],
      },
      {
        text: "Турнир проходил на большом катке у школы. В первом матче «Шмели» отдали сорок пасов — Тимур считал — и выиграли 2:1. Варя ехала спиной вперёд и видела всё поле. Даня наконец встал на коньки и мчался так, будто всю жизнь только этим и занимался. А Сёма стоял в воротах так спокойно, что нападающие соперников начинали сомневаться в себе.",
        scene: "a school ice rink with a crowd of spectators, the team in striped hats passing the puck, a girl skating backwards, a tall calm goalie in the goal, a scoreboard showing 2:1", cast: [],
      },
      {
        text: "В финале «Шмели» встретились с «Метеором» с соседней улицы. Три — три, время вышло: значит, буллиты — по очереди один на один с вратарём. «Метеор» промахнулся, «Шмели» промахнулись. Последний бросок соперников — и Сёма спокойно, как сугроб, шагнул вперёд: шайба отскочила от щитка. Решающий бросок «Шмелей» доверили {ГЕРОЙ.дат}. Бить сильно {ГЕРОЙ.им} не стал{Р:|а} — бросил{Р:|а} точно. Гол!",
        scene: "a hockey shootout in the final, the child skating alone toward the goal and flicking the puck precisely into the corner, the tall goalie celebrating behind, the crowd jumping", cast: [],
      },
      {
        text: "Кубок принесли во двор и поставили на лавку у катка, чтобы видели все. Дядя Рустам разливал чай из огромного термоса. Зинаида Павловна вышла в полосатом шарфе и показала, как держать клюшку по старинке. А вечером на каток высыпал весь двор: малыши, родители, бабушки и даже кот с гаража. Каток, который «Шмели» залили для турнира, оказался катком для всех.",
        scene: "the courtyard rink in the evening full of people skating: toddlers, parents, grandparents, the team with a shining cup on a bench, the janitor pouring tea from a big thermos, the elderly neighbor in a striped scarf", cast: ["janitor"],
      },
      {
        text: "Поздно вечером {ГЕРОЙ.им} смотрел{Р:|а} из окна на пустой каток под фонарём. На батарее сохла полосатая шапка, а в морозилке у Тимура, рядом с пельменями, лежала шайба из финала. «Шмели» договорились заливать каток каждую зиму. «Хорошая команда — это когда каждый знает, кому отдать пас», — подумал{Р:|а} {ГЕРОЙ.им} и {Р:пошёл|пошла} спать. Завтра — тренировка.",
        scene: "late evening, the child at a window looking at the empty rink under a street lamp, a striped knitted hat drying on the radiator, snow falling softly", cast: [],
      },
    ],
    occasionHooks: {
      "novyj-god": {
        opening: "До Нового года оставалось три недели, и двор уже пах ёлками и мандаринами.",
        closing: "А в новогоднюю ночь на катке под гирляндой играли все — и «Шмели», и «Метеор», и даже дядя Рустам. С Новым годом, {ЛАСКОВО.им}!",
        openingScene: "a decorated New Year tree in the snowy courtyard",
        closingScene: "the courtyard rink at night under garlands with fireworks above",
      },
      "den-rozhdeniya": {
        opening: "На день рождения {ГЕРОЙ.дат} подарили клюшку — новую, с белой обмоткой. Оставалось найти, где ею играть.",
        closing: "Но тут в дверь позвонили: на пороге стояли «Шмели» с тортом в форме шайбы. «С днём рождения» они спели так громко, что подпевал весь подъезд. С днём рождения, {ЛАСКОВО.им}!",
        openingScene: "a new hockey stick with a ribbon leaning by the door",
        closingScene: "a round birthday cake shaped like a hockey puck with candles",
      },
      default: {
        opening: "Это случилось накануне особенного дня: совсем скоро — {ПОВОД}.",
        closing: "А в честь праздника — {ПОВОД} — «Шмели» прокричали на весь двор: «Жжж — и в ворота!»",
      },
    },
  },
];

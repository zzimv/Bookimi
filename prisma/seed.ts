import { FormatKind, CoverType, AddonKind } from "@prisma/client";
import { createPrisma } from "../src/lib/prisma-client";
import { ADDONS, FORMATS, OCCASIONS, STORIES, STYLES } from "../src/lib/catalog-defaults";

const db = createPrisma();

async function main() {
  for (const [i, o] of OCCASIONS.entries()) {
    await db.occasion.upsert({
      where: { slug: o.slug },
      update: {},
      create: { slug: o.slug, title: o.title, h1: o.h1, intro: o.intro, sortOrder: i },
    });
  }

  for (const [i, s] of STORIES.entries()) {
    const occasion = s.occasionSlug ? await db.occasion.findUnique({ where: { slug: s.occasionSlug } }) : null;
    await db.story.upsert({
      where: { slug: s.slug },
      update: {},
      create: {
        slug: s.slug,
        title: s.title,
        tagline: s.tagline,
        description: s.description,
        ageMin: s.ageMin,
        ageMax: s.ageMax,
        occasionId: occasion?.id,
        coverTheme: s.coverTheme,
        // Шаблон и план сцен редактируются в админке; хранятся только на сервере.
        textTemplate: `${s.title}. ${s.description}`,
        scenePlan: Array.from({ length: 12 }, (_, n) => ({ spread: n + 1, prompt: "" })),
        sortOrder: i, // «Новогоднее путешествие» — первым (сезон ноябрь–декабрь)
      },
    });
  }

  // Служебный сюжет для «своей идеи» — в каталоге не показывается
  await db.story.upsert({
    where: { slug: "svoya-ideya" },
    update: {},
    create: {
      slug: "svoya-ideya",
      title: "Сказка по вашей идее",
      tagline: "Сюжет по идее родителя",
      description: "Сюжет придумывается по идее родителя.",
      ageMin: 2,
      ageMax: 9,
      coverTheme: "dragon",
      textTemplate: "",
      scenePlan: [],
      sortOrder: 99,
      isActive: false,
    },
  });

  // Триггеры из «Воронок»
  const { DEFAULT_RULES } = await import("../src/lib/triggers");
  if ((await db.triggerRule.count()) === 0) {
    for (const r of DEFAULT_RULES) {
      await db.triggerRule.create({
        data: { name: r.name, event: r.event, condition: {}, delayMinutes: r.delayMinutes, channel: "preferred", template: r.template, promoPercent: r.promoPercent, isMarketing: true, isActive: true },
      });
    }
  }

  for (const [i, st] of STYLES.entries()) {
    await db.illustrationStyle.upsert({
      where: { key: st.key },
      update: {},
      create: { key: st.key, title: st.title, description: st.description, promptSuffix: st.key, sortOrder: i, isActive: st.active },
    });
  }

  for (const [i, f] of FORMATS.entries()) {
    await db.productFormat.upsert({
      where: { key: f.key },
      update: {},
      create: {
        key: f.key,
        kind: f.kind as FormatKind,
        title: f.title,
        widthMm: f.w ?? undefined,
        heightMm: f.h ?? undefined,
        cover: f.cover as CoverType,
        priceRub: f.price,
        isDefault: f.isDefault,
        sortOrder: i,
      },
    });
  }

  for (const [i, a] of ADDONS.entries()) {
    await db.addon.upsert({
      where: { key: a.key },
      update: {},
      create: {
        key: a.key,
        kind: a.kind as AddonKind,
        title: a.title,
        description: a.title,
        priceRub: a.price ?? undefined,
        percentOff: a.pct ?? undefined,
        requiresPrint: a.print,
        sortOrder: i,
      },
    });
  }

  const ph = await db.printHouse.findFirst();
  if (!ph) {
    await db.printHouse.create({
      data: {
        name: "Стандартная цифровая типография",
        leadDaysMin: 3,
        leadDaysMax: 5,
        costs: {},
        isActive: true,
      },
    });
  }

  // Статьи блога (полезные, с конкретными фактами — для поиска и GEO)
  const posts = [
    {
      slug: "kak-vybrat-foto-dlya-personalnoj-knigi",
      title: "Как выбрать фото для персональной книги",
      description: "Пять правил, чтобы ребёнка было легко узнать на иллюстрациях.",
      body: `Чем лучше фото, тем больше иллюстрации похожи на ребёнка. Хватит одного удачного снимка, но с тремя получается надёжнее.

## Что подходит
- Лицо крупно: занимает примерно треть кадра.
- Ровный дневной свет: встаньте лицом к окну, без вспышки.
- Ребёнок смотрит в камеру или чуть в сторону.
- Обычное выражение лица или лёгкая улыбка.

## Чего избегать
- Солнцезащитные очки, маски, шапки, которые закрывают волосы.
- Других людей в кадре.
- Сильные фильтры и обработку в приложениях: они меняют черты лица.

## Что происходит с фото
Фото используется только для создания иллюстраций, хранится на серверах в России и автоматически удаляется через 7 дней.`,
    },
    {
      slug: "personalnaya-kniga-v-podarok-sroki",
      title: "Персональная книга в подарок: когда заказывать",
      description: "Сколько занимает изготовление и доставка, чтобы успеть к празднику.",
      body: `Превью готово за 2–5 минут, полная книга в PDF — в течение часа после оплаты. Если нужна печатная книга, закладывайте время на изготовление и доставку.

## Сроки печатной книги
- Изготовление: 3–5 рабочих дней.
- СДЭК: 2–7 дней в зависимости от города.
- Почта России: 7–14 дней.

## Перед Новым годом
В декабре нагрузка на типографии и доставку выше. Чтобы книга пришла к 31 декабря, оформляйте заказ до 20 декабря. Если времени мало — выберите PDF: его можно распечатать дома на А4 или в копицентре.`,
    },
  ];
  for (const p of posts) {
    await db.blogPost.upsert({ where: { slug: p.slug }, update: {}, create: { ...p, publishedAt: new Date() } });
  }

  // Настройки: значения по умолчанию — в src/lib/settings.ts (DEFAULTS); в БД хранятся только изменения из админки.
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });

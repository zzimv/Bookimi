import { PrismaClient, FormatKind, CoverType, AddonKind } from "@prisma/client";
import { ADDONS, FORMATS, OCCASIONS, STORIES, STYLES } from "../src/lib/catalog-defaults";

const db = new PrismaClient();

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

  for (const [i, st] of STYLES.entries()) {
    await db.illustrationStyle.upsert({
      where: { key: st.key },
      update: {},
      create: { key: st.key, title: st.title, description: st.description, promptSuffix: st.key, sortOrder: i },
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

  const defaults: Record<string, unknown> = {
    "tax.regime": "npd",
    "seller": { fullName: "", inn: "", status: "плательщик налога на профессиональный доход", email: "", phone: "" },
    "payments": { sbpQr: { enabled: false }, transfer: { enabled: false, phone: "", card: "" }, yookassa: { enabled: false } },
    "shipping": { cdek: true, pochta: false, yandex: false, freeShippingBooks: 2 },
    "limits": { previewsPerDay: 1, freeRedraws: 3, photoTtlDays: 7 },
    "promoBar": { enabled: true, text: "Бесплатное превью книги за 5 минут — без регистрации" },
    "flags": { foreignImageProvider: false, whatsapp: false, printEnabled: true },
  };
  for (const [key, value] of Object.entries(defaults)) {
    await db.setting.upsert({ where: { key }, update: {}, create: { key, value: value as object } });
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });

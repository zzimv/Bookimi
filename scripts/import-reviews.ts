// Импорт настоящих отзывов покупателей из JSON. См. data/REVIEWS.md.
// Отзывы без consentToPublish: true не загружаются.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createPrisma } from "../src/lib/prisma-client";
import { z } from "zod";

const Item = z.object({
  authorName: z.string().min(2).max(80),
  rating: z.number().int().min(1).max(5),
  text: z.string().min(10).max(2000),
  storySlug: z.string().optional(),
  date: z.string().optional(),
  source: z.string().optional(),
  consentToPublish: z.boolean(),
  consentNote: z.string().optional(),
});

async function main() {
  const [file, flag] = process.argv.slice(2);
  if (!file) throw new Error("укажите путь: npx tsx scripts/import-reviews.ts data/reviews.json [--approve]");
  const items = z.array(Item).parse(JSON.parse(readFileSync(file, "utf8")));
  const db = createPrisma();
  let added = 0, skipped = 0, noConsent = 0;

  for (const r of items) {
    if (!r.consentToPublish) {
      noConsent++;
      continue;
    }
    if (r.authorName.includes("как подписать") || r.text.includes("дословно, как написал")) {
      skipped++; // строка-пример из reviews.example.json
      continue;
    }
    // Идентификатор из содержимого — повторный импорт не создаёт дублей
    const id = createHash("sha256").update(`${r.authorName}|${r.text}`).digest("hex");
    const uuid = `${id.slice(0, 8)}-${id.slice(8, 12)}-4${id.slice(13, 16)}-a${id.slice(17, 20)}-${id.slice(20, 32)}`;
    const exists = await db.review.findUnique({ where: { id: uuid } });
    if (exists) {
      skipped++;
      continue;
    }
    await db.review.create({
      data: {
        id: uuid,
        authorName: r.authorName,
        rating: r.rating,
        text: r.text,
        storySlug: r.storySlug,
        status: flag === "--approve" ? "approved" : "pending",
        createdAt: r.date ? new Date(r.date) : undefined,
      },
    });
    added++;
  }
  console.log(`добавлено: ${added}, пропущено (дубли/пример): ${skipped}, без согласия на публикацию: ${noConsent}`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

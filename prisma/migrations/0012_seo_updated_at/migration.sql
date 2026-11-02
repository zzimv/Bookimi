-- SEO: lastmod в sitemap — из даты изменения сюжета и повода (а не «сейчас» при каждом запросе).
ALTER TABLE "Story" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Occasion" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

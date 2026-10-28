import "server-only";
import { z } from "zod";

// Серверные переменные окружения. Ничего отсюда не попадает в клиентский бандл:
// модуль помечен server-only, а NEXT_PUBLIC_* в проекте не используются для секретов.
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DOMAIN: z.string().default("bookimi.ru"),
  DATABASE_URL: z.string().optional(),
  S3_ENDPOINT: z.string().default("https://storage.yandexcloud.net"),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET_PHOTOS: z.string().default("bookimi-photos"),
  S3_BUCKET_BOOKS: z.string().default("bookimi-books"),
  S3_BUCKET_BACKUPS: z.string().default("bookimi-backups"),
  PAYMENT_PROVIDER: z.enum(["sbp_qr", "transfer", "yookassa", "none"]).default("none"),
  YANDEX_METRIKA_ID: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_ALERT_CHAT_ID: z.string().optional(),
  MAX_BOT_TOKEN: z.string().optional(),
  FOREIGN_IMAGE_PROVIDER: z.enum(["true", "false"]).default("false"),
});

export const env = schema.parse(process.env);
export const siteUrl = `https://${env.DOMAIN}`;

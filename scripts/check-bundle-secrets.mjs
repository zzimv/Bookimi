// CI: клиентский бандл не должен содержать секретов, промптов и ключей.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = ".next/static";
const patterns = [
  /AQVN[0-9A-Za-z_-]{20,}/, // ключи Yandex Cloud API
  /YCAJ[0-9A-Za-z_-]{20,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /postgres(ql)?:\/\/[^"'\s]+:[^"'\s]+@/,
  /\d{8,10}:AA[0-9A-Za-z_-]{30,}/, // токен Telegram-бота
  /(S3_SECRET_KEY|PAYMENT_SBP_API_KEY|NPD_API_KEY|SESSION_SECRET|SMTP_PASSWORD)/,
  /textTemplate|scenePlan|promptSuffix/, // промпты и шаблоны только на сервере
  /\.map$/,
];

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

let bad = 0;
for (const file of walk(root)) {
  if (file.endsWith(".map")) {
    console.error(`source map в публичном бандле: ${file}`);
    bad++;
    continue;
  }
  if (!/\.(js|css|html|json)$/.test(file)) continue;
  const text = readFileSync(file, "utf8");
  for (const re of patterns) {
    if (re.test(text)) {
      console.error(`секрет/серверные данные в бандле: ${file} (${re})`);
      bad++;
    }
  }
}
if (bad) process.exit(1);
console.log("bundle ok: секретов не найдено");

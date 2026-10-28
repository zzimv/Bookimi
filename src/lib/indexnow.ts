// Уведомление Яндекса об обновлённых страницах (IndexNow). Вызывается после правок каталога и блога.
export async function pingIndexNow(paths: string[]) {
  const key = process.env.INDEXNOW_KEY;
  const host = process.env.DOMAIN;
  if (!key || !host || !paths.length) return;
  await fetch("https://yandex.com/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key, keyLocation: `https://${host}/indexnow.txt`, urlList: paths.map((p) => `https://${host}${p}`) }),
  }).catch(() => {});
}

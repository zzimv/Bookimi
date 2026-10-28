// Нагрузочный тест: 50 одновременных пользователей без ошибок.
// k6 run -e BASE=https://bookimi.ru tools/load/k6.js
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 50,
  duration: "2m",
  thresholds: { http_req_failed: ["rate<0.01"], http_req_duration: ["p(95)<500"] },
};

const BASE = __ENV.BASE || "http://localhost:3000";
const PAGES = ["/", "/skazki", "/povod/novyj-god", "/skazki/novogodnee-puteshestvie-s-dedom-morozom", "/sozdat", "/catalog.json"];

export default function () {
  for (const p of PAGES) {
    const r = http.get(BASE + p);
    check(r, { "200": (x) => x.status === 200 });
    sleep(0.5);
  }
}

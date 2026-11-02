// Картинки-образцы /obrazec в демо — тем же кодом, что маршрут сайта, без сети: SVG → blob-ссылка (кеш по адресу).
import { GET as obrazec } from "../../src/app/obrazec/route";
import { svgUrl } from "./api";

export function sampleSrc(url: string) {
  return svgUrl(`obrazec${url}`, () => {
    const R = globalThis.Response;
    let body = "";
    // Маршрут сайта отвечает new Response(svg) — забираем строку синхронно
    (globalThis as { Response: unknown }).Response = function (b: string) {
      body = b;
    };
    try {
      obrazec({ url: `https://demo.bookimi${url}` } as Request);
    } finally {
      globalThis.Response = R;
    }
    return body;
  });
}

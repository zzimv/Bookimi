// Сборка демо-стенда в один HTML: node tools/demo/build.mjs → tools/demo/out/bookimi-demo.html
import { build } from "esbuild";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const res = await build({
  entryPoints: [join(here, "app.ts")],
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  write: false,
  alias: { "server-only": join(here, "noop.js") },
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = readFileSync(join(here, "style.css"), "utf8");
const html = `<title>Демо-стенд БУКИМИ</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Nunito:wght@700;800&display=swap">
<style>${css}</style>
<div id="app"></div>
<script>${js}</script>
`;
mkdirSync(join(here, "out"), { recursive: true });
writeFileSync(join(here, "out", "bookimi-demo.html"), html);
console.log(`ok: ${(html.length / 1024).toFixed(0)} КБ`);

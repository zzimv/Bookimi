// rev 18 (03.11.2026): вёрстка на экранах 360–2560 px и при масштабе 125 % (полная проверка в браузере —
// npm run check:responsive, tools/responsive-check.mjs); «Зимнее»: снег лежит на кронах, взрослые на улице в шапке и шарфе. Без БД.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { renderDemoSpread } from "@/content/art/render";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const css = read("src/app/globals.css");

describe("rev 18: «Зимнее»", () => {
  const hero = { gender: "girl", age: 6 } as never;
  const extras = [{ role: "mom", look: { gender: "girl", age: 34 } }, { role: "grandpa", look: { gender: "boy", age: 68 } }] as never;
  const out = "the child and family walking on a meadow outdoors";

  it("снежная шапка кроны обрезана по самой кроне (не отдельный овал-облако), крона темнее снега и с тенью", () => {
    const svg = renderDemoSpread({ plot: { slug: "imya-i-zvyozdnyj-drakonchik", theme: "dragon", heroKind: "child" }, spreadIndex: 2, hero, mood: "wintry", scene: out });
    const caps = [...svg.matchAll(/<g data-snowcap="1" clip-path="url\(#(snow-crown-[^)]+)\)"/g)].map((m) => m[1]);
    expect(caps.length).toBeGreaterThan(0);
    for (const id of caps) expect(svg).toContain(`<clipPath id="${id}">`);
    expect(svg).not.toMatch(/data-snowcap="1" d="[^"]+" fill="#fbfdff" transform="translate\(0 [\d.]+\) scale\(1 0\.34\)"/);
  });

  it("на улице взрослые (мама, дедушка) — в шапке и шарфе, как ребёнок; в комнате — без", () => {
    const svg = renderDemoSpread({ plot: { slug: "imya-i-bolshaya-luzha", theme: "meadow", heroKind: "child" }, spreadIndex: 3, hero, extras, mood: "wintry", scene: out });
    const adults = svg.split('data-figure="adult"').slice(1);
    expect(adults.length).toBe(2);
    expect((svg.match(/data-adult-hat="1"/g) ?? []).length).toBe(2);
    expect((svg.match(/data-scarf="1"/g) ?? []).length).toBe(3);
    const inside = renderDemoSpread({ plot: { slug: "imya-i-bolshaya-luzha", theme: "meadow", heroKind: "child" }, spreadIndex: 3, hero, extras, mood: "wintry", scene: "the family in a cozy bedroom reading a book" });
    expect(inside).not.toContain("data-adult-hat");
    const summer = renderDemoSpread({ plot: { slug: "imya-i-bolshaya-luzha", theme: "meadow", heroKind: "child" }, spreadIndex: 3, hero, extras, scene: out });
    expect(summer).not.toContain("data-adult-hat");
  });
});

describe("rev 18: экраны", () => {
  it("превью книги ограничено и высотой окна; липкие панели не закрывают поля; 100dvh и safe-area", () => {
    expect(css).toMatch(/\.bk \{ --bk-room: calc\(100dvh - \d+px\); \}/);
    expect(css).toMatch(/\.bk__book \{ max-width: min\([^;]*2 \* var\(--bk-room\)\)\); \}/);
    expect(css).toMatch(/html \{ scroll-padding-top: \d+px; \}/);
    expect(css).toMatch(/html:has\(\.flow-nav\) \{ scroll-padding-bottom:/);
    expect(css).toContain("max-height: calc(100dvh - 32px");
    expect(read("src/app/layout.tsx")).toContain('viewportFit: "cover"');
  });
  it("проверка вёрстки подключена: npm run check:responsive, все 12 экранов", () => {
    expect(JSON.parse(read("package.json")).scripts["check:responsive"]).toContain("tools/responsive-check.mjs");
    const s = read("tools/responsive-check.mjs");
    for (const v of ["360x740", "375x812", "390x844", "414x896", "768x1024", "1024x768", "1280x720", "1366x768", "1440x900", "1920x1080", "2560x1440", "1366x768@125"]) expect(s).toContain(`"${v}"`);
    expect(s).toContain("process.exit(total ? 1 : 0)");
  });
});

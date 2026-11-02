import { describe, expect, it } from "vitest";
import { MOODS, moodsFor } from "../src/content/moods";
import { applyMood, isNeutralMood, moodPrompt, stripMood } from "../src/content/art/mood";
import { renderDemoSpread } from "../src/content/art/render";
import { KIDS_PLOTS } from "../src/content/plots/kids";
import { ART_STYLE_IDS } from "../src/content/profiles";

/** Простая проверка корректности XML: парные теги, кавычки атрибутов, без мусора. */
function wellFormed(xml: string): string | null {
  const stack: string[] = [];
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|<|>/g;
  let m: RegExpExecArray | null;
  let roots = 0;
  while ((m = re.exec(xml))) {
    if (m[0].startsWith("<!--")) continue;
    if (m[0] === "<" || m[0] === ">") return `stray ${m[0]} at ${m.index}`;
    const [, close, name, , self] = m;
    if (close) {
      const top = stack.pop();
      if (top !== name) return `</${name}> closes <${top}> at ${m.index}`;
    } else if (!self) {
      if (!stack.length) roots++;
      stack.push(name);
    } else if (!stack.length) roots++;
  }
  if (stack.length) return `unclosed ${stack.join(">")}`;
  if (roots !== 1) return `${roots} roots`;
  return null;
}

const plot = KIDS_PLOTS[0];
const base = renderDemoSpread({ plot, spreadIndex: 3, hero: { gender: "girl" }, extras: [{ role: "friend", look: { gender: "boy" } } as never] });

describe("настроения: данные", () => {
  it("8–11 настроений, первое нейтральное, поля заполнены", () => {
    expect(MOODS.length).toBeGreaterThanOrEqual(8);
    expect(isNeutralMood(MOODS[0])).toBe(true);
    expect(MOODS[0].promptAdd).toBe("");
    const styleIds = new Set(ART_STYLE_IDS.map((s) => s.id));
    const ids = new Set<string>();
    for (const m of MOODS) {
      expect(m.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(ids.has(m.id)).toBe(false);
      ids.add(m.id);
      expect(styleIds.has(m.id)).toBe(false);
      expect(m.title.length).toBeGreaterThan(2);
      expect(m.oneLine.length).toBeGreaterThan(5);
      expect(m.audiences.length).toBeGreaterThan(0);
      expect(m.demo.tint).toMatch(/^#[0-9a-f]{6}$/i);
      expect(m.demo.saturation).toBeGreaterThan(0);
      expect(m.demo.brightness).toBeGreaterThan(0);
      if (m === MOODS[0]) continue;
      expect(isNeutralMood(m)).toBe(false);
      expect(m.promptAdd).not.toMatch(/[А-Яа-яЁё]/);
      expect(m.negativeAdd).not.toMatch(/[А-Яа-яЁё]/);
      expect(m.promptAdd).toMatch(/unchanged/);
      expect(m.negativeAdd.length).toBeGreaterThan(5);
    }
  });
  it("аудитории: романтичное — взрослым и подросткам 14+, сонное — детям и питомцам", () => {
    const ids = (a: Parameters<typeof moodsFor>[0], age?: number) => moodsFor(a, age).map((m) => m.id);
    expect(ids("CHILD")).not.toContain("romantic");
    expect(ids("PET")).not.toContain("romantic");
    expect(ids("ADULT")).toContain("romantic");
    expect(ids("TEEN", 15)).toContain("romantic");
    expect(ids("TEEN", 12)).not.toContain("romantic");
    expect(ids("CHILD")).toContain("sleepy");
    expect(ids("ADULT")).not.toContain("sleepy");
    for (const a of ["CHILD", "TEEN", "ADULT", "PET"] as const) expect(moodsFor(a)[0].id).toBe(MOODS[0].id);
  });
});

describe("applyMood", () => {
  it("исходный SVG корректен", () => expect(wellFormed(base)).toBeNull());
  it("каждое настроение даёт корректный XML и детерминировано", () => {
    for (const m of MOODS) {
      const out = applyMood(base, m);
      expect(wellFormed(out), m.id).toBeNull();
      expect(applyMood(base, m)).toBe(out);
      if (m !== MOODS[0]) expect(out).toContain(`filter="url(#mood-${m.id})"`);
    }
  });
  it("нейтральное и null возвращают SVG без изменений", () => {
    expect(applyMood(base, MOODS[0])).toBe(base);
    expect(applyMood(base, null)).toBe(base);
  });
  it("повторное применение не оборачивает дважды и снимается обратно", () => {
    const [a, b] = [MOODS[1], MOODS[4]];
    const once = applyMood(base, a);
    expect(applyMood(once, a)).toBe(once);
    expect(applyMood(once, b)).toBe(applyMood(base, b));
    expect(applyMood(once, MOODS[0])).toBe(base);
    expect(stripMood(once)).toBe(base);
    expect(once.match(/data-mood-body/g)).toHaveLength(1);
  });
  it("через renderDemoSpread с подписью и водяным знаком", () => {
    for (const m of MOODS) {
      const svg = renderDemoSpread({ plot, spreadIndex: 1, mood: m.id, hero: {}, caption: "Тест & <ok>", watermark: true });
      expect(wellFormed(svg), m.id).toBeNull();
    }
  });
  it("не ломает странный вход", () => {
    expect(applyMood("not svg", MOODS[1])).toBe("not svg");
    expect(applyMood("<svg/>", MOODS[1])).toBe("<svg/>");
    expect(wellFormed(applyMood(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="1" height="1"/></svg>`, MOODS[2]))).toBeNull();
  });
});

describe("moodPrompt", () => {
  const warm = MOODS.find((m) => m.id === "warm")!;
  it("без настроения и с нейтральным — как есть", () => {
    expect(moodPrompt("a, b", "x", null)).toEqual({ prompt: "a, b", negative: "x" });
    expect(moodPrompt("a, b", "x", MOODS[0])).toEqual({ prompt: "a, b", negative: "x" });
  });
  it("склеивает без двойных запятых и пробелов", () => {
    const r = moodPrompt("  children's book art, soft gouache,, ", "blurry, , extra fingers,", warm);
    expect(r.prompt.startsWith("children's book art, soft gouache. Mood: warm amber")).toBe(true);
    expect(r.prompt).not.toMatch(/,\s*,|\s{2}|^\s|\s$/);
    expect(r.negative.startsWith("blurry, extra fingers, cold blue cast")).toBe(true);
    expect(r.negative).not.toMatch(/,\s*,|\s{2}|^\s|\s$|,$/);
  });
  it("убирает повторы в негативе и работает с пустыми входами", () => {
    const r = moodPrompt("", "Gloomy overcast, text", warm);
    expect(r.prompt.startsWith("Mood: ")).toBe(true);
    expect(r.negative.toLowerCase().match(/gloomy overcast/g)).toHaveLength(1);
    expect(moodPrompt("A scene.", "", warm).prompt).toMatch(/^A scene\. Mood: /);
  });
});

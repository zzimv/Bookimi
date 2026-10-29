import { describe, expect, it } from "vitest";
import { parseSpread, plainSpread, spreadHtml, splitSounds } from "@/lib/spread-markup";
import { bookHtml } from "@/lib/pdf";

describe("разметка разворота: стихи и комикс", () => {
  it("стихи: каждая строка отдельно, пустая строка — пауза", () => {
    const l = parseSpread("За горами, за лесами,\nЗа зелёными холмами,\n\n— Маша!\nСпи, Машенька.");
    expect(l.map((x) => x.kind)).toEqual(["line", "line", "gap", "line", "line"]);
    expect(spreadHtml("Раз\nДва")).toBe('<span class="sp-line">Раз</span><span class="sp-line">Два</span>');
  });
  it("комикс: подписи [..] — плашкой, мысли (..), звуки КАПСОМ — жирным", () => {
    const l = parseSpread("[Понедельник. 7:00.]\nДЗЫНЬ!\nМаша: — ВЖЖЖ! Поехали!\n(Кот думает: опять.)");
    expect(l[0]).toEqual({ kind: "caption", parts: [{ t: "text", v: "Понедельник. 7:00." }] });
    expect(l[1]).toEqual({ kind: "line", parts: [{ t: "sound", v: "ДЗЫНЬ!" }] });
    expect(l[2].kind === "line" && l[2].parts.filter((p) => p.t === "sound").map((p) => p.v)).toEqual(["ВЖЖЖ!"]);
    expect(l[3].kind).toBe("thought");
    const html = spreadHtml("[Город спит.]\nБАМ!");
    expect(html).toContain('<span class="sp-cap">Город спит.</span>');
    expect(html).toContain('<b class="sp-sound">БАМ!</b>');
    expect(html).not.toContain("[");
  });
  it("звуки: не трогает обычные слова, аббревиатуры без «!» и слова с маленькими буквами", () => {
    expect(splitSounds("Привет! СДЭК привёз. ТУК-ТУК! Ура!").filter((p) => p.t === "sound").map((p) => p.v)).toEqual(["ТУК-ТУК!"]);
  });
  it("экранирует HTML и даёт текст без разметки для субтитров", () => {
    expect(spreadHtml("<b>я</b>")).toBe('<span class="sp-line">&lt;b&gt;я&lt;/b&gt;</span>');
    expect(plainSpread("[Утро.]\nДЗЫНЬ!")).toBe("Утро.\nДЗЫНЬ!");
  });
  it("PDF: текст разворота с переносами строк (pre-line) и плашками комикса", () => {
    const img = { data: Buffer.from(""), contentType: "image/png" };
    const { html } = bookHtml({ title: "Т", dedication: "", heroName: "Маша", cover: img, spreads: [{ text: "[Утро.]\nДЗЫНЬ!\nСтрока два", image: img }] }, { kind: "screen" });
    expect(html).toContain("white-space:pre-line");
    expect(html).toContain('<span class="sp-cap">Утро.</span><span class="sp-line"><b class="sp-sound">ДЗЫНЬ!</b></span><span class="sp-line">Строка два</span>');
  });
});

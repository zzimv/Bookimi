// Образцы «Мультфильма по книге» в демо-режиме, без БД: две книги (новогодняя детская и кошачья)
// с демо-голосом и одна — с «своим голосом» (синтетическая запись прогоняется через всю цепочку обработки:
// проверка сигнатуры → очистка → громкость −16 LUFS → сборка).
//   npx tsx scripts/cartoon-samples.ts <папка-вывода> [ny|cat|own ...]
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AnswersV2, type QuizAnswers } from "../src/lib/quiz";
import { DemoTextProvider, dedicationText, personalize, plotForAnswers } from "../src/lib/gen/text";
import { cartoonScript, particlesFor } from "../src/lib/gen/cartoon-script";
import { DemoSpeechTts } from "../src/lib/gen/tts";
import { renderCartoon, ff } from "../src/lib/gen/cartoon-render";
import { prepareCues, validateVoiceFile, levels } from "../src/lib/gen/cartoon-voice";
import { demoScenes } from "../src/lib/gen/cartoon-demo";
import { plotInfo } from "../src/lib/gen/pipeline";

const BOOKS: Record<string, { raw: unknown; style: string; mood: string | null }> = {
  ny: {
    raw: {
      audience: "CHILD",
      hero: { name: "Маша", gender: "girl", ageGroup: "4-5" },
      appearance: { hair: "рыжие", hairstyle: "две косички" },
      occasion: { key: "novyj-god" },
      story: { slug: "novogodnee-puteshestvie-s-dedom-morozom" },
      extras: [{ role: "pet", name: "Пушок", species: "cat" }],
      dedication: "Машенька, пусть в твоей жизни всегда будет место чуду! С любовью, мама и папа.",
    },
    style: "kind-classic",
    mood: null,
  },
  cat: {
    raw: {
      audience: "PET",
      hero: { name: "Барсик", gender: "boy" },
      pet: { species: "cat", furColor: "рыжий" },
      occasion: { key: "den-koshek" },
      story: { slug: "skazanie-o-divane" },
      extras: [{ role: "owner", name: "Аня" }],
      dedication: "Нашему рыжему князю — от верной княгини-кормилицы.",
    },
    style: "pet-cartoon",
    mood: null,
  },
};

async function book(key: string) {
  const b = BOOKS[key];
  const a: QuizAnswers = AnswersV2.parse(b.raw);
  const text = personalize((await new DemoTextProvider().write(a, plotForAnswers(a), 0)).raw, a);
  const dedication = dedicationText(a);
  const script = cartoonScript({ title: text.title, spreads: text.spreads, dedication });
  return { a, b, text, dedication, script };
}

async function sample(key: "ny" | "cat" | "own", out: string) {
  const t0 = Date.now();
  const own = key === "own";
  const { a, b, text, dedication, script } = await book(own ? "ny" : key);
  const work = join(out, `work-${key}`);
  await rm(work, { recursive: true, force: true });
  await mkdir(work, { recursive: true });
  // Голос: демо-диктор или «свой голос» — синтетическая запись с шумом и гулом, как с телефона
  const tts = new DemoSpeechTts();
  const raw: string[] = [];
  for (const c of script.cues) {
    const r = await tts.synth([c.text], own ? "demo-male" : "alena");
    const f = join(work, `tts-${c.n}.wav`);
    await writeFile(f, r.data);
    if (!own) {
      raw.push(f);
      continue;
    }
    // «Запись в браузере»: WebM/Opus 48 кГц, тишина вокруг, фоновый шум и гул 50 Гц, тише нормы
    const rec = join(work, `rec-${c.n}.webm`);
    await ff(["-v", "error", "-i", f, "-f", "lavfi", "-i", "anoisesrc=color=pink:amplitude=0.012:r=48000", "-f", "lavfi", "-i", "sine=f=50:r=48000",
      "-filter_complex", "[0:a]aresample=48000,adelay=700,apad=pad_dur=1.1,volume=0.55[v];[2:a]volume=0.02[h];[v][1:a][h]amix=inputs=3:duration=first:normalize=0[a]",
      "-map", "[a]", "-c:a", "libopus", "-b:a", "64k", "-y", rec]);
    const buf = await readFile(rec);
    const v = await validateVoiceFile(buf, join(work, "upload"), `cue-${c.n}`);
    if (!v.ok) throw new Error(`проверка записи ${c.n}: ${v.error}`);
    raw.push(v.file);
  }
  const lv = own ? await levels(raw[3]) : null;
  const prepared = await prepareCues(raw, join(work, "voice"), { own });
  const voice = await Promise.all(prepared.files.map((f) => readFile(f)));
  const theme = plotInfo(a).plot.theme;
  const r = await renderCartoon({
    title: text.title,
    dedication,
    cues: script.cues,
    voice,
    scenes: demoScenes(a, { style: b.style, mood: b.mood, scenes: [plotInfo(a).coverScene ?? "", ...text.spreads.map((s) => s.scene)] }),
    particles: particlesFor(theme, text.spreads.map((s) => s.text).join(" ")),
    subtitles: true,
    vertical: true,
    verticalHeight: Number(process.env.CARTOON_VERTICAL_H ?? 1280),
    workDir: join(work, "render"),
    onProgress: () => {},
  });
  const name = { ny: "novyj-god-maša", cat: "kot-barsik", own: "novyj-god-svoim-golosom" }[key].replace("š", "sh");
  await copyFile(r.square, join(out, `${name}-1080.mp4`));
  if (r.vertical) await copyFile(r.vertical, join(out, `${name}-vertical.mp4`));
  await copyFile(r.poster, join(out, `${name}-poster.jpg`));
  await writeFile(join(out, `${name}-script.txt`), script.cues.map((c) => `${c.n}. [${c.targetSec} с] ${c.text}`).join("\n") + `\n\nслов: ${script.words}\n`);
  console.log(JSON.stringify({ key, words: script.words, duration: r.durationSec, renderSec: r.renderSec, totalSec: (Date.now() - t0) / 1000, loudness: r.loudness, voiceLoudness: prepared.loudness, ownLevels: lv, stretch: r.timeline.stretch }));
}

const out = process.argv[2] ?? "cartoon-samples";
const which = (process.argv.slice(3).length ? process.argv.slice(3) : ["ny", "cat", "own"]) as ("ny" | "cat" | "own")[];
async function main() {
  await mkdir(out, { recursive: true });
  for (const k of which) await sample(k, out);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

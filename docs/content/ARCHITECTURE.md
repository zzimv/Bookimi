# Контент-движок БУКИМИ: архитектура и правила

Профили аудиторий — `PROFILES.md` / `src/content/profiles.ts`. Контракты — `src/content/types.ts`.

## Схема

```
profiles.ts (аудитории, сегменты, поводы, id стилей)
   │
   ├── plots/{kids,teens,adults,pets}.ts ── Plot: 12 разворотов, голос, стили, тема, крючки поводов
   ├── text-styles.ts ───────────────────── TextStyle: системный промпт YandexGPT для каждого голоса
   ├── art/{kids,teens,adults,pets}.ts ──── ArtStyle (промпт Qwen + демо-палитра), DemoTheme, рисовальщик героя
   ├── moods.ts + art/mood.ts ───────────── Mood: добавка к промпту + тонировка демо
   └── occasions.ts ─────────────────────── общие крючки поводов, {ПОВОД}
              │
              ▼
   registry.ts — getPlots, plotBySlug, plotsForOccasion, hooksFor, applyOccasion,
                 textStyle, artStyle, mood, segmentsFor, validateContent
   art/index.ts — ART_STYLES, themesByKey, heroDrawer (безопасно для клиента)
   art/render.ts — renderDemoSpread / renderDemoCover (SVG без GPU)
   answers.ts — AnswersV2 (анкета 4 аудиторий), ContactV2
              │
              ▼
   анкета и каталог (сайт) · gen/text.ts (YandexGPT, демо) · gen/image.ts (Qwen, демо-SVG) · tools/demo
```

`registry.ts` содержит системные промпты и планы сюжетов — **только сервер и демо-стенд**. В клиентские
компоненты — `art/index.ts`, `art/render.ts`, `answers.ts`, `profiles.ts` и проекции из серверных props.

## Метки (имя никогда не уходит в ИИ)

Подстановка — `fillTags(text, ctx)` в `src/lib/declension.ts`; проверка — `checkTags` в `src/content/tags.ts`.
Падежи: `им род дат вин тв пр`.

| Метка | Что подставляется |
|---|---|
| `{ГЕРОЙ.дат}`, `{ГЕРОЙ}` | имя героя (для питомца — кличка) |
| `{ЛАСКОВО.им}` | домашнее имя (если нет — имя) |
| `{ДОП1.вин}` … `{ДОП3.тв}`, `{ДОП1}` | доп. герои по порядку анкеты |
| `{ДОПЫ.дат}` *(новое)* | все доп. герои списком: «Ане, Пете и Маше» |
| `{Р:м\|ж}`, `{Р:м\|ж\|ср}` | форма по полу героя; средний род — только если указан |
| `{Р1:м\|ж}` … `{Р3:…}` *(новое)* | форма по полу доп. героя 1..3 |
| `{МН:один\|много}` *(новое)* | по числу доп. героев (1 / больше 1) |
| `{ПОВОД}` *(новое)* | «день рождения», «Новый год» или текст «своего повода» |
| `{ВОЗРАСТ}` *(новое)* | «5 лет», «3 года» — только где возраст точно известен |

**Аудитории.** Подростки и взрослые — как дети. **Пары:** второй главный герой — `{ДОП1.*}` (роль `partner`,
`extras.min = 1`), его род — `{Р1:…}`. **Книги «от детей/внуков/коллег»:** дарители — доп. герои, вместе — `{ДОПЫ.*}`,
число — `{МН:…}`. **Питомцы:** герой — питомец (`{ГЕРОЙ.*}`, род — по полу питомца: boy/girl = он/она),
хозяева — `{ДОП1.*}`, `{ДОП2.*}` (роль `owner`). **«Свой вариант»** (дерево, робот, машина) — роль `custom`,
род `boy | girl | n` (средний для «облака»), без рода — угадывается по имени. Отчества не используем.

**Правила текста:** `нашёл{Р:|а}` даёт «нашёла» — пишите `{Р:нашёл|нашла}` (validateContent ловит).
Если текст ссылается на `ДОПn` / `Рn` / `ДОПЫ`, у сюжета `extras.min ≥ n`. В стихах (`verse: true`) строки
разделяются `\n`, метка имени не стоит в конце строки и не рифмуется; слово с меткой рода — не на рифме.
Сцены (`scene`, `coverScene`, сцены крючков) — только по-английски и без имён.

**Поводы.** Любой сюжет дарится на любой повод: `hooksFor(plot, повод)` берёт `plot.occasionHooks[повод]` →
`plot.occasionHooks.default` (обязан содержать `{ПОВОД}`) → общий крючок из `occasions.ts`. Пустой крючок
`{opening:"", closing:""}` — «сюжет уже об этом поводе». `applyOccasion` дописывает opening в разворот 1,
closing — в разворот 12, сцены — к сценам. Сюжеты в стихах обязаны давать свои крючки.

## Владельцы файлов

Чужие файлы не трогаем. Нужно что-то в общем файле — пишите в раздел `requests` в шапке **своего** файла.

| Агент | Файлы |
|---|---|
| 1 — архитектор | `types.ts`, `tags.ts`, `text-styles.ts`, `occasions.ts`, `registry.ts`, `answers.ts`, `art/index.ts`, `art/shared.ts`, `art/render.ts`, `lib/declension.ts` (метки), миграция `0002_audiences`, этот файл, `tests/content.test.ts` |
| 2 — детские сюжеты | `plots/kids.ts` |
| 3 — детские картинки | `art/kids.ts` |
| 4 — подростковые сюжеты | `plots/teens.ts` |
| 5 — подростковые картинки | `art/teens.ts` |
| 6 — сюжеты для взрослых | `plots/adults.ts` |
| 7 — картинки для взрослых | `art/adults.ts` |
| 8 — сюжеты о питомцах | `plots/pets.ts` |
| 9 — картинки питомцев | `art/pets.ts` |
| 10 — настроения | `moods.ts`, `art/mood.ts` |
| 11 — интегратор | всё приложение; может править общие файлы по `requests` |
| 12 — демо | `tools/demo/*` |

Темы демо: сюжеты ссылаются только на ключи `DEMO_THEME_KEYS` (types.ts), художник рисует все ключи своей
аудитории. Стили картинок: владелец каждого id — `ART_STYLE_OWNERS`; сюжет может рекомендовать любой id из `ART_STYLE_IDS`.

## Definition of Done для контент-агентов

- Сюжеты: дети ≥ 9 по трём сегментам (вкл. 5 перенесённых, slug не менять), подростки ≥ 5, взрослые ≥ 5
  (все 4 сегмента), питомцы ≥ 4 (собака и кошка). В каждом ровно 12 разворотов, крючки главных поводов + `default`.
- Художники: все свои стили из `ART_STYLE_OWNERS` и темы из `DEMO_THEME_KEYS`, рисовальщик героя. Настроения: ≥ 8.
- `validateContent()` без ошибок; `npx tsc --noEmit`; `npx vitest run tests/content.test.ts` — зелёные.
- Оригинальный текст; без имён живых авторов и художников, франшиз, брендов; запреты сегментов.

## Что подключает агент 11

1. Тест строгим: `CONTENT_STRICT=1` (или убрать `runIf`) — полнота каталога становится обязательной.
2. Анкета: `src/lib/quiz.ts` → `AnswersV2` (аудитория, сегмент, поля героя по `segment.heroFields`, настроение,
   стиль, доп. герои с ролями friend/toy/custom, контакт `ContactV2`: телефон обязателен, код — на почту).
3. Текст: `gen/text.ts` — системный промпт `textStyle(a.textStyle || plot.textStyle).systemPrompt`, бриф с сегментом
   (длина, запреты), `applyOccasion` вместо STORY_PLANS, `fillTags` вместо `fillNames+applyGender` (контекст: доп. герои
   с `extraGender`, `occasionText(key, custom)`, возраст). Демо-текст = `applyOccasion(plot, …)`.
4. Картинки: `gen/image.ts` — `artStyle(id).prompt/negative` вместо `STYLE_PROMPTS`, `moodPrompt(...)`, герой по `heroKind`
   (teen/adult/pet — свои IDENTITY/NEGATIVE), демо — `renderDemoSpread`/`renderDemoCover`.
5. БД: миграция `0002_audiences` (Audience += TEEN, PET; Story: segments, textStyle, artStyles, heroKind, occasions;
   Book: mood). Seed `Story` — из `PLOTS` (`textTemplate`/`scenePlan` — из spreads, `coverTheme` = `plot.theme`).
6. Каталог/повод: `plotsForOccasion(key, audience)`; страницы аудиторий — `segmentsFor`.
7. Удалить `lib/story-plans.ts`, `lib/gen/demo-art.ts`, `STYLE_PROMPTS`, `STORIES/STYLES` в `catalog-defaults.ts`
   после переключения импортов (сайт, воркер, `tools/demo/app.ts`). `npm run check:bundle-secrets` — промпты не в клиенте.

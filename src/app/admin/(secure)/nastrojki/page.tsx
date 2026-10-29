import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { getSettings, getSetting, type SettingKey } from "@/lib/settings";
import { LEGAL } from "@/lib/legal";
import { legalAction, printHouseAction, settingsAction } from "../../actions";
import { formatTiers } from "@/lib/settings-validate";

type Field =
  | { p: string; label: string; t?: "text" | "number" | "password" | "email" | "time"; hint?: string }
  | { p: string; label: string; t: "bool"; hint?: string; disabled?: boolean }
  | { p: string; label: string; t: "select"; options: [string, string][]; hint?: string }
  | { p: string; label: string; t: "list"; hint?: string };

const SECTIONS: { key: SettingKey; title: string; note?: string; fields: Field[] }[] = [
  {
    key: "seller",
    title: "Реквизиты продавца",
    note: "Подставляются в футер, оферту и политику. Пока не заполнены — приём оплаты выключен.",
    fields: [
      { p: "fullName", label: "ФИО полностью" },
      { p: "inn", label: "ИНН (12 цифр)" },
      { p: "status", label: "Статус", hint: "Для самозанятого: плательщик налога на профессиональный доход. ОГРН не указывается." },
      { p: "email", label: "Email для покупателей", t: "email" },
      { p: "phone", label: "Телефон" },
    ],
  },
  {
    key: "tax",
    title: "Налоговый режим",
    note: "При переходе на ИП: реквизиты ИП в футере, чеки 54-ФЗ через онлайн-кассу провайдера, оплата — ЮKassa.",
    fields: [
      { p: "regime", label: "Режим", t: "select", options: [["npd", "Самозанятый (НПД)"], ["ip", "ИП"]] },
      { p: "ipName", label: "Наименование ИП" },
      { p: "ogrnip", label: "ОГРНИП" },
      { p: "npdYearLimitRub", label: "Лимит дохода НПД в год, ₽", t: "number" },
    ],
  },
  {
    key: "payments",
    title: "Способы оплаты",
    note: "Частые переводы на личную карту банк может проверить по 115-ФЗ. Лучше отдельная карта и СБП-QR через сервис для самозанятых.",
    fields: [
      { p: "sbpQr.enabled", label: "СБП по QR-коду (основной)", t: "bool" },
      { p: "sbpQr.provider", label: "Сервис СБП", t: "select", options: [["demo", "Демо (без денег)"], ["generic", "Сервис для самозанятых (ключи в .env)"]] },
      { p: "transfer.enabled", label: "Перевод по реквизитам (запасной)", t: "bool" },
      { p: "transfer.phone", label: "Телефон для СБП-перевода" },
      { p: "transfer.card", label: "Номер карты" },
      { p: "transfer.bank", label: "Банк" },
      { p: "transfer.holder", label: "Получатель (как в банке)" },
      { p: "transfer.cancelHours", label: "Отмена неоплаченного перевода через, часов", t: "number" },
      { p: "yookassa.enabled", label: "ЮKassa (для ИП)", t: "bool" },
    ],
  },
  {
    key: "flags",
    title: "Включение функций",
    fields: [
      { p: "photoUploadEnabled", label: "Принимать фото детей", t: "bool", hint: "Включайте после проверки текстов согласий юристом. Без фото — иллюстрации по описанию." },
      { p: "printEnabled", label: "Печать и физические допы", t: "bool", hint: "Выключите, если бухгалтер не подтвердит схему «изготовление на заказ с типографией-подрядчиком»." },
    ],
  },
  {
    key: "art",
    title: "Стили иллюстраций",
    fields: [
      { p: "showTrialStyles", label: "Показывать пробные стили", t: "bool", hint: "Пробные стили (значок «пробный») появятся в анкете и будут приниматься при заказе. Включайте, когда проверите их на GPU." },
    ],
  },
  {
    key: "limits",
    title: "Лимиты",
    fields: [
      { p: "dailySpendRub", label: "Расходы на генерацию в сутки, ₽", t: "number", hint: "Ограничивает только бесплатные превью. Оплаченные книги генерируются всегда." },
      { p: "previewsPerContact", label: "Превью в сутки на телефон/email", t: "number" },
      { p: "textsPerDevice", label: "Сказок в сутки с устройства", t: "number" },
      { p: "textsPerIp", label: "Сказок в сутки с одной сети (IP /24)", t: "number", hint: "Защита от сброса cookie; выше лимита устройства — соседи по сети делят его." },
      { p: "rewrites", label: "Переписать сказку, раз", t: "number" },
      { p: "freeRedraws", label: "Бесплатных перерисовок после покупки", t: "number" },
      { p: "redrawPriceRub", label: "Цена перерисовки сверх лимита, ₽", t: "number" },
      { p: "photoTtlDays", label: "Хранить фото, дней", t: "number" },
      { p: "photoTtlNoBookHours", label: "Фото без книги (анкета брошена), часов", t: "number", hint: "Фото загружают на первом шаге анкеты; если книга не создана — удаляем через столько часов." },
      { p: "moodChangesPreview", label: "Смен настроения до оплаты", t: "number" },
      { p: "staffDailySpendRub", label: "Расходы сотрудников на тесты в сутки, ₽", t: "number", hint: "Владелец, оператор и маркетолог тестируют без лимитов покупателя; их расходы на ИИ — только в этот лимит и отдельной серией на дашборде." },
    ],
  },
  {
    key: "bulk",
    title: "Книга для каждого в группе",
    note: "Один заказ — книга каждому ребёнку группы. Скидки по количеству не суммируются с промокодом и скидкой новичка.",
    fields: [
      { p: "enabled", label: "Предлагать «книгу для каждого»", t: "bool" },
      { p: "previewCopies", label: "Сколько книг рисуем до оплаты (вместе с основной)", t: "number" },
      { p: "tiers", label: "Скидки по количеству: книг:скидка %", t: "list", hint: "Через запятую, по возрастанию: 5:20, 15:30, 25:35 — от 5 книг −20%, от 15 — −30%, от 25 — −35%. Скидка 1–90%, не больше 6 порогов." },
    ],
  },
  {
    key: "gpu",
    title: "GPU-сервер (Qwen)",
    note: "Сервер с видеокартой арендуется по часам. По требованию — включается при задачах и выключается после простоя.",
    fields: [
      { p: "mode", label: "Режим", t: "select", options: [["on_demand", "По требованию"], ["schedule", "По расписанию в пик"], ["always", "Всегда включён"]] },
      { p: "idleMinutes", label: "Выключать после простоя, минут", t: "number" },
      { p: "scheduleFrom", label: "Пик: с", t: "time" },
      { p: "scheduleTo", label: "Пик: до", t: "time" },
      { p: "scheduleMonths", label: "Месяцы пика (через запятую)", t: "list" },
      { p: "preemptible", label: "Прерываемая машина (дешевле)", t: "bool" },
      { p: "hourlyRub", label: "Цена часа GPU, ₽ (для учёта расходов)", t: "number" },
    ],
  },
  {
    key: "ai",
    title: "ИИ-провайдеры",
    fields: [
      { p: "text", label: "Текст сказки", t: "select", options: [["demo", "Демо (шаблоны)"], ["yandexgpt", "YandexGPT"]] },
      { p: "image", label: "Иллюстрации", t: "select", options: [["demo", "Демо (SVG)"], ["qwen", "Qwen-Image-Edit на своём GPU"], ["kandinsky", "Kandinsky 5.0 на своём GPU"]] },
      { p: "tts", label: "Озвучка", t: "select", options: [["demo", "Демо"], ["speechkit", "Yandex SpeechKit"], ["salutespeech", "SaluteSpeech"]] },
      { p: "foreignImage", label: "Зарубежные модели", t: "bool", disabled: true, hint: "Выключено: нужно отдельное согласие и уведомление Роскомнадзора о трансграничной передаче." },
    ],
  },
  {
    key: "audio",
    title: "Аудио",
    fields: [
      { p: "ttsPriceRub", label: "Озвучка диктором, ₽", t: "number" },
      { p: "selfReadEnabled", label: "«Читаю сам» — запись своим голосом", t: "bool" },
      { p: "selfReadPriceRub", label: "«Читаю сам», ₽", t: "number" },
      { p: "cloneEnabled", label: "Клон голоса родителя (после юриста)", t: "bool", disabled: true },
      { p: "clonePriceRub", label: "Клон голоса, ₽", t: "number" },
    ],
  },
  {
    key: "cartoon",
    title: "Мультфильм по книге",
    note: "Мультфильм ~2 минуты по иллюстрациям книги: диктор или голос покупателя, музыка без чужих записей, субтитры. Рендер — в воркере на CPU (ffmpeg).",
    fields: [
      { p: "enabled", label: "Продавать мультфильм", t: "bool" },
      { p: "priceRub", label: "Мультфильм, ₽", t: "number", hint: "Цену владелица ещё не утвердила — 690 ₽ по умолчанию." },
      { p: "ownVoiceRub", label: "«Своим голосом», ₽", t: "number" },
      { p: "targetSec", label: "Длительность, секунд", t: "number", hint: "90–150; сценарий сжимается под неё (~2,2 слова в секунду)." },
      { p: "minSec", label: "Не короче, секунд", t: "number" },
      { p: "maxSec", label: "Не длиннее, секунд", t: "number" },
      { p: "subtitles", label: "Субтитры по умолчанию", t: "bool" },
      { p: "vertical", label: "Вертикальная версия 9:16 (телефон, истории)", t: "bool" },
      { p: "verticalHeight", label: "Вертикаль", t: "select", options: [["1280", "720×1280 (быстрее)"], ["1920", "1080×1920 (+~100 с CPU)"]] },
      { p: "voiceByAudience.CHILD", label: "Голос диктора: детские книги", t: "select", options: [["alena", "Алёна"], ["filipp", "Филипп"], ["jane", "Джейн"]] },
      { p: "voiceByAudience.TEEN", label: "Голос: подростки", t: "select", options: [["alena", "Алёна"], ["filipp", "Филипп"], ["jane", "Джейн"]] },
      { p: "voiceByAudience.ADULT", label: "Голос: взрослые", t: "select", options: [["alena", "Алёна"], ["filipp", "Филипп"], ["jane", "Джейн"]] },
      { p: "voiceByAudience.PET", label: "Голос: питомцы", t: "select", options: [["alena", "Алёна"], ["filipp", "Филипп"], ["jane", "Джейн"]] },
      { p: "music", label: "Музыка", hint: "synth — синтез без чужих записей; или ключ файла в хранилище books (например music/lullaby.mp3) — только лицензированные треки." },
      { p: "musicVolume", label: "Громкость музыки (1 — как есть)", t: "number" },
      { p: "freeRerenders", label: "Бесплатных пересборок", t: "number" },
      { p: "ownVoiceBuilds", label: "Сборок своим голосом", t: "number" },
      { p: "shareDays", label: "Ссылка «Поделиться», дней", t: "number" },
      { p: "voicePurgeDays", label: "Удалять записи голоса через, дней после выдачи", t: "number" },
      { p: "i2v", label: "Оживление картинок моделью (GPU)", t: "select", options: [["off", "Выключено"], ["wan", "Wan image-to-video (задел)"]], hint: "Нужен эндпоинт /v1/i2v на GPU-сервере; пока не реализован." },
    ],
  },
  {
    key: "shipping",
    title: "Доставка",
    note: "Точная цена СДЭК — по API при оформлении (ключи в .env). Без ключей и для Почты/Яндекса — тарифы ниже.",
    fields: [
      { p: "cdekPvz", label: "СДЭК — пункт выдачи", t: "bool" },
      { p: "cdekCourier", label: "СДЭК — курьер", t: "bool" },
      { p: "pochta", label: "Почта России", t: "bool" },
      { p: "yandex", label: "Яндекс Доставка", t: "bool" },
      { p: "freeShippingBooks", label: "Бесплатная доставка СДЭК до ПВЗ от, книг", t: "number" },
      { p: "fallbackRub.cdek_pvz", label: "Тариф СДЭК ПВЗ, ₽", t: "number" },
      { p: "fallbackRub.cdek_courier", label: "Тариф СДЭК курьер, ₽", t: "number" },
      { p: "fallbackRub.pochta", label: "Тариф Почта, ₽", t: "number" },
      { p: "fallbackRub.yandex", label: "Тариф Яндекс, ₽", t: "number" },
      { p: "distanceMarkup", label: "Тарифы без API — с поправкой на удалённость города", t: "bool" },
    ],
  },
  {
    key: "notifications",
    title: "Почта и каналы уведомлений",
    note: "Пока SMTP не задан, письма пишутся в журнал, а уведомления идут в Telegram и MAX.",
    fields: [
      { p: "smtpHost", label: "SMTP-сервер", hint: "Например, smtp.yandex.ru" },
      { p: "smtpPort", label: "Порт", t: "number" },
      { p: "smtpUser", label: "Логин" },
      { p: "smtpPassword", label: "Пароль приложения", t: "password", hint: "Хранится зашифрованным. Оставьте пустым, чтобы не менять." },
      { p: "smtpFrom", label: "Отправитель" },
      { p: "telegram", label: "Telegram-бот", t: "bool" },
      { p: "max", label: "MAX-бот", t: "bool" },
      { p: "whatsapp", label: "WhatsApp", t: "bool", disabled: true, hint: "Выключен: передача номера в Meta — трансграничная передача ПДн." },
    ],
  },
  {
    key: "alerts",
    title: "Алерты владельцу",
    fields: [
      { p: "email", label: "Почта для алертов", t: "email" },
      { p: "telegramChatId", label: "Telegram chat_id для алертов" },
      { p: "spendPct", label: "Письмо при расходах, % лимита", t: "list" },
      { p: "npdPct", label: "Письмо по лимиту НПД, %", t: "list" },
    ],
  },
  {
    key: "referral",
    title: "Приведи друга",
    fields: [
      { p: "newbiePct", label: "Скидка новичку, %", t: "number" },
      { p: "bonusPct", label: "Бонус приглашающему, %", t: "number" },
      { p: "delayDays", label: "Бонус через, дней", t: "number" },
    ],
  },
  {
    key: "auth",
    title: "Вход",
    fields: [
      { p: "phoneRequired", label: "Телефон обязателен при входе", t: "bool" },
      { p: "smsLogin", label: "Вход по SMS-коду на телефон", t: "bool", hint: "Нужен SMS_PROVIDER. Выключено — код только на почту." },
    ],
  },
  {
    key: "promoBar",
    title: "Полоса промо сверху",
    fields: [
      { p: "enabled", label: "Показывать", t: "bool" },
      { p: "holidayAuto", label: "Ближайший праздник вместо текста", t: "bool", hint: "Пока печать успевает к празднику из раздела «Праздники»: «Новый год: осталось 63 дня. Печатную книгу успеем, если заказать до 17 декабря». Выключите — всегда текст ниже." },
      { p: "text", label: "Текст" },
    ],
  },
  {
    key: "season",
    title: "Сезон на главной",
    fields: [
      { p: "mode", label: "Сезон", t: "select", options: [["auto", "Ближайший праздник из раздела «Праздники» (иначе — по дате)"], ["manual", "Выбранный повод"], ["off", "Без сезона"]] },
      { p: "occasion", label: "Повод (для «Выбранный повод»), например novyj-god" },
      { p: "printDeadline", label: "Последний день заказа печатной книги к празднику (ГГГГ-ММ-ДД)", hint: "Пусто — посчитаем сами: печать 5 рабочих дней + доставка до 7 дней." },
    ],
  },
  {
    key: "newsletter",
    title: "Подписка на главной",
    fields: [
      { p: "promoCode", label: "Промокод за подписку", hint: "Создайте промокод в разделе «Промокоды». Пусто — блок подписки скрыт." },
      { p: "discountText", label: "Текст выгоды" },
    ],
  },
];

const get = (o: unknown, path: string) => path.split(".").reduce<unknown>((x, k) => (x as Record<string, unknown>)?.[k], o);

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; sec?: string }> }) {
  await requireAdmin("settings");
  const sp = await searchParams;
  const s = await getSettings();
  const houses = await db.printHouse.findMany({ orderBy: { name: "asc" } });
  const legal = await Promise.all(Object.keys(LEGAL).map(async (k) => [k, await getSetting<{ markdown: string } | null>(`legal.${k}`, null)] as const));

  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Настройки</h1>
      {sp.error && !sp.sec && <p className="error" role="alert">Не сохранено: {sp.error}</p>}
      <p className="muted">Ключи сервисов (платежи, СДЭК, ИИ, боты) задаются в файле .env на сервере — здесь то, что меняется без программиста.</p>
      {SECTIONS.map((sec) => {
        const values = s[sec.key];
        const bools = sec.fields.filter((f) => f.t === "bool").map((f) => f.p);
        return (
          <form key={sec.key} id={sec.key} action={settingsAction} className="panel">
            <input type="hidden" name="__key" value={sec.key} />
            <input type="hidden" name="__bools" value={bools.join(",")} />
            <h2 style={{ fontSize: "var(--fs-lg)" }}>{sec.title}</h2>
            {sec.note && <p className="small muted">{sec.note}</p>}
            {sp.error && sp.sec === sec.key && <p className="error" role="alert">Не сохранено: {sp.error}</p>}
            {sp.saved === sec.key && <p className="small" role="status">Сохранено.</p>}
            <div className="grid2">
              {sec.fields.map((f) => {
                const v = get(values, f.p);
                if (f.t === "bool")
                  return (
                    <label key={f.p} className="check">
                      <input type="checkbox" name={`f.${f.p}`} defaultChecked={Boolean(v)} disabled={"disabled" in f && f.disabled} />
                      <span>{f.label}{f.hint && <><br /><small className="muted">{f.hint}</small></>}</span>
                    </label>
                  );
                if (f.t === "select")
                  return (
                    <label key={f.p} className="field"><span>{f.label}</span>
                      <select className="select" name={`f.${f.p}`} defaultValue={String(v)}>{f.options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                    </label>
                  );
                return (
                  <label key={f.p} className="field">
                    <span>{f.label}</span>
                    <input className="input" name={`f.${f.p}`} type={f.t === "list" ? "text" : f.t ?? "text"} defaultValue={f.t === "password" ? "" : Array.isArray(v) ? (v.length && typeof v[0] === "object" ? formatTiers(v as { min: number; pct: number }[]) : v.join(", ")) : String(v ?? "")} />
                    {f.hint && <small>{f.hint}</small>}
                  </label>
                );
              })}
            </div>
            <button className="btn btn--primary btn--sm">Сохранить</button>
          </form>
        );
      })}

      <section id="print" className="panel">
        <h2 style={{ fontSize: "var(--fs-lg)" }}>Типографии</h2>
        <p className="small muted">Можно завести несколько и выбрать активную. Себестоимость — по строке на формат или доп: <code>std-hard: 1450</code>.</p>
        {[...houses, null].map((h) => (
          <details key={h?.id ?? "new"} className="edit" open={!h && houses.length === 0}>
            <summary>{h ? `${h.name}${h.isActive ? " — активная" : ""}` : "Добавить типографию"}</summary>
            <form action={printHouseAction} style={{ marginTop: 10 }}>
              {h && <input type="hidden" name="id" value={h.id} />}
              <div className="grid2">
                <label className="field"><span>Название</span><input className="input" name="name" defaultValue={h?.name} required /></label>
                <label className="field"><span>Контакты</span><input className="input" name="contacts" defaultValue={h?.contacts ?? ""} /></label>
                <label className="field"><span>Email для заказов</span><input className="input" type="email" name="email" defaultValue={h?.email ?? ""} /></label>
                <label className="field"><span>API (если есть)</span><input className="input" name="apiUrl" defaultValue={h?.apiUrl ?? ""} /></label>
                <label className="field"><span>Адрес самовывоза</span><input className="input" name="pickupAddress" defaultValue={h?.pickupAddress ?? ""} /><small>Пока пусто — вариант «Отправлю сам» скрыт.</small></label>
                <div className="row">
                  <label className="field"><span>Срок, дней от</span><input className="input" type="number" name="leadDaysMin" defaultValue={h?.leadDaysMin ?? 3} style={{ width: 90 }} /></label>
                  <label className="field"><span>до</span><input className="input" type="number" name="leadDaysMax" defaultValue={h?.leadDaysMax ?? 5} style={{ width: 90 }} /></label>
                </div>
              </div>
              <label className="field"><span>Себестоимость</span><textarea className="textarea" name="costs" defaultValue={Object.entries((h?.costs ?? {}) as Record<string, number>).map(([k, v]) => `${k}: ${v}`).join("\n")} /></label>
              <label className="check"><input type="checkbox" name="isActive" defaultChecked={h?.isActive ?? true} /> Активная типография</label>
              <button className="btn btn--primary btn--sm">Сохранить</button>
            </form>
          </details>
        ))}
      </section>

      <section id="legal" className="panel">
        <h2 style={{ fontSize: "var(--fs-lg)" }}>Тексты документов</h2>
        <p className="small muted">Пусто — используется встроенный шаблон. Подстановки: {"{ФИО}"} {"{ИНН}"} {"{email}"} {"{телефон}"} {"{домен}"}. Разметка: ## подзаголовок, - пункт, пустая строка — абзац.</p>
        {legal.map(([k, v]) => (
          <details key={k} className="edit">
            <summary>{LEGAL[k].title} {v?.markdown ? "— своя редакция" : ""}</summary>
            <form action={legalAction} style={{ marginTop: 8 }}>
              <input type="hidden" name="key" value={k} />
              <textarea className="textarea" name="markdown" defaultValue={v?.markdown ?? ""} style={{ minHeight: 200 }} />
              <button className="btn btn--primary btn--sm">Сохранить</button>
            </form>
          </details>
        ))}
      </section>
    </>
  );
}

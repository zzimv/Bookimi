// Путь заказа глазами покупателя: этапы, текущий этап, короткое тёплое слово от команды на каждом шаге.
// Чистые функции (без БД) — используются на /zakaz/[id], в кабинете и в тестах.

export type StageKey = "created" | "paid" | "ready" | "print" | "shipped" | "delivered";
export type StageState = "done" | "current" | "todo";

export interface JourneyOrder {
  status: string;
  whoPrints: string; // self | bookimi
  createdAt: Date;
  paidAt?: Date | null;
  readyDate?: Date | null; // плановая готовность печати
  bookReadyAt?: Date | null; // книга нарисована (Book.fullReadyAt)
  heroAcc?: string | null; // имя героя в винительном падеже: «про Машу»
  shipment?: { method: string; etaDate?: Date | null; trackNumber?: string | null } | null;
}

export interface Stage {
  key: StageKey;
  title: string;
  state: StageState;
  when?: string; // «29 октября» — когда случилось, или «ориентировочно к …» для будущих шагов
  message?: string; // слово от команды — только у текущего этапа
}

const day = (d: Date) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "Europe/Moscow" });

const about = (acc?: string | null) => (acc ? ` про ${acc}` : "");

export function journey(o: JourneyOrder): { stages: Stage[]; current: number; closed: boolean } {
  const print = o.whoPrints === "bookimi";
  const pickup = o.shipment?.method === "pickup";
  const ready = Boolean(o.bookReadyAt);
  const keys: StageKey[] = print ? ["created", "paid", "ready", "print", "shipped", "delivered"] : ["created", "paid", "ready"];

  let current: number;
  switch (o.status) {
    case "PENDING_PAYMENT":
    case "AWAITING_CONFIRMATION":
      current = 0;
      break;
    case "PAID":
      current = ready ? 2 : 1;
      break;
    case "IN_PRINT":
    case "PACKED":
      current = print ? 3 : 2;
      break;
    case "SHIPPED":
      current = print ? 4 : 2;
      break;
    case "DELIVERED":
      current = keys.length - 1;
      break;
    default:
      current = -1; // отменён / возврат — путь не показываем
  }
  const closed = current < 0;

  const track = o.shipment?.trackNumber;
  const eta = o.shipment?.etaDate;

  const info: Record<StageKey, { title: string; done?: Date | null; plan?: string; message: string }> = {
    created: {
      title: "Заказ оформлен",
      done: o.createdAt,
      message:
        o.status === "AWAITING_CONFIRMATION"
          ? "Спасибо! Проверяем перевод — обычно это до 2 часов в рабочее время. Как только деньги придут, сразу начнём рисовать."
          : "Спасибо, что выбрали нас. Книга сохранена — как только пройдёт оплата, начнём рисовать.",
    },
    paid: {
      title: "Оплачен",
      done: o.paidAt,
      message: `Спасибо, что выбрали нас! Мы уже рисуем книгу${about(o.heroAcc)}. Обычно это занимает меньше часа — пришлём сообщение, когда всё будет готово.`,
    },
    ready: {
      title: print ? "Книга нарисована" : "Книга готова",
      done: o.bookReadyAt,
      plan: o.paidAt ? "обычно в течение часа" : undefined,
      message: print
        ? "Иллюстрации готовы — книгу уже можно полистать в кабинете. Тем временем готовим её к печати."
        : "Книга готова: PDF и читалка ждут в кабинете. Надеемся, она подарит вам тёплый вечер с чтением вслух.",
    },
    print: {
      title: "В типографии",
      plan: o.readyDate ? `готовность к ${day(o.readyDate)}` : undefined,
      message:
        o.status === "PACKED"
          ? "Книга напечатана и упакована — скоро передадим её в доставку."
          : `Книга у типографии — печатаем бережно.${o.readyDate ? ` Будет готова к ${day(o.readyDate)}.` : ""}`,
    },
    shipped: {
      title: pickup ? "Можно забирать" : "Едет к вам",
      plan: eta ? `доставка ориентировочно к ${day(eta)}` : undefined,
      message: pickup
        ? "Книга ждёт вас в пункте выдачи типографии. Возьмите с собой код заказа."
        : track
          ? `Едет к вам! Трек: ${track}.${eta ? ` Ориентировочно — ${day(eta)}.` : ""}`
          : `Передали книгу в доставку. Трек-номер пришлём, как только он появится.${eta ? ` Ориентировочно — ${day(eta)}.` : ""}`,
    },
    delivered: {
      title: "Получена",
      message: "Надеемся, книга подарила улыбку. Спасибо, что вы с нами.",
    },
  };

  const stages: Stage[] = keys.map((key, i) => {
    const s = info[key];
    const state: StageState = closed ? "todo" : i < current ? "done" : i === current ? "current" : "todo";
    let when: string | undefined;
    if (s.done && i <= current) when = day(s.done);
    else if (i > current && s.plan) when = s.plan; // у текущего этапа срок — в слове команды
    return { key, title: s.title, state, when, message: i === current ? s.message : undefined };
  });
  return { stages, current, closed };
}

/** Короткая строка для списка заказов: текущий этап и слово команды. */
export function journeyLine(o: JourneyOrder): string | null {
  const j = journey(o);
  return j.closed ? null : (j.stages[j.current]?.message ?? null);
}

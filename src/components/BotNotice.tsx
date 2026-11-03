"use client";
// Вежливая плашка для явной автоматики (rev 19): src/lib/bot-notice.ts. Людям и поисковым роботам не показывается.
// Ничего не блокирует: плашка внизу, закрывается кнопкой. Обход для наших проверок — ?qa=1 или localStorage["bookimi.qa"].
import { useEffect, useState } from "react";
import { botNoticeText, classifyUa, qaBypass, type NoticeContacts } from "@/lib/bot-notice";

export function BotNotice({ email, phone, site }: NoticeContacts) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let store: Storage | null = null;
    try {
      store = localStorage;
    } catch {}
    if (qaBypass(location.href, store)) return;
    try {
      if (sessionStorage.getItem("bk_notice") === "1") return;
    } catch {}
    if (classifyUa(navigator.userAgent, navigator.webdriver) === "automation") setShow(true);
  }, []);
  if (!show) return null;
  const text = botNoticeText({ email, phone, site });
  const hasContacts = Boolean(email?.trim() || phone?.trim());
  return (
    <aside className="bot-notice" role="note" aria-label="Обращение от команды БУКИМИ" data-bot-notice>
      <p>{text}</p>
      <div className="bot-notice__row">
        {!hasContacts && <a href="/kontakty">Контакты</a>}
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => {
            try {
              sessionStorage.setItem("bk_notice", "1");
            } catch {}
            setShow(false);
          }}
        >
          Понятно
        </button>
      </div>
    </aside>
  );
}

"use client";
import { useRouter } from "next/navigation";
import { OtpForm } from "@/components/OtpForm";
import { FlowLegal } from "@/components/FlowLegal";

export function LoginBox({ next, consentGiven, complete, initialName, initialEmail }: { next: string; consentGiven?: boolean; complete?: boolean; initialName?: string; initialEmail?: string }) {
  const router = useRouter();
  return (
    <>
      <OtpForm
        submitLabel="Получить код"
        phoneRequired={complete ? true : false}
        consentGiven={consentGiven}
        complete={complete}
        initialName={initialName}
        initialEmail={initialEmail}
        next={next}
        onDone={(role) => {
          router.push(next || (role === "CUSTOMER" ? "/kabinet" : "/admin"));
          router.refresh();
        }}
      />
      {/* Вход посреди создания книги (?next=…) — без большого подвала, одна строка ссылок */}
      {next && <FlowLegal />}
    </>
  );
}

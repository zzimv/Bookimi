"use client";
import { useRouter } from "next/navigation";
import { OtpForm } from "@/components/OtpForm";

export function LoginBox({ next, consentGiven }: { next: string; consentGiven?: boolean }) {
  const router = useRouter();
  return (
    <OtpForm
      submitLabel="Получить код"
      phoneRequired={false}
      consentGiven={consentGiven}
      onDone={(role) => {
        router.push(next || (role === "CUSTOMER" ? "/kabinet" : "/admin"));
        router.refresh();
      }}
    />
  );
}

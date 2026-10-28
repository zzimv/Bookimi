"use client";
import { useRouter } from "next/navigation";
import { OtpForm } from "@/components/OtpForm";

export function LoginBox({ next }: { next: string }) {
  const router = useRouter();
  return (
    <OtpForm
      submitLabel="Получить код"
      onDone={(role) => {
        router.push(next || (role === "CUSTOMER" ? "/kabinet" : "/admin"));
        router.refresh();
      }}
    />
  );
}

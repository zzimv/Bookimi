import { LegalPage, legalMetadata } from "@/components/LegalPage";

export const revalidate = 300;
export const metadata = legalMetadata("soglasie-rassylka", "/soglasie/rassylka");

export default function Page() {
  return <LegalPage docKey="soglasie-rassylka" />;
}

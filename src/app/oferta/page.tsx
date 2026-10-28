import { LegalPage, legalMetadata } from "@/components/LegalPage";

export const revalidate = 300;
export const metadata = legalMetadata("oferta", "/oferta");

export default function Page() {
  return <LegalPage docKey="oferta" />;
}

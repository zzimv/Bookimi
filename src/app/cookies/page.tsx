import { LegalPage, legalMetadata } from "@/components/LegalPage";

export const revalidate = 300;
export const metadata = legalMetadata("cookies", "/cookies");

export default function Page() {
  return <LegalPage docKey="cookies" />;
}

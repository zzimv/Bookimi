import { LegalPage, legalMetadata } from "@/components/LegalPage";

export const revalidate = 300;
export const metadata = legalMetadata("politika", "/politika");

export default function Page() {
  return <LegalPage docKey="politika" />;
}

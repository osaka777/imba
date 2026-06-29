import { Metadata } from "next";

import { CybersportSection } from "~/entities/cybersport/ui/CybersportSection";
import { makeMetadata } from "~/shared/lib";

export const metadata: Metadata = makeMetadata("Киберспорт");

export default function CybersportPage() {
  return <CybersportSection />;
}

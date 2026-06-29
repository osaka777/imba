import { redirect } from "next/navigation";

import { DEFAULT_CYBER_SPORT } from "~/entities/cybersport/lib/cyberSportsList";

export default function CybersportLineIndexPage() {
  redirect(`/cybersport/line/${DEFAULT_CYBER_SPORT}`);
}

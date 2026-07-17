import { getPartnerLandings } from "@/entities/landing/api";
import { LandingBuilder } from "@/widgets/LandingBuilder/LandingBuilder";
import { LandingList } from "@/widgets/LandingList/LandingList";
import shell from "../profile-shell.module.css";

export default async function LandingsPage() {
  let landings: Awaited<ReturnType<typeof getPartnerLandings>> = [];
  try {
    landings = await getPartnerLandings();
  } catch {
    landings = [];
  }

  return (
    <>
      <header className={shell.pageHeader}>
        <h1 className={shell.pageTitle}>Лендинги</h1>
        <p className={shell.pageSubtitle}>
          Готовые посадочные страницы с матчами из линии и лайва — с вашим партнёрским тегом
        </p>
      </header>

      <LandingList landings={landings} />
      <LandingBuilder />
    </>
  );
}

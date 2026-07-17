import {
  getKickAnalyticsAction,
  getKickSessionsAction,
  getKickStatusAction,
} from "@/entities/kick/actions";
import { getReferralLink } from "@/entities/user/api/getReferralLink";
import { KickWelcomeProgress } from "@/widgets/KickWelcomeProgress/KickWelcomeProgress";
import { KickConnectCard } from "@/widgets/KickConnect/KickConnectCard";
import { KickOnboardingChecklist } from "@/widgets/KickOnboardingChecklist/KickOnboardingChecklist";
import { KickStreamWizard } from "@/widgets/KickStreamWizard/KickStreamWizard";
import { KickStreamGuide } from "@/widgets/KickStreamGuide/KickStreamGuide";
import { KickStreamLiveEarnings } from "@/widgets/KickStreamLiveEarnings/KickStreamLiveEarnings";
import { KickStreamAnalytics } from "@/widgets/KickStreamAnalytics/KickStreamAnalytics";
import shell from "../profile-shell.module.css";
import layout from "./stream-page.module.css";

type Props = {
  searchParams?: {
    kick?: string;
    reason?: string;
  };
};

export default async function StreamPage({ searchParams }: Props) {
  const referral = await getReferralLink();
  const welcomeNotice = searchParams?.kick === "welcome";
  const connectNotice =
    searchParams?.kick === "connected"
      ? "connected"
      : searchParams?.kick === "error"
        ? "error"
        : null;

  const [initialStatus, initialSessions, initialAnalytics] = await Promise.all([
    getKickStatusAction().catch(() => null),
    getKickSessionsAction().catch(() => []),
    getKickAnalyticsAction().catch(() => null),
  ]);

  return (
    <>
      <header className={shell.pageHeader}>
        <h1 className={shell.pageTitle}>Стрим</h1>
        <p className={shell.pageSubtitle}>
          Подключите Kick-канал, получайте ссылку для чата и отслеживайте трафик с эфира
        </p>
      </header>

      {referral ? (
        <div className={layout.layout}>
          <div className={layout.rowFull}>
            <KickStreamWizard
              analytics={initialAnalytics}
              referralLink={referral.referralLink}
              sessions={initialSessions}
              showWelcome={welcomeNotice}
              status={initialStatus}
            />
          </div>

          <div className={layout.rowFull}>
            <KickStreamLiveEarnings />
          </div>

          <div className={layout.rowPair}>
            <div className={layout.cell}>
              <KickConnectCard
                referralLink={referral.referralLink}
                partnerUid={referral.uid}
                initialNotice={connectNotice}
                errorReason={searchParams?.reason ?? null}
                initialStatus={initialStatus}
                initialSessions={initialSessions}
              />
            </div>
            <div className={layout.cell}>
              <KickOnboardingChecklist
                sessions={initialSessions}
                status={initialStatus}
              />
            </div>
          </div>

          <div className={layout.rowPair}>
            <div className={layout.cell}>
              <KickWelcomeProgress status={initialStatus} />
            </div>
            <div className={layout.cell}>
              <KickStreamGuide
                channelSlug={initialStatus?.channelSlug}
                promoCode={referral.promoCodes?.[0]?.code ?? null}
              />
            </div>
          </div>

          <div className={layout.rowFull}>
            <KickStreamAnalytics data={initialAnalytics} />
          </div>
        </div>
      ) : (
        <p className={shell.muted}>Не удалось загрузить партнёрскую ссылку</p>
      )}
    </>
  );
}

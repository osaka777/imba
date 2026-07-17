import { getReferralLink } from "@/entities/user/api/getReferralLink";
import { getReferredClients } from "@/entities/user/api/getClients";
import { ReferralLinkCard } from "@/widgets/ReferralLink/ReferralLinkCard";
import { ReferralHowItWorks } from "@/widgets/ReferralHowItWorks/ReferralHowItWorks";
import { PartnerPromoCreateForm } from "@/widgets/PartnerPromoCreateForm/PartnerPromoCreateForm";
import shell from "../profile-shell.module.css";

export default async function ReferralsPage() {
  const [referral, clients] = await Promise.all([
    getReferralLink(),
    getReferredClients(),
  ]);

  return (
    <>
      <header className={shell.pageHeader}>
        <h1 className={shell.pageTitle}>Рефералы</h1>
        <p className={shell.pageSubtitle}>
          Ваша ссылка и игроки, зарегистрированные по партнёрскому тегу
        </p>
      </header>

      <ReferralHowItWorks />

      {referral ? (
        <ReferralLinkCard
          referralLink={referral.referralLink}
          percent={referral.percent}
          promoCodes={referral.promoCodes}
        />
      ) : (
        <p className={shell.muted}>Не удалось загрузить реферальную ссылку</p>
      )}

      <PartnerPromoCreateForm />

      <section className={shell.section}>
        <h2 className={shell.sectionTitle}>Ваши рефералы ({clients.length})</h2>
        {clients.length === 0 ? (
          <p className={shell.muted}>Пока нет зарегистрированных игроков по вашей ссылке</p>
        ) : (
          <div className={shell.tableWrap}>
            <table className={shell.dataTable}>
              <thead>
                <tr>
                  <th>Игрок</th>
                  <th>Регистрация</th>
                  <th>Ставки</th>
                  <th>Победы</th>
                  <th>Проигрыши</th>
                  <th>Оборот</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td>{client.email}</td>
                    <td>{new Date(client.registeredAt).toLocaleDateString("ru-RU")}</td>
                    <td>{client.totalBets}</td>
                    <td>{client.totalWins}</td>
                    <td>{client.totalLosses}</td>
                    <td>{client.totalStake}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

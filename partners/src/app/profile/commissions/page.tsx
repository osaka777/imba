import { getCommissions } from "@/entities/user/api/getCommissions";
import { getPostbacks } from "@/entities/user/api/getPostbacks";
import { formatMoney } from "@/shared/lib/formatCurrencySymbol";
import shell from "../profile-shell.module.css";

export default async function CommissionsPage() {
  const [commissions, postbacks] = await Promise.all([
    getCommissions(100),
    getPostbacks(20),
  ]);

  return (
    <>
      <header className={shell.pageHeader}>
        <h1 className={shell.pageTitle}>Комиссии</h1>
        <p className={shell.pageSubtitle}>
          Начисления RevShare, hold-период и журнал postback-уведомлений
        </p>
      </header>

      <section className={shell.section}>
        <h2 className={shell.sectionTitle}>Начисления ({commissions.length})</h2>
        {commissions.length === 0 ? (
          <p className={shell.muted}>Пока нет начислений</p>
        ) : (
          <div className={shell.tableWrap}>
            <table className={shell.dataTable}>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Тип</th>
                  <th>Сумма</th>
                  <th>Hold</th>
                  <th>Игрок</th>
                  <th>Ставка</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.createdAt).toLocaleString("ru-RU")}</td>
                    <td>{item.type === "INCOME" ? "Начисление" : "Сторно"}</td>
                    <td>
                      {formatMoney(item.amount, item.currencyCode)}
                    </td>
                    <td>
                      {item.onHold && item.holdUntil
                        ? `до ${new Date(item.holdUntil).toLocaleDateString("ru-RU")}`
                        : "—"}
                    </td>
                    <td>{item.playerId ?? "—"}</td>
                    <td>{item.betId ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={shell.section}>
        <h2 className={shell.sectionTitle}>Postback лог</h2>
        {postbacks.length === 0 ? (
          <p className={shell.muted}>Postback ещё не отправлялись</p>
        ) : (
          <div className={shell.tableWrap}>
            <table className={shell.dataTable}>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Событие</th>
                  <th>HTTP</th>
                  <th>Статус</th>
                  <th>Попытки</th>
                </tr>
              </thead>
              <tbody>
                {postbacks.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.createdAt).toLocaleString("ru-RU")}</td>
                    <td>{item.event}</td>
                    <td>{item.httpStatus ?? "—"}</td>
                    <td>{item.status}</td>
                    <td>{item.attempt}</td>
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

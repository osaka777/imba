import styles from "./KickShortLinkQr.module.css";

type Props = {
  url: string;
  label?: string;
};

export function KickShortLinkQr({ url, label = "QR для OBS и описания канала" }: Props) {
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}&margin=10&color=0f0e27&bgcolor=ffffff`;

  return (
    <div className={styles.wrap}>
      <img className={styles.qr} src={qrSrc} alt={`QR: ${url}`} width={160} height={160} />
      <p className={styles.label}>{label}</p>
      <p className={styles.hint}>Зрители сканируют с телефона — сразу на imba.bet</p>
    </div>
  );
}

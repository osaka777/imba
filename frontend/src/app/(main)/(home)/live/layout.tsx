import { makeMetadata } from "~/shared/lib";

export const metadata = makeMetadata("Live-ставки", {
  description:
    "Live-ставки на спорт в Imba.bet: футбол, теннис, баскетбол и другие дисциплины с актуальными коэффициентами в режиме реального времени.",
  path: "/live",
});

export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

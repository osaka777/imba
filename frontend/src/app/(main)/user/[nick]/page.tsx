import { TraderProfile } from "~/entities/btc-updown/ui/TraderProfile";

type Props = {
  params: Promise<{ nick: string }>;
};

export default async function UserProfilePage({ params }: Props) {
  const { nick } = await params;
  const decoded = decodeURIComponent(nick || "").trim();
  if (!decoded) {
    return <TraderProfile idOrNick="" />;
  }
  return <TraderProfile idOrNick={decoded} />;
}

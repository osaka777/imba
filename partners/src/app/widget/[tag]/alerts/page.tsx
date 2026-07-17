import { StreamAlertsWidget } from "./StreamAlertsWidget";

type Props = {
  params: Promise<{ tag: string }>;
};

export default async function WidgetAlertsPage({ params }: Props) {
  const { tag } = await params;
  return <StreamAlertsWidget tag={tag} />;
}

import { StreamWidget } from "./StreamWidget";

type Props = {
  params: Promise<{ tag: string }>;
};

export default async function WidgetPage({ params }: Props) {
  const { tag } = await params;
  return <StreamWidget tag={tag} />;
}

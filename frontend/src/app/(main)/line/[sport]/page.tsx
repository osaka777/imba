import { redirect } from "next/navigation";

export default async function LineSportRedirect({
  params,
}: {
  params: Promise<{ sport: string }>;
}) {
  const { sport } = await params;
  redirect(`/line?sport=${encodeURIComponent(sport)}`);
}

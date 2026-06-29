import { redirect } from "next/navigation";

export default async function SportRedirect({
  params,
}: {
  params: Promise<{ sport: string }>;
}) {
  const { sport } = await params;
  redirect(`/live?sport=${encodeURIComponent(sport)}`);
}

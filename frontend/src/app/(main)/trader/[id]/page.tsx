import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

/** Legacy /trader/:id → /user/:id (API resolves numeric id). */
export default async function TraderRedirectPage({ params }: Props) {
  const { id } = await params;
  redirect(`/user/${encodeURIComponent(id)}`);
}

import { PredictionEventPage } from "~/entities/prediction/ui/PredictionEventPage";

function decodeSlug(raw: string) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default async function EventDetailPage({
  params,
}: {
  params: { slug: string } | Promise<{ slug: string }>;
}) {
  const resolved = await Promise.resolve(params);
  const slug = decodeSlug(resolved.slug || "");
  return <PredictionEventPage slug={slug} />;
}

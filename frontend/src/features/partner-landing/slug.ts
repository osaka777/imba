/** Next.js иногда передаёт slug в percent-encoding — нормализуем для API. */
export function normalizeLandingSlug(raw: string): string {
  let slug = raw.trim();
  for (let i = 0; i < 2; i++) {
    if (!slug.includes("%")) break;
    try {
      const decoded = decodeURIComponent(slug);
      if (decoded === slug) break;
      slug = decoded;
    } catch {
      break;
    }
  }
  return slug;
}

export const AVATAR_PRESETS = [
  "violet",
  "cyan",
  "amber",
  "rose",
  "emerald",
  "slate",
] as const;

export type AvatarPreset = (typeof AVATAR_PRESETS)[number];

export const AVATAR_PRESET_COLORS: Record<AvatarPreset, string> = {
  violet: "#7c3aed",
  cyan: "#0891b2",
  amber: "#d97706",
  rose: "#e11d48",
  emerald: "#059669",
  slate: "#64748b",
};

const FALLBACK_COLORS = [
  "#f7931a",
  "#627eea",
  "#14f195",
  "#0acf97",
  "#3b82f6",
  "#ef473a",
];

export function isAvatarPreset(v: string | null | undefined): v is AvatarPreset {
  return !!v && (AVATAR_PRESETS as readonly string[]).includes(v);
}

export function avatarColor(
  preset?: string | null,
  seed?: number | string | null,
): string {
  if (isAvatarPreset(preset)) return AVATAR_PRESET_COLORS[preset];
  const s = String(seed ?? "0");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return FALLBACK_COLORS[h % FALLBACK_COLORS.length]!;
}

export function initialsFromLabel(label?: string | null): string {
  if (!label) return "?";
  const clean = label.replace(/^@/, "").trim();
  if (!clean) return "?";
  const parts = clean.replace(/[^a-zA-Z0-9а-яА-ЯёЁ]/g, " ").trim().split(/\s+/);
  if (!parts.length) return clean.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

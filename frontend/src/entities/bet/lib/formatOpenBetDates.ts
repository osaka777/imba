export function formatOpenBetHeaderDate(iso: string): string {
  const formatted = new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Almaty",
  });
  return formatted.replace(", ", " · ");
}

export function formatOpenBetKickoff(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Almaty",
  });
}

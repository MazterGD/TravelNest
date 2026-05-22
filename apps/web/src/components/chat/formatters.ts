export function formatMessageTime(date: string | Date, locale: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function formatListPreviewTime(
  date: string | Date | null,
  locale: string,
  yesterdayLabel: string,
): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  if (d >= startOfToday) {
    return new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  }
  if (d >= startOfYesterday) {
    return yesterdayLabel;
  }
  const diffDays = Math.floor((startOfToday.getTime() - d.getTime()) / 86_400_000);
  if (diffDays < 7) {
    return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d);
  }
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  }).format(d);
}

export function formatTripDateRange(
  start: string | Date,
  end: string | Date,
  locale: string,
): string {
  const s = typeof start === "string" ? new Date(start) : start;
  const e = typeof end === "string" ? new Date(end) : end;
  const fmt = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  });
  return `${fmt.format(s)} – ${fmt.format(e)}`;
}

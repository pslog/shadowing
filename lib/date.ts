// Local-date helpers. All dates are handled as YYYY-MM-DD strings in the
// user's local timezone so "today" matches the user's wall clock.

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateKey(d);
}

/** Number of whole days between two date keys (b - a). */
export function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

/** The last `n` date keys ending today (oldest first). */
export function lastNDays(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(toDateKey(d));
  }
  return out;
}

export function shortDayLabel(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00");
  return ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
}

// Dreamland calendar: 12 months of 28 days, 7-day weeks, 336-day years.
// Because 28 divides evenly into weeks, every month starts on the same weekday,
// so the weekday depends only on the day of the month (day 1 is always Sunday).

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAYS_PER_MONTH = 28;
export const DAYS_PER_YEAR = 12 * DAYS_PER_MONTH;

export interface DDate {
  y: number;
  m: number; // 1-12
  d: number; // 1-28
  /** Absolute day number, used for sorting and math. */
  idx: number;
}

export function makeDate(y: number, m: number, d: number): DDate {
  return { y, m, d, idx: (y * 12 + (m - 1)) * DAYS_PER_MONTH + (d - 1) };
}

/**
 * Accepts M/D/YYYY (what the sheet uses) or YYYY-MM-DD.
 * Returns null for blanks; throws with a readable message for bad values.
 */
export function parseDate(raw: string): DDate | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{1,2})\/(\d{1,2})\/(-?\d{1,4})$/);
  if (match) {
    [m, d, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = s.match(/^(-?\d{1,4})-(\d{1,2})-(\d{1,2})$/))) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    throw new Error(`"${s}" is not a date. Use M/D/YYYY, like 6/4/1947.`);
  }
  if (m < 1 || m > 12) throw new Error(`"${s}" has month ${m}. Months run 1 to 12.`);
  if (d < 1 || d > DAYS_PER_MONTH) throw new Error(`"${s}" has day ${d}. Dreamland months have 28 days.`);
  return makeDate(y, m, d);
}

export function ordinal(n: number): string {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  const suffix = ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

export function weekday(date: DDate): string {
  return WEEKDAYS[(date.d - 1) % 7];
}

export function fullDate(date: DDate): string {
  return `${weekday(date)}, ${MONTHS[date.m - 1]} ${ordinal(date.d)}, ${date.y}`;
}

export function shortDate(date: DDate): string {
  return `${String(date.m).padStart(2, "0")}/${String(date.d).padStart(2, "0")}`;
}

export function duration(a: DDate, b: DDate): string {
  const days = b.idx - a.idx;
  if (days <= 0) return "Single day";
  const y = Math.floor(days / DAYS_PER_YEAR);
  const m = Math.floor((days % DAYS_PER_YEAR) / DAYS_PER_MONTH);
  const d = days % DAYS_PER_MONTH;
  const parts: string[] = [];
  if (y) parts.push(`${y} ${y === 1 ? "year" : "years"}`);
  if (m) parts.push(`${m} ${m === 1 ? "month" : "months"}`);
  if (d) parts.push(`${d} ${d === 1 ? "day" : "days"}`);
  return parts.join(", ");
}

export function yearsBetween(a: DDate, b: DDate): number {
  return Math.floor((b.idx - a.idx) / DAYS_PER_YEAR);
}

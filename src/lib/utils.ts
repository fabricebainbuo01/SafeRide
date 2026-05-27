/** Calendar date `YYYY-MM-DD` in the user's local timezone (avoids UTC drift from `toISOString()`). */
export function localDateISOString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatCurrency(amount: number, currency: string = "XAF"): string {
  return new Intl.NumberFormat("fr-CM", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ` ${currency}`;
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-CM", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${m} ${period}`;
}

type ClassValue = string | number | boolean | null | undefined;

export function cn(...classes: ClassValue[]): string {
  return classes.filter((c): c is string | number => Boolean(c) && typeof c !== "boolean").join(" ");
}

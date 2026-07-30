import type { CourseCategory } from "@/lib/data/repository";

export function formatEuro(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

export const categoryLabels: Record<CourseCategory, string> = {
  GROUP_CAMP: "Kitecamp",
  PRIVATE_HOURS: "Privatstunden",
};

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

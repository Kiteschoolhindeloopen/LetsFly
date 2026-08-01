export type WindTone = "low" | "good" | "strong";

export interface WindThresholds {
  minGoodKn: number;
  maxGoodKn: number;
}

export interface WindCategory {
  tone: WindTone;
  label: string;
  shortLabel: string;
}

export function categorizeWind(kn: number, thresholds: WindThresholds): WindCategory {
  if (kn < thresholds.minGoodKn) {
    return { tone: "low", label: "Wenig Wind", shortLabel: "Wenig" };
  }
  if (kn > thresholds.maxGoodKn) {
    return { tone: "strong", label: "Starker Wind", shortLabel: "Stark" };
  }
  return { tone: "good", label: "Gute Bedingungen", shortLabel: "Gut" };
}

export const WIND_TONE_TEXT_CLASS: Record<WindTone, string> = {
  low: "text-lf-muted",
  good: "text-emerald-700 dark:text-emerald-300",
  strong: "text-amber-700 dark:text-amber-300",
};

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

export type ShoreDirection = "onshore" | "cross-shore" | "offshore";

export interface WindDirectionCategory {
  direction: ShoreDirection;
  label: string;
}

export function categorizeWindDirection(directionDeg: number, beachFacingDeg: number): WindDirectionCategory {
  const rawDiff = Math.abs(directionDeg - beachFacingDeg) % 360;
  const diff = rawDiff > 180 ? 360 - rawDiff : rawDiff;

  if (diff <= 45) {
    return { direction: "onshore", label: "Auflandig" };
  }
  if (diff >= 135) {
    return { direction: "offshore", label: "Ablandig" };
  }
  return { direction: "cross-shore", label: "Seitlich" };
}

export const SHORE_DIRECTION_TEXT_CLASS: Record<ShoreDirection, string> = {
  onshore: "text-emerald-700 dark:text-emerald-300",
  "cross-shore": "text-lf-muted",
  offshore: "text-red-700 dark:text-red-300",
};

export function isGusty(speedKn: number, gustKn: number, gustFactorThreshold: number): boolean {
  if (speedKn <= 0) return false;
  return gustKn / speedKn >= gustFactorThreshold;
}

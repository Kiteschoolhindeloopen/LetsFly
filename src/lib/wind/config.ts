import type { WindThresholds } from "./categorize";

export const WIND_LAT = 52.9666;
export const WIND_LON = 5.4121;

// Kompassrichtung, in die man vom Spot (Workum, IJsselmeer-Ostufer) aufs offene Wasser blickt.
export const BEACH_FACING_DEG = 270;

// Böen gelten ab diesem Verhältnis Böe/Grundwind als "böig" (schwerer vorhersehbar).
export const GUST_FACTOR_THRESHOLD = 1.3;

const THRESHOLDS_KEY = "letsfly_wind_thresholds";
const DEFAULT_THRESHOLDS: WindThresholds = { minGoodKn: 12, maxGoodKn: 25 };

const isBrowser = typeof window !== "undefined";

export function getWindThresholds(): WindThresholds {
  if (!isBrowser) return DEFAULT_THRESHOLDS;
  const raw = window.localStorage.getItem(THRESHOLDS_KEY);
  if (!raw) return DEFAULT_THRESHOLDS;
  try {
    const parsed = JSON.parse(raw) as WindThresholds;
    if (typeof parsed.minGoodKn === "number" && typeof parsed.maxGoodKn === "number") {
      return parsed;
    }
    return DEFAULT_THRESHOLDS;
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}

export function saveWindThresholds(thresholds: WindThresholds): void {
  if (!isBrowser) return;
  window.localStorage.setItem(THRESHOLDS_KEY, JSON.stringify(thresholds));
}

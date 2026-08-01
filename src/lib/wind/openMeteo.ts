import { WIND_LAT, WIND_LON } from "./config";

interface OpenMeteoHourlyResponse {
  hourly: {
    time: string[];
    wind_speed_10m: number[];
  };
}

interface OpenMeteoCurrentResponse {
  current: {
    wind_speed_10m: number;
  };
}

let hourlyCache: Promise<Map<string, number>> | null = null;

export function windHourKey(date: Date): string {
  return date.toISOString().slice(0, 16);
}

export function fetchHourlyWindKn(): Promise<Map<string, number>> {
  if (!hourlyCache) {
    hourlyCache = fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${WIND_LAT}&longitude=${WIND_LON}&hourly=wind_speed_10m&wind_speed_unit=kn&forecast_days=16&timezone=UTC`
    )
      .then((res) => {
        if (!res.ok) throw new Error(`Open-Meteo request failed: ${res.status}`);
        return res.json() as Promise<OpenMeteoHourlyResponse>;
      })
      .then((data) => {
        const map = new Map<string, number>();
        data.hourly.time.forEach((iso, i) => {
          map.set(iso, data.hourly.wind_speed_10m[i]);
        });
        return map;
      })
      .catch((err) => {
        hourlyCache = null;
        throw err;
      });
  }
  return hourlyCache;
}

export function fetchCurrentWindKn(): Promise<number> {
  return fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${WIND_LAT}&longitude=${WIND_LON}&current=wind_speed_10m&wind_speed_unit=kn&timezone=UTC`
  )
    .then((res) => {
      if (!res.ok) throw new Error(`Open-Meteo request failed: ${res.status}`);
      return res.json() as Promise<OpenMeteoCurrentResponse>;
    })
    .then((data) => data.current.wind_speed_10m);
}

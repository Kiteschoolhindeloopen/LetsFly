const isBrowser = typeof window !== "undefined";

export function loadCollection<T>(key: string, seed: T[]): T[] {
  if (!isBrowser) return seed;
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    window.localStorage.setItem(key, JSON.stringify(seed));
    return seed;
  }
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return seed;
  }
}

export function saveCollection<T>(key: string, data: T[]): void {
  if (!isBrowser) return;
  window.localStorage.setItem(key, JSON.stringify(data));
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

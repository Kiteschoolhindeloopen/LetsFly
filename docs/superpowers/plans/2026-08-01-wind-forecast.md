# Live-Windbedingungen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kunden sehen auf der Buchungsseite pro Stunden-Slot die voraussichtliche Windgeschwindigkeit in Knoten + ein Bewertungswort ("Wenig"/"Gut"/"Stark"), auf dem Dashboard die aktuelle Windbedingung, und der Admin kann die Knoten-Schwellenwerte für "gut" selbst einstellen.

**Architecture:** Neues eigenständiges Modul `src/lib/wind/` (drei kleine Dateien: Kategorisierung, Konfiguration/Schwellenwerte, Open-Meteo-API-Client), bewusst getrennt vom `Repository`-Layer (`src/lib/data/`), da es sich um eine echte externe Live-Info handelt, nicht um Mock/Supabase-Kundendaten. Drei bestehende Seiten (`book`, `dashboard`, `admin`) konsumieren dieses Modul rein additiv — keine bestehende Logik wird umgebaut.

**Tech Stack:** Next.js App Router (Client Components), React `useState`/`useEffect`, natives `fetch` (kein neues npm-Package), Open-Meteo Forecast API (kostenlos, kein Key), Tailwind CSS (bestehende Utility-Klassen/CSS-Variablen).

## Global Constraints

- Datenzugriffe für Kunden-/Buchungsdaten laufen ausschließlich über den Repository-Layer (`src/lib/data/*`) — das Wind-Modul ist bewusst **kein** Teil davon (siehe Architecture), da es keine Mock/Supabase-austauschbare Datenquelle ist, sondern ein echter Live-API-Aufruf.
- Kein Supabase, kein `.env`, kein Account-Zwang (AGENTS.md) — Open-Meteo braucht keinen Key.
- `npm run dev` muss weiterhin ohne Internet startbar/klickbar bleiben — die Wind-Anzeige ist rein additiv und darf bei fehlendem Internet nie eine Fehlermeldung zeigen oder den Buchungsablauf blockieren (siehe Spec, Abschnitt „Fehlerverhalten“).
- Nur bestehende Farb-Utilities verwenden: `bg-lf-*`, `text-lf-muted`, `text-foreground`, `bg-background`, `border-lf-border` sowie die bereits im Projekt etablierten Status-Farben `emerald-*` (gut/verfügbar) und `amber-*` (Warnung) — keine neuen Marken-/Akzentfarben einführen (AGENTS.md-Farbpalette).
- Projekt hat keinen Test-Runner (kein Jest/Vitest/Playwright in `package.json`). Verifikation je Task erfolgt über `npm run lint`, `npx tsc --noEmit` und manuellen Klick-Durchlauf im Dev-Server (`npm run dev`) — konsistent mit dem bestehenden Plan `docs/superpowers/plans/2026-07-30-onboarding-wizard.md`.
- Nach Abschluss aller Tasks: Dev-Server starten und die Änderungen im Browser zeigen (AGENTS.md, „Workflow: Änderungen zeigen“).
- Spec-Referenz: `docs/superpowers/specs/2026-08-01-wind-forecast-design.md`.

---

### Task 1: Wind-Kategorisierung + Schwellenwerte

**Files:**
- Create: `src/lib/wind/categorize.ts`
- Create: `src/lib/wind/config.ts`

**Interfaces:**
- Consumes: nichts (erster Task).
- Produces (aus `categorize.ts`): `type WindTone = "low" | "good" | "strong"`, `interface WindThresholds { minGoodKn: number; maxGoodKn: number }`, `interface WindCategory { tone: WindTone; label: string; shortLabel: string }`, `function categorizeWind(kn: number, thresholds: WindThresholds): WindCategory`, `const WIND_TONE_TEXT_CLASS: Record<WindTone, string>`.
- Produces (aus `config.ts`): `const WIND_LAT: number`, `const WIND_LON: number`, `function getWindThresholds(): WindThresholds`, `function saveWindThresholds(thresholds: WindThresholds): void`.

- [ ] **Step 1: `src/lib/wind/categorize.ts` erstellen**

```ts
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
```

- [ ] **Step 2: `src/lib/wind/config.ts` erstellen**

```ts
import type { WindThresholds } from "./categorize";

export const WIND_LAT = 52.9847;
export const WIND_LON = 5.4372;

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
```

- [ ] **Step 3: Typecheck & Lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: Beide Befehle laufen ohne Fehler durch.

- [ ] **Step 4: Commit**

```bash
git add src/lib/wind/categorize.ts src/lib/wind/config.ts
git commit -m "$(cat <<'EOF'
feat: add wind category + threshold config module

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Open-Meteo-Client

**Files:**
- Create: `src/lib/wind/openMeteo.ts`

**Interfaces:**
- Consumes: `WIND_LAT`, `WIND_LON` aus `src/lib/wind/config.ts` (Task 1).
- Produces: `function windHourKey(date: Date): string`, `function fetchHourlyWindKn(): Promise<Map<string, number>>`, `function fetchCurrentWindKn(): Promise<number>` — werden von Task 3 und 4 konsumiert.

Verifiziert per `curl` (Antwortformat der echten API, `timezone=UTC` liefert Stunden-Keys im Format `YYYY-MM-DDTHH:00`, exakt passend zu `date.toISOString().slice(0, 16)`):

```
$ curl -s "https://api.open-meteo.com/v1/forecast?latitude=52.9847&longitude=5.4372&hourly=wind_speed_10m&current=wind_speed_10m&wind_speed_unit=kn&forecast_days=1&timezone=UTC"
{"...","hourly":{"time":["2026-08-01T00:00","2026-08-01T01:00",...],"wind_speed_10m":[4.5,3.1,...]},"current":{"time":"2026-08-01T13:30","wind_speed_10m":8.6}}
```

- [ ] **Step 1: `src/lib/wind/openMeteo.ts` erstellen**

```ts
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
```

- [ ] **Step 2: Typecheck & Lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: Beide Befehle laufen ohne Fehler durch.

- [ ] **Step 3: Commit**

```bash
git add src/lib/wind/openMeteo.ts
git commit -m "$(cat <<'EOF'
feat: add Open-Meteo hourly/current wind client

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Stundenraster auf der Buchungsseite

**Files:**
- Modify: `src/app/book/page.tsx`

**Interfaces:**
- Consumes: `fetchHourlyWindKn`, `windHourKey` aus `src/lib/wind/openMeteo.ts` (Task 2); `getWindThresholds` aus `src/lib/wind/config.ts` (Task 1); `categorizeWind`, `WIND_TONE_TEXT_CLASS` aus `src/lib/wind/categorize.ts` (Task 1).
- Produces: nichts Neues für andere Tasks (Blattknoten der Feature-Baums).

- [ ] **Step 1: Imports ergänzen**

Finde in `src/app/book/page.tsx`:

```tsx
import { categoryLabels, formatDateTime, formatEuro } from "@/lib/format";
import { getCurrentCustomerId } from "@/lib/demoSession";
import { WaiverConsent } from "@/components/WaiverConsent";
```

Ersetze durch:

```tsx
import { categoryLabels, formatDateTime, formatEuro } from "@/lib/format";
import { getCurrentCustomerId } from "@/lib/demoSession";
import { WaiverConsent } from "@/components/WaiverConsent";
import { fetchHourlyWindKn, windHourKey } from "@/lib/wind/openMeteo";
import { getWindThresholds } from "@/lib/wind/config";
import { categorizeWind, WIND_TONE_TEXT_CLASS } from "@/lib/wind/categorize";
```

- [ ] **Step 2: State + Effekt für Winddaten in `HourPicker` ergänzen**

Finde:

```tsx
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [waiverAccepted, setWaiverAccepted] = useState(false);

  const weekStart = new Date(startOfWeek(new Date()));
```

Ersetze durch:

```tsx
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [windByHour, setWindByHour] = useState<Map<string, number> | null>(null);
  const [windThresholds] = useState(() => getWindThresholds());

  useEffect(() => {
    fetchHourlyWindKn()
      .then(setWindByHour)
      .catch(() => setWindByHour(null));
  }, []);

  const weekStart = new Date(startOfWeek(new Date()));
```

- [ ] **Step 3: Zeit-Buttons um Wind-Zeile erweitern**

Finde:

```tsx
            <div className="flex flex-wrap gap-2">
              {day.cells.map((cell) => {
                const disabled = cell.isPast || cell.isBooked;
                return (
                  <button
                    key={cell.iso}
                    onClick={() => openCell(cell)}
                    disabled={disabled}
                    className={
                      disabled
                        ? "rounded-lg bg-lf-border px-3 py-2 text-xs font-bold text-lf-muted"
                        : "rounded-lg border-2 border-emerald-400 bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-900 transition-colors hover:bg-emerald-200 active:bg-emerald-300 dark:border-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/70"
                    }
                  >
                    {pad(cell.hour)}:00
                  </button>
                );
              })}
            </div>
```

Ersetze durch:

```tsx
            <div className="flex flex-wrap gap-2">
              {day.cells.map((cell) => {
                const disabled = cell.isPast || cell.isBooked;
                const windKn = windByHour?.get(windHourKey(cell.date));
                const wind = windKn !== undefined ? categorizeWind(windKn, windThresholds) : null;
                return (
                  <button
                    key={cell.iso}
                    onClick={() => openCell(cell)}
                    disabled={disabled}
                    className={
                      disabled
                        ? "rounded-lg bg-lf-border px-3 py-2 text-xs font-bold text-lf-muted"
                        : "rounded-lg border-2 border-emerald-400 bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-900 transition-colors hover:bg-emerald-200 active:bg-emerald-300 dark:border-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/70"
                    }
                  >
                    <span className="block">{pad(cell.hour)}:00</span>
                    {wind && (
                      <span
                        className={`mt-0.5 block text-[10px] font-semibold normal-case ${WIND_TONE_TEXT_CLASS[wind.tone]}`}
                      >
                        {Math.round(windKn as number)}kn · {wind.shortLabel}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
```

- [ ] **Step 4: Typecheck & Lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: Beide Befehle laufen ohne Fehler durch.

- [ ] **Step 5: Manueller Klick-Durchlauf**

Run: `npm run dev` (Terminal offen lassen)

Im Browser:
1. `http://localhost:3000` öffnen, mit `lisa.meyer@email.de` einloggen → landet auf `/dashboard`.
2. Zu `/book` navigieren ("Termin buchen"), Kategorie "Privatstunden" (Standard).
3. Prüfen: Verfügbare (grüne) Zeit-Buttons für die aktuelle Woche zeigen unter der Uhrzeit eine zweite Zeile, z. B. „6kn · Wenig“ oder „14kn · Gut“, farblich passend.
4. Mehrmals auf "›" klicken, um mehrere Wochen vorzublättern (über Tag 16 der Vorhersage hinaus) → Buttons zeigen dann wieder nur die Uhrzeit, keine Wind-Zeile, kein Fehler in der Konsole.
5. Einen freien Slot anklicken → Bestätigungs-Dialog öffnet sich wie bisher, Buchungsablauf unverändert nutzbar.

Expected: Alle 5 Punkte treffen zu, keine Konsolenfehler im Browser.

- [ ] **Step 6: Commit**

```bash
git add src/app/book/page.tsx
git commit -m "$(cat <<'EOF'
feat: show hourly wind knots + rating on booking grid

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Aktuelle-Windbedingungen-Karte auf dem Dashboard

**Files:**
- Modify: `src/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `fetchCurrentWindKn` aus `src/lib/wind/openMeteo.ts` (Task 2); `getWindThresholds` aus `src/lib/wind/config.ts` (Task 1); `categorizeWind`, `WIND_TONE_TEXT_CLASS` aus `src/lib/wind/categorize.ts` (Task 1).
- Produces: nichts Neues für andere Tasks.

- [ ] **Step 1: Imports ergänzen**

Finde in `src/app/dashboard/page.tsx`:

```tsx
import { formatDateTime, formatEuro } from "@/lib/format";
import { getCurrentCustomerId } from "@/lib/demoSession";
import { useLiveRefresh } from "@/lib/useLiveRefresh";
```

Ersetze durch:

```tsx
import { formatDateTime, formatEuro } from "@/lib/format";
import { getCurrentCustomerId } from "@/lib/demoSession";
import { useLiveRefresh } from "@/lib/useLiveRefresh";
import { fetchCurrentWindKn } from "@/lib/wind/openMeteo";
import { getWindThresholds } from "@/lib/wind/config";
import { categorizeWind, WIND_TONE_TEXT_CLASS } from "@/lib/wind/categorize";
```

- [ ] **Step 2: State ergänzen**

Finde:

```tsx
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [windBannerDismissed, setWindBannerDismissed] = useState(false);
  const [windBannerActive, setWindBannerActive] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
```

Ersetze durch:

```tsx
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [windBannerDismissed, setWindBannerDismissed] = useState(false);
  const [windBannerActive, setWindBannerActive] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [currentWindKn, setCurrentWindKn] = useState<number | null>(null);
  const [windThresholds] = useState(() => getWindThresholds());
```

- [ ] **Step 3: Effekt für aktuellen Wind ergänzen**

Finde:

```tsx
  useEffect(() => {
    load();
  }, []);

  useLiveRefresh(load);
```

Ersetze durch:

```tsx
  useEffect(() => {
    load();
  }, []);

  useLiveRefresh(load);

  useEffect(() => {
    fetchCurrentWindKn()
      .then(setCurrentWindKn)
      .catch(() => setCurrentWindKn(null));
  }, []);
```

- [ ] **Step 4: Abgeleiteten Wert ergänzen**

Finde:

```tsx
  const next = upcoming[0];
  const hasUnread = notifications.some((n) => n.unread);
  const showWindBanner = !windBannerDismissed && windBannerActive;
```

Ersetze durch:

```tsx
  const next = upcoming[0];
  const hasUnread = notifications.some((n) => n.unread);
  const showWindBanner = !windBannerDismissed && windBannerActive;
  const currentWind = currentWindKn !== null ? categorizeWind(currentWindKn, windThresholds) : null;
```

- [ ] **Step 5: Karte einfügen**

Finde (Ende des Hero-Header-Blocks, direkt vor dem bestehenden Wind-Warnbanner):

```tsx
          </div>
        </div>
      </div>

      {showWindBanner && next && (
```

Ersetze durch:

```tsx
          </div>
        </div>
      </div>

      {currentWind && currentWindKn !== null && (
        <div className="mx-5 mt-4 rounded-2xl border border-lf-border bg-lf-card p-4.5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-lf-muted">Aktuelle Windbedingungen</p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-foreground">{Math.round(currentWindKn)}kn</span>
            <span className={`text-sm font-bold ${WIND_TONE_TEXT_CLASS[currentWind.tone]}`}>
              {currentWind.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-lf-muted">Workum, IJsselmeer</p>
        </div>
      )}

      {showWindBanner && next && (
```

- [ ] **Step 6: Typecheck & Lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: Beide Befehle laufen ohne Fehler durch.

- [ ] **Step 7: Manueller Klick-Durchlauf**

Run: `npm run dev` (falls nicht schon aktiv)

Im Browser:
1. Mit `lisa.meyer@email.de` einloggen → `/dashboard`.
2. Direkt unter dem blauen Header-Bereich (vor „Nächster Termin“-Karte bzw. Windbanner) erscheint die neue Karte „Aktuelle Windbedingungen“ mit Knoten-Wert + Bewertungswort + „Workum, IJsselmeer“.
3. Netzwerk in den Browser-DevTools auf „Offline“ stellen, Seite neu laden → Karte verschwindet komplett, keine Fehlermeldung sichtbar, restliche Seite (Termine, Buttons) funktioniert normal.

Expected: Alle 3 Punkte treffen zu, keine Konsolenfehler im Browser.

- [ ] **Step 8: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "$(cat <<'EOF'
feat: show current wind conditions card on dashboard

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Admin-Schwellenwert-Editor

**Files:**
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `getWindThresholds`, `saveWindThresholds` aus `src/lib/wind/config.ts` (Task 1); `WindThresholds` Typ aus `src/lib/wind/categorize.ts` (Task 1).
- Produces: nichts Neues für andere Tasks.

- [ ] **Step 1: Imports ergänzen**

Finde in `src/app/admin/page.tsx`:

```tsx
import { categoryLabels, formatDateTime, formatEuro } from "@/lib/format";
import { useLiveRefresh } from "@/lib/useLiveRefresh";
import { DEMO_ADMIN_ID } from "@/lib/demoSession";
```

Ersetze durch:

```tsx
import { categoryLabels, formatDateTime, formatEuro } from "@/lib/format";
import { useLiveRefresh } from "@/lib/useLiveRefresh";
import { DEMO_ADMIN_ID } from "@/lib/demoSession";
import { getWindThresholds, saveWindThresholds } from "@/lib/wind/config";
import type { WindThresholds } from "@/lib/wind/categorize";
```

- [ ] **Step 2: State ergänzen**

Finde:

```tsx
  const [newWindowStart, setNewWindowStart] = useState("");
  const [newWindowEnd, setNewWindowEnd] = useState("");
  const [newWindowCategory, setNewWindowCategory] = useState<CourseCategory>("PRIVATE_HOURS");
  const [creatingWindow, setCreatingWindow] = useState(false);

  const [windPreset, setWindPreset] = useState<(typeof WIND_PRESETS)[number]["key"] | null>(null);
```

Ersetze durch:

```tsx
  const [newWindowStart, setNewWindowStart] = useState("");
  const [newWindowEnd, setNewWindowEnd] = useState("");
  const [newWindowCategory, setNewWindowCategory] = useState<CourseCategory>("PRIVATE_HOURS");
  const [creatingWindow, setCreatingWindow] = useState(false);

  const [windThresholds, setWindThresholds] = useState<WindThresholds>(() => getWindThresholds());
  const [thresholdsSaved, setThresholdsSaved] = useState(false);

  const [windPreset, setWindPreset] = useState<(typeof WIND_PRESETS)[number]["key"] | null>(null);
```

- [ ] **Step 3: Save-Handler ergänzen**

Finde:

```tsx
    setWindCancelledRows(windAffected);
    setWindDone(true);
    await load();
  }

  async function handleCancelBooking(row: BookingRow) {
```

Ersetze durch:

```tsx
    setWindCancelledRows(windAffected);
    setWindDone(true);
    await load();
  }

  function handleSaveThresholds(e: React.FormEvent) {
    e.preventDefault();
    saveWindThresholds(windThresholds);
    setThresholdsSaved(true);
  }

  async function handleCancelBooking(row: BookingRow) {
```

- [ ] **Step 4: Formular im „Wind-Absage“-Tab einfügen**

Finde:

```tsx
      {tab === "wind" && (
        <div className="mt-6">
          <p className="text-sm leading-relaxed text-lf-muted">
            Zeitraum wählen — betroffene Termine werden automatisch abgesagt und Kunden per Nachricht informiert.
          </p>
```

Ersetze durch:

```tsx
      {tab === "wind" && (
        <div className="mt-6">
          <form onSubmit={handleSaveThresholds} className="mb-5 rounded-xl border border-lf-border p-4">
            <p className="text-sm font-semibold text-foreground">Windschwellen für „Gute Bedingungen“</p>
            <div className="mt-3 flex gap-3">
              <label className="flex-1 text-xs font-semibold text-lf-muted">
                Ab wie vielen Knoten gut?
                <input
                  type="number"
                  min={0}
                  value={windThresholds.minGoodKn}
                  onChange={(e) => {
                    setThresholdsSaved(false);
                    setWindThresholds((t) => ({ ...t, minGoodKn: Number(e.target.value) }));
                  }}
                  className="mt-1 w-full rounded-lg border border-lf-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </label>
              <label className="flex-1 text-xs font-semibold text-lf-muted">
                Bis wie vielen Knoten gut?
                <input
                  type="number"
                  min={0}
                  value={windThresholds.maxGoodKn}
                  onChange={(e) => {
                    setThresholdsSaved(false);
                    setWindThresholds((t) => ({ ...t, maxGoodKn: Number(e.target.value) }));
                  }}
                  className="mt-1 w-full rounded-lg border border-lf-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </label>
            </div>
            <button type="submit" className="mt-3 rounded-lg bg-lf-ocean px-4 py-2 text-xs font-bold text-white">
              {thresholdsSaved ? "Gespeichert ✓" : "Speichern"}
            </button>
          </form>

          <p className="text-sm leading-relaxed text-lf-muted">
            Zeitraum wählen — betroffene Termine werden automatisch abgesagt und Kunden per Nachricht informiert.
          </p>
```

- [ ] **Step 5: Typecheck & Lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: Beide Befehle laufen ohne Fehler durch.

- [ ] **Step 6: Manueller Klick-Durchlauf**

Run: `npm run dev` (falls nicht schon aktiv)

Im Browser:
1. Mit `admin@letsfly.de` einloggen → `/admin`.
2. Tab „Wind-Absage“ öffnen → neues Formular „Windschwellen für ‚Gute Bedingungen‘“ mit zwei Zahlenfeldern (vorbefüllt `12` / `25`) und Button „Speichern“ erscheint oberhalb der bestehenden Zeitraum-Presets.
3. Werte ändern (z. B. `18` / `30`), „Speichern“ klicken → Button-Text wechselt kurz zu „Gespeichert ✓“.
4. Seite neu laden → Felder zeigen weiterhin `18` / `30` (aus `localStorage` gelesen).
5. Zu `/book` navigieren (als Kunde, z. B. `lisa.meyer@email.de` in neuem Tab/nach Logout) → Bewertungswörter im Stundenraster orientieren sich an den neuen Schwellenwerten (z. B. Slots mit 20kn zeigen jetzt „Wenig“ statt „Gut“).

Expected: Alle 5 Punkte treffen zu, keine Konsolenfehler im Browser.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "$(cat <<'EOF'
feat: let admin configure wind rating thresholds

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: End-to-End-Durchlauf & Demo

**Files:**
- Keine neuen/geänderten Dateien — reine Verifikation über alle drei Oberflächen hinweg.

**Interfaces:**
- Consumes: alle Exporte aus Task 1–5 (indirekt über die drei Seiten).
- Produces: nichts.

- [ ] **Step 1: Vollständiger Durchlauf im Dev-Server**

Run: `npm run dev` (falls nicht schon aktiv)

Im Browser:
1. Als Kunde (`lisa.meyer@email.de`) einloggen → Dashboard zeigt „Aktuelle Windbedingungen“-Karte.
2. Zu `/book` → Stundenraster zeigt Knoten + Bewertungswort pro verfügbarer Stunde.
3. Ausloggen (oder neues Fenster), als Admin (`admin@letsfly.de`) einloggen → Tab „Wind-Absage“ → Schwellenwerte ändern und speichern.
4. Zurück als Kunde `/book` neu laden → Bewertungswörter im Raster haben sich entsprechend den neuen Schwellenwerten verschoben.
5. Browser-DevTools → Netzwerk auf „Offline“ stellen → `/dashboard` und `/book` neu laden: keine Wind-Anzeigen mehr sichtbar, aber Login, Navigation, Buchungsdialog (Slot öffnen bis kurz vor „Bestätigen“) funktionieren weiterhin fehlerfrei.

Expected: Alle 5 Punkte treffen zu, keine Konsolenfehler im Browser, kein Bruch bestehender Funktionalität (Buchungsablauf, Stundenpaket-Anzeige, Notifications).

- [ ] **Step 2: Dem Nutzer zeigen**

Screenshot oder kurze Beschreibung der drei Screens (Dashboard-Karte, Buchungsraster mit Wind-Zeilen, Admin-Schwellenwert-Formular) gemäß AGENTS.md-Workflow „Änderungen zeigen“.

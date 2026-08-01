# Live-Windbedingungen pro Stunde

## Kontext

Die Buchungsseite [book/page.tsx](../../../src/app/book/page.tsx) zeigt in
`HourPicker` ein Wochenraster mit stündlichen Zeit-Buttons (10:00–17:00,
7 Tage, `HOURS`-Array). Kunden sollen dort direkt sehen, wie gut die
Windbedingungen zur jeweiligen Stunde voraussichtlich sind, statt nur die
Uhrzeit zu klicken und danach zu raten.

Standort der Kiteschule: Workum, Suderséleane 29, 8711 GX Workum,
Niederlande (IJsselmeer) — Koordinaten ca. 52.9847° N, 5.4372° O.

Laut [AGENTS.md](../../../AGENTS.md) muss `npm run dev` ohne Internet/Account
startbar und klickbar bleiben. Eine echte Wetter-API ist hiervon nicht
betroffen, weil Open-Meteo keinen Account/Key braucht — aber die Anzeige
selbst braucht zur Laufzeit Internet. Das ist bewusst akzeptiert (siehe
Fehlerverhalten unten): ohne Internet verschwindet nur die Wind-Anzeige,
der Rest der App bleibt unverändert nutzbar.

Der Admin-Bereich hat bereits einen Tab „Wind-Absage“
([admin/page.tsx](../../../src/app/admin/page.tsx), `tab === "wind"`), der
manuell Buchungen wegen Windvorhersage stornieren lässt — unabhängig von
echten Wetterdaten. Dieser Tab bekommt zusätzlich eigene, admin-editierbare
Schwellenwerte für die neue Live-Anzeige.

## Ziel / Nicht-Ziel

- **Ziel:** Pro Stunden-Button im Buchungsraster erscheint eine kompakte
  Zusatzzeile mit Windgeschwindigkeit in Knoten + einem kurzen
  Bewertungswort ("Wenig" / "Gut" / "Stark"), farblich unterschieden.
- **Ziel:** Auf dem Dashboard (Startseite nach Login) erscheint eine kleine
  Karte mit der aktuellen Windbedingung (Knoten + Bewertung).
- **Ziel:** Admin kann die Knoten-Schwellenwerte, die "Gut" definieren,
  im bestehenden „Wind-Absage“-Tab ändern; Standardwerte (12–25kn = Gut)
  bleiben dauerhaft aktiv, bis der Admin sie ändert.
- **Nicht-Ziel:** Die Wind-Anzeige beeinflusst die Buchbarkeit von Slots
  nicht — sie ist rein informativ, auch bei "Starker Wind" bleibt der Slot
  buchbar.
- **Nicht-Ziel:** Keine Integration in die bestehende manuelle
  „Wind-Absage“-Stornologik (`handleWindCancel`) — die läuft unverändert
  weiter, unabhängig von echten Wetterdaten.
- **Nicht-Ziel:** Keine Anzeige bei Kitecamp-Terminen (`GROUP_CAMP`) — nur
  Privatstunden-Raster und Dashboard.
- **Nicht-Ziel:** Kein Offline-Fallback mit simulierten Werten — bei
  fehlender Verbindung wird die Wind-Info schlicht weggelassen (siehe
  Fehlerverhalten).

## Umsetzung

### Neues Modul `src/lib/wind/`

Bewusst **nicht** Teil des `Repository`-Interfaces
([data/repository.ts](../../../src/lib/data/repository.ts)), da es sich um
eine echte externe Live-Info handelt und nicht um die
Mock/Supabase-austauschbaren Kunden-/Buchungsdaten, für die der
Repository-Layer laut AGENTS.md gedacht ist.

- **`config.ts`**
  - Konstante Koordinaten (`WIND_LAT`, `WIND_LON`) für Workum.
  - `getWindThresholds(): { minGoodKn: number; maxGoodKn: number }` liest aus
    `localStorage` (Key `letsfly_wind_thresholds`), Fallback `{12, 25}`,
    gleiches Lese/Schreib-Muster wie
    [mock/storage.ts](../../../src/lib/data/mock/storage.ts).
  - `saveWindThresholds(t)` schreibt in `localStorage`.

- **`openMeteo.ts`**
  - `fetchHourlyWindKn(): Promise<Map<string, number>>` — ein Fetch gegen
    `https://api.open-meteo.com/v1/forecast` mit
    `latitude/longitude`, `hourly=wind_speed_10m`, `wind_speed_unit=kn`,
    `forecast_days=16`, `timezone=Europe%2FAmsterdam`. Ergebnis-Map:
    ISO-Stunden-String → Knoten.
  - Ergebnis wird modul-intern im Speicher gecacht (einfaches
    `let cache: Promise<Map<...>> | null`), damit nicht bei jedem Rendern neu
    geladen wird — Cache lebt für die Dauer der Seiten-Session.
  - Wirft bei Netzwerkfehler/HTTP-Fehler eine Exception; Aufrufer fangen sie
    ab (siehe Fehlerverhalten).
  - `fetchCurrentWindKn(): Promise<number>` für die Dashboard-Karte, nutzt
    denselben Endpunkt mit `current=wind_speed_10m`.

- **`categorize.ts`**
  - Reine Funktion `categorizeWind(kn: number, thresholds): { label: string;
    tone: "low" | "good" | "strong" }`.
  - `tone` steuert Farbe: `low` = grau/blau, `good` = grün, `strong` = amber.
  - Labels: „Wenig Wind“, „Gute Bedingungen“, „Starker Wind“ (lang, für die
    Dashboard-Karte) bzw. „Wenig“, „Gut“, „Stark“ (kurz, für die kompakten
    Buttons im Raster).

### Buchungsseite — `HourPicker` in [book/page.tsx](../../../src/app/book/page.tsx)

- Neuer `useEffect`, der beim Mounten `fetchHourlyWindKn()` einmal aufruft
  und in einen lokalen State `windByIso: Map<string, number> | null` legt;
  bei Fehler bleibt der State `null` (keine Fehleranzeige, siehe unten).
- Jede `Cell` bekommt beim Rendern optional `windKn = windByIso?.get(cell.iso)`
  und, falls vorhanden, `categorizeWind(windKn, thresholds)`.
- Button-Markup wird von einzeiligem Text ("10:00") auf zweizeilig erweitert:
  Uhrzeit wie bisher, darunter — nur falls Winddaten für diese Stunde
  vorhanden sind — eine kleine Zeile `14kn · Gut` in der zur `tone`
  passenden Textfarbe. Fehlt der Wert (kein Internet, oder Stunde außerhalb
  des 16-Tage-Forecasts), bleibt der Button wie bisher einzeilig — kein
  Platzhalter, kein Ladezustand, der das Layout verschiebt.
- Schwellenwerte werden einmal beim Mounten der Seite per
  `getWindThresholds()` gelesen (kein Live-Update nötig, falls der Admin sie
  während einer offenen Kunden-Session ändert).

### Dashboard — [dashboard/page.tsx](../../../src/app/dashboard/page.tsx)

- Neuer `useEffect`, ruft `fetchCurrentWindKn()` einmal auf; Erfolg → State
  `currentWindKn`, Fehler → State bleibt `null`.
- Neue Karte „Aktuelle Windbedingungen“ (gleicher Karten-Stil wie die
  bestehende Stundenpaket-Karte, `rounded-2xl border border-lf-border
  bg-lf-card`), direkt unter dem Header-Bereich, **nur gerendert, wenn
  `currentWindKn !== null`** — kein leerer/fehlerhafter Platzhalter bei
  fehlendem Internet.
- Inhalt: großer Knoten-Wert + langes Bewertungslabel + Ortsname „Workum,
  IJsselmeer“ als Kontext.

### Admin — [admin/page.tsx](../../../src/app/admin/page.tsx), Tab „wind“

- Kleiner neuer Abschnitt oberhalb der bestehenden Wind-Absage-Presets:
  zwei Zahlenfelder „Ab wie vielen Knoten gut?“ / „Bis wie vielen Knoten
  gut?“, vorbefüllt mit `getWindThresholds()`.
- Speichern-Button ruft `saveWindThresholds({ minGoodKn, maxGoodKn })` auf;
  keine Bestätigung/Toast nötig (bestehendes Muster im Adminbereich ist
  ebenfalls schlicht).

## Fehlerverhalten

Zentrale Vorgabe: Winddaten sind eine optionale Zusatzinfo, nie eine
Voraussetzung für Kernfunktionen (Buchen, Login, Navigation).

- Fetch schlägt fehl (kein Internet, Open-Meteo down) → beide Fetch-Aufrufe
  werfen, Aufrufer fangen ab und lassen den jeweiligen State `null` /
  `undefined` — kein Retry, kein Error-Banner.
- Fehlender Wert für eine bestimmte Stunde (z. B. weit in der Zukunft
  außerhalb der 16-Tage-Vorhersage) wird identisch behandelt wie ein
  genereller Fetch-Fehler: Button bleibt einzeilig ohne Wind-Zeile.
- Kein Blockieren der Buchung: Der bestehende Buchungsablauf
  (`openCell`, `handleConfirm`) bleibt komplett unverändert, Winddaten
  fließen nirgends in die Buchungslogik ein.

## Betroffene Bereiche / Risiken

- Neue externe Abhängigkeit zur Laufzeit (Open-Meteo) — nur für die
  Wind-Anzeige, nicht für App-Start oder Kernfunktionen. Kein neuer NPM-
  Paket nötig (`fetch` ist nativ verfügbar).
- Zusätzliche Zeile in den Zeit-Buttons vergrößert deren Höhe geringfügig
  (7 Tage × 8 Stunden Raster) — visuell zu prüfen, dass das Raster auf
  kleinen Bildschirmen nicht zu gedrängt wirkt.
- `localStorage`-Key `letsfly_wind_thresholds` ist neu und unabhängig von
  den bestehenden Collection-Keys in
  [mock/storage.ts](../../../src/lib/data/mock/storage.ts).

## Testplan

- Manuell im Dev-Server (mit Internet): Buchungsseite öffnen, prüfen dass
  Zeit-Buttons für die aktuelle und kommende Woche eine Knoten-Zeile mit
  passendem Wort/Farbe zeigen; mehrere Wochen vorblättern bis Buttons wieder
  ohne Wind-Zeile erscheinen (außerhalb 16-Tage-Vorhersage).
- Dashboard öffnen, prüfen dass die Windkarte mit aktuellem Wert erscheint.
- Admin → Tab „Wind-Absage“: Schwellenwerte ändern, speichern, Buchungsseite
  neu laden, prüfen dass sich die Bewertungswörter entsprechend verschieben.
- Offline simulieren (DevTools → Network → Offline), Buchungsseite und
  Dashboard neu laden: App bleibt voll nutzbar, Buttons ohne Wind-Zeile,
  keine Windkarte auf dem Dashboard, keine Fehlermeldung sichtbar.
- Bestehender Buchungsablauf (Slot wählen, Waiver, Bestätigen) funktioniert
  unverändert, mit und ohne Winddaten.

# Swipe-Navigation zwischen den Haupt-Tabs

## Kontext

Die App hat 5 Haupt-Tabs, definiert in
[BottomTabBar.tsx](../../../src/components/BottomTabBar.tsx):
`/dashboard → /book (Kalender) → /videos → /requests (Anfrage) → /profile`.
Alle 5 Routen werden von [AppShell.tsx](../../../src/components/AppShell.tsx)
in einen gemeinsamen Shell-Container gerendert, der bereits `pathname` kennt
und die `BottomTabBar` einblendet (`showTabBar`, Prefix-Match).

Auf dem Handy soll man zusätzlich zum Antippen der Tab-Bar auch per
Wisch-Geste (links/rechts) zwischen den Tabs wechseln können — in beide
Richtungen.

## Ziel / Nicht-Ziel

- **Ziel:** Wischen auf den 5 Haupt-Tab-Seiten wechselt zur vorherigen/
  nächsten Seite in obiger Reihenfolge.
- **Nicht-Ziel:** Kein animiertes Mitziehen der Seite mit dem Finger — nur
  Geste erkennen, dann normale Next.js-Navigation (`router.push`). Bewusste
  Entscheidung für den einfacheren Ansatz statt eines animierten Übergangs.
- **Nicht-Ziel:** Kein Wischen auf Unterseiten wie `/videos/[id]`, auch wenn
  dort aktuell (unverändert, bestehendes Verhalten) noch die Tab-Bar
  eingeblendet wird.
- **Nicht-Ziel:** Kein Rundlauf (Wraparound) — Wischen nach links auf
  „Profil" bzw. nach rechts auf „Dashboard" tut nichts.

## Umsetzung

Einzige Änderung in [AppShell.tsx](../../../src/components/AppShell.tsx),
keine neue Datei, keine neue Abhängigkeit (Projekt hat aktuell nur `animejs`,
keine Gesture-Library — für Schwellenwert-basiertes Wischen unnötig):

1. Bestehendes `TAB_BAR_PREFIXES`-Array (Reihenfolge = Tab-Reihenfolge) wird
   weiterhin für `showTabBar` (Prefix-Match, unverändert) genutzt.
2. Neuer exakter Vergleich `TAB_BAR_PREFIXES.includes(pathname)` bestimmt, ob
   Wischen auf der aktuellen Seite aktiv ist (schließt `/videos/[id]` aus, da
   `pathname` dort z.B. `/videos/68` ist, kein exakter Treffer).
3. `onTouchStart` merkt sich Start-`(x, y)` in einem `useRef`.
4. `onTouchEnd` berechnet `deltaX`/`deltaY` zum Startpunkt:
   - Geste zählt nur, wenn `|deltaX| >= 60px` **und** `|deltaX| > |deltaY|`
     (unterscheidet von vertikalem Scrollen).
   - `deltaX < 0` (nach links gewischt) → nächster Tab-Index.
   - `deltaX > 0` (nach rechts gewischt) → vorheriger Tab-Index.
   - Index außerhalb `[0, length-1]` → keine Navigation (kein Wraparound).
   - Sonst: `router.push(TAB_BAR_PREFIXES[neuerIndex])` via bestehendem
     `next/navigation`-Router.
5. Handler werden nur auf dem Content-Wrapper-Div gesetzt, wenn `showTabBar`
   **und** der exakte Pfad-Check zutrifft.

## Betroffene Bereiche / Risiken

- Keine der 5 Tab-Seiten hat aktuell horizontal scrollbare Elemente
  (geprüft: kein `overflow-x-auto`, kein Carousel-Code im Projekt) — daher
  kein Konflikt zwischen Wisch-Navigation und internem horizontalem Scrollen.
- Vertikales Scrollen auf den Seiten bleibt unangetastet, da die Geste nur
  bei überwiegend horizontaler Bewegung auslöst.
- Rein Touch-Events (`onTouchStart`/`onTouchEnd`) — Desktop-Maus-Drag wird
  bewusst nicht unterstützt (Feature ist explizit für Handy gedacht).

## Testplan

- Manuell im Dev-Server auf jeder der 5 Tab-Seiten: Wischen links → nächster
  Tab, wischen rechts → vorheriger Tab.
- Rand-Fälle: Wischen links auf „Profil" (letzter Tab) und rechts auf
  „Dashboard" (erster Tab) → keine Navigation.
- Vertikales Scrollen auf einer der Seiten bleibt unbeeinflusst.
- `/videos/[id]` (Video-Detail): Wischen löst keine Tab-Navigation aus.

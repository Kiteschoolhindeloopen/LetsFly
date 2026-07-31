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
3. `onPointerDown` merkt sich Start-`(x, y)` in einem `useRef`. Pointer Events
   statt Touch Events, damit dieselbe Geste per Finger (Handy) **und** per
   Maus-Drag (Laptop-Trackpad/Maus, da der Kunde ohne Handy lokal testet)
   funktioniert.
4. `onPointerUp` berechnet `deltaX`/`deltaY` zum Startpunkt:
   - Geste zählt nur, wenn `|deltaX| >= 60px` **und** `|deltaX| > |deltaY|`
     (unterscheidet von vertikalem Scrollen).
   - `deltaX < 0` (nach links gewischt) → nächster Tab-Index.
   - `deltaX > 0` (nach rechts gewischt) → vorheriger Tab-Index.
   - Index außerhalb `[0, length-1]` → keine Navigation (kein Wraparound).
   - Sonst: `router.push(TAB_BAR_PREFIXES[neuerIndex])` via bestehendem
     `next/navigation`-Router.
5. Handler werden nur auf dem Content-Wrapper-Div gesetzt, wenn `showTabBar`
   **und** der exakte Pfad-Check zutrifft.
6. Während eines aktiven Drags wird Text-Selektion per `userSelect: "none"`
   (inline Style, nur wenn Swipe aktiv) unterdrückt, damit Maus-Drag nicht
   versehentlich Seiteninhalt markiert.
7. `onPointerDown` ruft zusätzlich `e.preventDefault()` auf. Grund: Ein
   Maus-Drag, der über einem `<img>` startet (z.B. Video-Thumbnails auf
   `/videos`), löst sonst den nativen Browser-Bilder-Drag aus (`dragstart`),
   wodurch `pointerup` nie feuert und die Geste stillschweigend fehlschlägt
   (per Playwright-Test verifiziert). Mit `preventDefault()` auf
   `pointerdown` bleiben Klicks auf Links/Buttons sowie Fokus/Texteingabe in
   Formularfeldern (getestet auf `/requests`) unverändert funktionsfähig.
8. Ghost-Click-Schutz: Beginnt/endet eine erkannte Wisch-Geste auf einem Link
   oder Button (z.B. eine volle Video-Karte auf `/videos`), feuert der
   Browser nach `pointerup` zusätzlich ein normales `click`-Event auf diesem
   Element — ohne Schutz würde ein Wischen auf einer Video-Karte zusätzlich
   in das Video hineinnavigieren (per Playwright-Test reproduziert: Wischen
   nach rechts landete auf `/videos/video-2` statt auf `/book`). Fix: ein
   `justSwiped`-Ref wird bei jeder erkannten Wisch-Geste (auch ohne
   tatsächliche Tab-Navigation an den Rändern) gesetzt; ein
   `onClickCapture`-Handler auf demselben Container unterdrückt das nächste
   `click`-Event einmalig (`preventDefault` + `stopPropagation`), wenn das
   Flag gesetzt ist. Normale Taps/Klicks (ohne vorherige Wisch-Geste) sind
   davon unberührt (verifiziert: Tap auf Video-Karte navigiert weiterhin
   normal, Texteingabe in Formularfeldern auf `/requests` unverändert).

## Betroffene Bereiche / Risiken

- Keine der 5 Tab-Seiten hat aktuell horizontal scrollbare Elemente
  (geprüft: kein `overflow-x-auto`, kein Carousel-Code im Projekt) — daher
  kein Konflikt zwischen Wisch-Navigation und internem horizontalem Scrollen.
- Vertikales Scrollen auf den Seiten bleibt unangetastet, da die Geste nur
  bei überwiegend horizontaler Bewegung auslöst.
- Pointer Events (`onPointerDown`/`onPointerUp`) statt reiner Touch-Events:
  deckt Maus-Drag (Laptop-Test ohne Handy, siehe `AGENTS.md`) und
  Touch (echtes Handy) mit derselben Logik ab.

## Testplan

- Manuell im Dev-Server (Browser, Maus-Drag) auf jeder der 5 Tab-Seiten:
  Ziehen nach links → nächster Tab, Ziehen nach rechts → vorheriger Tab.
- Rand-Fälle: Ziehen nach links auf „Profil" (letzter Tab) und nach rechts
  auf „Dashboard" (erster Tab) → keine Navigation.
- Vertikales Scrollen auf einer der Seiten bleibt unbeeinflusst.
- Normale Klicks (z.B. auf Buttons/Links) lösen keine ungewollte Navigation
  aus (Delta bleibt unter der Schwelle).
- `/videos/[id]` (Video-Detail): Ziehen löst keine Tab-Navigation aus.

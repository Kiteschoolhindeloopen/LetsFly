# Onboarding-Feinschliff: Foto-Storytelling + Value-Prop-Screen

## Kontext

`/onboarding` ist ein 3-Schritte-Wizard (`welcome → choices → done`), siehe
[2026-07-30-onboarding-wizard-design.md](2026-07-30-onboarding-wizard-design.md).
Dieser Spec baut darauf auf: visueller Feinschliff plus ein neuer vierter
Schritt, der kurz erklärt, was man mit LetsFly tun kann (Mehrwert), bevor der
bestehende Abschluss-Screen kommt.

## Ziel

Aus dem 3-Schritte-Wizard wird ein 4-Schritte-Wizard:
`welcome → choices → benefits (neu) → done`, mit einer durchgehenden
Foto-Geschichte statt vier unabhängig wirkenden Screens, und einer
gradient-gefüllten Progress-Bar (Muster aus `dashboard/page.tsx`:
`from-lf-ocean to-lf-sand`) statt der bisherigen flachen weißen Bar.

## Bildkonzept

Der bestehende Welcome-Screen nutzt bereits `https://kiteschoolhindeloopen.com/images/kite1.webp`.
Auf derselben Domain wurden drei weitere, verifiziert erreichbare (HTTP 200)
Fotos identifiziert und werden für die übrigen Schritte verwendet:

- Welcome: `kite1.webp` (unverändert)
- Choices: `kite3.webp` als ~200px hohes Foto-Band oben, Gradient-Scrim
  `from-lf-ocean-dark/90 via-lf-ocean/75 to-lf-ocean/55` (identisch zum
  bestehenden Dashboard-Header-Muster), darunter wie bisher `bg-lf-ocean`
- Benefits (neu): `bg-5.webp` als Foto-Band oben, gleiches Scrim-Muster,
  Headline liegt über dem Foto
- Done: `bg-4.webp` als gedimmtes Vollbild-Hintergrundfoto unter einem
  Navy-Scrim (`from-lf-navy/95 via-lf-navy/90 to-lf-navy/80`) statt flachem
  `bg-lf-navy`

Alle vier Bilder liegen auf derselben bereits im Code vertrauten Domain, kein
neues Hotlinking-Ziel.

## Neuer Screen: Benefits ("Das kannst du mit LetsFly")

Bewusst **ohne Emoji** — der Wunsch nach mehr visueller Stärke wird hier über
Typografie und Bewegung statt über zusätzliche Emoji-Icons gelöst:

- Foto-Band (`bg-5.webp`) mit Headline "Das kannst du mit LetsFly" darüber
- 4 Zeilen im editorialen Listen-Stil: große dünne Nummer (`01`–`04`) in
  Accent-Farbe, Titel + kurzer Subtext, Trennlinie (`border-lf-border`)
  zwischen den Zeilen:
  1. Kurstermine verwalten — deine Buchungen immer im Blick
  2. Stundenkontostand — sieh sofort, was noch übrig ist
  3. Lernvideos — zu jedem Level, jederzeit abrufbar
  4. Automatische Windabsage — bei Flaute sagen wir ab, du buchst einfach neu
- Zeilen erscheinen gestaffelt (fade-up via `animejs animate`, kurze
  Verzögerung pro Zeile), respektiert `prefers-reduced-motion` wie
  `SplitReveal`
- Sticky Bottom-Bar mit „Weiter" → `done`, „Überspringen" → `/dashboard`
  (gleiches Muster wie `choices`)

## Emoji-Balance

Bestehende Emoji-Akzente (🌊 Welcome-Gruß, Kachel-Icons bei Choices, 🪁
Done-Screen) bleiben unverändert. Auf dem neuen Benefits-Screen werden bewusst
**keine** Emoji eingesetzt (explizite Nutzervorgabe) — dort übernehmen
Fotografie, Nummerierung und die gestaffelte Reveal-Animation die visuelle
Wirkung.

## Struktur/Umsetzung

- `Step` erweitert auf `"welcome" | "choices" | "benefits" | "done"`
- `STEP_FRACTION`: `welcome 1/4, choices 2/4, benefits 3/4, done 4/4`
- `ProgressBar`: Fill-Farbe wird `bg-gradient-to-r from-lf-ocean to-lf-sand`
  (vorher `bg-white`); Bar bleibt auf `choices`, `benefits`, `done` sichtbar
  (nicht auf `welcome`, wie bisher)
- Foto-Band-Scrim-Markup wird als kleine lokale Komponente innerhalb von
  `page.tsx` extrahiert (von `choices` und `benefits` genutzt) — keine neue
  Datei, da rein UI-lokal wie die bestehenden Kachel-Typen
- Neue kleine lokale Komponente `FadeInRow` (ähnliches Muster wie
  `SplitReveal`: eigener `useLayoutEffect`, `animejs animate`,
  `prefers-reduced-motion`-Check) für die gestaffelten Benefits-Zeilen
- Keine neuen Dependencies (kein Icon-Package, kein Framer Motion) — alles
  mit bereits vorhandenem `animejs`
- Auswahl-State (`choices`) und Navigation (`Überspringen` → `/dashboard`)
  bleiben unverändert

## Out of Scope

- Persistenz der Auswahl weiterhin nicht gebaut (YAGNI, wie im Ursprungs-Spec)
- Keine Änderungen an den Kachel-Inhalten/-Gruppen von `choices`
- Keine neuen Marken-Farben (nur bestehende `--lf-*`/`--primary`/`--secondary`/`--accent`-Tokens)
- Keine zusätzlichen Emoji über den Bestand hinaus

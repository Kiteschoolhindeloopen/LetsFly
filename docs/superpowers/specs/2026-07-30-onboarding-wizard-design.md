# Onboarding-Wizard nach Login (Kite-Thema)

## Kontext

`/onboarding` existiert bereits als einzelner, sehr einfacher Screen (Hero-Bild + Begrüßung + ein Button zu `/dashboard`), erreichbar direkt nach dem Login auf `/` (`router.push("/onboarding")` in [src/app/page.tsx](../../../src/app/page.tsx)).

Vorlage ist ein mehrstufiger Onboarding-Flow einer Habit-Tracking-App (Screenshots: Welcome → Karten-Carousel mit Steps → Vollbild-Auswahl-Grid → Subscription/Paywall → Health-Permission → Abschluss-Screen → Home). Dieser Flow wird kitesurf-thematisch adaptiert, **ohne** Subscription/Paywall und **ohne** Health-/Standort-Permission-Step (beide explizit ausgenommen).

## Ziel

`/onboarding` wird zu einem 3-Schritte-Wizard mit internem Step-State (keine Unterrouten). Auswahl im Wizard wird nicht persistiert (nur `useState`, verworfen beim Verlassen).

## Ablauf

1. **Welcome** (bestehender Screen, leicht angepasst)
   - Bleibt inhaltlich wie heute: Hero-Bild, „Willkommen bei LetsFly, Lisa! 🌊“, Beschreibungstext.
   - CTA-Button-Text ändert sich von „Los geht's“ zu „Weiter“ und führt zu Step 2 (statt direkt zu `/dashboard`).
   - Kleiner „Überspringen“-Link (Text-Button) darunter/daneben führt direkt zu `/dashboard`.

2. **Erfahrung & Interessen wählen** (neuer Vollbild-Screen, `bg-lf-ocean`)
   - Überschrift z.B. „Was bringst du schon mit?“
   - Gruppierte Kachel-Grids, Mehrfachauswahl (Tap toggelt), kein Schloss-/Upgrade-Badge:
     - **Erfahrung**: Komplett neu · Wasserstart klappt schon · Ich fahre schon sicher · Ich will Tricks lernen
     - **Sicherheit & Wissen**: Material-Check · Wind- & Wetterkunde · Sicherheitstechniken
     - **Fahrtechnik**: Bodydrag · Erste Fahrversuche · Höhe & Kante halten
     - **Tricks & Fortgeschritten**: Wasserstart-Varianten · Sprünge · Unhooked Tricks
     - **Kurse & Ausrüstung**: Gruppen-Camp · Privatstunden · Material mieten · IKO-Zertifikat
   - Kachel-Styling: unselektiert `bg-white/15` (Muster aus `dashboard/page.tsx`), selektiert weiß mit Ocean-Text + Haken-Icon.
   - Sticky Bottom-Bar mit „Weiter“-Button (immer aktiv, keine Pflichtauswahl) → Step 3.
   - „Überspringen“-Link → direkt `/dashboard`.

3. **Los geht's** (Abschluss-Screen, `bg-lf-navy`)
   - Kurzer Motivationstext (z.B. „Bereit für den ersten Wind?“ + 1-2 Sätze).
   - Ein CTA-Button „Los geht's“ → `/dashboard`.

Fortschrittsanzeige: dünner Balken oben auf Step 2 und 3 (wiederverwendet Progress-Bar-Pattern aus `dashboard/page.tsx`: `h-2.5 rounded-full bg-lf-border` + Gradient-Fill `from-lf-ocean to-lf-sand`), zeigt 1/3, 2/3, 3/3.

## Komponenten/Umsetzung

- Alles in `src/app/onboarding/page.tsx` (Client-Component), `step`-State mit `useState<"welcome" | "choices" | "done">("welcome")`.
- Auswahl-State: `Set<string>` oder `string[]` von Kachel-IDs, nur lokal, kein Repository-Zugriff, keine `localStorage`-Persistenz.
- Kachel-Daten als lokales Array von Gruppen-Objekten (`{ title, options: { id, label, icon }[] }`) direkt in der Datei — kein neuer Typ in `src/lib/data/types.ts`, da rein UI-lokal und nicht Teil des Domain-Modells.
- Styling folgt bestehenden Tailwind-Konventionen (`rounded-full`, `rounded-2xl`, `bg-lf-ocean`, `bg-lf-navy`, `bg-white/15`, `text-lf-muted` etc.) — keine neuen Farben/Tokens.
- Keine Animationsbibliothek nötig (kein GSAP/Framer Motion — das ist ein anderes Projekt, siehe Hinweis unten).

## Out of Scope

- Subscription/Paywall-Screens (weggelassen laut Anforderung).
- Health-/Standort-Permission-Step (auf Wunsch entfernt).
- Persistenz der Auswahl (localStorage/Repository) — bewusst nicht gebaut (YAGNI).
- Verknüpfung der Auswahl mit Video-Empfehlungen oder Kursvorschlägen an anderer Stelle der App.
- Änderungen an `src/app/page.tsx` (Login) — Navigation zu `/onboarding` bleibt wie sie ist.

## Hinweis

Das global geladene `~/Downloads/CLAUDE.md` (ShiftSync/GSAP/Lenis-Designsystem) gehört zu einem anderen Projekt in einem übergeordneten Ordner und ist für diese Kiteschule-App nicht relevant — es gelten die Farb- und Backend-Regeln aus dem projekteigenen `AGENTS.md`.

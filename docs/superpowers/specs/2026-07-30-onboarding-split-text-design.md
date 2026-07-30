# Split-Text-Entrance-Animation im Onboarding

## Kontext

`/onboarding` (siehe [2026-07-30-onboarding-wizard-design.md](2026-07-30-onboarding-wizard-design.md)) hat 3 Steps (Welcome, Choices, Done), jeweils mit einer h1-Überschrift und einem Beschreibungs-Absatz. Diese Texte sollen beim Erscheinen jedes Steps mit einer Split-Text-Animation (anime.js `splitText`) reinfahren, angelehnt an das vom Nutzer gegebene Beispiel (Wörter + Buchstaben gestaffelt).

## Ziel

Überschrift und Beschreibungstext auf allen 3 Onboarding-Steps animieren beim Mounten des jeweiligen Steps einmalig ein (kein Loop). Gruppentitel und Kachel-Labels im Choices-Step bleiben unverändert/statisch.

## Umsetzung

- **Neue Komponente** `src/components/SplitReveal.tsx` (Client Component):
  - Props: `as` (`"h1" | "p"`), `children` (string), `className`, optional `delay` (ms).
  - `useEffect` bei Mount: bricht ab bei `prefers-reduced-motion: reduce` (Text bleibt normal sichtbar).
  - Sonst: `splitText(el, { words: { wrap: "clip" }, chars: true })`, dann `createTimeline` mit `.add(words, {...}, stagger(...))` gefolgt von `.add(chars, {...}, stagger(...))`, kein `loop`.
  - Cleanup: `splitter.revert()` beim Unmount.
- **Einsatz** in `src/app/onboarding/page.tsx`: h1/p in allen 3 Step-Branches durch `<SplitReveal as="h1">`/`<SplitReveal as="p">` ersetzen, bestehende Tailwind-Klassen über `className` übergeben.
- **Dependency**: `animejs` war unversioniert in `node_modules` vorhanden (Waisen-Install) und wurde sauber per `npm install animejs` in `package.json`/`package-lock.json` aufgenommen.

## Out of Scope

- Kachel-Labels und Gruppentitel im Choices-Step (bleiben statisch).
- Scroll-getriggerte Animation (Onboarding ist kein Scroll-Layout, Steps wechseln per State).
- Loop-Verhalten wie im rohen Beispielcode (bewusst einmalig statt endlos, laut Nutzerentscheidung).

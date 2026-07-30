# Onboarding-Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/onboarding` wird zu einem 3-Schritte-Wizard (Welcome → Erfahrung/Interessen wählen → Los geht's), kitesurf-thematisch, ohne Subscription/Paywall und ohne Health-/Standort-Step.

**Architecture:** Ein einziger Client-Component-State-Machine-Screen in `src/app/onboarding/page.tsx` mit `useState<"welcome" | "choices" | "done">`. Kein neuer Typ in `src/lib/data/types.ts`, keine Persistenz, kein Repository-Zugriff — reine UI, lokal verworfener State.

**Tech Stack:** Next.js App Router (Client Component), React `useState`, Tailwind CSS (bestehende Utility-Klassen und CSS-Variablen des Projekts). Kein neues npm-Package.

## Global Constraints

- Keine Subscription-/Paywall-Screens (siehe Spec, Out of Scope).
- Kein Health-/Standort-Permission-Step (auf Wunsch entfernt).
- Keine Persistenz der Auswahl (kein `localStorage`, kein Repository-Call) — reiner `useState`.
- Keine neuen Farben/Tokens — nur `bg-lf-ocean`, `bg-lf-navy`, `bg-white/…`, `text-lf-muted`, `text-foreground` etc. aus `src/app/globals.css`.
- Keine neue Animationsbibliothek (kein GSAP/Framer Motion — das ShiftSync-`CLAUDE.md` gehört zu einem anderen Projekt und gilt hier nicht).
- `src/app/page.tsx` (Login) bleibt unverändert — Navigation zu `/onboarding` nach Login bleibt wie sie ist.
- Projekt hat keinen Test-Runner (kein Jest/Vitest/Playwright in `package.json`). Verifikation je Task erfolgt über `npm run lint`, `npx tsc --noEmit` und manuellen/Playwright-gestützten Klick-Durchlauf im Dev-Server (`npm run dev`), nicht über automatisierte Unit-Tests.

---

### Task 1: State-Machine-Grundgerüst + Welcome-Step + Progress-Bar

**Files:**
- Modify: `src/app/onboarding/page.tsx` (komplett ersetzen)

**Interfaces:**
- Produces: `type Step = "welcome" | "choices" | "done"`, Komponente `ProgressBar({ step }: { step: Step })`, `STEP_FRACTION: Record<Step, number>` — werden in Task 2 und 3 wiederverwendet/erweitert.
- Consumes: nichts (erster Task).

- [ ] **Step 1: Datei komplett ersetzen**

Ersetze den gesamten Inhalt von `src/app/onboarding/page.tsx` durch:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Step = "welcome" | "choices" | "done";

const STEP_FRACTION: Record<Step, number> = {
  welcome: 1 / 3,
  choices: 2 / 3,
  done: 1,
};

function ProgressBar({ step }: { step: Step }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
      <div
        className="h-full rounded-full bg-white transition-all duration-300"
        style={{ width: `${STEP_FRACTION[step] * 100}%` }}
      />
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");

  if (step === "welcome") {
    return (
      <div className="flex flex-1 flex-col">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://kiteschoolhindeloopen.com/images/kite1.webp"
          alt="Kitesurfer im Wassersprung, IJsselmeer"
          className="h-[340px] w-full object-cover"
        />
        <div className="flex flex-1 flex-col justify-between p-8">
          <div>
            <h1 className="mb-2.5 text-2xl font-extrabold text-foreground">
              Willkommen bei LetsFly, Lisa! 🌊
            </h1>
            <p className="text-sm leading-relaxed text-lf-muted">
              Hier verwaltest du deine gebuchten Kurstermine, siehst deinen Stundenkontostand und
              schaust dir Lernvideos zu jedem Level an. Bei schlechtem Wind sagen wir automatisch ab
              und du buchst einfach neu.
            </p>
          </div>
          <div>
            <button
              onClick={() => setStep("choices")}
              className="w-full rounded-xl bg-lf-ocean py-4 text-sm font-bold text-white"
            >
              Weiter
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-3 w-full py-2 text-center text-xs font-semibold text-lf-muted"
            >
              Überspringen
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "choices") {
    return (
      <div className="flex flex-1 flex-col bg-lf-ocean p-6">
        <ProgressBar step={step} />
        <p className="mt-6 text-white">Schritt 2 folgt in Task 2</p>
        <button
          onClick={() => setStep("done")}
          className="mt-auto w-full rounded-xl bg-white py-4 text-sm font-bold text-lf-ocean"
        >
          Weiter
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-lf-navy p-6">
      <ProgressBar step={step} />
      <p className="mt-6 text-white">Schritt 3 folgt in Task 3</p>
      <button
        onClick={() => router.push("/dashboard")}
        className="mt-auto w-full rounded-xl bg-white py-4 text-sm font-bold text-lf-navy"
      >
        Los geht&apos;s
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Lint & Typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: Beide Befehle laufen ohne Fehler durch.

- [ ] **Step 3: Manueller Klick-Durchlauf (Skelett)**

Run: `npm run dev` (Terminal offen lassen)

Im Browser (oder via webapp-testing-Skill/Playwright):
1. Öffne `/onboarding` → Hero-Bild + „Willkommen bei LetsFly, Lisa! 🌊“ + Button „Weiter“ + Link „Überspringen“ sichtbar.
2. Klick „Überspringen“ → landet auf `/dashboard`. Zurück zu `/onboarding` navigieren.
3. Klick „Weiter“ → blauer Screen mit Progress-Bar bei ~66% und Platzhaltertext „Schritt 2 folgt in Task 2“.
4. Klick „Weiter“ → dunkler Screen mit Progress-Bar bei 100% und Platzhaltertext „Schritt 3 folgt in Task 3“.
5. Klick „Los geht's“ → landet auf `/dashboard`.

Expected: Alle 5 Punkte treffen zu, keine Konsolenfehler im Browser.

- [ ] **Step 4: Commit** (nur falls Git-Repo vorhanden; dieses Projekt hat aktuell keins — Schritt überspringen und stattdessen kurz bestätigen, dass die Datei gespeichert ist)

---

### Task 2: "choices"-Screen — Kachel-Auswahl mit Gruppen

**Files:**
- Modify: `src/app/onboarding/page.tsx` (Platzhalter-Block aus Task 1 ersetzen)

**Interfaces:**
- Consumes: `Step`, `ProgressBar` aus Task 1.
- Produces: `TILE_GROUPS: TileGroup[]`, State `selected: Set<string>`, Funktion `toggle(id: string): void` — werden von Task 2 selbst verwendet, keine Abhängigkeit für Task 3.

- [ ] **Step 1: Imports und Typen/Daten ergänzen**

Füge direkt unter `type Step = ...` (vor `const STEP_FRACTION`) ein:

```tsx
interface TileOption {
  id: string;
  label: string;
  icon: string;
}

interface TileGroup {
  title: string;
  options: TileOption[];
}

const TILE_GROUPS: TileGroup[] = [
  {
    title: "Erfahrung",
    options: [
      { id: "neu", label: "Komplett neu", icon: "🌊" },
      { id: "wasserstart", label: "Wasserstart klappt schon", icon: "💦" },
      { id: "faehrt-sicher", label: "Ich fahre schon sicher", icon: "🏄" },
      { id: "tricks-lernen", label: "Ich will Tricks lernen", icon: "🔥" },
    ],
  },
  {
    title: "Sicherheit & Wissen",
    options: [
      { id: "material-check", label: "Material-Check", icon: "🪁" },
      { id: "wind-wetter", label: "Wind- & Wetterkunde", icon: "🌬️" },
      { id: "sicherheitstechniken", label: "Sicherheitstechniken", icon: "🛟" },
    ],
  },
  {
    title: "Fahrtechnik",
    options: [
      { id: "bodydrag", label: "Bodydrag", icon: "🏊" },
      { id: "erste-fahrversuche", label: "Erste Fahrversuche", icon: "🚀" },
      { id: "hoehe-kante", label: "Höhe & Kante halten", icon: "📐" },
    ],
  },
  {
    title: "Tricks & Fortgeschritten",
    options: [
      { id: "wasserstart-varianten", label: "Wasserstart-Varianten", icon: "🔄" },
      { id: "spruenge", label: "Sprünge", icon: "🦘" },
      { id: "unhooked", label: "Unhooked Tricks", icon: "🎯" },
    ],
  },
  {
    title: "Kurse & Ausrüstung",
    options: [
      { id: "gruppen-camp", label: "Gruppen-Camp", icon: "👥" },
      { id: "privatstunden", label: "Privatstunden", icon: "🧑‍🏫" },
      { id: "material-mieten", label: "Material mieten", icon: "🎒" },
      { id: "iko-zertifikat", label: "IKO-Zertifikat", icon: "📜" },
    ],
  },
];
```

- [ ] **Step 2: State und Toggle-Funktion ergänzen**

In `OnboardingPage`, direkt nach `const [step, setStep] = useState<Step>("welcome");` einfügen:

```tsx
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
```

- [ ] **Step 3: Platzhalter-Block durch vollen Screen ersetzen**

Ersetze den kompletten `if (step === "choices") { ... }`-Block aus Task 1 durch:

```tsx
  if (step === "choices") {
    return (
      <div className="flex flex-1 flex-col bg-lf-ocean">
        <div className="px-6 pt-6">
          <ProgressBar step={step} />
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-4 pt-6">
          <h1 className="mb-1.5 text-2xl font-extrabold text-white">Was bringst du schon mit?</h1>
          <p className="mb-6 text-sm text-white/70">
            Wähl aus, was zu dir passt — hilft uns, dir die richtigen Kurse und Videos zu zeigen.
          </p>
          {TILE_GROUPS.map((group) => (
            <div key={group.title} className="mb-6">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/60">
                {group.title}
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {group.options.map((option) => {
                  const isSelected = selected.has(option.id);
                  return (
                    <button
                      key={option.id}
                      onClick={() => toggle(option.id)}
                      className={
                        isSelected
                          ? "flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl bg-white p-2 text-center text-xs font-semibold text-lf-ocean shadow"
                          : "flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl bg-white/15 p-2 text-center text-xs font-semibold text-white"
                      }
                    >
                      <span className="text-xl">{option.icon}</span>
                      <span className="leading-tight">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 p-6 pb-8">
          <button
            onClick={() => setStep("done")}
            className="w-full rounded-xl bg-white py-4 text-sm font-bold text-lf-ocean"
          >
            Weiter
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-3 w-full py-1 text-center text-xs font-semibold text-white/70"
          >
            Überspringen
          </button>
        </div>
      </div>
    );
  }
```

- [ ] **Step 4: Lint & Typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: Beide Befehle laufen ohne Fehler durch.

- [ ] **Step 5: Manueller Klick-Durchlauf**

Mit laufendem `npm run dev`:
1. `/onboarding` → „Weiter“ klicken.
2. Prüfen: 5 Gruppen-Überschriften sichtbar (Erfahrung, Sicherheit & Wissen, Fahrtechnik, Tricks & Fortgeschritten, Kurse & Ausrüstung), je Gruppe die erwarteten Kacheln.
3. Mehrere Kacheln aus unterschiedlichen Gruppen anklicken → Kachel wechselt von `bg-white/15`+weißer Text zu weißem Hintergrund+Ocean-Text. Erneut klicken → wechselt zurück (Toggle funktioniert).
4. „Überspringen“ klicken → landet auf `/dashboard`.
5. Zurück, erneut bis Auswahl-Screen navigieren, „Weiter“ klicken → Platzhalter-Screen „Schritt 3 folgt in Task 3“ erscheint.

Expected: Alle Punkte treffen zu, keine Konsolenfehler.

- [ ] **Step 6: Speichern bestätigen** (kein Git-Repo vorhanden — kein Commit-Schritt)

---

### Task 3: "done"-Screen — Abschluss

**Files:**
- Modify: `src/app/onboarding/page.tsx` (Platzhalter-Block aus Task 1 ersetzen)

**Interfaces:**
- Consumes: `Step`, `ProgressBar` aus Task 1.
- Produces: nichts, das von weiteren Tasks gebraucht wird (letzter inhaltlicher Task).

- [ ] **Step 1: Platzhalter-Block durch finalen Screen ersetzen**

Ersetze den `return ( <div className="flex flex-1 flex-col bg-lf-navy p-6"> ... )` Rückgabeblock (das `done`-Fallback am Dateiende) durch:

```tsx
  return (
    <div className="flex flex-1 flex-col justify-between bg-lf-navy p-8">
      <div className="pt-2">
        <ProgressBar step={step} />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <span className="mb-4 text-5xl">🪁</span>
        <h1 className="mb-2.5 text-2xl font-extrabold text-white">Bereit für den ersten Wind?</h1>
        <p className="max-w-xs text-sm leading-relaxed text-white/70">
          Dein Dashboard zeigt dir freie Termine, deinen Stundenkontostand und alle Lernvideos zu
          deinem Level.
        </p>
      </div>
      <button
        onClick={() => router.push("/dashboard")}
        className="w-full rounded-xl bg-white py-4 text-sm font-bold text-lf-navy"
      >
        Los geht&apos;s
      </button>
    </div>
  );
```

- [ ] **Step 2: Lint & Typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: Beide Befehle laufen ohne Fehler durch.

- [ ] **Step 3: Manueller Klick-Durchlauf**

Mit laufendem `npm run dev`:
1. `/onboarding` → „Weiter“ → Kacheln auswählen → „Weiter“.
2. Prüfen: dunkler Screen, Progress-Bar bei 100%, 🪁-Emoji, Überschrift „Bereit für den ersten Wind?“, Beschreibungstext, Button „Los geht's“.
3. Klick „Los geht's“ → landet auf `/dashboard`.

Expected: Alle Punkte treffen zu.

- [ ] **Step 4: Speichern bestätigen** (kein Git-Repo vorhanden — kein Commit-Schritt)

---

### Task 4: End-to-End-Verifikation des gesamten Flows

**Files:**
- Keine Code-Änderungen — reine Verifikation.

**Interfaces:**
- Consumes: den fertigen `src/app/onboarding/page.tsx` aus Task 1–3.

- [ ] **Step 1: Lint & Typecheck final**

Run: `npm run lint && npx tsc --noEmit`
Expected: Beide ohne Fehler.

- [ ] **Step 2: Kompletter Klick-Durchlauf ab Login**

Mit `npm run dev` laufend, im Browser (oder via webapp-testing-Skill/Playwright, inkl. Screenshots je Screen):
1. `/` öffnen, beliebige E-Mail eintragen, „Anmelden“ klicken → landet auf `/onboarding` (Welcome-Screen).
2. „Weiter“ → Auswahl-Screen, 2–3 Kacheln aus unterschiedlichen Gruppen antippen, „Weiter“.
3. Abschluss-Screen erscheint, „Los geht's“ → landet auf `/dashboard`, Dashboard lädt normal (Buchungen/Stundenkontostand sichtbar wie zuvor, keine Regression).
4. Erneut `/onboarding` direkt aufrufen, diesmal auf dem Welcome-Screen „Überspringen“ klicken → landet direkt auf `/dashboard`.
5. Erneut `/onboarding` aufrufen, „Weiter“ zum Auswahl-Screen, dort „Überspringen“ klicken → landet direkt auf `/dashboard`.

Expected: Alle 5 Punkte funktionieren, keine Browser-Konsolenfehler, keine visuellen Überlappungen/abgeschnittenen Texte auf 375–480px Breite (mobile Viewport, passend zum `max-w-[480px]`-AppShell-Rahmen).

- [ ] **Step 3: Abschluss**

Kurze Zusammenfassung an den Nutzer: Onboarding-Wizard fertig, welche 3 Screens es gibt, dass nichts persistiert wird, und dass Subscription/Health-Step bewusst fehlen.

---

## Self-Review Notes

- **Spec coverage:** Welcome-Anpassung (Task 1), Auswahl-Grid mit 5 Gruppen (Task 2), Abschluss-Screen (Task 3), Progress-Bar (Task 1, genutzt in 2+3), kein Health-Step/keine Paywall (nirgends gebaut ✓), keine Persistenz (kein `localStorage`/Repository-Code in keinem Task ✓) — alle Spec-Punkte abgedeckt.
- **Placeholder-Scan:** Task 1 enthält bewusste Platzhalter-Texte ("Schritt 2 folgt in Task 2" / "Schritt 3 folgt in Task 3") — das sind Zwischenzustände des Skelett-Ansatzes, keine unvollständigen Plan-Anweisungen; sie werden in Task 2/3 vollständig ersetzt (Code dafür ist bereits vollständig ausgeschrieben).
- **Typkonsistenz:** `Step`, `ProgressBar`, `STEP_FRACTION`, `TileOption`, `TileGroup`, `TILE_GROUPS`, `selected`, `toggle` werden überall konsistent benannt und in den Tasks, die sie einführen, exakt so verwendet wie in späteren Tasks referenziert.

"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { animate } from "animejs";
import { SplitReveal } from "@/components/SplitReveal";

type Step = "welcome" | "choices" | "benefits" | "done";

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

const BENEFITS = [
  {
    title: "Kurstermine verwalten",
    text: "Deine Buchungen immer im Blick",
  },
  {
    title: "Stundenkontostand",
    text: "Sieh sofort, was noch übrig ist",
  },
  {
    title: "Lernvideos",
    text: "Zu jedem Level, jederzeit abrufbar",
  },
  {
    title: "Automatische Windabsage",
    text: "Bei Flaute sagen wir ab, du buchst einfach neu",
  },
];

const STEP_FRACTION: Record<Step, number> = {
  welcome: 1 / 4,
  choices: 2 / 4,
  benefits: 3 / 4,
  done: 1,
};

function ProgressBar({ step }: { step: Step }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
      <div
        className="h-full rounded-full bg-gradient-to-r from-lf-ocean to-lf-sand transition-all duration-300"
        style={{ width: `${STEP_FRACTION[step] * 100}%` }}
      />
    </div>
  );
}

function PhotoBand({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative h-[200px] w-full shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-lf-ocean-dark/90 via-lf-ocean/75 to-lf-ocean/55" />
    </div>
  );
}

function FadeInRow({ children, index }: { children: React.ReactNode; index: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    animate(el, {
      opacity: [0, 1],
      translateY: [16, 0],
      duration: 400,
      delay: index * 90,
      ease: "outCubic",
    });
  }, [index]);

  return <div ref={ref}>{children}</div>;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
            <SplitReveal as="h1" className="mb-2.5 text-2xl font-extrabold text-foreground">
              Willkommen bei LetsFly, Lisa! 🌊
            </SplitReveal>
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
      <div className="flex flex-1 flex-col bg-lf-ocean">
        <PhotoBand src="https://kiteschoolhindeloopen.com/images/kite3.webp" alt="Kitesurfer in Aktion" />
        <div className="px-6 pt-6">
          <ProgressBar step={step} />
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-4 pt-6">
          <SplitReveal key={step} as="h1" className="mb-1.5 text-2xl font-extrabold text-white">
            Was bringst du schon mit?
          </SplitReveal>
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
                      aria-pressed={isSelected}
                      className={
                        isSelected
                          ? "relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl bg-white p-2 text-center text-xs font-semibold text-lf-ocean shadow"
                          : "relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl bg-white/15 p-2 text-center text-xs font-semibold text-white"
                      }
                    >
                      {isSelected && (
                        <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-lf-ocean text-[10px] text-white">
                          ✓
                        </span>
                      )}
                      <span className="text-xl">{option.icon}</span>
                      <span className="leading-tight">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="sticky bottom-0 border-t border-white/10 bg-lf-ocean p-6 pb-8">
          <button
            onClick={() => setStep("benefits")}
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

  if (step === "benefits") {
    return (
      <div className="flex flex-1 flex-col bg-lf-ocean">
        <PhotoBand src="https://kiteschoolhindeloopen.com/images/bg-5.webp" alt="Kitesurf-Kurs am IJsselmeer" />
        <div className="px-6 pt-6">
          <ProgressBar step={step} />
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-4 pt-6">
          <SplitReveal key={step} as="h1" className="mb-1.5 text-2xl font-extrabold text-white">
            Das kannst du mit LetsFly
          </SplitReveal>
          <p className="mb-6 text-sm text-white/70">
            Deine App für alles rund um deine Kite-Kurse.
          </p>
          <div className="divide-y divide-white/15 border-y border-white/15">
            {BENEFITS.map((benefit, index) => (
              <FadeInRow key={benefit.title} index={index}>
                <div className="flex items-baseline gap-4 py-5">
                  <span className="text-2xl font-extrabold leading-none text-lf-sand">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-white">{benefit.title}</p>
                    <p className="mt-0.5 text-sm text-white/70">{benefit.text}</p>
                  </div>
                </div>
              </FadeInRow>
            ))}
          </div>
        </div>
        <div className="sticky bottom-0 border-t border-white/10 bg-lf-ocean p-6 pb-8">
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

  return (
    <div className="relative flex flex-1 flex-col justify-between overflow-hidden p-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://kiteschoolhindeloopen.com/images/bg-4.webp"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-lf-navy/95 via-lf-navy/90 to-lf-navy/80" />
      <div className="relative pt-2">
        <ProgressBar step={step} />
      </div>
      <div className="relative flex flex-1 flex-col items-center justify-center text-center">
        <span className="mb-4 text-5xl">🪁</span>
        <SplitReveal as="h1" className="mb-2.5 text-2xl font-extrabold text-white">
          Bereit für den ersten Wind?
        </SplitReveal>
        <p className="max-w-xs text-sm leading-relaxed text-white/70">
          Dein Dashboard zeigt dir freie Termine, deinen Stundenkontostand und alle Lernvideos zu
          deinem Level.
        </p>
      </div>
      <button
        onClick={() => router.push("/dashboard")}
        className="relative w-full rounded-xl bg-white py-4 text-sm font-bold text-lf-navy"
      >
        Los geht&apos;s
      </button>
    </div>
  );
}

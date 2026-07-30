"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Step = "welcome" | "choices" | "done";

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

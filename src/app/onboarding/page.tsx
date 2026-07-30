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

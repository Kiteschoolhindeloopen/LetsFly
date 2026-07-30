"use client";

import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();

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
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-6 w-full rounded-xl bg-lf-ocean py-4 text-sm font-bold text-white"
        >
          Los geht&apos;s
        </button>
      </div>
    </div>
  );
}

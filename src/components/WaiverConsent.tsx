"use client";

import { useState } from "react";

// Platzhaltertext für den Prototyp — vor echtem Einsatz von einem Anwalt
// prüfen und an die tatsächlichen Teilnahmebedingungen der Schule anpassen.
const WAIVER_TEXT = `Kitesurfen ist ein Sport mit erhöhtem Verletzungsrisiko durch Wind, Wellen, Strömung und Ausrüstung. Mit der Teilnahme bestätige ich, dass ich körperlich in der Lage bin, an dem gebuchten Kurs teilzunehmen, den Anweisungen der Lehrkräfte Folge leiste und die bereitgestellte Sicherheitsausrüstung bestimmungsgemäß nutze. Die Kiteschule haftet nicht für Schäden, die durch eigenes Fehlverhalten, Nichtbeachtung von Anweisungen oder höhere Gewalt (z.B. Wetterumschwung) entstehen. Eine ausreichende Kranken- bzw. Unfallversicherung liegt in meiner eigenen Verantwortung.`;

interface WaiverConsentProps {
  accepted: boolean;
  onChange: (accepted: boolean) => void;
}

export function WaiverConsent({ accepted, onChange }: WaiverConsentProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-4 rounded-xl border border-lf-border bg-lf-ocean-light p-3.5">
      <label className="flex items-start gap-2.5 text-xs font-medium text-lf-ocean">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 shrink-0"
        />
        Ich akzeptiere die Teilnahmebedingungen und den Haftungsausschluss.
      </label>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-1.5 text-[11px] font-semibold text-lf-ocean underline"
      >
        {expanded ? "Text ausblenden" : "Text anzeigen"}
      </button>
      {expanded && <p className="mt-2 text-[11px] leading-relaxed text-lf-muted">{WAIVER_TEXT}</p>}
    </div>
  );
}

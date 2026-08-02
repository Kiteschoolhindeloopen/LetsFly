"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getCurrentProfile } from "@/lib/auth/session";
import { ROLE_ROUTES } from "@/lib/auth/roleRoutes";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError("E-Mail oder Passwort falsch.");
      setSubmitting(false);
      return;
    }

    const profile = await getCurrentProfile();
    setSubmitting(false);
    if (!profile) {
      setError("Kein Profil für diesen Account gefunden. Bitte an die Schule wenden.");
      return;
    }
    router.push(ROLE_ROUTES[profile.role]);
  }

  return (
    <div className="flex flex-1 flex-col bg-gradient-to-b from-lf-ocean-light to-lf-card">
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <div className="mb-6 flex h-32 w-32 items-center justify-center overflow-hidden rounded-3xl bg-white shadow-lg shadow-lf-ocean/25">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/red-waves.png"
            alt="LetsFly Logo"
            className="h-[78%] w-[78%] object-contain"
          />
        </div>
        <h1 className="text-[28px] font-extrabold tracking-tight text-foreground">LetsFly Kiteschule</h1>
        <p className="mt-1.5 text-sm text-lf-muted">Kitesurfen lernen am IJsselmeer</p>
      </div>

      <div className="px-8 pb-12">
        <form onSubmit={handleLogin}>
          <label className="mb-1.5 block text-xs font-semibold text-foreground">E-Mail-Adresse</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="lisa.meyer@email.de"
            type="email"
            className="mb-3.5 w-full rounded-xl border border-lf-border bg-background px-4 py-3.5 text-sm outline-none"
          />
          <label className="mb-1.5 block text-xs font-semibold text-foreground">Passwort</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            type="password"
            className="mb-3.5 w-full rounded-xl border border-lf-border bg-background px-4 py-3.5 text-sm outline-none"
          />
          {error && <p className="mb-3.5 text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-lf-ocean py-3.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {submitting ? "Anmelden…" : "Anmelden"}
          </button>
        </form>
        <p className="mt-4.5 text-center text-xs text-lf-muted">
          Noch kein Konto? Wende dich an die Kiteschule.
        </p>
      </div>
    </div>
  );
}

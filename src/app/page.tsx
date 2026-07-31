"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getRepository } from "@/lib/data/repository";
import { setLoggedInUser } from "@/lib/demoSession";

const ROLE_ROUTES = {
  CUSTOMER: "/dashboard",
  INSTRUCTOR: "/instructor",
  ADMIN: "/admin",
} as const;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const user = await getRepository().getUserByEmail(email);
    if (!user) {
      // Unbekannte E-Mail: noch kein Konto -> Registrierung.
      router.push("/onboarding");
      return;
    }
    setLoggedInUser(user);
    router.push(ROLE_ROUTES[user.role]);
  }

  return (
    <div className="flex flex-1 flex-col justify-center bg-gradient-to-b from-lf-ocean-light to-lf-card px-8 py-12">
      <div className="mb-6 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-lf-ocean">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://kiteschoolhindeloopen.com/images/logo.webp"
          alt="LetsFly Logo"
          className="h-[70%] w-[70%] object-contain"
        />
      </div>
      <h1 className="text-[28px] font-extrabold tracking-tight text-foreground">LetsFly Kiteschule</h1>
      <p className="mb-9 mt-1.5 text-sm text-lf-muted">Kitesurfen lernen am IJsselmeer</p>

      <form onSubmit={handleLogin}>
        <label className="mb-1.5 block text-xs font-semibold text-foreground">E-Mail-Adresse</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="lisa.meyer@email.de"
          className="mb-3.5 w-full rounded-xl border border-lf-border bg-background px-4 py-3.5 text-sm outline-none"
        />
        <button type="submit" className="w-full rounded-xl bg-lf-ocean py-3.5 text-sm font-bold text-white">
          Anmelden
        </button>
      </form>
      <p className="mt-4.5 text-center text-xs text-lf-muted">
        Noch kein Konto?{" "}
        <button type="button" onClick={() => router.push("/onboarding")} className="text-lf-ocean">
          Jetzt registrieren
        </button>
      </p>
    </div>
  );
}

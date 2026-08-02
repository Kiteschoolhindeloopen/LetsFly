"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { ROLE_ROUTES } from "@/lib/auth/roleRoutes";
import type { Role, User } from "@/lib/data/repository";

export function AuthGuard({ role, children }: { role: Role; children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null | "loading">("loading");

  useEffect(() => {
    let cancelled = false;
    getCurrentProfile().then((profile) => {
      if (cancelled) return;
      if (!profile) {
        router.replace("/");
        return;
      }
      if (profile.role !== role) {
        router.replace(ROLE_ROUTES[profile.role]);
        return;
      }
      setUser(profile);
    });
    return () => {
      cancelled = true;
    };
  }, [role, router]);

  if (user === "loading" || user === null) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-sm text-lf-muted">
        Lädt…
      </div>
    );
  }

  return <AuthProvider user={user}>{children}</AuthProvider>;
}

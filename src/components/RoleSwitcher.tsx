"use client";

import { usePathname, useRouter } from "next/navigation";

const roles = [
  { key: "kunde", label: "Kunde", href: "/dashboard" },
  { key: "lehrer", label: "Lehrer", href: "/instructor" },
  { key: "admin", label: "Admin", href: "/admin" },
] as const;

export function RoleSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const activeRole = pathname.startsWith("/instructor")
    ? "lehrer"
    : pathname.startsWith("/admin")
      ? "admin"
      : "kunde";

  return (
    <div className="sticky top-0 z-[200] flex w-full items-center justify-center gap-1.5 bg-lf-navy px-3 py-2.5 text-white">
      <span className="mr-1.5 text-[11px] font-bold uppercase tracking-wide opacity-55">
        Prototyp-Ansicht
      </span>
      {roles.map((r) => (
        <button
          key={r.key}
          onClick={() => router.push(r.href)}
          className={
            activeRole === r.key
              ? "rounded-lg bg-lf-sand px-3.5 py-1.5 text-xs font-bold text-amber-950"
              : "rounded-lg bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white"
          }
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

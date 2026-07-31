"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/dashboard", icon: "🏠", label: "Dashboard" },
  { href: "/book", icon: "📅", label: "Kalender" },
  { href: "/videos", icon: "▶", label: "Videos" },
  { href: "/requests", icon: "✉️", label: "Anfrage" },
  { href: "/profile", icon: "👤", label: "Profil" },
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] mx-auto flex w-full max-w-[480px] border-t border-lf-border bg-lf-card px-1 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex flex-1 flex-col items-center gap-0.5 py-1.5"
          >
            <span className={active ? "text-lg" : "text-lg opacity-50 grayscale"}>{tab.icon}</span>
            <span
              className={
                active
                  ? "text-[10.5px] font-bold text-lf-ocean"
                  : "text-[10.5px] font-bold text-lf-muted"
              }
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

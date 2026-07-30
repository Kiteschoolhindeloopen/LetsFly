"use client";

import { usePathname } from "next/navigation";
import { RoleSwitcher } from "./RoleSwitcher";
import { BottomTabBar } from "./BottomTabBar";

const TAB_BAR_PREFIXES = ["/dashboard", "/book", "/videos", "/requests", "/profile"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showTabBar = TAB_BAR_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  return (
    <div className="flex min-h-screen flex-col items-center bg-background">
      <RoleSwitcher />
      <div className="flex min-h-[calc(100vh-41px)] w-full max-w-[480px] flex-1 flex-col bg-lf-card shadow-[0_24px_60px_-20px_rgba(20,30,40,0.25)]">
        <div className="flex flex-1 flex-col">{children}</div>
        {showTabBar && <BottomTabBar />}
      </div>
    </div>
  );
}

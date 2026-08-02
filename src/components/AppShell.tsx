"use client";

import { useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { BottomTabBar } from "./BottomTabBar";

const TAB_BAR_PREFIXES = ["/dashboard", "/book", "/videos", "/requests", "/profile"];
const SWIPE_THRESHOLD_PX = 60;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const showTabBar = TAB_BAR_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const swipeEnabled = TAB_BAR_PREFIXES.includes(pathname);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const justSwiped = useRef(false);

  function handlePointerDown(e: React.PointerEvent) {
    dragStart.current = { x: e.clientX, y: e.clientY };
  }

  function handleDragStart(e: React.DragEvent) {
    e.preventDefault();
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!dragStart.current) return;
    const deltaX = e.clientX - dragStart.current.x;
    const deltaY = e.clientY - dragStart.current.y;
    dragStart.current = null;

    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaX) <= Math.abs(deltaY)) return;

    // A recognized swipe must not also trigger a click on whatever link/button it started over.
    justSwiped.current = true;

    const currentIndex = TAB_BAR_PREFIXES.indexOf(pathname);
    const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0 || nextIndex >= TAB_BAR_PREFIXES.length) return;

    router.push(TAB_BAR_PREFIXES[nextIndex]);
  }

  function handleClickCapture(e: React.MouseEvent) {
    if (!justSwiped.current) return;
    justSwiped.current = false;
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-background">
      <div className="flex min-h-[calc(100vh-41px)] w-full max-w-[480px] flex-1 flex-col bg-lf-card shadow-[0_24px_60px_-20px_rgba(20,30,40,0.25)]">
        <div
          className="flex flex-1 flex-col"
          style={{
            ...(showTabBar ? { paddingBottom: "calc(4.5rem + env(safe-area-inset-bottom))" } : undefined),
            ...(swipeEnabled ? { userSelect: "none" } : undefined),
          }}
          onPointerDown={swipeEnabled ? handlePointerDown : undefined}
          onPointerUp={swipeEnabled ? handlePointerUp : undefined}
          onClickCapture={swipeEnabled ? handleClickCapture : undefined}
          onDragStart={swipeEnabled ? handleDragStart : undefined}
        >
          {children}
        </div>
        {showTabBar && <BottomTabBar />}
      </div>
    </div>
  );
}

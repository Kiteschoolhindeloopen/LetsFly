"use client";

import { useLayoutEffect, useRef } from "react";
import { createTimeline, splitText, stagger } from "animejs";

interface SplitRevealProps {
  as: "h1" | "p";
  children: string;
  className?: string;
  delay?: number;
}

export function SplitReveal({ as: Tag, children, className, delay = 0 }: SplitRevealProps) {
  const ref = useRef<HTMLHeadingElement & HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const splitter = splitText(el, { words: { wrap: "clip" } });
    // Word-level only: animating chars nested inside an already-settled word
    // stacks a second, independent transform on top and reads as the text
    // playing twice. One pass keeps it a single clean slide-in.
    const timeline = createTimeline({
      defaults: { ease: "power3.out", duration: 500 },
    }).add(
      splitter.words,
      { y: ["100%", "0%"], opacity: [0, 1] },
      stagger([0, 300], { start: delay }),
    );

    return () => {
      timeline.revert();
      splitter.revert();
    };
  }, [children, delay]);

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}

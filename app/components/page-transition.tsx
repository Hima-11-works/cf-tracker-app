"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    animationRef.current?.cancel();
    animationRef.current = surface.animate(
      [{ opacity: 0.72, transform: "translateY(4px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: 150, easing: "ease-out" },
    );
    return () => animationRef.current?.cancel();
  }, [pathname]);

  return <div className="page-transition-surface" ref={surfaceRef}>{children}</div>;
}

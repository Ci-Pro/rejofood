"use client";

import { cn } from "@/lib/utils";

/**
 * RejoFood brand mark.
 * - Wordmark uses the Fraunces display font for a distinctive editorial feel.
 * - The saffron dot pulses subtly (`.rejo-dot` in globals.css).
 * - Lockup is responsive: collapses to just the dot + initial on very small screens.
 */
export function BrandLogo({
  className,
  size = "md",
  showWordmark = true,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
}) {
  const dim = size === "sm" ? 28 : size === "lg" ? 56 : 40;
  const dot = size === "sm" ? 6 : size === "lg" ? 12 : 8;

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className="relative flex items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25"
        style={{ width: dim, height: dim }}
      >
        <span className="font-display font-700 leading-none" style={{ fontSize: dim * 0.55 }}>
          R
        </span>
        <span
          className="rejo-dot absolute -right-1 -top-1 rounded-full bg-saffron ring-2 ring-background"
          style={{ width: dot, height: dot }}
          aria-hidden
        />
      </div>
      {showWordmark && (
        <div className="leading-tight">
          <p className="font-display font-700 text-[1.05rem] tracking-tight text-foreground">
            Rejo<span className="text-saffron">Food</span>
          </p>
          <p className="text-[0.625rem] uppercase tracking-[0.18em] text-muted-foreground">
            Pesan · Masak · Antar · Atur
          </p>
        </div>
      )}
    </div>
  );
}

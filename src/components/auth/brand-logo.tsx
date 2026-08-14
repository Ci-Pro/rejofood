"use client";

import { cn } from "@/lib/utils";

/**
 * RejoFood brand mark — v5.0 RejoFood Identity.
 *
 * Logo concept: Circular bowl/plate mark (deep teal) dengan orange dot accent.
 * Wordmark: "RejoFood" deep teal dengan orange dot di huruf 'j'.
 *
 * Color system:
 *  - Deep Teal #003F3F (mark background + wordmark)
 *  - Orange #FF6B22 (dot accent)
 *  - White #FFFFFF (mark icon on teal bg)
 *
 * Variants:
 *  - full: mark + wordmark + tagline
 *  - compact: mark + wordmark (untuk header)
 *  - mark: mark only (untuk inline/app icon)
 */
export function BrandLogo({
  className,
  size = "md",
  variant = "full",
  onLight = false,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "full" | "compact" | "mark";
  onLight?: boolean;
}) {
  const dim = size === "sm" ? 32 : size === "lg" ? 56 : 44;

  if (variant === "mark") {
    return <LogoMark dim={dim} className={className} />;
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <LogoBadge dim={dim} />
        {(size === "md" || size === "lg") && (
          <Wordmark size={size} onLight={onLight} />
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <LogoBadge dim={dim} />
      {size !== "sm" && (
        <div className="leading-tight">
          <Wordmark size={size} onLight={onLight} />
          <p className={cn(
            "text-[0.625rem] uppercase tracking-[0.2em]",
            onLight ? "text-white/60" : "text-muted-foreground",
          )}>
            Pesan · Masak · Antar
          </p>
        </div>
      )}
    </div>
  );
}

function Wordmark({ size, onLight }: { size: "sm" | "md" | "lg"; onLight: boolean }) {
  return (
    <span
      className={cn(
        "font-display font-800 tracking-tight leading-none",
        size === "lg" ? "text-2xl" : size === "md" ? "text-lg" : "text-base",
        onLight ? "text-white" : "text-primary",
      )}
    >
      Rejo
      <span className="relative">
        Food
        {/* Orange dot accent di atas huruf 'o' terakhir */}
        <span
          className="absolute -right-1 -top-0.5 rounded-full bg-accent"
          style={{ width: size === "lg" ? 5 : 4, height: size === "lg" ? 5 : 4 }}
          aria-hidden
        />
      </span>
    </span>
  );
}

/** Logo badge — rounded teal square dengan white mark + orange dot. */
function LogoBadge({ dim }: { dim: number }) {
  return (
    <div
      className="relative flex items-center justify-center rounded-2xl bg-primary shadow-premium"
      style={{ width: dim, height: dim }}
    >
      <LogoMarkInner dim={dim * 0.55} />
      {/* Orange dot accent */}
      <span
        className="absolute -right-0.5 -top-0.5 rounded-full bg-accent ring-2 ring-background"
        style={{ width: dim * 0.2, height: dim * 0.2 }}
        aria-hidden
      />
    </div>
  );
}

/** Standalone mark — for inline use or app icon (no badge background). */
function LogoMark({ dim, className }: { dim: number; className?: string }) {
  return (
    <div
      className={cn("relative flex items-center justify-center rounded-2xl bg-primary shadow-premium", className)}
      style={{ width: dim, height: dim }}
    >
      <LogoMarkInner dim={dim * 0.55} />
      <span
        className="absolute -right-0.5 -top-0.5 rounded-full bg-accent ring-2 ring-background"
        style={{ width: dim * 0.2, height: dim * 0.2 }}
        aria-hidden
      />
    </div>
  );
}

/**
 * Inner mark — bowl/plate icon (white) inside teal badge.
 * Represents: food + delivery (circular motion).
 */
function LogoMarkInner({ dim }: { dim: number }) {
  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
    >
      {/* Bowl/plate circle */}
      <circle
        cx="24"
        cy="24"
        r="16"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray="75 25"
        transform="rotate(-30 24 24)"
      />
      {/* Steam lines (food warmth) */}
      <path
        d="M20 14 Q19 11 21 9 Q23 7 22 4"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M27 14 Q26 11 28 9 Q30 7 29 4"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

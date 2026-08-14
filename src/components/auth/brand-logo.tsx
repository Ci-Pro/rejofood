"use client";

import { cn } from "@/lib/utils";

/**
 * RejoFood brand mark — v2.0 premium.
 *
 * Logo concept: fork (left) + arrow (right, pointing right = delivery direction)
 * + saffron dot (spark of warmth).
 *
 * Variants:
 *  - full: logo + wordmark "RejoFood" + tagline
 *  - compact: logo only (untuk header)
 *  - mark: logo only, no rounded background (untuk inline use)
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
  onLight?: boolean; // render di background terang (header light mode)
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
            onLight ? "text-primary-foreground/60" : "text-muted-foreground",
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
    <p
      className={cn(
        "font-display font-700 tracking-tight leading-none",
        size === "lg" ? "text-2xl" : size === "md" ? "text-lg" : "text-base",
        onLight ? "text-primary-foreground" : "text-foreground",
      )}
    >
      Rejo<span className="text-primary">Food</span>
    </p>
  );
}

/** Logo dengan rounded badge background (untuk header/sidebar). */
function LogoBadge({ dim }: { dim: number }) {
  return (
    <div
      className="relative flex items-center justify-center rounded-2xl bg-primary shadow-premium"
      style={{ width: dim, height: dim }}
    >
      <LogoMark dim={dim * 0.62} />
      {/* Saffron spark dot */}
      <span
        className="rejo-dot absolute -right-0.5 -top-0.5 rounded-full bg-primary ring-2 ring-background"
        style={{ width: dim * 0.18, height: dim * 0.18 }}
        aria-hidden
      />
    </div>
  );
}

/** SVG logo mark only — fork + arrow. */
function LogoMark({ dim, className }: { dim: number; className?: string }) {
  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      aria-hidden
    >
      {/* Fork (left) */}
      <g transform="translate(28 50)">
        {/* Tines */}
        <rect x="-10" y="-32" width="3.5" height="14" rx="1.5" fill="#FBF7F0" />
        <rect x="-1.75" y="-32" width="3.5" height="14" rx="1.5" fill="#FBF7F0" />
        <rect x="6.5" y="-32" width="3.5" height="14" rx="1.5" fill="#FBF7F0" />
        {/* Body */}
        <path d="M -7 -18 Q -7 -12 0 -12 Q 7 -12 7 -18 L 7 -6 Q 7 0 0 0 Q -7 0 -7 -6 Z" fill="#FBF7F0" />
        {/* Handle */}
        <rect x="-2.5" y="0" width="5" height="32" rx="2.5" fill="#FBF7F0" />
      </g>
      {/* Arrow (right) */}
      <g transform="translate(56 50)">
        <defs>
          <linearGradient id="arrow-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFB347" />
            <stop offset="100%" stopColor="#FF9F1C" />
          </linearGradient>
        </defs>
        <rect x="-18" y="-3" width="22" height="6" rx="3" fill="url(#arrow-grad)" />
        <path d="M 4 -10 L 18 0 L 4 10 L 8 0 Z" fill="url(#arrow-grad)" />
      </g>
    </svg>
  );
}

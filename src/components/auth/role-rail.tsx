"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Role, getRoleList, type RoleMeta } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

/**
 * RoleRail — the vertical "role switch" on the auth screen.
 *
 * Why a vertical rail (instead of segmented tabs or a dropdown)?
 *  - It is unusual for a login screen, which matches the user's brief: "layout berbeda".
 *  - It gives each role its own breathing room with icon + label + tagline.
 *  - On mobile it gracefully collapses to a horizontal scrollable strip.
 *
 * SECURITY: `showAdmin` defaults to false. When false, Admin tidak muncul di rail,
 * sehingga pengunjung biasa tidak tahu ada login admin. Admin mengaksesnya via
 * URL `/?admin=1`. Server tetap melakukan verifikasi credentials terpisah.
 */
export function RoleRail({
  selected,
  onChange,
  className,
  showAdmin = false,
}: {
  selected: Role;
  onChange: (r: Role) => void;
  className?: string;
  showAdmin?: boolean;
}) {
  const list = getRoleList(showAdmin);
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="mb-1 hidden items-center gap-2 px-1 md:flex">
        <span className="text-[0.65rem] font-700 uppercase tracking-[0.22em] text-muted-foreground">
          Pilih peran
        </span>
        <span className="h-px flex-1 bg-border" />
        {showAdmin && (
          <span className="rounded-full bg-rose/15 px-2 py-0.5 text-[0.6rem] font-700 uppercase tracking-wider text-rose">
            Mode admin
          </span>
        )}
      </div>

      {/* Mobile: horizontal scroll */}
      <div className="flex gap-2 overflow-x-auto pb-2 md:hidden scroll-slim">
        {list.map((r) => (
          <RoleChip key={r.value} role={r} active={selected === r.value} onClick={() => onChange(r.value)} />
        ))}
      </div>

      {/* Desktop: vertical rail */}
      <div className="hidden md:flex md:flex-col md:gap-2.5">
        {list.map((r, idx) => (
          <RolePanel
            key={r.value}
            role={r}
            active={selected === r.value}
            onClick={() => onChange(r.value)}
            index={idx}
          />
        ))}
      </div>
    </div>
  );
}

function RolePanel({
  role,
  active,
  onClick,
  index,
}: {
  role: RoleMeta;
  active: boolean;
  onClick: () => void;
  index: number;
}) {
  const Icon = role.icon;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.3, ease: "easeOut" }}
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.985 }}
      aria-pressed={active}
      aria-label={`Masuk sebagai ${role.label}`}
      className={cn(
        "accent-" + role.accent,
        "group relative flex w-full items-center gap-3.5 overflow-hidden rounded-2xl border p-3 text-left transition-colors",
        active
          ? "border-role bg-role-soft ring-role"
          : "border-border bg-card hover:border-role",
      )}
    >
      {/* Active indicator bar */}
      <span
        className={cn(
          "absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-role transition-opacity",
          active ? "opacity-100" : "opacity-0",
        )}
        aria-hidden
      />
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all",
          active ? "bg-role text-role-fg" : "bg-muted text-muted-foreground group-hover:bg-role-soft group-hover:text-role",
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-700 text-foreground">{role.label}</span>
        <span className="block truncate text-xs text-muted-foreground">{role.tagline}</span>
      </span>
      <AnimatePresence initial={false}>
        {active && (
          <motion.span
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            className="text-role"
            aria-hidden
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

function RoleChip({
  role,
  active,
  onClick,
}: {
  role: RoleMeta;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = role.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`Masuk sebagai ${role.label}`}
      className={cn(
        "accent-" + role.accent,
        "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-colors",
        active
          ? "border-role bg-role text-role-fg"
          : "border-border bg-card text-foreground",
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={2.2} />
      <span className="font-700">{role.label}</span>
    </button>
  );
}

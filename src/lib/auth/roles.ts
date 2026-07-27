/**
 * Role definitions for RejoFood.
 * Single source of truth for role metadata, icons, route prefixes, and permissions.
 */
import type { LucideIcon } from "lucide-react";
import { UtensilsCrossed, Store, Bike, ShieldCheck } from "lucide-react";

export enum Role {
  CUSTOMER = "CUSTOMER",
  MERCHANT = "MERCHANT",
  DRIVER = "DRIVER",
  ADMIN = "ADMIN",
}

export type RoleValue = `${Role}`;

export interface RoleMeta {
  value: Role;
  /** Short label shown on the role rail / tabs */
  label: string;
  /** Longer description shown under the label */
  tagline: string;
  /** Lucide icon used across the UI */
  icon: LucideIcon;
  /** Accent color (Tailwind class fragment) for this role */
  accent: "saffron" | "lavender" | "mint" | "rose";
  /** Where this role lands after login (client-side view key) */
  home: "customer" | "merchant" | "driver" | "admin";
  /** Test credentials shown on the login screen for quick QA */
  demoEmail: string;
}

export const ROLES: Record<Role, RoleMeta> = {
  [Role.CUSTOMER]: {
    value: Role.CUSTOMER,
    label: "Pelanggan",
    tagline: "Pesan makanan favoritmu",
    icon: UtensilsCrossed,
    accent: "saffron",
    home: "customer",
    demoEmail: "customer@rejofood.id",
  },
  [Role.MERCHANT]: {
    value: Role.MERCHANT,
    label: "Merchant",
    tagline: "Kelola restoran & pesanan",
    icon: Store,
    accent: "lavender",
    home: "merchant",
    demoEmail: "merchant@rejofood.id",
  },
  [Role.DRIVER]: {
    value: Role.DRIVER,
    label: "Driver",
    tagline: "Antar pesanan dengan cepat",
    icon: Bike,
    accent: "mint",
    home: "driver",
    demoEmail: "driver@rejofood.id",
  },
  [Role.ADMIN]: {
    value: Role.ADMIN,
    label: "Admin",
    tagline: "Pantau seluruh ekosistem",
    icon: ShieldCheck,
    accent: "rose",
    home: "admin",
    demoEmail: "admin@rejofood.id",
  },
};

export const ROLE_LIST: RoleMeta[] = [
  ROLES[Role.CUSTOMER],
  ROLES[Role.MERCHANT],
  ROLES[Role.DRIVER],
  ROLES[Role.ADMIN],
];

/** Permission matrix — keep small and explicit for the foundation. */
export const PERMISSIONS: Record<Role, string[]> = {
  [Role.CUSTOMER]: ["order:create", "order:read_own", "profile:edit_own"],
  [Role.MERCHANT]: ["menu:manage_own", "order:read_own_shop", "shop:toggle_open"],
  [Role.DRIVER]: ["delivery:accept", "delivery:update_status", "profile:edit_own"],
  [Role.ADMIN]: ["*"],
};

export function hasPermission(role: Role, permission: string): boolean {
  const perms = PERMISSIONS[role];
  return perms.includes("*") || perms.includes(permission);
}

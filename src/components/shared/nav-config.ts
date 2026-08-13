"use client";

import { motion, AnimatePresence } from "framer-motion";
import { LucideIcon } from "lucide-react";
import {
  UtensilsCrossed, ShoppingBag, Heart, User, Wallet,
  Store, ClipboardList, Bell,
  Package, Bike, CheckCircle2,
  ScrollText, Activity, ShieldCheck,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";

/**
 * Navigation config per role.
 * Setiap item punya: key (unique), icon, label, badge (optional count source).
 * Badge di-fetch via callback dari parent.
 */
interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  badge?: number; // optional count
}

export function getNavItems(role: string, badges?: Record<string, number>): NavItem[] {
  const badgeFor = (key: string) => badges?.[key] ?? 0;

  switch (role) {
    case "CUSTOMER":
      return [
        { key: "restaurants", label: "Beranda", icon: UtensilsCrossed },
        { key: "orders", label: "Pesanan", icon: ShoppingBag },
        { key: "favorites", label: "Favorit", icon: Heart, badge: badgeFor("favorites") },
        { key: "wallet", label: "RejoPay", icon: Wallet },
        { key: "profile", label: "Profil", icon: User },
      ];

    case "MERCHANT":
      return [
        { key: "orders", label: "Pesanan", icon: Bell, badge: badgeFor("orders") },
        { key: "menu", label: "Menu", icon: ClipboardList },
        { key: "wallet", label: "RejoPay", icon: Wallet },
        { key: "profile", label: "Profil", icon: Store },
      ];

    case "DRIVER":
      return [
        { key: "available", label: "Tersedia", icon: Package, badge: badgeFor("available") },
        { key: "active", label: "Aktif", icon: Bike, badge: badgeFor("active") },
        { key: "wallet", label: "RejoPay", icon: Wallet },
        { key: "profile", label: "Profil", icon: User },
      ];

    case "ADMIN":
      return [
        { key: "orders", label: "Pesanan", icon: ScrollText },
        { key: "wallets", label: "Dompet", icon: Wallet },
        { key: "audit", label: "Audit Log", icon: Activity },
        { key: "profile", label: "Profil", icon: ShieldCheck },
      ];

    default:
      return [];
  }
}

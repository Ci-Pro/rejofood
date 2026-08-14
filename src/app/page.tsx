"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldAlert, LogOut } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { CustomerDashboard } from "@/components/customer/customer-dashboard";
import { MerchantDashboard } from "@/components/merchant/merchant-dashboard";
import { DriverDashboard } from "@/components/driver/driver-dashboard";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { useAuthStore } from "@/store/auth-store";
import { Role } from "@/lib/auth/roles";
import { BrandLogo } from "@/components/auth/brand-logo";
import { Button } from "@/components/ui/button";

type View = "loading" | "auth" | "customer" | "merchant" | "driver" | "admin" | "mismatch";

function viewForRole(role: Role): Exclude<View, "loading" | "auth" | "mismatch"> {
  switch (role) {
    case Role.CUSTOMER: return "customer";
    case Role.MERCHANT: return "merchant";
    case Role.DRIVER: return "driver";
    case Role.ADMIN: return "admin";
  }
}

function LoadingScreen({ message = "Memuat RejoFood…", slow = false }: { message?: string; slow?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <BrandLogo size="md" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col items-center gap-2"
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          {message}
        </div>
        {slow && (
          <p className="text-[0.65rem] text-amber-600 dark:text-amber-400">
            Jaringan lambat, mohon tunggu…
          </p>
        )}
      </motion.div>
    </div>
  );
}

/**
 * Mismatch screen — muncul ketika user login dengan role yang tidak sesuai APK.
 * Contoh: APK Customer (NEXT_PUBLIC_APP_ROLE=CUSTOMER) tapi login sebagai admin.
 *
 * Mekanisme:
 *  - APK Customer hanya boleh login sebagai CUSTOMER
 *  - APK Merchant hanya boleh login sebagai MERCHANT
 *  - APK Driver hanya boleh login sebagai DRIVER
 *  - Web (tanpa NEXT_PUBLIC_APP_ROLE) boleh semua role, termasuk ADMIN (via ?admin=1)
 */
function MismatchScreen({ actualRole, expectedRole, onLogout }: {
  actualRole: string;
  expectedRole: string;
  onLogout: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-900/30"
      >
        <ShieldAlert className="h-8 w-8 text-rose-500" />
      </motion.div>
      <div className="text-center">
        <h1 className="font-display text-xl font-700 text-foreground">Role tidak sesuai</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Anda login sebagai <span className="font-700 text-foreground">{actualRole}</span>,
          tapi app ini dikhususkan untuk role <span className="font-700 text-foreground">{expectedRole}</span>.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Silakan keluar dan gunakan akun dengan role yang benar.
        </p>
      </div>
      <Button onClick={onLogout} variant="outline" className="mt-2">
        <LogOut className="mr-1.5 h-4 w-4" /> Keluar
      </Button>
    </div>
  );
}

function HomeInner() {
  const searchParams = useSearchParams();

  // APP_ROLE detection — dari 3 sumber (urutan prioritas):
  // 1. NEXT_PUBLIC_APP_ROLE (env, saat build time — jarang dipakai di APK)
  // 2. ?app=CUSTOMER query param (dari Capacitor server.url di APK)
  // 3. localStorage (persist setelah first load dari APK)
  //
  // Web (browser biasa) → appRole = null → semua role bisa login (admin via ?admin=1)
  // APK Customer → appRole = "CUSTOMER" → hanya customer yang bisa login
  // APK Merchant → appRole = "MERCHANT" → hanya merchant
  // APK Driver → appRole = "DRIVER" → hanya driver
  const appRoleParam = searchParams.get("app");
  const [storedAppRole, setStoredAppRole] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Read dari localStorage (set by previous APK load)
    const stored = localStorage.getItem("rejofood_app_role");
    setStoredAppRole(stored);

    // Jika ada ?app= di URL, persist ke localStorage
    // (Capacitor server.url pakai query param untuk set role APK)
    if (appRoleParam) {
      const valid = ["CUSTOMER", "MERCHANT", "DRIVER"].includes(appRoleParam);
      if (valid) {
        localStorage.setItem("rejofood_app_role", appRoleParam);
        setStoredAppRole(appRoleParam);
      }
    }
  }, [appRoleParam]);

  const appRole = process.env.NEXT_PUBLIC_APP_ROLE || storedAppRole || null;

  // Admin access control:
  // - Web (tanpa appRole): admin bisa login via ?admin=1
  // - APK (appRole set): admin TIDAK BISA login, bahkan jika ?admin=1 diset
  //   (mencegah admin login dari APK Customer/Merchant/Driver)
  const showAdmin = !appRole && searchParams.get("admin") === "1";

  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [booted, setBooted] = useState(false);
  const [slowNetwork, setSlowNetwork] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Slow network detection: jika session check > 2.5 detik, tampilkan warning
    const slowTimer = setTimeout(() => {
      if (!cancelled && !booted) setSlowNetwork(true);
    }, 2500);

    // Hard timeout: jika > 8 detik, langsung show auth screen (jangan block user)
    const hardTimeout = setTimeout(() => {
      if (!cancelled) {
        console.warn("[boot] Session check timeout — showing auth screen");
        setBooted(true);
      }
    }, 8000);

    (async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (data?.user) setUser(data.user);
      } catch {
        // network errors → just show auth screen
      } finally {
        if (!cancelled) {
          clearTimeout(slowTimer);
          clearTimeout(hardTimeout);
          setBooted(true);
        }
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
      clearTimeout(hardTimeout);
    };
  }, [setUser, booted]);

  // Role mismatch check — APK locked to specific role
  // Jika user login dengan role lain (mis. admin di APK Customer), auto-logout
  const isMismatched = !!user && !!appRole && user.role !== appRole;

  // 🔒 Auto-logout saat mismatch terdeteksi (defense in depth)
  // Jika server-side expectedRole check terlewat (mis. API dibobol),
  // client tetap kick user keluar
  useEffect(() => {
    if (!isMismatched) return;
    // Hanya log sekali per session
    console.warn("[security] Role mismatch detected — auto-logout");
    (async () => {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch {
        // ignore network error
      } finally {
        setUser(null);
      }
    })();
  }, [isMismatched, setUser]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
  }

  const view: View = !booted
    ? "loading"
    : isMismatched
      ? "mismatch"
      : user
        ? viewForRole(user.role as Role)
        : "auth";

  if (view === "loading") return <LoadingScreen slow={slowNetwork} />;
  if (view === "mismatch" && user && appRole) {
    return (
      <MismatchScreen
        actualRole={user.role}
        expectedRole={appRole}
        onLogout={handleLogout}
      />
    );
  }
  if (view === "auth") return <AuthShell showAdmin={showAdmin} appRole={appRole} />;
  if (view === "customer") return <CustomerDashboard />;
  if (view === "merchant") return <MerchantDashboard />;
  if (view === "driver") return <DriverDashboard />;
  if (view === "admin") return <AdminDashboard />;
  return <AuthShell showAdmin={showAdmin} />;
}

export default function Home() {
  // Suspense wajib karena useSearchParams() bersifat async di Next.js 16.
  return (
    <Suspense fallback={<LoadingScreen />}>
      <HomeInner />
    </Suspense>
  );
}

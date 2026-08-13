"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Users, RefreshCw, Search, Ban, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AdminUser {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

const ROLE_BADGE: Record<string, string> = {
  CUSTOMER: "bg-saffron/15 text-saffron border-saffron/30",
  MERCHANT: "bg-lavender/15 text-lavender border-lavender/30",
  DRIVER: "bg-mint/15 text-mint border-mint/30",
  ADMIN: "bg-rose/15 text-rose border-rose/30",
};

const ROLE_LABEL: Record<string, string> = {
  CUSTOMER: "Pelanggan",
  MERCHANT: "Merchant",
  DRIVER: "Driver",
  ADMIN: "Admin",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export function UserManagement() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (roleFilter) params.set("role", roleFilter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/users?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error || "Gagal memuat users."); return; }
      setUsers(data.items);
      setTotal(data.total);
    } catch {
      toast.error("Koneksi bermasalah.");
    } finally {
      setLoading(false);
    }
  }, [roleFilter, search]);

  useEffect(() => {
    const t = setTimeout(fetchUsers, 200);
    return () => clearTimeout(t);
  }, [fetchUsers]);

  async function toggleActive(user: AdminUser) {
    setToggling(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Gagal mengubah status user.");
        return;
      }
      toast.success(`${user.fullName} ${user.isActive ? "dinonaktifkan" : "diaktifkan"}.`);
      // Update local state
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, isActive: !user.isActive } : u));
    } catch {
      toast.error("Koneksi bermasalah.");
    } finally {
      setToggling(null);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-card">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="accent-rose flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-role text-role-fg">
            <Users className="h-4.5 w-4.5" strokeWidth={2.2} />
          </span>
          <div>
            <h3 className="font-display text-lg font-700 text-foreground">Manajemen User</h3>
            <p className="text-xs text-muted-foreground">{total} total user</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading} className="h-8">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </Button>
      </header>

      {/* Search + filter */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Cari nama atau email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="flex gap-1">
          {["", "CUSTOMER", "MERCHANT", "DRIVER", "ADMIN"].map((r) => (
            <button
              key={r || "all"}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[0.65rem] font-700 uppercase transition-premium",
                roleFilter === r
                  ? "accent-rose border-role bg-role-soft text-role"
                  : "border-border bg-card text-muted-foreground hover:border-role/40",
              )}
            >
              {r ? ROLE_LABEL[r] : "Semua"}
            </button>
          ))}
        </div>
      </div>

      {/* User list */}
      <div className="max-h-[28rem] space-y-1.5 overflow-y-auto scroll-slim pr-1">
        {loading && users.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/50" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Users className="mx-auto h-8 w-8" />
            <p className="mt-2 font-600">Tidak ada user ditemukan</p>
          </div>
        ) : (
          users.map((u, idx) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.02, 0.3) }}
              className={cn(
                "flex items-center gap-3 rounded-xl border bg-background/60 p-2.5 transition-premium",
                u.isActive ? "border-border" : "border-rose/20 opacity-70",
              )}
            >
              <span className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-700",
                u.role === "ADMIN" ? "bg-rose text-rose-foreground" : "bg-primary text-primary-foreground",
              )}>
                {u.fullName[0]?.toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-700 text-foreground">{u.fullName}</p>
                  {u.role === "ADMIN" && <ShieldCheck className="h-3 w-3 text-rose" />}
                </div>
                <p className="truncate text-xs text-muted-foreground">{u.email} · {formatTime(u.createdAt)}</p>
              </div>
              <Badge variant="outline" className={cn("h-5 px-1.5 text-[0.55rem] font-700", ROLE_BADGE[u.role])}>
                {ROLE_LABEL[u.role] ?? u.role}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => toggleActive(u)}
                disabled={toggling === u.id || u.role === "ADMIN"}
                className={cn(
                  "h-8 w-8 p-0",
                  u.isActive ? "text-destructive hover:bg-destructive/10" : "text-mint hover:bg-mint/10",
                )}
                title={u.role === "ADMIN" ? "Admin tidak bisa dinonaktifkan" : u.isActive ? "Nonaktifkan" : "Aktifkan"}
              >
                {toggling === u.id ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : u.isActive ? (
                  <Ban className="h-3.5 w-3.5" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </motion.div>
          ))
        )}
      </div>
    </section>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  User, Mail, Phone, MapPin, Bike, Lock, Save, Loader2,
  CheckCircle2, AlertCircle, Eye, EyeOff, ShieldCheck, Bell, BellOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { ImageUploader } from "@/components/shared/image-uploader";

interface ProfileData {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  role: string;
  avatarUrl: string | null;
  createdAt: string;
  // Role-specific
  defaultAddress?: string | null;
  vehicleType?: string;
  vehiclePlate?: string | null;
  isOnline?: boolean;
  rating?: number;
  twoFactorEnabled?: boolean;
}

const ROLE_ACCENT: Record<string, "saffron" | "lavender" | "mint" | "rose"> = {
  CUSTOMER: "saffron",
  MERCHANT: "lavender",
  DRIVER: "mint",
  ADMIN: "rose",
};

const ROLE_LABEL: Record<string, string> = {
  CUSTOMER: "Pelanggan",
  MERCHANT: "Merchant",
  DRIVER: "Driver",
  ADMIN: "Admin",
};

function initialColor(name: string, role: string): string {
  const accentMap: Record<string, string> = {
    saffron: "bg-saffron text-saffron-foreground",
    lavender: "bg-lavender text-lavender-foreground",
    mint: "bg-mint text-mint-foreground",
    rose: "bg-rose text-rose-foreground",
  };
  return accentMap[ROLE_ACCENT[role]] ?? "bg-primary text-primary-foreground";
}

export function UserProfileEditor() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [defaultAddress, setDefaultAddress] = useState("");
  const [vehicleType, setVehicleType] = useState("motorcycle");
  const [vehiclePlate, setVehiclePlate] = useState("");

  // Password change state
  const [showPwdSection, setShowPwdSection] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Gagal memuat profil.");
        return;
      }
      setProfile(data);
      setFullName(data.fullName || "");
      setEmail(data.email || "");
      setPhone(data.phone || "");
      setDefaultAddress(data.defaultAddress || "");
      setVehicleType(data.vehicleType || "motorcycle");
      setVehiclePlate(data.vehiclePlate || "");
    } catch {
      setError("Koneksi bermasalah.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, unknown> = { fullName, email, phone: phone || null };
      if (user?.role === "CUSTOMER") body.defaultAddress = defaultAddress || null;
      if (user?.role === "DRIVER") {
        body.vehicleType = vehicleType;
        body.vehiclePlate = vehiclePlate || null;
      }

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Gagal menyimpan profil.");
        return;
      }
      toast.success("Profil berhasil diperbarui.");
      // Update auth store jika fullName/email berubah
      if (data.user && user) {
        setUser({ ...user, fullName: data.user.fullName, email: data.user.email, phone: data.user.phone });
      }
      await fetchProfile();
    } catch {
      toast.error("Koneksi bermasalah.");
    } finally {
      setSaving(false);
    }
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd.length < 6) {
      toast.error("Password baru minimal 6 karakter.");
      return;
    }
    setSavingPwd(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Gagal mengubah password.");
        return;
      }
      toast.success("Password berhasil diubah.");
      setCurrentPwd("");
      setNewPwd("");
      setShowPwdSection(false);
    } catch {
      toast.error("Koneksi bermasalah.");
    } finally {
      setSavingPwd(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-32 animate-pulse rounded-2xl bg-muted/50" />
        <div className="h-64 animate-pulse rounded-2xl bg-muted/50" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!profile || !user) return null;

  const accent = ROLE_ACCENT[profile.role] ?? "saffron";
  const safeFullName = profile.fullName || "User";
  const safeInitial = safeFullName[0]?.toUpperCase() ?? "?";

  return (
    <div className="space-y-4">
      {/* Profile header card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("accent-" + accent, "rounded-2xl border border-border bg-card p-5 shadow-premium sm:p-6")}
      >
        <div className="flex items-center gap-4">
          {/* Avatar upload */}
          <ImageUploader
            value={profile.avatarUrl}
            onChange={async (url) => {
              try {
                const res = await fetch("/api/profile/avatar", {
                  method: "PATCH",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ avatarUrl: url }),
                });
                if (res.ok) {
                  setProfile({ ...profile, avatarUrl: url });
                  if (user) setUser({ ...user, avatarUrl: url });
                  toast.success("Foto profil diperbarui.");
                }
              } catch { /* silent */ }
            }}
            folder="avatar"
            shape="rounded"
            size={64}
            label="Foto Profil"
          />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-xl font-700 text-foreground">{safeFullName}</h2>
            <p className="truncate text-sm text-muted-foreground">{profile.email || "—"}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <Badge variant="outline" className={cn("h-5 border-transparent px-2 text-[0.6rem] font-700",
                "bg-role-soft text-role",
              )}>
                {ROLE_LABEL[profile.role] ?? profile.role}
              </Badge>
              {profile.role === "ADMIN" && (
                <Badge variant="outline" className={cn(
                  "h-5 px-1.5 text-[0.55rem] font-700",
                  profile.twoFactorEnabled
                    ? "border-mint/40 bg-mint/10 text-mint"
                    : "border-rose/40 bg-rose/10 text-rose",
                )}>
                  <ShieldCheck className="mr-0.5 h-2.5 w-2.5" />
                  2FA {profile.twoFactorEnabled ? "ON" : "OFF"}
                </Badge>
              )}
              {profile.role === "DRIVER" && typeof profile.rating === "number" && (
                <Badge variant="outline" className="h-5 border-saffron/40 bg-saffron/10 px-1.5 text-[0.55rem] font-700 text-saffron">
                  ★ {profile.rating.toFixed(1)}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Bergabung sejak {new Date(profile.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}
        </p>
      </motion.div>

      {/* Edit form */}
      <motion.form
        onSubmit={onSave}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className={cn("accent-" + accent, "rounded-2xl border border-border bg-card p-5 shadow-premium sm:p-6")}
      >
        <h3 className="mb-4 font-display text-lg font-700 text-foreground">Informasi Akun</h3>

        <div className="space-y-4">
          {/* Full Name */}
          <div className="space-y-1.5">
            <Label htmlFor="fullName" className="flex items-center gap-1.5 text-xs font-600 uppercase tracking-wide text-muted-foreground">
              <User className="h-3 w-3" /> Nama Lengkap
            </Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="h-11 rounded-xl"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="flex items-center gap-1.5 text-xs font-600 uppercase tracking-wide text-muted-foreground">
              <Mail className="h-3 w-3" /> Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11 rounded-xl"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="flex items-center gap-1.5 text-xs font-600 uppercase tracking-wide text-muted-foreground">
              <Phone className="h-3 w-3" /> Nomor HP <span className="text-muted-foreground/60">(opsional)</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+62 812 3456 7890"
              className="h-11 rounded-xl"
            />
          </div>

          {profile.role === "CUSTOMER" && (
            <SavedAddressesManager />
          )}

          {/* Customer: default address */}
          {profile.role === "CUSTOMER" && (
            <div className="space-y-1.5">
              <Label htmlFor="address" className="flex items-center gap-1.5 text-xs font-600 uppercase tracking-wide text-muted-foreground">
                <MapPin className="h-3 w-3" /> Alamat Default <span className="text-muted-foreground/60">(opsional)</span>
              </Label>
              <Textarea
                id="address"
                value={defaultAddress}
                onChange={(e) => setDefaultAddress(e.target.value)}
                placeholder="Jl. Contoh No. 123, RT 01/RW 02, Jakarta. Patokan: depan minimarket."
                rows={2}
                className="resize-none rounded-xl"
              />
            </div>
          )}

          {/* Driver: vehicle info */}
          {profile.role === "DRIVER" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="vehicleType" className="flex items-center gap-1.5 text-xs font-600 uppercase tracking-wide text-muted-foreground">
                  <Bike className="h-3 w-3" /> Jenis Kendaraan
                </Label>
                <select
                  id="vehicleType"
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm"
                >
                  <option value="motorcycle">Motor</option>
                  <option value="car">Mobil</option>
                  <option value="bicycle">Sepeda</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vehiclePlate" className="flex items-center gap-1.5 text-xs font-600 uppercase tracking-wide text-muted-foreground">
                  Plat Nomor <span className="text-muted-foreground/60">(opsional)</span>
                </Label>
                <Input
                  id="vehiclePlate"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder="B 1234 RF"
                  className="h-11 rounded-xl"
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <Button
            type="submit"
            disabled={saving}
            className={cn("accent-" + accent, "h-10 bg-role text-role-fg hover:opacity-90")}
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan…</>
            ) : (
              <><Save className="h-4 w-4" /> Simpan Perubahan</>
            )}
          </Button>
        </div>
      </motion.form>

      {/* Push notifications */}
      <PushNotificationSection />

      {/* Password change section */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-border bg-card p-5 shadow-premium sm:p-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-display text-lg font-700 text-foreground">Keamanan</h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPwdSection((s) => !s)}
            className="h-8"
          >
            {showPwdSection ? "Batal" : "Ubah Password"}
          </Button>
        </div>

        {showPwdSection && (
          <motion.form
            onSubmit={onChangePassword}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 space-y-3 border-t border-border pt-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="currentPwd" className="text-xs font-600 uppercase tracking-wide text-muted-foreground">
                Password Lama
              </Label>
              <div className="relative">
                <Input
                  id="currentPwd"
                  type={showCurrentPwd ? "text" : "password"}
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  required
                  className="h-11 rounded-xl pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPwd((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newPwd" className="text-xs font-600 uppercase tracking-wide text-muted-foreground">
                Password Baru <span className="text-muted-foreground/60">(min. 6 karakter)</span>
              </Label>
              <div className="relative">
                <Input
                  id="newPwd"
                  type={showNewPwd ? "text" : "password"}
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  required
                  minLength={6}
                  className="h-11 rounded-xl pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPwd((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={savingPwd}
                className="accent-rose bg-role text-role-fg hover:opacity-90"
              >
                {savingPwd ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Mengubah…</>
                ) : (
                  <><Lock className="h-4 w-4" /> Ubah Password</>
                )}
              </Button>
            </div>
          </motion.form>
        )}

        {!showPwdSection && (
          <p className="mt-2 text-xs text-muted-foreground">
            Password terakhir diubah: belum pernah / tidak tersedia.
          </p>
        )}
      </motion.div>
    </div>
  );
}

/** Push notification toggle section */
function PushNotificationSection() {
  const { supported, configured, subscribed, loading, subscribe, unsubscribe } = usePushNotifications();
  const [toggling, setToggling] = useState(false);

  async function handleToggle() {
    setToggling(true);
    try {
      if (subscribed) {
        const ok = await unsubscribe();
        if (ok) toast.success("Notifikasi dinonaktifkan.");
      } else {
        const ok = await subscribe();
        if (ok) toast.success("Notifikasi diaktifkan! Kamu akan dapat notifikasi saat status order berubah.");
        else toast.error("Gagal mengaktifkan notifikasi. Coba lagi.");
      }
    } finally {
      setToggling(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6 animate-pulse">
        <div className="h-6 w-48 rounded bg-muted/50" />
      </div>
    );
  }

  if (!supported) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
        <div className="flex items-center gap-2">
          <BellOff className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-display text-lg font-700 text-foreground">Notifikasi</h3>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Browser/device tidak mendukung push notification.
        </p>
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
        <div className="flex items-center gap-2">
          <BellOff className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-display text-lg font-700 text-foreground">Notifikasi</h3>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Push notification belum dikonfigurasi di server. Hubungi admin untuk mengaktifkan.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {subscribed ? (
            <Bell className="h-5 w-5 text-saffron" />
          ) : (
            <BellOff className="h-5 w-5 text-muted-foreground" />
          )}
          <h3 className="font-display text-lg font-700 text-foreground">Notifikasi</h3>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={toggling}
          className={cn(
            "press-feedback flex h-8 items-center gap-2 rounded-full px-3 text-xs font-700 transition-premium",
            subscribed
              ? "bg-saffron/10 text-saffron border border-saffron/30"
              : "bg-primary text-primary-foreground",
          )}
        >
          {toggling ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : subscribed ? (
            <>
              <span className="h-2 w-2 rounded-full bg-saffron" />
              Aktif
            </>
          ) : (
            <>
              <Bell className="h-3.5 w-3.5" />
              Aktifkan
            </>
          )}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {subscribed
          ? "Kamu akan mendapat notifikasi saat status pesanan berubah (diterima, diproses, diantar, tiba)."
          : "Aktifkan untuk mendapat notifikasi real-time di perangkat ini saat status pesanan berubah."}
      </p>
    </div>
  );
}

/** Saved addresses manager for customer */
function SavedAddressesManager() {
  const [addresses, setAddresses] = useState<Array<{ id: string; label: string; address: string; isDefault: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [newAddr, setNewAddr] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchAddrs = useCallback(async () => {
    try {
      const res = await fetch("/api/profile/addresses", { cache: "no-store" });
      const d = await res.json();
      if (d.addresses) setAddresses(d.addresses);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAddrs(); }, [fetchAddrs]);

  async function addAddr() {
    if (newAddr.trim().length < 5) return;
    setSaving(true);
    try {
      const res = await fetch("/api/profile/addresses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: newAddr.trim(), label: newLabel.trim() || undefined }),
      });
      if (res.ok) {
        toast.success("Alamat disimpan.");
        setNewAddr("");
        setNewLabel("");
        fetchAddrs();
      }
    } catch { /* silent */ }
    setSaving(false);
  }

  async function deleteAddr(id: string) {
    try {
      await fetch(`/api/profile/addresses/${id}`, { method: "DELETE" });
      toast.success("Alamat dihapus.");
      fetchAddrs();
    } catch { /* silent */ }
  }

  return (
    <div className="rounded-xl border border-border bg-background/60 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-700 uppercase tracking-wide text-muted-foreground">
        <MapPin className="h-3 w-3" /> Alamat Tersimpan
      </p>

      {loading ? (
        <div className="h-12 animate-pulse rounded-lg bg-muted/50" />
      ) : addresses.length === 0 ? (
        <p className="text-xs text-muted-foreground">Belum ada alamat tersimpan.</p>
      ) : (
        <div className="space-y-1.5">
          {addresses.map((a) => (
            <div key={a.id} className="flex items-start gap-2 rounded-lg bg-muted/30 p-2">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-[0.65rem] font-700 text-foreground">{a.label}</p>
                <p className="text-xs text-muted-foreground">{a.address}</p>
              </div>
              <button
                type="button"
                onClick={() => deleteAddr(a.id)}
                className="text-[0.6rem] text-destructive hover:underline"
              >
                Hapus
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new */}
      <div className="mt-2 space-y-1.5">
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Label (cth: Rumah, Kantor)"
          className="h-8 text-xs"
        />
        <div className="flex gap-1.5">
          <Input
            value={newAddr}
            onChange={(e) => setNewAddr(e.target.value)}
            placeholder="Alamat lengkap…"
            className="h-8 flex-1 text-xs"
          />
          <Button
            type="button"
            size="sm"
            onClick={addAddr}
            disabled={saving || newAddr.trim().length < 5}
            className="h-8 px-2 text-xs"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Tambah"}
          </Button>
        </div>
      </div>
    </div>
  );
}

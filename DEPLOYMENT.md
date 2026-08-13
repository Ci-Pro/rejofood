# RejoFood Deployment Guide

Panduan lengkap deploy RejoFood ke production (Vercel + Neon Postgres) + build APK Android.

**Total waktu**: ~30-45 menit

---

## Prerequisites

- Akun [GitHub](https://github.com) (sudah ada — repo: Ci-Pro/rejofood)
- Akun [Vercel](https://vercel.com) (gratis, sign in dengan GitHub)
- Akun [Neon](https://neon.tech) (gratis, sign in dengan GitHub)
- HP Android untuk test APK

---

## Step 1: Setup Neon Postgres (5 menit)

1. Buka https://neon.tech → Sign up with GitHub
2. Create new project:
   - Project name: `rejofood`
   - Database name: `rejofood`
   - Region: pilih yang terdekat (Singapore untuk Indonesia)
3. Setelah project dibuat, copy **Connection string**:
   ```
   postgresql://rejofood_owner:xxxxxxxx@ep-xxx-xxx.us-east-2.aws.neon.tech/rejofood?sslmode=require
   ```
4. Simpan connection string ini — akan dipakai di Step 3.

---

## Step 2: Switch Prisma ke Postgres (2 menit)

Edit file `prisma/schema.prisma` line 12:

**Before (SQLite untuk dev):**
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

**After (Postgres untuk production):**
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Commit + push:
```bash
git add prisma/schema.prisma
git commit -m "chore: switch Prisma to postgresql for production"
git push
```

⚠️ **Catatan**: Setelah ini, local dev juga butuh Postgres. Untuk tetap pakai SQLite lokal, gunakan [Git stash](https://git-scm.com/docs/git-stash) atau branch terpisah. Atau pakai Neon untuk lokal juga (cukup set `DATABASE_URL` di `.env`).

---

## Step 3: Deploy ke Vercel (10 menit)

1. Buka https://vercel.com → "Add New..." → Project
2. Import repository `Ci-Pro/rejofood`
3. **Configure Project**:
   - Framework Preset: **Next.js** (auto-detected)
   - Root Directory: `./` (default)
   - Build Command: *(default — sudah auto `prisma generate && prisma db push --accept-data-loss && next build`)*
   - Install Command: `bun install` (default)
4. **Environment Variables** — klik "Add" untuk masing-masing.
   Centang semua environment: **Production + Preview + Development**.

   | Name | Value | Wajib? | Note |
   |------|-------|--------|------|
   | `DATABASE_URL` | `postgresql://rejofood_owner:xxx@ep-xxx.neon.tech/rejofood?sslmode=require` | ✅ WAJIB | Dari Neon (Step 1). Tanpa ini, build gagal. |
   | `REJO_DEMO_MODE` | `false` | ✅ WAJIB | Block demo admin di production |
   | `REJO_REALTIME_SECRET` | `<64-char-hex>` | ⚠️ Rekomendasi | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `REJO_REALTIME_URL` | *(kosongkan)* | Opsional | Vercel tidak support WebSocket — app fallback ke polling 30s |
   | `NEXT_PUBLIC_REALTIME_URL` | *(kosongkan)* | Opsional | Same as above |
   | `CLOUDINARY_CLOUD_NAME` | `your-cloud-name` | ⚠️ Rekomendasi | Untuk upload foto menu/logo/avatar. Daftar gratis di cloudinary.com |
   | `CLOUDINARY_UPLOAD_PRESET` | `rejofood` | ⚠️ Rekomendasi | Buat unsigned preset di Cloudinary → Settings → Upload |
   | `REJOFOOD_BACKEND_URL` | `https://rejofood.vercel.app` | Opsional | URL backend untuk APK Android |
   | `VAPID_PUBLIC_KEY` | `<from npx web-push generate-vapid-keys>` | Opsional | Untuk PWA push notifications |
   | `VAPID_PRIVATE_KEY` | `<from npx web-push generate-vapid-keys>` | Opsional | Same as above |
   | `VAPID_SUBJECT` | `mailto:admin@rejofood.id` | Opsional | Same as above |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `<same as VAPID_PUBLIC_KEY>` | Opsional | Public key untuk client-side |

5. Klik **Deploy**
6. Tunggu ~3-5 menit sampai build selesai
   - Build log akan menampilkan: `prisma generate → prisma db push (auto-migrate!) → next build`
   - Setiap deploy otomatis sync schema ke Neon Postgres (lihat `package.json` build script)
7. Dapat URL: `https://rejofood-xxx.vercel.app`

### Verifikasi deploy berhasil

- Buka URL Vercel → harus muncul halaman login RejoFood
- Login sebagai customer: `customer@rejofood.id` / `rejo1234`
- ⚠️ **Database masih kosong** — perlu seed data (Step 4)

### ⚡ Auto-Migrate (NEW!)

Build script di `package.json` sekarang menjalankan `prisma db push --accept-data-loss` otomatis setiap deploy. Artinya:

- ✅ Setiap perubahan `prisma/schema.prisma` otomatis di-sync ke Neon Postgres
- ✅ Tidak perlu run `prisma migrate` manual setelah deploy
- ✅ Idempotent — kalau schema sudah sinkron, `db push` no-op
- ⚠️ `--accept-data-loss` berisiko untuk kolom yang di-rename/drop (data hilang). Untuk MVP app baru, ini aman.
- ⚠️ Preview deployments juga akan sync ke production DB — **hati-hati** kalau schema berubah di feature branch

Untuk local dev, set `DATABASE_URL=file:./db/custom.db` di `.env` dan switch `provider = "sqlite"` di `prisma/schema.prisma`.

---

## Step 4: Seed Database Production (3 menit)

Karena database Neon baru kosong, perlu seed demo data.

**Opsi A: Jalankan seed script lokal dengan DATABASE_URL Neon**

```bash
# Set DATABASE_URL lokal ke Neon (sementara)
export DATABASE_URL="postgresql://rejofood_owner:xxx@ep-xxx.neon.tech/rejofood?sslmode=require"

# Pastikan schema sudah postgresql (Step 2)
# Run db push untuk create tables
npx prisma db push

# Seed demo users + restaurants
bun run scripts/seed-users.ts
bun run scripts/seed-restaurants.ts
```

**Opsi B: Pakai Vercel CLI**

```bash
npm i -g vercel
vercel login
vercel link  # link ke project rejofood
vercel env pull .env.production  # download env vars dari Vercel

# Sekarang .env.production berisi DATABASE_URL Neon
npx prisma db push
bun run scripts/seed-users.ts
bun run scripts/seed-restaurants.ts
```

Setelah seed, refresh app di Vercel → harus ada 5 restoran untuk dibrowse.

---

## Step 5: Build APK Android dengan backend Vercel (5 menit)

1. Buka https://github.com/Ci-Pro/rejofood/settings/secrets/actions
2. Klik **New repository secret**:
   - Name: `REJOFOOD_BACKEND_URL`
   - Value: `https://rejofood-xxx.vercel.app` (URL Vercel Anda dari Step 3)
3. Buka https://github.com/Ci-Pro/rejofood/actions
4. Klik **"Build Android APK"** workflow di sidebar kiri
5. Klik **"Run workflow"** → pilih branch `main` → **Run workflow**
6. Tunggu ~3-5 menit sampai build selesai (ikon hijau ✓)
7. Klik run yang berhasil → scroll ke bawah ke **Artifacts**
8. Download `rejofood-debug-apk` (ZIP file, ~3.6 MB)
9. Extract ZIP → dapat `app-debug.apk`

---

## Step 6: Install & Test di HP Android (5 menit)

1. Transfer `app-debug.apk` ke HP Android (via USB, Bluetooth, email, Google Drive, dll)
2. Di HP, buka file manager → tap file APK
3. Izinkan install dari sumber tidak dikenal (jika diminta)
4. Install → buka app **RejoFood**
5. App akan load `https://rejofood-xxx.vercel.app` (backend Vercel Anda)
6. Login sebagai customer: `customer@rejofood.id` / `rejo1234`
7. Test flow:
   - Browse restoran
   - Add to cart
   - Checkout (pilih COD untuk test cepat)
   - Lihat order di "Pesanan saya"
   - Login sebagai merchant (di browser atau HP lain) → accept order
   - Lihat status update di customer

---

## Optional: Enable Realtime via Railway (15 menit)

Default di atas: **realtime disabled**, app pakai polling 30s. UX masih OK tapi tidak instant. Untuk enable realtime:

1. Buka https://railway.app → Sign in with GitHub
2. **New Project** → Deploy from GitHub repo → pilih `Ci-Pro/rejofood`
3. **Settings**:
   - Root Directory: `mini-services/realtime`
   - Build Command: `bun install`
   - Start Command: `bun run start`
4. **Variables** (add):
   - `REJO_REALTIME_SECRET` = `35f098168c83d752e88cd8e468fa3eae6ecb7ab7fcc89810114fb3113a54d240` (sama dengan Vercel)
   - `REJO_NEXTJS_BASE` = `https://rejofood-xxx.vercel.app` (URL Vercel Anda)
   - `PORT` = `3001`
5. Railway beri URL: `https://rejofood-realtime.up.railway.app`
6. Update Vercel env vars:
   - `REJO_REALTIME_URL` = `https://rejofood-realtime.up.railway.app`
   - `NEXT_PUBLIC_REALTIME_URL` = `https://rejofood-realtime.up.railway.app`
7. Redeploy Vercel (push commit kosong atau klik "Redeploy" di Vercel)
8. Rebuild APK (Step 5) — APK perlu `NEXT_PUBLIC_REALTIME_URL` baked in

Sekarang realtime aktif: customer lihat status update instant saat merchant/driver action.

---

## Troubleshooting

### Build Vercel gagal: "Prisma Client not generated"
Pastikan Build Command: `prisma generate && next build`

### Login gagal: "Email atau password salah"
Database belum di-seed. Lihat Step 4.

### App blank/white screen di HP
- Cek URL Vercel accessible dari HP (buka di browser HP)
- Cek Vercel logs untuk runtime errors

### Realtime tidak jalan (status tidak update)
- Default: realtime disabled di Vercel (fallback polling 30s)
- Untuk enable: ikuti "Optional: Enable Realtime via Railway"

### APK install gagal: "App not installed"
- Cek storage HP cukup
- Cek Android version >= 7.0 (API 24)
- Coba enable "Install unknown apps" untuk file manager

### Cookie/session tidak persist di APK
Edit `src/lib/auth/session.ts` → pastikan `sameSite: "none"` + `secure: true` untuk production (HTTPS). Lihat kode现有的 `sameSite: "lax"` — ganti ke `"none"` jika perlu cross-origin.

---

## Production Security Checklist

Sebelum share app ke publik:

- [ ] `REJO_DEMO_MODE=false` (block demo admin)
- [ ] Generate `REJO_REALTIME_SECRET` baru (jangan pakai dari .env.example)
- [ ] Set up proper CORS di Vercel (default OK untuk same-origin)
- [ ] Hapus demo users yang tidak perlu (admin@rejofood.id, dll) atau ganti password
- [ ] Setup Midtrans real payment (lihat `src/lib/payment/gateway.ts`)
- [ ] Enable Vercel DDoS protection (default ON)
- [ ] Setup error monitoring (Sentry / Vercel Analytics)

---

## Next Steps setelah deploy

1. **Test all flows** di HP: customer order → merchant accept → driver deliver → review
2. **Collect feedback** — apa yang kurang intuitive?
3. **Iterate**:
   - Image upload menu (UX polish)
   - Auto-cancel order timeout
   - Push notification (PWA)
   - Delivery fee by distance
4. **Play Store release** (butuh release build + signing key + developer account $25)

Lihat README.md untuk full feature list dan project structure.

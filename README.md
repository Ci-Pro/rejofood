# RejoFood 🍜

Aplikasi jasa antar makanan lokal — Pesan · Masak · Antar · Atur. Empat role terintegrasi: Customer, Merchant, Driver, Admin.

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + TypeScript 5 + Tailwind CSS 4 + shadcn/ui
- **Backend**: Next.js API Routes + Prisma ORM (SQLite dev, Postgres production)
- **Realtime**: Socket.IO mini-service (port 3001)
- **Auth**: Session cookie + 2FA TOTP (admin) + rate limiting + audit log
- **Payment**: Mock gateway (swap-ready ke Midtrans/Xendit)
- **Mobile**: Capacitor (Android WebView wrapper)
- **State**: Zustand (cart + auth) + TanStack Query patterns

## Quick Start (Development)

```bash
# Install dependencies
bun install

# Setup database
bun run db:push
bun run db:generate

# Seed demo data (5 restaurants + 27 menu items + 4 demo users)
bun run scripts/seed-users.ts
bun run scripts/seed-restaurants.ts

# Start realtime service (terminal 1)
cd mini-services/realtime && bun install && bun run dev

# Start Next.js dev server (terminal 2)
bun run dev
```

Open http://localhost:3000

## Demo Accounts

| Role | Email | Password | Note |
|------|-------|----------|------|
| Customer | customer@rejofood.id | rejo1234 | |
| Merchant | merchant@rejofood.id | rejo1234 | |
| Driver | driver@rejofood.id | rejo1234 | |
| Admin | admin@rejofood.id | rejo1234 | Wajib 2FA TOTP, akses via `/?admin=1` |

## Features

### Customer
- Browse restoran dengan search + filter
- Cart persisten (localStorage) dengan constraint same-merchant
- Checkout dengan alamat + catatan
- 8 metode pembayaran: COD, QRIS, VA (BCA/Mandiri/BNI), E-wallet (GoPay/OVO/DANA)
- Track pesanan real-time (WebSocket)
- Cancel pesanan (sebelum READY)
- Beri rating 1-5 bintang + review setelah DELIVERED

### Merchant
- Kelola profil restoran (toggle BUKA/TUTUP, edit info)
- CRUD menu items lengkap
- Antrian pesanan real-time dengan action buttons (Terima → Proses → Siap)
- Lihat review + rating restoran

### Driver
- List pesanan READY yang siap dijemput
- Atomic pickup (race-safe — tidak bisa double-claim)
- Active deliveries dengan tombol "Sudah sampai"
- Real-time update

### Admin
- Monitor semua pesanan dengan filter status
- Audit log (semua aksi sensitif tercatat: login, 2FA, order, payment, review)
- Hidden dari UI publik (akses via `/?admin=1`)
- Session TTL 2 jam + idle timeout 15 menit

## Android APK Build

### Cara 1: Via GitHub Actions (recommended)

1. **Fork/clone repo ini**
2. **Deploy backend ke Vercel** (gratis):
   ```bash
   # Push ke GitHub → connect ke Vercel → auto-deploy
   # Dapat URL: https://your-app.vercel.app
   ```
3. **Set GitHub Secret**:
   - Repository Settings → Secrets and variables → Actions
   - Add secret: `REJOFOOD_BACKEND_URL` = `https://your-app.vercel.app`
4. **Trigger build**:
   - Actions tab → "Build Android APK" → Run workflow
5. **Download APK** dari Artifacts section
6. **Install di HP**:
   - Transfer APK ke HP Android
   - Buka file → izinkan install dari sumber tidak dikenal
   - Buka app RejoFood

### Cara 2: Build lokal

```bash
# Prerequisites: Node, Bun, Java 17, Android SDK
bun install
bun add @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

## Security Layers

1. ✅ Self-register ADMIN diblokir (403)
2. ✅ Admin hidden dari UI publik (`/?admin=1`)
3. ✅ Demo admin auto-blocked di production
4. ✅ Rate limit login (5/15min → 30min lockout)
5. ✅ 2FA TOTP wajib untuk admin
6. ✅ Audit log semua aksi sensitif
7. ✅ Session TTL differentiated per role (admin 2h + idle 15min)
8. ✅ `requireAdmin()` helper untuk API routes

## Production Deployment

### Backend (Vercel)
1. Push ke GitHub
2. Connect repo ke Vercel
3. Set environment variables (lihat `.env.example`)
4. Set `REJO_DEMO_MODE=false` (blokir demo admin)
5. Migrate DB ke Postgres (Neon/Supabase) — update `DATABASE_URL`
6. Deploy realtime service ke Railway/Render (atau pakai Pusher/Soketi)

### Payment Gateway (Midtrans)
1. Daftar Midtrans → dapat Server Key + Client Key
2. Update `src/lib/payment/gateway.ts`:
   - `createPaymentCharge()` → call Midtrans Snap API
   - `verifyWebhookSignature()` → verify HMAC SHA512
3. Set env: `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`
4. Set webhook URL di Midtrans dashboard → `/api/payment/webhook`

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes (auth, orders, payment, etc.)
│   ├── page.tsx           # Auth-aware shell
│   └── layout.tsx         # Root layout (fonts, providers)
├── components/
│   ├── auth/              # Login, 2FA, brand logo
│   ├── customer/          # Restaurant grid, cart, checkout, payment, review
│   ├── merchant/          # Profile editor, menu manager, order queue
│   ├── driver/            # Driver orders (available + active)
│   ├── admin/             # Order monitor, audit log viewer
│   └── shared/            # AppShell, dashboard primitives, session countdown
├── lib/
│   ├── auth/              # Session, password, TOTP, rate limiter, audit
│   ├── payment/           # Mock gateway (swap-ready)
│   ├── realtime/          # Socket.IO client helper
│   └── db.ts              # Prisma client
├── hooks/                 # useOrderSocket, useSessionInfo
├── store/                 # Zustand stores (auth, cart)
└── types/                 # TypeScript types

mini-services/
└── realtime/              # Socket.IO server (port 3001)

prisma/
└── schema.prisma          # User, Session, Order, Payment, Review, etc.

scripts/
├── seed-users.ts          # 4 demo users (1 per role)
├── seed-restaurants.ts    # 5 restaurants + 27 menu items
├── test-*.ts              # Integration tests
```

## License

MIT

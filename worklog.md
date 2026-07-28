# RejoFood Worklog

---
Task ID: sec-1
Agent: main
Task: Hardening fondasi login — sembunyikan admin dari publik & blokir self-register admin

Work Log:
- Audit celah keamanan pada fondasi login RejoFood yang baru dibangun
- Identifikasi 3 prioritas merah: (1) self-register ADMIN masih dibuka, (2) Admin terlihat di RoleRail publik, (3) demo admin tetap aktif saat go-live
- Perbaikan #1: `/api/auth/register` sekarang menolak `role: ADMIN` dengan 403 + pesan jelas
- Perbaikan #2: `roles.ts` ditambah `PUBLIC_ROLE_LIST` (3 role tanpa ADMIN) + helper `getRoleList(showAdmin)`
- Perbaikan #2b: `RoleRail` menerima prop `showAdmin` (default false). Saat false, Admin tidak render
- Perbaikan #2c: `AuthShell` menerima `showAdmin`. Sa true, tampilkan banner "Area terbatas" berwarna rose
- Perbaikan #2d: `page.tsx` pakai `useSearchParams` + `Suspense` untuk membaca `?admin=1` → `showAdmin`
- Perbaikan #3: `/api/auth/login` cek env `REJO_DEMO_MODE`. Saat !== 'true', email `admin@rejofood.id` ditolak (401) meski password benar
- Bonus: `context.ts` ditambah `requireAdmin()` + `requireRole(role)` + `toSafeUser(u)` helper untuk API routes admin di masa depan
- File `.env` di-update: tambah `REJO_DEMO_MODE=true` (untuk dev) + komentar
- Verifikasi: lint pass, curl test register ADMIN → 403, login normal → 200, browser E2E (admin tidak muncul di `/`, muncul di `/?admin=1`)

Stage Summary:
- 3 celah kritis pada fondasi login ditutup
- Admin kini "hidden by default" — pengunjung biasa tidak tahu pintu admin ada
- Self-registration admin diblokir di server (tidak bisa di-bypass dari client)
- Demo admin otomatis diblokir saat `REJO_DEMO_MODE` tidak di-set (production-safe default)
- Helper `requireAdmin()` siap dipakai di setiap API route admin berikutnya
- Lapisan keamanan berikutnya yang masih TODO: rate limit login, 2FA TOTP, audit log table, session TTL differentiated per role

---
Task ID: sec-2
Agent: main
Task: Rate limit login — cegah brute force & credential stuffing

Work Log:
- Buat module `src/lib/auth/rate-limiter.ts` — in-memory, per (IP, email) bucket
  - Konfigurasi via env: `REJO_RATE_LIMIT_MAX_ATTEMPTS` (default 5), `REJO_RATE_LIMIT_WINDOW_MS` (default 15 menit), `REJO_RATE_LIMIT_LOCKOUT_MS` (default 30 menit)
  - State per key: attempts, firstAttemptAt, lastAttemptAt, lockedUntil
  - Bucket dirotasi otomatis jika firstAttemptAt > WINDOW_MS
  - Lazy sweeper setiap 5 menit hapus bucket tidak aktif > 1 jam
  - API: `checkRateLimit(ip, email)`, `recordFailure(ip, email)`, `recordSuccess(ip, email)`, `getClientIp(req)`
  - `getClientIp` prioritaskan `X-Forwarded-For` (di belakang Caddy/gateway)
  - Komentar design notes: untuk multi-instance production, swap ke Redis (INCR+EXPIRE), API tetap sama
- Integrate ke `/api/auth/login`:
  - Pre-flight check: jika locked → 429 + retryAfterSeconds
  - Setiap kegagalan (email tidak ada / password salah / demo admin blocked) → recordFailure
  - Role mismatch TIDAK dihitung sebagai failure (bukan serangan, hanya UX)
  - Sukses → recordSuccess (clear bucket, janganbebani user dengan history gagal lama)
  - Response error sekarang mengembalikan: code, remainingAttempts, maxAttempts, retryAfterSeconds, lockedUntil
- Update `LoginForm`:
  - Tampilkan `remainingAttempts` di error message (4→3→2→1→0)
  - Warning kuning saat remaining ≤ 2 (sebelum lockout)
  - Saat locked: tombol disabled + label berubah jadi "Dikunci · 30m"
  - Countdown bar visual dengan animasi width proporsional
  - Field email/password/show-pwd juga disabled saat locked
  - State `lockCountdown` decrement tiap detik via useEffect
- Update `.env`: tambah 3 env vars untuk tuning rate limit
- Buat unit test `scripts/test-rate-limiter.ts` — 21 test case, semua lulus
  - Fresh bucket, 4 failures decrement, 5th trigger lockout, locked state verification
  - Independence: beda IP atau beda email = bucket terpisah
  - recordSuccess reset bucket
  - Case-insensitive + whitespace-trimmed email normalization
- Verifikasi curl: 5x gagal → attempt 5 dan 6 dan 7 (bahkan dengan password benar) = 429 LOCKED_OUT
- Verifikasi browser: form login kena disabled + countdown bar muncul setelah 5x gagal
- Verifikasi bucket isolation: user yang lockout di email A tetap bisa login di email B (screenshot terverifikasi)

Stage Summary:
- Brute force & credential stuffing pada endpoint login kini terbatas: max 5 percobaan / 15 menit per (IP, email) → lockout 30 menit
- Pesan error generik tetap dipertahankan (tidak bocor apakah email ada/tidak)
- Role mismatch tidak dihukum (UX, bukan serangan)
- UI feedback progresif: sisa percobaan → warning kuning → lockout countdown
- Bucket terisolasi per email — satu user kena lockout tidak mempengaruhi user lain di IP yang sama
- Production-ready: tinggal swap in-memory store ke Redis untuk multi-instance
- TODO selanjutnya: 2FA TOTP, audit log table, session TTL differentiated per role, CAPTCHA setelah 2 kegagalan

---
Task ID: sec-3
Agent: main
Task: 2FA TOTP wajib untuk admin — cegah kompromi akun walau password bocor

Work Log:
- Install dependencies: `otplib@13` (RFC 6238 TOTP) + `qrcode@1.5` (QR PNG generator) + `@types/qrcode`
- Update Prisma schema: tambah `twoFactorSecret String?` + `twoFactorEnabled Boolean @default(false)` ke User
- Run `db:push` + `db:generate` untuk sinkronisasi
- Buat `src/lib/auth/totp.ts`:
  - `generateSecret()` — base32 secret 20 bytes entropy
  - `buildOtpAuthUrl(email, secret)` — URL otpauth:// untuk QR
  - `verifyToken(token, secret)` — verifikasi 6-digit, toleransi ±30 detik clock skew
  - `_generateTokenForTesting(secret)` — helper untuk integration test
  - Note: otplib v13 breaking change — pakai functional API (`generateSync`, `verifySync`) bukan `authenticator` object
- Buat `src/lib/auth/challenge-store.ts`:
  - In-memory store untuk challenge token 2FA (TTL 5 menit)
  - Tipe challenge: "setup" (first-time admin) atau "verify" (admin dgn 2FA enabled)
  - Pending secret disimpan di challenge entry untuk setup flow
  - Rate limit per challenge (max 5 percobaan TOTP)
  - Penting: pakai `globalThis.__rejoChallengeStore` agar persistent cross-module di Next.js dev server
  - Same fix applied to `rate-limiter.ts` (`globalThis.__rejoRateLimitStore`)
- Update `/api/auth/login`:
  - Setelah password verified, cek role === ADMIN
  - Jika !twoFactorEnabled → return `{ needsSetup: true, challengeToken }` (admin wajib setup 2FA dulu)
  - Jika twoFactorEnabled → return `{ needsTwoFactor: true, challengeToken }` (admin verify TOTP)
  - Role lain → langsung set session cookie (2FA optional, TODO)
- Buat 3 API routes baru:
  - `/api/auth/2fa/setup` POST — return `{ secret, otpauthUrl, qrDataUrl }` dari challenge token
  - `/api/auth/2fa/enable` POST — verifikasi code pertama, persist secret, enable 2FA, set session
  - `/api/auth/2fa/verify` POST — verifikasi code TOTP untuk admin yang sudah setup, set session
- Buat 2 komponen UI:
  - `TwoFactorSetup` — QR code (240px PNG) + secret (collapsible manual entry) + InputOTP 6-slot + copy-to-clipboard + step-by-step instructions
  - `TwoFactorChallenge` — InputOTP 6-slot autoFocus + verifikasi
  - Kedua komponen pakai accent rose (sesuai role admin) + tombol "Kembali ke login" untuk cancel
- Update `LoginForm`:
  - Tambah state machine: `null` (form biasa) → `"setup"` → `"challenge"`
  - Handle response `needsSetup` / `needsTwoFactor` dari /api/auth/login
  - Render komponen 2FA yang sesuai berdasarkan state
  - `cancelTwoFactor()` reset semua state + password
- Integration test `scripts/test-2fa.ts` — 30 test case, semua lulus:
  - Test 1: First-time admin login → setup → enable → session cookie (16 assertions)
  - Test 2: Subsequent admin login → challenge → verify → session cookie (8 assertions)
  - Test 3: TOTP rate limit (5x wrong → 401, 6th → 429 CHALLENGE_EXHAUSTED) (2 assertions)
- Verifikasi browser:
  - Buka `/?admin=1` → klik Admin → demo login → screen 2FA Setup muncul (QR + OTP input)
  - Input 6 digit → tombol "Aktifkan & Masuk" enabled
  - Submit code salah → field reset, tombol disabled kembali (UX benar)
  - Switch ke Customer → login langsung ke dashboard (2FA hanya admin, sesuai desain)
- Screenshot: `download/rejofood-2fa-setup.png` (QR code + OTP input UI)

Stage Summary:
- Admin kini WAJIB setup 2FA pada login pertama (force-enroll), lalu wajib verifikasi TOTP di setiap login berikutnya
- Brute force TOTP dibatasi: 5 percobaan per challenge token, lalu challenge di-destroy (must re-login)
- Password + TOTP = 2 independent factors. Password bocor saja tidak cukup untuk login admin
- Customer/Merchant/Driver tetap single-factor (2FA optional, TODO kalau diminta user)
- QR code generation server-side via `qrcode` library (240px PNG, branded aubergine color)
- Window toleransi ±30 detik untuk clock skew device (RFC 6238 compliant)
- Challenge token: in-memory 5 menit TTL, persistent cross-module via globalThis
- Production TODO:
  - Enkripsi secret di DB (AES-GCM dengan KMS)
  - Backup codes (10 kode satu-pakai untuk recovery jika HP hilang)
  - Admin recovery flow (admin lain bisa reset 2FA admin tertentu)
  - Tampilkan notifikasi email/push setiap login admin baru
  - Session TTL differentiated per role (admin 2 jam, lainnya 7 hari)

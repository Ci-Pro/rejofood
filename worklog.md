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

---
Task ID: sec-4
Agent: main
Task: AuditLog — jejak forensik semua aksi sensitif

Work Log:
- Tambah model `AuditLog` ke Prisma schema dengan field: id, actorId, actorEmail, actorRole, category, action, targetId, targetType, description, metadata (JSON), outcome, ipAddress, userAgent, createdAt
- Indexes: actorId, (category, action), createdAt — untuk query forensik cepat
- Run `db:push` + `db:generate` (perlu restart dev server agar client ter-regenerate)
- Buat `src/lib/auth/audit.ts`:
  - `logAction(input)` — best-effort insert (error ditelan, tidak block aksi utama)
  - `getRequestMeta(req)` — ekstrak IP + User-Agent dari Request
  - `listAuditLogs(query)` — query dengan filter (category, action, outcome, email, from, to) + cursor pagination (limit max 200)
  - `listAuditCategories()` — daftar kategori unik untuk dropdown filter
  - Konvensi action naming: `<category>.<verb>[.outcome]` (contoh: "auth.login.success")
  - Outcome values: "success" | "failure" | "denied"
- Integrate audit logging ke 5 endpoint auth:
  - `/api/auth/login`: login.failed, login.success, login.locked_out, login.role_mismatch, login.demo_blocked, 2fa.setup_requested, 2fa.challenge_sent
  - `/api/auth/logout`: logout (hanya jika user terauth)
  - `/api/auth/register`: register.success, register.failed, register.denied (admin self-register attempt)
  - `/api/auth/2fa/enable`: 2fa.setup_success, 2fa.setup_failed, 2fa.setup_exhausted
  - `/api/auth/2fa/verify`: 2fa.verify_success, 2fa.verify_failed, 2fa.verify_exhausted
- Buat 2 API routes baru:
  - `/api/audit/logs` GET — admin-only (via `requireAdmin()`), filter + cursor pagination
  - `/api/audit/categories` GET — admin-only, daftar kategori unik
- Buat komponen `AuditLogViewer` di admin dashboard:
  - List audit log items dengan expandable details (ID, target, IP, user-agent, metadata JSON)
  - Filter: email (partial), category dropdown, outcome dropdown
  - Outcome badge: success (mint) / failure (saffron) / denied (rose)
  - Role badge per actor
  - Cursor pagination via "Muat lebih banyak" button
  - Refresh button
  - Max height 28rem dengan scroll-slim custom scrollbar
- Update `AdminDashboard` untuk include `AuditLogViewer` di bawah placeholder sections
- Integration test `scripts/test-audit-log.ts` — 19 assertions lulus:
  - Trigger 6 events: failed login, role mismatch, customer login, logout, register denied, admin 2FA verify
  - Verify all 7 expected action types tercatat: login.failed, login.role_mismatch, login.success, logout, register.denied, 2fa.challenge_sent, 2fa.verify_success
  - Test filter category=auth + outcome=denied → returns 2 items (role_mismatch + register.denied)
  - Test forbidden: GET /api/audit/logs tanpa admin cookie → 403
  - Test /api/audit/categories → contains "auth"
- Verifikasi browser:
  - Login admin full flow (password + TOTP)
  - Dashboard menampilkan AuditLogViewer dengan 9 events
  - Setiap event menampilkan: action, outcome badge, description, timestamp, email, role badge, IP
  - Filter dropdown berfungsi (terverifikasi via integration test)
  - Expand entry untuk lihat detail (ID, target, IP, UA, metadata)
  - Screenshot: `download/rejofood-admin-audit-log.png`

Stage Summary:
- Setiap aksi sensitif sekarang meninggalkan jejak permanen: siapa (actor), apa (action), kapan (createdAt), dari mana (IP + UA), dengan outcome apa
- 11 action types tercatat otomatis dari 5 endpoint auth (tanpa intervensi manual)
- AuditLog append-only dari sisi aplikasi — tidak ada UPDATE/DELETE route, hanya DBA yang bisa purge
- Best-effort: jika insert gagal (DB down), aksi utama tetap berjalan — audit log tidak pernah block user
- Admin-only access: GET /api/audit/logs memakai `requireAdmin()` → 403 untuk non-admin
- Cursor pagination: efisien untuk tabel besar (tidak load semua row)
- Filter kombinasi: category + outcome + email + date range → query forensik fleksibel
- Production TODO:
  - Tambahkan audit logging ke endpoint admin lain (user.ban, merchant.verify, dll. saat dibangun)
  - Retention policy: auto-purge log > 90 hari via cron
  - Streaming alert: kirim notifikasi Telegram/Slack untuk event kritis (login.failed > 5x, register.denied)
  - Export CSV/JSON untuk compliance audit
  - Index optimization untuk tabel besar (millions of rows)
  - Pindah ke append-only S3/CloudWatch untuk immutability guarantee

---
Task ID: sec-5
Agent: main
Task: Session TTL differentiated per role — admin 2 jam + idle 15 menit

Work Log:
- Update Prisma schema: tambah `lastActivityAt DateTime?` + index ke Session
- Run `db:push` + `db:generate` + restart dev server (Prisma client butuh reload)
- Buat `src/lib/auth/session-config.ts`:
  - Konstanta per role: ADMIN (2 jam absolute + 15 menit idle), lainnya (7 hari, tanpa idle)
  - `getSessionPolicy(role)` → { absoluteTtlMs, idleTimeoutMs }
  - `computeAbsoluteExpiry(role, startMs?)` → Date untuk di-set saat create session
  - `checkSessionExpiry(expiresAt, lastActivityAt, idleTimeoutMs, now)` → { expired, reason: "absolute" | "idle" }
  - `TOUCH_THROTTLE_MS = 60_000` — touch DB tidak setiap request, hanya jika selisih > 1 menit
- Update `src/lib/auth/context.ts`:
  - `getCurrentUser()` sekarang enforce idle timeout admin + touch lastActivityAt (throttled)
  - Session expired otomatis di-delete dari DB (lazy cleanup)
  - Tambah `getSessionInfo()` → return { user, expiresAt, idleExpiresAt, absoluteTtlMs, idleTimeoutMs } untuk UI
- Update 4 endpoint yang create session (login, register, 2fa/enable, 2fa/verify):
  - Pakai `computeAbsoluteExpiry(user.role)` instead of hardcoded `SESSION_TTL_MS`
  - Set `lastActivityAt: new Date()` saat create (reset idle timer)
  - Hapus konstanta `SESSION_TTL_MS` yang sekarang tidak terpakai
- Buat API `/api/auth/session-info` GET — public (return null jika no session), dipakai UI untuk polling
- Buat hook `useSessionInfo`:
  - Poll `/api/auth/session-info` setiap 30 detik
  - Countdown ticker per detik (via state counter, bukan setState derived)
  - Auto-logout client saat server return no user
  - Compute `remainingSeconds`, `isCritical` (< 60s), `expiringBy` ("idle" | "absolute")
  - Pola lint-compliant: tidak setState langsung di effect body
- Buat komponen `SessionCountdown`:
  - Hanya render untuk role ADMIN (karena idle timeout hanya admin)
  - Default: chip clock + "Xm Yd" countdown (border-border, text-muted)
  - Critical (< 60s): chip rose berdenyut + tombol "Perpanjang" (touch via refresh)
  - Auto-redirect ke `/` saat remainingSeconds === 0
  - Tooltip menjelaskan: "Sesi akan habis jika tidak ada aktivitas" (idle) vs TTL absolut
- Update `AppShell` untuk include `SessionCountdown` di header (sebelah kiri user menu)
- Integration test `scripts/test-session-ttl.ts` — 23 assertions lulus:
  - Test 1: Customer TTL = 7 hari (604800000 ms), idleExpiresAt = null
  - Test 2: Admin TTL = 2 jam (7200000 ms), idleTimeoutMs = 15 menit, idleExpiresAt ~ +15 menit
  - Test 3: Set lastActivityAt ke 20 menit lalu → session-info return no user, row dihapus dari DB
  - Test 4: Set expiresAt ke masa lalu → session-info return no user
  - Test 5: Touch lastActivityAt berfungsi saat request berjalan
  - Test 6: Throttling — touch tidak update jika lastActivityAt < 1 menit lalu
- Verifikasi browser:
  - Login admin full flow (password + TOTP)
  - Header menampilkan SessionCountdown (chip "Xm Yd")
  - Set lastActivityAt 14 menit lalu via DB → countdown turun ke <60 detik
  - Critical state: chip berubah rose, muncul tombol "Perpanjang"
  - Klik "Perpanjang" → session di-touch, countdown reset ke ~15 menit
  - Screenshot: `download/rejofood-admin-session-ttl.png`

Stage Summary:
- Admin session kini punya 2 lapis expiry: absolute (2 jam) + idle (15 menit tidak aktif)
- Touch throttling: hanya 1 DB write per menit per session — efisien untuk traffic tinggi
- Lazy cleanup: session expired otomatis dihapus saat akses berikutnya (tidak butuh cron)
- UI feedback progresif: countdown normal → critical (rose) → auto-logout
- Customer/Merchant/Driver tetap nyaman: 7 hari, tanpa idle timeout (tidak annoying)
- Server-side enforcement: idle timeout dicek di `getCurrentUser()` — tidak bisa di-bypass dari client
- Production TODO:
  - Tambah audit log event `auth.session.expired` (idle + absolute) — sudah di-hook tapi belum log
  - Session revocation UI di admin (force logout user tertentu)
  - Concurrent session limit per user (max 1 untuk admin, max 3 untuk customer)
  - Session fingerprinting (bind ke IP/UA, logout jika berubah drastis)
  - Refresh token mechanism untuk extend admin session tanpa re-login (jika diinginkan)

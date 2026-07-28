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

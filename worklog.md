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

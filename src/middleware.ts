/**
 * Security middleware — set HTTP security headers untuk semua responses.
 *
 * Headers yang di-set:
 *  - Content-Security-Policy: prevent XSS, clickjacking, mixed content
 *  - X-Frame-Options: DENY (no iframe embedding — anti-clickjacking)
 *  - X-Content-Type-Options: nosniff (prevent MIME sniffing)
 *  - Strict-Transport-Security: HSTS (force HTTPS selama 1 tahun)
 *  - Referrer-Policy: strict-origin-when-cross-origin
 *  - X-DNS-Prefetch-Control: off (prevent DNS prefetch leak)
 *  - Permissions-Policy: disable kamera, mikrofon, geoloc (kecuali butuh)
 *
 * Catatan: CSP allow Cloudinary (upload gambar), Vercel (self), dan inline styles
 * (Next.js butuh ini untuk styled-jsx + Tailwind).
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(_req: NextRequest) {
  const res = NextResponse.next();

  // === Content Security Policy ===
  // Allow: self, Cloudinary (images), Vercel analytics, inline styles+scripts (Next.js)
  // Disallow: everything else (default-src 'self')
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data:",
    "img-src 'self' data: blob: https://res.cloudinary.com",
    "connect-src 'self' https://rejofood.vercel.app wss: https:",
    "media-src 'self' data:",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
  res.headers.set("Content-Security-Policy", csp);

  // === X-Frame-Options ===
  // DENY = tidak bisa di-iframe sama sekali (anti-clickjacking)
  // Lebih ketat dari frame-ancestors di CSP, untuk browser lama
  res.headers.set("X-Frame-Options", "DENY");

  // === X-Content-Type-Options ===
  // nosniff = browser tidak boleh menebak MIME type
  // Mencegah attack dimana file .txt di-serve sebagai .html
  res.headers.set("X-Content-Type-Options", "nosniff");

  // === Strict-Transport-Security (HSTS) ===
  // Force HTTPS selama 1 tahun, include subdomains
  // Hanya aktif di production (HTTPS), skip di dev (HTTP localhost)
  if (process.env.NODE_ENV === "production") {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }

  // === Referrer-Policy ===
  // Hanya kirim origin (bukan full URL) saat cross-origin
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // === X-DNS-Prefetch-Control ===
  // Disable DNS prefetch untuk mencegah information leak
  res.headers.set("X-DNS-Prefetch-Control", "off");

  // === Permissions-Policy ===
  // Disable API berbahaya yang tidak dipakai app
  // Geolocation diizinkan (untuk delivery address), sisanya diblokir
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
  );

  // === X-XSS-Protection (legacy, tapi tetap ditambahkan) ===
  res.headers.set("X-XSS-Protection", "1; mode=block");

  return res;
}

export const config = {
  // Matcher: apply ke semua route kecuali static files
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes tetap dapat headers, hanya bukan Next.js internals)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, icon.svg, manifest, sw.js (public files)
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js).*)",
  ],
};

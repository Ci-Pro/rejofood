import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration untuk RejoFood Android app.
 *
 * APP INI ADALAH WEBVIEW WRAPPER — ia meload URL backend Next.js yang sudah di-deploy.
 * Backend (API routes, Prisma DB, WebSocket) berjalan di server (Vercel/dll), bukan di HP.
 *
 * CARA KONFIGURASI:
 * 1. Deploy Next.js backend ke Vercel (atau platform lain)
 * 2. Set REJOFOOD_BACKEND_URL di GitHub Secrets (untuk CI build)
 *    ATAU edit URL di bawah ini secara manual lalu rebuild
 * 3. Build APK via GitHub Actions
 *
 * Untuk testing lokal dengan emulator Android:
 *   url: 'http://10.0.2.2:3000'  (10.0.2.2 = host machine dari emulator)
 *
 * Untuk testing dengan HP real di WiFi yang sama:
 *   url: 'http://192.168.x.x:3000'  (IP LAN komputer kamu)
 */
const BACKEND_URL = process.env.REJOFOOD_BACKEND_URL || 'http://10.0.2.2:3000';

const config: CapacitorConfig = {
  appId: 'id.rejofood.app',
  appName: 'RejoFood',
  webDir: 'out',
  server: {
    url: BACKEND_URL,
    cleartext: true, // allow HTTP untuk dev/local
  },
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: true,
  },
};

export default config;

"use client";

import { useEffect } from "react";

/**
 * Register service worker on app load.
 *
 * SW handles:
 *  - Push notifications (order status updates)
 *  - Offline UI cache (HTML + static assets cached for instant load)
 *  - API calls bypass cache (always fresh)
 *
 * Di APK (Capacitor WebView), SW berjalan normal & cache UI lokal.
 * Setelah first load, APK tetap responsif meski Vercel down/lambat.
 * API calls tetap butuh koneksi internet (ke Vercel backend).
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Register SW — best effort, jangan block render
    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        // Check for updates setiap 1 jam
        setInterval(() => {
          reg.update().catch(() => {});
        }, 60 * 60 * 1000);

        // Jika SW baru menunggu aktifasi, trigger skipWaiting
        if (reg.waiting) {
          reg.waiting.postMessage("SKIP_WAITING");
        }

        // Listen untuk SW update
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // SW baru sudah di-install, ada versi lama yang aktif
              // Trigger skipWaiting untuk aktifkan versi baru
              newWorker.postMessage("SKIP_WAITING");
            }
          });
        });

        // Reload page saat SW baru aktif (untuk load fresh assets)
        let refreshing = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
      } catch (err) {
        // SW registration gagal — bukan fatal, app tetap jalan tanpa offline cache
        console.warn("[sw] registration failed:", err);
      }
    };

    // Delay sedikit agar tidak ganggu first paint
    const timer = setTimeout(register, 1500);

    return () => clearTimeout(timer);
  }, []);

  return null;
}

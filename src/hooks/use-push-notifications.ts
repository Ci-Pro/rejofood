"use client";

import { useState, useEffect, useCallback } from "react";

interface VapidConfig {
  configured: boolean;
  publicKey: string | null;
}

/**
 * Hook untuk manage PWA push notifications.
 * - Check if push is supported + configured
 * - Subscribe/unsubscribe
 * - Auto-register service worker
 */
export function usePushNotifications() {
  const [supported, setSupported] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check support + config
  useEffect(() => {
    const isSupported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    setSupported(isSupported);

    if (!isSupported) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        // Register service worker
        await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        // Check VAPID config
        const res = await fetch("/api/push/vapid-public");
        const data: VapidConfig = await res.json();
        setConfigured(data.configured);

        if (!data.configured || !data.publicKey) {
          setLoading(false);
          return;
        }

        // Check existing subscription
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const subscribe = useCallback(async () => {
    if (!supported || !configured) return false;

    try {
      const res = await fetch("/api/push/vapid-public");
      const data: VapidConfig = await res.json();
      if (!data.publicKey) return false;

      const reg = await navigator.serviceWorker.ready;

      // Convert VAPID key
      const applicationServerKey = urlBase64ToUint8Array(data.publicKey);

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as unknown as BufferSource,
      });

      // Save to server
      const saveRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub),
      });

      if (!saveRes.ok) {
        await sub.unsubscribe();
        return false;
      }

      setSubscribed(true);
      return true;
    } catch (err) {
      console.error("[push] subscribe error:", err);
      return false;
    }
  }, [supported, configured]);

  const unsubscribe = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
      }
      setSubscribed(false);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { supported, configured, subscribed, loading, subscribe, unsubscribe };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

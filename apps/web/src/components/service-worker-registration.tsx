"use client";

import { useEffect } from "react";

/**
 * Registers the small, conservative app-shell worker used by the driver PWA.
 * Sensitive API responses are intentionally not cached by the worker.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error: unknown) => {
        // A PWA capability failure must not prevent the operational app from loading.
        console.warn("Waste-Wise service worker registration failed", error);
      });
  }, []);

  return null;
}

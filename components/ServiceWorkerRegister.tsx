"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        const takeoverKey = "next-docs-sw-takeover-reloaded";

        if (
          registration.active &&
          !navigator.serviceWorker.controller &&
          !sessionStorage.getItem(takeoverKey)
        ) {
          sessionStorage.setItem(takeoverKey, "true");
          window.location.reload();
        }
      })
      .catch((error) => {
        console.warn("Service worker registration failed", error);
      });
  }, []);

  return null;
}

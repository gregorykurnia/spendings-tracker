"use client";

import { useEffect } from "react";

/** Registers `public/sw.js`, which keeps the app shell so the installed app opens with no connection. */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed:", err);
    });
  }, []);

  return null;
}

"use client";

import { useEffect } from "react";

/** Logout otomatis saat user tinggalkan dashboard (back browser, tutup tab, dll.) */
export function SessionLeaveGuard() {
  useEffect(() => {
    function endSession(event: PageTransitionEvent) {
      // persisted = halaman masuk bfcache (back/forward browser)
      if (event.persisted) {
        navigator.sendBeacon("/api/auth/logout");
        return;
      }
      navigator.sendBeacon("/api/auth/logout");
    }

    window.addEventListener("pagehide", endSession);
    return () => window.removeEventListener("pagehide", endSession);
  }, []);

  return null;
}

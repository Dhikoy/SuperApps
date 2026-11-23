"use client";

import { useEffect, useState, type ReactNode } from "react";

type AuthGateProps = {
  children: ReactNode;
};

/**
 * Blokir dashboard sampai session valid.
 * Saat back/forward (bfcache) paksa reload dari server.
 */
export function AuthGate({ children }: AuthGateProps) {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let active = true;

    async function verifySession(): Promise<boolean> {
      try {
        const res = await fetch(`/api/auth/session?_=${Date.now()}`, {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        });
        return res.ok;
      } catch {
        return false;
      }
    }

    async function enforceAuth(reloadIfCached = false) {
      const ok = await verifySession();
      if (!active) return;

      if (!ok) {
        setAuthed(false);
        window.location.replace(`/login?expired=1&_=${Date.now()}`);
        return;
      }

      const sessionRes = await fetch(`/api/auth/session?_=${Date.now()}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const sessionData = sessionRes.ok ? await sessionRes.json().catch(() => ({})) : {};
      if (sessionData.mustChangePassword && !window.location.pathname.startsWith("/dashboard/profil")) {
        window.location.replace("/dashboard/profil?changePassword=required");
        return;
      }

      if (reloadIfCached) {
        window.location.reload();
        return;
      }

      setAuthed(true);
    }

    void enforceAuth();

    function onPageShow(event: PageTransitionEvent) {
      setAuthed(false);
      if (event.persisted) {
        void enforceAuth(true);
      } else {
        void enforceAuth();
      }
    }

    function onNavigate() {
      setAuthed(false);
      void enforceAuth();
    }

    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("popstate", onNavigate);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") onNavigate();
    });

    return () => {
      active = false;
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("popstate", onNavigate);
    };
  }, []);

  if (!authed) {
    return (
      <div
        className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-app"
        aria-busy="true"
        aria-label="Memverifikasi sesi"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#503200] border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}

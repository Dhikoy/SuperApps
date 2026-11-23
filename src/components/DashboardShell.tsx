"use client";

import { NavProvider } from "./NavContext";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileNav } from "./MobileNav";
import { AntaWidget } from "./AntaWidget";
import { AuthGate } from "./AuthGate";
import { ToastProvider } from "./ToastProvider";
import type { Role } from "@/lib/roles";

type DashboardShellProps = {
  user: { id: string; name: string; userId: string; role: Role };
  children: React.ReactNode;
};

export function DashboardShell({ user, children }: DashboardShellProps) {
  return (
    <AuthGate>
      <ToastProvider>
        <NavProvider>
        <div className="flex min-h-screen min-h-[100dvh] bg-app">
          <Sidebar user={user} />
          <div className="flex flex-1 flex-col min-w-0">
            <TopBar user={user} />
            <main className="flex-1 overflow-auto safe-bottom">
              <div className="px-4 py-5 sm:px-6 lg:px-8 lg:py-8 max-w-7xl mx-auto animate-fade-in">
                {children}
              </div>
            </main>
            <MobileNav user={user} />
            <AntaWidget />
          </div>
        </div>
      </NavProvider>
      </ToastProvider>
    </AuthGate>
  );
}

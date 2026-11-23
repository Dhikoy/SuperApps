"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type NavContextValue = {
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  toggleMenu: () => void;
};

const NavContext = createContext<NavContextValue | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <NavContext.Provider
      value={{
        menuOpen,
        setMenuOpen,
        toggleMenu: () => setMenuOpen((v) => !v),
      }}
    >
      {children}
    </NavContext.Provider>
  );
}

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error("useNav must be used within NavProvider");
  return ctx;
}

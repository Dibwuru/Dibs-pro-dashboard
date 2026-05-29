"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface SidebarContextValue {
  isMobileOpen: boolean;
  openMobile: () => void;
  closeMobile: () => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  isMobileOpen: false,
  openMobile: () => {},
  closeMobile: () => {},
});

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const openMobile = () => setIsMobileOpen(true);
  const closeMobile = () => setIsMobileOpen(false);

  return (
    <SidebarContext.Provider value={{ isMobileOpen, openMobile, closeMobile }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}

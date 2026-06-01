"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface SidebarContextValue {
  isMobileOpen: boolean;
  openMobile: () => void;
  closeMobile: () => void;
  isProfileEditorOpen: boolean;
  openProfileEditor: () => void;
  closeProfileEditor: () => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  isMobileOpen: false,
  openMobile: () => {},
  closeMobile: () => {},
  isProfileEditorOpen: false,
  openProfileEditor: () => {},
  closeProfileEditor: () => {},
});

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);
  const openMobile = () => setIsMobileOpen(true);
  const closeMobile = () => setIsMobileOpen(false);
  const openProfileEditor = () => setIsProfileEditorOpen(true);
  const closeProfileEditor = () => setIsProfileEditorOpen(false);

  return (
    <SidebarContext.Provider
      value={{
        isMobileOpen,
        openMobile,
        closeMobile,
        isProfileEditorOpen,
        openProfileEditor,
        closeProfileEditor,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}

"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Lets a screen say which sidebar section it belongs to when the URL alone can't tell: Reviewing
 * (9) and Review failed (10) live on /reviews/[id] but are still part of New review, as in the
 * designs. Null means "from the URL".
 */
const NavSectionContext = createContext<{
  section: string | null;
  setSection: (href: string | null) => void;
}>({ section: null, setSection: () => {} });

export function NavSectionProvider({ children }: { children: ReactNode }) {
  const [section, setSection] = useState<string | null>(null);
  return (
    <NavSectionContext.Provider value={{ section, setSection }}>
      {children}
    </NavSectionContext.Provider>
  );
}

export function useNavSectionOverride(): string | null {
  return useContext(NavSectionContext).section;
}

/** While the calling component is shown, the sidebar highlights `href`. */
export function useNavSection(href: string): void {
  const { setSection } = useContext(NavSectionContext);
  useEffect(() => {
    setSection(href);
    return () => setSection(null);
  }, [href, setSection]);
}

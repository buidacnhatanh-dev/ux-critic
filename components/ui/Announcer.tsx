"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type Politeness = "polite" | "assertive";

type AnnouncerContextValue = { announce: (message: string, politeness?: Politeness) => void };

const AnnouncerContext = createContext<AnnouncerContextValue | null>(null);

/** Delay between clearing and setting a region, so repeating the same message is announced. */
export const ANNOUNCE_DELAY_MS = 50;

/**
 * One polite and one assertive hidden live region for the whole app (CLAUDE.md).
 * Screens announce progress and results through useAnnouncer(), never their own live regions.
 */
export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState("");
  const [assertive, setAssertive] = useState("");
  const timers = useRef<Record<Politeness, ReturnType<typeof setTimeout> | undefined>>({
    polite: undefined,
    assertive: undefined,
  });

  const announce = useCallback((message: string, politeness: Politeness = "polite") => {
    const set = politeness === "assertive" ? setAssertive : setPolite;
    clearTimeout(timers.current[politeness]);
    set("");
    timers.current[politeness] = setTimeout(() => set(message), ANNOUNCE_DELAY_MS);
  }, []);

  const value = useMemo(() => ({ announce }), [announce]);

  return (
    <AnnouncerContext.Provider value={value}>
      {children}
      <div
        className="visually-hidden"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-announcer="polite"
      >
        {polite}
      </div>
      <div
        className="visually-hidden"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        data-announcer="assertive"
      >
        {assertive}
      </div>
    </AnnouncerContext.Provider>
  );
}

export function useAnnouncer(): AnnouncerContextValue {
  const context = useContext(AnnouncerContext);
  if (!context) throw new Error("useAnnouncer must be used inside <AnnouncerProvider>");
  return context;
}

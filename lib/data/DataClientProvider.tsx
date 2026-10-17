"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { DataClient } from "./client";
import { DemoClient } from "./demo-client";
import { LiveClient } from "./live-client";
import type { Mode } from "./types";

const DataClientContext = createContext<DataClient | null>(null);

export function createDataClient(mode: Mode): DataClient {
  return mode === "live" ? new LiveClient() : new DemoClient();
}

/** The root layout reads the mode on the server and passes it here. */
export function DataClientProvider({ mode, children }: { mode: Mode; children: ReactNode }) {
  const client = useMemo(() => createDataClient(mode), [mode]);
  return <DataClientContext.Provider value={client}>{children}</DataClientContext.Provider>;
}

export function useDataClient(): DataClient {
  const client = useContext(DataClientContext);
  if (!client) throw new Error("useDataClient must be used inside <DataClientProvider>");
  return client;
}

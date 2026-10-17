"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NotFoundError } from "@/lib/data/client";

export type LoadState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "not-found" }
  | { status: "error"; message: string };

function failed<T>(error: unknown): LoadState<T> {
  if (error instanceof NotFoundError) return { status: "not-found" };
  return { status: "error", message: error instanceof Error ? error.message : String(error) };
}

/**
 * Loads data through DataClient on the client (the demo overlay lives in this browser).
 * Loads again when `key` changes. `reload` fetches again without going back to loading.
 */
export function useLoad<T>(load: () => Promise<T>, key: string) {
  const [state, setState] = useState<LoadState<T>>({ status: "loading" });
  const loadRef = useRef(load);

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    let active = true;
    loadRef.current().then(
      (data) => active && setState({ status: "ready", data }),
      (error: unknown) => active && setState(failed(error)),
    );
    return () => {
      active = false;
    };
  }, [key]);

  const reload = useCallback(async () => {
    try {
      setState({ status: "ready", data: await loadRef.current() });
    } catch (error) {
      setState(failed(error));
    }
  }, []);

  return { state, reload };
}

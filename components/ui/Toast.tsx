"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAnnouncer } from "./Announcer";
import styles from "./Toast.module.css";

export const TOAST_DURATION_MS = 8000;

export type ToastInput = {
  message: string;
  /** Optional Undo action. The toast closes after it runs. */
  onUndo?: () => void;
  undoLabel?: string;
};

type ToastItem = ToastInput & { id: number };

type ToastContextValue = { showToast: (toast: ToastInput) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

/** Toast region, bottom left. Messages are announced politely through the shared Announcer. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const { announce } = useAnnouncer();

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: ToastInput) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { ...toast, id }]);
      announce(
        toast.onUndo
          ? `${toast.message}. ${toast.undoLabel ?? "Undo"} is available.`
          : toast.message,
      );
    },
    [announce],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <section aria-label="Notifications" className={styles.region} hidden={toasts.length === 0}>
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </section>
    </ToastContext.Provider>
  );
}

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const [paused, setPaused] = useState({ hover: false, focus: false });
  const remaining = useRef(TOAST_DURATION_MS);
  const onDismissRef = useRef(onDismiss);
  const isPaused = paused.hover || paused.focus;

  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (isPaused) return;
    const started = Date.now();
    const timer = setTimeout(() => onDismissRef.current(), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - started));
    };
  }, [isPaused]);

  return (
    <div
      className={styles.toast}
      onMouseEnter={() => setPaused((p) => ({ ...p, hover: true }))}
      onMouseLeave={() => setPaused((p) => ({ ...p, hover: false }))}
      onFocus={() => setPaused((p) => ({ ...p, focus: true }))}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPaused((p) => ({ ...p, focus: false }));
        }
      }}
    >
      <p className={styles.message}>{toast.message}</p>
      {toast.onUndo ? (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            toast.onUndo?.();
            onDismiss();
          }}
        >
          {toast.undoLabel ?? "Undo"}
        </button>
      ) : null}
      <button
        type="button"
        className={styles.dismiss}
        aria-label="Dismiss notification"
        onClick={onDismiss}
      >
        <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
          <path
            d="M4 4l10 10M14 4L4 14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}

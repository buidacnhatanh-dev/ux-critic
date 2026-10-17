"use client";

import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import styles from "./Dialog.module.css";

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Buttons at the bottom, separated by a line. */
  footer?: ReactNode;
  /** Element to focus when the dialog opens. Destructive dialogs pass the safe action. */
  initialFocus?: RefObject<HTMLElement | null>;
  /** "alertdialog" for confirmations such as Delete a project. */
  role?: "dialog" | "alertdialog";
  /** Show the X button in the header. Defaults to true for dialogs, false for alert dialogs. */
  showClose?: boolean;
};

/**
 * Native <dialog> opened with showModal(): the rest of the page is inert, Escape closes,
 * focus moves in (to initialFocus when given) and returns to the opener on close.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  initialFocus,
  role = "dialog",
  showClose = role === "dialog",
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      const active = document.activeElement;
      openerRef.current = active instanceof HTMLElement ? active : null;
      dialog.showModal();
      initialFocus?.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, initialFocus]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    function handleCancel(event: Event) {
      // Escape: keep React in charge of the open state.
      event.preventDefault();
      onCloseRef.current();
    }
    function handleClose() {
      const opener = openerRef.current;
      openerRef.current = null;
      if (opener?.isConnected) opener.focus();
      if (dialog?.dataset.open === "true") onCloseRef.current();
    }
    dialog.addEventListener("cancel", handleCancel);
    dialog.addEventListener("close", handleClose);
    return () => {
      dialog.removeEventListener("cancel", handleCancel);
      dialog.removeEventListener("close", handleClose);
    };
  }, []);

  return (
    <dialog
      ref={ref}
      role={role === "alertdialog" ? "alertdialog" : undefined}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={role === "alertdialog" ? bodyId : undefined}
      className={styles.dialog}
      data-open={open ? "true" : "false"}
    >
      {open ? (
        <>
          <div className={styles.header}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {showClose ? (
              <button type="button" aria-label="Close" className={styles.close} onClick={onClose}>
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <path
                    d="M4 4l10 10M14 4L4 14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            ) : null}
          </div>
          <div id={bodyId} className={styles.body}>
            {children}
          </div>
          {footer ? <div className={styles.footer}>{footer}</div> : null}
        </>
      ) : null}
    </dialog>
  );
}

"use client";

import { cloneElement, useEffect, useId, useState, type ReactElement, type ReactNode } from "react";
import styles from "./Tooltip.module.css";

type TriggerProps = { "aria-describedby"?: string };

export type TooltipProps = {
  content: ReactNode;
  /** One focusable element, for example a Button. It gets aria-describedby. */
  children: ReactElement<TriggerProps>;
  placement?: "top" | "bottom";
};

/** Shows on hover and focus, stays while the pointer is over it, Escape hides (WCAG 1.4.13). */
export function Tooltip({ content, children, placement = "top" }: TooltipProps) {
  const id = useId();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const visible = (hovered || focused) && !dismissed;

  useEffect(() => {
    if (!visible) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDismissed(true);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [visible]);

  const existing = children.props["aria-describedby"];
  const trigger = cloneElement(children, {
    "aria-describedby": [existing, id].filter(Boolean).join(" "),
  });

  return (
    <span
      className={styles.wrapper}
      onMouseEnter={() => {
        setDismissed(false);
        setHovered(true);
      }}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => {
        setDismissed(false);
        setFocused(true);
      }}
      onBlur={() => setFocused(false)}
    >
      {trigger}
      <span
        id={id}
        role="tooltip"
        className={styles.tooltip}
        data-placement={placement}
        hidden={!visible}
      >
        {content}
      </span>
    </span>
  );
}

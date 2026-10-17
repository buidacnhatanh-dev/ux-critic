"use client";

import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, MouseEvent, ReactNode, Ref } from "react";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "danger" | "text";

type CommonProps = {
  variant?: ButtonVariant;
  /** Text variant only: red text for destructive actions such as "Delete rule". */
  destructive?: boolean;
  icon?: ReactNode;
  children: ReactNode;
};

export type ButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> & {
    /** Uses aria-disabled so the button stays focusable and discoverable (docs/01). */
    disabled?: boolean;
    ref?: Ref<HTMLButtonElement>;
  };

export function buttonClassName(
  variant: ButtonVariant = "primary",
  destructive = false,
  extra?: string,
): string {
  return [styles.button, styles[variant], destructive && styles.destructive, extra]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  variant = "primary",
  destructive = false,
  icon,
  children,
  disabled = false,
  type = "button",
  className,
  onClick,
  ref,
  ...rest
}: ButtonProps) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (disabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      aria-disabled={disabled || undefined}
      className={buttonClassName(variant, destructive, className)}
      onClick={handleClick}
    >
      {icon ? (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}

export type ButtonLinkProps = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string };

/** A link that looks like a button, for navigation such as "New review". */
export function ButtonLink({
  variant = "primary",
  destructive = false,
  icon,
  children,
  className,
  href,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link {...rest} href={href} className={buttonClassName(variant, destructive, className)}>
      {icon ? (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </Link>
  );
}

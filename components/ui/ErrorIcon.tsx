/** The round "!" icon used next to every error message in the designs. */
export function ErrorIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <path d="M8 4.5v4.5" stroke="var(--color-on-dark)" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="8" cy="11.5" r="1" fill="var(--color-on-dark)" />
    </svg>
  );
}

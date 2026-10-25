import type { ReactNode } from "react";

// One 24px outline set (1.9px stroke, round caps), the design's own. Add new icons here only.
const PATHS = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </>
  ),
  menu: <path d="M4 8h16M4 16h16" />,
  right: <path d="M9 6l6 6-6 6" />,
  left: <path d="M15 6l-6 6 6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
  up: <path d="M6 15l6-6 6 6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  chart: <path d="M6 20v-7M12 20V5M18 20v-10" />,
  list: <path d="M9 7h11M9 12h11M9 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01" />,
  grid: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.8" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8" />
    </>
  ),
  repeat: <path d="M17 3l3 3-3 3M20 6H9a5 5 0 0 0-5 5M7 21l-3-3 3-3M4 18h11a5 5 0 0 0 5-5" />,
  in: <path d="M17 7L7 17M7 9v8h8" />,
  // Money moving between the owner's own accounts: two opposite arrows. Provisional, see gap G5.
  transfer: <path d="M4 8h13M14 5l3 3-3 3M20 16H7M10 13l-3 3 3 3" />,
  alert: (
    <>
      <path d="M12 4.2l9 15.6H3z" />
      <path d="M12 10v4.2M12 17.3h.01" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.4 6.4a1.5 1.5 0 0 1-2.1 0z" />
      <path d="M8 8h.01" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 2.8 0l.2.2a2 2 0 0 1 0 2.8L8 19z" />
      <path d="M14.5 6.5l3 3" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="14" rx="3" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </>
  ),
  image: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="3" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M5 17.5l4.2-4.2 3 3 2.8-2.8 4 4" />
    </>
  ),
  dash: <path d="M7 12h10" />,
  trash: <path d="M5 7h14M10 7V4.5h4V7M7 7l.8 12.5h8.4L17 7M10.5 11v5M13.5 11v5" />,
  sliders: (
    <>
      <path d="M4 8h9M17 8h3M4 16h3M11 16h9" />
      <circle cx="15" cy="8" r="2" />
      <circle cx="9" cy="16" r="2" />
    </>
  ),
  lower: <path d="M7 7l10 10M17 8.5V17H8.5" />,
  higher: <path d="M7 17L17 7M8.5 7H17v8.5" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

/** A decorative icon: it sits next to words, so it is hidden from screen readers. */
export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      {PATHS[name]}
    </svg>
  );
}

/** The bookmark mark. A working name and a proposal; branding is still open. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden="true" focusable="false" className="shrink-0">
      <rect width="30" height="30" rx="8" style={{ fill: "var(--petrol)" }} />
      <path d="M19 0v15.5l-3.5-3-3.5 3V0z" style={{ fill: "var(--lemon)" }} />
    </svg>
  );
}

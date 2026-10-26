/** What the screen shows, from `window.visualViewport`, and the page's own viewport height. */
export type ViewportReading = {
  innerHeight: number;
  offsetTop: number;
  height: number;
  scale: number;
  /** A text field has focus: the keyboard is (or is about to be) up. */
  typing: boolean;
};

/**
 * How far the fixed layers (sheets, the accept bar, the status bar cover) must move in from the page's
 * top and bottom edges to sit on what the screen shows. iOS can leave the page shifted after the
 * keyboard closes (or report a short page in an installed app), which floats `bottom: 0` mid-screen.
 * Zero while typing, where iOS's own handling is right, and while zoomed, where fixed layers stay put.
 */
export function viewportInsets(reading: ViewportReading): { top: number; bottom: number } {
  const { innerHeight, offsetTop, height, scale, typing } = reading;
  if (typing || Math.abs(scale - 1) > 0.01) return { top: 0, bottom: 0 };
  const top = Math.round(offsetTop);
  const bottom = Math.round(innerHeight - offsetTop - height);
  // A pixel or two is rounding, not a shift.
  return { top: Math.abs(top) < 2 ? 0 : top, bottom: Math.abs(bottom) < 2 ? 0 : bottom };
}

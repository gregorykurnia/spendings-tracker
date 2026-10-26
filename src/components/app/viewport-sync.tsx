"use client";

import { useEffect } from "react";
import { viewportInsets } from "@/lib/viewport";

function isTextField(el: Element | null) {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  return el instanceof HTMLInputElement && !["button", "checkbox", "radio", "range", "submit", "file"].includes(el.type);
}

/**
 * Keeps `--vv-top` and `--vv-bottom` on <html> in step with what the screen shows, so the fixed layers
 * (sheets, the accept bar, the status bar cover) sit on the screen's real edges. See `viewportInsets`.
 */
export default function ViewportSync() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement.style;
    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const { top, bottom } = viewportInsets({
          innerHeight: window.innerHeight,
          offsetTop: vv.offsetTop,
          height: vv.height,
          scale: vv.scale,
          typing: isTextField(document.activeElement),
        });
        root.setProperty("--vv-top", `${top}px`);
        root.setProperty("--vv-bottom", `${bottom}px`);
      });
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("pageshow", sync);
    document.addEventListener("focusin", sync);
    document.addEventListener("focusout", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("pageshow", sync);
      document.removeEventListener("focusin", sync);
      document.removeEventListener("focusout", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return null;
}

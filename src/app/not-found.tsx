"use client";

import Link from "next/link";
import { NoticeScreen } from "@/components/app/boot-states";
import { buttonClass } from "@/components/ui/button";

/**
 * An address that doesn't exist: no screen to keep, so no bar, and one way out, home. This is a client
 * component because `buttonClass` comes from a client module.
 */
export default function NotFound() {
  return (
    <NoticeScreen
      icon="search"
      heading="Nothing at this address"
      actions={
        <Link href="/" className={buttonClass({ variant: "solid", size: "big" })}>
          Back to home
        </Link>
      }
    >
      The link may be old or mistyped.
    </NoticeScreen>
  );
}

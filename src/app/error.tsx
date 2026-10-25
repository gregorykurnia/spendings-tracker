"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { AppBar, SubBar } from "@/components/app/app-bar";
import { NoticeScreen } from "@/components/app/boot-states";
import { Button, buttonClass } from "@/components/ui/button";
import { screenFor } from "@/lib/boot";

/**
 * An unexpected error on a screen. It keeps the screen's own bar and says what is safe. The error's own
 * text stays off the screen and goes to the console.
 */
export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const screen = screenFor(usePathname());

  useEffect(() => {
    console.error(error);
    // The failed control goes away with the error, so the keyboard focus moves to the new screen.
    document.getElementById("main")?.focus();
  }, [error]);

  return (
    <NoticeScreen
      bar={screen === "home" ? <AppBar /> : <SubBar />}
      heading="Something went wrong"
      actions={
        <>
          <Button variant="solid" size="big" onClick={() => unstable_retry()}>
            Try again
          </Button>
          <Link href="/" className={buttonClass({ variant: "quiet" })}>
            Back to home
          </Link>
        </>
      }
    >
      What you saved is safe. Try again in a moment.
    </NoticeScreen>
  );
}

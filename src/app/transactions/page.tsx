import { Suspense } from "react";
import { FindScreen } from "@/components/find/find-screen";

export default function Transactions() {
  // The screen reads the address (Spending sends a category and a period); the app's gate already
  // shows the loading screen, so there is nothing to show while this waits.
  return (
    <Suspense fallback={null}>
      <FindScreen />
    </Suspense>
  );
}

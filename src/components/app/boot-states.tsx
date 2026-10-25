import { Button } from "@/components/ui/button";
import { Icon, Logo } from "@/components/ui/icon";
import { swatchTint } from "@/lib/swatches";
import { SEED_CATEGORIES } from "@/lib/seedCategories";
import type { LoadTarget, ScreenName } from "@/lib/boot";
import { AppBar, SubBar } from "./app-bar";
import styles from "./boot-states.module.css";
import { ScreenSkeleton } from "./screen-skeletons";

/** The first open ever: the starter categories going in, one tile each. */
export function BootSetup({ done, total }: { done: number; total: number }) {
  const shown = Math.min(done, total);
  return (
    <main id="main" className={styles.boot} tabIndex={-1}>
      <Logo size={56} />
      <h1>Setting up</h1>
      <p>Adding your starter categories. This takes a moment.</p>
      <div className={styles.tiles} aria-hidden="true">
        {Array.from({ length: total }, (_, i) => {
          const category = SEED_CATEGORIES[i];
          return i < shown && category ? (
            <span key={i} className={`${styles.tile} ${styles.tileOn}`} style={{ background: swatchTint(category.color) }}>
              {category.emoji}
            </span>
          ) : (
            <span key={i} className={styles.tile} />
          );
        })}
      </div>
      <div
        className={styles.progress}
        role="progressbar"
        aria-label="Adding categories"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={shown}
      >
        <i style={{ width: `${total ? Math.round((shown / total) * 100) : 0}%` }} />
      </div>
      <p className={styles.count}>
        {shown} of {total}
      </p>
    </main>
  );
}

/** The same layout as the screen, in grey. */
export function BootLoading({ screen }: { screen: ScreenName }) {
  return <ScreenSkeleton screen={screen} />;
}

function RetryButton({ retrying, onRetry }: { retrying?: boolean; onRetry: () => void }) {
  return (
    <Button variant="solid" size="big" className={styles.retry} busy={retrying} busyLabel="Trying again…" onClick={onRetry}>
      Try again
    </Button>
  );
}

/** Loading went wrong: no raw error text, what happened and what to do. Keeps the screen's own bar. */
export function BootFailed({
  screen,
  what,
  retrying,
  onRetry,
}: {
  screen: ScreenName;
  what: LoadTarget;
  retrying?: boolean;
  onRetry: () => void;
}) {
  return (
    <>
      {screen === "home" ? <AppBar /> : <SubBar />}
      <main id="main" className={styles.failed} tabIndex={-1}>
        <span className={styles.mark}>
          <Icon name="alert" size={28} />
        </span>
        <h1>Couldn’t load your {what}</h1>
        <p>Something went wrong while loading. Try again in a moment.</p>
        <RetryButton retrying={retrying} onRetry={onRetry} />
      </main>
    </>
  );
}

/** Opened with no connection: nothing can load. `note` is what the last try found. */
export function BootOffline({
  retrying,
  note,
  onRetry,
}: {
  retrying?: boolean;
  note?: string;
  onRetry: () => void;
}) {
  return (
    <main id="main" className={styles.boot} tabIndex={-1}>
      <Logo size={56} />
      <h1>No connection</h1>
      <p>Daybook needs the internet to load your spending. Check your connection, then try again.</p>
      <RetryButton retrying={retrying} onRetry={onRetry} />
      {note && !retrying ? (
        <p className={styles.note} role="status">
          {note}
        </p>
      ) : null}
    </main>
  );
}

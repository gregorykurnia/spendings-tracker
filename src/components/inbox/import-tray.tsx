"use client";

import { Button, Spinner } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/icon";
import styles from "./tray.module.css";
import { shotDetail, shotState, trayHeading } from "./tray";
import type { TrayShot } from "./use-import-tray";

type Props = {
  shots: readonly TrayShot[];
  onRetry: (n: number) => void;
  onDismiss: (n: number) => void;
  onTypeIn: () => void;
};

function Mark({ status }: { status: TrayShot["status"] }) {
  if (status === "reading") return <Spinner />;
  if (status === "ok") return <Icon name="check" />;
  if (status === "fail") return <Icon name="alert" />;
  return <Icon name="dash" />;
}

function Row({ shot, onRetry, onDismiss, onTypeIn }: { shot: TrayShot } & Omit<Props, "shots">) {
  const { n, status } = shot;
  const stuck = status === "fail" || status === "empty";
  return (
    <li className={cx(styles.shot, styles[status])}>
      {shot.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local file's object URL, not something to optimise
        <img className={styles.thumb} src={shot.url} alt="" />
      ) : (
        <span className={styles.thumb} aria-hidden="true" />
      )}
      <div className={styles.body}>
        <p className={styles.name}>Screenshot {n}</p>
        <p className={styles.state}>{shotState(shot)}</p>
        {status === "reading" ? (
          <div className={styles.bar} role="progressbar" aria-label={`Reading screenshot ${n}`} />
        ) : null}
      </div>
      <span className={styles.icon}>
        <Mark status={status} />
      </span>
      {stuck ? (
        <>
          <div className={styles.extra}>
            <p className={styles.detail}>{shotDetail(status)}</p>
          </div>
          <div className={styles.acts}>
            {status === "fail" ? (
              <Button variant="solid" writes onClick={() => onRetry(n)}>
                Try again
              </Button>
            ) : null}
            <Button onClick={onTypeIn}>Type in a spend</Button>
            <Button variant="quiet" onClick={() => onDismiss(n)}>
              Dismiss
            </Button>
          </div>
        </>
      ) : null}
    </li>
  );
}

/** The tray at the top of the inbox: how reading is going, and one row per screenshot. */
export function ImportTray({ shots, onRetry, onDismiss, onTypeIn }: Props) {
  const { title, sub } = trayHeading(shots);
  return (
    <section className={styles.tray} aria-labelledby="tray-title">
      <h2 id="tray-title">{title}</h2>
      <p className={styles.sub}>{sub}</p>
      <ul className={styles.shots}>
        {shots.map((shot) => (
          <Row key={shot.n} shot={shot} onRetry={onRetry} onDismiss={onDismiss} onTypeIn={onTypeIn} />
        ))}
      </ul>
    </section>
  );
}

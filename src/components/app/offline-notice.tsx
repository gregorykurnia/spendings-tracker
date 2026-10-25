"use client";

import { useOnline } from "@/hooks/useOnline";
import { Icon } from "@/components/ui/icon";
import styles from "./offline-notice.module.css";

/** Under the bar on every screen while there is no connection: you can look, nothing is written. */
export default function OfflineNotice() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className={styles.offline} role="status">
      <Icon name="alert" size={20} />
      <p>
        <b>No connection.</b> You can look around. Adding, saving, deleting and importing wait until you
        are online.
      </p>
    </div>
  );
}

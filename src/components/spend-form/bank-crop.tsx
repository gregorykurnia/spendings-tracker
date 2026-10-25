import { formatDayYear } from "@/lib/dates";
import { formatBankAmount } from "@/lib/money";
import type { Transaction } from "@/types";
import styles from "./bank-crop.module.css";

/**
 * "From the screenshot": the line as the bank printed it, to check a misread amount, date or name
 * against. A line without a stored `bankLine` (or with no amount text) shows its own values.
 */
export function BankCrop({ line }: { line: Transaction }) {
  const bank = line.bankLine;
  const store = bank?.store || line.store;
  const date = bank?.date || line.date;
  const amount =
    bank?.amountText ||
    (line.amount != null ? formatBankAmount(line.amount, line.direction) : "Not read");
  return (
    <figure className={styles.crop}>
      <figcaption>From the screenshot</figcaption>
      <div className={styles.row}>
        <div>
          <p>{store || "No store name"}</p>
          <small>{date ? formatDayYear(date) : "No date"}</small>
        </div>
        <b>{amount}</b>
      </div>
    </figure>
  );
}

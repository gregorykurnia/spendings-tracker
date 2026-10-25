import { Sk, SkRows } from "@/components/ui/skeleton";
import type { ScreenName } from "@/lib/boot";
import { AppBar, SubBar } from "./app-bar";
import styles from "./screen-skeletons.module.css";

// The four screens in grey, each with its own bar and the same columns as the real screen, so
// nothing jumps when the data arrives. The measurements follow the prototype's loading states.

function Home() {
  return (
    <>
      <AppBar />
      <main id="main" className={styles.home} tabIndex={-1} aria-busy="true">
        <p className="sr-only" role="status">
          Loading your transactions
        </p>
        <div className={styles.glance} aria-hidden="true">
          <Sk shape="short" />
          <Sk shape="amount" />
          <Sk shape="block" />
        </div>
        <section className={styles.inbox}>
          <div className={styles.head} aria-hidden="true">
            <div>
              <Sk shape="title" />
              <Sk shape="short" className={styles.gap} />
            </div>
            <Sk shape="button" />
          </div>
          <SkRows count={5} />
        </section>
      </main>
    </>
  );
}

function Spending() {
  return (
    <>
      <SubBar />
      <main id="main" className={styles.sp} tabIndex={-1} aria-busy="true">
        <p className="sr-only" role="status">
          Loading your spending
        </p>
        <div className={styles.spTop} aria-hidden="true">
          <div className={styles.spHead}>
            <Sk shape="title" />
            <Sk shape="segment" />
          </div>
          <div className={styles.pnav}>
            <Sk shape="circle" />
            <Sk shape="mid" />
            <Sk shape="circle" />
          </div>
        </div>
        <div className={styles.spLeft}>
          <section className={styles.hero} aria-hidden="true">
            <Sk shape="short" />
            <Sk shape="amount" />
            <Sk shape="block" />
          </section>
        </div>
        <div className={styles.spRight}>
          <section className={styles.cats} aria-hidden="true">
            <Sk shape="short" />
            <SkRows count={5} className={styles.catRows} />
          </section>
        </div>
      </main>
    </>
  );
}

function Transactions() {
  return (
    <>
      <SubBar />
      <main id="main" className={styles.list} tabIndex={-1} aria-busy="true">
        <p className="sr-only" role="status">
          Loading your transactions
        </p>
        <div aria-hidden="true">
          <Sk shape="title" />
          <Sk shape="search" />
          <div className={styles.controls}>
            <Sk shape="button" />
            <Sk shape="buttonWide" />
          </div>
        </div>
        <SkRows count={7} />
      </main>
    </>
  );
}

function Categories() {
  return (
    <>
      <SubBar />
      <main id="main" className={styles.org} tabIndex={-1} aria-busy="true">
        <p className="sr-only" role="status">
          Loading your categories
        </p>
        <div className={styles.orgHead} aria-hidden="true">
          <div>
            <Sk shape="title" />
            <Sk shape="short" className={styles.gap} />
          </div>
          <Sk shape="button" />
        </div>
        <SkRows count={8} />
      </main>
    </>
  );
}

/** The grey stand-in for a screen while its data loads. */
export function ScreenSkeleton({ screen }: { screen: ScreenName }) {
  if (screen === "spending") return <Spending />;
  if (screen === "transactions") return <Transactions />;
  if (screen === "categories") return <Categories />;
  return <Home />;
}

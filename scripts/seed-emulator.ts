// Loads test data into the local Firestore emulator (never anywhere else:
// it only talks to the emulator address in scripts/test-env.ts).
//
//   npm run seed:emulator                 normal set
//   npm run seed:emulator -- --stress     stress set
//   npm run seed:emulator -- --today=2026-10-25
//
// The emulator must already be running (`npx firebase emulators:start
// --only firestore --project demo-spendings`). Seeding replaces everything
// in it. Data is the same on every run for the same "today".

import { SEED_CATEGORIES } from "../src/lib/seedCategories";
import {
  clearEmulator,
  emulatorIsUp,
  writeDocs,
  type EmulatorDoc,
} from "./test-env";

export type SeedSet = "normal" | "stress";

type Spend = {
  store: string;
  description: string;
  category: string;
  min: number;
  max: number;
};

const SPENDS: Spend[] = [
  { store: "Kopi Kenangan", description: "", category: "food-drink", min: 25_000, max: 60_000 },
  { store: "Warung Bu Sri", description: "Lunch", category: "food-drink", min: 20_000, max: 45_000 },
  { store: "Superindo", description: "", category: "groceries", min: 120_000, max: 650_000 },
  { store: "Gojek", description: "GoRide", category: "transport", min: 12_000, max: 55_000 },
  { store: "Pertamina", description: "Fuel", category: "transport", min: 150_000, max: 400_000 },
  { store: "PLN Token", description: "Electricity", category: "home-utilities", min: 200_000, max: 500_000 },
  { store: "Kimia Farma", description: "", category: "health", min: 35_000, max: 250_000 },
  { store: "Tokopedia", description: "", category: "shopping", min: 80_000, max: 900_000 },
  { store: "CGV", description: "Movie night", category: "entertainment", min: 50_000, max: 150_000 },
  { store: "GBI Church", description: "Offering", category: "church-giving", min: 100_000, max: 500_000 },
  { store: "Netflix", description: "Monthly", category: "subscriptions", min: 186_000, max: 186_000 },
  { store: "Telkomsel", description: "Data package", category: "telecommunications", min: 100_000, max: 150_000 },
];

// Long names and large amounts, for layouts that have to hold up.
const STRESS_SPENDS: Spend[] = [
  { store: "PT Sinar Mas Multiartha Tbk Cabang Jakarta Selatan Kemang Raya", description: "Quarterly premium for the family health and life insurance policy", category: "investments", min: 15_000_000, max: 1_250_000_000 },
  { store: "Bandara Internasional Soekarno-Hatta Terminal 3 Parking", description: "", category: "travel", min: 85_000, max: 2_400_000 },
  { store: "Sekolah Pelita Harapan", description: "Term fees", category: "education", min: 25_000_000, max: 95_000_000 },
];

const WAITING: Omit<Spend, "min" | "max">[] = [
  { store: "Indomaret", description: "", category: "groceries" },
  { store: "Grab", description: "GrabCar", category: "transport" },
  { store: "Transfer to Andi", description: "Dinner split", category: "other" },
];

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Small seeded random generator so every run produces the same data.
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function daysBefore(today: string, days: number) {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return isoDate(d);
}

export function buildSeed(set: SeedSet, today: string) {
  const rand = random(set === "normal" ? 1 : 2);
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];
  const amountFor = (s: Spend) =>
    Math.round((s.min + rand() * (s.max - s.min)) / 500) * 500;

  const categories: EmulatorDoc[] = SEED_CATEGORIES.map((c) => ({
    id: slug(c.name),
    data: { ...c },
  }));
  if (set === "stress") {
    categories.push({
      id: "kids-school-fees",
      data: {
        name: "Kids' school fees, uniforms and after-school activities",
        emoji: "🎒",
        color: "#a855f7",
        order: categories.length,
      },
    });
  }

  const spendCount = set === "normal" ? 60 : 507;
  const spanDays = set === "normal" ? 70 : 400;
  const pool = set === "normal" ? SPENDS : [...SPENDS, ...STRESS_SPENDS];
  const createdAt = `${today}T08:00:00.000Z`;

  const transactions: EmulatorDoc[] = [];
  for (let i = 0; i < spendCount; i++) {
    const s = pick(pool);
    transactions.push({
      id: `spend-${String(i).padStart(4, "0")}`,
      data: {
        amount: amountFor(s),
        store: s.store,
        description: s.description,
        categoryId: s.category,
        date: daysBefore(today, Math.floor(rand() * spanDays)),
        source: rand() < 0.7 ? "ocr" : "manual",
        status: "confirmed",
        createdAt,
      },
    });
  }

  const waitingCount = set === "normal" ? WAITING.length : 12;
  for (let i = 0; i < waitingCount; i++) {
    const w = WAITING[i % WAITING.length];
    const long = set === "stress" && i % 4 === 3;
    transactions.push({
      id: `waiting-${String(i).padStart(2, "0")}`,
      data: {
        amount: long ? 987_654_321 : 15_000 + i * 7_500,
        store: long ? STRESS_SPENDS[0].store : w.store,
        description: long ? STRESS_SPENDS[0].description : w.description,
        categoryId: w.category,
        date: daysBefore(today, i % 3),
        source: "ocr",
        status: "pending_review",
        createdAt,
      },
    });
  }

  // The app's first-open seeding checks these, so it leaves seeded data alone.
  const meta: EmulatorDoc[] = [
    { id: "categoriesSeeded", data: { seededAt: createdAt } },
    { id: "telecommunicationsCategorySeeded", data: { seededAt: createdAt } },
  ];

  return { categories, transactions, meta };
}

export async function seedEmulator(
  set: SeedSet = "normal",
  today: string = isoDate(new Date())
) {
  if (!(await emulatorIsUp())) {
    throw new Error(
      "The Firestore emulator isn't running on 127.0.0.1:8181. Start it with: npx firebase emulators:start --only firestore --project demo-spendings"
    );
  }
  const data = buildSeed(set, today);
  await clearEmulator();
  await writeDocs("meta", data.meta);
  await writeDocs("categories", data.categories);
  await writeDocs("transactions", data.transactions);
  return {
    categories: data.categories.length,
    transactions: data.transactions.length,
  };
}

if (/seed-emulator\.ts$/.test(process.argv[1] ?? "")) {
  const args = process.argv.slice(2);
  const set: SeedSet = args.includes("--stress") ? "stress" : "normal";
  const today = args.find((a) => a.startsWith("--today="))?.slice(8);
  seedEmulator(set, today)
    .then((counts) => {
      console.log(
        `Seeded the ${set} set: ${counts.categories} categories, ${counts.transactions} transactions.`
      );
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}

// One home for the settings every test run uses: fake Firebase values, a
// "demo-" project (Firebase can never resolve it to a real project) and the
// local Firestore emulator. The e2e runner, the emulator tests and the seed
// script all read from here.

export const TEST_PROJECT_ID = "demo-spendings";
export const EMULATOR_HOST = "127.0.0.1";
export const EMULATOR_PORT = 8181;
export const APP_PORT = 3100;
export const TEST_DIST_DIR = ".next-test";

export const TEST_ENV: Record<string, string> = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "fake-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${TEST_PROJECT_ID}.firebaseapp.com`,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: TEST_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: `${TEST_PROJECT_ID}.appspot.com`,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "000000000000",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:000000000000:web:0000000000000000",
  NEXT_PUBLIC_FIRESTORE_EMULATOR: `${EMULATOR_HOST}:${EMULATOR_PORT}`,
  // Specs answer /api/ocr themselves; a fake key makes any call that slips
  // through fail instead of reaching the Claude API.
  ANTHROPIC_API_KEY: "fake-key-tests-never-call-claude",
};

const EMULATOR_URL = `http://${EMULATOR_HOST}:${EMULATOR_PORT}`;
const DOCUMENTS_PATH = `projects/${TEST_PROJECT_ID}/databases/(default)/documents`;
// The emulator treats this token as an admin, so rules never get in the way.
const ADMIN_HEADERS = {
  Authorization: "Bearer owner",
  "Content-Type": "application/json",
};

export async function emulatorIsUp(): Promise<boolean> {
  try {
    const res = await fetch(`${EMULATOR_URL}/`);
    return res.ok;
  } catch {
    return false;
  }
}

/** Deletes every document in the emulator's database. */
export async function clearEmulator(): Promise<void> {
  const res = await fetch(`${EMULATOR_URL}/emulator/v1/${DOCUMENTS_PATH}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Clearing the emulator failed: ${res.status}`);
}

type FieldValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: FieldValue };
export type EmulatorDoc = { id: string; data: Record<string, FieldValue> };

function encode(value: FieldValue): Record<string, unknown> {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([k, v]) => [k, encode(v)])
        ),
      },
    };
  }
  return Number.isInteger(value)
    ? { integerValue: String(value) }
    : { doubleValue: value };
}

function decode(value: Record<string, unknown>): FieldValue {
  if ("stringValue" in value) return value.stringValue as string;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue as number;
  if ("booleanValue" in value) return value.booleanValue as boolean;
  if ("mapValue" in value) {
    const fields =
      (value.mapValue as { fields?: Record<string, Record<string, unknown>> })
        .fields ?? {};
    return Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, decode(v)])
    );
  }
  return null;
}

/** Writes documents in commits of at most 450 writes. */
export async function writeDocs(
  collection: string,
  docs: EmulatorDoc[]
): Promise<void> {
  for (let i = 0; i < docs.length; i += 450) {
    const writes = docs.slice(i, i + 450).map((d) => ({
      update: {
        name: `${DOCUMENTS_PATH}/${collection}/${d.id}`,
        fields: Object.fromEntries(
          Object.entries(d.data).map(([k, v]) => [k, encode(v)])
        ),
      },
    }));
    const res = await fetch(`${EMULATOR_URL}/v1/${DOCUMENTS_PATH}:commit`, {
      method: "POST",
      headers: ADMIN_HEADERS,
      body: JSON.stringify({ writes }),
    });
    if (!res.ok) {
      throw new Error(`Writing ${collection} failed: ${res.status} ${await res.text()}`);
    }
  }
}

/** Reads every document of one collection straight from the emulator. */
export async function listDocs(collection: string): Promise<EmulatorDoc[]> {
  const docs: EmulatorDoc[] = [];
  let pageToken = "";
  do {
    const url = new URL(`${EMULATOR_URL}/v1/${DOCUMENTS_PATH}/${collection}`);
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url, { headers: ADMIN_HEADERS });
    if (!res.ok) throw new Error(`Reading ${collection} failed: ${res.status}`);
    const body = (await res.json()) as {
      documents?: { name: string; fields?: Record<string, Record<string, unknown>> }[];
      nextPageToken?: string;
    };
    for (const d of body.documents ?? []) {
      docs.push({
        id: d.name.split("/").pop()!,
        data: Object.fromEntries(
          Object.entries(d.fields ?? {}).map(([k, v]) => [k, decode(v)])
        ),
      });
    }
    pageToken = body.nextPageToken ?? "";
  } while (pageToken);
  return docs;
}

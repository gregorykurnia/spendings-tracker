import { initializeApp, getApps, getApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Tests and local builds point at the Firestore emulator through
// NEXT_PUBLIC_FIRESTORE_EMULATOR ("host:port"). The emulator is only ever
// paired with a "demo-" project ID, which Firebase can never resolve to a
// real project, so a test can't reach live data even if the emulator is
// down. Any other mix is refused before a connection is made.
export function emulatorTarget(
  projectId: string | undefined,
  emulator: string | undefined
): { host: string; port: number } | null {
  const isDemo = projectId?.startsWith("demo-") ?? false;
  if (!emulator) {
    if (isDemo) {
      throw new Error(
        `Firebase project "${projectId}" is a demo project but NEXT_PUBLIC_FIRESTORE_EMULATOR is not set`
      );
    }
    return null;
  }
  if (!isDemo) {
    throw new Error(
      `NEXT_PUBLIC_FIRESTORE_EMULATOR is set, so the Firebase project ID must start with "demo-" (got "${projectId ?? ""}")`
    );
  }
  const match = /^([^:]+):(\d+)$/.exec(emulator);
  if (!match) {
    throw new Error(
      `NEXT_PUBLIC_FIRESTORE_EMULATOR must look like host:port (got "${emulator}")`
    );
  }
  return { host: match[1], port: Number(match[2]) };
}

const target = emulatorTarget(
  firebaseConfig.projectId,
  process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR
);

const isNewApp = getApps().length === 0;
const app = isNewApp ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);

if (target && isNewApp) {
  connectFirestoreEmulator(db, target.host, target.port);
}

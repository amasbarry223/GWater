import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { requireEnv } from './http.js';

let app: App | undefined;

/**
 * Initialise Firebase Admin à partir de FIREBASE_SERVICE_ACCOUNT
 * (JSON du compte de service, brut ou encodé en base64).
 */
function getApp(): App {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0]!;
    return app;
  }
  const raw = requireEnv('FIREBASE_SERVICE_ACCOUNT').trim();
  const jsonStr = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  const sa = JSON.parse(jsonStr);
  app = initializeApp({ credential: cert(sa), projectId: sa.project_id });
  return app;
}

export function db(): Firestore {
  return getFirestore(getApp());
}

export function adminAuth(): Auth {
  return getAuth(getApp());
}

/** Convertit Timestamp / Date / string / nombre en Date (ou null). */
export function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof (v as { toDate?: unknown }).toDate === 'function') return (v as { toDate: () => Date }).toDate();
  const d = new Date(v as string | number);
  return isNaN(d.getTime()) ? null : d;
}


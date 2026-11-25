import {
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  Timestamp
} from 'firebase/firestore';

/** Convertit récursivement les Timestamps Firestore en objets Date JS */
export function normalizeTimestamps<T>(input: any): T {
  if (input === null || input === undefined) return input;
  if (input instanceof Timestamp) return input.toDate() as unknown as T;
  if (typeof input?.toDate === 'function') return input.toDate() as T;
  if (Array.isArray(input)) return input.map(v => normalizeTimestamps(v)) as unknown as T;
  if (typeof input === 'object' && !(input instanceof Date)) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(input)) {
      out[k] = normalizeTimestamps(v);
    }
    return out as T;
  }
  return input as T;
}

/** Supprime les clés undefined (Firestore rejette undefined lors des écritures) */
export function stripUndefined(obj: Record<string, any>): DocumentData {
  const clean: DocumentData = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) clean[k] = v;
  }
  return clean;
}

/** Crée un FirestoreDataConverter générique typé avec id + normalisation Date */
export function createConverter<T extends { id?: string }>(): FirestoreDataConverter<T> {
  return {
    toFirestore(modelObject: T): DocumentData {
      const { id, ...rest } = modelObject as any;
      return stripUndefined(rest);
    },
    fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): T {
      const data = snapshot.data(options);
      return {
        id: snapshot.id,
        ...normalizeTimestamps<Omit<T, 'id'>>(data),
      } as T;
    }
  };
}

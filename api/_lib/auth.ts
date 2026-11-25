import { adminAuth, db } from './firebase-admin.js';
import { HttpError } from './http.js';

export type Role = 'superadmin' | 'admin' | 'vendeur' | 'comptable';

export interface ApiUser {
  uid: string;
  role: Role;
  nom: string;
}

/**
 * Vérifie l'ID token Firebase (en-tête Authorization: Bearer …) puis le profil users/{uid}
 * (même logique que firestore.rules : statut actif, rôle du document ou du custom claim).
 */
export async function requireUser(request: Request, roles?: Role[]): Promise<ApiUser> {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new HttpError(401, 'Authentification requise');

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(token);
  } catch {
    throw new HttpError(401, 'Session expirée, reconnectez-vous');
  }

  const snap = await db().doc(`users/${decoded.uid}`).get();
  let role: Role | undefined;
  let nom = decoded.name || decoded.email || 'Utilisateur';
  if (snap.exists) {
    const d = snap.data()!;
    const statut = d['status'] || d['statut'] || 'actif';
    if (statut !== 'actif') throw new HttpError(403, 'Compte désactivé');
    role = d['role'];
    nom = d['displayName'] || d['nom'] || nom;
  } else {
    role = decoded['role'] as Role | undefined;
  }
  if (!role) throw new HttpError(403, 'Aucun rôle attribué');
  if (roles && !roles.includes(role)) throw new HttpError(403, 'Action non autorisée pour votre rôle');
  return { uid: decoded.uid, role, nom };
}

export function isAdminRole(role: Role): boolean {
  return role === 'admin' || role === 'superadmin';
}


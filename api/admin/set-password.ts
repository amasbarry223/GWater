import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, db } from '../_lib/firebase-admin.js';
import { requireUser } from '../_lib/auth.js';
import { handler, json, readJson, HttpError } from '../_lib/http.js';

/**
 * POST /api/admin/set-password
 * Body : { targetUid: string, newPassword: string, mustChangePassword?: boolean }
 * Permet à un Super Admin de réinitialiser le mot de passe de tout utilisateur (y compris Admin/Super Admin),
 * et à un Admin de réinitialiser celui d'un Vendeur/Comptable (ou le sien).
 */
export const POST = handler(async (request) => {
  const actor = await requireUser(request, ['superadmin', 'admin']);
  const body = await readJson<{
    targetUid?: string;
    newPassword?: string;
    mustChangePassword?: boolean;
  }>(request);

  if (!body.targetUid || !body.newPassword) {
    throw new HttpError(400, 'targetUid et newPassword requis');
  }
  if (body.newPassword.length < 6) {
    throw new HttpError(400, 'Le mot de passe doit contenir au moins 6 caractères');
  }

  const firestore = db();
  const targetRef = firestore.collection('users').doc(body.targetUid);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) {
    throw new HttpError(404, 'Utilisateur introuvable');
  }
  const target = targetSnap.data()!;
  const targetRole = String(target['role'] || 'vendeur');

  if (actor.role !== 'superadmin' && body.targetUid !== actor.uid) {
    if (targetRole === 'superadmin' || targetRole === 'admin') {
      throw new HttpError(403, 'Seul un Super Admin peut réinitialiser le mot de passe d\'un administrateur');
    }
  }

  await adminAuth().updateUser(body.targetUid, { password: body.newPassword });
  await targetRef.set({
    mustChangePassword: body.mustChangePassword !== false,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await firestore.collection('journal_audit').add({
    action: 'MOT_DE_PASSE_REINITIALISE',
    entite: String(target['email'] || body.targetUid),
    detail: `Mot de passe réinitialisé par ${actor.nom} (${actor.role}) pour ${target['displayName'] || target['email']}`,
    userId: actor.uid,
    userName: actor.nom,
    createdAt: FieldValue.serverTimestamp(),
  }).catch(() => undefined);

  return json({ ok: true });
});


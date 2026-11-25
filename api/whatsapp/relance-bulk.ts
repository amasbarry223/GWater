import { db } from '../_lib/firebase-admin.js';
import { requireUser } from '../_lib/auth.js';
import { handler, json, readJson, HttpError } from '../_lib/http.js';
import { getProvider } from '../_lib/openwa.js';
import { loadSettings, relancerEnMasse } from '../_lib/relances.js';

/**
 * POST /api/whatsapp/relance-bulk
 * Body : { clientIds: string[], forcer?: boolean }
 * Relance groupée depuis l'onglet Impayés (admin, superadmin, comptable).
 */
export const POST = handler(async (request) => {
  const user = await requireUser(request, ['superadmin', 'admin', 'comptable']);
  const body = await readJson<{ clientIds?: string[]; forcer?: boolean }>(request);
  if (!Array.isArray(body.clientIds) || body.clientIds.length === 0) throw new HttpError(400, 'clientIds requis');

  const firestore = db();
  const settings = await loadSettings(firestore);
  if (!settings.actif) throw new HttpError(409, "L'envoi WhatsApp automatique est désactivé", 'WHATSAPP_INACTIF');

  const result = await relancerEnMasse({
    db: firestore, provider: getProvider(), settings, clientIds: body.clientIds.map(String),
    mode: 'manuel', forcer: !!body.forcer, auteur: { uid: user.uid, nom: user.nom },
  });
  return json(result);
});


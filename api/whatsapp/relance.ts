import { db } from '../_lib/firebase-admin.js';
import { requireUser, isAdminRole } from '../_lib/auth.js';
import { handler, json, readJson, HttpError } from '../_lib/http.js';
import { getProvider } from '../_lib/openwa.js';
import { loadSettings, relancerClient } from '../_lib/relances.js';
import { NIVEAUX_RELANCE, type NiveauRelance } from '../../src/app/core/whatsapp.utils.js';

/**
 * POST /api/whatsapp/relance
 * Body : { clientId: string, niveau?: NiveauRelance, forcer?: boolean }
 * Envoie immédiatement une relance WhatsApp à un client via OpenWA.
 */
export const POST = handler(async (request) => {
  const user = await requireUser(request);
  const body = await readJson<{ clientId?: string; niveau?: NiveauRelance; forcer?: boolean }>(request);
  if (!body.clientId) throw new HttpError(400, 'clientId requis');
  if (body.niveau && !NIVEAUX_RELANCE.includes(body.niveau)) throw new HttpError(400, 'Niveau de relance invalide');

  const firestore = db();
  const settings = await loadSettings(firestore);
  if (!settings.actif) throw new HttpError(409, "L'envoi WhatsApp automatique est désactivé", 'WHATSAPP_INACTIF');

  const result = await relancerClient({
    db: firestore, provider: getProvider(), settings,
    clientId: body.clientId, niveau: body.niveau, forcer: !!body.forcer,
    auteur: { uid: user.uid, nom: user.nom }, estAdmin: isAdminRole(user.role),
  });
  return json(result);
});


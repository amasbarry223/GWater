import { db } from '../_lib/firebase-admin.js';
import { requireUser } from '../_lib/auth.js';
import { handler, json, readJson, HttpError } from '../_lib/http.js';
import { getProvider } from '../_lib/openwa.js';
import { loadSettings, traiterValidation } from '../_lib/relances.js';

/**
 * POST /api/whatsapp/valider
 * Body : { relanceId: string, action: 'envoyer' | 'annuler' }
 * Validation admin d'une mise en demeure préparée par le cron.
 */
export const POST = handler(async (request) => {
  const user = await requireUser(request, ['superadmin', 'admin']);
  const body = await readJson<{ relanceId?: string; action?: 'envoyer' | 'annuler' }>(request);
  if (!body.relanceId || (body.action !== 'envoyer' && body.action !== 'annuler')) {
    throw new HttpError(400, 'relanceId et action (envoyer | annuler) requis');
  }
  const firestore = db();
  const settings = await loadSettings(firestore);
  if (body.action === 'envoyer' && !settings.actif) {
    throw new HttpError(409, "L'envoi WhatsApp automatique est désactivé", 'WHATSAPP_INACTIF');
  }
  const result = await traiterValidation({
    db: firestore, provider: getProvider(), settings,
    relanceId: body.relanceId, action: body.action, auteur: { uid: user.uid, nom: user.nom },
  });
  return json(result);
});


import { db } from '../_lib/firebase-admin.js';
import { requireUser } from '../_lib/auth.js';
import { handler, json, HttpError } from '../_lib/http.js';
import { getProvider } from '../_lib/openwa.js';
import { ecrireEtat } from '../_lib/relances.js';

/**
 * GET /api/whatsapp/status — état de la session OpenWA (admin).
 * Met aussi à jour parametres/whatsapp_etat pour l'affichage dans l'application.
 */
export const GET = handler(async (request) => {
  await requireUser(request, ['superadmin', 'admin']);
  const firestore = db();
  try {
    const s = await getProvider().sessionStatus();
    await ecrireEtat(firestore, { status: s.status, phone: s.phone || null, source: 'status', erreur: null });
    return json({ connecte: s.status === 'ready', status: s.status, phone: s.phone || null });
  } catch (err) {
    if (err instanceof HttpError && err.code === 'CONFIG_MISSING') throw err;
    const erreur = err instanceof Error ? err.message : String(err);
    await ecrireEtat(firestore, { status: 'injoignable', source: 'status', erreur });
    return json({ connecte: false, status: 'injoignable', erreur });
  }
});


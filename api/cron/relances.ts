import { db } from '../_lib/firebase-admin.js';
import { handler, json, requireEnv } from '../_lib/http.js';
import { getProvider } from '../_lib/openwa.js';
import { ecrireEtat, loadSettings, relancerEnMasse } from '../_lib/relances.js';

/**
 * GET /api/cron/relances — relances automatiques quotidiennes (Vercel Cron, voir vercel.json).
 * Vercel envoie « Authorization: Bearer <CRON_SECRET> ».
 */
export const GET = handler(async (request) => {
  const secret = requireEnv('CRON_SECRET');
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return json({ error: 'Non autorisé' }, 401);
  }

  const firestore = db();
  const settings = await loadSettings(firestore);
  if (!settings.actif || !settings.autoActif) {
    return json({ skipped: true, raison: 'relances automatiques désactivées' });
  }

  try {
    const r = await relancerEnMasse({
      db: firestore, provider: getProvider(), settings, mode: 'auto', auteur: { uid: 'cron', nom: 'Relance automatique' },
    });
    const resume = {
      at: new Date().toISOString(), envoyes: r.envoyes, aValider: r.aValider, batchId: r.batchId,
      ignores: r.ignores.length, reportes: r.ignores.filter(i => i.raison.startsWith('reporté')).length,
    };
    await ecrireEtat(firestore, { dernierCron: { ...resume, erreur: null } });
    return json({ ...resume, details: r.ignores });
  } catch (err) {
    const erreur = err instanceof Error ? err.message : String(err);
    await ecrireEtat(firestore, { dernierCron: { at: new Date().toISOString(), erreur } });
    throw err;
  }
});


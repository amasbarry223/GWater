import { FieldValue } from 'firebase-admin/firestore';
import { db, toDate } from '../_lib/firebase-admin.js';
import { requireUser } from '../_lib/auth.js';
import { handler, json, readJson, HttpError } from '../_lib/http.js';
import { getProvider } from '../_lib/openwa.js';
import { genererRelevePdf } from '../_lib/pdf.js';
import { loadClient, loadSettings, resoudreChatId } from '../_lib/relances.js';
import { formatFcfa } from '../../src/app/core/whatsapp.utils.js';

/**
 * POST /api/whatsapp/releve
 * Body : { clientId: string }
 * Génère le relevé de compte client en PDF et l'envoie via OpenWA send-document (CLI-06).
 */
export const POST = handler(async (request) => {
  const user = await requireUser(request);
  const body = await readJson<{ clientId?: string }>(request);
  if (!body.clientId) throw new HttpError(400, 'clientId requis');

  const firestore = db();
  const settings = await loadSettings(firestore);
  if (!settings.actif) throw new HttpError(409, "L'envoi WhatsApp automatique est désactivé", 'WHATSAPP_INACTIF');

  const client = await loadClient(firestore, body.clientId);
  const provider = getProvider();
  const { chatId } = await resoudreChatId(firestore, provider, client, settings.indicatifPays);

  const [cfgSnap, ventesSnap] = await Promise.all([
    firestore.doc('parametres/config').get(),
    firestore.collection('ventes').where('clientId', '==', client.id).get(),
  ]);
  const cfg = cfgSnap.exists ? cfgSnap.data()! : {};
  const factures = ventesSnap.docs
    .map(d => d.data())
    .filter(v => v['statut'] !== 'annulee')
    .sort((a, b) => (toDate(b['createdAt'])?.getTime() || 0) - (toDate(a['createdAt'])?.getTime() || 0))
    .slice(0, 20)
    .map(v => ({
      numero: String(v['numero'] || ''),
      date: toDate(v['createdAt'])?.toLocaleDateString('fr-FR') || '-',
      total: Number(v['total'] || 0),
      paye: Number(v['montantPaye'] || 0),
      reste: Number(v['soldeRestant'] || 0),
      statut: v['paiementStatut'] === 'paye' ? 'Payee' : v['paiementStatut'] === 'partiel' ? 'Partiel' : 'Impayee',
    }));

  const pdf = genererRelevePdf({
    entreprise: String(cfg['nomEntreprise'] || 'GWater Distribution'),
    adresse: cfg['adresse'] ? String(cfg['adresse']) : undefined,
    telephoneEntreprise: cfg['telephone'] ? String(cfg['telephone']) : undefined,
    client: {
      code: String((client as any).code || client.id),
      nom: client.nom,
      telephone: client.whatsapp || client.telephone || '',
      quartier: (client as any).quartier,
      solde: Number(client.solde || 0),
    },
    factures,
    dateEdition: new Date().toLocaleDateString('fr-FR'),
  });

  const code = String((client as any).code || client.id).replace(/[^a-zA-Z0-9_-]/g, '');
  const caption = `Bonjour ${client.nom},\n\nVeuillez trouver ci-joint votre relevé de compte GWater (solde actuel : *${formatFcfa(Number(client.solde || 0))}*).\n\n${settings.signature}`;
  const { messageId } = await provider.sendDocument({
    chatId,
    base64: pdf.toString('base64'),
    mimetype: 'application/pdf',
    filename: `releve-${code}.pdf`,
    caption,
  });

  await firestore.collection('journal_audit').add({
    action: 'RELEVE_WHATSAPP', entite: 'clients',
    detail: `Relevé PDF envoyé sur WhatsApp à ${client.nom}`,
    userId: user.uid, userName: user.nom, createdAt: FieldValue.serverTimestamp(),
  }).catch(() => undefined);

  return json({ ok: true, messageId });
});


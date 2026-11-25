import { db } from '../_lib/firebase-admin.js';
import { requireUser } from '../_lib/auth.js';
import { handler, json, readJson, HttpError } from '../_lib/http.js';
import { getProvider } from '../_lib/openwa.js';
import { loadClient, loadSettings, resoudreChatId } from '../_lib/relances.js';
import { formatFcfa, normalizePhone } from '../../src/app/core/whatsapp.utils.js';

/**
 * POST /api/whatsapp/facture
 * Body : { venteId?: string, clientId?: string, numero: string, total: number, clientNom: string, telephone?: string }
 * Envoie le récapitulatif d'une facture par WhatsApp via OpenWA (VEN-08).
 */
export const POST = handler(async (request) => {
  await requireUser(request, ['superadmin', 'admin', 'vendeur', 'comptable']);
  const body = await readJson<{
    venteId?: string; clientId?: string; numero?: string; total?: number; clientNom?: string; telephone?: string;
  }>(request);

  if (!body.numero || typeof body.total !== 'number' || !body.clientNom) {
    throw new HttpError(400, 'numero, total et clientNom requis');
  }

  const firestore = db();
  const settings = await loadSettings(firestore);
  if (!settings.actif) throw new HttpError(409, "L'envoi WhatsApp automatique est désactivé", 'WHATSAPP_INACTIF');

  const provider = getProvider();
  let chatId = '';
  if (body.clientId) {
    const client = await loadClient(firestore, body.clientId);
    ({ chatId } = await resoudreChatId(firestore, provider, client, settings.indicatifPays));
  } else {
    const tel = normalizePhone(body.telephone, settings.indicatifPays);
    if (!tel) throw new HttpError(422, 'Numéro de téléphone invalide', 'NUMERO_INVALIDE');
    const r = await provider.checkNumber(tel);
    if (!r.exists || !r.chatId) throw new HttpError(422, `Le numéro ${tel} n'a pas WhatsApp`, 'PAS_WHATSAPP');
    chatId = r.chatId;
  }

  const message = `Bonjour ${body.clientNom},\n\nVeuillez trouver votre facture *N° ${body.numero}* d'un montant de *${formatFcfa(body.total)}*.\n\nMerci pour votre confiance.\n\nCordialement,\n${settings.signature}`;
  const key = body.venteId ? `facture-${body.venteId}` : undefined;
  const { messageId } = await provider.sendText(chatId, message, key);
  return json({ ok: true, messageId });
});


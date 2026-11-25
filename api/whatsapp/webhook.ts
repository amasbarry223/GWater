import { createHmac, timingSafeEqual } from 'node:crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { db } from '../_lib/firebase-admin.js';
import { handler, json, requireEnv } from '../_lib/http.js';
import { getProvider } from '../_lib/openwa.js';
import { ecrireEtat, loadSettings, RELANCES } from '../_lib/relances.js';
import { isOptOutMessage, type StatutRelance } from '../../src/app/core/whatsapp.utils.js';

/**
 * POST /api/whatsapp/webhook — événements envoyés par OpenWA (signés HMAC-SHA256).
 * À enregistrer côté OpenWA avec les événements :
 * message.sent, message.ack, message.failed, message.received,
 * session.status, session.disconnected, session.authenticated, session.restriction
 */

interface Delivery {
  event: string;
  sessionId: string;
  idempotencyKey: string;
  timestamp?: string;
  data: any;
}

const RANG: Record<string, number> = { a_valider: 0, en_attente: 1, envoye: 2, delivre: 3, lu: 4, repondu: 5 };

function verifierSignature(raw: Buffer, header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = Buffer.from('sha256=' + createHmac('sha256', secret).update(raw).digest('hex'));
  const got = Buffer.from(header);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/** Déduplication (livraison « au moins une fois ») : renvoie false si déjà traité. */
async function premiereFois(firestore: Firestore, d: Delivery): Promise<boolean> {
  const id = (d.idempotencyKey || '').replace(/[\/\s]/g, '_').slice(0, 400);
  if (!id) return true;
  try {
    await firestore.collection('whatsapp_events').doc(id).create({
      event: d.event, createdAt: FieldValue.serverTimestamp(),
    });
    return true;
  } catch (err: any) {
    if (err?.code === 6 || /already exists/i.test(String(err?.message))) return false;
    throw err;
  }
}

function chatIdDe(data: any, champ: 'to' | 'from'): string {
  // senderPhone est résolu par OpenWA quand l'expéditeur arrive sous un identifiant @lid
  if (champ === 'from' && data?.senderPhone) return `${String(data.senderPhone).replace(/\D/g, '')}@c.us`;
  return String(data?.[champ] || data?.chatId || '');
}

async function derniereRelancePour(firestore: Firestore, chatId: string, statuts?: string[]) {
  if (!chatId) return null;
  const snap = await firestore.collection(RELANCES).where('chatId', '==', chatId)
    .orderBy('createdAt', 'desc').limit(5).get();
  return snap.docs.find(d => !statuts || statuts.includes(d.get('statut'))) || null;
}

async function majStatut(firestore: Firestore, messageId: string, statut: StatutRelance, erreur?: string) {
  if (!messageId) return;
  const snap = await firestore.collection(RELANCES).where('openwaMessageId', '==', messageId).limit(1).get();
  const doc = snap.docs[0];
  if (!doc) return;
  const actuel = doc.get('statut') as string;
  const avance = statut === 'echec' ? actuel !== 'repondu' : (RANG[statut] ?? 0) > (RANG[actuel] ?? 0);
  if (!avance) return;
  await doc.ref.update({
    statut, ...(erreur ? { erreur } : {}),
    [`${statut}At`]: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
}

const ACK: Record<string, StatutRelance> = {
  sent: 'envoye', server: 'envoye', delivered: 'delivre', device: 'delivre', read: 'lu', played: 'lu', failed: 'echec', error: 'echec',
};

async function traiter(firestore: Firestore, d: Delivery) {
  const data = d.data || {};
  switch (d.event) {
    case 'message.sent': {
      // Rattache un message envoyé par lot (send-bulk) à la relance correspondante
      const messageId = String(data.id || data.messageId || '');
      const doc = await derniereRelancePour(firestore, chatIdDe(data, 'to'), ['en_attente']);
      if (doc && messageId && !doc.get('openwaMessageId')) {
        await doc.ref.update({ statut: 'envoye', openwaMessageId: messageId, updatedAt: FieldValue.serverTimestamp() });
      }
      break;
    }
    case 'message.ack':
    case 'message.failed': {
      const statut = d.event === 'message.failed' ? 'echec' : ACK[String(data.status || '').toLowerCase()];
      if (statut) await majStatut(firestore, String(data.messageId || data.id || ''), statut, data.error || data.reason);
      break;
    }
    case 'message.received': {
      if (data.fromMe || data.isGroup || data.kind === 'group' || String(data.from || '').endsWith('@g.us')) break;
      const chatId = chatIdDe(data, 'from');
      const texte = String(data.body || '').slice(0, 1000);
      const relance = await derniereRelancePour(firestore, chatId, ['envoye', 'delivre', 'lu', 'repondu']);
      if (relance) {
        await relance.ref.update({
          statut: 'repondu', reponse: texte, reponduAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
        });
      }
      if (isOptOutMessage(texte)) {
        const clients = await firestore.collection('clients').where('whatsappChatId', '==', chatId).get();
        const ids = new Set(clients.docs.map(c => c.id));
        if (relance?.get('clientId')) ids.add(relance.get('clientId'));
        await Promise.all([...ids].map(id => firestore.collection('clients').doc(id).update({
          whatsappOptOut: true, whatsappOptOutAt: FieldValue.serverTimestamp(),
        })));
        if (ids.size) {
          const settings = await loadSettings(firestore);
          if (settings.actif) {
            await getProvider().sendText(chatId,
              `C'est noté, vous ne recevrez plus de relances automatiques de notre part.\n\n${settings.signature}`,
              `optout-${d.idempotencyKey}`).catch(() => undefined);
          }
        }
      }
      break;
    }
    case 'session.status':
      await ecrireEtat(firestore, { status: data.status || 'unknown', source: d.event, erreur: null });
      break;
    case 'session.authenticated':
      await ecrireEtat(firestore, { status: 'ready', phone: data.phone || null, source: d.event, erreur: null });
      break;
    case 'session.disconnected':
      await ecrireEtat(firestore, { status: 'disconnected', source: d.event, erreur: data.reason || 'Session déconnectée' });
      break;
    case 'session.restriction':
      await ecrireEtat(firestore, {
        restriction: data.active ? { kind: data.kind || null, expiresAt: data.expiresAt || null } : null, source: d.event,
      });
      break;
    default:
      break;
  }
}

export const POST = handler(async (request) => {
  const secret = requireEnv('OPENWA_WEBHOOK_SECRET');
  const raw = Buffer.from(await request.arrayBuffer());
  if (!verifierSignature(raw, request.headers.get('x-openwa-signature'), secret)) {
    return json({ error: 'Signature invalide' }, 401);
  }
  let delivery: Delivery;
  try {
    delivery = JSON.parse(raw.toString('utf8'));
  } catch {
    return json({ error: 'JSON invalide' }, 400);
  }
  const expectedSession = process.env['OPENWA_SESSION_ID'];
  if (expectedSession && delivery.sessionId && delivery.sessionId !== expectedSession) {
    return json({ ignored: true });
  }

  const firestore = db();
  if (!(await premiereFois(firestore, delivery))) return json({ duplicate: true });
  await traiter(firestore, delivery);
  return json({ ok: true });
});


import { FieldValue, type DocumentReference, type Firestore } from 'firebase-admin/firestore';
import { toDate } from './firebase-admin.js';
import { HttpError } from './http.js';
import type { WhatsappProvider } from './openwa.js';
import {
  buildRelanceMessage, deciderRelanceAuto, joursDeRetard, joursDepuis, mergeWhatsappSettings,
  niveauPourRetard, normalizePhone, type NiveauRelance, type StatutRelance, type WhatsappSettings,
} from '../../src/app/core/whatsapp.utils.js';

export const RELANCES = 'relances';
export const SETTINGS_DOC = 'parametres/whatsapp';
export const ETAT_DOC = 'parametres/whatsapp_etat';
const BULK_MAX = 100;

export interface ClientDoc {
  id: string;
  nom: string;
  telephone?: string;
  whatsapp?: string;
  solde?: number;
  delaiPaiement?: number;
  statut?: string;
  whatsappOptOut?: boolean;
  whatsappChatId?: string;
  whatsappVerifiePour?: string;
  derniereRelanceAt?: unknown;
  dernierNiveauRelance?: NiveauRelance;
  relanceCycle?: string;
}

export interface Auteur { uid: string; nom: string }

export interface Ignore { clientId: string; nom: string; raison: string }

export async function loadSettings(db: Firestore): Promise<WhatsappSettings> {
  const snap = await db.doc(SETTINGS_DOC).get();
  return mergeWhatsappSettings(snap.exists ? (snap.data() as Partial<WhatsappSettings>) : null);
}

export async function loadClient(db: Firestore, clientId: string): Promise<ClientDoc> {
  const snap = await db.collection('clients').doc(clientId).get();
  if (!snap.exists) throw new HttpError(404, 'Client introuvable');
  return { id: snap.id, ...(snap.data() as Omit<ClientDoc, 'id'>) };
}

/** Plus ancienne vente impayée (non annulée) par client. */
export async function plusAnciennesImpayees(db: Firestore, clientId?: string): Promise<Map<string, Date>> {
  const q = clientId
    ? db.collection('ventes').where('clientId', '==', clientId)
    : db.collection('ventes').where('soldeRestant', '>', 0);
  const snap = await q.get();
  const map = new Map<string, Date>();
  for (const d of snap.docs) {
    const v = d.data();
    if (v['statut'] === 'annulee' || !(Number(v['soldeRestant']) > 0) || !v['clientId']) continue;
    const date = toDate(v['createdAt']);
    if (!date) continue;
    const prev = map.get(v['clientId']);
    if (!prev || date < prev) map.set(v['clientId'], date);
  }
  return map;
}

export function cycleOf(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : 'sans-date';
}

/**
 * Vérifie (et met en cache sur la fiche client) que le numéro est bien sur WhatsApp.
 * Renvoie le chatId canonique.
 */
export async function resoudreChatId(
  db: Firestore, provider: WhatsappProvider, client: ClientDoc, indicatif: string
): Promise<{ chatId: string; telephone: string }> {
  const telephone = normalizePhone(client.whatsapp || client.telephone, indicatif);
  if (!telephone) throw new HttpError(422, `Numéro invalide pour ${client.nom}`, 'NUMERO_INVALIDE');
  if (client.whatsappChatId && client.whatsappVerifiePour === telephone) {
    return { chatId: client.whatsappChatId, telephone };
  }
  const r = await provider.checkNumber(telephone);
  if (!r.exists || !r.chatId) {
    throw new HttpError(422, `Le numéro ${telephone} de ${client.nom} n'a pas WhatsApp`, 'PAS_WHATSAPP');
  }
  await db.collection('clients').doc(client.id).update({
    whatsappChatId: r.chatId, whatsappVerifiePour: telephone,
  });
  client.whatsappChatId = r.chatId;
  client.whatsappVerifiePour = telephone;
  return { chatId: r.chatId, telephone };
}

interface RelanceData {
  client: ClientDoc;
  chatId: string;
  telephone: string;
  montant: number;
  joursRetard: number;
  niveau: NiveauRelance;
  message: string;
  cycle: string;
  declenchement: 'manuel' | 'auto';
  statut: StatutRelance;
  auteur: Auteur;
  batchId?: string;
}

export async function creerRelance(db: Firestore, r: RelanceData): Promise<DocumentReference> {
  return db.collection(RELANCES).add({
    clientId: r.client.id,
    clientNom: r.client.nom,
    telephone: r.telephone,
    chatId: r.chatId,
    montant: r.montant,
    joursRetard: r.joursRetard,
    niveau: r.niveau,
    message: r.message,
    cycle: r.cycle,
    canal: 'openwa',
    declenchement: r.declenchement,
    statut: r.statut,
    ...(r.batchId ? { batchId: r.batchId } : {}),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: r.auteur.uid,
    createdByNom: r.auteur.nom,
  });
}

async function marquerClientRelance(db: Firestore, clientId: string, niveau: NiveauRelance, cycle: string) {
  await db.collection('clients').doc(clientId).update({
    derniereRelanceAt: FieldValue.serverTimestamp(),
    dernierNiveauRelance: niveau,
    relanceCycle: cycle,
  });
}

async function journal(db: Firestore, auteur: Auteur, detail: string) {
  await db.collection('journal_audit').add({
    action: 'RELANCE_WHATSAPP', entite: 'clients', detail,
    userId: auteur.uid, userName: auteur.nom, createdAt: FieldValue.serverTimestamp(),
  }).catch(() => undefined);
}

/** Contexte (montant, retard, cycle) d'un client. */
export function contexteClient(client: ClientDoc, plusAncienne: Date | null, now = new Date()) {
  return {
    montant: Math.max(0, Number(client.solde) || 0),
    joursRetard: joursDeRetard(plusAncienne, Number(client.delaiPaiement) || 30, now),
    cycle: cycleOf(plusAncienne),
  };
}

/** Relance unitaire immédiate (bouton « Relancer »). */
export async function relancerClient(opts: {
  db: Firestore; provider: WhatsappProvider; settings: WhatsappSettings;
  clientId: string; niveau?: NiveauRelance; forcer?: boolean; auteur: Auteur; estAdmin: boolean;
}) {
  const { db, provider, settings, auteur } = opts;
  const client = await loadClient(db, opts.clientId);
  if (client.whatsappOptOut) {
    throw new HttpError(409, `${client.nom} a demandé à ne plus recevoir de relances (STOP)`, 'OPT_OUT');
  }
  const anciennes = await plusAnciennesImpayees(db, client.id);
  const ctx = contexteClient(client, anciennes.get(client.id) || null);
  if (ctx.montant <= 0) throw new HttpError(409, `${client.nom} n'a aucun solde dû`, 'SANS_SOLDE');

  const niveau: NiveauRelance = opts.niveau || niveauPourRetard(ctx.joursRetard, settings.paliers) || 'rappel';
  if (niveau === 'mise_en_demeure' && !opts.estAdmin) {
    throw new HttpError(403, 'Seul un administrateur peut envoyer une mise en demeure');
  }
  const depuis = joursDepuis(toDate(client.derniereRelanceAt));
  if (!opts.forcer && depuis < settings.delaiMinEntreRelances) {
    throw new HttpError(409, `${client.nom} a déjà été relancé il y a ${depuis} jour(s)`, 'RELANCE_RECENTE', { depuis });
  }

  const { chatId, telephone } = await resoudreChatId(db, provider, client, settings.indicatifPays);
  const message = buildRelanceMessage(settings, niveau, { nom: client.nom, montant: ctx.montant, jours: ctx.joursRetard });
  const ref = await creerRelance(db, {
    client, chatId, telephone, ...ctx, niveau, message, declenchement: 'manuel', statut: 'en_attente', auteur,
  });
  try {
    const { messageId } = await provider.sendText(chatId, message, `relance-${ref.id}`);
    await ref.update({ statut: 'envoye', openwaMessageId: messageId, updatedAt: FieldValue.serverTimestamp() });
    await marquerClientRelance(db, client.id, niveau, ctx.cycle);
    await journal(db, auteur, `Relance WhatsApp (${niveau}) envoyée à ${client.nom} — ${ctx.montant} FCFA`);
    return { relanceId: ref.id, statut: 'envoye' as const, niveau, messageId };
  } catch (err) {
    await ref.update({
      statut: 'echec', erreur: err instanceof Error ? err.message : String(err), updatedAt: FieldValue.serverTimestamp(),
    });
    throw err;
  }
}

/**
 * Relance groupée (onglet Impayés ou cron). Les messages partent via send-bulk d'OpenWA,
 * espacés de quelques secondes ; les statuts sont ensuite mis à jour par le webhook.
 */
export async function relancerEnMasse(opts: {
  db: Firestore; provider: WhatsappProvider; settings: WhatsappSettings;
  clientIds?: string[]; mode: 'manuel' | 'auto'; forcer?: boolean; auteur: Auteur;
}) {
  const { db, provider, settings, auteur, mode } = opts;
  const now = new Date();

  let clients: ClientDoc[];
  if (opts.clientIds?.length) {
    const refs = opts.clientIds.slice(0, 500).map(id => db.collection('clients').doc(id));
    const snaps = await db.getAll(...refs);
    clients = snaps.filter(s => s.exists).map(s => ({ id: s.id, ...(s.data() as Omit<ClientDoc, 'id'>) }));
  } else {
    const snap = await db.collection('clients').where('solde', '>', 0).get();
    clients = snap.docs.map(s => ({ id: s.id, ...(s.data() as Omit<ClientDoc, 'id'>) }));
  }
  const anciennes = await plusAnciennesImpayees(db);

  const ignores: Ignore[] = [];
  const aEnvoyer: { client: ClientDoc; niveau: NiveauRelance; ctx: ReturnType<typeof contexteClient> }[] = [];
  let aValider = 0;

  for (const client of clients) {
    const ignorer = (raison: string) => ignores.push({ clientId: client.id, nom: client.nom, raison });
    if (client.statut && client.statut !== 'actif') { ignorer(`client ${client.statut}`); continue; }
    const ctx = contexteClient(client, anciennes.get(client.id) || null, now);
    if (ctx.montant <= 0) { ignorer('aucun solde dû'); continue; }

    let niveau: NiveauRelance | null;
    if (mode === 'auto') {
      const d = deciderRelanceAuto({
        joursRetard: ctx.joursRetard, paliers: settings.paliers, delaiMin: settings.delaiMinEntreRelances,
        optOut: client.whatsappOptOut, derniereRelanceAt: toDate(client.derniereRelanceAt),
        dernierNiveau: client.dernierNiveauRelance, cycle: ctx.cycle, dernierCycle: client.relanceCycle, now,
      });
      if (!d.envoyer) { ignorer(d.raison); continue; }
      niveau = d.niveau;
    } else {
      if (client.whatsappOptOut) { ignorer('opt-out (STOP)'); continue; }
      const depuis = joursDepuis(toDate(client.derniereRelanceAt), now);
      if (!opts.forcer && depuis < settings.delaiMinEntreRelances) { ignorer(`relancé il y a ${depuis} j`); continue; }
      niveau = niveauPourRetard(ctx.joursRetard, settings.paliers) || 'rappel';
    }
    if (!niveau) continue;

    // La mise en demeure passe par une validation admin
    if (niveau === 'mise_en_demeure' && settings.validationMiseEnDemeure) {
      const existante = await db.collection(RELANCES)
        .where('clientId', '==', client.id).where('statut', '==', 'a_valider').limit(1).get();
      if (existante.empty) {
        const telephone = normalizePhone(client.whatsapp || client.telephone, settings.indicatifPays);
        await creerRelance(db, {
          client, chatId: telephone ? `${telephone}@c.us` : '', telephone, ...ctx, niveau,
          message: buildRelanceMessage(settings, niveau, { nom: client.nom, montant: ctx.montant, jours: ctx.joursRetard }),
          declenchement: mode, statut: 'a_valider', auteur,
        });
        aValider++;
      } else {
        ignorer('mise en demeure déjà en attente de validation');
      }
      continue;
    }
    aEnvoyer.push({ client, niveau, ctx });
  }

  // Vérification des numéros + préparation du lot (100 max par exécution)
  const lot: { chatId: string; text: string; data: RelanceData }[] = [];
  for (const item of aEnvoyer) {
    if (lot.length >= BULK_MAX) { ignores.push({ clientId: item.client.id, nom: item.client.nom, raison: 'reporté (lot plein)' }); continue; }
    try {
      const { chatId, telephone } = await resoudreChatId(db, provider, item.client, settings.indicatifPays);
      const message = buildRelanceMessage(settings, item.niveau,
        { nom: item.client.nom, montant: item.ctx.montant, jours: item.ctx.joursRetard });
      lot.push({
        chatId, text: message,
        data: { client: item.client, chatId, telephone, ...item.ctx, niveau: item.niveau, message,
          declenchement: mode, statut: 'en_attente', auteur },
      });
    } catch (err) {
      if (err instanceof HttpError && (err.code === 'NUMERO_INVALIDE' || err.code === 'PAS_WHATSAPP')) {
        ignores.push({ clientId: item.client.id, nom: item.client.nom, raison: err.message });
        continue;
      }
      throw err; // passerelle indisponible : on arrête tout
    }
  }

  let batchId: string | null = null;
  if (lot.length) {
    batchId = `gwater_${mode}_${now.toISOString().replace(/[^0-9]/g, '').slice(0, 14)}_${Math.random().toString(36).slice(2, 8)}`;
    // On écrit d'abord les relances (le webhook message.sent les rattachera aux messages)
    const refs = await Promise.all(lot.map(l => creerRelance(db, { ...l.data, batchId: batchId! })));
    try {
      await provider.sendBulk(lot.map(l => ({ chatId: l.chatId, text: l.text })), batchId);
    } catch (err) {
      const erreur = err instanceof Error ? err.message : String(err);
      await Promise.all(refs.map(r => r.update({ statut: 'echec', erreur, updatedAt: FieldValue.serverTimestamp() })));
      throw err;
    }
    await Promise.all(lot.map(l => marquerClientRelance(db, l.data.client.id, l.data.niveau, l.data.cycle)));
    await journal(db, auteur, `Relance WhatsApp groupée (${mode}) : ${lot.length} client(s), lot ${batchId}`);
  }

  return { envoyes: lot.length, aValider, ignores, batchId };
}

/** Valide (envoie) ou annule une mise en demeure en attente. */
export async function traiterValidation(opts: {
  db: Firestore; provider: WhatsappProvider; settings: WhatsappSettings;
  relanceId: string; action: 'envoyer' | 'annuler'; auteur: Auteur;
}) {
  const { db, provider, settings, auteur } = opts;
  const ref = db.collection(RELANCES).doc(opts.relanceId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, 'Relance introuvable');
  const r = snap.data()!;
  if (r['statut'] !== 'a_valider') throw new HttpError(409, 'Cette relance a déjà été traitée');

  if (opts.action === 'annuler') {
    await ref.update({ statut: 'annule', valideePar: auteur.uid, updatedAt: FieldValue.serverTimestamp() });
    return { statut: 'annule' as const };
  }

  // Recalcule le message avec le solde à jour
  const client = await loadClient(db, r['clientId']);
  if (client.whatsappOptOut) throw new HttpError(409, `${client.nom} a demandé à ne plus recevoir de relances`, 'OPT_OUT');
  const anciennes = await plusAnciennesImpayees(db, client.id);
  const ctx = contexteClient(client, anciennes.get(client.id) || null);
  if (ctx.montant <= 0) {
    await ref.update({ statut: 'annule', erreur: 'Solde réglé entre-temps', updatedAt: FieldValue.serverTimestamp() });
    return { statut: 'annule' as const };
  }
  const { chatId, telephone } = await resoudreChatId(db, provider, client, settings.indicatifPays);
  const message = buildRelanceMessage(settings, 'mise_en_demeure', { nom: client.nom, montant: ctx.montant, jours: ctx.joursRetard });
  try {
    const { messageId } = await provider.sendText(chatId, message, `relance-${ref.id}`);
    await ref.update({
      statut: 'envoye', openwaMessageId: messageId, chatId, telephone, message, montant: ctx.montant,
      joursRetard: ctx.joursRetard, valideePar: auteur.uid, updatedAt: FieldValue.serverTimestamp(),
    });
    await marquerClientRelance(db, client.id, 'mise_en_demeure', ctx.cycle);
    await journal(db, auteur, `Mise en demeure WhatsApp validée et envoyée à ${client.nom}`);
    return { statut: 'envoye' as const, messageId };
  } catch (err) {
    await ref.update({ erreur: err instanceof Error ? err.message : String(err), updatedAt: FieldValue.serverTimestamp() });
    throw err;
  }
}

export async function ecrireEtat(db: Firestore, data: Record<string, unknown>) {
  await db.doc(ETAT_DOC).set({ ...data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}


import { Injectable, inject } from '@angular/core';
import { Auth } from 'firebase/auth';
import {
  Firestore, collection, doc, getDoc, setDoc, onSnapshot, query, where, orderBy, limit, serverTimestamp,
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { FIREBASE_AUTH, FIREBASE_DB } from './firebase.instances';
import { normalizeTimestamps } from './firestore.converters';
import {
  buildRelanceMessage, buildWaMeUrl, formatFcfa, mergeWhatsappSettings, niveauPourRetard,
  type NiveauRelance, type StatutRelance, type WhatsappSettings,
} from './whatsapp.utils';

/** Base des fonctions serverless (même domaine sur Vercel). */
const API_BASE = '';

export interface Relance {
  id: string;
  clientId: string;
  clientNom: string;
  telephone: string;
  chatId: string;
  montant: number;
  joursRetard: number;
  niveau: NiveauRelance;
  message: string;
  canal: 'openwa' | 'wa_me';
  declenchement: 'manuel' | 'auto';
  statut: StatutRelance;
  openwaMessageId?: string;
  batchId?: string;
  erreur?: string;
  reponse?: string;
  createdAt: Date;
  createdByNom?: string;
}

export interface WhatsappEtat {
  status?: string;
  phone?: string | null;
  erreur?: string | null;
  restriction?: { kind: string | null; expiresAt: string | null } | null;
  dernierCron?: { at: string; envoyes?: number; aValider?: number; ignores?: number; reportes?: number; erreur?: string | null };
  updatedAt?: Date;
}

export interface ClientRelancable {
  id?: string;
  nom: string;
  telephone: string;
  whatsapp?: string;
  solde: number;
}

export type ResultatRelance =
  | { mode: 'openwa'; statut: string; niveau: NiveauRelance }
  | { mode: 'wa_me' };

export class WhatsappApiError extends Error {
  constructor(public status: number, message: string, public code?: string, public details?: any) {
    super(message);
  }
}

export const STATUT_RELANCE_LABELS: Record<StatutRelance, string> = {
  a_valider: 'À valider', en_attente: 'En file', envoye: 'Envoyé', delivre: 'Délivré', lu: 'Lu',
  repondu: 'A répondu', echec: 'Échec', annule: 'Annulé',
};

export const STATUT_RELANCE_BADGES: Record<StatutRelance, string> = {
  a_valider: 'badge-warning', en_attente: 'badge-secondary', envoye: 'badge-info', delivre: 'badge-info',
  lu: 'badge-success', repondu: 'badge-success', echec: 'badge-danger', annule: 'badge-secondary',
};

@Injectable({ providedIn: 'root' })
export class WhatsappService {
  private auth: Auth = inject(FIREBASE_AUTH);
  private db: Firestore = inject(FIREBASE_DB);
  private settingsCache: WhatsappSettings | null = null;

  // ── Paramètres ─────────────────────────────────────────
  async getSettings(forceRefresh = false): Promise<WhatsappSettings> {
    if (this.settingsCache && !forceRefresh) return this.settingsCache;
    try {
      const snap = await getDoc(doc(this.db, 'parametres', 'whatsapp'));
      this.settingsCache = mergeWhatsappSettings(snap.exists() ? (snap.data() as Partial<WhatsappSettings>) : null);
    } catch {
      this.settingsCache = mergeWhatsappSettings(null);
    }
    return this.settingsCache;
  }

  async saveSettings(settings: WhatsappSettings): Promise<void> {
    await setDoc(doc(this.db, 'parametres', 'whatsapp'), { ...settings, updatedAt: serverTimestamp() }, { merge: true });
    this.settingsCache = mergeWhatsappSettings(settings);
  }

  watchEtat(): Observable<WhatsappEtat | null> {
    return new Observable(sub => onSnapshot(
      doc(this.db, 'parametres', 'whatsapp_etat'),
      snap => sub.next(snap.exists() ? normalizeTimestamps<WhatsappEtat>(snap.data()) : null),
      err => sub.error(err),
    ));
  }

  // ── Historique ─────────────────────────────────────────
  watchRelancesClient(clientId: string, max = 20): Observable<Relance[]> {
    return this.watchQuery(query(collection(this.db, 'relances'),
      where('clientId', '==', clientId), orderBy('createdAt', 'desc'), limit(max)));
  }

  watchRelancesRecentes(max = 50): Observable<Relance[]> {
    return this.watchQuery(query(collection(this.db, 'relances'), orderBy('createdAt', 'desc'), limit(max)));
  }

  watchRelancesAValider(): Observable<Relance[]> {
    return this.watchQuery(query(collection(this.db, 'relances'),
      where('statut', '==', 'a_valider'), orderBy('createdAt', 'desc'), limit(100)));
  }

  private watchQuery(q: ReturnType<typeof query>): Observable<Relance[]> {
    return new Observable(sub => onSnapshot(
      q,
      snap => sub.next(snap.docs.map(d => ({ id: d.id, ...normalizeTimestamps<Omit<Relance, 'id'>>(d.data()) }))),
      err => sub.error(err),
    ));
  }

  // ── Envoi ──────────────────────────────────────────────
  /**
   * Relance un client : envoi direct via OpenWA si activé, sinon (ou si la passerelle
   * est indisponible et `fallback` vaut true) ouverture d'un lien wa.me prérempli.
   */
  async relancer(
    client: ClientRelancable,
    opts: { niveau?: NiveauRelance; forcer?: boolean; joursRetard?: number; fallback?: boolean } = {}
  ): Promise<ResultatRelance> {
    const settings = await this.getSettings();
    if (!settings.actif || !client.id) {
      this.ouvrirWaMe(client, settings, opts.niveau, opts.joursRetard);
      return { mode: 'wa_me' };
    }
    try {
      const r = await this.post<{ statut: string; niveau: NiveauRelance }>('/api/whatsapp/relance', {
        clientId: client.id, niveau: opts.niveau, forcer: !!opts.forcer,
      });
      return { mode: 'openwa', statut: r.statut, niveau: r.niveau };
    } catch (err) {
      const indisponible = err instanceof WhatsappApiError
        && (err.status === 0 || err.status === 404 || err.status >= 500 || err.code === 'WHATSAPP_INACTIF');
      if (indisponible && opts.fallback !== false) {
        this.ouvrirWaMe(client, settings, opts.niveau, opts.joursRetard);
        return { mode: 'wa_me' };
      }
      throw err;
    }
  }

  relancerGroupe(clientIds: string[], forcer = false) {
    return this.post<{ envoyes: number; aValider: number; ignores: { nom: string; raison: string }[]; batchId: string | null }>(
      '/api/whatsapp/relance-bulk', { clientIds, forcer });
  }

  validerRelance(relanceId: string, action: 'envoyer' | 'annuler') {
    return this.post<{ statut: string }>('/api/whatsapp/valider', { relanceId, action });
  }

  envoyerRelevePdf(clientId: string) {
    return this.post<{ ok: boolean; messageId: string }>('/api/whatsapp/releve', { clientId });
  }

  async statutSession(): Promise<{ connecte: boolean; status: string; phone?: string | null; erreur?: string }> {
    return this.request('GET', '/api/whatsapp/status');
  }

  // ── Liens wa.me (mode manuel / secours) ────────────────
  waMeRelanceUrl(client: ClientRelancable, settings: WhatsappSettings, niveau?: NiveauRelance, joursRetard = 0): string {
    const n = niveau || niveauPourRetard(joursRetard, settings.paliers) || 'rappel';
    const message = buildRelanceMessage(settings, n, { nom: client.nom, montant: client.solde, jours: joursRetard });
    return buildWaMeUrl(client.whatsapp || client.telephone, message, settings.indicatifPays);
  }

  private ouvrirWaMe(client: ClientRelancable, settings: WhatsappSettings, niveau?: NiveauRelance, joursRetard = 0) {
    window.open(this.waMeRelanceUrl(client, settings, niveau, joursRetard), '_blank');
  }

  /** Compatibilité : ouvre WhatsApp avec un message de relance de solde dû. */
  openRelance(client: { nom: string; telephone: string; whatsapp?: string; solde: number }): void {
    void this.getSettings().then(s => this.ouvrirWaMe(client, s, 'rappel'));
  }

  /** Compatibilité : relance pour impayé avec jours de retard. */
  openRelanceImpaye(client: { nom: string; telephone: string; whatsapp?: string }, montant: number, joursRetard: number): void {
    void this.getSettings().then(s => this.ouvrirWaMe({ ...client, solde: montant }, s, undefined, joursRetard));
  }

  /** Envoie une facture via OpenWA si actif, sinon ouvre WhatsApp Web (VEN-08). */
  async partagerFacture(
    vente: { id?: string; numero: string; total: number; clientNom: string; clientId?: string },
    tel: string
  ): Promise<ResultatRelance> {
    const settings = await this.getSettings();
    const message = `Bonjour ${vente.clientNom},\n\nVeuillez trouver votre facture *N° ${vente.numero}* d'un montant de *${formatFcfa(vente.total)}*.\n\nMerci pour votre confiance.\n\nCordialement,\n${settings.signature}`;
    if (!settings.actif || (!vente.clientId && !tel)) {
      window.open(buildWaMeUrl(tel, message, settings.indicatifPays), '_blank');
      return { mode: 'wa_me' };
    }
    try {
      await this.post('/api/whatsapp/facture', {
        venteId: vente.id, clientId: vente.clientId, numero: vente.numero,
        total: vente.total, clientNom: vente.clientNom, telephone: tel,
      });
      return { mode: 'openwa', statut: 'envoye', niveau: 'rappel' };
    } catch (err) {
      const indisponible = err instanceof WhatsappApiError
        && (err.status === 0 || err.status === 404 || err.status >= 500 || err.code === 'WHATSAPP_INACTIF');
      if (indisponible) {
        window.open(buildWaMeUrl(tel, message, settings.indicatifPays), '_blank');
        return { mode: 'wa_me' };
      }
      throw err;
    }
  }

  // ── HTTP ───────────────────────────────────────────────
  private post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const user = this.auth.currentUser;
    if (!user) throw new WhatsappApiError(401, 'Vous devez être connecté');
    const token = await user.getIdToken();
    let res: Response;
    try {
      res = await fetch(API_BASE + path, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new WhatsappApiError(0, 'Serveur injoignable');
    }
    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    const data: any = isJson ? await res.json().catch(() => null) : null;
    if (!res.ok || !isJson) {
      const msg = !isJson
        ? 'Backend /api absent sur ce serveur (ng serve). Déployez sur Vercel ou lancez « vercel dev ».'
        : data?.error || 'Service WhatsApp indisponible';
      throw new WhatsappApiError(isJson ? res.status : (res.ok ? 404 : res.status), msg, data?.code, data?.details);
    }
    return data as T;
  }
}

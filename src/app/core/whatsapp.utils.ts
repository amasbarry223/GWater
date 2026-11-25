/**
 * Logique WhatsApp partagée entre le front Angular et les fonctions serverless (/api).
 * ⚠️ Ce fichier doit rester PUR : aucun import Angular / Firebase / Node.
 */

export type NiveauRelance = 'rappel' | 'relance1' | 'relance2' | 'mise_en_demeure';

export const NIVEAUX_RELANCE: NiveauRelance[] = ['rappel', 'relance1', 'relance2', 'mise_en_demeure'];

export const NIVEAU_LABELS: Record<NiveauRelance, string> = {
  rappel: 'Rappel courtois',
  relance1: 'Relance 1',
  relance2: 'Relance 2',
  mise_en_demeure: 'Mise en demeure',
};

export type StatutRelance =
  | 'a_valider'   // mise en demeure en attente de validation admin
  | 'en_attente'  // remise à OpenWA, pas encore confirmée
  | 'envoye'
  | 'delivre'
  | 'lu'
  | 'repondu'
  | 'echec'
  | 'annule';

export interface PalierRelance {
  /** Nombre de jours de retard (après échéance) déclenchant ce palier */
  jours: number;
  niveau: NiveauRelance;
}

export interface WhatsappSettings {
  /** Envoi direct via OpenWA (sinon : lien wa.me manuel) */
  actif: boolean;
  /** Relances automatiques quotidiennes (cron) */
  autoActif: boolean;
  paliers: PalierRelance[];
  /** Nombre de jours minimum entre deux relances d'un même client */
  delaiMinEntreRelances: number;
  /** La mise en demeure doit être validée par un admin avant envoi */
  validationMiseEnDemeure: boolean;
  /** Indicatif pays par défaut pour les numéros locaux (ex. 224) */
  indicatifPays: string;
  signature: string;
  templates: Record<NiveauRelance, string>;
}

export const DEFAULT_WHATSAPP_SETTINGS: WhatsappSettings = {
  actif: false,
  autoActif: false,
  paliers: [
    { jours: 3, niveau: 'rappel' },
    { jours: 15, niveau: 'relance1' },
    { jours: 30, niveau: 'relance2' },
    { jours: 60, niveau: 'mise_en_demeure' },
  ],
  delaiMinEntreRelances: 7,
  validationMiseEnDemeure: true,
  indicatifPays: '224',
  signature: "L'équipe GWater 💧",
  templates: {
    rappel:
      'Bonjour {{nom}},\n\nPetit rappel : votre solde chez GWater est de *{{montant}}*.\nMerci de prévoir son règlement à votre convenance.\n\nCordialement,\n{{signature}}',
    relance1:
      'Bonjour {{nom}},\n\nSauf erreur de notre part, votre solde de *{{montant}}* est échu depuis *{{jours}} jour(s)*.\nMerci de régulariser votre situation dans les meilleurs délais.\n\nCordialement,\n{{signature}}',
    relance2:
      "Bonjour {{nom}},\n\nMalgré notre précédent message, votre solde de *{{montant}}* reste impayé ({{jours}} jours de retard).\nNous vous prions d'effectuer le règlement rapidement afin d'éviter toute suspension des livraisons.\n\nCordialement,\n{{signature}}",
    mise_en_demeure:
      "Bonjour {{nom}},\n\nVotre solde de *{{montant}}* est impayé depuis *{{jours}} jours*. Sans règlement de votre part sous 8 jours, nous serons contraints de suspendre votre compte crédit.\n\nPour tout arrangement, contactez-nous.\n\n{{signature}}",
  },
};

/** Fusionne des paramètres partiels (Firestore) avec les valeurs par défaut. */
export function mergeWhatsappSettings(partial?: Partial<WhatsappSettings> | null): WhatsappSettings {
  const p = partial || {};
  return {
    ...DEFAULT_WHATSAPP_SETTINGS,
    ...p,
    paliers: (p.paliers && p.paliers.length ? p.paliers : DEFAULT_WHATSAPP_SETTINGS.paliers)
      .slice()
      .sort((a, b) => a.jours - b.jours),
    templates: { ...DEFAULT_WHATSAPP_SETTINGS.templates, ...(p.templates || {}) },
  };
}

/**
 * Normalise un numéro au format international sans « + » (ex. 224621000000).
 * Renvoie '' si le numéro est inexploitable.
 */
export function normalizePhone(tel: string | null | undefined, indicatif = '224'): string {
  if (!tel) return '';
  const raw = String(tel).trim();
  let digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (raw.startsWith('+')) {
    // déjà international
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
  } else if (!(digits.startsWith(indicatif) && digits.length > 9)) {
    // numéro local : on retire les 0 de tête et on préfixe l'indicatif
    digits = indicatif + digits.replace(/^0+/, '');
  }
  return digits.length >= 8 && digits.length <= 15 ? digits : '';
}

/** Identifiant de chat OpenWA (`<numéro>@c.us`). */
export function toChatId(tel: string | null | undefined, indicatif = '224'): string {
  const n = normalizePhone(tel, indicatif);
  return n ? `${n}@c.us` : '';
}

export function formatFcfa(val: number): string {
  return Math.round(val || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + ' FCFA';
}

/** Remplace les {{variables}} ; les variables inconnues sont laissées vides. */
export function renderTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) =>
    vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : ''
  );
}

export function buildRelanceMessage(
  settings: WhatsappSettings,
  niveau: NiveauRelance,
  data: { nom: string; montant: number; jours: number }
): string {
  return renderTemplate(settings.templates[niveau] || DEFAULT_WHATSAPP_SETTINGS.templates[niveau], {
    nom: data.nom,
    montant: formatFcfa(data.montant),
    jours: Math.max(0, Math.floor(data.jours)),
    signature: settings.signature,
  }).trim();
}

/** Palier correspondant à un nombre de jours de retard (null si aucun palier atteint). */
export function niveauPourRetard(joursRetard: number, paliers: PalierRelance[]): NiveauRelance | null {
  let niveau: NiveauRelance | null = null;
  for (const p of [...paliers].sort((a, b) => a.jours - b.jours)) {
    if (joursRetard >= p.jours) niveau = p.niveau;
  }
  return niveau;
}

export function niveauIndex(n: NiveauRelance | null | undefined): number {
  return n ? NIVEAUX_RELANCE.indexOf(n) : -1;
}

const DAY_MS = 86_400_000;

/** Jours de retard = jours écoulés depuis (date de la plus ancienne vente impayée + délai de paiement). */
export function joursDeRetard(plusAncienneImpayee: Date | null, delaiPaiement: number, now = new Date()): number {
  if (!plusAncienneImpayee) return 0;
  const echeance = plusAncienneImpayee.getTime() + Math.max(0, delaiPaiement || 0) * DAY_MS;
  return Math.max(0, Math.floor((now.getTime() - echeance) / DAY_MS));
}

export function joursDepuis(date: Date | null | undefined, now = new Date()): number {
  if (!date) return Number.POSITIVE_INFINITY;
  return Math.floor((now.getTime() - date.getTime()) / DAY_MS);
}

export interface DecisionRelanceAuto {
  envoyer: boolean;
  niveau: NiveauRelance | null;
  raison: string;
}

/**
 * Décide si une relance automatique doit partir pour un client.
 * Règles : palier atteint, palier supérieur au dernier envoyé sur le même cycle d'impayé,
 * délai minimum respecté, pas d'opt-out.
 */
export function deciderRelanceAuto(input: {
  joursRetard: number;
  paliers: PalierRelance[];
  delaiMin: number;
  optOut?: boolean;
  derniereRelanceAt?: Date | null;
  dernierNiveau?: NiveauRelance | null;
  /** Cycle courant (date ISO de la plus ancienne vente impayée) */
  cycle: string;
  /** Cycle de la dernière relance */
  dernierCycle?: string | null;
  now?: Date;
}): DecisionRelanceAuto {
  if (input.optOut) return { envoyer: false, niveau: null, raison: 'opt-out' };
  const niveau = niveauPourRetard(input.joursRetard, input.paliers);
  if (!niveau) return { envoyer: false, niveau: null, raison: 'aucun palier atteint' };
  const memeCycle = !!input.dernierCycle && input.dernierCycle === input.cycle;
  if (memeCycle && niveauIndex(niveau) <= niveauIndex(input.dernierNiveau)) {
    return { envoyer: false, niveau, raison: 'palier déjà envoyé' };
  }
  if (joursDepuis(input.derniereRelanceAt, input.now) < input.delaiMin) {
    return { envoyer: false, niveau, raison: 'délai minimum non écoulé' };
  }
  return { envoyer: true, niveau, raison: 'ok' };
}

/** Le client demande à ne plus recevoir de relances. */
export function isOptOutMessage(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return /^(STOP|ARRET|ARRETER|DESABONNER|UNSUBSCRIBE)\b/.test(t);
}

/** Lien wa.me (mode manuel / secours). */
export function buildWaMeUrl(tel: string | null | undefined, message: string, indicatif = '224'): string {
  const n = normalizePhone(tel, indicatif);
  const text = encodeURIComponent(message);
  return n ? `https://wa.me/${n}?text=${text}` : `https://web.whatsapp.com/send?text=${text}`;
}


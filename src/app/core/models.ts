export type UserRole = 'superadmin' | 'admin' | 'vendeur' | 'comptable';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdBy?: string;
  status: 'actif' | 'inactif';
  mustChangePassword?: boolean;
  createdAt: Date;
  lastLogin?: Date;
}

export interface Client {
  id?: string;
  code: string;
  nom: string;
  type: 'particulier' | 'boutique' | 'restaurant' | 'entreprise' | 'institution';
  telephone: string;
  whatsapp?: string;
  adresse: string;
  quartier: string;
  grilleTarifaire: 'detail' | 'gros' | 'revendeur';
  modePaiement: 'especes' | 'orange_money' | 'wave' | 'moov_money' | 'virement' | 'cheque' | 'credit';
  plafondCredit: number;
  delaiPaiement: number;
  solde: number;
  consignesDetenues?: number;
  statut: 'actif' | 'suspendu' | 'archive';
  whatsappOptOut?: boolean;
  whatsappChatId?: string;
  derniereRelanceAt?: Date;
  dernierNiveauRelance?: string;
  notes?: string;
  createdAt?: Date;
  createdBy?: string;
}

export interface Produit {
  id?: string;
  code: string;
  nom: string;
  categorie: string;
  unite: 'unite' | 'pack' | 'palette';
  unitesParPack?: number;
  produitUniteId?: string;
  prixDetail: number;
  prixGros: number;
  prixRevendeur: number;
  coutAchat: number;
  stock: number;
  seuilAlerte: number;
  statut: 'actif' | 'inactif';
  createdAt?: Date;
}

export interface MouvementStock {
  id?: string;
  produitId: string;
  produitNom: string;
  type: 'entree' | 'sortie' | 'ajustement' | 'perte';
  quantite: number;
  delta?: number;
  cout?: number;
  motif?: string;
  reference?: string;
  operateur: string;
  createdAt: Date;
}

export interface Vente {
  id?: string;
  numero: string;
  clientId: string;
  clientNom: string;
  vendeurId: string;
  vendeurNom: string;
  lignes: LigneVente[];
  sousTotal: number;
  remise: number;
  total: number;
  typeVente: 'comptant' | 'credit' | 'acompte';
  statut: 'en_attente' | 'validee' | 'livree' | 'payee' | 'annulee';
  paiementStatut: 'non_paye' | 'partiel' | 'paye';
  montantPaye: number;
  soldeRestant: number;
  livraison?: boolean;
  notes?: string;
  createdAt: Date;
}

export interface LigneVente {
  produitId: string;
  produitNom: string;
  quantite: number;
  prixUnitaire: number;
  remise: number;
  total: number;
}

export interface Paiement {
  id?: string;
  venteId: string;
  clientId: string;
  montant: number;
  moyen: 'especes' | 'orange_money' | 'wave' | 'moov_money' | 'virement' | 'cheque';
  reference?: string;
  compteTresorerie: string;
  createdAt: Date;
  operateur: string;
}

export interface Depense {
  id?: string;
  categorie: string;
  montant: number;
  description: string;
  fournisseur?: string;
  justificatif?: string;
  compteTresorerie: string;
  periode: string;
  createdAt: Date;
  operateur: string;
}

export interface Livreur {
  id?: string;
  nom: string;
  telephone: string;
  vehicule: string;
  statut: 'actif' | 'inactif';
  createdAt?: Date;
}

export interface Livraison {
  id?: string;
  venteId: string;
  venteNumero: string;
  clientId: string;
  clientNom: string;
  adresse: string;
  livreurId?: string;
  livreur: string;
  statut: 'a_livrer' | 'en_cours' | 'livree' | 'echec';
  datePrevue?: string;
  motifEchec?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AppSettings {
  nomEntreprise: string;
  devise: string;
  adresse: string;
  telephone: string;
  email: string;
  prefixeFacture: string;
  plafondRemiseVendeur: number;
  delaiPaiementDefaut: number;
  seuilStockAlerte: number;
  moyensPaiement: string[];
}

export interface DetteFournisseur {
  id?: string;
  fournisseur: string;
  reference: string;
  description: string;
  montantTotal: number;
  montantPaye: number;
  soldeRestant: number;
  dateEcheance: string;
  statut: 'impayee' | 'partiel' | 'payee';
  operateur: string;
  createdAt?: Date;
}

export interface PrixHistorique {
  id?: string;
  produitId: string;
  produitNom: string;
  ancienPrixDetail: number;
  nouveauPrixDetail: number;
  ancienPrixGros: number;
  nouveauPrixGros: number;
  ancienPrixRevendeur: number;
  nouveauPrixRevendeur: number;
  operateur: string;
  createdAt?: Date;
}

export interface ConsigneMouvement {
  id?: string;
  clientId: string;
  clientNom: string;
  type: 'depot' | 'retour';
  quantite: number;
  typeEmballage: 'casier' | 'palette' | 'bonbonne';
  motif?: string;
  operateur: string;
  createdAt?: Date;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  leaving?: boolean;
}

import { Injectable, inject } from '@angular/core';
import {
  Firestore, collection, doc, addDoc, setDoc,
  updateDoc, query, where, orderBy, limit,
  getDocs, getDoc, onSnapshot, Query, DocumentData,
  Timestamp, serverTimestamp, runTransaction
} from 'firebase/firestore';
import { FirebaseStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Observable, Subject, of } from 'rxjs';
import { map, shareReplay, switchMap, takeUntil } from 'rxjs/operators';
import {
  Client, Produit, MouvementStock, Vente, Paiement, Depense,
  Livreur, Livraison, AppSettings, DetteFournisseur, PrixHistorique, ConsigneMouvement
} from './models';
import { AuthService } from './auth.service';
import { normalizeTimestamps, stripUndefined } from './firestore.converters';
import { FIREBASE_DB, FIREBASE_STORAGE } from './firebase.instances';

@Injectable({ providedIn: 'root' })
export class DataService {
  private db: Firestore = inject(FIREBASE_DB);
  private storage: FirebaseStorage = inject(FIREBASE_STORAGE);
  private authService = inject(AuthService);

  private streamCache = new Map<string, Observable<any[]>>();
  private resetStreams$ = new Subject<void>();
  private settingsCache: AppSettings | null = null;
  private lastAuthUid: string | null = null;

  constructor() {
    // Réinitialise les flux partagés si l'utilisateur change ou se déconnecte
    this.authService.currentUser$.subscribe(user => {
      const uid = user?.uid ?? null;
      if (uid !== this.lastAuthUid) {
        this.lastAuthUid = uid;
        this.clearCache();
      }
    });
  }

  clearCache(): void {
    this.resetStreams$.next();
    this.streamCache.clear();
    this.settingsCache = null;
  }

  /**
   * Flux Firestore temps réel partagé et mis en cache en mémoire :
   * - 1 seul listener onSnapshot par collection pour toute l'application
   * - Navigation instantanée (0 ms) entre les pages grâce à shareReplay(1)
   * - Mise à jour temps réel immédiate dès qu'un document change
   */
  private cachedCollection<T>(cacheKey: string, queryFactory: () => Query<DocumentData>): Observable<T[]> {
    const existing = this.streamCache.get(cacheKey);
    if (existing) return existing as Observable<T[]>;

    const stream$ = new Observable<T[]>((subscriber) => {
      const unsubscribe = onSnapshot(
        queryFactory(),
        (snapshot) => {
          const items = snapshot.docs.map(d => ({
            id: d.id,
            ...normalizeTimestamps<any>(d.data({ serverTimestamps: 'estimate' }))
          } as T));
          subscriber.next(items);
        },
        (error) => {
          console.error(`[DataService] Firestore onSnapshot error (${cacheKey}):`, error);
          this.streamCache.delete(cacheKey);
          subscriber.error(error);
        }
      );
      return () => unsubscribe();
    }).pipe(
      takeUntil(this.resetStreams$),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    this.streamCache.set(cacheKey, stream$);
    return stream$;
  }

  // ── Mapping moyen de paiement -> compte de trésorerie ──
  compteFromMoyen(moyen: string): string {
    switch (moyen) {
      case 'especes': return 'caisse_principale';
      case 'orange_money': return 'orange_money';
      case 'wave': return 'wave';
      case 'moov_money': return 'moov_money';
      case 'virement':
      case 'cheque': return 'banque';
      default: return 'caisse_principale';
    }
  }

  // ── Clients ────────────────────────────────────────────
  getClients(): Observable<Client[]> {
    return this.cachedCollection<Client>('clients', () =>
      query(collection(this.db, 'clients'), orderBy('nom'))
    );
  }

  async getNextClientCode(): Promise<string> {
    const cptRef = doc(this.db, 'parametres', 'compteurs');
    let code = '';
    await runTransaction(this.db, async (tx) => {
      const snap = await tx.get(cptRef);
      const next = (snap.exists() ? (snap.data()['clientCounter'] || 0) : 0) + 1;
      tx.set(cptRef, { clientCounter: next }, { merge: true });
      code = `CLI-${String(next).padStart(4, '0')}`;
    });
    return code;
  }

  async addClient(data: Omit<Client, 'id'>): Promise<string> {
    const ref = collection(this.db, 'clients');
    const code = data.code || await this.getNextClientCode();
    const docRef = await addDoc(ref, { ...data, code, createdAt: serverTimestamp() });
    return docRef.id;
  }

  async updateClient(id: string, data: Partial<Client>): Promise<void> {
    await updateDoc(doc(this.db, 'clients', id), stripUndefined(data as any));
  }

  // ── Produits ───────────────────────────────────────────
  getProduits(): Observable<Produit[]> {
    return this.cachedCollection<Produit>('produits', () =>
      query(collection(this.db, 'produits'), orderBy('nom'))
    );
  }

  async addProduit(data: Omit<Produit, 'id'>): Promise<string> {
    const ref = collection(this.db, 'produits');
    const docRef = await addDoc(ref, { ...data, createdAt: serverTimestamp() });
    return docRef.id;
  }

  async updateProduit(id: string, data: Partial<Produit>, ancienProduit?: Produit): Promise<void> {
    await updateDoc(doc(this.db, 'produits', id), stripUndefined(data as any));
    // STK-02: Enregistrer l'historique si un tarif a changé
    if (ancienProduit && (
      (data.prixDetail !== undefined && data.prixDetail !== ancienProduit.prixDetail) ||
      (data.prixGros !== undefined && data.prixGros !== ancienProduit.prixGros) ||
      (data.prixRevendeur !== undefined && data.prixRevendeur !== ancienProduit.prixRevendeur)
    )) {
      const user = this.authService.currentUser;
      void addDoc(collection(this.db, 'prix_historique'), {
        produitId: id,
        produitNom: data.nom || ancienProduit.nom,
        ancienPrixDetail: ancienProduit.prixDetail || 0,
        nouveauPrixDetail: data.prixDetail ?? ancienProduit.prixDetail ?? 0,
        ancienPrixGros: ancienProduit.prixGros || 0,
        nouveauPrixGros: data.prixGros ?? ancienProduit.prixGros ?? 0,
        ancienPrixRevendeur: ancienProduit.prixRevendeur || 0,
        nouveauPrixRevendeur: data.prixRevendeur ?? ancienProduit.prixRevendeur ?? 0,
        operateur: user?.displayName || 'Admin',
        createdAt: serverTimestamp(),
      }).catch(() => {});
    }
  }

  // ── STK-02: Historique des prix ───────────────────────
  getPrixHistorique(): Observable<PrixHistorique[]> {
    return this.cachedCollection<PrixHistorique>('prix_historique', () =>
      query(collection(this.db, 'prix_historique'), orderBy('createdAt', 'desc'), limit(200))
    );
  }

  // ── STK-01: Conversion atomique Pack -> Unités ────────
  async deconditionnerPack(params: {
    packProduitId: string;
    uniteProduitId: string;
    nbPacks: number;
    unitesParPack: number;
  }): Promise<void> {
    const { packProduitId, uniteProduitId, nbPacks, unitesParPack } = params;
    if (nbPacks <= 0 || unitesParPack <= 0) throw new Error('Quantités invalides.');
    const user = this.authService.currentUser;
    const operateur = user?.displayName || 'Admin';
    const packRef = doc(this.db, 'produits', packProduitId);
    const uniteRef = doc(this.db, 'produits', uniteProduitId);
    const totalUnites = nbPacks * unitesParPack;

    await runTransaction(this.db, async (tx) => {
      const [pSnap, uSnap] = await Promise.all([tx.get(packRef), tx.get(uniteRef)]);
      if (!pSnap.exists() || !uSnap.exists()) throw new Error('Produit source ou cible introuvable.');
      const pack = pSnap.data() as Produit;
      const unite = uSnap.data() as Produit;
      if ((pack.stock || 0) < nbPacks) {
        throw new Error(`Stock insuffisant pour "${pack.nom}" (${pack.stock || 0} disponible(s)).`);
      }
      tx.update(packRef, { stock: (pack.stock || 0) - nbPacks });
      tx.update(uniteRef, { stock: (unite.stock || 0) + totalUnites });
      tx.set(doc(collection(this.db, 'mouvements_stock')), {
        produitId: packProduitId,
        produitNom: pack.nom,
        type: 'sortie',
        quantite: nbPacks,
        delta: -nbPacks,
        motif: `Déconditionnement vers ${unite.nom} (+${totalUnites} unités)`,
        operateur,
        createdAt: serverTimestamp(),
      });
      tx.set(doc(collection(this.db, 'mouvements_stock')), {
        produitId: uniteProduitId,
        produitNom: unite.nom,
        type: 'entree',
        quantite: totalUnites,
        delta: totalUnites,
        motif: `Issu de ${nbPacks} pack(s) ${pack.nom}`,
        operateur,
        createdAt: serverTimestamp(),
      });
    });

    void this.logAudit(
      'STOCK_CONVERSION',
      'produits',
      `Déconditionnement de ${nbPacks} pack(s) en ${totalUnites} unité(s)`,
      user?.uid || '',
      operateur
    );
  }

  // ── Mouvements Stock (transaction atomique) ────────────
  getMouvements(): Observable<MouvementStock[]> {
    return this.cachedCollection<MouvementStock>('mouvements_stock', () =>
      query(collection(this.db, 'mouvements_stock'), orderBy('createdAt', 'desc'), limit(200))
    );
  }

  async addMouvement(data: Omit<MouvementStock, 'id'>): Promise<void> {
    const delta = data.delta !== undefined
      ? data.delta
      : (data.type === 'entree' ? Math.abs(data.quantite) : -Math.abs(data.quantite));

    const prodRef = doc(this.db, 'produits', data.produitId);
    const mvtRef = doc(collection(this.db, 'mouvements_stock'));

    await runTransaction(this.db, async (tx) => {
      const snap = await tx.get(prodRef);
      if (snap.exists()) {
        const current = (snap.data() as Produit).stock || 0;
        const nextStock = Math.max(0, current + delta);
        tx.update(prodRef, { stock: nextStock });
      }
      tx.set(mvtRef, {
        ...data,
        quantite: Math.abs(data.quantite),
        delta,
        createdAt: serverTimestamp()
      });
    });
  }

  // ── Ventes ─────────────────────────────────────────────
  getVentes(): Observable<Vente[]> {
    return this.authService.currentUser$.pipe(
      switchMap(user => {
        if (!user) return of([]);
        const isVendeur = user.role === 'vendeur';
        const key = isVendeur ? `ventes:${user.uid}` : 'ventes:all';
        if (isVendeur) {
          // Évite la nécessité d'un index composite (vendeurId + createdAt) en triant côté client
          return this.cachedCollection<Vente>(key, () =>
            query(collection(this.db, 'ventes'), where('vendeurId', '==', user.uid), limit(1000))
          ).pipe(
            map(list => [...list].sort((a, b) => {
              const ta = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt || 0).getTime();
              const tb = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt || 0).getTime();
              return tb - ta;
            }))
          );
        }
        return this.cachedCollection<Vente>(key, () =>
          query(collection(this.db, 'ventes'), orderBy('createdAt', 'desc'), limit(1000))
        );
      })
    );
  }

  async addVente(data: Omit<Vente, 'id'>): Promise<string> {
    const ref = collection(this.db, 'ventes');
    const docRef = await addDoc(ref, { ...data, createdAt: serverTimestamp() });
    return docRef.id;
  }

  /**
   * Création atomique d'une vente (CPT-09 + numérotation + stock + solde client + acompte initial)
   */
  async creerVenteAtomique(params: {
    clientId: string;
    clientNom: string;
    lignes: { produitId: string; produitNom: string; quantite: number; prixUnitaire: number; remise: number; total: number }[];
    sousTotal: number;
    remise: number;
    total: number;
    typeVente: 'comptant' | 'credit' | 'acompte';
    paiementMoyen?: Paiement['moyen'];
    acompteMontant?: number;
    acompteMoyen?: Paiement['moyen'];
    acompteRef?: string;
    forceCredit?: boolean;
    forceStock?: boolean;
    livraison?: boolean;
    notes?: string;
  }): Promise<{ venteId: string; numero: string }> {
    const user = this.authService.currentUser;
    const settings = this.settingsCache ?? await this.getSettings();
    const prefixe = settings?.prefixeFacture || 'FAC';
    const moisCourant = new Date().toISOString().slice(0, 7);

    const periodeRef = doc(this.db, 'periodes_comptables', moisCourant);
    const cptRef = doc(this.db, 'parametres', 'compteurs');
    const hasClient = !!params.clientId && params.clientId !== 'comptoir';
    const clientRef = hasClient ? doc(this.db, 'clients', params.clientId) : null;
    const venteRef = doc(collection(this.db, 'ventes'));

    // Agréger les quantités par produit (au cas où un produit apparaît sur 2 lignes)
    const qtyByProd = new Map<string, { nom: string; qty: number }>();
    for (const l of params.lignes) {
      if (!l.produitId || !l.quantite) continue;
      const prev = qtyByProd.get(l.produitId);
      qtyByProd.set(l.produitId, { nom: l.produitNom, qty: (prev?.qty || 0) + l.quantite });
    }
    const prodIds = Array.from(qtyByProd.keys());

    let numero = '';
    await runTransaction(this.db, async (tx) => {
      // 1. Toutes les lectures d'abord (exigence Firestore runTransaction)
      const [periodeSnap, cptSnap, clientSnap, ...prodSnaps] = await Promise.all([
        tx.get(periodeRef),
        tx.get(cptRef),
        clientRef ? tx.get(clientRef) : Promise.resolve(null),
        ...prodIds.map(id => tx.get(doc(this.db, 'produits', id))),
      ]);

      // Vérifier période comptable ouverte (CPT-09)
      if (periodeSnap.exists() && (periodeSnap.data() as any)['statut'] === 'cloturee') {
        throw new Error(`PERIODE_CLOTUREE:${moisCourant}`);
      }

      // Vérifier stock disponible en temps réel
      const prodUpdates: { ref: ReturnType<typeof doc>; nextStock: number }[] = [];
      for (let i = 0; i < prodIds.length; i++) {
        const pSnap = prodSnaps[i];
        const req = qtyByProd.get(prodIds[i])!;
        if (!pSnap.exists()) throw new Error(`Produit introuvable : ${req.nom}`);
        const currentStock = (pSnap.data() as Produit).stock || 0;
        if (currentStock < req.qty && !params.forceStock) {
          throw new Error(`Stock insuffisant pour "${req.nom}" : demandé ${req.qty}, disponible ${currentStock}`);
        }
        prodUpdates.push({ ref: doc(this.db, 'produits', prodIds[i]), nextStock: Math.max(0, currentStock - req.qty) });
      }

      // Vérifier client suspendu & plafond de crédit
      const montantEncaisse = params.typeVente === 'comptant'
        ? Math.max(0, params.total)
        : params.typeVente === 'acompte'
          ? Math.min(Math.max(0, params.acompteMontant || 0), params.total)
          : 0;
      const soldeRestant = Math.max(0, params.total - montantEncaisse);
      const clientData = clientSnap?.exists() ? (clientSnap.data() as Client) : null;

      if (params.typeVente === 'credit' && clientData) {
        if (clientData.statut === 'suspendu') {
          throw new Error(`Le client "${clientData.nom}" est suspendu et ne peut pas recevoir de vente à crédit.`);
        }
        if (!params.forceCredit && (clientData.plafondCredit || 0) > 0 && (clientData.solde || 0) + soldeRestant > clientData.plafondCredit) {
          throw new Error(`PLAFOND_CREDIT:${clientData.nom}`);
        }
      }

      // 2. Numérotation atomique
      const annee = new Date().getFullYear();
      let counter = 1;
      if (cptSnap.exists()) {
        const d = cptSnap.data();
        counter = (d['annee'] || annee) === annee ? (d['factureCounter'] || 0) + 1 : 1;
      }
      numero = `${prefixe}-${annee}-${String(counter).padStart(5, '0')}`;
      tx.set(cptRef, { factureCounter: counter, annee }, { merge: true });

      // 3. Créer la vente
      const paiementStatut = soldeRestant <= 0 ? 'paye' : (montantEncaisse > 0 ? 'partiel' : 'non_paye');
      const statut = soldeRestant <= 0 ? 'payee' : 'validee';
      tx.set(venteRef, stripUndefined({
        numero,
        clientId: params.clientId,
        clientNom: params.clientNom,
        vendeurId: user?.uid || '',
        vendeurNom: user?.displayName || '',
        lignes: params.lignes,
        sousTotal: params.sousTotal,
        remise: params.remise,
        total: params.total,
        typeVente: params.typeVente,
        statut,
        paiementStatut,
        montantPaye: montantEncaisse,
        soldeRestant,
        livraison: !!params.livraison,
        notes: params.notes || '',
        createdAt: serverTimestamp(),
      }));

      // 4. Mettre à jour les stocks + créer mouvements_stock
      for (const u of prodUpdates) {
        tx.update(u.ref, { stock: u.nextStock });
      }
      for (const l of params.lignes) {
        if (!l.produitId || !l.quantite) continue;
        tx.set(doc(collection(this.db, 'mouvements_stock')), {
          produitId: l.produitId,
          produitNom: l.produitNom,
          type: 'sortie',
          quantite: Math.abs(l.quantite),
          delta: -Math.abs(l.quantite),
          motif: `Vente ${numero}`,
          reference: numero,
          operateur: user?.displayName || '',
          createdAt: serverTimestamp(),
        });
      }

      // 5. Enregistrer le paiement initial (comptant intégral ou acompte) si > 0
      if (montantEncaisse > 0) {
        const moyen = params.typeVente === 'comptant'
          ? (params.paiementMoyen || 'especes')
          : (params.acompteMoyen || 'especes');
        tx.set(doc(collection(this.db, 'paiements')), {
          venteId: venteRef.id,
          clientId: params.clientId,
          montant: montantEncaisse,
          moyen,
          reference: params.acompteRef || '',
          compteTresorerie: this.compteFromMoyen(moyen),
          operateur: user?.displayName || '',
          createdAt: serverTimestamp(),
        });
      }

      // 6. Mettre à jour le solde client si crédit / acompte avec reste dû
      if (clientRef && clientData && ['credit', 'acompte'].includes(params.typeVente) && soldeRestant > 0) {
        tx.update(clientRef, { solde: (clientData.solde || 0) + soldeRestant });
      }
    });

    return { venteId: venteRef.id, numero };
  }

  async updateVente(id: string, data: Partial<Vente>): Promise<void> {
    await updateDoc(doc(this.db, 'ventes', id), stripUndefined(data as any));
  }

  async annulerVente(vente: Vente, motif: string): Promise<void> {
    if (!vente.id) throw new Error('Vente ID manquant');
    const user = this.authService.currentUser;
    const operateur = user?.displayName || 'Admin';

    // 1. Restituer le stock en parallèle pour toutes les lignes
    const stockRestores = (vente.lignes || [])
      .filter(l => l.produitId && l.quantite)
      .map(ligne => this.addMouvement({
        produitId: ligne.produitId,
        produitNom: ligne.produitNom,
        type: 'entree',
        quantite: ligne.quantite,
        delta: Math.abs(ligne.quantite),
        motif: `Annulation vente N° ${vente.numero} — ${motif}`,
        reference: vente.numero,
        operateur,
        createdAt: new Date(),
      }));

    // 2. Mettre à jour vente et solde client atomiquement en parallèle
    const venteRef = doc(this.db, 'ventes', vente.id);
    const hasClient = !!vente.clientId && vente.clientId !== 'comptoir';
    const clientRef = hasClient ? doc(this.db, 'clients', vente.clientId) : null;

    const updateTx = runTransaction(this.db, async (tx) => {
      const vSnap = await tx.get(venteRef);
      const cSnap = clientRef ? await tx.get(clientRef) : null;
      const soldeRestant = vSnap.exists() ? ((vSnap.data() as any).soldeRestant || 0) : (vente.soldeRestant || 0);

      tx.update(venteRef, {
        statut: 'annulee',
        soldeRestant: 0,
        motifAnnulation: motif,
        annulePar: operateur,
        annuleAt: serverTimestamp(),
      });

      if (clientRef && cSnap?.exists() && soldeRestant > 0) {
        const currentSolde = (cSnap.data() as Client).solde || 0;
        tx.update(clientRef, { solde: Math.max(0, currentSolde - soldeRestant) });
      }
    });

    await Promise.all([...stockRestores, updateTx]);

    // 3. Journal d'audit en arrière-plan
    void this.logAudit(
      'VENTE_ANNULEE',
      `Vente ${vente.numero}`,
      `Annulation (${vente.total.toLocaleString('fr-FR')} FCFA) — Motif : ${motif}`,
      user?.uid || '',
      operateur
    );
  }

  // ── Paiements (atomique avec vente + solde client) ─────
  getPaiements(): Observable<Paiement[]> {
    return this.cachedCollection<Paiement>('paiements', () =>
      query(collection(this.db, 'paiements'), orderBy('createdAt', 'desc'), limit(1000))
    );
  }

  async addPaiement(data: Omit<Paiement, 'id'>): Promise<string> {
    const ref = collection(this.db, 'paiements');
    const docRef = await addDoc(ref, {
      ...data,
      compteTresorerie: data.compteTresorerie || this.compteFromMoyen(data.moyen),
      createdAt: serverTimestamp()
    });
    return docRef.id;
  }

  async enregistrerPaiement(params: {
    vente: Vente;
    montant: number;
    moyen: Paiement['moyen'];
    reference?: string;
    operateur: string;
  }): Promise<string> {
    const { vente, montant, moyen, reference, operateur } = params;
    if (!vente.id) throw new Error('Vente ID manquant');
    const compteTresorerie = this.compteFromMoyen(moyen);
    const paiementRef = doc(collection(this.db, 'paiements'));
    const venteRef = doc(this.db, 'ventes', vente.id);
    const hasClient = !!vente.clientId && vente.clientId !== 'comptoir';
    const clientRef = hasClient ? doc(this.db, 'clients', vente.clientId) : null;

    await runTransaction(this.db, async (tx) => {
      const vSnap = await tx.get(venteRef);
      if (!vSnap.exists()) throw new Error('Vente introuvable');
      const cSnap = clientRef ? await tx.get(clientRef) : null;

      const vData = vSnap.data() as Vente;
      const montantPayeActuel = vData.montantPaye || 0;
      const nouveauMontantPaye = montantPayeActuel + montant;
      const nouveauSolde = Math.max(0, (vData.total || 0) - nouveauMontantPaye);
      const newPaiementStatut = nouveauSolde <= 0 ? 'paye' : 'partiel';

      tx.set(paiementRef, {
        venteId: vente.id,
        clientId: vente.clientId,
        montant,
        moyen,
        reference: reference || '',
        compteTresorerie,
        operateur,
        createdAt: serverTimestamp(),
      });

      tx.update(venteRef, {
        montantPaye: nouveauMontantPaye,
        soldeRestant: nouveauSolde,
        paiementStatut: newPaiementStatut,
        statut: nouveauSolde <= 0 ? 'payee' : vData.statut,
      });

      if (clientRef && cSnap?.exists()) {
        const currentSolde = (cSnap.data() as Client).solde || 0;
        if (currentSolde > 0) {
          tx.update(clientRef, { solde: Math.max(0, currentSolde - montant) });
        }
      }
    });

    return paiementRef.id;
  }

  // ── Dépenses ──────────────────────────────────────────
  getDepenses(): Observable<Depense[]> {
    return this.cachedCollection<Depense>('depenses', () =>
      query(collection(this.db, 'depenses'), orderBy('createdAt', 'desc'), limit(1000))
    );
  }

  async addDepense(data: Omit<Depense, 'id'>): Promise<string> {
    const periode = data.periode || this.localYearMonth();
    const pSnap = await getDoc(doc(this.db, 'periodes_comptables', periode));
    if (pSnap.exists() && (pSnap.data() as any)['statut'] === 'cloturee') {
      throw new Error(`PERIODE_CLOTUREE:${periode}`);
    }
    const ref = collection(this.db, 'depenses');
    const docRef = await addDoc(ref, { ...data, periode, createdAt: serverTimestamp() });
    return docRef.id;
  }

  async updateDepense(id: string, data: Partial<Depense>): Promise<void> {
    await updateDoc(doc(this.db, 'depenses', id), stripUndefined(data as any));
  }

  // ── CPT-02: Upload justificatif vers Cloud Storage ────
  async uploadJustificatif(file: File, folder: 'justificatifs' | 'livraisons' = 'justificatifs'): Promise<string> {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Fichier trop volumineux (max 5 Mo).');
    }
    const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const fileRef = storageRef(this.storage, `${folder}/${safeName}`);
    await uploadBytes(fileRef, file);
    return await getDownloadURL(fileRef);
  }

  // ── CPT-04: Dettes fournisseurs ───────────────────────
  getDettesFournisseurs(): Observable<DetteFournisseur[]> {
    return this.cachedCollection<DetteFournisseur>('dettes_fournisseurs', () =>
      query(collection(this.db, 'dettes_fournisseurs'), orderBy('createdAt', 'desc'), limit(200))
    );
  }

  async addDetteFournisseur(data: Omit<DetteFournisseur, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(this.db, 'dettes_fournisseurs'), {
      ...stripUndefined(data as any),
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  }

  async payerDetteFournisseur(dette: DetteFournisseur, montant: number, compteTresorerie: string): Promise<void> {
    if (!dette.id || montant <= 0) throw new Error('Montant invalide.');
    const user = this.authService.currentUser;
    const operateur = user?.displayName || 'Comptable';
    const detteRef = doc(this.db, 'dettes_fournisseurs', dette.id);
    const depenseRef = doc(collection(this.db, 'depenses'));
    const periode = this.localYearMonth();

    await runTransaction(this.db, async (tx) => {
      const snap = await tx.get(detteRef);
      if (!snap.exists()) throw new Error('Dette fournisseur introuvable.');
      const d = snap.data() as DetteFournisseur;
      const nextPaye = (d.montantPaye || 0) + montant;
      const nextSolde = Math.max(0, (d.montantTotal || 0) - nextPaye);
      const nextStatut = nextSolde <= 0 ? 'payee' : 'partiel';

      tx.update(detteRef, {
        montantPaye: nextPaye,
        soldeRestant: nextSolde,
        statut: nextStatut,
      });

      tx.set(depenseRef, {
        categorie: 'Matières premières',
        montant,
        description: `Règlement fournisseur ${d.fournisseur} (${d.reference})`,
        fournisseur: d.fournisseur,
        compteTresorerie,
        periode,
        operateur,
        createdAt: serverTimestamp(),
      });
    });

    void this.logAudit(
      'REGLEMENT_FOURNISSEUR',
      dette.fournisseur,
      `Règlement de ${montant.toLocaleString('fr-FR')} FCFA (réf. ${dette.reference})`,
      user?.uid || '',
      operateur
    );
  }

  // ── CLI-08: Emballages consignés (atomique) ───────────
  getConsignes(): Observable<ConsigneMouvement[]> {
    return this.cachedCollection<ConsigneMouvement>('consignes', () =>
      query(collection(this.db, 'consignes'), orderBy('createdAt', 'desc'), limit(200))
    );
  }

  async enregistrerConsigne(data: Omit<ConsigneMouvement, 'id'>): Promise<void> {
    if (!data.clientId || data.quantite <= 0) throw new Error('Client et quantité valides requis.');
    const clientRef = doc(this.db, 'clients', data.clientId);
    const consigneRef = doc(collection(this.db, 'consignes'));
    const delta = data.type === 'depot' ? Math.abs(data.quantite) : -Math.abs(data.quantite);

    await runTransaction(this.db, async (tx) => {
      const cSnap = await tx.get(clientRef);
      if (cSnap.exists()) {
        const current = (cSnap.data() as Client).consignesDetenues || 0;
        tx.update(clientRef, { consignesDetenues: Math.max(0, current + delta) });
      }
      tx.set(consigneRef, {
        ...stripUndefined(data as any),
        quantite: Math.abs(data.quantite),
        createdAt: serverTimestamp(),
      });
    });
  }

  // ── Numérotation atomique des factures ───────────────
  async getNextFactureNumber(): Promise<string> {
    const cptRef = doc(this.db, 'parametres', 'compteurs');
    const settings = this.settingsCache ?? await this.getSettings();
    const prefixe = settings?.prefixeFacture || 'FAC';
    let numero = '';
    await runTransaction(this.db, async (transaction) => {
      const snap = await transaction.get(cptRef);
      const annee = new Date().getFullYear();
      let counter = 1;
      let savedAnnee = annee;
      if (snap.exists()) {
        const data = snap.data();
        savedAnnee = data['annee'] || annee;
        counter = savedAnnee === annee ? (data['factureCounter'] || 0) + 1 : 1;
      }
      transaction.set(cptRef, { factureCounter: counter, annee }, { merge: true });
      numero = `${prefixe}-${annee}-${String(counter).padStart(5, '0')}`;
    });
    return numero;
  }

  // ── Livreurs ──────────────────────────────────────────
  getLivreurs(): Observable<Livreur[]> {
    return this.cachedCollection<Livreur>('livreurs', () =>
      query(collection(this.db, 'livreurs'), orderBy('nom'))
    );
  }

  async addLivreur(data: Omit<Livreur, 'id'>): Promise<string> {
    const ref = collection(this.db, 'livreurs');
    const docRef = await addDoc(ref, { ...data, createdAt: serverTimestamp() });
    return docRef.id;
  }

  async updateLivreur(id: string, data: Partial<Livreur>): Promise<void> {
    await updateDoc(doc(this.db, 'livreurs', id), stripUndefined(data as any));
  }

  // ── Livraisons (Firestore) ────────────────────────────
  getLivraisons(): Observable<Livraison[]> {
    return this.cachedCollection<Livraison>('livraisons', () =>
      query(collection(this.db, 'livraisons'), orderBy('createdAt', 'desc'), limit(1000))
    );
  }

  async addLivraison(data: Omit<Livraison, 'id'>): Promise<string> {
    const ref = collection(this.db, 'livraisons');
    const docRef = await addDoc(ref, { ...data, createdAt: serverTimestamp() });
    return docRef.id;
  }

  async updateLivraison(id: string, data: Partial<Livraison>): Promise<void> {
    await updateDoc(doc(this.db, 'livraisons', id), { ...stripUndefined(data as any), updatedAt: serverTimestamp() });
  }

  // ── Utils ─────────────────────────────────────────────
  private localYearMonth(d = new Date()): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  formatFCFA(amount: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 })
      .format(amount);
  }

  // ── Journal Audit ─────────────────────────────────────
  async logAudit(action: string, entite: string, detail: string, userId: string, userName: string): Promise<void> {
    try {
      await addDoc(collection(this.db, 'journal_audit'), {
        action, entite, detail, userId, userName, createdAt: serverTimestamp()
      });
    } catch { /* ne jamais bloquer le flux métier si l'audit échoue */ }
  }

  getAuditLogs(): Observable<any[]> {
    return this.cachedCollection<any>('journal_audit', () =>
      query(collection(this.db, 'journal_audit'), orderBy('createdAt', 'desc'), limit(200))
    );
  }

  // ── Paramètres (avec cache mémoire) ───────────────────
  async getSettings(forceRefresh = false): Promise<AppSettings | null> {
    if (!forceRefresh && this.settingsCache) return this.settingsCache;
    const snap = await getDoc(doc(this.db, 'parametres', 'config'));
    this.settingsCache = snap.exists() ? (snap.data() as AppSettings) : null;
    return this.settingsCache;
  }

  async saveSettings(data: Partial<AppSettings>): Promise<void> {
    await setDoc(doc(this.db, 'parametres', 'config'), { ...data, updatedAt: serverTimestamp() }, { merge: true });
    this.settingsCache = { ...(this.settingsCache || {} as AppSettings), ...data };
  }

  // ── Utilisateurs (profils Firestore) ─────────────────
  getUsers(): Observable<any[]> {
    return this.cachedCollection<any>('users', () =>
      query(collection(this.db, 'users'), orderBy('displayName'))
    );
  }

  async saveUserProfile(uid: string, data: any): Promise<void> {
    await setDoc(doc(this.db, 'users', uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });
  }

  async getUserProfile(uid: string): Promise<any> {
    const snap = await getDoc(doc(this.db, 'users', uid));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }

  // ── Périodes comptables ───────────────────────────────
  getPeriodes(): Observable<any[]> {
    return this.cachedCollection<any>('periodes_comptables', () =>
      query(collection(this.db, 'periodes_comptables'), orderBy('periode', 'desc'))
    );
  }

  async cloturerPeriode(periode: string, userId: string): Promise<void> {
    await setDoc(doc(this.db, 'periodes_comptables', periode), {
      periode,
      statut: 'cloturee',
      cloturePar: userId,
      clotureAt: serverTimestamp()
    }, { merge: true });
    void this.logAudit('CLOTURE_PERIODE', 'periodes_comptables', `Période ${periode} clôturée`, this.authService.currentUser?.uid || userId, userId);
  }

  async rouvrirPeriode(periode: string, motif: string, userId: string): Promise<void> {
    await setDoc(doc(this.db, 'periodes_comptables', periode), {
      periode,
      statut: 'ouverte',
      rouverturePar: userId,
      rouvertureMotif: motif,
      rouvertureAt: serverTimestamp()
    }, { merge: true });
    void this.logAudit('REOUVERTURE_PERIODE', 'periodes_comptables', `Période ${periode} réouverte: ${motif}`, this.authService.currentUser?.uid || userId, userId);
  }

  async initPeriodeIfMissing(periode: string): Promise<void> {
    const ref = doc(this.db, 'periodes_comptables', periode);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { periode, statut: 'ouverte', createdAt: serverTimestamp() });
    }
  }

  // ── Arrêtés de caisse ─────────────────────────────────
  getArretesCaisse(): Observable<any[]> {
    return this.cachedCollection<any>('arretes_caisse', () =>
      query(collection(this.db, 'arretes_caisse'), orderBy('createdAt', 'desc'))
    );
  }

  async saveArrete(data: any): Promise<string> {
    const docRef = await addDoc(collection(this.db, 'arretes_caisse'), { ...data, createdAt: serverTimestamp() });
    return docRef.id;
  }

  // ── Transferts ────────────────────────────────────────
  getTransferts(): Observable<any[]> {
    return this.cachedCollection<any>('transferts', () =>
      query(collection(this.db, 'transferts'), orderBy('createdAt', 'desc'))
    );
  }

  async addTransfert(data: any): Promise<void> {
    await addDoc(collection(this.db, 'transferts'), { ...data, createdAt: serverTimestamp() });
  }

  // ── Stats dashboard ───────────────────────────────────
  async getStatsJour(): Promise<{ ca: number; nbVentes: number; encaissements: number }> {
    const debut = new Date(); debut.setHours(0, 0, 0, 0);
    const fin = new Date(); fin.setHours(23, 59, 59, 999);
    const tsDebut = Timestamp.fromDate(debut);
    const tsFin = Timestamp.fromDate(fin);

    const [ventesSnap, paieSnap] = await Promise.all([
      getDocs(query(collection(this.db, 'ventes'), where('createdAt', '>=', tsDebut), where('createdAt', '<=', tsFin))),
      getDocs(query(collection(this.db, 'paiements'), where('createdAt', '>=', tsDebut), where('createdAt', '<=', tsFin))),
    ]);

    let ca = 0;
    ventesSnap.forEach(d => { ca += (d.data() as any).total || 0; });
    let encaissements = 0;
    paieSnap.forEach(d => { encaissements += (d.data() as any).montant || 0; });

    return { ca, nbVentes: ventesSnap.size, encaissements };
  }
}

# 01 — Cartographie et Audit d'Architecture (GWater)

> **Date d'audit :** 25 novembre 2026  
> **Stack détectée :** Angular `^22.3.0` (Standalone, Zoneless — sans `zone.js`), TypeScript `~6.0.2` (installé `6.0.3`), Tailwind CSS `^4.3.5`, `@angular/fire ^21.0.0`, `firebase ^13.4.0`, Vitest `^5.0.0` ([package.json:15-41](../../package.json#L15-L41)).  
> **Projet Firebase :** `gwaterdb` ([.firebaserc:1-5](../../.firebaserc#L1-L5), [src/app/core/firebase.config.ts:2-9](../../src/app/core/firebase.config.ts#L2-L9)).  
> **Périmètre :** analyse complète en lecture seule de l'ensemble du dépôt. Chaque constat est prouvé par fichier et numéro de ligne.

---

## 1. Arborescence commentée du dépôt

Architecture **100 % Standalone Components** (aucun `NgModule` applicatif, aucun `HttpInterceptor` ni `HttpClient` configuré dans [src/app/app.config.ts:15-35](../../src/app/app.config.ts#L15-L35)).

```text
GWater/
├── .firebaserc                              # Projet Firebase par défaut : "gwaterdb" (L1-5)
├── angular.json                             # Builder @angular/build:application, budgets 2MB/5MB, pas de polyfill zone.js (L20-59)
├── firebase.json                            # Config Firestore (rules + indexes) & Hosting SPA dist/gwater/browser (L1-11)
├── firestore.rules                          # Règles de sécurité Firestore RBAC (125 lignes)
├── firestore.indexes.json                   # 4 index composites Firestore (L1-9)
├── package.json                             # Dépendances Angular 22, Firebase 13, Tailwind 4, scripts npm (L1-43)
├── postcss.config.mjs                       # Pipeline PostCSS (@tailwindcss/postcss + autoprefixer) (L1-6)
├── tsconfig.json / tsconfig.app.json        # Config TS ES2022 — ATTENTION: "strict": true absent (tsconfig.json:5-16)
├── gwater-preview.html                      # Maquette HTML autonome hors build Angular (dette / artefact)
├── Cahier des charges — ...eau.md           # Spécification fonctionnelle & technique de référence (304 lignes)
├── scripts/
│   └── seed.js                              # Script Node ESM d'initialisation Firestore + profil SuperAdmin (124 lignes)
└── src/
    ├── index.html                           # Point d'entrée HTML, charge Google Fonts Inter (L9-11)
    ├── main.ts                              # Bootstrap standalone bootstrapApplication(App, appConfig) (L1-6)
    ├── styles.scss                          # @use "tailwindcss" + Design System CSS custom (--gw-*) (648 lignes)
    └── app/
        ├── app.config.ts                    # Providers: Router, FirebaseApp, Firestore (cache persistant), Auth (35 lignes)
        ├── app.routes.ts                    # Définition des routes racine et enfants protégés (63 lignes)
        ├── app.ts                           # Composant racine <app-root>, splash screen sur authService.loading$ (28 lignes)
        ├── app.html                         # ORPHELIN : template boilerplate Angular CLI non référencé (337 lignes)
        ├── app.scss                         # ORPHELIN : fichier vide non référencé (0 ligne)
        ├── app.spec.ts                      # Test boilerplate obsolète (attend "Hello, gwater") (24 lignes)
        ├── core/
        │   ├── firebase.config.ts           # Configuration publique Firebase Web SDK (9 lignes)
        │   ├── models.ts                    # Interfaces TypeScript métier (11 interfaces + UserRole) (163 lignes)
        │   ├── auth.service.ts              # Service Auth Firebase, signal currentUser, timeout inactivité 30 min (170 lignes)
        │   ├── auth.guard.ts                # Guard fonctionnel CanActivateFn : vérifie authentification (16 lignes)
        │   ├── role.guard.ts                # Guard fonctionnel CanActivateFn : vérifie route.data['roles'] (30 lignes)
        │   ├── data.service.ts              # Service d'accès Firestore (onSnapshot + shareReplay(1) + transactions) (507 lignes)
        │   ├── toast.service.ts             # Service de notifications toast (BehaviorSubject) (34 lignes)
        │   ├── print.service.ts             # ORPHELIN : impression facture A4 / reçu 80mm (non injecté) (171 lignes)
        │   ├── whatsapp.service.ts          # Ouverture liens wa.me (utilisé uniquement par rapports.component.ts) (46 lignes)
        │   └── fcfa.pipe.ts                 # ORPHELIN : Pipe standalone 'fcfa' (jamais importé) (15 lignes)
        ├── layout/
        │   └── layout.component.ts          # Shell principal : sidebar par rôle, header, router-outlet, toasts (259 lignes)
        └── pages/
            ├── login/login.component.ts     # Page de connexion e-mail / mot de passe (139 lignes)
            ├── setup/setup.component.ts     # Page d'initialisation du premier compte SuperAdmin (185 lignes)
            ├── dashboard/dashboard.component.ts      # Tableau de bord 3 vues (Admin, Vendeur, Comptable) (712 lignes)
            ├── clients/clients.component.ts          # CRUD clients, impayés, segmentation, import/export CSV, relevé (974 lignes)
            ├── stock/stock.component.ts              # Catalogue produits, mouvements, inventaire physique, pertes (746 lignes)
            ├── ventes/ventes.component.ts            # Ventes, facturation, encaissements, annulations, livraisons (1225 lignes)
            ├── livreurs/livreurs.component.ts        # CRUD livreurs (225 lignes)
            ├── comptabilite/comptabilite.component.ts# Trésorerie, journal, dépenses, résultat, créances, arrêtés, clôtures (1149 lignes)
            ├── rapports/rapports.component.ts        # Analyses filtrables (ventes, balance âgée, stock, caisse, dépenses) + CSV/PDF (796 lignes)
            └── admin/admin.component.ts              # Utilisateurs, journal d'audit, paramètres entreprise & métier (612 lignes)
```

**Synthèse par catégorie Angular :**
- **Modules (`NgModule`) :** 0 (100 % standalone).
- **Composants :** 12 (`App`, `LayoutComponent`, `LoginComponent`, `SetupComponent`, `DashboardComponent`, `ClientsComponent`, `StockComponent`, `VentesComponent`, `LivreursComponent`, `ComptabiliteComponent`, `RapportsComponent`, `AdminComponent`).
- **Services :** 5 (`AuthService`, `DataService`, `ToastService`, `PrintService` [inutilisé], `WhatsappService` [sous-utilisé]).
- **Guards :** 2 (`authGuard`, `roleGuard`).
- **Interceptors :** 0 (aucun appel HTTP REST — communication directe SDK Firebase).
- **Pipes :** 1 (`FcfaPipe` [inutilisé]).

---

## 2. Cartographie des routes

Source unique : [src/app/app.routes.ts:1-63](../../src/app/app.routes.ts#L1-L63).

| Chemin | Composant | Lazy-loaded | Guards (`canActivate`) | Rôles autorisés (`data.roles`) | Référence |
| --- | --- | --- | --- | --- | --- |
| `/login` | `LoginComponent` | ✅ `loadComponent` | Aucun (public) | Tous | [app.routes.ts:6](../../src/app/app.routes.ts#L6) |
| `/setup` | `SetupComponent` | ✅ `loadComponent` | Aucun (public) | Tous ⚠️ (voir §7) | [app.routes.ts:7](../../src/app/app.routes.ts#L7) |
| `/` (shell) | `LayoutComponent` | ✅ `loadComponent` | `authGuard` | Authentifié actif | [app.routes.ts:8-11](../../src/app/app.routes.ts#L8-L11) |
| `/` (index) | Redirection → `/dashboard` (`full`) | — | Hérite `authGuard` | Authentifié actif | [app.routes.ts:13](../../src/app/app.routes.ts#L13) |
| `/dashboard` | `DashboardComponent` | ✅ `loadComponent` | Hérite `authGuard` | Tous rôles authentifiés | [app.routes.ts:14-17](../../src/app/app.routes.ts#L14-L17) |
| `/clients` | `ClientsComponent` | ✅ `loadComponent` | `authGuard` + `roleGuard` | `superadmin`, `admin`, `vendeur`, `comptable` | [app.routes.ts:18-23](../../src/app/app.routes.ts#L18-L23) |
| `/stock` | `StockComponent` | ✅ `loadComponent` | `authGuard` + `roleGuard` | `superadmin`, `admin`, `vendeur`, `comptable` | [app.routes.ts:24-29](../../src/app/app.routes.ts#L24-L29) |
| `/ventes` | `VentesComponent` | ✅ `loadComponent` | `authGuard` + `roleGuard` | `superadmin`, `admin`, `vendeur` | [app.routes.ts:30-35](../../src/app/app.routes.ts#L30-L35) |
| `/livreurs` | `LivreursComponent` | ✅ `loadComponent` | `authGuard` + `roleGuard` | `superadmin`, `admin`, `vendeur` | [app.routes.ts:36-41](../../src/app/app.routes.ts#L36-L41) |
| `/comptabilite` | `ComptabiliteComponent` | ✅ `loadComponent` | `authGuard` + `roleGuard` | `superadmin`, `admin`, `comptable` | [app.routes.ts:42-47](../../src/app/app.routes.ts#L42-L47) |
| `/rapports` | `RapportsComponent` | ✅ `loadComponent` | `authGuard` + `roleGuard` | `superadmin`, `admin`, `vendeur`, `comptable` | [app.routes.ts:48-53](../../src/app/app.routes.ts#L48-L53) |
| `/admin` | `AdminComponent` | ✅ `loadComponent` | `authGuard` + `roleGuard` | `superadmin`, `admin` | [app.routes.ts:54-59](../../src/app/app.routes.ts#L54-L59) |
| `/**` | Redirection → `''` (`/dashboard`) | — | — | — | [app.routes.ts:62](../../src/app/app.routes.ts#L62) |

**Remarque guards :** `authGuard` ([auth.guard.ts:6-16](../../src/app/core/auth.guard.ts#L6-L16)) et `roleGuard` ([role.guard.ts:7-30](../../src/app/core/role.guard.ts#L7-L30)) attendent tous deux `auth.loading$ === false` avant de lire `currentUser$`. Aucun guard inverse (`guestGuard`) n'empêche un utilisateur déjà connecté d'accéder à `/login` ou `/setup`.

---

## 3. Modèle de données Firestore déduit

Déduit depuis [src/app/core/models.ts](../../src/app/core/models.ts), [src/app/core/data.service.ts](../../src/app/core/data.service.ts), [firestore.rules](../../firestore.rules), [firestore.indexes.json](../../firestore.indexes.json) et [scripts/seed.js](../../scripts/seed.js).

### 3.1 Collections et schémas

| Collection | Clé doc | Champs principaux | Relations (clés étrangères logiques) | Références |
| --- | --- | --- | --- | --- |
| `users` | `uid` (Firebase Auth) | `uid`, `email`, `displayName`, `role` (`superadmin\|admin\|vendeur\|comptable`), `status` (`actif\|inactif`), `createdBy`, `createdByName`, `createdAt`, `updatedAt`, `lastLogin` | `createdBy` → `users.uid` | [models.ts:3-12](../../src/app/core/models.ts#L3-L12), [admin.component.ts:540-549](../../src/app/pages/admin/admin.component.ts#L540-L549), [seed.js:34-42](../../scripts/seed.js#L34-L42) |
| `clients` | auto-ID | `code` (`CLI-0001`), `nom`, `type`, `telephone`, `whatsapp`, `adresse`, `quartier`, `grilleTarifaire` (`detail\|gros\|revendeur`), `modePaiement`, `plafondCredit`, `delaiPaiement`, `solde`, `statut` (`actif\|suspendu\|archive`), `notes`, `createdAt`, `createdBy` | `createdBy` → `users.uid` | [models.ts:14-32](../../src/app/core/models.ts#L14-L32), [data.service.ts:86-101](../../src/app/core/data.service.ts#L86-L101) |
| `produits` | auto-ID | `code`, `nom`, `categorie`, `unite` (`unite\|pack\|palette`), `prixDetail`, `prixGros`, `prixRevendeur`, `coutAchat`, `stock`, `seuilAlerte`, `statut` (`actif\|inactif`), `createdAt` | Référencé par `mouvements_stock.produitId`, `ventes.lignes[].produitId` | [models.ts:34-48](../../src/app/core/models.ts#L34-L48), [data.service.ts:104-119](../../src/app/core/data.service.ts#L104-L119) |
| `mouvements_stock` | auto-ID | `produitId`, `produitNom`, `type` (`entree\|sortie\|ajustement\|perte`), `quantite`, `delta`, `cout`, `motif`, `reference`, `operateur`, `createdAt` | `produitId` → `produits.id`, `reference` → `ventes.numero` | [models.ts:50-62](../../src/app/core/models.ts#L50-L62), [data.service.ts:122-151](../../src/app/core/data.service.ts#L122-L151) |
| `ventes` | auto-ID | `numero` (`FAC-AAAA-00001`), `clientId`, `clientNom`, `vendeurId`, `vendeurNom`, `lignes[]` (`produitId`, `produitNom`, `quantite`, `prixUnitaire`, `remise`, `total`), `sousTotal`, `remise`, `total`, `typeVente`, `statut`, `paiementStatut`, `montantPaye`, `soldeRestant`, `livraison`, `notes`, `motifAnnulation`, `annulePar`, `annuleAt`, `createdAt` | `clientId` → `clients.id` (ou `'comptoir'`), `vendeurId` → `users.uid` | [models.ts:64-92](../../src/app/core/models.ts#L64-L92), [data.service.ts:154-231](../../src/app/core/data.service.ts#L154-L231) |
| `paiements` | auto-ID | `venteId`, `clientId`, `montant`, `moyen`, `reference`, `compteTresorerie`, `operateur`, `createdAt` | `venteId` → `ventes.id`, `clientId` → `clients.id` | [models.ts:94-104](../../src/app/core/models.ts#L94-L104), [data.service.ts:234-301](../../src/app/core/data.service.ts#L234-L301) |
| `depenses` | auto-ID | `categorie`, `montant`, `description`, `fournisseur`, `justificatif` *(non rempli)*, `compteTresorerie`, `periode` (`YYYY-MM`), `operateur`, `createdAt` | `periode` → `periodes_comptables.periode` | [models.ts:106-117](../../src/app/core/models.ts#L106-L117), [data.service.ts:304-321](../../src/app/core/data.service.ts#L304-L321) |
| `livreurs` | auto-ID | `nom`, `telephone`, `vehicule`, `statut` (`actif\|inactif`), `createdAt` | Référencé par `livraisons.livreurId` | [models.ts:119-126](../../src/app/core/models.ts#L119-L126), [data.service.ts:346-361](../../src/app/core/data.service.ts#L346-L361) |
| `livraisons` | auto-ID | `venteId`, `venteNumero`, `clientId`, `clientNom`, `adresse`, `livreurId`, `livreur`, `statut` (`a_livrer\|en_cours\|livree\|echec`), `datePrevue`, `motifEchec`, `createdAt`, `updatedAt` | `venteId` → `ventes.id`, `clientId` → `clients.id`, `livreurId` → `livreurs.id` | [models.ts:128-141](../../src/app/core/models.ts#L128-L141), [data.service.ts:364-379](../../src/app/core/data.service.ts#L364-L379) |
| `parametres` | `config` / `compteurs` | `config`: `nomEntreprise`, `devise`, `adresse`, `telephone`, `email`, `prefixeFacture`, `plafondRemiseVendeur`, `delaiPaiementDefaut`, `seuilStockAlerte`, `moyensPaiement[]`, `createdAt`, `updatedAt` · `compteurs`: `factureCounter`, `annee` | Lu par `getNextFactureNumber()` et `AdminComponent` | [models.ts:143-154](../../src/app/core/models.ts#L143-L154), [data.service.ts:324-343](../../src/app/core/data.service.ts#L324-L343), [seed.js:46-71](../../scripts/seed.js#L46-L71) |
| `periodes_comptables` | `YYYY-MM` | `periode`, `statut` (`ouverte\|cloturee`), `cloturePar`, `clotureAt`, `rouverturePar`, `rouvertureMotif`, `rouvertureAt`, `createdAt` | Référencée logiquement par `depenses.periode` | [data.service.ts:430-467](../../src/app/core/data.service.ts#L430-L467), [seed.js:100-105](../../scripts/seed.js#L100-L105) |
| `arretes_caisse` | auto-ID | `caisse`, `montantTheorique`, `montantCompte`, `ecart`, `explication`, `operateur`, `userId`, `createdAt` | `userId` → `users.uid` | [data.service.ts:470-480](../../src/app/core/data.service.ts#L470-L480), [comptabilite.component.ts:1076-1084](../../src/app/pages/comptabilite/comptabilite.component.ts#L1076-L1084) |
| `transferts` | auto-ID | `source`, `destination`, `montant`, `motif`, `userId`, `createdAt` | `userId` → `users.uid` | [data.service.ts:483-493](../../src/app/core/data.service.ts#L483-L493), [comptabilite.component.ts:1054-1060](../../src/app/pages/comptabilite/comptabilite.component.ts#L1054-L1060) |
| `journal_audit` | auto-ID | `action`, `entite`, `detail`, `userId`, `userName`, `createdAt` | `userId` → `users.uid` | [data.service.ts:392-406](../../src/app/core/data.service.ts#L392-L406) |

> **Collections mentionnées dans le cahier des charges mais absentes du code :** `grilles_tarifaires` / historique des prix (`STK-02`), `comptes_tresorerie` (les soldes sont recalculés à la volée côté client dans [comptabilite.component.ts:836-892](../../src/app/pages/comptabilite/comptabilite.component.ts#L836-L892) et [dashboard.component.ts:472-490](../../src/app/pages/dashboard/dashboard.component.ts#L472-L490)), `fournisseurs` (`STK-10`), `consignes` (`CLI-08`), `depots` (`STK-09`).

### 3.2 Index composites déclarés ([firestore.indexes.json:1-9](../../firestore.indexes.json#L1-L9))

| Collection | Champs indexés | Utilisé par une requête dans le code ? |
| --- | --- | --- |
| `ventes` | `vendeurId ASC`, `createdAt DESC` | ✅ Oui — `DataService.getVentes()` pour le rôle `vendeur` ([data.service.ts:161](../../src/app/core/data.service.ts#L161)) |
| `ventes` | `clientId ASC`, `createdAt DESC` | ❌ Non (filtrage fait côté client dans [clients.component.ts:680](../../src/app/pages/clients/clients.component.ts#L680)) |
| `paiements` | `clientId ASC`, `createdAt DESC` | ❌ Non (tous les paiements sont chargés via `orderBy('createdAt', 'desc'), limit(200)` à [data.service.ts:237](../../src/app/core/data.service.ts#L237)) |
| `mouvements_stock` | `produitId ASC`, `createdAt DESC` | ❌ Non (tous les mouvements sont chargés via `orderBy('createdAt', 'desc'), limit(200)` à [data.service.ts:124](../../src/app/core/data.service.ts#L124)) |

---

## 4. Services Firebase utilisés et configuration

| Service Firebase | Statut | Configuration & Preuves |
| --- | --- | --- |
| **Firebase App** | ✅ Actif | `provideFirebaseApp(() => initializeApp(firebaseConfig))` ([app.config.ts:19](../../src/app/app.config.ts#L19)), config projet `gwaterdb` ([firebase.config.ts:2-9](../../src/app/core/firebase.config.ts#L2-L9)). Instance secondaire temporaire à la création d'utilisateur dans [admin.component.ts:532](../../src/app/pages/admin/admin.component.ts#L532). |
| **Firebase Authentication** | ✅ Actif | `provideAuth(() => getAuth())` ([app.config.ts:33](../../src/app/app.config.ts#L33)). Méthodes utilisées : `signInWithEmailAndPassword`, `signOut`, `onAuthStateChanged`, `sendPasswordResetEmail` ([auth.service.ts:2-8](../../src/app/core/auth.service.ts#L2-L8)), `createUserWithEmailAndPassword`, `updateProfile` ([setup.component.ts:5](../../src/app/pages/setup/setup.component.ts#L5), [admin.component.ts:6](../../src/app/pages/admin/admin.component.ts#L6)). |
| **Cloud Firestore** | ✅ Actif | `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }), experimentalAutoDetectLongPolling: true })` ([app.config.ts:20-32](../../src/app/app.config.ts#L20-L32)). Lecture temps réel via `onSnapshot` natif + cache mémoire `shareReplay(1)` ([data.service.ts:46-68](../../src/app/core/data.service.ts#L46-L68)). Transactions atomiques (`runTransaction`) sur `addMouvement`, `annulerVente`, `enregistrerPaiement`, `getNextFactureNumber`. |
| **Firestore Security Rules** | ⚠️ Définies en local | [firestore.rules:1-125](../../firestore.rules#L1-L125) — RBAC basé sur `get(/databases/.../users/$(request.auth.uid)).data.role` + `status == 'actif'` avec fallback Custom Claims. À déployer dans Firebase Console / CLI (remplace la règle temporaire `if request.auth != null`). |
| **Firebase Hosting** | ⚠️ Configuré uniquement | [firebase.json:6-10](../../firebase.json#L6-L10) pointe sur `dist/gwater/browser` avec rewrite SPA `** -> /index.html`. |
| **Cloud Functions** | ❌ Absent | Aucun dossier `functions/`, aucune configuration dans [firebase.json:1-11](../../firebase.json#L1-L11). Pas de Custom Claims posés côté serveur. |
| **Cloud Storage** | ❌ Absent | Non configuré dans [app.config.ts](../../src/app/app.config.ts), aucune règle `storage.rules` (bloque `CPT-02` pièces justificatives et `VEN-06` preuves de livraison). |
| **Firebase App Check** | ❌ Absent | Non configuré (exigé en section 9 du cahier des charges, [Cahier des charges:255](../../Cahier%20des%20charges%20%E2%80%94%20Application%20web%20de%20gestion%20d'une%20entreprise%20de%20vente%20d'eau.md#L255)). |

---

## 5. Matrice des fonctionnalités par module métier

Légende : ✅ complet · ⚠️ partiel · ❌ manquant · 🐞 bugué

| Module | Sous-fonctionnalité | Statut | Preuves (fichier + ligne) |
| --- | --- | --- | --- |
| **Authentification & RBAC** | Connexion e-mail/mdp, chargement rôle `users/{uid}`, blocage compte `inactif`, timeout 30 min | ✅ | [auth.service.ts:40-156](../../src/app/core/auth.service.ts#L40-L156), [login.component.ts:116-138](../../src/app/pages/login/login.component.ts#L116-L138) |
| | Protection des routes (`authGuard`, `roleGuard`) & menu par rôle | ✅ | [app.routes.ts:10-59](../../src/app/app.routes.ts#L10-L59), [role.guard.ts:7-30](../../src/app/core/role.guard.ts#L7-L30), [layout.component.ts:169-203](../../src/app/layout/layout.component.ts#L169-L203) |
| | Page `/setup` premier SuperAdmin | 🐞 | [setup.component.ts:130-139](../../src/app/pages/setup/setup.component.ts#L130-L139) — `getDocs('users')` sans auth échoue dès que les règles RBAC sont déployées ; le `catch` passe `alreadySetup = false` et réaffiche le formulaire. |
| | Changement forcé mot de passe à la 1re connexion & Custom Claims serveur | ❌ | Absent du code (requis par [Cahier des charges:53,57](../../Cahier%20des%20charges%20%E2%80%94%20Application%20web%20de%20gestion%20d'une%20entreprise%20de%20vente%20d'eau.md#L53)). |
| **Clients** | CRUD, recherche, filtres, pagination, segmentation, impayés + WhatsApp, relevé imprimable, import/export CSV, détection doublon tél. | ✅ | [clients.component.ts:624-973](../../src/app/pages/clients/clients.component.ts#L624-L973) |
| | Modification client par un `vendeur` avec `firestore.rules` déployées | 🐞 | [clients.component.ts:375-377](../../src/app/pages/clients/clients.component.ts#L375-L377) + [clients.component.ts:942](../../src/app/pages/clients/clients.component.ts#L942) envoie tous les champs (`plafondCredit`, `statut`) dans `updateClient()`, alors que [firestore.rules:49](../../firestore.rules#L49) bloque un vendeur si ces clés diffèrent ; même si inchangées, le champ reste éditable en UI. |
| | Génération code `CLI-XXXX` & emballages consignés (`CLI-08`) | ⚠️ / ❌ | Code basé sur `clients().length + 1` non atomique ([clients.component.ts:946](../../src/app/pages/clients/clients.component.ts#L946)). Consignes (`CLI-08`) absentes. |
| **Stock & Produits** | CRUD produits, grilles tarifaires, mouvements atomiques (`delta` signé), inventaire physique, pertes valorisées, alertes stock bas, filtres mouvements | ✅ | [stock.component.ts:485-745](../../src/app/pages/stock/stock.component.ts#L485-L745), [data.service.ts:127-151](../../src/app/core/data.service.ts#L127-L151) |
| | Historique des prix (`STK-02`), conversion auto pack ↔ unité (`STK-01`), dérogation Admin stock insuffisant | ❌ | Aucune collection/logique de conversion pack→unité ou historique de prix dans [stock.component.ts](../../src/app/pages/stock/stock.component.ts). |
| **Ventes & Livraisons** | Création vente, numérotation atomique `FAC-AAAA-00001`, grille tarifaire client, contrôle stock & crédit, blocage client suspendu, encaissement atomique, annulation + restitution stock/solde, persistance livraisons & livreurs Firestore | ✅ | [ventes.component.ts:670-1224](../../src/app/pages/ventes/ventes.component.ts#L670-L1224), [data.service.ts:171-301](../../src/app/core/data.service.ts#L171-L301) |
| | Vente de type `acompte` | 🐞 | `acompteMontant` déclaré à [ventes.component.ts:634](../../src/app/pages/ventes/ventes.component.ts#L634) et utilisé à [ventes.component.ts:947](../../src/app/pages/ventes/ventes.component.ts#L947), **mais aucun champ `<input>`** ne permet de le saisir dans le template ; `montantPaye` est toujours enregistré à `0` ([ventes.component.ts:918](../../src/app/pages/ventes/ventes.component.ts#L918)). |
| | Bouton « Exporter PDF » liste ventes, ticket 80mm (`VEN-08`), partage WhatsApp facture, plafond remise dynamique | ⚠️ / 🐞 | Bouton sans `(click)` ([ventes.component.ts:42](../../src/app/pages/ventes/ventes.component.ts#L42)) ; `PrintService.printRecu()` non branché ([print.service.ts:116](../../src/app/core/print.service.ts#L116)) ; plafond remise codé en dur à `5%` ([ventes.component.ts:306,331,796,800](../../src/app/pages/ventes/ventes.component.ts#L796-L800)) au lieu de `parametres/config.plafondRemiseVendeur`. |
| | Atomicité globale de création d'une vente (vente + stock + solde client) | ⚠️ | `addVente` ([ventes.component.ts:905](../../src/app/pages/ventes/ventes.component.ts#L905)) puis `Promise.all` ([ventes.component.ts:967](../../src/app/pages/ventes/ventes.component.ts#L967)) ne sont pas dans une seule transaction Firestore. |
| **Livreurs** | CRUD livreurs + recherche + activation/désactivation | ✅ | [livreurs.component.ts:120-225](../../src/app/pages/livreurs/livreurs.component.ts#L120-L225) |
| **Comptabilité** | Trésorerie dynamique, journal filtrable, dépenses, compte de résultat + marges produits, balance âgée, transferts, arrêtés de caisse, gestion des périodes, exports PDF | ✅ | [comptabilite.component.ts:750-1149](../../src/app/pages/comptabilite/comptabilite.component.ts#L750-L1149) |
| | Verrouillage effectif des écritures sur période clôturée (`CPT-09`) | ❌ | Aucune vérification de `periodes_comptables/{mois}.statut === 'cloturee'` lors de `saveVente`, `saveDepense`, `enregistrerPaiement` ni dans [firestore.rules](../../firestore.rules). |
| | Pièces justificatives dépenses (`CPT-02`), dettes fournisseurs (`CPT-04`), édition de dépense | ❌ | Upload supprimé (Cloud Storage absent) ; `updateDepense` ([data.service.ts:319](../../src/app/core/data.service.ts#L319)) non relié dans l'UI ; pas de module dettes fournisseurs. |
| **Tableau de bord** | 3 vues dédiées (Admin/SuperAdmin, Vendeur, Comptable), KPIs temps réel, graphique 7j, top clients, alertes stock, activité audit, trésorerie & balance âgée | ✅ | [dashboard.component.ts:370-712](../../src/app/pages/dashboard/dashboard.component.ts#L370-L712) |
| **Rapports** | 5 onglets Firestore temps réel (ventes, balance âgée, stock, caisse, dépenses), filtres, exports CSV & PDF, relance WhatsApp | ✅ | [rapports.component.ts:435-796](../../src/app/pages/rapports/rapports.component.ts#L435-L796) |
| | Rapport tournées/livraisons (`Cahier des charges:215`) | ❌ | Absent des onglets de [rapports.component.ts:443-449](../../src/app/pages/rapports/rapports.component.ts#L443-L449). |
| **Administration** | Liste/recherche/création/édition/activation utilisateurs, reset mdp par e-mail, journal d'audit filtrable, paramètres entreprise & métier (SuperAdmin) | ✅ | [admin.component.ts:311-612](../../src/app/pages/admin/admin.component.ts#L311-L612) |
| | Restrictions hiérarchiques fines côté UI (Admin ne désactive que les comptes qu'il a créés) | ⚠️ | `toggleUser` ([admin.component.ts:582-611](../../src/app/pages/admin/admin.component.ts#L582-L611)) protège `superadmin` et soi-même, mais ne vérifie pas `u.creepar === currentUser` (cf. [Cahier des charges:42](../../Cahier%20des%20charges%20%E2%80%94%20Application%20web%20de%20gestion%20d'une%20entreprise%20de%20vente%20d'eau.md#L42)). |
| **Layout / Shell** | Navigation filtrée par rôle, sidebar rétractable, toasts, déconnexion | ✅ | [layout.component.ts:28-259](../../src/app/layout/layout.component.ts#L28-L259) |
| | Recherche globale, panneau notifications, bouton Paramètres header, « Mon profil », titre de page | 🐞 / ❌ | `onSearch()` vide ([layout.component.ts:252](../../src/app/layout/layout.component.ts#L252)), `showNotifs` sans template ([layout.component.ts:101,165](../../src/app/layout/layout.component.ts#L101)), boutons Paramètres/Mon profil sans action ([layout.component.ts:108,121-124](../../src/app/layout/layout.component.ts#L108)), `window.location.pathname` non réactif au router ([layout.component.ts:217](../../src/app/layout/layout.component.ts#L217)). |

---

## 6. Dépendances obsolètes ou vulnérables

Exécution directe de `npm audit` et `npm outdated` le 25/11/2026.

### 6.1 Vulnérabilités (`npm audit`)

- **Résultat :** **5 vulnérabilités `high`** (toutes liées à la même dépendance transitive `@grpc/grpc-js <=1.13.5`).
  - **Advisory 1 :** [GHSA-m9gg-hp2v-232j](https://github.com/advisories/GHSA-m9gg-hp2v-232j) — `@grpc/grpc-js`: `getAuthContext` peut retourner des certificats non autorisés comme autorisés.
  - **Advisory 2 :** [GHSA-f596-whhp-79r4](https://github.com/advisories/GHSA-f596-whhp-79r4) — `@grpc/grpc-js`: transmission de messages d'erreur serveur dans les status messages client.
  - **Chaîne de dépendance :** `@angular/fire` → `firebase` → `@firebase/firestore-compat` → `@firebase/firestore` → `@grpc/grpc-js`.
  - **Impact réel :** `@grpc/grpc-js` est utilisé uniquement par le client Firestore en environnement **Node.js** (ex. `scripts/seed.js`), pas dans le bundle navigateur (qui utilise WebChannel/HTTP).
  - **Attention :** `npm audit fix --force` propose un downgrade destructif vers `firebase@9.14.0` (ne **pas** exécuter). Privilégier un `overrides` ciblé sur `@grpc/grpc-js` dès publication d'un correctif compatible ou une mise à jour de `firebase` / `@angular/fire`.

### 6.2 Dépendances obsolètes (`npm outdated`)

| Package | Installé (`Current`) | Attendu (`Wanted`) | Dernier (`Latest`) | Source |
| --- | --- | --- | --- | --- |
| `typescript` | `6.0.3` | `6.0.3` | `7.0.2` | [package.json:40](../../package.json#L40) |

### 6.3 Dépendances déclarées mais inutilisées dans `src/`

| Package | Déclaration | Occurrences dans `src/` | Impact |
| --- | --- | --- | --- |
| `@angular/material` `^22.3.0` | [package.json:22](../../package.json#L22) | 0 | Alourdit `node_modules` / maintenance inutile |
| `@angular/cdk` `^22.3.0` | [package.json:16](../../package.json#L16) | 0 | Idem |
| `lucide-angular` `^1.0.0` | [package.json:26](../../package.json#L26) | 0 (icônes en SVG inline + emojis) | Idem |

---

## 7. Dette technique et incohérences d'architecture

### 7.1 Sécurité & cohérence backend
1. **Absence de Cloud Functions / Custom Claims** ([firebase.json:1-11](../../firebase.json#L1-L11)) : la création de comptes passe par une instance secondaire Firebase côté navigateur ([admin.component.ts:532](../../src/app/pages/admin/admin.component.ts#L532)) et les transactions complexes (vente + stock + solde) sont orchestrées par le client. Cela contrevient au [Cahier des charges:53,230,275](../../Cahier%20des%20charges%20%E2%80%94%20Application%20web%20de%20gestion%20d'une%20entreprise%20de%20vente%20d'eau.md#L275).
2. **Route `/setup` exposée & cassée sous règles RBAC** ([app.routes.ts:7](../../src/app/app.routes.ts#L7), [setup.component.ts:130-139](../../src/app/pages/setup/setup.component.ts#L130-L139)) : accessible sans authentification ; son contrôle `alreadySetup` échoue silencieusement si `users` exige `request.auth != null`.
3. **Configuration Firebase dupliquée et sans environnements** : copiée à l'identique dans [src/app/core/firebase.config.ts:2-9](../../src/app/core/firebase.config.ts#L2-L9) et [scripts/seed.js:9-16](../../scripts/seed.js#L9-L16) ; pas de séparation `environment.ts` / `environment.prod.ts`.
4. **Limitation de pagination Firestore à `limit(200)`** ([data.service.ts:124,161-162,237,307,367,405](../../src/app/core/data.service.ts#L124)) : les agrégations client (CA mensuel, trésorerie totale, balance âgée, marges, top clients) deviendront **fausses** dès que la base dépassera 200 ventes, paiements ou dépenses (le cahier des charges vise 100 000 ventes/an, [Cahier des charges:254](../../Cahier%20des%20charges%20%E2%80%94%20Application%20web%20de%20gestion%20d'une%20entreprise%20de%20vente%20d'eau.md#L254)).

### 7.2 Qualité de code & architecture Angular
5. **Composants monolithiques (templates & logique inline)** : `ventes.component.ts` (1 225 lignes), `comptabilite.component.ts` (1 149 lignes), `clients.component.ts` (974 lignes), `rapports.component.ts` (796 lignes), `stock.component.ts` (746 lignes), `dashboard.component.ts` (712 lignes), `admin.component.ts` (612 lignes). Aucun découpage en sous-composants (modales, tableaux, filtres) ni fichiers `.html`/`.scss` séparés.
6. **Mix Zoneless Signals + propriétés mutables + `ChangeDetectorRef.markForCheck()`** : l'application tourne en Zoneless (`angular.json` sans `zone.js`) mais mélange `signal()` et propriétés classiques mutées en place ([dashboard.component.ts:386-435](../../src/app/pages/dashboard/dashboard.component.ts#L386-L435), [comptabilite.component.ts:679-731](../../src/app/pages/comptabilite/comptabilite.component.ts#L679-L731), [admin.component.ts:360-361](../../src/app/pages/admin/admin.component.ts#L360-L361)), imposant des `cdr.markForCheck()` manuels fragiles.
7. **Mode TypeScript non strict & abus de `any`** : `"strict": true` est absent de [tsconfig.json:5-16](../../tsconfig.json#L5-L16) ; nombreux `as any` dans [data.service.ts](../../src/app/core/data.service.ts), [clients.component.ts](../../src/app/pages/clients/clients.component.ts), [admin.component.ts](../../src/app/pages/admin/admin.component.ts), [comptabilite.component.ts](../../src/app/pages/comptabilite/comptabilite.component.ts).
8. **Code mort & duplications** :
   - Fichiers orphelins : [src/app/app.html](../../src/app/app.html) (337 lignes), [src/app/app.scss](../../src/app/app.scss), [src/app/core/fcfa.pipe.ts](../../src/app/core/fcfa.pipe.ts), [src/app/core/print.service.ts](../../src/app/core/print.service.ts), `gwater-preview.html`.
   - Formatage FCFA dupliqué 5 fois ([data.service.ts:386](../../src/app/core/data.service.ts#L386), [dashboard.component.ts:452](../../src/app/pages/dashboard/dashboard.component.ts#L452), [rapports.component.ts:724](../../src/app/pages/rapports/rapports.component.ts#L724), [print.service.ts:168](../../src/app/core/print.service.ts#L168), [whatsapp.service.ts:43](../../src/app/core/whatsapp.service.ts#L43)).
   - Helper `toDate()` dupliqué dans 5 composants (`clients`, `ventes`, `comptabilite`, `dashboard`, `rapports`).
   - Logique WhatsApp dupliquée dans [clients.component.ts:796-802](../../src/app/pages/clients/clients.component.ts#L796-L802) et [comptabilite.component.ts:1143-1148](../../src/app/pages/comptabilite/comptabilite.component.ts#L1143-L1148) au lieu d'utiliser `WhatsappService`.
   - Méthodes inutilisées dans `DataService` : `addPaiement` (L241), `updateDepense` (L319), `getUserProfile` (L424), `getStatsJour` (L489).
   - Utilisation de `confirm()` natif navigateur dans [clients.component.ts:966](../../src/app/pages/clients/clients.component.ts#L966) et [stock.component.ts:605](../../src/app/pages/stock/stock.component.ts#L605).
9. **Incohérences métier / géographiques dans les documents imprimables** :
   - Conakry / Guinée (`+224`) dans [scripts/seed.js:29-30](../../scripts/seed.js#L29-L30) et [clients.component.ts:821,835](../../src/app/pages/clients/clients.component.ts#L821).
   - Dakar / Sénégal (`+221`, `contact@gwater.sn`) codé en dur dans [ventes.component.ts:1014-1016](../../src/app/pages/ventes/ventes.component.ts#L1014-L1016) (n'utilise pas `parametres/config`).
   - Lomé / Togo (`+228`) dans [print.service.ts:70](../../src/app/core/print.service.ts#L70) et [livreurs.component.ts:95](../../src/app/pages/livreurs/livreurs.component.ts#L95).
10. **Tests & CI inexistants** : 1 seul fichier de test ([src/app/app.spec.ts:1-24](../../src/app/app.spec.ts#L1-L24)) obsolète (teste `Hello, gwater`), aucun test unitaire/intégration sur les règles métier, guards ou règles Firestore, aucun dépôt Git détecté (`.git` absent).
11. **Build production dépendant d'Internet pour Google Fonts** : [src/index.html:11](../../src/index.html#L11) déclenche l'inlining réseau de Google Fonts lors de `ng build` (échoue en environnement hors-ligne si `optimization.fonts` n'est pas configuré ou si la police n'est pas hébergée localement).

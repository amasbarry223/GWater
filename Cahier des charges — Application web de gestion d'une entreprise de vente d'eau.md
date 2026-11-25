# Cahier des charges — Application web de gestion d'une entreprise de vente d'eau

Nov 25, 2026 · @Amasbarry

## 1. Contexte, objectifs et périmètre

L'application web centralise la gestion d'une entreprise de vente d'eau (eau en bouteille de 0,5 L et de 1,5 L) : clients, stock, ventes, livraisons et comptabilité, avec des accès strictement cloisonnés par rôle.

**Contexte.** L'entreprise vend de l'eau en gros et au détail, avec livraison. Aujourd'hui, le suivi (cahiers, WhatsApp, Excel) génère des erreurs de stock, des créances non suivies et aucune vision fiable de la rentabilité.

**Objectifs.**

- Tracer chaque vente, chaque paiement et chaque mouvement de stock.
- Suivre les créances clients (ventes à crédit) et relancer les impayés.
- Donner au dirigeant une vue en temps réel : chiffre d'affaires, dépenses, marge, stock critique.
- Garantir la sécurité par un contrôle d'accès par rôle (RBAC) à création hiérarchique.

**Périmètre inclus.** Authentification et RBAC · module Clients · Produits & Stock · Ventes (commandes, livraisons, encaissements) · Comptabilité · Tableau de bord et rapports · Administration (journal d'audit, paramètres).

**Hors périmètre (version 1).** Application mobile native, paiement en ligne intégré, boutique en ligne publique pour les clients, paie des employés, gestion de flotte détaillée. Ils pourront être ajoutés en version 2.

**Hypothèses de travail** (à valider en section 10) : monnaie unique en FCFA, une seule entreprise (mono-société), un ou plusieurs points de vente/dépôts, interface en français, usage possible sur connexion faible (pages légères, saisie rapide).

## 2. Acteurs et hiérarchie des comptes

L'application compte quatre rôles seulement, créés en cascade : le Superadmin crée les Admin, et chaque Admin crée les Vendeurs et Comptables.

&#91;embedded content: hiérarchie des comptes · 4 rôles\]

Aucun compte ne se crée seul : il n'y a pas d'inscription publique.

| Rôle | Créé par | Mission | Effectif indicatif |
| --- | --- | --- | --- |
| Superadmin | Installation (compte initial) | Propriétaire technique : crée et désactive les Admin, voit tout, accède aux paramètres globaux et au journal d'audit | 1 à 2 |
| Admin | Superadmin | Directeur / gérant : pilote l'activité, crée les autres acteurs, gère clients, produits, stock, prix, validations | 1 à 3 |
| Vendeur | Admin | Opérationnel terrain/caisse : enregistre clients, ventes, livraisons et encaissements | 2 à 10 |
| Comptable | Admin | Tient la comptabilité : dépenses, caisse, rapprochements, états financiers, clôtures | 1 à 2 |

**Règles de gestion des comptes**

- Un Admin ne peut créer ni Admin ni Superadmin ; un Vendeur ou un Comptable ne crée aucun compte.
- Un compte n'est jamais supprimé : il est désactivé (l'historique reste intact). Un Admin ne peut désactiver que les comptes qu'il a créés ; le Superadmin peut tout désactiver.
- Le Superadmin initial est créé à l'installation (script d'initialisation), jamais via l'interface.
- Les livreurs n'ont pas de compte : ce sont de simples fiches (nom, téléphone, véhicule) que le Vendeur affecte aux livraisons. Cela garde le nombre d'acteurs minimal.

## 3. Authentification, RBAC et permissions

Chaque action est autorisée côté serveur (règles de sécurité Firestore et Cloud Functions) selon le rôle de l'utilisateur connecté ; masquer un bouton dans l'interface ne suffit jamais.

**Authentification**

- Connexion par e-mail et mot de passe, via Firebase Authentication. Pas d'inscription publique.
- À la création d'un compte, une Cloud Function (Admin SDK) crée le compte avec un mot de passe temporaire, affiché une seule fois au créateur ; l'utilisateur doit le changer dès la première connexion.
- Mots de passe gérés et hachés par Firebase Authentication, jamais stockés dans l'application ; minimum 8 caractères avec lettres et chiffres.
- Blocage temporaire après échecs répétés (protection native de Firebase Authentication) ; déconnexion automatique après 30 min d'inactivité côté application.
- Réinitialisation du mot de passe par le créateur du compte (Superadmin pour un Admin, Admin pour les autres), via une Cloud Function sécurisée.
- Jeton d'identité Firebase de courte durée, renouvelé automatiquement ; le rôle est porté par un custom claim que seule une Cloud Function peut poser ; HTTPS natif via Firebase Hosting.
- Option prévue en version 1.1 : code à usage unique (OTP par SMS) pour Superadmin et Admin.

**RBAC.** Chaque rôle est un ensemble fixe de couples module + action (voir, créer, modifier, valider, exporter). Les rôles sont fixes en version 1 ; des rôles personnalisés pourront venir plus tard. Le Superadmin dispose de tous les droits ; les cases ci-dessous précisent le périmètre des trois autres.

| Fonction | Superadmin | Admin | Vendeur | Comptable |
| --- | --- | --- | --- | --- |
| Créer / désactiver des Admin | Oui | — | — | — |
| Créer / désactiver Vendeurs et Comptables | Lecture | Oui | — | — |
| Paramètres globaux (société, numérotation, seuils) | Oui | Lecture | — | — |
| Journal d'audit | Oui | Oui | — | — |
| Clients : consulter | Oui | Oui | Oui | Lecture |
| Clients : créer / modifier | Oui | Oui | Oui | — |
| Clients : archiver, fixer plafond de crédit | Oui | Oui | — | — |
| Produits et tarifs : gérer | Oui | Oui | Lecture | Lecture |
| Stock : consulter | Oui | Oui | Oui | Oui |
| Stock : inventaire et ajustements | Oui | Oui | — | Lecture |
| Ventes : créer commande, facture, livraison | Oui | Oui | Oui | — |
| Ventes : annuler, remise au-dessus du plafond | Oui | Oui | Demande | — |
| Encaissements : saisir | Oui | Oui | Oui | Lecture |
| Dépenses et écritures comptables | Oui | Oui | — | Oui |
| Clôture de période | Oui | Oui | — | Oui |
| Tableau de bord et rapports financiers | Oui | Oui | Ses ventes | Oui |
| Exports Excel / PDF | Oui | Oui | Ses données | Oui |

**Contrôles complémentaires**

- Un Vendeur ne voit que ses propres ventes et encaissements, sauf décision contraire de l'Admin.
- Toute action sensible (annulation, ajustement de stock, remise hors plafond, désactivation de compte, clôture) est journalisée : qui, quand, avant/après.

## 4. Module Clients

Le module Clients tient un fichier unique, avec type, tarif applicable, plafond de crédit et historique complet des achats et paiements.

**Fiche client** : code auto (CLI-0001), nom ou raison sociale, type (particulier, boutique/revendeur, restaurant ou entreprise, institution), téléphone principal et WhatsApp, adresse et quartier, point de repère de livraison, contact secondaire, grille tarifaire, mode de paiement habituel, plafond de crédit, délai de paiement (jours), statut (actif, suspendu, archivé), notes.

| ID | Exigence | Priorité |
| --- | --- | --- |
| CLI-01 | Créer, modifier et archiver un client ; détection de doublon sur le téléphone | Essentiel |
| CLI-02 | Recherche instantanée par nom, téléphone, code, quartier ; filtres par type et statut | Essentiel |
| CLI-03 | Affecter un type de client qui détermine la grille tarifaire (détail, gros, revendeur) | Essentiel |
| CLI-04 | Plafond de crédit : blocage ou alerte à la vente si le solde dépasse le plafond | Essentiel |
| CLI-05 | Fiche détaillée : solde actuel, achats, paiements, livraisons, échéances en cours | Essentiel |
| CLI-06 | Relevé de compte client imprimable / PDF avec partage WhatsApp | Important |
| CLI-07 | Liste des impayés par ancienneté (0-30, 31-60, plus de 60 jours) avec relance (lien WhatsApp prérempli) | Important |
| CLI-08 | Gestion des emballages consignés (casiers, palettes) si applicable : nombre détenu par client, retours | Important |
| CLI-09 | Import Excel/CSV des clients existants et export de la liste | Important |
| CLI-10 | Segmentation simple : meilleurs clients, clients inactifs depuis N jours | Option |

**Règles de gestion**

- Un client ayant un historique ne se supprime pas : il est archivé.
- Seuls l'Admin et le Superadmin modifient le plafond de crédit ou suspendent un client.
- Un client suspendu reste consultable mais ne peut plus recevoir de vente à crédit.

## 5. Module Produits et Stock

Chaque mouvement de stock (entrée, vente, perte, ajustement) est enregistré et rattaché à un utilisateur ; le stock affiché est toujours le résultat de ces mouvements.

**Catalogue** : deux produits vendus, l'eau en bouteille de 0,5 L et de 1,5 L (à l'unité ou en pack, nombre de bouteilles par pack à confirmer), avec code, catégorie, unité (unité, pack, palette), prix par grille tarifaire, coût d'achat ou de production, seuil d'alerte.

| ID | Exigence | Priorité |
| --- | --- | --- |
| STK-01 | Catalogue produits avec catégories, unités et conversion (pack = N unités) | Essentiel |
| STK-02 | Grilles tarifaires (détail, gros, revendeur) et historique des changements de prix | Essentiel |
| STK-03 | Entrées de stock : production ou achat, avec fournisseur, quantité et coût | Essentiel |
| STK-04 | Sortie automatique du stock à la validation d'une vente ou d'une livraison | Essentiel |
| STK-05 | Stock en temps réel par produit (et par dépôt si plusieurs) | Essentiel |
| STK-06 | Alerte de stock bas selon le seuil de chaque produit, visible sur le tableau de bord | Essentiel |
| STK-07 | Inventaire physique : saisie du comptage, écart et ajustement justifié (Admin) | Important |
| STK-08 | Pertes et casse : déclaration avec motif, valorisée au coût | Important |
| STK-09 | Transfert entre dépôts / points de vente | Option |
| STK-10 | Gestion des fournisseurs et bons de commande d'achat | Option |

**Règles de gestion**

- Le stock n'est jamais édité directement : tout ajustement passe par un mouvement justifié.
- Une vente est refusée si le stock disponible est insuffisant, sauf dérogation de l'Admin.
- Un produit vendu au moins une fois ne se supprime pas : il est désactivé.

## 6. Module Ventes

Une vente suit un parcours unique, de la commande à l'encaissement, et met à jour automatiquement le stock et le solde du client.

**Parcours d'une vente**

1. Le Vendeur choisit le client (ou "client comptoir" pour une vente anonyme au comptant) et ajoute les produits ; le prix vient de la grille du client.
2. Le système contrôle le stock disponible et, à crédit, le plafond du client.
3. La vente est validée : une facture numérotée est générée et le stock est débité.
4. Si livraison : un livreur et un créneau sont affectés ; la livraison passe de "à livrer" à "livrée" ou "échec".
5. Le paiement est encaissé (total ou partiel, immédiat ou différé) ; le solde du client se met à jour.

| ID | Exigence | Priorité |
| --- | --- | --- |
| VEN-01 | Création de vente en moins de 5 écrans, utilisable à la caisse (recherche produit/client rapide) | Essentiel |
| VEN-02 | Types de vente : comptant, crédit, acompte ; ventes au comptoir et sur commande | Essentiel |
| VEN-03 | Facture et bon de livraison PDF numérotés (FAC-AAAA-00001), logo et mentions de l'entreprise | Essentiel |
| VEN-04 | Remises par ligne ou globale, plafonnées par rôle ; au-delà, validation Admin | Essentiel |
| VEN-05 | Encaissement multi-moyens : espèces, Orange Money, Wave, Moov Money, virement, chèque ; paiements partiels | Essentiel |
| VEN-06 | Suivi des livraisons : statut, livreur, date, preuve (signature ou photo) | Important |
| VEN-07 | Annulation ou avoir : seulement Admin, avec motif, restitution automatique du stock | Essentiel |
| VEN-08 | Reçu imprimable (format ticket 80 mm et A4) et envoi par WhatsApp | Important |
| VEN-09 | Commandes récurrentes (abonnement hebdomadaire/mensuel pour les gros clients) | Option |
| VEN-10 | Tournées de livraison groupées par quartier | Option |

**Règles de gestion**

- Une facture validée n'est pas modifiable : on l'annule (Admin) et on en émet une nouvelle.
- Un Vendeur ne peut pas vendre en dessous du prix de la grille sans validation.
- Le numéro de facture suit une séquence continue, sans trou, gérée par le système.
- Le paiement Mobile Money est saisi manuellement avec sa référence de transaction en version 1 (pas d'intégration automatique).

## 7. Module Comptabilité

Le module Comptabilité alimente automatiquement les recettes depuis les ventes et les encaissements, et le Comptable y ajoute les dépenses et les contrôles ; il s'agit d'une comptabilité de gestion simplifiée, pas d'un logiciel comptable réglementaire complet.

**Contenu**

- Caisses et comptes de trésorerie : caisse espèces, comptes Orange Money / Wave / Moov Money, banque, avec solde en temps réel.
- Recettes : générées automatiquement par les encaissements des ventes.
- Dépenses : catégories (matières premières, électricité, carburant, salaires, entretien, loyer, transport, divers), pièce justificative jointe, fournisseur.
- Créances clients et dettes fournisseurs avec échéances.

| ID | Exigence | Priorité |
| --- | --- | --- |
| CPT-01 | Journal de caisse et de trésorerie par compte, avec solde d'ouverture et de clôture | Essentiel |
| CPT-02 | Saisie des dépenses par catégorie, avec pièce jointe (photo/PDF) | Essentiel |
| CPT-03 | Recettes générées automatiquement depuis les encaissements, non modifiables manuellement | Essentiel |
| CPT-04 | Suivi des créances clients (balance âgée) et dettes fournisseurs | Essentiel |
| CPT-05 | Transferts entre comptes (ex. caisse vers banque, Mobile Money vers caisse) | Important |
| CPT-06 | Arrêté de caisse quotidien : montant attendu, montant compté, écart justifié | Important |
| CPT-07 | Compte de résultat simplifié (recettes - coût des ventes - charges = résultat) par période | Essentiel |
| CPT-08 | Marge brute par produit et par client | Important |
| CPT-09 | Clôture mensuelle : verrouille la période, plus aucune écriture modifiable | Important |
| CPT-10 | Export des écritures vers Excel pour un expert-comptable ; TVA si l'entreprise y est assujettie | Option |

**Règles de gestion**

- Toute écriture est horodatée et attribuée ; une écriture validée se corrige par une écriture inverse, jamais par effacement.
- Une période clôturée ne peut être rouverte que par un Admin ou le Superadmin, avec motif consigné dans le journal d'audit.
- Le coût des ventes utilise le coût moyen pondéré du stock (méthode à valider).

## 8. Tableau de bord, rapports et administration

Chaque rôle arrive sur un tableau de bord adapté à ses droits ; l'Admin et le Comptable y lisent en un coup d'œil l'état de l'activité.

**Tableau de bord**

- Admin / Superadmin : chiffre d'affaires du jour, de la semaine et du mois ; encaissements ; créances en cours ; dépenses ; résultat ; top produits et top clients ; alertes de stock bas ; ventes par vendeur.
- Vendeur : ses ventes du jour, ses encaissements, ses livraisons à effectuer.
- Comptable : trésorerie par compte, créances et dettes à échéance, dépenses du mois, écarts de caisse.

**Rapports** (filtres par période, vendeur, produit, client ; export PDF et Excel)

- Ventes par période, produit, client et vendeur.
- Balance âgée des créances clients.
- État du stock et mouvements valorisés.
- Journal de caisse, dépenses par catégorie, compte de résultat simplifié.
- Rapport de tournées et livraisons (réussies, échouées, délais).

**Administration**

| ID | Exigence | Priorité |
| --- | --- | --- |
| ADM-01 | Gestion des utilisateurs : création, réinitialisation du mot de passe, activation/désactivation, selon la hiérarchie de la section 2 | Essentiel |
| ADM-02 | Journal d'audit non modifiable : connexions, créations, modifications sensibles, annulations, clôtures | Essentiel |
| ADM-03 | Paramètres de l'entreprise : nom, logo, adresse, mentions légales, devise, numérotation des documents | Essentiel |
| ADM-04 | Paramètres métier : plafonds de remise, seuils de stock, délais de paiement par défaut, moyens de paiement | Important |
| ADM-05 | Sauvegarde automatique quotidienne de Firestore (export planifié vers Cloud Storage) et procédure de restauration testée | Essentiel |
| ADM-06 | Notifications internes (stock bas, impayé dépassé, clôture à faire) ; SMS ou WhatsApp en option | Option |

## 9. Données, exigences techniques et stack

Le modèle tient en une quinzaine de collections Firestore ; les opérations critiques (vente, stock, solde, numéro de facture) passent par des transactions dans des Cloud Functions pour garantir leur intégrité.

**Collections principales (Firestore)**

| Entité | Contenu clé | Liens |
| --- | --- | --- |
| Utilisateur | identifiant, mot de passe haché, rôle, statut, créé par | créé par un autre Utilisateur |
| Client | code, type, grille tarifaire, plafond, solde | a des Ventes, Paiements |
| Produit | code, catégorie, unité, coût, seuil | a des Prix, Mouvements de stock |
| Grille tarifaire / Prix | produit, grille, montant, date d'effet | liée aux Clients |
| Mouvement de stock | produit, dépôt, type, quantité, coût, auteur | lié à une Vente ou un Inventaire |
| Vente / Ligne de vente | client, vendeur, statut, total, remise | génère Facture, Livraison |
| Facture | numéro, date, montant, statut | issue d'une Vente |
| Livraison / Livreur | statut, date, livreur, preuve | liée à une Vente |
| Paiement | montant, moyen, référence, compte de trésorerie | lié à Client et Facture |
| Compte de trésorerie | type (caisse, mobile money, banque), solde | reçoit Paiements, Dépenses |
| Dépense / Catégorie | montant, date, fournisseur, justificatif | débite un Compte de trésorerie |
| Période comptable | mois, statut (ouverte, clôturée) | verrouille les écritures |
| Journal d'audit | utilisateur, action, entité, avant/après, date | tout |

**Exigences non fonctionnelles**

- Performance : pages courantes affichées en moins de 2 secondes sur connexion 3G ; recherche client/produit en moins de 500 ms.
- Disponibilité : 99 % en heures ouvrées ; sauvegarde quotidienne, conservation 30 jours dans Cloud Storage.
- Capacité : 20 utilisateurs simultanés, 10 000 clients, 100 000 ventes par an sans dégradation.
- Sécurité : HTTPS, contrôle d'accès côté serveur, règles de sécurité Firestore strictes (aucun accès public), protection XSS native d'Angular, Firebase App Check, données chiffrées au repos par Google Cloud.
- Ergonomie : interface en français, responsive (ordinateur, tablette, téléphone), formulaires courts, montants affichés en FCFA sans décimales.
- Maintenabilité : code versionné, migrations de base, documentation d'installation et d'exploitation.

**Stack proposée** (modifiable)

| Couche | Choix |
| --- | --- |
| Interface | Angular + TypeScript, Angular Material, AngularFire |
| API | Cloud Functions for Firebase (TypeScript) pour la logique sensible ; règles de sécurité Firestore pour le RBAC |
| Base de données | Cloud Firestore, cache hors ligne activé pour les connexions faibles |
| Authentification | Firebase Authentication (e-mail / mot de passe), rôle en custom claim |
| Documents | Génération PDF dans une Cloud Function, fichiers dans Cloud Storage |
| Hébergement | Firebase Hosting (HTTPS inclus) ; exports Firestore planifiés |

**Contraintes propres à Firebase**

- Firestore n'a ni jointures ni agrégats : le chiffre d'affaires, les soldes clients et les stocks sont maintenus par des compteurs mis à jour dans des transactions (Cloud Functions), puis lus directement par les tableaux de bord.
- Les Cloud Functions exigent le plan Blaze (paiement à l'usage, gratuit jusqu'à un quota qui suffit à ce volume).
- Le RBAC est appliqué deux fois : règles de sécurité Firestore (lecture/écriture par rôle) et vérification du custom claim dans chaque Cloud Function.
- La numérotation continue des factures et la création de comptes passent obligatoirement par Cloud Functions, jamais par le navigateur.

## 10. Phasage, livrables et points à valider

La version 1 se livre en quatre phases, les modules "Essentiel" d'abord ; les durées sont indicatives pour un développeur principal.

1. **Phase 1 — Fondations (2 semaines)** : modèle de données, authentification, RBAC, création hiérarchique des comptes, journal d'audit, paramètres.
2. **Phase 2 — Clients, Produits, Stock (3 semaines)** : fiches, grilles tarifaires, mouvements et alertes de stock.
3. **Phase 3 — Ventes et Comptabilité (4 semaines)** : parcours de vente, factures PDF, encaissements, livraisons, dépenses, trésorerie, créances, clôture.
4. **Phase 4 — Tableaux de bord, rapports, recette (2 semaines)** : tableaux de bord par rôle, rapports et exports, tests, formation, mise en production.

**Livrables** : application déployée en production · code source et dépôt versionné · manuel utilisateur par rôle (PDF) · guide d'installation et de sauvegarde · session de formation des Admin, Vendeurs et Comptables.

**Critères de recette**

- Un Admin créé par le Superadmin peut créer un Vendeur et un Comptable ; aucun rôle ne peut sortir de son périmètre (test de la matrice de la section 3).
- Une vente à crédit met à jour le stock, le solde client et la facture ; son annulation restitue le tout.
- Le compte de résultat d'un mois test est cohérent avec les ventes et dépenses saisies.
- Une sauvegarde est restaurée avec succès sur un environnement de test.

**Points à valider avant développement**

- [ ] Un seul site ou plusieurs points de vente / dépôts ?
- [ ] Combien de bouteilles par pack pour le 0,5 L et pour le 1,5 L ? Y a-t-il des emballages consignés ?
- [ ] L'entreprise produit-elle son eau (donc un module production) ou la revend-elle ?
- [ ] Les Vendeurs voient-ils tous les clients ou seulement les leurs ?
- [ ] Le Superadmin peut-il saisir des ventes, ou seulement superviser ?
- [ ] TVA applicable ? Mentions légales exactes pour les factures ?
- [ ] Intégration automatique Orange Money / Wave souhaitée en version 2 ?
- [ ] Hébergement : compte Firebase (plan Blaze) existant ou à créer ?

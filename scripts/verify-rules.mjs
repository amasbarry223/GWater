// scripts/verify-rules.mjs
// Vérification structurelle des règles Firestore et Cloud Storage
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const fsRules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const stRules = readFileSync(new URL('../storage.rules', import.meta.url), 'utf8');

// 1. Vérifier que toutes les collections métier sont protégées dans firestore.rules
const requiredCollections = [
  'users', 'clients', 'consignes', 'produits', 'prix_historique',
  'mouvements_stock', 'ventes', 'paiements', 'depenses',
  'dettes_fournisseurs', 'livreurs', 'livraisons', 'journal_audit',
  'parametres', 'periodes_comptables', 'arretes_caisse', 'transferts'
];

for (const col of requiredCollections) {
  assert.ok(
    fsRules.includes(`match /${col}/`),
    `Collection manquante dans firestore.rules : ${col}`
  );
}

// 2. Vérifier le verrouillage RBAC, immuabilité et périodes clôturées
assert.ok(fsRules.includes('function isActiveUser()'), 'isActiveUser() requis');
assert.ok(fsRules.includes('function isPeriodeOuverte(periode)'), 'isPeriodeOuverte() requis');
assert.ok(fsRules.includes('isPeriodeOuverte(request.resource.data.periode)'), 'Vérification période ouverte sur depenses create');
assert.ok(fsRules.includes('allow delete: if false;'), 'Suppression interdite sur entités critiques');
assert.ok(!fsRules.includes('allow read, write: if true'), 'Aucune règle permissive globale autorisée');

// 3. Vérifier storage.rules (taille <= 5 Mo, image/PDF, dossiers autorisés + deny par défaut)
assert.ok(stRules.includes('5 * 1024 * 1024'), 'Limite 5 Mo requise dans storage.rules');
assert.ok(stRules.includes('match /justificatifs/'), 'Règle justificatifs manquante');
assert.ok(stRules.includes('match /livraisons/'), 'Règle livraisons manquante');
assert.ok(stRules.includes('allow read, write: if false;'), 'Deny-all par défaut manquant dans storage.rules');

console.log(`✅ Vérification des règles réussie (${requiredCollections.length} collections Firestore + Storage rules validées).`);

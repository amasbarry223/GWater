// scripts/seed.js
// Exécuter: node scripts/seed.js [email] [motDePasse]
// ou via variables d'environnement: SEED_EMAIL / SEED_PASSWORD
// Par défaut: superadmin@gwater.com / MotDePasse123!

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, addDoc, getDocs, getDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyDw4wK09vM8PaTvjanAgZc7q8VaX5jCy50',
  authDomain: 'gwaterdb.firebaseapp.com',
  projectId: 'gwaterdb',
  storageBucket: 'gwaterdb.firebasestorage.app',
  messagingSenderId: '697617461254',
  appId: '1:697617461254:web:b5783c64eed99b0420d387'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function seed() {
  const email = process.argv[2] || process.env.SEED_EMAIL || 'superadmin@gwater.com';
  const password = process.argv[3] || process.env.SEED_PASSWORD || 'MotDePasse123!';

  console.log('🌱 Initialisation GWater Firebase...');
  console.log(`🔐 Connexion en tant que ${email}...`);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const user = cred.user;
  console.log(`✅ Authentifié (uid: ${user.uid})`);

  // 0. Profil Firestore du SuperAdmin (requis par AuthService.loadUserProfile)
  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    email: user.email || email,
    displayName: user.displayName || 'Super Admin',
    role: 'superadmin',
    status: 'actif',
    createdBy: 'Système',
    createdAt: new Date()
  }, { merge: true });
  console.log('✅ Profil SuperAdmin créé/vérifié dans users/' + user.uid);

  // 1. Paramètres globaux
  await setDoc(doc(db, 'parametres', 'config'), {
    nomEntreprise: 'GWater Distribution',
    devise: 'FCFA',
    adresse: 'Conakry, Guinée',
    telephone: '+224 XXX XXX XXX',
    email: 'contact@gwater.com',
    prefixeFacture: 'FAC',
    plafondRemiseVendeur: 5,
    delaiPaiementDefaut: 30,
    seuilStockAlerte: 20,
    moyensPaiement: ['especes','orange_money','wave','moov_money','virement','cheque'],
    createdAt: new Date()
  });
  console.log('✅ Paramètres configurés');

  // 2. Compteur de factures
  const cptDoc = await getDoc(doc(db, 'parametres', 'compteurs'));
  if (!cptDoc.exists()) {
    await setDoc(doc(db, 'parametres', 'compteurs'), {
      factureCounter: 0,
      annee: new Date().getFullYear()
    });
    console.log('✅ Compteur factures initialisé');
  }

  // 3. Produits initiaux
  const produitsRef = collection(db, 'produits');
  const produitsSnap = await getDocs(produitsRef);
  if (produitsSnap.empty) {
    await addDoc(produitsRef, {
      code: 'EAU-05L', nom: 'Eau minérale 0.5L', categorie: 'Boisson',
      unite: 'unite', prixDetail: 500, prixGros: 400, prixRevendeur: 350,
      coutAchat: 250, stock: 0, seuilAlerte: 500, statut: 'actif',
      createdAt: new Date()
    });
    await addDoc(produitsRef, {
      code: 'EAU-15L', nom: 'Eau minérale 1.5L', categorie: 'Boisson',
      unite: 'unite', prixDetail: 1000, prixGros: 850, prixRevendeur: 750,
      coutAchat: 500, stock: 0, seuilAlerte: 100, statut: 'actif',
      createdAt: new Date()
    });
    await addDoc(produitsRef, {
      code: 'PACK-05-24', nom: 'Pack 0.5L (24 bouteilles)', categorie: 'Pack',
      unite: 'pack', prixDetail: 10000, prixGros: 8500, prixRevendeur: 7500,
      coutAchat: 6000, stock: 0, seuilAlerte: 30, statut: 'actif',
      createdAt: new Date()
    });
    console.log('✅ Produits initiaux créés');
  } else {
    console.log('ℹ️  Produits déjà existants, ignoré');
  }

  // 4. Période comptable courante
  const moisCourant = new Date().toISOString().slice(0, 7);
  await setDoc(doc(db, 'periodes_comptables', moisCourant), {
    periode: moisCourant,
    statut: 'ouverte',
    createdAt: new Date()
  }, { merge: true });
  console.log('✅ Période comptable initialisée:', moisCourant);

  // 5. Superadmin (créer MANUELLEMENT via Firebase Console ou décommenter ci-dessous)
  // Note: La création de compte via script client SDK nécessite que les règles l'autorisent
  // Préférer la création via Firebase Console > Authentication > Add user
  // puis ajouter le custom claim 'role: superadmin' via la page /admin de l'appli

  console.log('');
  console.log('🎉 Seed terminé!');
  console.log('');
  console.log('📋 PROCHAINES ÉTAPES:');
  console.log('1. Aller sur https://console.firebase.google.com/project/gwaterdb/authentication');
  console.log('2. Cliquer "Add user" et créer: superadmin@gwater.com / MotDePasse123!');
  console.log('3. Lancer l\'application: npm start');
  console.log('4. Se connecter avec ce compte — il aura le rôle admin par défaut');
  console.log('5. Aller dans Administration > Utilisateurs pour créer les autres comptes');
  process.exit(0);
}

seed().catch(err => { console.error('❌ Erreur seed:', err); process.exit(1); });

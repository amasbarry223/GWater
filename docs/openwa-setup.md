# Mise en place d'OpenWA pour les relances WhatsApp

## 1. Démarrer OpenWA sur le VPS

Prérequis : un VPS (2 Go de RAM minimum pour `whatsapp-web.js`), Docker, et un sous-domaine `wa.votre-domaine.com` pointant vers l'IP du serveur.

```bash
# Sur le VPS, copier le dossier infra/openwa puis :
docker compose up -d

# Récupérer la clé admin générée au premier démarrage
docker exec openwa-api cat /app/data/.api-key
```

1. Ouvrir `https://wa.votre-domaine.com` et se connecter avec cette clé.
2. Créer une session (par ex. `gwater`) et scanner le QR code avec le **numéro WhatsApp dédié** aux relances.
3. Créer une clé API de rôle **Operator**, limitée à cette session (à mettre dans `OPENWA_API_KEY`).
4. Enregistrer le webhook vers GWater :
   - URL : `https://<votre-app-vercel>/api/whatsapp/webhook`
   - Secret : la valeur choisie pour `OPENWA_WEBHOOK_SECRET`
   - Événements : `message.sent`, `message.ack`, `message.failed`, `message.received`, `session.status`, `session.authenticated`, `session.disconnected`, `session.restriction`

## 2. Configurer Vercel et Firebase

1. Dans Firebase Console → *Paramètres du projet → Comptes de service → Générer une nouvelle clé privée*.
2. Dans Vercel → *Settings → Environment Variables*, renseigner toutes les variables listées dans [`.env.example`](../.env.example).
3. Déployer les règles et index Firestore :
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```
4. Déployer l'application sur Vercel (le cron `/api/cron/relances` s'exécute du lundi au samedi à 9h UTC).

## 3. Tester en local sans Vercel CLI

1. Copier `.env.example` vers `.env.local` et renseigner les valeurs (`FIREBASE_SERVICE_ACCOUNT`, `OPENWA_URL`, `OPENWA_API_KEY`, `OPENWA_SESSION_ID`, `OPENWA_WEBHOOK_SECRET`).
2. Lancer dans deux terminaux :
   ```bash
   npm run start:api   # sert /api/* sur http://127.0.0.1:3000
   npm start           # lance Angular sur http://localhost:4200 avec proxy /api
   ```

## 4. Activer dans GWater

1. Ouvrir **Administration → 📱 WhatsApp**.
2. Cliquer sur **Vérifier la connexion** : le statut doit passer à `ready`.
3. Cocher **Activer l'envoi direct via OpenWA** (et, si souhaité, **Activer les relances automatiques quotidiennes**), ajuster les paliers/modèles, puis enregistrer.


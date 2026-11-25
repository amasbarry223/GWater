# GWater

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.3.0.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Déploiement sur Vercel

Le projet est une application Angular **SPA** (client-only) qui utilise Firebase (Auth, Firestore, Storage).

1. Importe le dépôt dans Vercel (`Add New… → Project`) et sélectionne `amasbarry223/GWater`.
2. Vercel détecte automatiquement Angular. La configuration est aussi versionnée dans `vercel.json` :
   - **Build Command** : `npm run build`
   - **Install Command** : `npm ci`
   - **Output Directory** : `dist/gwater/browser`
   - **Rewrite** : toutes les routes sont redirigées vers `/index.html` (routage Angular côté client)
3. La version Node est épinglée sur `26.x` dans `package.json` (`engines`).
4. **Important (Firebase Auth)** : dans la console Firebase → *Authentication → Settings → Authorized domains*, ajoute le domaine Vercel (par exemple `gwater.vercel.app`, ainsi que tes domaines personnalisés et les domaines de preview si nécessaire). Sinon la connexion sera bloquée.
5. Les règles de sécurité Firestore/Storage (`firestore.rules`, `storage.rules`) sont appliquées côté Firebase, indépendamment de l'hébergement. La clé API web Firebase est publique par design : elle ne doit pas être traitée comme un secret.

Aucune variable d'environnement n'est requise pour le build.

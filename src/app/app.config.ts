import { ErrorHandler, ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { GlobalErrorHandler } from './core/global-error.handler';
import {
  FIREBASE_APP,
  FIREBASE_AUTH,
  FIREBASE_DB,
  FIREBASE_STORAGE,
  createFirebaseApp,
  createFirebaseAuth,
  createFirebaseDb,
  createFirebaseStorage
} from './core/firebase.instances';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideRouter(routes),
    { provide: FIREBASE_APP, useFactory: createFirebaseApp },
    { provide: FIREBASE_AUTH, useFactory: createFirebaseAuth, deps: [FIREBASE_APP] },
    { provide: FIREBASE_DB, useFactory: createFirebaseDb, deps: [FIREBASE_APP] },
    { provide: FIREBASE_STORAGE, useFactory: createFirebaseStorage, deps: [FIREBASE_APP] },
  ]
};

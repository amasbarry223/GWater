import { ErrorHandler, Injectable, Injector } from '@angular/core';
import { ToastService } from './toast.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(private injector: Injector) {}

  handleError(error: unknown): void {
    const err = error as any;
    const rawMsg: string = err?.rejection?.message || err?.message || String(error || 'Erreur inattendue');
    const code: string = err?.rejection?.code || err?.code || '';

    console.error('[GWater GlobalErrorHandler]', error);

    try {
      const toast = this.injector.get(ToastService);
      if (code === 'permission-denied' || rawMsg.includes('permission-denied')) {
        toast.error('Accès refusé par les règles de sécurité Firestore.');
      } else if (code === 'unavailable' || rawMsg.includes('network')) {
        toast.warning('Connexion instable : passage en mode hors-ligne.');
      } else if (rawMsg.startsWith('PERIODE_CLOTUREE:')) {
        toast.error(`Période comptable ${rawMsg.split(':')[1]} clôturée.`);
      } else {
        toast.error('Une erreur inattendue est survenue. Consultez la console si besoin.');
      }
    } catch {
      // Fallback silencieux si ToastService n'est pas encore initialisé
    }
  }
}

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { filter, map, switchMap, take } from 'rxjs/operators';

/** Empêche un utilisateur déjà authentifié de revenir sur /login */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.loading$.pipe(
    filter(loading => !loading),
    take(1),
    switchMap(() => auth.currentUser$),
    take(1),
    map(user => user ? router.createUrlTree(['/dashboard']) : true)
  );
};

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { filter, switchMap, take, map } from 'rxjs/operators';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.loading$.pipe(
    filter(loading => !loading),
    take(1),
    switchMap(() => auth.currentUser$),
    take(1),
    map(user => user ? true : router.createUrlTree(['/login']))
  );
};

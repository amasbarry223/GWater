import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';
import { filter, map, switchMap, take } from 'rxjs/operators';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);

  const allowedRoles: string[] = route.data['roles'] ?? [];

  return auth.loading$.pipe(
    filter(loading => !loading),
    take(1),
    switchMap(() => auth.currentUser$),
    take(1),
    map(user => {
      if (!user) {
        return router.createUrlTree(['/login']);
      }
      if (allowedRoles.length === 0 || allowedRoles.includes(user.role)) {
        return true;
      }
      toast.warning('Accès refusé : vous n\'avez pas les droits nécessaires.');
      return router.createUrlTree(['/dashboard']);
    })
  );
};

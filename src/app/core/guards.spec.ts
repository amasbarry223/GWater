import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { firstValueFrom, Observable, of } from 'rxjs';
import { authGuard } from './auth.guard';
import { roleGuard } from './role.guard';
import { guestGuard } from './guest.guard';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

describe('Route Guards (authGuard, roleGuard, guestGuard)', () => {
  function setup(user: any) {
    const toastSpy = { warning: () => {}, error: () => {}, success: () => {}, info: () => {} };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { loading$: of(false), currentUser$: of(user), currentUser: user } },
        { provide: ToastService, useValue: toastSpy },
      ],
    });
    return TestBed.inject(Router);
  }

  it('authGuard redirects unauthenticated user to /login', async () => {
    const router = setup(null);
    const res = await firstValueFrom(
      TestBed.runInInjectionContext(() => authGuard({} as any, {} as any) as Observable<boolean | UrlTree>)
    );
    expect(router.serializeUrl(res as UrlTree)).toBe('/login');
  });

  it('authGuard allows authenticated user', async () => {
    setup({ uid: '1', role: 'vendeur', status: 'actif' });
    const res = await firstValueFrom(
      TestBed.runInInjectionContext(() => authGuard({} as any, {} as any) as Observable<boolean | UrlTree>)
    );
    expect(res).toBe(true);
  });

  it('roleGuard allows user with matching role and denies unauthorized role', async () => {
    const router = setup({ uid: '2', role: 'vendeur', status: 'actif' });

    const allowed = await firstValueFrom(
      TestBed.runInInjectionContext(() =>
        roleGuard({ data: { roles: ['superadmin', 'admin', 'vendeur'] } } as any, {} as any) as Observable<boolean | UrlTree>
      )
    );
    expect(allowed).toBe(true);

    const denied = await firstValueFrom(
      TestBed.runInInjectionContext(() =>
        roleGuard({ data: { roles: ['superadmin', 'admin'] } } as any, {} as any) as Observable<boolean | UrlTree>
      )
    );
    expect(router.serializeUrl(denied as UrlTree)).toBe('/dashboard');
  });

  it('guestGuard redirects authenticated user to /dashboard and allows guest', async () => {
    const router = setup({ uid: '1', role: 'admin', status: 'actif' });
    const res = await firstValueFrom(
      TestBed.runInInjectionContext(() => guestGuard({} as any, {} as any) as Observable<boolean | UrlTree>)
    );
    expect(router.serializeUrl(res as UrlTree)).toBe('/dashboard');
  });
});

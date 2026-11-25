import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ToastService } from './toast.service';
import { DataService } from './data.service';
import { AuthService } from './auth.service';
import { GlobalErrorHandler } from './global-error.handler';
import { FIREBASE_DB, FIREBASE_STORAGE } from './firebase.instances';

describe('Core Services (ToastService, DataService, GlobalErrorHandler)', () => {
  it('ToastService pushes and dismisses toasts', () => {
    const toast = new ToastService();
    let list: any[] = [];
    toast.toasts$.subscribe(v => list = v);
    toast.success('Enregistré', 0);
    expect(list.length).toBe(1);
    expect(list[0].type).toBe('success');
    toast.dismiss(list[0].id);
    expect(list.length).toBe(0);
  });

  it('DataService.compteFromMoyen maps all payment methods accurately', () => {
    TestBed.configureTestingModule({
      providers: [
        DataService,
        { provide: FIREBASE_DB, useValue: {} },
        { provide: FIREBASE_STORAGE, useValue: {} },
        { provide: AuthService, useValue: { currentUser$: of(null), currentUser: null } },
      ],
    });
    const ds = TestBed.inject(DataService);
    expect(ds.compteFromMoyen('especes')).toBe('caisse_principale');
    expect(ds.compteFromMoyen('orange_money')).toBe('orange_money');
    expect(ds.compteFromMoyen('wave')).toBe('wave');
    expect(ds.compteFromMoyen('moov_money')).toBe('moov_money');
    expect(ds.compteFromMoyen('virement')).toBe('banque');
    expect(ds.compteFromMoyen('cheque')).toBe('banque');
  });

  it('GlobalErrorHandler surfaces permission-denied and closed period errors via ToastService', () => {
    const errors: string[] = [];
    const warnings: string[] = [];
    TestBed.configureTestingModule({
      providers: [
        GlobalErrorHandler,
        {
          provide: ToastService,
          useValue: {
            error: (m: string) => errors.push(m),
            warning: (m: string) => warnings.push(m),
          },
        },
      ],
    });
    const handler = TestBed.inject(GlobalErrorHandler);
    handler.handleError({ code: 'permission-denied', message: 'Missing permissions' });
    handler.handleError(new Error('PERIODE_CLOTUREE:2026-10'));
    handler.handleError({ code: 'unavailable', message: 'offline' });

    expect(errors.some(m => m.includes('règles de sécurité'))).toBe(true);
    expect(errors.some(m => m.includes('2026-10'))).toBe(true);
    expect(warnings.some(m => m.includes('hors-ligne'))).toBe(true);
  });
});

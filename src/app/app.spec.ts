import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { App } from './app';
import { AuthService } from './core/auth.service';
import { FcfaPipe } from './core/fcfa.pipe';

describe('App & Core', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { loading$: of(false), currentUser$: of(null), currentUser: null } },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should format FCFA amounts properly', () => {
    const pipe = new FcfaPipe();
    expect(pipe.transform(125000)).toBe('125\u00a0000 FCFA');
    expect(pipe.transform(null)).toBe('0 FCFA');
  });
});

import { Injectable, inject, signal } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword,
  User
} from 'firebase/auth';
import { Firestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { BehaviorSubject } from 'rxjs';
import { AppUser } from './models';
import { Router } from '@angular/router';
import { FIREBASE_AUTH, FIREBASE_DB } from './firebase.instances';

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 minutes

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth: Auth = inject(FIREBASE_AUTH);
  private firestore: Firestore = inject(FIREBASE_DB);
  private router = inject(Router);

  private currentUserSig = signal<AppUser | null>(null);
  private currentUserSubject = new BehaviorSubject<AppUser | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(true);
  loading$ = this.loadingSubject.asObservable();

  private setCurrentUser(user: AppUser | null): void {
    this.currentUserSig.set(user);
    this.currentUserSubject.next(user);
  }

  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private activityEventsBound = false;
  private readonly onActivity = () => this.resetInactivityTimer();

  constructor() {
    onAuthStateChanged(this.auth, async (user) => {
      try {
        if (user) {
          // Évite un double chargement Firestore juste après login()
          if (this.currentUserSig()?.uid === user.uid) {
            return;
          }
          const { profile } = await this.loadUserProfile(user);
          if (profile.status === 'inactif') {
            await signOut(this.auth);
            this.setCurrentUser(null);
            this.stopInactivityWatcher();
          } else {
            this.setCurrentUser(profile);
            this.startInactivityWatcher();
          }
        } else {
          this.setCurrentUser(null);
          this.stopInactivityWatcher();
        }
      } catch (err) {
        console.error('[AuthService] Erreur chargement profil:', err);
        this.setCurrentUser(null);
      } finally {
        this.loadingSubject.next(false);
      }
    });
  }

  private async loadUserProfile(user: User): Promise<{ profile: AppUser; exists: boolean }> {
    const docRef = doc(this.firestore, `users/${user.uid}`);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as any;
      return {
        exists: true,
        profile: {
          uid: data.uid || user.uid,
          email: data.email || user.email || '',
          displayName: data.displayName || data.nom || user.displayName || user.email?.split('@')[0] || 'Utilisateur',
          role: data.role || 'vendeur',
          status: data.status || data.statut || 'actif',
          mustChangePassword: !!data.mustChangePassword,
          createdBy: data.createdBy,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
          lastLogin: data.lastLogin?.toDate ? data.lastLogin.toDate() : data.lastLogin,
        }
      };
    }
    const token = await user.getIdTokenResult();
    const role = (token.claims['role'] as any) || 'vendeur';
    return {
      exists: false,
      profile: {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'Utilisateur',
        role,
        status: 'actif',
        createdAt: new Date(),
      }
    };
  }

  async login(email: string, password: string): Promise<void> {
    const cred = await signInWithEmailAndPassword(this.auth, email, password);
    const { profile, exists } = await this.loadUserProfile(cred.user);
    if (profile.status === 'inactif') {
      await signOut(this.auth);
      const err: any = new Error('Compte désactivé');
      err.code = 'auth/account-disabled';
      throw err;
    }
    this.setCurrentUser(profile);
    this.startInactivityWatcher();
    // Mise à jour lastLogin en arrière-plan (ne bloque pas la redirection)
    if (exists) {
      void setDoc(doc(this.firestore, `users/${cred.user.uid}`), { lastLogin: serverTimestamp() }, { merge: true }).catch(() => {});
    }
  }

  async sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email);
  }

  async changePassword(newPassword: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Aucun utilisateur connecté.');
    await updatePassword(user, newPassword);
    await setDoc(doc(this.firestore, `users/${user.uid}`), {
      mustChangePassword: false,
      updatedAt: serverTimestamp()
    }, { merge: true });
    const current = this.currentUserSig();
    if (current) {
      this.setCurrentUser({ ...current, mustChangePassword: false });
    }
  }

  async logout(): Promise<void> {
    this.stopInactivityWatcher();
    this.setCurrentUser(null);
    try {
      await signOut(this.auth);
    } finally {
      await this.router.navigate(['/login'], { replaceUrl: true });
    }
  }

  private startInactivityWatcher(): void {
    if (typeof window === 'undefined') return;
    if (!this.activityEventsBound) {
      ['click', 'keydown', 'mousemove', 'touchstart'].forEach(ev =>
        window.addEventListener(ev, this.onActivity, { passive: true })
      );
      this.activityEventsBound = true;
    }
    this.resetInactivityTimer();
  }

  private resetInactivityTimer(): void {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    if (!this.currentUserSig()) return;
    this.inactivityTimer = setTimeout(() => {
      this.logout();
    }, INACTIVITY_LIMIT_MS);
  }

  private stopInactivityWatcher(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    if (typeof window !== 'undefined' && this.activityEventsBound) {
      ['click', 'keydown', 'mousemove', 'touchstart'].forEach(ev =>
        window.removeEventListener(ev, this.onActivity)
      );
      this.activityEventsBound = false;
    }
  }

  get currentUser(): AppUser | null {
    return this.currentUserSig();
  }

  hasRole(...roles: string[]): boolean {
    return roles.includes(this.currentUserSig()?.role || '');
  }

  isAuthenticated(): boolean {
    return this.currentUserSig() !== null;
  }
}

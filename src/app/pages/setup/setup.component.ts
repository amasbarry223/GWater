import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Auth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { Firestore, collection, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { FIREBASE_AUTH, FIREBASE_DB } from '../../core/firebase.instances';

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;padding:16px">
      <div style="width:100%;max-width:420px">
        <!-- Logo -->
        <div style="text-align:center;margin-bottom:32px">
          <div style="font-size:48px;margin-bottom:8px">💧</div>
          <h1 style="color:white;font-size:28px;font-weight:700;margin:0">GWater</h1>
          <p style="color:#94a3b8;margin:4px 0 0">Configuration initiale</p>
        </div>

        <!-- Card -->
        <div style="background:white;border-radius:16px;padding:32px;box-shadow:0 25px 50px rgba(0,0,0,.5)">

          @if (checking) {
            <div style="text-align:center;padding:32px 0">
              <div style="width:40px;height:40px;border:3px solid #e2e8f0;border-top-color:#0ea5e9;border-radius:50%;animation:spin .7s linear infinite;margin:0 auto 16px"></div>
              <p style="color:#64748b;margin:0">Vérification en cours...</p>
            </div>
          }

          @if (!checking && alreadySetup) {
            <div style="text-align:center;padding:16px 0">
              <div style="font-size:48px;margin-bottom:16px">✅</div>
              <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px">Application déjà configurée</h2>
              <p style="color:#64748b;margin:0 0 24px">GWater est déjà initialisé. Veuillez vous connecter.</p>
              <a routerLink="/login" style="display:inline-block;background:#0ea5e9;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
                Aller à la connexion →
              </a>
            </div>
          }

          @if (!checking && !alreadySetup) {
            <h2 style="color:#1e293b;font-size:20px;font-weight:700;margin:0 0 8px">Créer le compte SuperAdmin</h2>
            <p style="color:#64748b;font-size:14px;margin:0 0 24px">Ce compte aura tous les droits sur l'application.</p>

            @if (errorMsg) {
              <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:16px;color:#dc2626;font-size:14px">
                {{ errorMsg }}
              </div>
            }

            <form (ngSubmit)="initialize()" #form="ngForm">
              <!-- Nom complet -->
              <div style="margin-bottom:16px">
                <label style="display:block;font-size:14px;font-weight:600;color:#374151;margin-bottom:6px">Nom complet</label>
                <input
                  type="text"
                  [(ngModel)]="displayName"
                  name="displayName"
                  required
                  placeholder="Admin GWater"
                  style="width:100%;padding:10px 14px;border:1px solid #d1d5db;border-radius:8px;font-size:15px;outline:none;box-sizing:border-box"
                />
              </div>

              <!-- Email -->
              <div style="margin-bottom:16px">
                <label style="display:block;font-size:14px;font-weight:600;color:#374151;margin-bottom:6px">Email</label>
                <input
                  type="email"
                  [(ngModel)]="email"
                  name="email"
                  required
                  placeholder="superadmin@gwater.com"
                  style="width:100%;padding:10px 14px;border:1px solid #d1d5db;border-radius:8px;font-size:15px;outline:none;box-sizing:border-box"
                />
              </div>

              <!-- Mot de passe -->
              <div style="margin-bottom:24px">
                <label style="display:block;font-size:14px;font-weight:600;color:#374151;margin-bottom:6px">Mot de passe</label>
                <input
                  type="password"
                  [(ngModel)]="password"
                  name="password"
                  required
                  minlength="8"
                  placeholder="Minimum 8 caractères"
                  style="width:100%;padding:10px 14px;border:1px solid #d1d5db;border-radius:8px;font-size:15px;outline:none;box-sizing:border-box"
                />
                <p style="color:#94a3b8;font-size:12px;margin:4px 0 0">Minimum 8 caractères avec une lettre et un chiffre</p>
              </div>

              <button
                type="submit"
                [disabled]="loading || !form.valid || !isPasswordValid()"
                style="width:100%;background:#0ea5e9;color:white;padding:12px;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;opacity:1;transition:opacity .2s"
                [style.opacity]="(loading || !form.valid || !isPasswordValid()) ? '0.6' : '1'"
              >
                @if (loading) {
                  Initialisation...
                } @else {
                  🚀 Initialiser GWater
                }
              </button>
            </form>
          }

        </div>
      </div>
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
  `
})
export class SetupComponent implements OnInit {
  private auth: Auth = inject(FIREBASE_AUTH);
  private firestore: Firestore = inject(FIREBASE_DB);
  private router = inject(Router);

  checking = true;
  alreadySetup = false;
  loading = false;
  errorMsg = '';

  displayName = '';
  email = '';
  password = '';

  async ngOnInit() {
    try {
      const usersSnap = await getDocs(collection(this.firestore, 'users'));
      this.alreadySetup = !usersSnap.empty;
    } catch {
      // Si Firestore refuse la lecture non authentifiée, l'application est déjà sécurisée/initialisée
      this.alreadySetup = true;
    } finally {
      this.checking = false;
    }
  }

  isPasswordValid(): boolean {
    return this.password.length >= 8 &&
      /[a-zA-Z]/.test(this.password) &&
      /[0-9]/.test(this.password);
  }

  async initialize() {
    if (this.loading) return;
    this.errorMsg = '';

    if (!this.isPasswordValid()) {
      this.errorMsg = 'Le mot de passe doit contenir au moins 8 caractères, une lettre et un chiffre.';
      return;
    }

    this.loading = true;
    try {
      // Create Firebase Auth user
      const credential = await createUserWithEmailAndPassword(this.auth, this.email, this.password);
      await updateProfile(credential.user, { displayName: this.displayName });

      // Create Firestore user document with superadmin role
      await setDoc(doc(this.firestore, 'users', credential.user.uid), {
        uid: credential.user.uid,
        email: this.email,
        displayName: this.displayName,
        role: 'superadmin',
        status: 'actif',
        createdAt: serverTimestamp()
      });

      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        this.errorMsg = 'Cet email est déjà utilisé.';
      } else if (err.code === 'auth/weak-password') {
        this.errorMsg = 'Mot de passe trop faible.';
      } else {
        this.errorMsg = err.message || 'Une erreur est survenue.';
      }
    } finally {
      this.loading = false;
    }
  }
}

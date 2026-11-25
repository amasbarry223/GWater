import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule, AsyncPipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from './core/auth.service';
import { ToastService } from './core/toast.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, AsyncPipe, ReactiveFormsModule],
  template: `
    @if (isOffline()) {
      <div style="position:fixed;top:0;left:0;right:0;z-index:9999;background:#f59e0b;color:#1e293b;padding:8px 16px;text-align:center;font-size:13px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,.2)">
        📡 Mode hors-ligne — Les données en cache restent consultables. Synchronisation automatique au retour du réseau.
      </div>
    }

    @if (authService.loading$ | async) {
      <div style="height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a">
        <div style="text-align:center;color:white">
          <div style="font-size:48px;margin-bottom:16px">💧</div>
          <div style="font-size:20px;font-weight:700;margin-bottom:8px">GWater</div>
          <div style="width:40px;height:40px;border:3px solid rgba(255,255,255,.2);border-top-color:#0ea5e9;border-radius:50%;animation:spin .7s linear infinite;margin:0 auto"></div>
        </div>
      </div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    } @else {
      <router-outlet />
    }

    <!-- Changement de mot de passe obligatoire à la 1re connexion -->
    @if (authService.currentUser?.mustChangePassword) {
      <div class="gw-modal-backdrop" style="z-index:9998">
        <div class="gw-modal modal-sm">
          <div class="modal-header">
            <div class="modal-title">🔐 Changement de mot de passe requis</div>
          </div>
          <form [formGroup]="pwdForm" (ngSubmit)="submitNewPassword()">
            <div class="modal-body">
              <div class="gw-alert alert-info" style="margin-bottom:14px">
                <span class="alert-icon">ℹ️</span>
                <div class="alert-content">Pour sécuriser votre compte, définissez un nouveau mot de passe (min. 8 caractères, 1 lettre et 1 chiffre).</div>
              </div>
              @if (pwdError()) {
                <div class="gw-alert alert-error" style="margin-bottom:12px">
                  <span class="alert-icon">❌</span>
                  <div class="alert-content">{{ pwdError() }}</div>
                </div>
              }
              <div class="form-group" style="margin-bottom:12px">
                <label>Nouveau mot de passe *</label>
                <input type="password" class="form-control" formControlName="password" placeholder="Minimum 8 caractères">
              </div>
              <div class="form-group">
                <label>Confirmer le mot de passe *</label>
                <input type="password" class="form-control" formControlName="confirm" placeholder="Répéter le mot de passe">
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" (click)="authService.logout()">Déconnexion</button>
              <button type="submit" class="btn btn-primary" [disabled]="pwdSaving() || pwdForm.invalid">
                {{ pwdSaving() ? 'Enregistrement...' : 'Valider' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `
})
export class App implements OnInit, OnDestroy {
  authService = inject(AuthService);
  private toastService = inject(ToastService);
  private fb = inject(FormBuilder);

  isOffline = signal(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  pwdSaving = signal(false);
  pwdError = signal('');

  pwdForm = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/)]],
    confirm: ['', [Validators.required]],
  });

  private readonly onOnline = () => {
    this.isOffline.set(false);
    this.toastService.success('Connexion réseau rétablie.');
  };
  private readonly onOffline = () => {
    this.isOffline.set(true);
    this.toastService.warning('Vous êtes hors-ligne. Les données locales restent disponibles.');
  };

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.onOnline);
      window.addEventListener('offline', this.onOffline);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onOnline);
      window.removeEventListener('offline', this.onOffline);
    }
  }

  async submitNewPassword(): Promise<void> {
    this.pwdError.set('');
    const { password, confirm } = this.pwdForm.value;
    if (!password || password !== confirm) {
      this.pwdError.set('Les mots de passe ne correspondent pas.');
      return;
    }
    this.pwdSaving.set(true);
    try {
      await this.authService.changePassword(password);
      this.toastService.success('Mot de passe mis à jour avec succès !');
      this.pwdForm.reset();
    } catch (err: any) {
      this.pwdError.set(err?.message || 'Erreur lors de la mise à jour du mot de passe.');
    } finally {
      this.pwdSaving.set(false);
    }
  }
}

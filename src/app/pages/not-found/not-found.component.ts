import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;padding:24px">
  <div style="background:white;border-radius:20px;padding:40px 32px;max-width:440px;width:100%;text-align:center;box-shadow:0 25px 50px rgba(0,0,0,.45)">
    <div style="font-size:56px;margin-bottom:8px">💧</div>
    <div style="font-size:52px;font-weight:900;color:#0ea5e9;line-height:1">404</div>
    <h1 style="font-size:20px;font-weight:700;color:#1e293b;margin:12px 0 8px">Page introuvable</h1>
    <p style="font-size:14px;color:#64748b;margin:0 0 28px">
      La page que vous recherchez n'existe pas ou a été déplacée.
    </p>
    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
      <a routerLink="/dashboard" class="btn btn-primary" style="text-decoration:none">
        ← Retour au tableau de bord
      </a>
      <a routerLink="/login" class="btn btn-secondary" style="text-decoration:none">
        Connexion
      </a>
    </div>
  </div>
</div>
  `
})
export class NotFoundComponent {}

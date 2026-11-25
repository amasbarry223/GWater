import { Component, ChangeDetectorRef, DestroyRef, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { DataService } from '../../core/data.service';
import { FIREBASE_AUTH } from '../../core/firebase.instances';
import {
  WhatsappService, WhatsappEtat, Relance, STATUT_RELANCE_LABELS, STATUT_RELANCE_BADGES,
} from '../../core/whatsapp.service';
import {
  DEFAULT_WHATSAPP_SETTINGS, NIVEAU_LABELS, mergeWhatsappSettings, type WhatsappSettings,
} from '../../core/whatsapp.utils';
import { AppSettings } from '../../core/models';
import { firebaseConfig } from '../../core/firebase.config';

interface UserItem {
  id: string;
  nom: string;
  email: string;
  role: 'superadmin' | 'admin' | 'vendeur' | 'comptable';
  statut: 'actif' | 'inactif';
  creepar: string;
  createdByUid?: string;
  creele: Date;
  derniereConnexion?: Date;
}

interface AuditLogItem {
  id: string;
  date: Date;
  user: string;
  action: string;
  entite: string;
  detail: string;
  badgeClass: string;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    .adm-hero {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px;
      padding: 20px 24px; border-radius: 16px; margin-bottom: 20px;
      background: linear-gradient(135deg, #0f172a 0%, #0369a1 65%, #0ea5e9 100%);
      color: #fff; box-shadow: 0 10px 25px -10px rgba(14, 165, 233, 0.45);
    }
    .adm-hero-title { font-size: 22px; font-weight: 800; letter-spacing: -0.3px; }
    .adm-hero-sub { font-size: 13px; opacity: 0.85; margin-top: 3px; }

    .adm-kpis {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 14px; margin-bottom: 20px;
    }
    .adm-kpi {
      background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px 18px;
      display: flex; align-items: center; gap: 14px; cursor: pointer;
      transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;
    }
    .adm-kpi:hover { transform: translateY(-2px); box-shadow: 0 8px 20px -10px rgba(15, 23, 42, .2); border-color: #bae6fd; }
    .adm-kpi-ico {
      width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center;
      justify-content: center; font-size: 20px; flex-shrink: 0;
    }
    .adm-kpi-val { font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.1; }
    .adm-kpi-lbl { font-size: 12px; color: #64748b; margin-top: 2px; }

    .adm-tabs {
      display: flex; flex-wrap: wrap; gap: 6px; padding: 6px; margin-bottom: 20px;
      background: #f1f5f9; border-radius: 14px; width: fit-content; border: 1px solid #e2e8f0;
    }
    .adm-tab {
      display: inline-flex; align-items: center; gap: 8px; padding: 9px 16px; border: 0;
      border-radius: 10px; background: transparent; color: #64748b; font-size: 13px;
      font-weight: 600; cursor: pointer; transition: all .15s ease;
    }
    .adm-tab:hover { color: #0f172a; background: rgba(255,255,255,0.6); }
    .adm-tab.active { background: #fff; color: #0284c7; box-shadow: 0 2px 8px rgba(15, 23, 42, .08); }
    .adm-tab-count {
      font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 999px;
      background: #e2e8f0; color: #475569;
    }
    .adm-tab.active .adm-tab-count { background: #e0f2fe; color: #0369a1; }

    .adm-chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .adm-chip {
      padding: 5px 12px; border-radius: 999px; border: 1px solid #e2e8f0; background: #fff;
      font-size: 12px; font-weight: 600; color: #475569; cursor: pointer; transition: all .15s ease;
    }
    .adm-chip:hover { border-color: #7dd3fc; color: #0284c7; }
    .adm-chip.active { background: #0ea5e9; border-color: #0ea5e9; color: #fff; }

    .adm-pay-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(155px, 1fr)); gap: 10px; }
    .adm-pay-card {
      display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px;
      border: 1.5px solid #e2e8f0; background: #f8fafc; cursor: pointer; transition: all .15s ease;
      font-size: 13px; font-weight: 500; user-select: none;
    }
    .adm-pay-card.on { border-color: #0ea5e9; background: #f0f9ff; color: #0369a1; font-weight: 600; }
    .adm-pay-card.disabled { opacity: .65; cursor: not-allowed; }

    .adm-switch { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; cursor: pointer; }
    .adm-switch input { width: 18px; height: 18px; accent-color: #0ea5e9; cursor: pointer; }

    .pwd-box { display: flex; gap: 6px; align-items: center; }
    .pwd-box .form-control { flex: 1; font-family: monospace; }
    .pwd-meter { height: 5px; border-radius: 999px; background: #e2e8f0; overflow: hidden; margin-top: 6px; }
    .pwd-meter-bar { height: 100%; transition: width .2s ease, background .2s ease; }
  `],
  template: `
<div>
  <div class="adm-hero">
    <div>
      <div class="adm-hero-title">Administration</div>
      <div class="adm-hero-sub">Gestion des utilisateurs, sécurité des accès, paramètres globaux, audit et passerelle WhatsApp</div>
    </div>
    @if (activeTab() === 'users') {
      <button class="btn" (click)="openNewUser()"
              style="background:#fff;color:#0369a1;font-weight:700;border:none;box-shadow:0 4px 12px rgba(0,0,0,.15)">
        + Nouvel utilisateur
      </button>
    }
  </div>

  <!-- KPIs interactifs -->
  <div class="adm-kpis">
    <div class="adm-kpi" (click)="activeTab.set('users'); filterRole=''; filterStatut=''">
      <div class="adm-kpi-ico" style="background:#e0f2fe;color:#0284c7">👥</div>
      <div>
        <div class="adm-kpi-val">{{ activeUsersCount() }} <span style="font-size:13px;font-weight:500;color:#94a3b8">/ {{ users.length }}</span></div>
        <div class="adm-kpi-lbl">Utilisateurs actifs</div>
      </div>
    </div>
    <div class="adm-kpi" (click)="activeTab.set('users'); filterRole='admin'">
      <div class="adm-kpi-ico" style="background:#ede9fe;color:#7c3aed">🛡️</div>
      <div>
        <div class="adm-kpi-val">{{ adminsCount() }}</div>
        <div class="adm-kpi-lbl">Super Admin & Admin</div>
      </div>
    </div>
    <div class="adm-kpi" (click)="activeTab.set('audit')">
      <div class="adm-kpi-ico" style="background:#fef3c7;color:#d97706">📋</div>
      <div>
        <div class="adm-kpi-val">{{ auditLogs.length }}</div>
        <div class="adm-kpi-lbl">Événements d'audit</div>
      </div>
    </div>
    <div class="adm-kpi" (click)="activeTab.set('whatsapp')">
      <div class="adm-kpi-ico" [style.background]="waEtat()?.status === 'ready' ? '#dcfce7' : '#f1f5f9'">📱</div>
      <div>
        <div class="adm-kpi-val" style="font-size:16px">
          {{ waEtat()?.status === 'ready' ? 'Connecté' : (waForm.actif ? (waEtat()?.status || 'Non vérifié') : 'Manuel (wa.me)') }}
        </div>
        <div class="adm-kpi-lbl">Passerelle WhatsApp</div>
      </div>
    </div>
  </div>

  <!-- Tabs modernes -->
  <div class="adm-tabs" role="tablist">
    @for (tab of tabs; track tab.id) {
      <button class="adm-tab" [class.active]="activeTab() === tab.id" (click)="activeTab.set(tab.id)">
        <span>{{ tab.icon }}</span>
        <span>{{ tab.label }}</span>
        @if (tab.id === 'users') {
          <span class="adm-tab-count">{{ users.length }}</span>
        } @else if (tab.id === 'audit') {
          <span class="adm-tab-count">{{ auditLogs.length }}</span>
        } @else if (tab.id === 'whatsapp' && relancesAValider().length > 0) {
          <span class="adm-tab-count" style="background:#fee2e2;color:#b91c1c">{{ relancesAValider().length }}</span>
        }
      </button>
    }
  </div>

  <!-- ============ ONGLET UTILISATEURS ============ -->
  @if (activeTab() === 'users') {
    <div class="gw-table-wrapper">
      <div class="gw-table-toolbar" style="flex-wrap:wrap;gap:10px">
        <div class="toolbar-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#94a3b8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Rechercher par nom ou e-mail..." [(ngModel)]="searchUser">
        </div>
        <div class="adm-chips">
          <button class="adm-chip" [class.active]="filterRole === ''" (click)="filterRole = ''">Tous</button>
          <button class="adm-chip" [class.active]="filterRole === 'superadmin'" (click)="filterRole = 'superadmin'">Super Admin</button>
          <button class="adm-chip" [class.active]="filterRole === 'admin'" (click)="filterRole = 'admin'">Admin</button>
          <button class="adm-chip" [class.active]="filterRole === 'vendeur'" (click)="filterRole = 'vendeur'">Vendeur</button>
          <button class="adm-chip" [class.active]="filterRole === 'comptable'" (click)="filterRole = 'comptable'">Comptable</button>
        </div>
        <select class="form-control" style="width:130px;height:34px" [(ngModel)]="filterStatut">
          <option value="">Tous statuts</option>
          <option value="actif">Actifs</option>
          <option value="inactif">Inactifs</option>
        </select>
        <div class="toolbar-spacer"></div>
        <button class="btn btn-primary btn-sm" (click)="openNewUser()">+ Créer</button>
      </div>

      <table class="gw-table">
        <thead>
          <tr>
            <th>Utilisateur</th>
            <th>E-mail</th>
            <th>Rôle</th>
            <th>Créé par</th>
            <th>Créé le</th>
            <th>Dernière connexion</th>
            <th>Statut</th>
            <th style="text-align:right">Actions</th>
          </tr>
        </thead>
        <tbody>
          @for (u of filteredUsers(); track u.id) {
            <tr>
              <td>
                <div style="display:flex;align-items:center;gap:10px">
                  <div class="avatar sm" [style.background]="roleColor(u.role)" style="color:white;font-weight:700">
                    {{ (u.nom || u.email || 'U')[0].toUpperCase() }}
                  </div>
                  <div>
                    <div style="font-weight:600;color:#0f172a">{{ u.nom || u.email }}</div>
                    @if (u.id === authService.currentUser?.uid) {
                      <span style="font-size:10px;color:#0284c7;font-weight:600">Vous</span>
                    }
                  </div>
                </div>
              </td>
              <td style="font-size:12px;color:#64748b">{{ u.email }}</td>
              <td><span [class]="'badge ' + roleBadge(u.role)">{{ roleLabels[u.role] || u.role }}</span></td>
              <td style="font-size:12px">{{ u.creepar }}</td>
              <td style="font-size:12px;color:#64748b">{{ u.creele | date:'dd/MM/yyyy' }}</td>
              <td style="font-size:12px;color:#64748b">{{ u.derniereConnexion ? (u.derniereConnexion | date:'dd/MM/yyyy HH:mm') : '—' }}</td>
              <td><span [class]="'badge ' + (u.statut==='actif'?'badge-success':'badge-danger')">
                <span class="badge-dot"></span>{{ u.statut }}
              </span></td>
              <td>
                <div class="td-actions" style="justify-content:flex-end">
                  <button class="btn btn-ghost btn-sm btn-icon" title="Modifier le profil" (click)="editUser(u)">✏️</button>
                  @if (canManagePassword(u)) {
                    <button class="btn btn-ghost btn-sm btn-icon" title="Réinitialiser / définir le mot de passe" (click)="openResetModal(u)">🔑</button>
                  }
                  <button class="btn btn-ghost btn-sm btn-icon"
                          [title]="u.statut==='actif'?'Désactiver':'Réactiver'"
                          (click)="toggleUser(u)"
                          [style.color]="u.statut==='actif'?'#ef4444':'#22c55e'">
                    {{ u.statut === 'actif' ? '🚫' : '✅' }}
                  </button>
                </div>
              </td>
            </tr>
          }
          @if (filteredUsers().length === 0) {
            <tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:32px">Aucun utilisateur ne correspond aux filtres.</td></tr>
          }
        </tbody>
      </table>
    </div>
  }

  <!-- ============ ONGLET AUDIT ============ -->
  @if (activeTab() === 'audit') {
    <div class="gw-table-wrapper">
      <div class="gw-table-toolbar" style="flex-wrap:wrap;gap:10px">
        <div class="toolbar-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#94a3b8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Rechercher dans le journal..." [(ngModel)]="searchAudit">
        </div>
        <div class="adm-chips">
          <button class="adm-chip" [class.active]="filterAction === ''" (click)="filterAction = ''">Tout</button>
          <button class="adm-chip" [class.active]="filterAction === 'VENTE'" (click)="filterAction = 'VENTE'">Ventes</button>
          <button class="adm-chip" [class.active]="filterAction === 'STOCK'" (click)="filterAction = 'STOCK'">Stock</button>
          <button class="adm-chip" [class.active]="filterAction === 'UTILISATEUR'" (click)="filterAction = 'UTILISATEUR'">Utilisateurs</button>
          <button class="adm-chip" [class.active]="filterAction === 'MOT_DE_PASSE'" (click)="filterAction = 'MOT_DE_PASSE'">Mots de passe</button>
          <button class="adm-chip" [class.active]="filterAction === 'WHATSAPP'" (click)="filterAction = 'WHATSAPP'">WhatsApp</button>
          <button class="adm-chip" [class.active]="filterAction === 'PARAMETRES'" (click)="filterAction = 'PARAMETRES'">Paramètres</button>
        </div>
        <div class="toolbar-spacer"></div>
        <span style="font-size:12px;color:#94a3b8">{{ filteredAuditLogs().length }} entrée(s)</span>
      </div>
      <table class="gw-table">
        <thead>
          <tr>
            <th>Date / Heure</th>
            <th>Utilisateur</th>
            <th>Action</th>
            <th>Entité</th>
            <th>Détails</th>
          </tr>
        </thead>
        <tbody>
          @for (log of filteredAuditLogs(); track log.id) {
            <tr>
              <td style="font-size:12px;color:#64748b;white-space:nowrap">{{ log.date | date:'dd/MM/yyyy HH:mm:ss' }}</td>
              <td><strong>{{ log.user }}</strong></td>
              <td><span [class]="'badge ' + log.badgeClass">{{ log.action }}</span></td>
              <td style="font-size:12px;font-family:monospace;color:#475569">{{ log.entite }}</td>
              <td style="font-size:12px;color:#475569;max-width:420px">{{ log.detail }}</td>
            </tr>
          }
          @if (filteredAuditLogs().length === 0) {
            <tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:32px">Aucune entrée dans le journal d'audit.</td></tr>
          }
        </tbody>
      </table>
    </div>
  }

  <!-- ============ ONGLET PARAMÈTRES ============ -->
  @if (activeTab() === 'parametres') {
    @if (!isSuperAdmin()) {
      <div class="gw-alert alert-info" style="margin-bottom:16px">
        <span class="alert-icon">ℹ️</span>
        <div class="alert-content">Mode lecture seule : seul le Super Admin peut modifier les paramètres globaux.</div>
      </div>
    }
    <div class="grid-2">
      <div class="gw-card">
        <div class="card-header">
          <div class="card-title">🏢 Identité de l'entreprise</div>
        </div>
        <div class="card-body">
          <div class="form-group" style="margin-bottom:12px">
            <label>Nom de l'entreprise</label>
            <input class="form-control" [(ngModel)]="settingsForm.nomEntreprise" [disabled]="!isSuperAdmin()" placeholder="Nom de l'entreprise">
          </div>
          <div class="grid-2" style="margin-bottom:12px">
            <div class="form-group">
              <label>Devise</label>
              <select class="form-control" [(ngModel)]="settingsForm.devise" [disabled]="!isSuperAdmin()">
                <option value="FCFA">FCFA (XOF)</option>
                <option value="GNF">GNF</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div class="form-group">
              <label>Préfixe factures</label>
              <input class="form-control" [(ngModel)]="settingsForm.prefixeFacture" [disabled]="!isSuperAdmin()" placeholder="FAC">
            </div>
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label>Adresse</label>
            <input class="form-control" [(ngModel)]="settingsForm.adresse" [disabled]="!isSuperAdmin()" placeholder="Adresse complète">
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label>Téléphone</label>
              <input class="form-control" [(ngModel)]="settingsForm.telephone" [disabled]="!isSuperAdmin()" placeholder="+224 XXX XXX XXX">
            </div>
            <div class="form-group">
              <label>E-mail de contact</label>
              <input class="form-control" type="email" [(ngModel)]="settingsForm.email" [disabled]="!isSuperAdmin()" placeholder="contact@gwater.com">
            </div>
          </div>
        </div>
        <div class="card-footer">
          <button class="btn btn-primary" (click)="saveSettings()" [disabled]="!isSuperAdmin() || savingSettings()">
            {{ savingSettings() ? 'Enregistrement...' : '💾 Enregistrer' }}
          </button>
        </div>
      </div>

      <div class="gw-card">
        <div class="card-header">
          <div class="card-title">⚙️ Règles métier & Paiements</div>
        </div>
        <div class="card-body">
          <div class="grid-2" style="margin-bottom:12px">
            <div class="form-group">
              <label>Plafond remise Vendeur (%)</label>
              <input type="number" class="form-control" [(ngModel)]="settingsForm.plafondRemiseVendeur" [disabled]="!isSuperAdmin()" min="0" max="100">
            </div>
            <div class="form-group">
              <label>Délai paiement défaut (j)</label>
              <input type="number" class="form-control" [(ngModel)]="settingsForm.delaiPaiementDefaut" [disabled]="!isSuperAdmin()">
            </div>
          </div>
          <div class="form-group" style="margin-bottom:16px">
            <label>Seuil stock bas global (%)</label>
            <input type="number" class="form-control" [(ngModel)]="settingsForm.seuilStockAlerte" [disabled]="!isSuperAdmin()">
          </div>
          <div class="section-title" style="margin-bottom:10px">Moyens de paiement activés</div>
          <div class="adm-pay-grid">
            @for (mp of moyensPaiement; track mp.key) {
              <div class="adm-pay-card" [class.on]="mp.actif" [class.disabled]="!isSuperAdmin()"
                   (click)="isSuperAdmin() && (mp.actif = !mp.actif)">
                <span>{{ mp.icon }}</span>
                <span style="flex:1">{{ mp.label }}</span>
                <span>{{ mp.actif ? '✓' : '' }}</span>
              </div>
            }
          </div>
        </div>
        <div class="card-footer">
          <button class="btn btn-primary" (click)="saveSettings()" [disabled]="!isSuperAdmin() || savingSettings()">
            {{ savingSettings() ? 'Enregistrement...' : '💾 Enregistrer' }}
          </button>
        </div>
      </div>
    </div>
  }

  <!-- ============ ONGLET WHATSAPP ============ -->
  @if (activeTab() === 'whatsapp') {
    <div class="grid-2" style="margin-bottom:20px">
      <div class="gw-card">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
          <div class="card-title">📱 Passerelle OpenWA</div>
          <button class="btn btn-secondary btn-sm" (click)="verifierWhatsapp()" [disabled]="checkingWa()">
            {{ checkingWa() ? 'Vérification…' : '🔄 Vérifier la connexion' }}
          </button>
        </div>
        <div class="card-body">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
            <span [class]="'badge ' + (waEtat()?.status === 'ready' ? 'badge-success' : waEtat()?.status === 'disconnected' || waEtat()?.status === 'injoignable' ? 'badge-danger' : 'badge-secondary')">
              {{ waEtat()?.status || 'Non vérifié' }}
            </span>
            @if (waEtat()?.phone) {
              <span style="font-family:monospace;font-size:13px">{{ waEtat()!.phone }}</span>
            }
          </div>
          @if (waEtat()?.erreur) {
            <div class="gw-alert alert-danger" style="margin-bottom:12px">
              <div class="alert-content">{{ waEtat()!.erreur }}</div>
            </div>
          }
          @if (waEtat()?.restriction) {
            <div class="gw-alert alert-warning" style="margin-bottom:12px">
              <div class="alert-content">Restriction WhatsApp détectée : {{ waEtat()!.restriction!.kind || 'active' }}</div>
            </div>
          }
          @if (waEtat()?.dernierCron; as cron) {
            <div style="font-size:12px;color:#64748b;background:#f8fafc;padding:10px;border-radius:8px;margin-bottom:12px">
              <strong>Dernier cron :</strong> {{ cron.at | date:'dd/MM/yyyy HH:mm' }}
              @if (cron.erreur) { — <span style="color:#ef4444">{{ cron.erreur }}</span> }
              @else { — {{ cron.envoyes || 0 }} envoyé(s), {{ cron.aValider || 0 }} à valider, {{ cron.ignores || 0 }} ignoré(s) }
            </div>
          }
          <div style="display:flex;flex-direction:column;gap:8px">
            <label class="adm-switch">
              <span style="font-size:13px">Activer l'envoi direct via OpenWA (sinon : WhatsApp Web manuel)</span>
              <input type="checkbox" [(ngModel)]="waForm.actif">
            </label>
            <label class="adm-switch">
              <span style="font-size:13px">Relances automatiques quotidiennes (9h, lun–sam)</span>
              <input type="checkbox" [(ngModel)]="waForm.autoActif" [disabled]="!waForm.actif">
            </label>
            <label class="adm-switch">
              <span style="font-size:13px">Validation admin obligatoire avant mise en demeure</span>
              <input type="checkbox" [(ngModel)]="waForm.validationMiseEnDemeure">
            </label>
          </div>
        </div>
      </div>

      <div class="gw-card">
        <div class="card-header">
          <div class="card-title">⏱️ Règles & Paliers (jours après échéance)</div>
        </div>
        <div class="card-body">
          <div class="grid-2" style="margin-bottom:12px">
            <div class="form-group">
              <label>Indicatif pays par défaut</label>
              <input class="form-control" [(ngModel)]="waForm.indicatifPays" placeholder="224">
            </div>
            <div class="form-group">
              <label>Délai min. entre relances (jours)</label>
              <input type="number" class="form-control" [(ngModel)]="waForm.delaiMinEntreRelances" min="1">
            </div>
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label>Signature des messages</label>
            <input class="form-control" [(ngModel)]="waForm.signature">
          </div>
          <div class="grid-2">
            @for (p of waForm.paliers; track p.niveau) {
              <div class="form-group">
                <label>{{ niveauLabels[p.niveau] }} (J+)</label>
                <input type="number" class="form-control" [(ngModel)]="p.jours" min="0">
              </div>
            }
          </div>
        </div>
        <div class="card-footer">
          <button class="btn btn-primary" (click)="saveWhatsappSettings()" [disabled]="savingWa()">
            {{ savingWa() ? 'Enregistrement…' : '💾 Enregistrer la config WhatsApp' }}
          </button>
        </div>
      </div>
    </div>

    <div class="gw-card" style="margin-bottom:20px">
      <div class="card-header">
        <div class="card-title">📝 Modèles de messages (<code style="font-size:12px">{{ '{{nom}}' }}</code>, <code style="font-size:12px">{{ '{{montant}}' }}</code>, <code style="font-size:12px">{{ '{{jours}}' }}</code>, <code style="font-size:12px">{{ '{{signature}}' }}</code>)</div>
      </div>
      <div class="card-body">
        <div class="grid-2">
          @for (p of waForm.paliers; track p.niveau) {
            <div class="form-group">
              <label>{{ niveauLabels[p.niveau] }}</label>
              <textarea class="form-control" rows="4" [(ngModel)]="waForm.templates[p.niveau]"></textarea>
            </div>
          }
        </div>
      </div>
      <div class="card-footer">
        <button class="btn btn-primary" (click)="saveWhatsappSettings()" [disabled]="savingWa()">
          {{ savingWa() ? 'Enregistrement…' : '💾 Enregistrer les modèles' }}
        </button>
      </div>
    </div>

    @if (relancesAValider().length > 0) {
      <div class="gw-card" style="margin-bottom:20px">
        <div class="card-header">
          <div class="card-title">⚠️ Mises en demeure à valider ({{ relancesAValider().length }})</div>
        </div>
        <table class="gw-table">
          <thead>
            <tr><th>Client</th><th>Montant</th><th>Retard</th><th>Message</th><th>Actions</th></tr>
          </thead>
          <tbody>
            @for (r of relancesAValider(); track r.id) {
              <tr>
                <td><strong>{{ r.clientNom }}</strong><div style="font-size:11px;color:#64748b">{{ r.telephone }}</div></td>
                <td style="color:#ef4444;font-weight:700">{{ r.montant | number:'1.0-0' }} F</td>
                <td>{{ r.joursRetard }}j</td>
                <td style="max-width:340px;font-size:12px;white-space:pre-line">{{ r.message }}</td>
                <td style="white-space:nowrap">
                  <button class="btn btn-primary btn-sm" (click)="validerRelance(r, 'envoyer')" style="margin-right:6px">Envoyer</button>
                  <button class="btn btn-secondary btn-sm" (click)="validerRelance(r, 'annuler')">Annuler</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    <div class="gw-card">
      <div class="card-header">
        <div class="card-title">📋 Dernières relances WhatsApp</div>
      </div>
      <table class="gw-table">
        <thead>
          <tr><th>Date</th><th>Client</th><th>Niveau</th><th>Montant</th><th>Mode</th><th>Statut</th><th>Réponse / Détail</th></tr>
        </thead>
        <tbody>
          @for (r of relancesRecentes(); track r.id) {
            <tr>
              <td style="font-size:12px">{{ r.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
              <td><strong>{{ r.clientNom }}</strong></td>
              <td>{{ niveauLabels[r.niveau] || r.niveau }}</td>
              <td>{{ r.montant | number:'1.0-0' }} F</td>
              <td><span class="badge badge-secondary">{{ r.declenchement }}</span></td>
              <td><span [class]="'badge ' + (statutRelanceBadges[r.statut] || 'badge-secondary')">
                {{ statutRelanceLabels[r.statut] || r.statut }}
              </span></td>
              <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" [title]="r.reponse || r.erreur || ''">
                {{ r.reponse || r.erreur || '—' }}
              </td>
            </tr>
          }
          @if (relancesRecentes().length === 0) {
            <tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:24px">Aucune relance enregistrée.</td></tr>
          }
        </tbody>
      </table>
    </div>
  }
</div>

<!-- MODAL CRÉER / MODIFIER UTILISATEUR -->
@if (showUserModal()) {
  <div class="gw-modal-backdrop" (click)="showUserModal.set(false)">
    <div class="gw-modal modal-md" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title">{{ editingUser ? 'Modifier l\'utilisateur' : 'Créer un compte utilisateur' }}</div>
        <button class="modal-close" (click)="showUserModal.set(false)">✕</button>
      </div>
      <div class="modal-body">
        <div class="grid-2">
          <div class="form-group">
            <label>Nom complet *</label>
            <input class="form-control" [(ngModel)]="userForm.nom" placeholder="Prénom Nom">
          </div>
          <div class="form-group">
            <label>E-mail *</label>
            <input type="email" class="form-control" [(ngModel)]="userForm.email" [disabled]="!!editingUser" placeholder="email@gwater.com">
          </div>
        </div>
        <div class="form-group" style="margin-top:12px">
          <label>Rôle *</label>
          <select class="form-control" [(ngModel)]="userForm.role">
            @if (isSuperAdmin()) {
              <option value="superadmin">Super Admin</option>
              <option value="admin">Admin</option>
            }
            <option value="vendeur">Vendeur</option>
            <option value="comptable">Comptable</option>
          </select>
        </div>

        @if (!editingUser) {
          <div class="form-group" style="margin-top:14px">
            <label>Mot de passe initial * (min. 6 caractères)</label>
            <div class="pwd-box">
              <input class="form-control" [type]="showCreatePwd() ? 'text' : 'password'"
                     [(ngModel)]="createPassword" placeholder="Saisir ou générer un mot de passe">
              <button type="button" class="btn btn-secondary btn-sm" (click)="showCreatePwd.set(!showCreatePwd())" title="Afficher/Masquer">
                {{ showCreatePwd() ? '🙈' : '👁️' }}
              </button>
              <button type="button" class="btn btn-secondary btn-sm" (click)="createPassword = genererMotDePasse(); showCreatePwd.set(true)" title="Générer">
                🎲 Générer
              </button>
              <button type="button" class="btn btn-secondary btn-sm" (click)="copier(createPassword)" title="Copier">
                📋
              </button>
            </div>
            <div class="pwd-meter">
              <div class="pwd-meter-bar" [style.width.%]="pwdStrength(createPassword).pct" [style.background]="pwdStrength(createPassword).color"></div>
            </div>
            <div style="font-size:11px;margin-top:4px" [style.color]="pwdStrength(createPassword).color">
              Force : {{ pwdStrength(createPassword).label }}
            </div>
            <label style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:12px;cursor:pointer">
              <input type="checkbox" [(ngModel)]="createMustChangePwd">
              Demander le changement du mot de passe à la première connexion
            </label>
          </div>
        }
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" (click)="showUserModal.set(false)">Annuler</button>
        <button class="btn btn-primary" (click)="saveUser()" [disabled]="saving()">
          @if (saving()) { <span class="loading-spinner" style="width:16px;height:16px;border-width:2px;margin:0"></span> }
          @else { {{ editingUser ? 'Enregistrer' : 'Créer le compte' }} }
        </button>
      </div>
    </div>
  </div>
}

<!-- MODAL RÉINITIALISER MOT DE PASSE (SUPERADMIN / ADMIN) -->
@if (resetTarget()) {
  <div class="gw-modal-backdrop" (click)="resetTarget.set(null)">
    <div class="gw-modal modal-md" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title">🔑 Mot de passe — {{ resetTarget()!.nom }}</div>
        <button class="modal-close" (click)="resetTarget.set(null)">✕</button>
      </div>
      <div class="modal-body">
        <div style="display:flex;align-items:center;gap:12px;padding:12px;background:#f8fafc;border-radius:10px;margin-bottom:16px">
          <div class="avatar sm" [style.background]="roleColor(resetTarget()!.role)" style="color:white;font-weight:700">
            {{ (resetTarget()!.nom || 'U')[0].toUpperCase() }}
          </div>
          <div style="flex:1">
            <div style="font-weight:700">{{ resetTarget()!.nom }}</div>
            <div style="font-size:12px;color:#64748b">{{ resetTarget()!.email }}</div>
          </div>
          <span [class]="'badge ' + roleBadge(resetTarget()!.role)">{{ roleLabels[resetTarget()!.role] }}</span>
        </div>

        <div class="form-group">
          <label>Nouveau mot de passe direct (min. 6 caractères)</label>
          <div class="pwd-box">
            <input class="form-control" [type]="showResetPwd() ? 'text' : 'password'"
                   [(ngModel)]="resetNewPassword" placeholder="Nouveau mot de passe">
            <button type="button" class="btn btn-secondary btn-sm" (click)="showResetPwd.set(!showResetPwd())">
              {{ showResetPwd() ? '🙈' : '👁️' }}
            </button>
            <button type="button" class="btn btn-secondary btn-sm" (click)="resetNewPassword = genererMotDePasse(); showResetPwd.set(true)">
              🎲 Générer
            </button>
            <button type="button" class="btn btn-secondary btn-sm" (click)="copier(resetNewPassword)">
              📋
            </button>
          </div>
          <div class="pwd-meter">
            <div class="pwd-meter-bar" [style.width.%]="pwdStrength(resetNewPassword).pct" [style.background]="pwdStrength(resetNewPassword).color"></div>
          </div>
          <label style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:12px;cursor:pointer">
            <input type="checkbox" [(ngModel)]="resetMustChangePwd">
            Forcer le changement à la prochaine connexion
          </label>
        </div>

        <div style="margin-top:16px;padding-top:14px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;gap:10px">
          <span style="font-size:12px;color:#64748b">Ou envoyer un lien de réinitialisation par e-mail :</span>
          <button type="button" class="btn btn-secondary btn-sm" (click)="resetPwd(resetTarget()!)">
            ✉️ Envoyer l'e-mail
          </button>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" (click)="resetTarget.set(null)">Fermer</button>
        <button class="btn btn-primary" (click)="applyDirectPasswordReset()" [disabled]="resettingPwd()">
          {{ resettingPwd() ? 'Mise à jour…' : '✅ Appliquer le mot de passe' }}
        </button>
      </div>
    </div>
  </div>
}
  `
})
export class AdminComponent implements OnInit {
  authService = inject(AuthService);
  toastService = inject(ToastService);
  dataService = inject(DataService);
  waService = inject(WhatsappService);
  private firebaseAuth = inject(FIREBASE_AUTH);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  activeTab = signal('users');
  showUserModal = signal(false);
  saving = signal(false);
  savingSettings = signal(false);
  savingWa = signal(false);
  checkingWa = signal(false);
  editingUser: UserItem | null = null;

  createPassword = '';
  createMustChangePwd = true;
  showCreatePwd = signal(true);

  resetTarget = signal<UserItem | null>(null);
  resetNewPassword = '';
  resetMustChangePwd = true;
  showResetPwd = signal(true);
  resettingPwd = signal(false);

  waEtat = signal<WhatsappEtat | null>(null);
  relancesAValider = signal<Relance[]>([]);
  relancesRecentes = signal<Relance[]>([]);
  waForm: WhatsappSettings = mergeWhatsappSettings(DEFAULT_WHATSAPP_SETTINGS);
  readonly niveauLabels = NIVEAU_LABELS;
  readonly statutRelanceLabels = STATUT_RELANCE_LABELS;
  readonly statutRelanceBadges = STATUT_RELANCE_BADGES;

  searchUser = '';
  filterRole = '';
  filterStatut = '';
  searchAudit = '';
  filterAction = '';

  userForm: Partial<UserItem> = { nom: '', email: '', role: 'vendeur' };

  settingsForm: AppSettings = {
    nomEntreprise: 'GWater Distribution',
    devise: 'FCFA',
    adresse: '',
    telephone: '',
    email: 'contact@gwater.com',
    prefixeFacture: 'FAC',
    plafondRemiseVendeur: 5,
    delaiPaiementDefaut: 30,
    seuilStockAlerte: 20,
    moyensPaiement: ['especes', 'orange_money', 'wave', 'virement'],
  };

  tabs = [
    { id: 'users', label: 'Utilisateurs', icon: '👥' },
    { id: 'audit', label: 'Journal d\'audit', icon: '📋' },
    { id: 'parametres', label: 'Paramètres', icon: '⚙️' },
    { id: 'whatsapp', label: 'WhatsApp', icon: '📱' },
  ];

  roleLabels: Record<string, string> = {
    superadmin: 'Super Admin', admin: 'Admin',
    vendeur: 'Vendeur', comptable: 'Comptable'
  };

  users: UserItem[] = [];
  auditLogs: AuditLogItem[] = [];

  moyensPaiement = [
    { key: 'especes', label: 'Espèces', icon: '💵', actif: true },
    { key: 'orange_money', label: 'Orange Money', icon: '🟠', actif: true },
    { key: 'wave', label: 'Wave', icon: '🌊', actif: true },
    { key: 'moov_money', label: 'Moov Money', icon: '🟣', actif: false },
    { key: 'virement', label: 'Virement bancaire', icon: '🏦', actif: true },
    { key: 'cheque', label: 'Chèque', icon: '📄', actif: false },
  ];

  isSuperAdmin() { return this.authService.hasRole('superadmin'); }
  activeUsersCount() { return this.users.filter(u => u.statut === 'actif').length; }
  adminsCount() { return this.users.filter(u => u.role === 'superadmin' || u.role === 'admin').length; }

  canManagePassword(u: UserItem): boolean {
    if (this.isSuperAdmin()) return true;
    if (!this.authService.hasRole('admin')) return false;
    return u.id === this.authService.currentUser?.uid || (u.role !== 'superadmin' && u.role !== 'admin');
  }

  roleColor(role: string) {
    return { superadmin: '#8b5cf6', admin: '#0ea5e9', vendeur: '#22c55e', comptable: '#f59e0b' }[role] || '#94a3b8';
  }

  roleBadge(role: string) {
    return { superadmin: 'badge-info', admin: 'badge-primary', vendeur: 'badge-success', comptable: 'badge-warning' }[role] || 'badge-secondary';
  }

  genererMotDePasse(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    let pwd = 'Gw';
    for (let i = 0; i < 8; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    return pwd + '9!';
  }

  pwdStrength(pwd: string): { pct: number; color: string; label: string } {
    if (!pwd) return { pct: 0, color: '#94a3b8', label: 'Aucun' };
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 10) score++;
    if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { pct: 25, color: '#ef4444', label: 'Faible' };
    if (score === 2) return { pct: 55, color: '#f59e0b', label: 'Moyen' };
    if (score === 3) return { pct: 80, color: '#0ea5e9', label: 'Bon' };
    return { pct: 100, color: '#22c55e', label: 'Fort' };
  }

  copier(val: string) {
    if (!val) return;
    navigator.clipboard?.writeText(val)
      .then(() => this.toastService.info('Mot de passe copié dans le presse-papiers.'))
      .catch(() => {});
  }

  private auditBadge(action: string): string {
    const a = (action || '').toUpperCase();
    if (a.includes('ANNUL') || a.includes('DESACT')) return 'badge-danger';
    if (a.includes('AJUST') || a.includes('REOUVERT') || a.includes('CLOTURE') || a.includes('MOT_DE_PASSE')) return 'badge-warning';
    if (a.includes('CREE') || a.includes('REACTIV')) return 'badge-success';
    return 'badge-info';
  }

  ngOnInit() {
    this.loadUsers();
    this.loadAuditLogs();
    this.loadSettings();
    this.loadWhatsapp();
  }

  private loadWhatsapp() {
    this.waService.getSettings(true).then(s => { this.waForm = s; this.cdr.markForCheck(); }).catch(() => {});
    this.waService.watchEtat().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: e => { this.waEtat.set(e); this.cdr.markForCheck(); }, error: () => {} });
    this.waService.watchRelancesAValider().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: l => { this.relancesAValider.set(l); this.cdr.markForCheck(); }, error: () => {} });
    this.waService.watchRelancesRecentes().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: l => { this.relancesRecentes.set(l); this.cdr.markForCheck(); }, error: () => {} });
  }

  async saveWhatsappSettings() {
    this.savingWa.set(true);
    try {
      await this.waService.saveSettings(this.waForm);
      this.toastService.success('Configuration WhatsApp enregistrée.');
    } catch {
      this.toastService.error('Erreur lors de l\'enregistrement de la configuration WhatsApp.');
    } finally {
      this.savingWa.set(false);
    }
  }

  async verifierWhatsapp() {
    this.checkingWa.set(true);
    try {
      const s = await this.waService.statutSession();
      if (s.connecte) this.toastService.success(`OpenWA connecté (${s.phone || 'session prête'}).`);
      else this.toastService.warning(`Statut OpenWA : ${s.status}${s.erreur ? ' — ' + s.erreur : ''}`);
    } catch (err) {
      this.toastService.error(err instanceof Error ? err.message : 'Impossible de joindre le serveur.');
    } finally {
      this.checkingWa.set(false);
    }
  }

  async validerRelance(r: Relance, action: 'envoyer' | 'annuler') {
    try {
      await this.waService.validerRelance(r.id, action);
      this.toastService.success(action === 'envoyer' ? `Mise en demeure envoyée à ${r.clientNom}.` : 'Mise en demeure annulée.');
    } catch (err) {
      this.toastService.error(err instanceof Error ? err.message : 'Erreur lors du traitement.');
    }
  }

  loadUsers() {
    this.dataService.getUsers().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => {
          this.users = data.map((u: any) => ({
            id: u.uid || u.id,
            nom: u.displayName || u.nom || u.email || 'Utilisateur',
            email: u.email || '',
            role: u.role || 'vendeur',
            statut: (u.status || u.statut || 'actif') as 'actif' | 'inactif',
            creepar: u.createdByName || 'Système',
            createdByUid: u.createdBy,
            creele: u.createdAt instanceof Date ? u.createdAt : new Date(u.createdAt || Date.now()),
            derniereConnexion: u.lastLogin ? (u.lastLogin instanceof Date ? u.lastLogin : new Date(u.lastLogin)) : undefined,
          }));
          this.cdr.markForCheck();
        },
        error: err => console.error('Erreur chargement utilisateurs', err)
      });
  }

  loadAuditLogs() {
    this.dataService.getAuditLogs().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => {
          this.auditLogs = data.map((a: any) => ({
            id: a.id,
            date: a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt || Date.now()),
            user: a.userName || a.userId || 'Système',
            action: a.action || 'ACTION',
            entite: a.entite || '—',
            detail: a.detail || '',
            badgeClass: this.auditBadge(a.action),
          }));
          this.cdr.markForCheck();
        },
        error: err => console.error('Erreur chargement audit', err)
      });
  }

  async loadSettings() {
    try {
      const cfg = await this.dataService.getSettings();
      if (cfg) {
        this.settingsForm = { ...this.settingsForm, ...cfg };
        const actifs = cfg.moyensPaiement || [];
        this.moyensPaiement.forEach(mp => mp.actif = actifs.includes(mp.key));
        this.cdr.markForCheck();
      }
    } catch (err) {
      console.error('Erreur chargement paramètres', err);
    }
  }

  async saveSettings() {
    if (!this.isSuperAdmin()) {
      this.toastService.error('Seul le Super Admin peut modifier les paramètres globaux.');
      return;
    }
    this.savingSettings.set(true);
    try {
      const payload: AppSettings = {
        ...this.settingsForm,
        moyensPaiement: this.moyensPaiement.filter(m => m.actif).map(m => m.key),
      };
      await this.dataService.saveSettings(payload);
      void this.dataService.logAudit(
        'PARAMETRES_MODIFIES',
        'parametres/config',
        `Paramètres mis à jour (${payload.nomEntreprise}, remise max ${payload.plafondRemiseVendeur}%)`,
        this.authService.currentUser?.uid || '',
        this.authService.currentUser?.displayName || 'Super Admin'
      );
      this.toastService.success('Paramètres enregistrés avec succès !');
    } catch (err) {
      console.error(err);
      this.toastService.error('Erreur lors de la sauvegarde des paramètres.');
    } finally {
      this.savingSettings.set(false);
    }
  }

  filteredUsers(): UserItem[] {
    const q = this.searchUser.trim().toLowerCase();
    return this.users.filter(u => {
      const matchRole = !this.filterRole || u.role === this.filterRole;
      const matchStatut = !this.filterStatut || u.statut === this.filterStatut;
      const matchQ = !q || u.nom.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      return matchRole && matchStatut && matchQ;
    });
  }

  filteredAuditLogs(): AuditLogItem[] {
    const q = this.searchAudit.trim().toLowerCase();
    return this.auditLogs.filter(l => {
      const matchAct = !this.filterAction || l.action.toUpperCase().includes(this.filterAction);
      const matchQ = !q || l.user.toLowerCase().includes(q) || l.entite.toLowerCase().includes(q) || l.detail.toLowerCase().includes(q);
      return matchAct && matchQ;
    });
  }

  openNewUser() {
    this.editingUser = null;
    this.userForm = { nom: '', email: '', role: 'vendeur' };
    this.createPassword = this.genererMotDePasse();
    this.createMustChangePwd = true;
    this.showCreatePwd.set(true);
    this.showUserModal.set(true);
  }

  editUser(u: UserItem) {
    if (u.role === 'superadmin' && !this.isSuperAdmin()) {
      this.toastService.error('Seul un Super Admin peut modifier un Super Admin.');
      return;
    }
    this.editingUser = u;
    this.userForm = { ...u };
    this.showUserModal.set(true);
  }

  openResetModal(u: UserItem) {
    if (!this.canManagePassword(u)) {
      this.toastService.error('Seul un Super Admin peut réinitialiser le mot de passe d\'un administrateur.');
      return;
    }
    this.resetTarget.set(u);
    this.resetNewPassword = this.genererMotDePasse();
    this.resetMustChangePwd = true;
    this.showResetPwd.set(true);
  }

  async applyDirectPasswordReset() {
    const target = this.resetTarget();
    if (!target) return;
    if (!this.resetNewPassword || this.resetNewPassword.length < 6) {
      this.toastService.error('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    const current = this.firebaseAuth.currentUser;
    if (!current) {
      this.toastService.error('Session expirée, reconnectez-vous.');
      return;
    }
    this.resettingPwd.set(true);
    try {
      const token = await current.getIdToken();
      const res = await fetch('/api/admin/set-password', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          targetUid: target.id,
          newPassword: this.resetNewPassword,
          mustChangePassword: this.resetMustChangePwd,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Impossible de modifier le mot de passe.');
      }
      this.toastService.success(`Mot de passe mis à jour pour ${target.nom}.`);
      this.resetTarget.set(null);
    } catch (err) {
      this.toastService.error(err instanceof Error ? err.message : 'Erreur lors de la réinitialisation.');
    } finally {
      this.resettingPwd.set(false);
    }
  }

  async saveUser() {
    if (!this.userForm.nom || !this.userForm.email) {
      this.toastService.error('Nom et e-mail sont obligatoires.');
      return;
    }
    if (!this.editingUser && (!this.createPassword || this.createPassword.length < 6)) {
      this.toastService.error('Le mot de passe initial doit contenir au moins 6 caractères.');
      return;
    }
    this.saving.set(true);
    let secondaryApp: any = null;
    try {
      if (this.editingUser) {
        await this.dataService.saveUserProfile(this.editingUser.id, {
          displayName: this.userForm.nom,
          role: this.userForm.role,
        });
        void this.dataService.logAudit(
          'UTILISATEUR_MODIFIE',
          this.editingUser.email,
          `Profil modifié : ${this.userForm.nom} (${this.userForm.role})`,
          this.authService.currentUser?.uid || '',
          this.authService.currentUser?.displayName || ''
        );
        this.toastService.success('Utilisateur mis à jour.');
      } else {
        // Créer via instance secondaire Firebase pour ne pas déconnecter l'admin
        secondaryApp = initializeApp(firebaseConfig, 'secondary-' + Date.now());
        const secondaryAuth = getAuth(secondaryApp);
        const pwd = this.createPassword;
        const cred = await createUserWithEmailAndPassword(secondaryAuth, this.userForm.email!, pwd);
        await Promise.all([
          updateProfile(cred.user, { displayName: this.userForm.nom }),
          this.dataService.saveUserProfile(cred.user.uid, {
            uid: cred.user.uid,
            email: this.userForm.email,
            displayName: this.userForm.nom,
            role: this.userForm.role,
            status: 'actif',
            mustChangePassword: this.createMustChangePwd,
            createdBy: this.authService.currentUser?.uid || 'system',
            createdByName: this.authService.currentUser?.displayName || 'Admin',
            createdAt: new Date()
          })
        ]);
        void secondaryAuth.signOut().finally(() => deleteApp(secondaryApp).catch(() => {}));
        secondaryApp = null;
        void this.dataService.logAudit(
          'UTILISATEUR_CREE',
          this.userForm.email!,
          `Compte créé (${this.userForm.role}) pour ${this.userForm.nom}`,
          this.authService.currentUser?.uid || '',
          this.authService.currentUser?.displayName || ''
        );
        this.toastService.success(`Compte créé pour ${this.userForm.nom} !`);
      }
      this.showUserModal.set(false);
    } catch (e: any) {
      this.toastService.error('Erreur : ' + (e.message || e.code));
    } finally {
      if (secondaryApp) {
        try { await deleteApp(secondaryApp); } catch { /* ignore */ }
      }
      this.saving.set(false);
    }
  }

  async resetPwd(u: UserItem) {
    try {
      await this.authService.sendPasswordReset(u.email);
      void this.dataService.logAudit(
        'RESET_MOT_DE_PASSE',
        u.email,
        `E-mail de réinitialisation envoyé à ${u.nom}`,
        this.authService.currentUser?.uid || '',
        this.authService.currentUser?.displayName || ''
      );
      this.toastService.success(`Lien de réinitialisation envoyé à ${u.email}.`);
    } catch (e: any) {
      this.toastService.error('Erreur envoi réinitialisation : ' + (e.message || e.code));
    }
  }

  async toggleUser(u: UserItem) {
    if (u.id === this.authService.currentUser?.uid) {
      this.toastService.error('Vous ne pouvez pas désactiver votre propre compte.');
      return;
    }
    if ((u.role === 'superadmin' || u.role === 'admin') && !this.isSuperAdmin()) {
      this.toastService.error('Seul un Super Admin peut désactiver un administrateur.');
      return;
    }
    if (!this.isSuperAdmin() && u.createdByUid && u.createdByUid !== this.authService.currentUser?.uid) {
      this.toastService.error('Un Admin ne peut désactiver que les comptes qu\'il a créés.');
      return;
    }
    const newStatus = u.statut === 'actif' ? 'inactif' : 'actif';
    try {
      await this.dataService.saveUserProfile(u.id, { status: newStatus });
      void this.dataService.logAudit(
        newStatus === 'inactif' ? 'COMPTE_DESACTIVE' : 'COMPTE_REACTIVE',
        u.email,
        `Statut de ${u.nom} passé à ${newStatus}`,
        this.authService.currentUser?.uid || '',
        this.authService.currentUser?.displayName || ''
      );
      this.toastService.warning(`Compte ${u.nom} ${newStatus === 'actif' ? 'réactivé' : 'désactivé'}.`);
    } catch {
      this.toastService.error('Erreur lors de la mise à jour du statut.');
    }
  }
}

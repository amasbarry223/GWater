import { Component, ChangeDetectorRef, DestroyRef, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { DataService } from '../../core/data.service';
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
  template: `
<div>
  <div class="page-header">
    <div>
      <div class="page-title">Administration</div>
      <div class="page-subtitle">Gestion des utilisateurs, paramètres et journal d'audit</div>
    </div>
  </div>

  <!-- Tabs -->
  <div style="display:flex;gap:4px;margin-bottom:20px;background:#f1f5f9;border-radius:10px;padding:4px;width:fit-content">
    @for (tab of tabs; track tab.id) {
      <button class="btn" [style.background]="activeTab()===tab.id?'white':'transparent'"
              [style.box-shadow]="activeTab()===tab.id?'var(--gw-shadow)':'none'"
              [style.color]="activeTab()===tab.id?'var(--gw-text)':'#94a3b8'"
              (click)="activeTab.set(tab.id)">{{ tab.icon }} {{ tab.label }}</button>
    }
  </div>

  @if (activeTab() === 'users') {
    <div style="margin-bottom:16px;display:flex;justify-content:flex-end">
      <button class="btn btn-primary" (click)="openNewUser()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Créer un utilisateur
      </button>
    </div>

    <div class="gw-table-wrapper">
      <div class="gw-table-toolbar">
        <div class="toolbar-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#94a3b8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Rechercher un utilisateur..." [(ngModel)]="searchUser">
        </div>
        <select class="form-control" style="width:160px;height:34px" [(ngModel)]="filterRole">
          <option value="">Tous les rôles</option>
          <option value="superadmin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="vendeur">Vendeur</option>
          <option value="comptable">Comptable</option>
        </select>
        <div class="toolbar-spacer"></div>
        <span style="font-size:12px;color:#94a3b8">{{ filteredUsers().length }} utilisateur(s)</span>
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
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          @for (u of filteredUsers(); track u.id) {
            <tr>
              <td>
                <div style="display:flex;align-items:center;gap:10px">
                  <div class="avatar sm" [style.background]="roleColor(u.role)" style="color:white">
                    {{ (u.nom || u.email || 'U')[0].toUpperCase() }}
                  </div>
                  <strong>{{ u.nom || u.email }}</strong>
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
                <div class="td-actions">
                  <button class="btn btn-ghost btn-sm btn-icon" title="Modifier" (click)="editUser(u)">✏️</button>
                  <button class="btn btn-ghost btn-sm btn-icon" title="Envoyer lien réinitialisation mdp" (click)="resetPwd(u)">🔑</button>
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
            <tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:28px">Aucun utilisateur trouvé</td></tr>
          }
        </tbody>
      </table>
    </div>
  }

  @if (activeTab() === 'audit') {
    <div class="gw-table-wrapper">
      <div class="gw-table-toolbar">
        <div class="toolbar-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#94a3b8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Rechercher dans le journal..." [(ngModel)]="searchAudit">
        </div>
        <select class="form-control" style="width:170px;height:34px" [(ngModel)]="filterAction">
          <option value="">Toutes actions</option>
          <option value="VENTE">Ventes</option>
          <option value="STOCK">Stock</option>
          <option value="PERIODE">Périodes</option>
          <option value="UTILISATEUR">Utilisateurs</option>
          <option value="COMPTE">Comptes</option>
          <option value="PARAMETRES">Paramètres</option>
        </select>
        <div class="toolbar-spacer"></div>
        <span style="font-size:12px;color:#94a3b8">{{ filteredAuditLogs().length }} entrée(s)</span>
      </div>
      <table class="gw-table">
        <thead>
          <tr>
            <th>Date/Heure</th>
            <th>Utilisateur</th>
            <th>Action</th>
            <th>Entité</th>
            <th>Détails</th>
          </tr>
        </thead>
        <tbody>
          @for (log of filteredAuditLogs(); track log.id) {
            <tr>
              <td style="font-size:12px;color:#64748b">{{ log.date | date:'dd/MM/yyyy HH:mm:ss' }}</td>
              <td><strong>{{ log.user }}</strong></td>
              <td><span [class]="'badge ' + log.badgeClass">{{ log.action }}</span></td>
              <td style="font-size:12px">{{ log.entite }}</td>
              <td style="font-size:12px;color:#64748b;max-width:360px">{{ log.detail }}</td>
            </tr>
          }
          @if (filteredAuditLogs().length === 0) {
            <tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:28px">Aucune entrée dans le journal d'audit</td></tr>
          }
        </tbody>
      </table>
    </div>
  }

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
          <div class="card-title">🏢 Paramètres de l'entreprise</div>
        </div>
        <div class="card-body">
          <div class="form-group" style="margin-bottom:12px">
            <label>Nom de l'entreprise</label>
            <input class="form-control" [(ngModel)]="settingsForm.nomEntreprise" [disabled]="!isSuperAdmin()" placeholder="Nom de l'entreprise">
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label>Devise</label>
            <select class="form-control" [(ngModel)]="settingsForm.devise" [disabled]="!isSuperAdmin()">
              <option value="FCFA">FCFA (XOF)</option>
              <option value="GNF">GNF</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label>Adresse</label>
            <input class="form-control" [(ngModel)]="settingsForm.adresse" [disabled]="!isSuperAdmin()" placeholder="Adresse complète">
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label>Téléphone</label>
            <input class="form-control" [(ngModel)]="settingsForm.telephone" [disabled]="!isSuperAdmin()" placeholder="+224 XXX XXX XXX">
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label>E-mail de contact</label>
            <input class="form-control" type="email" [(ngModel)]="settingsForm.email" [disabled]="!isSuperAdmin()" placeholder="contact@gwater.com">
          </div>
          <div class="form-group">
            <label>Préfixe factures</label>
            <input class="form-control" [(ngModel)]="settingsForm.prefixeFacture" [disabled]="!isSuperAdmin()" placeholder="FAC">
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
          <div class="card-title">⚙️ Paramètres métier</div>
        </div>
        <div class="card-body">
          <div class="form-group" style="margin-bottom:12px">
            <label>Plafond de remise Vendeur (%)</label>
            <input type="number" class="form-control" [(ngModel)]="settingsForm.plafondRemiseVendeur" [disabled]="!isSuperAdmin()" min="0" max="100">
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label>Délai de paiement par défaut (jours)</label>
            <input type="number" class="form-control" [(ngModel)]="settingsForm.delaiPaiementDefaut" [disabled]="!isSuperAdmin()">
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label>Seuil stock bas global (%)</label>
            <input type="number" class="form-control" [(ngModel)]="settingsForm.seuilStockAlerte" [disabled]="!isSuperAdmin()">
          </div>
          <div class="section-title" style="margin-top:16px">Moyens de paiement activés</div>
          @for (mp of moyensPaiement; track mp.key) {
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
              <input type="checkbox" [id]="mp.key" [(ngModel)]="mp.actif" [disabled]="!isSuperAdmin()">
              <label [for]="mp.key" style="cursor:pointer;font-size:13px">{{ mp.icon }} {{ mp.label }}</label>
            </div>
          }
        </div>
        <div class="card-footer">
          <button class="btn btn-primary" (click)="saveSettings()" [disabled]="!isSuperAdmin() || savingSettings()">
            {{ savingSettings() ? 'Enregistrement...' : '💾 Enregistrer' }}
          </button>
        </div>
      </div>
    </div>
  }
</div>

<!-- MODAL CRÉER UTILISATEUR -->
@if (showUserModal()) {
  <div class="gw-modal-backdrop" (click)="showUserModal.set(false)">
    <div class="gw-modal modal-md" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title">{{ editingUser ? 'Modifier l\'utilisateur' : 'Créer un utilisateur' }}</div>
        <button class="modal-close" (click)="showUserModal.set(false)">✕</button>
      </div>
      <div class="modal-body">
        @if (!editingUser) {
          <div class="gw-alert alert-info" style="margin-bottom:16px">
            <span class="alert-icon">ℹ️</span>
            <div class="alert-content">Un mot de passe temporaire sera généré et affiché une seule fois à la création.</div>
          </div>
        }
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
            @if (authService.hasRole('superadmin')) {
              <option value="admin">Admin</option>
            }
            <option value="vendeur">Vendeur</option>
            <option value="comptable">Comptable</option>
          </select>
        </div>
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
  `
})
export class AdminComponent implements OnInit {
  authService = inject(AuthService);
  toastService = inject(ToastService);
  dataService = inject(DataService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  activeTab = signal('users');
  showUserModal = signal(false);
  saving = signal(false);
  savingSettings = signal(false);
  editingUser: UserItem | null = null;

  searchUser = '';
  filterRole = '';
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

  roleColor(role: string) {
    return { superadmin: '#8b5cf6', admin: '#0ea5e9', vendeur: '#22c55e', comptable: '#f59e0b' }[role] || '#94a3b8';
  }

  roleBadge(role: string) {
    return { superadmin: 'badge-info', admin: 'badge-primary', vendeur: 'badge-success', comptable: 'badge-warning' }[role] || 'badge-secondary';
  }

  private auditBadge(action: string): string {
    const a = (action || '').toUpperCase();
    if (a.includes('ANNUL') || a.includes('DESACT')) return 'badge-danger';
    if (a.includes('AJUST') || a.includes('REOUVERT') || a.includes('CLOTURE')) return 'badge-warning';
    if (a.includes('CREE') || a.includes('REACTIV')) return 'badge-success';
    return 'badge-info';
  }

  ngOnInit() {
    this.loadUsers();
    this.loadAuditLogs();
    this.loadSettings();
  }

  loadUsers() {
    this.dataService.getUsers().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => {
          this.users = data.map((u: any) => ({
            id: u.uid || u.id,
            nom: u.displayName || u.nom || '',
            email: u.email || '',
            role: u.role || 'vendeur',
            statut: u.status || u.statut || 'actif',
            creepar: u.createdByName || u.createdBy || 'Système',
            createdByUid: u.createdBy,
            creele: u.createdAt?.toDate ? u.createdAt.toDate() : (u.createdAt ? new Date(u.createdAt) : new Date()),
            derniereConnexion: u.lastLogin?.toDate ? u.lastLogin.toDate() : u.lastLogin
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
          this.auditLogs = data.map((l: any) => ({
            id: l.id,
            date: l.createdAt?.toDate ? l.createdAt.toDate() : (l.createdAt ? new Date(l.createdAt) : new Date()),
            user: l.userName || l.userId || 'Système',
            action: l.action || 'ACTION',
            entite: l.entite || '—',
            detail: l.detail || '',
            badgeClass: this.auditBadge(l.action),
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
      const matchQ = !q || u.nom.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      return matchRole && matchQ;
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

  async saveUser() {
    if (!this.userForm.nom || !this.userForm.email) {
      this.toastService.error('Nom et e-mail sont obligatoires.');
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
        const tmpPassword = 'Temp' + Math.random().toString(36).slice(2, 8).toUpperCase() + '1!';
        const cred = await createUserWithEmailAndPassword(secondaryAuth, this.userForm.email!, tmpPassword);
        await Promise.all([
          updateProfile(cred.user, { displayName: this.userForm.nom }),
          this.dataService.saveUserProfile(cred.user.uid, {
            uid: cred.user.uid,
            email: this.userForm.email,
            displayName: this.userForm.nom,
            role: this.userForm.role,
            status: 'actif',
            mustChangePassword: true,
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
        this.toastService.success(`Compte créé ! Mot de passe temporaire : ${tmpPassword}`);
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

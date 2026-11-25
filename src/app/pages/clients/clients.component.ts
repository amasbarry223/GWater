import { Component, ChangeDetectorRef, inject, signal, OnInit, ViewChild, ElementRef, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { DataService } from '../../core/data.service';
import { ToastService } from '../../core/toast.service';
import { AuthService } from '../../core/auth.service';
import {
  WhatsappService, WhatsappApiError, Relance, STATUT_RELANCE_LABELS, STATUT_RELANCE_BADGES,
} from '../../core/whatsapp.service';
import { NIVEAU_LABELS } from '../../core/whatsapp.utils';
import { Client, Vente, AppSettings, ConsigneMouvement } from '../../core/models';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';

interface FactureDemo {
  numero: string;
  date: Date;
  montant: number;
  statut: 'payee' | 'partiel' | 'impayee';
}

interface ClientExt extends Client {
  totalAchats: number;
  derniereCommande: Date | null;
  joursImpaye: number;
  factures: FactureDemo[];
}

interface CsvRow {
  nom: string;
  type: string;
  telephone: string;
  quartier: string;
  grilleTarifaire: string;
  valid: boolean;
  error: string;
}

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
<div>
  <div class="page-header">
    <div>
      <div class="page-title">Clients</div>
      <div class="page-subtitle">{{ filteredClients().length }} client(s) • Gestion du fichier clients</div>
    </div>
    <div class="page-actions">
      <button class="btn btn-secondary btn-sm" (click)="triggerCsvImport()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Importer CSV
      </button>
      <input type="file" #csvFileInput accept=".csv" style="display:none" (change)="onCsvFile($event)">
      <button class="btn btn-secondary btn-sm" (click)="exportCsv()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Exporter
      </button>
      <button class="btn btn-primary" (click)="openModal()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Nouveau client
      </button>
    </div>
  </div>

  <!-- Tabs -->
  <div style="display:flex;gap:4px;margin-bottom:20px;background:#f1f5f9;border-radius:10px;padding:4px;width:fit-content">
    <button class="btn" [style.background]="activeTab()==='clients'?'white':'transparent'"
            [style.box-shadow]="activeTab()==='clients'?'var(--gw-shadow)':'none'"
            [style.color]="activeTab()==='clients'?'var(--gw-text)':'#94a3b8'"
            (click)="activeTab.set('clients')">👥 Clients</button>
    <button class="btn" [style.background]="activeTab()==='impayes'?'white':'transparent'"
            [style.box-shadow]="activeTab()==='impayes'?'var(--gw-shadow)':'none'"
            [style.color]="activeTab()==='impayes'?'var(--gw-text)':'#94a3b8'"
            (click)="activeTab.set('impayes')">
      ⚠️ Impayés
      @if (impayesList().length > 0) {
        <span class="badge badge-danger" style="margin-left:6px;font-size:10px;padding:2px 6px">{{ impayesList().length }}</span>
      }
    </button>
    <button class="btn" [style.background]="activeTab()==='consignes'?'white':'transparent'"
            [style.box-shadow]="activeTab()==='consignes'?'var(--gw-shadow)':'none'"
            [style.color]="activeTab()==='consignes'?'var(--gw-text)':'#94a3b8'"
            (click)="activeTab.set('consignes')">
      📦 Consignes
      @if (totalConsignesDetenues() > 0) {
        <span class="badge badge-info" style="margin-left:6px;font-size:10px;padding:2px 6px">{{ totalConsignesDetenues() }}</span>
      }
    </button>
  </div>

  <!-- ============ ONGLET CLIENTS ============ -->
  @if (activeTab() === 'clients') {
    <!-- Segmentation cards CLI-10 -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div class="gw-card" style="cursor:pointer;transition:border-color 0.2s;border:2px solid transparent"
           [style.border-color]="filterSegment==='meilleurs'?'#22c55e':'transparent'"
           (click)="setSegment('meilleurs')">
        <div class="card-body" style="display:flex;align-items:center;gap:16px;padding:16px">
          <div style="font-size:36px">🏆</div>
          <div style="flex:1">
            <div style="font-weight:600;font-size:14px">Meilleurs clients</div>
            <div style="font-size:12px;color:#94a3b8">CA > 100 000 FCFA ce mois</div>
            <div style="font-size:12px;color:#22c55e;font-weight:600;margin-top:4px">{{ bestClientsCount() }} clients</div>
          </div>
          @if (filterSegment === 'meilleurs') { <span class="badge badge-success">Actif</span> }
        </div>
      </div>
      <div class="gw-card" style="cursor:pointer;transition:border-color 0.2s;border:2px solid transparent"
           [style.border-color]="filterSegment==='inactifs'?'#f59e0b':'transparent'"
           (click)="setSegment('inactifs')">
        <div class="card-body" style="display:flex;align-items:center;gap:16px;padding:16px">
          <div style="font-size:36px">😴</div>
          <div style="flex:1">
            <div style="font-weight:600;font-size:14px">Clients inactifs</div>
            <div style="font-size:12px;color:#94a3b8">> 30 jours sans commande</div>
            <div style="font-size:12px;color:#f59e0b;font-weight:600;margin-top:4px">{{ inactiveClientsCount() }} clients</div>
          </div>
          @if (filterSegment === 'inactifs') { <span class="badge badge-warning">Actif</span> }
        </div>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid-kpi" style="margin-bottom:24px">
      @for (s of stats; track s.label) {
        <div class="kpi-card">
          <div class="kpi-top"><div class="kpi-icon" [style.background]="s.bg">{{ s.icon }}</div></div>
          <div class="kpi-value">{{ s.value }}</div>
          <div class="kpi-label">{{ s.label }}</div>
        </div>
      }
    </div>

    <!-- Table -->
    <div class="gw-table-wrapper">
      <div class="gw-table-toolbar">
        <div class="toolbar-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#94a3b8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Rechercher par nom, téléphone, quartier..." [(ngModel)]="search" (input)="filterClients()">
        </div>
        <select class="form-control" style="width:150px;height:34px" [(ngModel)]="filterType" (change)="filterClients()">
          <option value="">Tous les types</option>
          <option value="particulier">Particulier</option>
          <option value="boutique">Boutique</option>
          <option value="restaurant">Restaurant</option>
          <option value="entreprise">Entreprise</option>
          <option value="institution">Institution</option>
        </select>
        <select class="form-control" style="width:140px;height:34px" [(ngModel)]="filterStatut" (change)="filterClients()">
          <option value="">Tous les statuts</option>
          <option value="actif">Actif</option>
          <option value="suspendu">Suspendu</option>
          <option value="archive">Archivé</option>
        </select>
        @if (filterSegment) {
          <button class="btn btn-secondary btn-sm" (click)="setSegment('')">✕ Effacer filtre</button>
        }
        <div class="toolbar-spacer"></div>
        <span style="font-size:12px;color:#94a3b8">{{ filteredClients().length }} résultat(s)</span>
      </div>

      <table class="gw-table">
        <thead>
          <tr>
            <th (click)="sort('code')" [class.sorted]="sortField==='code'">Code ↕</th>
            <th (click)="sort('nom')" [class.sorted]="sortField==='nom'">Client ↕</th>
            <th>Type</th>
            <th>Téléphone</th>
            <th>Quartier</th>
            <th>Grille tarif.</th>
            <th>Solde / Plafond</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          @if (loading()) {
            <tr><td colspan="9" style="text-align:center;padding:32px"><div class="loading-spinner"></div></td></tr>
          } @else if (pagedClients().length === 0) {
            <tr><td colspan="9">
              <div class="empty-state">
                <div class="empty-icon">👥</div>
                <div class="empty-title">Aucun client trouvé</div>
                <p>Ajoutez votre premier client ou modifiez vos filtres.</p>
              </div>
            </td></tr>
          } @else {
            @for (client of pagedClients(); track client.id) {
              <tr>
                <td><span style="font-family:monospace;font-size:12px;color:#0ea5e9">{{ client.code }}</span></td>
                <td>
                  <div style="display:flex;align-items:center;gap:10px">
                    <div class="avatar sm" [style.background]="avatarColor(client.nom)" style="color:white">{{ client.nom[0].toUpperCase() }}</div>
                    <div>
                      <div style="font-weight:500">{{ client.nom }}</div>
                      @if (client.notes) { <div style="font-size:11px;color:#94a3b8">{{ client.notes | slice:0:40 }}...</div> }
                    </div>
                  </div>
                </td>
                <td><span class="badge badge-secondary">{{ typeLabels[client.type] }}</span></td>
                <td>{{ client.telephone }}</td>
                <td>{{ client.quartier }}</td>
                <td><span class="badge badge-info">{{ grilleLabels[client.grilleTarifaire] }}</span></td>
                <td>
                  @if (client.solde > 0) {
                    <div>
                      <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
                        <span style="color:#ef4444;font-weight:600;font-size:13px">-{{ client.solde | number:'1.0-0' }} F</span>
                        @if (client.plafondCredit > 0 && client.solde > client.plafondCredit) {
                          <span class="badge badge-danger" style="font-size:9px;padding:1px 5px">DÉPASSÉ</span>
                        }
                      </div>
                      @if (client.plafondCredit > 0) {
                        <div style="height:4px;background:#f1f5f9;border-radius:2px;width:110px;overflow:hidden">
                          <div [style.width.%]="creditPct(client)"
                               [style.background]="client.solde > client.plafondCredit ? '#ef4444' : '#f59e0b'"
                               style="height:100%;border-radius:2px;transition:width 0.5s"></div>
                        </div>
                        <div style="font-size:10px;color:#94a3b8;margin-top:2px">/ {{ client.plafondCredit | number:'1.0-0' }} F</div>
                      }
                    </div>
                  } @else {
                    <span style="color:#22c55e;font-weight:500">0 FCFA</span>
                  }
                </td>
                <td>
                  <span [class]="'badge ' + statutBadge(client.statut)">
                    <span class="badge-dot"></span>{{ client.statut }}
                  </span>
                </td>
                <td>
                  <div class="td-actions">
                    <button class="btn btn-ghost btn-sm btn-icon" title="Voir" (click)="viewClient(client)">👁️</button>
                    <button class="btn btn-ghost btn-sm btn-icon" title="Modifier" (click)="openModal(client)">✏️</button>
                    <button class="btn btn-ghost btn-sm btn-icon" title="Archiver" (click)="archiveClient(client)" style="color:#ef4444">🗂️</button>
                  </div>
                </td>
              </tr>
            }
          }
        </tbody>
      </table>

      <div class="gw-table-pagination">
        <span class="pagination-info">Affichage {{ pageStart + 1 }}–{{ pageEnd }} sur {{ filteredClients().length }}</span>
        <button class="page-btn" [disabled]="page === 1" (click)="page = page - 1; updatePage()">‹</button>
        @for (p of pages(); track p) {
          <button class="page-btn" [class.active]="page === p" (click)="page = p; updatePage()">{{ p }}</button>
        }
        <button class="page-btn" [disabled]="page === totalPages()" (click)="page = page + 1; updatePage()">›</button>
      </div>
    </div>
  }

  <!-- ============ ONGLET IMPAYÉS CLI-07 ============ -->
  @if (activeTab() === 'impayes') {
    <div class="gw-card" style="margin-bottom:16px">
      <div class="card-body" style="padding:12px 16px">
        <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">
          <div style="font-weight:600;font-size:14px">Ancienneté des créances</div>
          <div style="display:flex;align-items:center;gap:6px">
            <div style="width:12px;height:12px;background:#fef9c3;border:2px solid #eab308;border-radius:2px"></div>
            <span style="font-size:12px">0–30 jours</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <div style="width:12px;height:12px;background:#ffedd5;border:2px solid #f97316;border-radius:2px"></div>
            <span style="font-size:12px">31–60 jours</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <div style="width:12px;height:12px;background:#fee2e2;border:2px solid #ef4444;border-radius:2px"></div>
            <span style="font-size:12px">> 60 jours</span>
          </div>
          <div style="margin-left:auto;display:flex;align-items:center;gap:12px">
            <div style="font-weight:700;color:#ef4444;font-size:16px">
              Total : {{ totalImpayes() | number:'1.0-0' }} FCFA
            </div>
            @if (waActif() && impayesList().length > 0 && authService.hasRole('superadmin', 'admin', 'comptable')) {
              <button class="btn btn-sm" (click)="relancerTousImpayes()" [disabled]="relancingBulk()"
                      style="background:#22c55e;color:white;border:1px solid #22c55e;border-radius:6px;padding:6px 12px;font-size:12px">
                {{ relancingBulk() ? 'Envoi en cours…' : '📱 Tout relancer (' + impayesList().length + ')' }}
              </button>
            }
          </div>
        </div>
      </div>
    </div>
    <div class="gw-table-wrapper">
      <table class="gw-table">
        <thead>
          <tr>
            <th>Client</th><th>Téléphone</th><th>Quartier</th>
            <th>Montant impayé</th><th>Ancienneté</th><th>Action</th>
          </tr>
        </thead>
        <tbody>
          @if (impayesList().length === 0) {
            <tr><td colspan="6">
              <div class="empty-state">
                <div class="empty-icon">✅</div>
                <div class="empty-title">Aucun impayé</div>
                <p>Tous les clients sont à jour.</p>
              </div>
            </td></tr>
          } @else {
            @for (client of impayesList(); track client.id) {
              <tr [style.background]="agingBg(client.joursImpaye)">
                <td>
                  <div style="display:flex;align-items:center;gap:8px">
                    <div class="avatar sm" [style.background]="avatarColor(client.nom)" style="color:white">{{ client.nom[0].toUpperCase() }}</div>
                    <div>
                      <div style="font-weight:500">{{ client.nom }}</div>
                      <div style="font-size:11px;color:#64748b">{{ client.code }}</div>
                    </div>
                  </div>
                </td>
                <td>{{ client.telephone }}</td>
                <td>{{ client.quartier }}</td>
                <td><span style="color:#ef4444;font-weight:700;font-size:14px">{{ client.solde | number:'1.0-0' }} FCFA</span></td>
                <td><span [class]="'badge ' + agingBadge(client.joursImpaye)" style="font-size:12px">{{ client.joursImpaye }}j</span></td>
                <td>
                  @if (client.whatsappOptOut) {
                    <span class="badge badge-secondary" title="Le client a répondu STOP">STOP (opt-out)</span>
                  } @else {
                    <button class="btn btn-sm" (click)="relancerClient(client)" [disabled]="relancingId() === client.id"
                            style="background:#22c55e;color:white;border:1px solid #22c55e;border-radius:6px;padding:5px 10px;font-size:12px">
                      {{ relancingId() === client.id ? 'Envoi…' : '📱 Relancer WhatsApp' }}
                    </button>
                  }
                </td>
              </tr>
            }
          }
        </tbody>
      </table>
    </div>
  }

  <!-- ============ ONGLET CONSIGNES CLI-08 ============ -->
  @if (activeTab() === 'consignes') {
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px">
      <div style="font-size:14px;color:#475569">
        Emballages actuellement détenus par les clients : <strong style="color:#0ea5e9;font-size:16px">{{ totalConsignesDetenues() }}</strong> unité(s)
      </div>
      <button class="btn btn-primary" (click)="openConsigneModal()">+ Dépôt / Retour emballage</button>
    </div>

    <div class="grid-2" style="margin-bottom:16px">
      <div class="gw-card">
        <div class="card-header"><div class="card-title">👥 Emballages détenus par client</div></div>
        <div class="card-body" style="padding:0">
          <table class="gw-table">
            <thead><tr><th>Client</th><th>Téléphone</th><th style="text-align:right">Détenus</th></tr></thead>
            <tbody>
              @for (c of clientsAvecConsignes(); track c.id) {
                <tr>
                  <td><strong>{{ c.nom }}</strong></td>
                  <td style="font-size:12px;color:#64748b">{{ c.telephone }}</td>
                  <td style="text-align:right"><span class="badge badge-info">{{ c.consignesDetenues }}</span></td>
                </tr>
              }
              @if (clientsAvecConsignes().length === 0) {
                <tr><td colspan="3" style="text-align:center;color:#94a3b8;padding:24px">Aucun emballage consigné détenu</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <div class="gw-card">
        <div class="card-header"><div class="card-title">🔄 Historique dépôts / retours</div></div>
        <div class="card-body" style="padding:0">
          <table class="gw-table">
            <thead><tr><th>Date</th><th>Client</th><th>Type</th><th>Emballage</th><th>Qté</th></tr></thead>
            <tbody>
              @for (m of consignes(); track m.id) {
                <tr>
                  <td style="font-size:12px;color:#64748b">{{ m.createdAt | date:'dd/MM/yyyy' }}</td>
                  <td><strong>{{ m.clientNom }}</strong></td>
                  <td><span class="badge" [class]="m.type === 'depot' ? 'badge-warning' : 'badge-success'">{{ m.type === 'depot' ? '↑ Dépôt' : '↓ Retour' }}</span></td>
                  <td style="font-size:12px">{{ m.typeEmballage }}</td>
                  <td><strong>{{ m.type === 'depot' ? '+' : '-' }}{{ m.quantite }}</strong></td>
                </tr>
              }
              @if (consignes().length === 0) {
                <tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:24px">Aucun mouvement de consigne</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  }
</div>

<!-- ============ MODAL CONSIGNE CLI-08 ============ -->
@if (showConsigneModal()) {
  <div class="gw-modal-backdrop" (click)="showConsigneModal.set(false)">
    <div class="gw-modal modal-md" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title">📦 Mouvement d'emballage consigné</div>
        <button class="modal-close" (click)="showConsigneModal.set(false)">✕</button>
      </div>
      <form [formGroup]="consigneForm" (ngSubmit)="saveConsigne()">
        <div class="modal-body">
          <div class="form-group" style="margin-bottom:12px">
            <label>Client *</label>
            <select class="form-control" formControlName="clientId">
              <option value="">Sélectionner un client</option>
              @for (c of clients(); track c.id) {
                <option [value]="c.id">{{ c.nom }} ({{ c.code }}) — détenus: {{ c.consignesDetenues || 0 }}</option>
              }
            </select>
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label>Type de mouvement *</label>
              <select class="form-control" formControlName="type">
                <option value="depot">Dépôt (remis au client)</option>
                <option value="retour">Retour (rendu par le client)</option>
              </select>
            </div>
            <div class="form-group">
              <label>Emballage *</label>
              <select class="form-control" formControlName="typeEmballage">
                <option value="casier">Casier</option>
                <option value="palette">Palette</option>
                <option value="bonbonne">Bonbonne</option>
              </select>
            </div>
          </div>
          <div class="grid-2" style="margin-top:12px">
            <div class="form-group">
              <label>Quantité *</label>
              <input type="number" class="form-control" formControlName="quantite" min="1">
            </div>
            <div class="form-group">
              <label>Motif / Note</label>
              <input class="form-control" formControlName="motif" placeholder="Optionnel">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" (click)="showConsigneModal.set(false)">Annuler</button>
          <button type="submit" class="btn btn-primary" [disabled]="saving() || consigneForm.invalid">
            {{ saving() ? 'Enregistrement...' : 'Valider' }}
          </button>
        </div>
      </form>
    </div>
  </div>
}

<!-- ============ MODAL CRÉER/MODIFIER CLIENT ============ -->
@if (showModal()) {
  <div class="gw-modal-backdrop" (click)="closeModal()">
    <div class="gw-modal modal-lg" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <div><div class="modal-title">{{ editingClient ? 'Modifier le client' : 'Nouveau client' }}</div></div>
        <button class="modal-close" (click)="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="grid-2">
          <div class="form-group">
            <label>Nom / Raison sociale *</label>
            <input class="form-control" [(ngModel)]="form.nom" placeholder="Prénom Nom ou Raison sociale">
          </div>
          <div class="form-group">
            <label>Type de client *</label>
            <select class="form-control" [(ngModel)]="form.type">
              <option value="particulier">Particulier</option>
              <option value="boutique">Boutique / Revendeur</option>
              <option value="restaurant">Restaurant / Hôtel</option>
              <option value="entreprise">Entreprise / SARL</option>
              <option value="institution">Institution</option>
            </select>
          </div>
          <div class="form-group">
            <label>Téléphone principal *</label>
            <input class="form-control" [(ngModel)]="form.telephone" placeholder="+224 XXX XXX XXX">
          </div>
          <div class="form-group">
            <label>WhatsApp</label>
            <input class="form-control" [(ngModel)]="form.whatsapp" placeholder="+224 XXX XXX XXX">
          </div>
          <div class="form-group">
            <label>Quartier *</label>
            <input class="form-control" [(ngModel)]="form.quartier" placeholder="Nom du quartier">
          </div>
          <div class="form-group">
            <label>Adresse</label>
            <input class="form-control" [(ngModel)]="form.adresse" placeholder="Adresse complète">
          </div>
          <div class="form-group">
            <label>Grille tarifaire *</label>
            <select class="form-control" [(ngModel)]="form.grilleTarifaire">
              <option value="detail">Prix détail</option>
              <option value="gros">Prix gros</option>
              <option value="revendeur">Prix revendeur</option>
            </select>
          </div>
          <div class="form-group">
            <label>Mode de paiement habituel</label>
            <select class="form-control" [(ngModel)]="form.modePaiement">
              <option value="especes">Espèces</option>
              <option value="orange_money">Orange Money</option>
              <option value="wave">Wave</option>
              <option value="moov_money">Moov Money</option>
              <option value="virement">Virement bancaire</option>
              <option value="credit">Crédit</option>
            </select>
          </div>
          <div class="form-group">
            <label>Plafond de crédit (FCFA) @if (!authService.hasRole('admin', 'superadmin')) { <span style="font-size:11px;color:#94a3b8">(Admin)</span> }</label>
            <input type="number" class="form-control" [(ngModel)]="form.plafondCredit" [disabled]="!authService.hasRole('admin', 'superadmin')" placeholder="0">
          </div>
          <div class="form-group">
            <label>Délai de paiement (jours)</label>
            <input type="number" class="form-control" [(ngModel)]="form.delaiPaiement" placeholder="30">
          </div>
        </div>
        <div class="form-group" style="margin-top:12px">
          <label>Notes</label>
          <textarea class="form-control" [(ngModel)]="form.notes" rows="2" placeholder="Informations complémentaires..."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" (click)="closeModal()">Annuler</button>
        <button class="btn btn-primary" (click)="saveClient()" [disabled]="saving()">
          @if (saving()) { <span class="loading-spinner" style="width:16px;height:16px;border-width:2px;margin:0"></span> }
          @else { {{ editingClient ? 'Enregistrer' : 'Créer le client' }} }
        </button>
      </div>
    </div>
  </div>
}

<!-- ============ MODAL DÉTAIL CLIENT CLI-05 ============ -->
@if (viewingClient()) {
  <div class="gw-modal-backdrop" (click)="viewingClient.set(null)">
    <div class="gw-modal modal-lg" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <div style="display:flex;align-items:center;gap:12px">
          <div [style.background]="avatarColor(viewingClient()!.nom)"
               style="width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:18px">
            {{ viewingClient()!.nom[0].toUpperCase() }}
          </div>
          <div>
            <div class="modal-title">{{ viewingClient()!.nom }}</div>
            <div style="font-size:12px;color:#94a3b8">{{ viewingClient()!.code }} · {{ typeLabels[viewingClient()!.type] }}</div>
          </div>
        </div>
        <button class="modal-close" (click)="viewingClient.set(null)">✕</button>
      </div>
      <div class="modal-body">
        <!-- Infos de base -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
          <div><div style="font-size:11px;color:#94a3b8">Téléphone</div><div style="font-weight:500">{{ viewingClient()!.telephone }}</div></div>
          <div><div style="font-size:11px;color:#94a3b8">Quartier</div><div style="font-weight:500">{{ viewingClient()!.quartier }}</div></div>
          <div><div style="font-size:11px;color:#94a3b8">Grille</div><div><span class="badge badge-info">{{ grilleLabels[viewingClient()!.grilleTarifaire] }}</span></div></div>
          <div><div style="font-size:11px;color:#94a3b8">Statut</div><div><span [class]="'badge ' + statutBadge(viewingClient()!.statut)">{{ viewingClient()!.statut }}</span></div></div>
          <div><div style="font-size:11px;color:#94a3b8">Mode paiement</div><div style="font-weight:500">{{ viewingClient()!.modePaiement }}</div></div>
          <div><div style="font-size:11px;color:#94a3b8">Délai paiement</div><div style="font-weight:500">{{ viewingClient()!.delaiPaiement }} jours</div></div>
        </div>

        <!-- Résumé financier CLI-05 -->
        <div style="background:#f8fafc;border-radius:12px;padding:16px;margin-bottom:20px">
          <div style="font-size:11px;font-weight:600;color:#64748b;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px">Résumé financier</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
            <div style="text-align:center;padding:12px;background:white;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.06)">
              <div style="font-size:10px;color:#94a3b8;margin-bottom:4px">Solde actuel</div>
              <div [style.color]="viewingClient()!.solde > 0 ? '#ef4444' : '#22c55e'" style="font-weight:700;font-size:16px">
                {{ viewingClient()!.solde | number:'1.0-0' }} F
              </div>
            </div>
            <div style="text-align:center;padding:12px;background:white;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.06)">
              <div style="font-size:10px;color:#94a3b8;margin-bottom:4px">Plafond crédit</div>
              <div style="font-weight:700;font-size:15px;color:#0ea5e9">{{ viewingClient()!.plafondCredit | number:'1.0-0' }} F</div>
              @if (viewingClient()!.plafondCredit > 0) {
                <div style="margin-top:6px;height:4px;background:#f1f5f9;border-radius:2px;overflow:hidden">
                  <div [style.width.%]="creditPct(viewingClient()!)"
                       [style.background]="viewingClient()!.solde > viewingClient()!.plafondCredit ? '#ef4444' : '#22c55e'"
                       style="height:100%;border-radius:2px"></div>
                </div>
                @if (viewingClient()!.solde > viewingClient()!.plafondCredit) {
                  <div style="font-size:10px;color:#ef4444;margin-top:4px;font-weight:700">⚠️ DÉPASSÉ</div>
                }
              }
            </div>
            <div style="text-align:center;padding:12px;background:white;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.06)">
              <div style="font-size:10px;color:#94a3b8;margin-bottom:4px">Dernière commande</div>
              <div style="font-weight:600;font-size:13px">
                {{ viewingClient()!.derniereCommande ? (viewingClient()!.derniereCommande | date:'dd/MM/yyyy') : '—' }}
              </div>
            </div>
            <div style="text-align:center;padding:12px;background:white;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.06)">
              <div style="font-size:10px;color:#94a3b8;margin-bottom:4px">Total achats</div>
              <div style="font-weight:700;font-size:13px">{{ viewingClient()!.totalAchats | number:'1.0-0' }} F</div>
            </div>
          </div>
        </div>

        <!-- 5 dernières factures -->
        <div style="margin-bottom:16px">
          <div style="font-size:11px;font-weight:600;color:#64748b;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px">5 Dernières factures</div>
          <table class="gw-table" style="font-size:12px">
            <thead>
              <tr><th>N° Facture</th><th>Date</th><th>Montant</th><th>Statut paiement</th></tr>
            </thead>
            <tbody>
              @for (f of viewingClient()!.factures; track f.numero) {
                <tr>
                  <td style="font-family:monospace;color:#0ea5e9;font-weight:500">{{ f.numero }}</td>
                  <td>{{ f.date | date:'dd/MM/yyyy' }}</td>
                  <td style="font-weight:600">{{ f.montant | number:'1.0-0' }} FCFA</td>
                  <td><span [class]="'badge ' + factureBadge(f.statut)">
                    {{ f.statut === 'payee' ? '✓ Payée' : f.statut === 'partiel' ? '◑ Partiel' : '✗ Impayée' }}
                  </span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (clientRelances().length > 0) {
          <div style="margin-bottom:16px">
            <div style="font-size:11px;font-weight:600;color:#64748b;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px">
              Dernières relances WhatsApp
            </div>
            <table class="gw-table" style="font-size:12px">
              <thead>
                <tr><th>Date</th><th>Niveau</th><th>Montant</th><th>Statut</th><th>Réponse</th></tr>
              </thead>
              <tbody>
                @for (r of clientRelances(); track r.id) {
                  <tr>
                    <td>{{ r.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
                    <td>{{ niveauLabels[r.niveau] || r.niveau }}</td>
                    <td>{{ r.montant | number:'1.0-0' }} F</td>
                    <td><span [class]="'badge ' + (statutRelanceBadges[r.statut] || 'badge-secondary')">
                      {{ statutRelanceLabels[r.statut] || r.statut }}
                    </span></td>
                    <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" [title]="r.reponse || r.erreur || ''">
                      {{ r.reponse || r.erreur || '—' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        @if (viewingClient()!.notes) {
          <div style="padding:12px;background:#f8fafc;border-radius:8px">
            <div style="font-size:11px;color:#94a3b8;margin-bottom:4px">Notes</div>
            <div style="font-size:13px">{{ viewingClient()!.notes }}</div>
          </div>
        }
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" (click)="closeDetailModal()">Fermer</button>
        @if (viewingClient()!.solde > 0 && !viewingClient()!.whatsappOptOut) {
          <button class="btn btn-secondary" (click)="relancerClient(viewingClient()!)" [disabled]="relancingId() === viewingClient()!.id"
                  style="background:#22c55e;color:white;border-color:#22c55e">
            {{ relancingId() === viewingClient()!.id ? 'Envoi…' : '📱 Relance WhatsApp' }}
          </button>
        }
        @if (waActif() && viewingClient()!.id && !viewingClient()!.whatsappOptOut) {
          <button class="btn btn-secondary" (click)="envoyerRelevePdf(viewingClient()!)" [disabled]="sendingReleve()">
            {{ sendingReleve() ? 'Envoi PDF…' : '📄 Relevé WhatsApp (PDF)' }}
          </button>
        }
        <button class="btn btn-secondary" (click)="printReleve(viewingClient()!)">🖨️ Voir relevé</button>
        <button class="btn btn-primary" (click)="openModal(viewingClient()!); closeDetailModal()">Modifier</button>
      </div>
    </div>
  </div>
}

<!-- ============ MODAL CSV IMPORT CLI-09 ============ -->
@if (showCsvModal()) {
  <div class="gw-modal-backdrop" (click)="showCsvModal.set(false)">
    <div class="gw-modal modal-lg" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <div>
          <div class="modal-title">Importer des clients (CSV)</div>
          <div style="font-size:12px;color:#94a3b8">{{ csvPreview().length }} ligne(s) détectée(s)</div>
        </div>
        <button class="modal-close" (click)="showCsvModal.set(false)">✕</button>
      </div>
      <div class="modal-body">
        <div class="gw-alert alert-info" style="margin-bottom:16px">
          <span class="alert-icon">ℹ️</span>
          <div class="alert-content">Format attendu (1ère ligne = entête) : <strong>nom,type,telephone,quartier,grilleTarifaire</strong></div>
        </div>
        <div style="max-height:300px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px">
          <table class="gw-table" style="font-size:12px">
            <thead>
              <tr><th>#</th><th>Nom</th><th>Type</th><th>Téléphone</th><th>Quartier</th><th>Grille</th><th>Statut</th></tr>
            </thead>
            <tbody>
              @for (row of csvPreview(); track $index; let idx = $index) {
                <tr [style.background]="row.valid ? 'transparent' : '#fef2f2'">
                  <td style="color:#94a3b8">{{ idx + 1 }}</td>
                  <td>{{ row.nom }}</td>
                  <td>{{ row.type }}</td>
                  <td>{{ row.telephone }}</td>
                  <td>{{ row.quartier }}</td>
                  <td>{{ row.grilleTarifaire }}</td>
                  <td>
                    @if (row.valid) { <span class="badge badge-success">✓ OK</span> }
                    @else { <span class="badge badge-danger">✗ {{ row.error }}</span> }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div style="margin-top:12px;font-size:12px;color:#64748b;display:flex;gap:16px">
          <span style="color:#22c55e">✓ {{ csvValidCount() }} lignes valides</span>
          @if (csvErrorCount() > 0) { <span style="color:#ef4444">✗ {{ csvErrorCount() }} erreurs (ignorées)</span> }
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" (click)="showCsvModal.set(false)">Annuler</button>
        <button class="btn btn-primary" (click)="confirmCsvImport()" [disabled]="csvValidCount() === 0 || saving()">
          @if (saving()) { <span class="loading-spinner" style="width:16px;height:16px;border-width:2px;margin:0"></span> }
          @else { Confirmer l'import ({{ csvValidCount() }} clients) }
        </button>
      </div>
    </div>
  </div>
}
  `
})
export class ClientsComponent implements OnInit {
  @ViewChild('csvFileInput') csvFileInput!: ElementRef<HTMLInputElement>;

  dataService = inject(DataService);
  toastService = inject(ToastService);
  authService = inject(AuthService);
  waService = inject(WhatsappService);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  clients = signal<ClientExt[]>([]);
  filteredClients = signal<ClientExt[]>([]);
  pagedClients = signal<ClientExt[]>([]);
  impayesList = signal<ClientExt[]>([]);
  consignes = signal<ConsigneMouvement[]>([]);
  loading = signal(true);
  saving = signal(false);
  showModal = signal(false);
  showConsigneModal = signal(false);
  viewingClient = signal<ClientExt | null>(null);
  relancingId = signal<string | null>(null);
  relancingBulk = signal(false);
  sendingReleve = signal(false);
  clientRelances = signal<Relance[]>([]);
  waActif = signal(false);
  private relancesSub?: Subscription;
  readonly statutRelanceLabels = STATUT_RELANCE_LABELS;
  readonly statutRelanceBadges = STATUT_RELANCE_BADGES;
  readonly niveauLabels = NIVEAU_LABELS;
  showCsvModal = signal(false);
  csvPreview = signal<CsvRow[]>([]);
  activeTab = signal<'clients' | 'impayes' | 'consignes'>('clients');
  editingClient: ClientExt | null = null;

  consigneForm = this.fb.group({
    clientId: ['', [Validators.required]],
    type: ['depot' as 'depot' | 'retour', [Validators.required]],
    typeEmballage: ['casier' as 'casier' | 'palette' | 'bonbonne', [Validators.required]],
    quantite: [1, [Validators.required, Validators.min(1)]],
    motif: [''],
  });

  search = '';
  filterType = '';
  filterStatut = '';
  filterSegment = '';
  sortField = 'nom';
  sortDir = 1;
  page = 1;
  pageSize = 10;
  pageStart = 0;
  pageEnd = 0;

  form: Partial<Client> = this.defaultForm();

  typeLabels: Record<string, string> = {
    particulier: 'Particulier', boutique: 'Boutique', restaurant: 'Restaurant',
    entreprise: 'Entreprise', institution: 'Institution'
  };
  grilleLabels: Record<string, string> = { detail: 'Détail', gros: 'Gros', revendeur: 'Revendeur' };

  stats = [
    { label: 'Total clients', value: '0', icon: '👥', bg: '#e0f2fe' },
    { label: 'Clients actifs', value: '0', icon: '✅', bg: '#f0fdf4' },
    { label: 'Avec crédit en cours', value: '0', icon: '⏳', bg: '#fffbeb' },
    { label: 'Créances totales', value: '0 FCFA', icon: '💰', bg: '#fef2f2' },
  ];

  private rawClients: Client[] = [];
  private rawVentes: Vente[] = [];
  private appSettings: AppSettings | null = null;

  defaultForm(): Partial<Client> {
    return {
      nom: '', type: 'particulier', telephone: '', whatsapp: '',
      adresse: '', quartier: '', grilleTarifaire: 'detail',
      modePaiement: 'especes', plafondCredit: 0, delaiPaiement: 30,
      solde: 0, statut: 'actif', notes: ''
    };
  }

  ngOnInit() {
    this.loadClients();
    this.dataService.getSettings().then(s => { this.appSettings = s; }).catch(() => {});
    this.waService.getSettings().then(s => { this.waActif.set(s.actif); }).catch(() => {});
    this.dataService.getConsignes().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => { this.consignes.set(data); this.cdr.markForCheck(); });
  }

  totalConsignesDetenues() { return this.clients().reduce((s, c) => s + (c.consignesDetenues || 0), 0); }
  clientsAvecConsignes() { return this.clients().filter(c => (c.consignesDetenues || 0) > 0); }

  openConsigneModal() {
    this.consigneForm.reset({ clientId: '', type: 'depot', typeEmballage: 'casier', quantite: 1, motif: '' });
    this.showConsigneModal.set(true);
  }

  async saveConsigne() {
    if (this.consigneForm.invalid) return;
    const v = this.consigneForm.value;
    const client = this.clients().find(c => c.id === v.clientId);
    if (!client) return;
    this.saving.set(true);
    try {
      await this.dataService.enregistrerConsigne({
        clientId: client.id!,
        clientNom: client.nom,
        type: v.type!,
        typeEmballage: v.typeEmballage!,
        quantite: Number(v.quantite || 1),
        motif: v.motif || '',
        operateur: this.authService.currentUser?.displayName || 'Opérateur',
      });
      this.toastService.success('Mouvement de consigne enregistré.');
      this.showConsigneModal.set(false);
    } catch {
      this.toastService.error('Erreur lors de l\'enregistrement de la consigne.');
    } finally {
      this.saving.set(false);
    }
  }

  private toDate(val: any): Date | null {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (val?.toDate) return val.toDate();
    return new Date(val);
  }

  loadClients() {
    this.loading.set(true);
    this.dataService.getClients().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (data) => {
        this.rawClients = data;
        this.rebuildClients();
        this.loading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.toastService.error('Erreur de chargement des clients');
        this.loading.set(false);
      }
    });

    this.dataService.getVentes().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (ventes) => {
        this.rawVentes = ventes.filter(v => v.statut !== 'annulee');
        this.rebuildClients();
      },
      error: () => { /* ignore */ }
    });
  }

  private rebuildClients() {
    const now = Date.now();
    const enriched: ClientExt[] = this.rawClients.map(c => {
      const ventesClient = this.rawVentes
        .filter(v => v.clientId === c.id)
        .map(v => ({ ...v, createdAt: this.toDate(v.createdAt) || new Date() }))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const totalAchats = ventesClient.reduce((s, v) => s + (v.total || 0), 0);
      const derniereCommande = ventesClient.length > 0 ? ventesClient[0].createdAt : null;

      const impayees = ventesClient.filter(v => (v.soldeRestant || 0) > 0);
      const oldestUnpaid = impayees.length > 0 ? impayees[impayees.length - 1].createdAt : null;
      const joursImpaye = oldestUnpaid ? Math.max(0, Math.floor((now - oldestUnpaid.getTime()) / 86400000)) : 0;

      const factures: FactureDemo[] = ventesClient.slice(0, 5).map(v => ({
        numero: v.numero,
        date: v.createdAt,
        montant: v.total,
        statut: v.paiementStatut === 'paye' ? 'payee' : v.paiementStatut === 'partiel' ? 'partiel' : 'impayee',
      }));

      return {
        ...c,
        solde: c.solde || 0,
        plafondCredit: c.plafondCredit || 0,
        delaiPaiement: c.delaiPaiement || 30,
        totalAchats,
        derniereCommande,
        joursImpaye,
        factures,
      };
    });

    this.clients.set(enriched);
    this.filterClients();
  }

  exportCsv() {
    const rows = this.filteredClients();
    if (!rows.length) { this.toastService.info('Aucun client à exporter.'); return; }
    const header = 'Code;Nom;Type;Telephone;Quartier;Grille;Solde;PlafondCredit;Statut\n';
    const body = rows.map(c =>
      `${c.code};${c.nom};${c.type};${c.telephone};${c.quartier};${c.grilleTarifaire};${c.solde};${c.plafondCredit};${c.statut}`
    ).join('\n');
    const blob = new Blob(['\ufeff' + header + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clients_gwater.csv';
    a.click();
    URL.revokeObjectURL(url);
    this.toastService.success('Export CSV clients téléchargé.');
  }

  filterClients() {
    let result = this.clients();
    if (this.search) {
      const s = this.search.toLowerCase();
      result = result.filter(c =>
        c.nom.toLowerCase().includes(s) || c.telephone.includes(s) ||
        c.quartier.toLowerCase().includes(s) || c.code.toLowerCase().includes(s)
      );
    }
    if (this.filterType) result = result.filter(c => c.type === this.filterType);
    if (this.filterStatut) result = result.filter(c => c.statut === this.filterStatut);
    if (this.filterSegment === 'meilleurs') {
      result = result.filter(c => c.totalAchats > 100000);
    } else if (this.filterSegment === 'inactifs') {
      result = result.filter(c => {
        if (!c.derniereCommande) return true;
        return (Date.now() - c.derniereCommande.getTime()) / 86400000 > 30;
      });
    }
    result = [...result].sort((a: any, b: any) =>
      a[this.sortField] > b[this.sortField] ? this.sortDir : -this.sortDir
    );
    this.filteredClients.set(result);
    this.impayesList.set(
      this.clients().filter(c => c.solde > 0).sort((a, b) => b.joursImpaye - a.joursImpaye)
    );
    // Stats dynamiques
    const all = this.clients();
    this.stats = [
      { label: 'Total clients', value: String(all.length), icon: '👥', bg: '#e0f2fe' },
      { label: 'Clients actifs', value: String(all.filter(c => c.statut === 'actif').length), icon: '✅', bg: '#f0fdf4' },
      { label: 'Avec crédit en cours', value: String(all.filter(c => c.solde > 0).length), icon: '⏳', bg: '#fffbeb' },
      { label: 'Créances totales', value: all.reduce((s, c) => s + c.solde, 0).toLocaleString('fr-FR') + ' FCFA', icon: '💰', bg: '#fef2f2' },
    ];
    this.page = 1;
    this.updatePage();
    this.cdr.markForCheck();
  }

  sort(field: string) {
    if (this.sortField === field) this.sortDir *= -1;
    else { this.sortField = field; this.sortDir = 1; }
    this.filterClients();
  }

  totalPages() { return Math.max(1, Math.ceil(this.filteredClients().length / this.pageSize)); }
  pages() { return Array.from({ length: this.totalPages() }, (_, i) => i + 1); }

  updatePage() {
    this.pageStart = (this.page - 1) * this.pageSize;
    this.pageEnd = Math.min(this.pageStart + this.pageSize, this.filteredClients().length);
    this.pagedClients.set(this.filteredClients().slice(this.pageStart, this.pageEnd));
  }

  avatarColor(name: string) {
    const colors = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#22c55e', '#ef4444', '#ec4899'];
    return colors[name.charCodeAt(0) % colors.length];
  }

  statutBadge(s: string) {
    return ({ actif: 'badge-success', suspendu: 'badge-warning', archive: 'badge-secondary' } as any)[s] || 'badge-secondary';
  }

  factureBadge(s: string) {
    return ({ payee: 'badge-success', partiel: 'badge-warning', impayee: 'badge-danger' } as any)[s] || 'badge-secondary';
  }

  creditPct(client: Client): number {
    if (!client.plafondCredit) return 0;
    return Math.min(100, (client.solde / client.plafondCredit) * 100);
  }

  agingBg(j: number): string {
    return j > 60 ? '#fee2e2' : j > 30 ? '#ffedd5' : '#fefce8';
  }

  agingBadge(j: number): string {
    return j > 60 ? 'badge-danger' : j > 30 ? 'badge-warning' : 'badge-info';
  }

  totalImpayes(): number { return this.impayesList().reduce((s, c) => s + c.solde, 0); }

  async relancerClient(client: ClientExt, forcer = false): Promise<void> {
    if (!client.id) return;
    this.relancingId.set(client.id);
    try {
      const res = await this.waService.relancer(client, { forcer, joursRetard: client.joursImpaye });
      if (res.mode === 'openwa') {
        this.toastService.success(`Relance WhatsApp envoyée à ${client.nom}.`);
      } else {
        this.toastService.info(`WhatsApp Web ouvert pour ${client.nom} (envoi manuel).`);
      }
    } catch (err) {
      if (err instanceof WhatsappApiError && err.code === 'RELANCE_RECENTE') {
        if (confirm(`${err.message}. Voulez-vous tout de même renvoyer une relance ?`)) {
          return this.relancerClient(client, true);
        }
        return;
      }
      this.toastService.error(err instanceof Error ? err.message : 'Erreur lors de la relance WhatsApp.');
    } finally {
      this.relancingId.set(null);
    }
  }

  async envoyerRelevePdf(client: ClientExt) {
    if (!client.id) return;
    this.sendingReleve.set(true);
    try {
      await this.waService.envoyerRelevePdf(client.id);
      this.toastService.success(`Relevé PDF envoyé sur WhatsApp à ${client.nom}.`);
    } catch (err) {
      this.toastService.error(err instanceof Error ? err.message : 'Erreur lors de l\'envoi du relevé PDF.');
    } finally {
      this.sendingReleve.set(false);
    }
  }

  async relancerTousImpayes() {
    const ids = this.impayesList().filter(c => !c.whatsappOptOut && c.id).map(c => c.id!);
    if (!ids.length) return;
    if (!confirm(`Envoyer une relance WhatsApp groupée aux ${ids.length} client(s) éligible(s) ?`)) return;
    this.relancingBulk.set(true);
    try {
      const r = await this.waService.relancerGroupe(ids);
      const parts = [`${r.envoyes} envoyé(s)`];
      if (r.aValider > 0) parts.push(`${r.aValider} mise(s) en demeure à valider`);
      if (r.ignores.length > 0) parts.push(`${r.ignores.length} ignoré(s)`);
      this.toastService.success('Relance groupée : ' + parts.join(', ') + '.');
    } catch (err) {
      this.toastService.error(err instanceof Error ? err.message : 'Erreur lors de la relance groupée.');
    } finally {
      this.relancingBulk.set(false);
    }
  }

  printReleve(client: ClientExt) {
    const dateStr = new Date().toLocaleDateString('fr-FR');
    const facturesHtml = client.factures.map(f => {
      const statLabel = f.statut === 'payee' ? 'Payée' : f.statut === 'partiel' ? 'Partiel' : 'Impayée';
      const statColor = f.statut === 'payee' ? '#22c55e' : f.statut === 'partiel' ? '#f59e0b' : '#ef4444';
      return `<tr><td>${f.numero}</td><td>${new Date(f.date).toLocaleDateString('fr-FR')}</td><td style="font-weight:600;text-align:right">${f.montant.toLocaleString('fr-FR')} FCFA</td><td style="color:${statColor};font-weight:600">${statLabel}</td></tr>`;
    }).join('');
    const nomEnt = this.appSettings?.nomEntreprise || 'GWater Distribution';
    const adresseEnt = this.appSettings?.adresse || 'Conakry, Guinée';
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Relevé – ${client.nom}</title>
<style>*{box-sizing:border-box}body{font-family:-apple-system,Arial,sans-serif;padding:40px;color:#1e293b;max-width:800px;margin:0 auto}
.hdr{display:flex;justify-content:space-between;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #e2e8f0}
.logo{font-size:26px;font-weight:800;color:#0ea5e9}
.ig{display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#f8fafc;padding:16px;border-radius:8px;margin-bottom:20px}
.il{font-size:11px;color:#94a3b8}.iv{font-weight:600}
table{width:100%;border-collapse:collapse}th{background:#f8fafc;padding:10px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;border-bottom:2px solid #e2e8f0}
td{padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px}
.ft{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;display:flex;justify-content:space-between}
@media print{body{padding:20px}}</style></head><body>
<div class="hdr"><div><div class="logo">💧 ${nomEnt}</div><div style="font-size:11px;color:#94a3b8">${adresseEnt}</div></div>
<div style="text-align:right"><div style="font-size:11px;color:#94a3b8">Date d'édition</div><div style="font-weight:700">${dateStr}</div><div style="font-size:11px;color:#94a3b8;margin-top:4px">RELEVÉ DE COMPTE</div></div></div>
<div class="ig">
<div><div class="il">Client</div><div class="iv">${client.nom}</div></div>
<div><div class="il">Code</div><div class="iv">${client.code}</div></div>
<div><div class="il">Téléphone</div><div class="iv">${client.telephone}</div></div>
<div><div class="il">Quartier</div><div class="iv">${client.quartier}</div></div>
<div><div class="il">Grille tarifaire</div><div class="iv">${this.grilleLabels[client.grilleTarifaire]}</div></div>
<div><div class="il">Total achats</div><div class="iv">${client.totalAchats.toLocaleString('fr-FR')} FCFA</div></div></div>
${client.solde > 0
  ? `<div style="background:#fef2f2;border:2px solid #ef4444;border-radius:8px;padding:16px;margin-bottom:24px;text-align:center"><div style="font-size:12px;color:#94a3b8;margin-bottom:4px">SOLDE IMPAYÉ</div><div style="font-size:28px;font-weight:800;color:#ef4444">${client.solde.toLocaleString('fr-FR')} FCFA</div></div>`
  : `<div style="background:#f0fdf4;border:2px solid #22c55e;border-radius:8px;padding:16px;margin-bottom:24px;text-align:center;font-size:18px;font-weight:700;color:#22c55e">✓ Compte soldé</div>`}
<h3 style="font-size:14px;margin-bottom:12px">Historique des factures</h3>
<table><thead><tr><th>N° Facture</th><th>Date</th><th style="text-align:right">Montant</th><th>Statut</th></tr></thead><tbody>${facturesHtml}</tbody></table>
<div class="ft"><div>${nomEnt} · ${adresseEnt}</div><div>Généré le ${new Date().toLocaleString('fr-FR')}</div></div>
</body></html>`;
    const w = window.open('', '_blank', 'width=900,height=700');
    if (w) { w.document.write(html); w.document.close(); w.onload = () => w.print(); }
  }

  setSegment(seg: string) {
    this.filterSegment = this.filterSegment === seg ? '' : seg;
    this.filterClients();
  }

  bestClientsCount(): number { return this.clients().filter(c => c.totalAchats > 100000).length; }

  inactiveClientsCount(): number {
    return this.clients().filter(c => {
      if (!c.derniereCommande) return true;
      return (Date.now() - c.derniereCommande.getTime()) / 86400000 > 30;
    }).length;
  }

  triggerCsvImport() { this.csvFileInput?.nativeElement?.click(); }

  onCsvFile(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const reader = new FileReader();
    reader.onload = (e) => this.parseCsv((e.target?.result as string) || '');
    reader.readAsText(input.files[0], 'UTF-8');
    input.value = '';
  }

  parseCsv(text: string) {
    const validTypes = ['particulier', 'boutique', 'restaurant', 'entreprise', 'institution'];
    const validGrilles = ['detail', 'gros', 'revendeur'];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const rows: CsvRow[] = lines.slice(1).map(line => {
      const p = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
      const [nom = '', type = '', telephone = '', quartier = '', grilleTarifaire = ''] = p;
      let valid = true; let error = '';
      if (!nom) { valid = false; error = 'Nom manquant'; }
      else if (!validTypes.includes(type.toLowerCase())) { valid = false; error = 'Type invalide'; }
      else if (!telephone) { valid = false; error = 'Tél. manquant'; }
      else if (!quartier) { valid = false; error = 'Quartier manquant'; }
      else if (!validGrilles.includes(grilleTarifaire.toLowerCase())) { valid = false; error = 'Grille invalide'; }
      return { nom, type: type.toLowerCase(), telephone, quartier, grilleTarifaire: grilleTarifaire.toLowerCase(), valid, error };
    });
    this.csvPreview.set(rows);
    this.showCsvModal.set(true);
  }

  csvValidCount(): number { return this.csvPreview().filter(r => r.valid).length; }
  csvErrorCount(): number { return this.csvPreview().filter(r => !r.valid).length; }

  async confirmCsvImport() {
    const validRows = this.csvPreview().filter(r => r.valid);
    if (!validRows.length) return;
    this.saving.set(true);
    const baseLen = this.clients().length;
    const results = await Promise.allSettled(
      validRows.map((row, idx) => {
        const code = `CLI-${String(baseLen + idx + 1).padStart(4, '0')}`;
        return this.dataService.addClient({
          code, nom: row.nom, type: row.type as Client['type'],
          telephone: row.telephone, quartier: row.quartier,
          grilleTarifaire: row.grilleTarifaire as Client['grilleTarifaire'],
          adresse: '', modePaiement: 'especes', plafondCredit: 0, delaiPaiement: 30, solde: 0, statut: 'actif'
        });
      })
    );
    const count = results.filter(r => r.status === 'fulfilled').length;
    this.saving.set(false);
    this.toastService.success(`${count} client(s) importé(s) avec succès !`);
    this.showCsvModal.set(false);
  }

  openModal(client?: ClientExt) {
    this.editingClient = client || null;
    this.form = client ? { ...client } : this.defaultForm();
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingClient = null;
    this.form = this.defaultForm();
  }

  async saveClient() {
    if (!this.form.nom || !this.form.telephone) {
      this.toastService.error('Nom et téléphone sont obligatoires.');
      return;
    }
    const normPhone = this.form.telephone.replace(/\D/g, '');
    const duplicate = this.clients().find(
      c => c.id !== this.editingClient?.id && c.telephone.replace(/\D/g, '') === normPhone
    );
    if (duplicate) {
      this.toastService.error(`Doublon détecté : le téléphone est déjà utilisé par "${duplicate.nom}" (${duplicate.code}).`);
      return;
    }
    this.saving.set(true);
    try {
      if (this.editingClient?.id) {
        const { totalAchats, derniereCommande, joursImpaye, factures, id, ...cleanPayload } = this.form as any;
        // Respect strict de firestore.rules : un vendeur ne peut modifier ni plafondCredit ni statut
        if (!this.authService.hasRole('admin', 'superadmin')) {
          delete cleanPayload.plafondCredit;
          delete cleanPayload.statut;
        }
        await this.dataService.updateClient(this.editingClient.id, cleanPayload);
        this.toastService.success('Client mis à jour avec succès !');
      } else {
        const code = await this.dataService.getNextClientCode();
        const payload: any = {
          ...this.form as Client,
          code,
          createdBy: this.authService.currentUser?.uid || ''
        };
        if (!this.authService.hasRole('admin', 'superadmin')) {
          payload.plafondCredit = 0;
        }
        await this.dataService.addClient(payload);
        this.toastService.success('Client créé avec succès !');
      }
      this.closeModal();
    } catch {
      this.toastService.error('Erreur lors de la sauvegarde. Vérifiez votre connexion.');
    } finally {
      this.saving.set(false);
    }
  }

  viewClient(client: ClientExt) {
    this.viewingClient.set(client);
    this.relancesSub?.unsubscribe();
    this.clientRelances.set([]);
    if (client.id) {
      this.relancesSub = this.waService.watchRelancesClient(client.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: list => { this.clientRelances.set(list); this.cdr.markForCheck(); }, error: () => {} });
    }
  }

  closeDetailModal() {
    this.relancesSub?.unsubscribe();
    this.viewingClient.set(null);
  }

  async archiveClient(client: ClientExt) {
    if (!client.id) return;
    if (!this.authService.hasRole('admin', 'superadmin')) {
      this.toastService.error('Seuls les administrateurs peuvent archiver un client.');
      return;
    }
    if (!confirm(`Archiver le client "${client.nom}" ?`)) return;
    try {
      await this.dataService.updateClient(client.id, { statut: 'archive' });
      this.toastService.success('Client archivé.');
    } catch {
      this.toastService.error('Erreur lors de l\'archivage.');
    }
  }
}

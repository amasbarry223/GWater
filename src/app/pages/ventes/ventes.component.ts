import { Component, ChangeDetectorRef, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../core/data.service';
import { ToastService } from '../../core/toast.service';
import { AuthService } from '../../core/auth.service';
import { PrintService } from '../../core/print.service';
import { WhatsappService, waErrorMessage } from '../../core/whatsapp.service';
import { Vente, LigneVente, Produit, Client, Paiement, Livreur, Livraison, AppSettings } from '../../core/models';

interface LigneForm {
  produitId: string;
  produitNom: string;
  quantite: number;
  prixUnitaire: number;
  remisePct: number;
  remiseMontant: number;
  total: number;
}

interface PaiementDisplay {
  venteNumero: string;
  clientNom: string;
  montant: number;
  moyen: string;
  reference?: string;
  createdAt: Date;
  operateur: string;
}

@Component({
  selector: 'app-ventes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div>
  <div class="page-header">
    <div>
      <div class="page-title">Ventes &amp; Factures</div>
      <div class="page-subtitle">{{ ventes().length }} vente(s) &bull; Suivi des commandes et encaissements</div>
    </div>
    <div class="page-actions">
      <button class="btn btn-secondary btn-sm" (click)="exportVentesPdf()">&#x1F4C4; Exporter PDF</button>
      <button class="btn btn-primary" (click)="openNewVente()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Nouvelle vente
      </button>
    </div>
  </div>

  <!-- KPIs -->
  <div class="grid-kpi" style="margin-bottom:24px">
    @for (s of stats; track s.label) {
      <div class="kpi-card">
        <div class="kpi-top">
          <div class="kpi-icon" [style.background]="s.bg">{{ s.icon }}</div>
        </div>
        <div class="kpi-value">{{ s.value }}</div>
        <div class="kpi-label">{{ s.label }}</div>
      </div>
    }
  </div>

  <!-- Tabs -->
  <div style="display:flex;gap:0;margin-bottom:20px;border-bottom:2px solid #e2e8f0">
    <button (click)="activeTab.set('ventes')"
      style="background:none;border:none;border-bottom:2px solid transparent;padding:10px 22px;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:-2px"
      [style.border-bottom-color]="activeTab()==='ventes' ? '#0ea5e9' : 'transparent'"
      [style.color]="activeTab()==='ventes' ? '#0ea5e9' : '#64748b'">
      &#x1F4CB; Ventes ({{ ventes().length }})
    </button>
    <button (click)="activeTab.set('livraisons')"
      style="background:none;border:none;border-bottom:2px solid transparent;padding:10px 22px;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:-2px"
      [style.border-bottom-color]="activeTab()==='livraisons' ? '#0ea5e9' : 'transparent'"
      [style.color]="activeTab()==='livraisons' ? '#0ea5e9' : '#64748b'">
      &#x1F69A; Livraisons ({{ livraisons().length }})
    </button>
    <button (click)="activeTab.set('encaissements')"
      style="background:none;border:none;border-bottom:2px solid transparent;padding:10px 22px;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:-2px"
      [style.border-bottom-color]="activeTab()==='encaissements' ? '#0ea5e9' : 'transparent'"
      [style.color]="activeTab()==='encaissements' ? '#0ea5e9' : '#64748b'">
      &#x1F4B0; Encaissements ({{ paiementsDisplay().length }})
    </button>
  </div>

  <!-- TAB VENTES -->
  @if (activeTab() === 'ventes') {
    <div class="gw-table-wrapper">
      <div class="gw-table-toolbar">
        <div class="toolbar-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#94a3b8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Rechercher par N&deg;, client..." [(ngModel)]="search" (input)="filterVentes()">
        </div>
        <select class="form-control" style="width:150px;height:34px" [(ngModel)]="filterStatut" (change)="filterVentes()">
          <option value="">Tous les statuts</option>
          <option value="en_attente">En attente</option>
          <option value="validee">Valid&#xe9;e</option>
          <option value="livree">Livr&#xe9;e</option>
          <option value="payee">Pay&#xe9;e</option>
          <option value="annulee">Annul&#xe9;e</option>
        </select>
        <select class="form-control" style="width:140px;height:34px" [(ngModel)]="filterPeriode" (change)="filterVentes()">
          <option value="all">Toutes p&#xe9;riodes</option>
          <option value="today">Aujourd&#x27;hui</option>
          <option value="week">Cette semaine</option>
          <option value="month">Ce mois</option>
        </select>
        <div class="toolbar-spacer"></div>
        <span style="font-size:12px;color:#94a3b8">{{ filteredVentes().length }} r&#xe9;sultat(s)</span>
      </div>
      <table class="gw-table">
        <thead>
          <tr>
            <th>N&#xb0; Facture</th><th>Date</th><th>Client</th><th>Vendeur</th>
            <th>Type</th><th>Total</th><th>Pay&#xe9;</th><th>Reste</th><th>Statut</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          @for (v of filteredVentes(); track v.id) {
            <tr>
              <td><span style="font-family:monospace;font-size:12px;color:#0ea5e9;font-weight:600">{{ v.numero }}</span></td>
              <td style="font-size:12px;color:#64748b">{{ v.createdAt | date:'dd/MM/yyyy' }}</td>
              <td><strong>{{ v.clientNom }}</strong></td>
              <td style="font-size:12px">{{ v.vendeurNom }}</td>
              <td><span class="badge badge-secondary">{{ typeLabels[v.typeVente] }}</span></td>
              <td><strong>{{ v.total | number:'1.0-0' }} FCFA</strong></td>
              <td style="color:#22c55e;font-weight:500">{{ v.montantPaye | number:'1.0-0' }} FCFA</td>
              <td [style.color]="v.soldeRestant > 0 ? '#ef4444' : '#22c55e'" style="font-weight:500">
                {{ v.soldeRestant > 0 ? (v.soldeRestant | number:'1.0-0') + ' FCFA' : '&#x2713;' }}
              </td>
              <td>
                <span [class]="'badge ' + statutBadge(v.statut)">
                  <span class="badge-dot"></span>{{ statutLabels[v.statut] }}
                </span>
              </td>
              <td>
                <div class="td-actions">
                  <button class="btn btn-ghost btn-sm btn-icon" title="Facture A4" (click)="printFacture(v)" style="color:#0ea5e9">&#x1F5A8;&#xFE0F;</button>
                  <button class="btn btn-ghost btn-sm btn-icon" title="Ticket 80mm" (click)="printRecu(v)">&#x1F9FE;</button>
                  <button class="btn btn-ghost btn-sm btn-icon" title="Partager WhatsApp" (click)="partagerWhatsApp(v)" style="color:#22c55e">&#x1F4F1;</button>
                  @if (v.statut !== 'annulee' && v.paiementStatut !== 'paye') {
                    <button class="btn btn-ghost btn-sm btn-icon" title="Encaisser" (click)="openPaiement(v)" style="color:#22c55e">&#x1F4B0;</button>
                  }
                  @if (v.statut === 'validee') {
                    <button class="btn btn-ghost btn-sm btn-icon" title="Annuler" (click)="openAnnulation(v)" style="color:#ef4444">&#x1F6AB;</button>
                  }
                </div>
              </td>
            </tr>
          }
          @if (filteredVentes().length === 0) {
            <tr>
              <td colspan="10" style="text-align:center;padding:32px;color:var(--gw-muted)">
                Aucune vente enregistrée pour le moment.
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  }

  <!-- TAB LIVRAISONS -->
  @if (activeTab() === 'livraisons') {
    <div class="gw-table-wrapper">
      <div class="gw-table-toolbar">
        <div style="font-size:14px;font-weight:600;color:#1e293b">Suivi des livraisons</div>
        <div class="toolbar-spacer"></div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <span style="background:#fef3c7;color:#92400e;padding:4px 10px;border-radius:12px;font-size:12px">&#x1F4E6; &#xC0; livrer : {{ countStatutLiv('a_livrer') }}</span>
          <span style="background:#dbeafe;color:#1e40af;padding:4px 10px;border-radius:12px;font-size:12px">&#x1F69A; En cours : {{ countStatutLiv('en_cours') }}</span>
          <span style="background:#dcfce7;color:#166534;padding:4px 10px;border-radius:12px;font-size:12px">&#x2705; Livr&#xe9;es : {{ countStatutLiv('livree') }}</span>
          <span style="background:#fee2e2;color:#991b1b;padding:4px 10px;border-radius:12px;font-size:12px">&#x274C; &#xC9;checs : {{ countStatutLiv('echec') }}</span>
        </div>
      </div>
      <table class="gw-table">
        <thead>
          <tr>
            <th>N&#xb0; Vente</th><th>Client</th><th>Adresse</th>
            <th>Livreur affect&#xe9;</th><th>Date pr&#xe9;vue</th><th>Statut</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          @for (l of livraisons(); track l.id) {
            <tr>
              <td><span style="font-family:monospace;font-size:12px;color:#0ea5e9;font-weight:600">{{ l.venteNumero }}</span></td>
              <td><strong>{{ l.clientNom }}</strong></td>
              <td style="font-size:12px;color:#64748b;max-width:180px">{{ l.adresse || '&mdash;' }}</td>
              <td style="font-size:13px">
                @if (l.livreur) { {{ l.livreur }} }
                @else { <span style="color:#94a3b8;font-style:italic">Non affect&#xe9;</span> }
              </td>
              <td style="font-size:12px;color:#64748b">{{ l.datePrevue || '&mdash;' }}</td>
              <td><span [class]="'badge ' + statutLivBadge(l.statut)">{{ statutLivLabels[l.statut] }}</span></td>
              <td>
                <div class="td-actions">
                  @if (l.statut !== 'livree' && l.statut !== 'echec') {
                    <button class="btn btn-ghost btn-sm" style="font-size:11px" (click)="openAffecterLivreur(l)">&#x1F464; Affecter</button>
                    <button class="btn btn-ghost btn-sm" style="font-size:11px;color:#22c55e" (click)="marquerLivree(l)">&#x2705; Livr&#xe9;e</button>
                    <button class="btn btn-ghost btn-sm" style="font-size:11px;color:#ef4444" (click)="openEchecLivraison(l)">&#x274C; &#xC9;chec</button>
                  }
                  @if (l.statut === 'echec' && l.motifEchec) {
                    <span style="font-size:11px;color:#ef4444" [title]="l.motifEchec || ''">&#x26A0;&#xFE0F; {{ (l.motifEchec || '').substring(0,25) }}&#x2026;</span>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  }

  <!-- TAB ENCAISSEMENTS -->
  @if (activeTab() === 'encaissements') {
    <div class="gw-table-wrapper">
      <div class="gw-table-toolbar">
        <div style="font-size:14px;font-weight:600;color:#1e293b">Tous les encaissements re&#xe7;us</div>
        <div class="toolbar-spacer"></div>
        <span style="font-size:12px;color:#94a3b8">{{ paiementsDisplay().length }} paiement(s)</span>
      </div>
      <table class="gw-table">
        <thead>
          <tr>
            <th>Date</th><th>Vente</th><th>Client</th>
            <th>Montant</th><th>Moyen</th><th>R&#xe9;f&#xe9;rence</th><th>Op&#xe9;rateur</th>
          </tr>
        </thead>
        <tbody>
          @for (p of paiementsDisplay(); track $index) {
            <tr>
              <td style="font-size:12px;color:#64748b">{{ p.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
              <td><span style="font-family:monospace;font-size:12px;color:#0ea5e9;font-weight:600">{{ p.venteNumero }}</span></td>
              <td><strong>{{ p.clientNom }}</strong></td>
              <td><strong style="color:#22c55e">{{ p.montant | number:'1.0-0' }} FCFA</strong></td>
              <td><span class="badge badge-secondary">{{ moyenLabels[p.moyen] || p.moyen }}</span></td>
              <td style="font-size:12px;color:#64748b;font-family:monospace">{{ p.reference || '&mdash;' }}</td>
              <td style="font-size:12px">{{ p.operateur }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  }
</div>

<!-- MODAL NOUVELLE VENTE -->
@if (showNewVente()) {
  <div class="gw-modal-backdrop" (click)="showNewVente.set(false)">
    <div class="gw-modal modal-xl" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <div>
          <div class="modal-title">Nouvelle vente</div>
          <div style="font-size:12px;color:#94a3b8">N&#xb0; auto-g&#xe9;n&#xe9;r&#xe9; &#xe0; la validation</div>
        </div>
        <button class="modal-close" (click)="showNewVente.set(false)">&#x2715;</button>
      </div>
      <div class="modal-body">
        @for (a of discountAlerts(); track $index) {
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;margin-bottom:10px;color:#dc2626;font-size:13px">
            &#x1F6A8; {{ a }}
          </div>
        }
        @for (a of venteAlerts(); track $index) {
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;margin-bottom:10px;color:#dc2626;font-size:13px">
            &#x26D4; {{ a }}
          </div>
        }
        <div class="grid-2" style="margin-bottom:20px">
          <div class="form-group">
            <label>Client *</label>
            <select class="form-control" [(ngModel)]="venteForm.clientId" (change)="onClientSelect()">
              <option value="">S&#xe9;lectionner un client</option>
              @for (c of clients(); track c.id) {
                <option [value]="c.id">{{ c.nom }} ({{ c.code }})</option>
              }
              <option value="comptoir">&#x1F3EA; Client comptoir (vente anonyme)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Type de vente *</label>
            <select class="form-control" [(ngModel)]="venteForm.typeVente">
              <option value="comptant">Comptant</option>
              <option value="credit">Cr&#xe9;dit</option>
              <option value="acompte">Acompte</option>
            </select>
          </div>
        </div>

        @if (venteForm.typeVente === 'comptant') {
          <div style="margin-bottom:16px;padding:12px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;display:flex;align-items:center;gap:14px;flex-wrap:wrap">
            <div class="form-group" style="margin:0;flex:1;min-width:220px">
              <label for="vente-moyen-comptant">Moyen d'encaissement (vente comptant)</label>
              <select id="vente-moyen-comptant" name="paiementMoyenComptant" class="form-control" [(ngModel)]="paiementMoyenComptant">
                <option value="especes">Esp&#xe8;ces</option>
                <option value="orange_money">Orange Money</option>
                <option value="wave">Wave</option>
                <option value="moov_money">Moov Money</option>
                <option value="virement">Virement</option>
                <option value="cheque">Ch&#xe8;que</option>
              </select>
            </div>
            <div style="font-size:12px;color:#166534;max-width:300px">
              La vente sera marqu&#xe9;e <strong>Pay&#xe9;e</strong> et le solde caisse sera mis &#xe0; jour imm&#xe9;diatement.
            </div>
          </div>
        }

        @if (venteForm.typeVente === 'acompte') {
          <div class="grid-2" style="margin-bottom:16px;padding:12px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px">
            <div class="form-group" style="margin:0">
              <label>Montant de l'acompte vers&#xe9; (FCFA) *</label>
              <input type="number" class="form-control" [(ngModel)]="acompteMontant" min="0" [max]="total()" placeholder="0">
            </div>
            <div class="form-group" style="margin:0">
              <label>Moyen de paiement de l'acompte</label>
              <select class="form-control" [(ngModel)]="acompteMoyen">
                <option value="especes">Esp&#xe8;ces</option>
                <option value="orange_money">Orange Money</option>
                <option value="wave">Wave</option>
                <option value="moov_money">Moov Money</option>
                <option value="virement">Virement</option>
                <option value="cheque">Ch&#xe8;que</option>
              </select>
            </div>
          </div>
        }

        <div class="section-title">Produits command&#xe9;s</div>
        <div style="margin-bottom:16px">
          @for (ligne of lignes; track $index; let i = $index) {
            <div style="display:grid;grid-template-columns:2fr 80px 110px 90px 100px auto;gap:8px;align-items:end;margin-bottom:8px">
              <div class="form-group" style="margin:0">
                @if (i === 0) { <label>Produit</label> }
                <select class="form-control" [(ngModel)]="ligne.produitId" (change)="onLigneProduit(i)">
                  <option value="">Choisir un produit</option>
                  @for (p of produits(); track p.id) {
                    <option [value]="p.id">{{ p.nom }} (stock: {{ p.stock }})</option>
                  }
                </select>
              </div>
              <div class="form-group" style="margin:0">
                @if (i === 0) { <label>Qt&#xe9;</label> }
                <input type="number" class="form-control" [(ngModel)]="ligne.quantite" min="1" (input)="calcLigne(i)">
              </div>
              <div class="form-group" style="margin:0">
                @if (i === 0) { <label>Prix unit.</label> }
                <input type="number" class="form-control" [(ngModel)]="ligne.prixUnitaire" (input)="calcLigne(i)">
              </div>
              <div class="form-group" style="margin:0">
                @if (i === 0) { <label style="color:#f59e0b">Remise %</label> }
                <input type="number" class="form-control" [(ngModel)]="ligne.remisePct" min="0" max="100"
                  (input)="calcLigne(i)" placeholder="0"
                  [style.border-color]="ligne.remisePct > plafondRemise ? '#ef4444' : '#e2e8f0'"
                  [style.background]="ligne.remisePct > plafondRemise ? '#fef2f2' : ''">
              </div>
              <div class="form-group" style="margin:0">
                @if (i === 0) { <label>Total</label> }
                <input type="number" class="form-control" [value]="ligne.total" readonly style="background:#f8fafc;font-weight:600">
              </div>
              <button class="btn btn-ghost btn-sm btn-icon" (click)="removeLigne(i)"
                [style.margin-top]="i===0?'24px':'0'" style="color:#ef4444">&#x2715;</button>
            </div>
          }
          <button class="btn btn-secondary btn-sm" (click)="addLigne()">+ Ajouter une ligne</button>
        </div>

        <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
          <div style="width:340px;background:#f8fafc;border-radius:12px;padding:16px">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <span style="color:#64748b">Sous-total :</span>
              <strong>{{ sousTotal() | number:'1.0-0' }} FCFA</strong>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <span style="color:#64748b">Remise globale :</span>
              <div style="display:flex;align-items:center;gap:6px">
                <input type="number" min="0" max="100"
                  style="width:70px;height:30px;text-align:right;padding:0 8px;border-radius:6px"
                  [style.border]="remiseGlobalePct > plafondRemise ? '1px solid #ef4444' : '1px solid #e2e8f0'"
                  [style.background]="remiseGlobalePct > plafondRemise ? '#fef2f2' : '#fff'"
                  [(ngModel)]="remiseGlobalePct" (input)="calcTotal()">
                <span style="font-size:11px;color:#94a3b8">% = {{ remiseGlobaleMontant() | number:'1.0-0' }} FCFA</span>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;padding-top:12px;border-top:2px solid #e2e8f0">
              <span style="font-weight:700;font-size:16px">Total :</span>
              <span style="font-weight:700;font-size:20px;color:#0ea5e9">{{ total() | number:'1.0-0' }} FCFA</span>
            </div>
          </div>
        </div>

        <div style="padding:16px;background:#f0f9ff;border-radius:12px;border:1px solid #bae6fd;margin-bottom:16px">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-weight:600;color:#0369a1;font-size:14px">
            <input type="checkbox" [(ngModel)]="venteFormLivraison.domicile" style="width:16px;height:16px;cursor:pointer">
            &#x1F69A; Livraison &#xe0; domicile
          </label>
          @if (venteFormLivraison.domicile) {
            <div class="grid-2" style="margin-top:14px">
              <div class="form-group">
                <label>Adresse de livraison *</label>
                <input class="form-control" [(ngModel)]="venteFormLivraison.adresse" placeholder="Quartier, rue, description...">
              </div>
              <div class="form-group">
                <label>Livreur</label>
                <select class="form-control" [(ngModel)]="venteFormLivraison.livreur">
                  <option value="">&mdash; Affecter plus tard &mdash;</option>
                  @for (lv of livreurs(); track lv.id) {
                    <option [value]="lv.nom">{{ lv.nom }} ({{ lv.vehicule || lv.telephone }})</option>
                  }
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Date / heure de livraison pr&#xe9;vue</label>
              <input type="datetime-local" class="form-control" [(ngModel)]="venteFormLivraison.date">
            </div>
          }
        </div>

        <div class="form-group">
          <label>Notes / Observations</label>
          <textarea class="form-control" [(ngModel)]="venteForm.notes" rows="2" placeholder="Notes optionnelles..."></textarea>
        </div>
      </div>
      <div class="modal-footer" style="flex-direction:column;align-items:stretch;gap:10px">
        @if (venteAlerts().length > 0) {
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;color:#dc2626;font-size:12.5px">
            @for (a of venteAlerts(); track $index) {
              <div>&#x26D4; {{ a }}</div>
            }
          </div>
        }
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary" (click)="showNewVente.set(false)">Annuler</button>
          @if (showForceCreditBtn()) {
            <button class="btn" style="background:#f59e0b;color:white;border:none;padding:10px 20px;border-radius:8px;font-weight:600;cursor:pointer"
              (click)="saveVente(true, false)" [disabled]="saving()">
              &#x26A0;&#xFE0F; Forcer cr&#xe9;dit (Admin)
            </button>
          }
          @if (showForceStockBtn()) {
            <button class="btn" style="background:#ef4444;color:white;border:none;padding:10px 20px;border-radius:8px;font-weight:600;cursor:pointer"
              (click)="saveVente(true, true)" [disabled]="saving()">
              &#x26A0;&#xFE0F; D&#xe9;rogation stock (Admin)
            </button>
          }
          <button class="btn btn-primary" (click)="saveVente(false, false)" [disabled]="saving() || hasBlockingAlerts()">
            @if (saving()) { <span class="loading-spinner" style="width:16px;height:16px;border-width:2px;margin:0"></span> }
            @else { &#x2705; Valider la vente }
          </button>
        </div>
      </div>
    </div>
  </div>
}

<!-- MODAL PAIEMENT -->
@if (showPaiementModal()) {
  <div class="gw-modal-backdrop" (click)="showPaiementModal.set(false)">
    <div class="gw-modal modal-sm" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title">&#x1F4B0; Encaissement</div>
        <button class="modal-close" (click)="showPaiementModal.set(false)">&#x2715;</button>
      </div>
      <div class="modal-body">
        @if (selectedVente()) {
          <div style="background:#f8fafc;border-radius:8px;padding:12px;margin-bottom:16px">
            <div style="font-size:11px;color:#94a3b8">Facture {{ selectedVente()!.numero }}</div>
            <div style="font-size:14px;font-weight:600">{{ selectedVente()!.clientNom }}</div>
            <div style="margin-top:8px;display:flex;justify-content:space-between">
              <span style="font-size:12px;color:#64748b">Solde restant</span>
              <span style="font-weight:700;color:#ef4444">{{ selectedVente()!.soldeRestant | number:'1.0-0' }} FCFA</span>
            </div>
          </div>
          <div style="margin-bottom:16px">
            <div style="font-size:12px;color:#64748b;margin-bottom:8px;font-weight:600">Montant rapide :</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-secondary btn-sm" (click)="setMontantRapide('solde')">&#x1F4AF; Solde total</button>
              <button class="btn btn-secondary btn-sm" (click)="setMontantRapide('50')">&#xBD; 50 %</button>
              <button class="btn btn-secondary btn-sm" (click)="setMontantRapide('custom')">&#x270F;&#xFE0F; Personnalis&#xe9;</button>
            </div>
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label>Moyen de paiement *</label>
            <select class="form-control" [(ngModel)]="paiementMoyen" (change)="onMoyenChange()">
              <option value="especes">&#x1F4B5; Esp&#xe8;ces</option>
              <option value="orange_money">&#x1F7E0; Orange Money</option>
              <option value="wave">&#x1F30A; Wave</option>
              <option value="moov_money">&#x1F7E3; Moov Money</option>
              <option value="virement">&#x1F3E6; Virement</option>
              <option value="cheque">&#x1F4C4; Ch&#xe8;que</option>
            </select>
          </div>
          @if (paiementMoyen === 'especes') {
            <div class="form-group" style="margin-bottom:10px">
              <label>Montant re&#xe7;u du client *</label>
              <input type="number" class="form-control" [(ngModel)]="paiementMontantRecu"
                (input)="onMontantRecuChange()" min="0" placeholder="0">
            </div>
            @if (monnaieARendreDisplay() > 0) {
              <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
                <span style="color:#166534;font-size:14px;font-weight:600">&#x1F4B5; Monnaie &#xe0; rendre</span>
                <span style="color:#166534;font-size:18px;font-weight:800">{{ monnaieARendreDisplay() | number:'1.0-0' }} FCFA</span>
              </div>
            }
            <div class="form-group" style="margin-bottom:16px">
              <label>Montant encaiss&#xe9; (calcul&#xe9;)</label>
              <input type="number" class="form-control" [value]="paiementMontant" readonly
                style="background:#f8fafc;font-weight:700;color:#22c55e">
            </div>
          } @else {
            <div class="form-group" style="margin-bottom:16px">
              <label>Montant encaiss&#xe9; *</label>
              <input type="number" class="form-control" [(ngModel)]="paiementMontant"
                [max]="selectedVente()!.soldeRestant">
            </div>
            <div class="form-group">
              <label>R&#xe9;f&#xe9;rence de transaction</label>
              <input class="form-control" [(ngModel)]="paiementRef" placeholder="R&#xe9;f&#xe9;rence de la transaction">
            </div>
          }
        }
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" (click)="showPaiementModal.set(false)">Annuler</button>
        <button class="btn btn-success" (click)="savePaiement()" [disabled]="saving()">
          @if (saving()) { <span class="loading-spinner" style="width:16px;height:16px;border-width:2px;margin:0"></span> }
          @else { &#x1F4B0; Enregistrer le paiement }
        </button>
      </div>
    </div>
  </div>
}

<!-- MODAL ANNULATION -->
@if (showAnnulationModal()) {
  <div class="gw-modal-backdrop" (click)="showAnnulationModal.set(false)">
    <div class="gw-modal modal-sm" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title" style="color:#ef4444">&#x1F6AB; Annuler la vente</div>
        <button class="modal-close" (click)="showAnnulationModal.set(false)">&#x2715;</button>
      </div>
      <div class="modal-body">
        @if (ventePourAnnulation()) {
          <div style="background:#fef2f2;border-radius:8px;padding:12px;margin-bottom:14px">
            <div style="font-size:14px;font-weight:700;color:#dc2626;font-family:monospace">{{ ventePourAnnulation()!.numero }}</div>
            <div style="font-size:13px;color:#64748b;margin-top:4px">
              {{ ventePourAnnulation()!.clientNom }} &mdash;
              <strong>{{ ventePourAnnulation()!.total | number:'1.0-0' }} FCFA</strong>
            </div>
          </div>
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:#92400e">
            &#x26A0;&#xFE0F; <strong>Le stock sera automatiquement restitu&#xe9;</strong> pour chaque ligne de cette vente.
          </div>
          <div class="form-group">
            <label>Motif de l'annulation *</label>
            <textarea class="form-control" [(ngModel)]="motifAnnulation" rows="3"
              placeholder="Motif obligatoire (ex: erreur de commande, retour client...)"></textarea>
          </div>
        }
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" (click)="showAnnulationModal.set(false)">Fermer</button>
        <button class="btn btn-danger" (click)="confirmerAnnulation()"
          [disabled]="!motifAnnulation.trim() || saving()">
          @if (saving()) { <span class="loading-spinner" style="width:16px;height:16px;border-width:2px;margin:0"></span> }
          @else { &#x1F6AB; Confirmer l'annulation }
        </button>
      </div>
    </div>
  </div>
}

<!-- MODAL AFFECTER LIVREUR -->
@if (showAffecterLivreurModal()) {
  <div class="gw-modal-backdrop" (click)="showAffecterLivreurModal.set(false)">
    <div class="gw-modal modal-sm" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title">&#x1F464; Affecter un livreur</div>
        <button class="modal-close" (click)="showAffecterLivreurModal.set(false)">&#x2715;</button>
      </div>
      <div class="modal-body">
        @if (livraisonSelectee()) {
          <div style="background:#f8fafc;border-radius:8px;padding:12px;margin-bottom:16px">
            <div style="font-size:11px;color:#94a3b8">Livraison pour</div>
            <div style="font-size:14px;font-weight:700">{{ livraisonSelectee()!.clientNom }}</div>
            <div style="font-size:12px;color:#64748b">{{ livraisonSelectee()!.venteNumero }}</div>
            @if (livraisonSelectee()!.adresse) {
              <div style="font-size:12px;color:#64748b;margin-top:4px">&#x1F4CD; {{ livraisonSelectee()!.adresse }}</div>
            }
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label>Livreur disponible *</label>
            <select class="form-control" [(ngModel)]="livreurSelectionne">
              <option value="">&mdash; Choisir un livreur &mdash;</option>
              @for (lv of livreurs(); track lv.id) {
                <option [value]="lv.nom">{{ lv.nom }} ({{ lv.vehicule || lv.telephone }})</option>
              }
            </select>
          </div>
          <div class="form-group">
            <label>Date / heure pr&#xe9;vue</label>
            <input type="datetime-local" class="form-control" [(ngModel)]="dateLivraisonPrevue">
          </div>
        }
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" (click)="showAffecterLivreurModal.set(false)">Annuler</button>
        <button class="btn btn-primary" (click)="confirmerAffectation()" [disabled]="!livreurSelectionne">
          &#x1F464; Affecter le livreur
        </button>
      </div>
    </div>
  </div>
}

<!-- MODAL ECHEC LIVRAISON -->
@if (showEchecModal()) {
  <div class="gw-modal-backdrop" (click)="showEchecModal.set(false)">
    <div class="gw-modal modal-sm" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title" style="color:#ef4444">&#x274C; &#xC9;chec de livraison</div>
        <button class="modal-close" (click)="showEchecModal.set(false)">&#x2715;</button>
      </div>
      <div class="modal-body">
        @if (livraisonSelectee()) {
          <div style="background:#fef2f2;border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:13px;color:#dc2626">
            {{ livraisonSelectee()!.clientNom }} &mdash; {{ livraisonSelectee()!.venteNumero }}
          </div>
        }
        <div class="form-group">
          <label>Motif de l'&#xe9;chec *</label>
          <textarea class="form-control" [(ngModel)]="motifEchec" rows="3"
            placeholder="Ex: Client absent, adresse introuvable, refus de r&#xe9;ception..."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" (click)="showEchecModal.set(false)">Annuler</button>
        <button class="btn btn-danger" (click)="confirmerEchec()" [disabled]="!motifEchec.trim()">
          &#x274C; Confirmer l'&#xe9;chec
        </button>
      </div>
    </div>
  </div>
}
  `
})
export class VentesComponent implements OnInit {
  dataService   = inject(DataService);
  toastService  = inject(ToastService);
  authService   = inject(AuthService);
  private printService = inject(PrintService);
  private waService    = inject(WhatsappService);
  private destroyRef = inject(DestroyRef);
  private cdr        = inject(ChangeDetectorRef);

  plafondRemise = 5;
  private appSettings: AppSettings | null = null;
  acompteMoyen: Paiement['moyen'] = 'especes';
  paiementMoyenComptant: Paiement['moyen'] = 'especes';

  ventes            = signal<Vente[]>([]);
  filteredVentes    = signal<Vente[]>([]);
  clients           = signal<Client[]>([]);
  produits          = signal<Produit[]>([]);
  paiements         = signal<Paiement[]>([]);
  livraisons        = signal<Livraison[]>([]);
  paiementsDisplay  = signal<PaiementDisplay[]>([]);
  loading           = signal(true);
  saving            = signal(false);

  activeTab                = signal<'ventes' | 'livraisons' | 'encaissements'>('ventes');
  showNewVente             = signal(false);
  showPaiementModal        = signal(false);
  showAnnulationModal      = signal(false);
  showAffecterLivreurModal = signal(false);
  showEchecModal           = signal(false);

  selectedVente       = signal<Vente | null>(null);
  ventePourAnnulation = signal<Vente | null>(null);
  livraisonSelectee   = signal<Livraison | null>(null);

  discountAlerts = signal<string[]>([]);
  venteAlerts    = signal<string[]>([]);

  search        = '';
  filterStatut  = '';
  filterPeriode = 'all';

  venteForm: Partial<Vente> = { clientId: '', typeVente: 'comptant', notes: '' };
  lignes: LigneForm[] = [{ produitId: '', produitNom: '', quantite: 1, prixUnitaire: 0, remisePct: 0, remiseMontant: 0, total: 0 }];
  remiseGlobalePct    = 0;
  venteFormLivraison  = { domicile: false, adresse: '', livreur: '', date: '' };

  paiementMontant     = 0;
  paiementMontantRecu = 0;
  paiementMoyen       = 'especes';
  paiementRef         = '';

  motifAnnulation     = '';
  livreurSelectionne  = '';
  dateLivraisonPrevue = '';
  motifEchec          = '';
  acompteMontant      = 0;

  livreurs = signal<Livreur[]>([]);

  typeLabels: Record<string, string> = {
    comptant: 'Comptant', credit: 'Crédit', acompte: 'Acompte'
  };
  statutLabels: Record<string, string> = {
    en_attente: 'En attente', validee: 'Validée', livree: 'Livrée',
    payee: 'Payée', annulee: 'Annulée'
  };
  statutLivLabels: Record<string, string> = {
    a_livrer: 'À livrer', en_cours: 'En cours', livree: 'Livrée', echec: 'Échec'
  };
  moyenLabels: Record<string, string> = {
    especes: 'Espèces', orange_money: 'Orange Money', wave: 'Wave',
    moov_money: 'Moov Money', virement: 'Virement', cheque: 'Chèque'
  };

  stats = [
    { label: 'CA du mois',         value: '0 FCFA',   icon: '💰', bg: '#e0f2fe' },
    { label: 'Ventes en cours',    value: '0',        icon: '🛒', bg: '#f0fdf4' },
    { label: 'Livraisons à faire', value: '0',        icon: '🚚', bg: '#fffbeb' },
    { label: 'Impayées',           value: '0 ventes', icon: '⚠️', bg: '#fef2f2' },
  ];

  private toDate(val: any): Date {
    if (val instanceof Date) return val;
    if (val?.toDate) return val.toDate();
    return val ? new Date(val) : new Date();
  }

  ngOnInit() {
    this.loading.set(true);
    this.dataService.getVentes().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => {
          const normalized = data.map(v => ({ ...v, createdAt: this.toDate(v.createdAt) }));
          this.ventes.set(normalized);
          this.filterVentes();
          this.updateStats();
          this.updatePaiementsDisplay();
          this.loading.set(false);
        },
        error: err => { console.error(err); this.loading.set(false); }
      });
    this.dataService.getClients().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => this.clients.set(data));
    this.dataService.getProduits().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => this.produits.set(data));
    this.dataService.getPaiements().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => { this.paiements.set(data); this.updatePaiementsDisplay(); });
    this.dataService.getLivreurs().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => this.livreurs.set(data.filter(l => l.statut === 'actif')));
    this.dataService.getLivraisons().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => { this.livraisons.set(data); this.updateStats(); });
    this.dataService.getSettings().then(cfg => {
      if (cfg) {
        this.appSettings = cfg;
        this.plafondRemise = cfg.plafondRemiseVendeur ?? 5;
        this.cdr.markForCheck();
      }
    }).catch(() => {});
  }

  private updateStats() {
    const mois = new Date().toISOString().slice(0, 7);
    const actives = this.ventes().filter(v => v.statut !== 'annulee');
    const caMois = actives
      .filter(v => this.toDate(v.createdAt).toISOString().slice(0, 7) === mois)
      .reduce((s, v) => s + (v.total || 0), 0);
    const enCours = actives.filter(v => v.statut === 'validee' || v.statut === 'en_attente').length;
    const livAFaire = this.livraisons().filter(l => l.statut === 'a_livrer' || l.statut === 'en_cours').length;
    const impayees = actives.filter(v => (v.soldeRestant || 0) > 0).length;

    this.stats = [
      { label: 'CA du mois',         value: new Intl.NumberFormat('fr-FR').format(caMois) + ' FCFA', icon: '💰', bg: '#e0f2fe' },
      { label: 'Ventes en cours',    value: String(enCours),           icon: '🛒', bg: '#f0fdf4' },
      { label: 'Livraisons à faire', value: String(livAFaire),         icon: '🚚', bg: '#fffbeb' },
      { label: 'Impayées',           value: `${impayees} vente(s)`,    icon: '⚠️', bg: '#fef2f2' },
    ];
    this.cdr.markForCheck();
  }

  private updatePaiementsDisplay() {
    const ventes = this.ventes();
    const display: PaiementDisplay[] = this.paiements().map(p => {
      const vente = ventes.find(v => v.id === p.venteId);
      return {
        venteNumero: vente?.numero || p.venteId,
        clientNom:   vente?.clientNom || '',
        montant:     p.montant,
        moyen:       p.moyen,
        reference:   p.reference,
        createdAt:   this.toDate(p.createdAt),
        operateur:   p.operateur,
      };
    });
    this.paiementsDisplay.set(display);
  }

  filterVentes() {
    let r = this.ventes();
    if (this.search) {
      const s = this.search.toLowerCase();
      r = r.filter(v => v.numero.toLowerCase().includes(s) || v.clientNom.toLowerCase().includes(s));
    }
    if (this.filterStatut) r = r.filter(v => v.statut === this.filterStatut);
    if (this.filterPeriode !== 'all') {
      const now = new Date();
      const todayStr = now.toDateString();
      const weekAgo = new Date(now.getTime() - 7 * 86400000);
      const monthPrefix = now.toISOString().slice(0, 7);
      r = r.filter(v => {
        const d = this.toDate(v.createdAt);
        if (this.filterPeriode === 'today') return d.toDateString() === todayStr;
        if (this.filterPeriode === 'week') return d >= weekAgo;
        if (this.filterPeriode === 'month') return d.toISOString().slice(0, 7) === monthPrefix;
        return true;
      });
    }
    this.filteredVentes.set(r);
  }

  statutBadge(s: string): string {
    const m: Record<string, string> = {
      en_attente: 'badge-secondary', validee: 'badge-info', livree: 'badge-primary',
      payee: 'badge-success', annulee: 'badge-danger'
    };
    return m[s] || 'badge-secondary';
  }
  statutLivBadge(s: string): string {
    const m: Record<string, string> = {
      a_livrer: 'badge-secondary', en_cours: 'badge-info', livree: 'badge-success', echec: 'badge-danger'
    };
    return m[s] || 'badge-secondary';
  }
  countStatutLiv(statut: string): number {
    return this.livraisons().filter(l => l.statut === statut).length;
  }

  sousTotal(): number { return this.lignes.reduce((s, l) => s + (l.total || 0), 0); }
  remiseGlobaleMontant(): number { return Math.round(this.sousTotal() * this.remiseGlobalePct / 100); }
  total(): number { return Math.max(0, this.sousTotal() - this.remiseGlobaleMontant()); }

  addLigne() {
    this.lignes.push({ produitId: '', produitNom: '', quantite: 1, prixUnitaire: 0, remisePct: 0, remiseMontant: 0, total: 0 });
  }
  removeLigne(i: number) {
    if (this.lignes.length > 1) this.lignes.splice(i, 1);
    this.checkDiscountAlert();
  }
  private prixPourClient(p: Produit): number {
    const client = this.clients().find(c => c.id === this.venteForm.clientId);
    if (!client) return p.prixDetail;
    if (client.grilleTarifaire === 'gros') return p.prixGros || p.prixDetail;
    if (client.grilleTarifaire === 'revendeur') return p.prixRevendeur || p.prixDetail;
    return p.prixDetail;
  }

  onLigneProduit(i: number) {
    this.venteAlerts.set([]);
    const p = this.produits().find(p => p.id === this.lignes[i].produitId);
    if (p) {
      this.lignes[i].produitNom   = p.nom;
      this.lignes[i].prixUnitaire = this.prixPourClient(p);
      this.calcLigne(i);
    }
  }
  calcLigne(i: number) {
    this.venteAlerts.set([]);
    const l    = this.lignes[i];
    const brut = (l.quantite || 0) * (l.prixUnitaire || 0);
    l.remiseMontant = Math.round(brut * (l.remisePct || 0) / 100);
    l.total         = brut - l.remiseMontant;
    this.checkDiscountAlert();
  }
  calcTotal() { this.checkDiscountAlert(); }

  checkDiscountAlert() {
    if (this.authService.hasRole('admin', 'superadmin')) {
      this.discountAlerts.set([]);
      return;
    }
    const alerts: string[] = [];
    for (const l of this.lignes) {
      if ((l.remisePct || 0) > this.plafondRemise && l.produitId) {
        alerts.push(`Remise ${l.remisePct}% sur "${l.produitNom || 'ce produit'}" dépasse ${this.plafondRemise}% — validation Admin requise`);
      }
    }
    if (this.remiseGlobalePct > this.plafondRemise) {
      alerts.push(`Remise globale ${this.remiseGlobalePct}% dépasse ${this.plafondRemise}% — validation Admin requise`);
    }
    this.discountAlerts.set(alerts);
  }

  onClientSelect() {
    const client = this.clients().find(c => c.id === this.venteForm.clientId);
    if (client && !this.venteFormLivraison.adresse) {
      this.venteFormLivraison.adresse = [client.adresse, client.quartier].filter(Boolean).join(', ');
    }
    this.lignes.forEach((l, idx) => {
      if (l.produitId) {
        const p = this.produits().find(pr => pr.id === l.produitId);
        if (p) {
          l.prixUnitaire = this.prixPourClient(p);
          this.calcLigne(idx);
        }
      }
    });
  }

  hasBlockingAlerts(): boolean {
    if (this.discountAlerts().length > 0 && !this.authService.hasRole('admin', 'superadmin')) return true;
    if (this.venteAlerts().length > 0) return true;
    return false;
  }
  showForceCreditBtn(): boolean {
    return this.venteAlerts().some(a => a.includes('Plafond')) && this.authService.hasRole('admin', 'superadmin');
  }
  showForceStockBtn(): boolean {
    return this.venteAlerts().some(a => a.includes('Stock insuffisant')) && this.authService.hasRole('admin', 'superadmin');
  }

  openNewVente() {
    this.venteForm          = { clientId: '', typeVente: 'comptant', notes: '' };
    this.lignes             = [{ produitId: '', produitNom: '', quantite: 1, prixUnitaire: 0, remisePct: 0, remiseMontant: 0, total: 0 }];
    this.remiseGlobalePct   = 0;
    this.acompteMontant     = 0;
    this.acompteMoyen       = 'especes';
    this.venteFormLivraison = { domicile: false, adresse: '', livreur: '', date: '' };
    this.discountAlerts.set([]);
    this.venteAlerts.set([]);
    this.showNewVente.set(true);
  }

  async saveVente(forceCredit = false, forceStock = false) {
    if (!this.venteForm.clientId) { this.toastService.error('Sélectionnez un client.'); return; }
    if (this.lignes.some(l => !l.produitId)) { this.toastService.error('Tous les produits doivent être sélectionnés.'); return; }
    if (this.venteForm.typeVente === 'acompte' && (this.acompteMontant <= 0 || this.acompteMontant > this.total())) {
      this.toastService.error('Saisissez un montant d\'acompte valide (> 0 et ≤ total).');
      return;
    }

    // Pré-vérification UI stock (sauf dérogation Admin)
    if (!forceStock) {
      const stockAlerts: string[] = [];
      for (const ligne of this.lignes) {
        const p = this.produits().find(p => p.id === ligne.produitId);
        if (p && p.stock < ligne.quantite) {
          stockAlerts.push(`Stock insuffisant pour "${p.nom}" : demandé ${ligne.quantite}, disponible ${p.stock}`);
        }
      }
      if (stockAlerts.length > 0) {
        this.venteAlerts.set(stockAlerts);
        this.toastService.warning(
          this.authService.hasRole('admin', 'superadmin')
            ? `${stockAlerts[0]} — Utilisez "Dérogation stock (Admin)" ou approvisionnez le stock.`
            : stockAlerts[0]
        );
        return;
      }
    }

    // Pré-vérification client suspendu & plafond crédit
    if (this.venteForm.typeVente === 'credit') {
      const client = this.clients().find(c => c.id === this.venteForm.clientId);
      if (client && client.statut === 'suspendu') {
        const msg = `Le client "${client.nom}" est suspendu et ne peut pas recevoir de vente à crédit.`;
        this.venteAlerts.set([msg]);
        this.toastService.error(msg);
        return;
      }
      if (!forceCredit && client && client.id !== 'comptoir') {
        const totalVente = this.total();
        if (client.plafondCredit > 0 && client.solde + totalVente > client.plafondCredit) {
          const msg =
            `Plafond de crédit atteint pour ${client.nom} : ` +
            `solde actuel ${client.solde.toLocaleString('fr-FR')} FCFA ` +
            `+ cette vente ${totalVente.toLocaleString('fr-FR')} FCFA ` +
            `> plafond ${client.plafondCredit.toLocaleString('fr-FR')} FCFA`;
          this.venteAlerts.set([msg]);
          this.toastService.warning(msg);
          return;
        }
      }
    }

    // Blocage remise > plafond pour non-admin
    if (this.discountAlerts().length > 0 && !this.authService.hasRole('admin', 'superadmin')) {
      this.toastService.error(`Remises dépassant ${this.plafondRemise}% — validation Admin requise.`);
      return;
    }

    this.venteAlerts.set([]);
    this.saving.set(true);
    try {
      const client = this.clients().find(c => c.id === this.venteForm.clientId);
      const lignesData: LigneVente[] = this.lignes.map(l => ({
        produitId: l.produitId, produitNom: l.produitNom,
        quantite: l.quantite, prixUnitaire: l.prixUnitaire,
        remise: l.remiseMontant, total: l.total,
      }));

      const { venteId, numero: num } = await this.dataService.creerVenteAtomique({
        clientId: this.venteForm.clientId!,
        clientNom: client?.nom || 'Client comptoir',
        lignes: lignesData,
        sousTotal: this.sousTotal(),
        remise: this.remiseGlobaleMontant(),
        total: this.total(),
        typeVente: this.venteForm.typeVente || 'comptant',
        paiementMoyen: this.paiementMoyenComptant,
        acompteMontant: this.venteForm.typeVente === 'acompte' ? this.acompteMontant : 0,
        acompteMoyen: this.acompteMoyen,
        forceCredit,
        forceStock,
        livraison: this.venteFormLivraison.domicile,
        notes: this.venteForm.notes,
      });

      if (this.venteFormLivraison.domicile) {
        const selectedLiv = this.livreurs().find(l => l.nom === this.venteFormLivraison.livreur);
        await this.dataService.addLivraison({
          venteId,
          venteNumero: num,
          clientId: this.venteForm.clientId!,
          clientNom: client?.nom || 'Client comptoir',
          adresse: this.venteFormLivraison.adresse || client?.adresse || '',
          livreurId: selectedLiv?.id,
          livreur: this.venteFormLivraison.livreur || '',
          statut: this.venteFormLivraison.livreur ? 'en_cours' : 'a_livrer',
          datePrevue: this.venteFormLivraison.date || '',
        });
      }

      void this.dataService.logAudit(
        'VENTE_CREEE',
        `Vente ${num}`,
        `Montant ${this.total().toLocaleString('fr-FR')} FCFA — ${client?.nom || 'Client comptoir'}`,
        this.authService.currentUser?.uid || '',
        this.authService.currentUser?.displayName || ''
      );
      this.toastService.success(`Vente ${num} validée avec succès !`);
      this.showNewVente.set(false);
    } catch (err: any) {
      console.error(err);
      const msg: string = err?.message || '';
      const displayMsg = msg.startsWith('PERIODE_CLOTUREE:')
        ? `Période comptable ${msg.split(':')[1]} clôturée : aucune vente autorisée.`
        : (msg || 'Erreur lors de la création de la vente.');
      this.venteAlerts.set([displayMsg]);
      this.toastService.error(displayMsg);
    } finally {
      this.saving.set(false);
      this.cdr.markForCheck();
    }
  }

  printFacture(v: Vente) {
    this.printService.printFacture(v, v.lignes || [], this.appSettings);
  }

  printRecu(v: Vente) {
    this.printService.printRecu(v, this.appSettings);
  }

  async partagerWhatsApp(v: Vente) {
    const client = this.clients().find(c => c.id === v.clientId);
    try {
      const res = await this.waService.partagerFacture(
        { id: v.id, numero: v.numero, total: v.total, clientNom: v.clientNom, clientId: v.clientId },
        client?.whatsapp || client?.telephone || ''
      );
      if (res.mode === 'openwa') {
        this.toastService.success(`Facture ${v.numero} envoyée sur WhatsApp.`);
      } else {
        this.toastService.info(`WhatsApp Web ouvert pour la facture ${v.numero}.`);
      }
    } catch (err) {
      this.toastService.error(waErrorMessage(err, 'Erreur lors de l\'envoi WhatsApp.'));
    }
  }

  exportVentesPdf() {
    const rows = this.filteredVentes().map(v =>
      `<tr><td>${v.numero}</td><td>${new Date(v.createdAt).toLocaleDateString('fr-FR')}</td><td>${v.clientNom}</td><td>${v.vendeurNom}</td><td style="text-align:right">${v.total.toLocaleString('fr-FR')} FCFA</td><td style="text-align:right">${v.montantPaye.toLocaleString('fr-FR')} FCFA</td><td>${this.statutLabels[v.statut] || v.statut}</td></tr>`
    ).join('');
    const totalCA = this.filteredVentes().filter(v => v.statut !== 'annulee').reduce((s, v) => s + v.total, 0);
    const nomEnt = this.appSettings?.nomEntreprise || 'GWater Distribution';
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Liste des ventes</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;padding:24px}h1{color:#0ea5e9;margin-bottom:12px}table{width:100%;border-collapse:collapse}th{background:#0ea5e9;color:white;padding:8px;text-align:left}td{padding:6px 8px;border-bottom:1px solid #e2e8f0}</style></head><body>
<h1>💧 ${nomEnt} — Liste des ventes (${this.filteredVentes().length})</h1>
<p style="color:#64748b;margin-bottom:16px">Édité le ${new Date().toLocaleString('fr-FR')} · Total actif : <strong>${totalCA.toLocaleString('fr-FR')} FCFA</strong></p>
<table><thead><tr><th>N° Facture</th><th>Date</th><th>Client</th><th>Vendeur</th><th style="text-align:right">Total</th><th style="text-align:right">Payé</th><th>Statut</th></tr></thead><tbody>${rows}</tbody></table>
<script>window.onload=()=>window.print()</script></body></html>`;
    const win = window.open('', '_blank', 'width=940,height=720');
    if (win) { win.document.write(html); win.document.close(); }
  }

  viewVente(v: Vente) { this.printFacture(v); }

  openPaiement(v: Vente) {
    this.selectedVente.set(v);
    this.paiementMontant     = v.soldeRestant;
    this.paiementMontantRecu = v.soldeRestant;
    this.paiementMoyen       = 'especes';
    this.paiementRef         = '';
    this.showPaiementModal.set(true);
  }

  setMontantRapide(type: string) {
    const solde = this.selectedVente()?.soldeRestant || 0;
    if (type === 'solde') { this.paiementMontantRecu = solde; this.paiementMontant = solde; }
    else if (type === '50') { this.paiementMontantRecu = Math.round(solde / 2); this.paiementMontant = Math.round(solde / 2); }
  }

  onMontantRecuChange() {
    if (this.paiementMoyen === 'especes') {
      this.paiementMontant = Math.min(this.paiementMontantRecu, this.selectedVente()?.soldeRestant || 0);
    }
  }

  onMoyenChange() {
    if (this.paiementMoyen !== 'especes') {
      this.paiementMontantRecu = 0;
    } else {
      const solde = this.selectedVente()?.soldeRestant || 0;
      this.paiementMontantRecu = solde;
      this.paiementMontant     = solde;
    }
  }

  monnaieARendreDisplay(): number {
    if (this.paiementMoyen !== 'especes') return 0;
    return Math.max(0, this.paiementMontantRecu - (this.selectedVente()?.soldeRestant || 0));
  }

  async savePaiement() {
    if (!this.paiementMontant || this.paiementMontant <= 0) { this.toastService.error('Montant invalide.'); return; }
    const vente = this.selectedVente();
    if (!vente) return;
    this.saving.set(true);
    try {
      await this.dataService.enregistrerPaiement({
        vente,
        montant: this.paiementMontant,
        moyen: this.paiementMoyen as Paiement['moyen'],
        reference: this.paiementRef,
        operateur: this.authService.currentUser?.displayName || '',
      });
      this.toastService.success('Paiement enregistré avec succès !');
      this.showPaiementModal.set(false);
    } catch (err) {
      console.error(err);
      this.toastService.error('Erreur lors de l\'enregistrement du paiement.');
    } finally {
      this.saving.set(false);
    }
  }

  openAnnulation(v: Vente) {
    if (!this.authService.hasRole('admin', 'superadmin')) {
      this.toastService.error('Seuls les Administrateurs peuvent annuler une vente.');
      return;
    }
    this.ventePourAnnulation.set(v);
    this.motifAnnulation = '';
    this.showAnnulationModal.set(true);
  }

  async confirmerAnnulation() {
    if (!this.motifAnnulation.trim()) { this.toastService.error('Le motif est obligatoire.'); return; }
    const v = this.ventePourAnnulation();
    if (!v) return;
    this.saving.set(true);
    try {
      await this.dataService.annulerVente(v, this.motifAnnulation.trim());
      this.toastService.success(`Vente ${v.numero} annulée. Stock et solde client restitués.`);
      this.showAnnulationModal.set(false);
      this.motifAnnulation = '';
      this.ventePourAnnulation.set(null);
    } catch (err) {
      console.error(err);
      this.toastService.error('Erreur lors de l\'annulation.');
    } finally {
      this.saving.set(false);
    }
  }

  openAffecterLivreur(l: Livraison) {
    this.livraisonSelectee.set(l);
    this.livreurSelectionne  = l.livreur || '';
    this.dateLivraisonPrevue = l.datePrevue || '';
    this.showAffecterLivreurModal.set(true);
  }

  async confirmerAffectation() {
    if (!this.livreurSelectionne) return;
    const l = this.livraisonSelectee();
    if (!l?.id) return;
    try {
      const selectedLiv = this.livreurs().find(lv => lv.nom === this.livreurSelectionne);
      await this.dataService.updateLivraison(l.id, {
        livreurId: selectedLiv?.id,
        livreur: this.livreurSelectionne,
        datePrevue: this.dateLivraisonPrevue,
        statut: 'en_cours',
      });
      this.toastService.success(`Livreur ${this.livreurSelectionne} affecté avec succès.`);
      this.showAffecterLivreurModal.set(false);
    } catch {
      this.toastService.error('Erreur lors de l\'affectation du livreur.');
    }
  }

  async marquerLivree(l: Livraison) {
    if (!l.id) return;
    try {
      await this.dataService.updateLivraison(l.id, { statut: 'livree' });
      const vente = this.ventes().find(v => v.id === l.venteId);
      if (vente?.id && vente.statut !== 'payee' && vente.statut !== 'annulee') {
        await this.dataService.updateVente(vente.id, { statut: 'livree' });
      }
      this.toastService.success(`Livraison pour ${l.clientNom} marquée comme livrée !`);
    } catch {
      this.toastService.error('Erreur lors de la mise à jour de la livraison.');
    }
  }

  openEchecLivraison(l: Livraison) {
    this.livraisonSelectee.set(l);
    this.motifEchec = '';
    this.showEchecModal.set(true);
  }

  async confirmerEchec() {
    if (!this.motifEchec.trim()) return;
    const l = this.livraisonSelectee();
    if (!l?.id) return;
    try {
      await this.dataService.updateLivraison(l.id, {
        statut: 'echec',
        motifEchec: this.motifEchec.trim(),
      });
      this.toastService.warning(`Échec de livraison pour ${l.clientNom} enregistré.`);
      this.showEchecModal.set(false);
      this.motifEchec = '';
    } catch {
      this.toastService.error('Erreur lors de l\'enregistrement de l\'échec.');
    }
  }
}

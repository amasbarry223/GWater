import { Component, ChangeDetectorRef, DestroyRef, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DataService } from '../../core/data.service';
import { ToastService } from '../../core/toast.service';
import { AuthService } from '../../core/auth.service';
import { WhatsappService, waErrorMessage } from '../../core/whatsapp.service';
import { Depense, Vente, Paiement, Produit, Client, DetteFournisseur } from '../../core/models';

interface JournalLigne {
  date: Date;
  libelle: string;
  entree: number;
  sortie: number;
  solde: number;
  compte: string;
}

interface TransfertForm {
  source: string;
  destination: string;
  montant: number;
  motif: string;
}

interface ArreteForm {
  caisse: string;
  montantTheorique: number;
  montantCompte: number;
  explication: string;
}

interface ArreteHistorique {
  id: string;
  caisse: string;
  date: Date;
  montantTheorique: number;
  montantCompte: number;
  ecart: number;
  explication: string;
  operateur: string;
}

interface PeriodeComptable {
  id: string;
  label: string;
  mois: string;
  statut: 'ouverte' | 'cloturee';
  cloturePar?: string;
  clotureDate?: Date;
  motifReouverture?: string;
}

@Component({
  selector: 'app-comptabilite',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
<div>
  <div class="page-header">
    <div>
      <div class="page-title">Comptabilité</div>
      <div class="page-subtitle">Journal de caisse, dépenses, trésorerie et résultats financiers</div>
    </div>
    <div class="page-actions">
      <button class="btn btn-secondary btn-sm" (click)="exportResultatPDF()">📊 Rapport PDF</button>
      <button class="btn btn-primary" (click)="openDepense()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Nouvelle dépense
      </button>
    </div>
  </div>

  <!-- Tabs -->
  <div style="display:flex;gap:4px;margin-bottom:20px;background:#f1f5f9;border-radius:10px;padding:4px;width:fit-content;flex-wrap:wrap">
    @for (tab of tabs; track tab.id) {
      <button class="btn" [style.background]="activeTab()===tab.id?'white':'transparent'"
              [style.box-shadow]="activeTab()===tab.id?'var(--gw-shadow)':'none'"
              [style.color]="activeTab()===tab.id?'var(--gw-text)':'#94a3b8'"
              (click)="activeTab.set(tab.id)">{{ tab.icon }} {{ tab.label }}</button>
    }
  </div>

  <!-- TRÉSORERIE -->
  @if (activeTab() === 'tresorerie') {
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;margin-bottom:24px">
      @for (c of comptes; track c.key) {
        <div class="kpi-card">
          <div class="kpi-top">
            <div class="kpi-icon" [style.background]="c.bg">{{ c.icon }}</div>
            <span [class]="'badge ' + (c.solde >= 0 ? 'badge-success' : 'badge-danger')">
              {{ c.solde >= 0 ? '+' : '' }}{{ c.solde | number:'1.0-0' }}
            </span>
          </div>
          <div class="kpi-value">{{ c.solde | number:'1.0-0' }} FCFA</div>
          <div class="kpi-label">{{ c.nom }}</div>
        </div>
      }
    </div>
    <div style="margin-bottom:16px">
      <button class="btn btn-primary" (click)="openTransfert()">🔄 Transfert entre comptes</button>
    </div>
    <!-- Périodes comptables CPT-09 -->
    <div class="gw-card" style="margin-bottom:24px">
      <div class="card-header">
        <div class="card-title">🔒 Périodes comptables</div>
        @if (canCloture()) {
          <button class="btn btn-warning btn-sm" (click)="ouvrirCloture()">Clôturer {{ currentMonth }}</button>
        }
      </div>
      <div class="card-body" style="padding:0">
        <table class="gw-table">
          <thead><tr><th>Période</th><th>Statut</th><th>Clôturé par</th><th>Date clôture</th><th>Action</th></tr></thead>
          <tbody>
            @for (p of periodes; track p.id) {
              <tr>
                <td><strong>{{ p.label }}</strong></td>
                <td>
                  @if (p.statut === 'ouverte') {
                    <span class="badge badge-success">🟢 Ouverte</span>
                  } @else {
                    <span class="badge badge-danger">🔒 Clôturée</span>
                  }
                </td>
                <td style="font-size:12px;color:#64748b">{{ p.cloturePar || '—' }}</td>
                <td style="font-size:12px;color:#64748b">{{ p.clotureDate ? (p.clotureDate | date:'dd/MM/yyyy') : '—' }}</td>
                <td>
                  @if (p.statut === 'cloturee' && isAdmin()) {
                    <button class="btn btn-secondary btn-sm" (click)="rouvrir(p)">🔓 Rouvrir</button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  }

  <!-- JOURNAL CPT-01 -->
  @if (activeTab() === 'journal') {
    <div class="gw-card" style="margin-bottom:16px">
      <div class="card-body">
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
          <div class="form-group" style="margin:0">
            <label style="font-size:12px;color:#64748b">Compte</label>
            <select class="form-control" style="width:180px;height:34px" [(ngModel)]="journalFiltreCompte" (change)="filtrerJournal()">
              <option value="">Tous les comptes</option>
              <option value="caisse_principale">Caisse espèces</option>
              <option value="orange_money">Orange Money</option>
              <option value="wave">Wave</option>
              <option value="moov_money">Moov Money</option>
              <option value="banque">Compte bancaire</option>
            </select>
          </div>
          <div class="form-group" style="margin:0">
            <label style="font-size:12px;color:#64748b">Date début</label>
            <input type="date" class="form-control" style="width:150px;height:34px" [(ngModel)]="journalDateDebut" (change)="filtrerJournal()">
          </div>
          <div class="form-group" style="margin:0">
            <label style="font-size:12px;color:#64748b">Date fin</label>
            <input type="date" class="form-control" style="width:150px;height:34px" [(ngModel)]="journalDateFin" (change)="filtrerJournal()">
          </div>
          <button class="btn btn-secondary btn-sm" (click)="filtrerJournal()">🔍 Filtrer</button>
          <div style="flex:1"></div>
          <button class="btn btn-primary btn-sm" (click)="arreterCaisse()">🖨️ Arrêté de caisse</button>
        </div>
      </div>
    </div>
    <div class="gw-table-wrapper">
      <table class="gw-table">
        <thead>
          <tr>
            <th>Date</th><th>Libellé</th><th>Compte</th>
            <th style="color:#22c55e">Entrée (+)</th>
            <th style="color:#ef4444">Sortie (-)</th>
            <th>Solde cumulatif</th>
          </tr>
        </thead>
        <tbody>
          @for (l of journalFiltered; track $index) {
            <tr [style.background]="l.entree > 0 ? '#f0fdf4' : (l.sortie > 0 ? '#fef2f2' : 'white')">
              <td style="font-size:12px;color:#64748b">{{ l.date | date:'dd/MM/yyyy HH:mm' }}</td>
              <td>{{ l.libelle }}</td>
              <td style="font-size:12px">{{ nomCompte(l.compte) }}</td>
              <td style="font-weight:600;color:#22c55e">{{ l.entree > 0 ? '+ '+(l.entree | number:'1.0-0')+' F' : '—' }}</td>
              <td style="font-weight:600;color:#ef4444">{{ l.sortie > 0 ? '- '+(l.sortie | number:'1.0-0')+' F' : '—' }}</td>
              <td><strong [style.color]="l.solde >= 0 ? '#22c55e' : '#ef4444'">{{ l.solde | number:'1.0-0' }} FCFA</strong></td>
            </tr>
          }
          @if (journalFiltered.length === 0) {
            <tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:28px">Aucun mouvement de trésorerie enregistré</td></tr>
          }
        </tbody>
        <tfoot>
          <tr style="background:#f1f5f9;font-weight:700">
            <td colspan="3" style="text-align:right;padding-right:16px">TOTAUX</td>
            <td style="color:#22c55e">+ {{ totalEntrees() | number:'1.0-0' }} F</td>
            <td style="color:#ef4444">- {{ totalSorties() | number:'1.0-0' }} F</td>
            <td [style.color]="soldeNet() >= 0 ? '#22c55e' : '#ef4444'">{{ soldeNet() | number:'1.0-0' }} FCFA</td>
          </tr>
        </tfoot>
      </table>
    </div>
  }

  <!-- DÉPENSES -->
  @if (activeTab() === 'depenses') {
    <div class="gw-table-wrapper">
      <div class="gw-table-toolbar">
        <div class="toolbar-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#94a3b8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Rechercher une dépense..." [(ngModel)]="searchDepense">
        </div>
        <select class="form-control" style="width:150px;height:34px" [(ngModel)]="filterCategorie">
          <option value="">Toutes catégories</option>
          <option>Matières premières</option>
          <option>Carburant</option>
          <option>Salaires</option>
          <option>Loyer</option>
          <option>Transport</option>
          <option>Électricité</option>
          <option>Entretien / Réparation</option>
          <option>Divers</option>
        </select>
        <div class="toolbar-spacer"></div>
        <strong style="font-size:13px;color:#ef4444">Total : {{ totalDepensesFiltrees() | number:'1.0-0' }} FCFA</strong>
      </div>
      <table class="gw-table">
        <thead>
          <tr><th>Date</th><th>Catégorie</th><th>Description</th><th>Fournisseur</th><th>Compte</th><th>Montant</th><th>Justificatif</th><th>Opérateur</th><th>Actions</th></tr>
        </thead>
        <tbody>
          @for (d of depensesFiltrees(); track d.id) {
            <tr>
              <td style="font-size:12px;color:#64748b">{{ d.createdAt | date:'dd/MM/yyyy' }}</td>
              <td><span class="badge badge-secondary">{{ d.categorie }}</span></td>
              <td>{{ d.description }}</td>
              <td>{{ d.fournisseur || '—' }}</td>
              <td style="font-size:12px">{{ nomCompte(d.compteTresorerie) }}</td>
              <td><strong style="color:#ef4444">{{ d.montant | number:'1.0-0' }} FCFA</strong></td>
              <td>
                @if (d.justificatif) {
                  <a [href]="d.justificatif" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" style="text-decoration:none">📎 Voir</a>
                } @else {
                  <span style="color:#94a3b8;font-size:12px">—</span>
                }
              </td>
              <td style="font-size:12px;color:#64748b">{{ d.operateur }}</td>
              <td>
                <button class="btn btn-ghost btn-sm btn-icon" title="Modifier" (click)="openDepense(d)">✏️</button>
              </td>
            </tr>
          }
          @if (depensesFiltrees().length === 0) {
            <tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:28px">Aucune dépense enregistrée</td></tr>
          }
        </tbody>
      </table>
    </div>
  }

  <!-- RÉSULTAT CPT-07 + CPT-08 -->
  @if (activeTab() === 'resultat') {
    <div class="gw-card" style="margin-bottom:24px">
      <div class="card-header">
        <div>
          <div class="card-title">📊 Compte de résultat — {{ formatPeriodeLabel(selectedPeriode) }}</div>
          <div class="card-subtitle">Marge brute et résultat net calculés depuis Firestore</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <select class="form-control" style="width:170px;height:34px" [(ngModel)]="selectedPeriode" (change)="recomputeResultat()">
            @for (p of availablePeriodes(); track p) {
              <option [value]="p">{{ formatPeriodeLabel(p) }}</option>
            }
          </select>
          <button class="btn btn-secondary btn-sm" (click)="exportResultatPDF()">📄 PDF</button>
        </div>
      </div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px">
          <div style="padding:16px;background:#f0fdf4;border-radius:10px;text-align:center">
            <div style="font-size:11px;color:#64748b;margin-bottom:4px">CA de la période</div>
            <div style="font-size:20px;font-weight:800;color:#22c55e">{{ totalRecettes() | number:'1.0-0' }} F</div>
          </div>
          <div style="padding:16px;background:#fff7ed;border-radius:10px;text-align:center">
            <div style="font-size:11px;color:#64748b;margin-bottom:4px">Marge brute</div>
            <div style="font-size:20px;font-weight:800;color:#f59e0b">{{ margeBrute() | number:'1.0-0' }} F</div>
            <div style="font-size:11px;color:#f59e0b;margin-top:4px">Taux : {{ tauxMarge() | number:'1.1-1' }}%</div>
          </div>
          <div style="padding:16px;background:#eff6ff;border-radius:10px;text-align:center">
            <div style="font-size:11px;color:#64748b;margin-bottom:4px">Résultat net</div>
            <div style="font-size:20px;font-weight:800" [style.color]="resultatNet() >= 0 ? '#3b82f6' : '#ef4444'">{{ resultatNet() | number:'1.0-0' }} F</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
          <div>
            <div style="font-size:13px;font-weight:600;color:#22c55e;margin-bottom:12px">🟢 RECETTES</div>
            @for (r of recettes; track r.label) {
              <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9">
                <span style="font-size:13px">{{ r.label }}</span>
                <strong>{{ r.montant | number:'1.0-0' }} FCFA</strong>
              </div>
            }
            <div style="display:flex;justify-content:space-between;padding:12px;margin-top:4px;background:#f0fdf4;border-radius:8px">
              <strong style="color:#22c55e">TOTAL RECETTES</strong>
              <strong style="color:#22c55e;font-size:16px">{{ totalRecettes() | number:'1.0-0' }} FCFA</strong>
            </div>
          </div>
          <div>
            <div style="font-size:13px;font-weight:600;color:#ef4444;margin-bottom:12px">🔴 CHARGES</div>
            @for (d of charges; track d.label) {
              <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9">
                <span style="font-size:13px">{{ d.label }}</span>
                <strong>{{ d.montant | number:'1.0-0' }} FCFA</strong>
              </div>
            }
            @if (charges.length === 0) {
              <div style="padding:12px 0;color:#94a3b8;font-size:13px">Aucune charge sur cette période</div>
            }
            <div style="display:flex;justify-content:space-between;padding:12px;margin-top:4px;background:#fef2f2;border-radius:8px">
              <strong style="color:#ef4444">TOTAL CHARGES</strong>
              <strong style="color:#ef4444;font-size:16px">{{ totalCharges() | number:'1.0-0' }} FCFA</strong>
            </div>
          </div>
        </div>
        <div style="margin-top:16px;padding:16px;background:linear-gradient(135deg,#0f172a,#1e3a5f);border-radius:12px;display:flex;justify-content:space-between;align-items:center">
          <span style="color:white;font-size:16px;font-weight:700">RÉSULTAT NET DE LA PÉRIODE</span>
          <span [style.color]="resultatNet() >= 0 ? '#4ade80' : '#f87171'" style="font-size:24px;font-weight:800">{{ resultatNet() | number:'1.0-0' }} FCFA</span>
        </div>
      </div>
    </div>
    <!-- CPT-08: Marge par produit -->
    <div class="gw-card">
      <div class="card-header"><div class="card-title">📦 Marge par produit (Coût d'achat)</div></div>
      <div class="card-body" style="padding:0">
        <table class="gw-table">
          <thead>
            <tr><th>Produit</th><th>Qté vendue</th><th>CA</th><th>Coût</th><th>Marge brute</th><th>Taux marge %</th></tr>
          </thead>
          <tbody>
            @for (p of margesProduits; track p.nom) {
              <tr>
                <td><strong>{{ p.nom }}</strong></td>
                <td>{{ p.qte | number:'1.0-0' }}</td>
                <td style="color:#22c55e;font-weight:600">{{ p.ca | number:'1.0-0' }} F</td>
                <td style="color:#ef4444">{{ p.cout | number:'1.0-0' }} F</td>
                <td><strong style="color:#f59e0b">{{ (p.ca - p.cout) | number:'1.0-0' }} F</strong></td>
                <td>
                  <span [class]="'badge ' + ((p.ca > 0 ? (p.ca-p.cout)/p.ca*100 : 0) >= 30 ? 'badge-success' : 'badge-warning')">
                    {{ (p.ca > 0 ? (p.ca - p.cout) / p.ca * 100 : 0) | number:'1.1-1' }}%
                  </span>
                </td>
              </tr>
            }
            @if (margesProduits.length === 0) {
              <tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:24px">Aucune vente sur cette période</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  }

  <!-- CRÉANCES -->
  @if (activeTab() === 'creances') {
    <div class="gw-card">
      <div class="card-header">
        <div class="card-title">⏳ Balance âgée des créances</div>
        <button class="btn btn-secondary btn-sm" (click)="exportBalanceAgeePDF()">📄 Exporter PDF</button>
      </div>
      <div class="card-body" style="padding:0">
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-bottom:1px solid #f1f5f9">
          @for (tranche of tranches; track tranche.label) {
            <div style="padding:16px;text-align:center;border-right:1px solid #f1f5f9">
              <div style="font-size:11px;color:#94a3b8;margin-bottom:8px">{{ tranche.label }}</div>
              <div style="font-size:20px;font-weight:700" [style.color]="tranche.color">{{ tranche.montant | number:'1.0-0' }}</div>
              <div style="font-size:10px;color:#94a3b8">FCFA · {{ tranche.nb }} client(s)</div>
            </div>
          }
        </div>
        <table class="gw-table">
          <thead>
            <tr><th>Client</th><th>Téléphone</th><th>0-30 jours</th><th>31-60 jours</th><th>+60 jours</th><th>Total dû</th><th>Action</th></tr>
          </thead>
          <tbody>
            @for (c of creances; track c.nom) {
              <tr>
                <td><strong>{{ c.nom }}</strong></td>
                <td style="font-size:12px;color:#64748b">{{ c.telephone || '—' }}</td>
                <td [style.color]="c.j30>0?'#f59e0b':'#94a3b8'">{{ c.j30 > 0 ? (c.j30|number:'1.0-0')+' F' : '—' }}</td>
                <td [style.color]="c.j60>0?'#ef4444':'#94a3b8'">{{ c.j60 > 0 ? (c.j60|number:'1.0-0')+' F' : '—' }}</td>
                <td [style.color]="c.j60p>0?'#b91c1c':'#94a3b8'">{{ c.j60p > 0 ? (c.j60p|number:'1.0-0')+' F' : '—' }}</td>
                <td><strong style="color:#ef4444">{{ (c.j30+c.j60+c.j60p) | number:'1.0-0' }} FCFA</strong></td>
                <td><button class="btn btn-warning btn-sm" (click)="relancerWhatsApp(c)">📱 WhatsApp</button></td>
              </tr>
            }
            @if (creances.length === 0) {
              <tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:24px">Aucune créance impayée 🎉</td></tr>
            }
          </tbody>
          <tfoot>
            <tr style="background:#f1f5f9;font-weight:700">
              <td colspan="2">TOTAL GÉNÉRAL</td>
              <td style="color:#f59e0b">{{ totalJ30() | number:'1.0-0' }} F</td>
              <td style="color:#ef4444">{{ totalJ60() | number:'1.0-0' }} F</td>
              <td style="color:#b91c1c">{{ totalJ60p() | number:'1.0-0' }} F</td>
              <td style="color:#ef4444">{{ totalCreances() | number:'1.0-0' }} FCFA</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  }

  <!-- DETTES FOURNISSEURS CPT-04 -->
  @if (activeTab() === 'fournisseurs') {
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px">
      <div class="grid-kpi" style="flex:1;margin:0">
        <div class="kpi-card">
          <div class="kpi-label">Total dettes dues</div>
          <div class="kpi-value" style="color:#ef4444">{{ totalDettesFournisseurs() | number:'1.0-0' }} FCFA</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Factures en cours</div>
          <div class="kpi-value">{{ dettesOuvertesCount() }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Échéances dépassées</div>
          <div class="kpi-value" style="color:#f59e0b">{{ dettesEchuesCount() }}</div>
        </div>
      </div>
      <button class="btn btn-primary" (click)="openNewDette()">+ Nouvelle dette fournisseur</button>
    </div>

    <div class="gw-table-wrapper">
      <table class="gw-table">
        <thead>
          <tr><th>Fournisseur</th><th>Référence</th><th>Description</th><th>Échéance</th><th>Total</th><th>Payé</th><th>Reste dû</th><th>Statut</th><th>Action</th></tr>
        </thead>
        <tbody>
          @for (df of dettesFournisseurs(); track df.id) {
            <tr>
              <td><strong>{{ df.fournisseur }}</strong></td>
              <td style="font-family:monospace;font-size:12px;color:#0ea5e9">{{ df.reference }}</td>
              <td style="font-size:12px">{{ df.description }}</td>
              <td style="font-size:12px" [style.color]="isEchue(df) ? '#ef4444' : '#64748b'">
                {{ df.dateEcheance || '—' }}
                @if (isEchue(df)) { <span class="badge badge-danger" style="margin-left:4px;font-size:10px">Échue</span> }
              </td>
              <td>{{ df.montantTotal | number:'1.0-0' }} F</td>
              <td style="color:#22c55e">{{ df.montantPaye | number:'1.0-0' }} F</td>
              <td><strong [style.color]="df.soldeRestant > 0 ? '#ef4444' : '#22c55e'">{{ df.soldeRestant | number:'1.0-0' }} FCFA</strong></td>
              <td>
                <span class="badge" [class]="df.statut === 'payee' ? 'badge-success' : df.statut === 'partiel' ? 'badge-warning' : 'badge-danger'">
                  {{ df.statut === 'payee' ? 'Payée' : df.statut === 'partiel' ? 'Partiel' : 'Impayée' }}
                </span>
              </td>
              <td>
                @if (df.soldeRestant > 0) {
                  <button class="btn btn-primary btn-sm" (click)="openPayerDette(df)">💳 Régler</button>
                }
              </td>
            </tr>
          }
          @if (dettesFournisseurs().length === 0) {
            <tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:28px">Aucune dette fournisseur enregistrée 🎉</td></tr>
          }
        </tbody>
      </table>
    </div>
  }

  <!-- ARRÊTÉS CPT-06 -->
  @if (activeTab() === 'arretes') {
    <div class="gw-card" style="margin-bottom:24px">
      <div class="card-header"><div class="card-title">🏧 Arrêté de caisse — {{ today }}</div></div>
      <div class="card-body">
        <div class="grid-2">
          <div class="form-group">
            <label>Caisse *</label>
            <select class="form-control" [(ngModel)]="arreteForm.caisse" (ngModelChange)="calcMontantTheorique()">
              <option value="">Sélectionner</option>
              <option value="caisse_principale">Caisse espèces</option>
              <option value="orange_money">Orange Money</option>
              <option value="wave">Wave</option>
              <option value="moov_money">Moov Money</option>
              <option value="banque">Compte bancaire</option>
            </select>
          </div>
          <div class="form-group">
            <label>Montant théorique (système)</label>
            <input type="number" class="form-control" [ngModel]="arreteForm.montantTheorique" readonly style="background:#f8fafc;cursor:not-allowed">
          </div>
          <div class="form-group">
            <label>Montant compté physiquement *</label>
            <input type="number" class="form-control" [(ngModel)]="arreteForm.montantCompte" placeholder="0">
          </div>
          <div class="form-group">
            <label>Écart constaté</label>
            <input type="number" class="form-control"
                   [ngModel]="arreteForm.montantCompte - arreteForm.montantTheorique" readonly
                   [style.color]="(arreteForm.montantCompte - arreteForm.montantTheorique) === 0 ? '#22c55e' : '#ef4444'"
                   style="font-weight:700;cursor:not-allowed">
          </div>
        </div>
        @if ((arreteForm.montantCompte - arreteForm.montantTheorique) !== 0 && arreteForm.montantCompte >= 0) {
          <div class="form-group" style="margin-top:12px">
            <label>Explication de l'écart *</label>
            <input class="form-control" [(ngModel)]="arreteForm.explication" placeholder="Expliquer l'écart constaté...">
          </div>
        }
        <div style="margin-top:16px">
          <button class="btn btn-primary" (click)="validerArrete()" [disabled]="saving()">
            @if (saving()) { <span class="loading-spinner" style="width:16px;height:16px;border-width:2px;margin:0"></span> }
            @else { ✅ Valider l'arrêté }
          </button>
        </div>
      </div>
    </div>
    <div class="gw-card">
      <div class="card-header"><div class="card-title">📋 Historique des arrêtés</div></div>
      <div class="card-body" style="padding:0">
        <table class="gw-table">
          <thead>
            <tr><th>Date</th><th>Caisse</th><th>Théorique</th><th>Compté</th><th>Écart</th><th>Opérateur</th><th>Explication</th></tr>
          </thead>
          <tbody>
            @for (a of arreteHistorique; track a.id) {
              <tr>
                <td style="font-size:12px;color:#64748b">{{ a.date | date:'dd/MM/yyyy HH:mm' }}</td>
                <td>{{ nomCompte(a.caisse) }}</td>
                <td>{{ a.montantTheorique | number:'1.0-0' }} F</td>
                <td>{{ a.montantCompte | number:'1.0-0' }} F</td>
                <td [style.color]="a.ecart === 0 ? '#22c55e' : '#ef4444'">
                  <strong>{{ a.ecart >= 0 ? '+' : '' }}{{ a.ecart | number:'1.0-0' }} F</strong>
                </td>
                <td style="font-size:12px">{{ a.operateur }}</td>
                <td style="font-size:12px;color:#64748b">{{ a.explication || '—' }}</td>
              </tr>
            }
            @if (arreteHistorique.length === 0) {
              <tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:24px">Aucun arrêté enregistré</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  }
</div>

<!-- MODAL DÉPENSE -->
@if (showDepenseModal()) {
  <div class="gw-modal-backdrop" (click)="closeDepense()">
    <div class="gw-modal modal-md" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title">{{ editingDepense ? 'Modifier la dépense' : 'Nouvelle dépense' }}</div>
        <button class="modal-close" (click)="closeDepense()">✕</button>
      </div>
      <div class="modal-body">
        <div class="grid-2">
          <div class="form-group">
            <label>Catégorie *</label>
            <select class="form-control" [(ngModel)]="depForm.categorie">
              <option value="">Sélectionner</option>
              <option>Matières premières</option><option>Électricité</option><option>Carburant</option>
              <option>Salaires</option><option>Entretien / Réparation</option><option>Loyer</option>
              <option>Transport</option><option>Divers</option>
            </select>
          </div>
          <div class="form-group">
            <label>Montant (FCFA) *</label>
            <input type="number" class="form-control" [(ngModel)]="depForm.montant" placeholder="0" min="1">
          </div>
        </div>
        <div class="form-group" style="margin-top:12px">
          <label>Description *</label>
          <input class="form-control" [(ngModel)]="depForm.description" placeholder="Description de la dépense">
        </div>
        <div class="grid-2" style="margin-top:12px">
          <div class="form-group">
            <label>Fournisseur</label>
            <input class="form-control" [(ngModel)]="depForm.fournisseur" placeholder="Nom du fournisseur">
          </div>
          <div class="form-group">
            <label>Compte de trésorerie *</label>
            <select class="form-control" [(ngModel)]="depForm.compteTresorerie">
              <option value="caisse_principale">Caisse principale</option>
              <option value="orange_money">Orange Money</option>
              <option value="wave">Wave</option>
              <option value="moov_money">Moov Money</option>
              <option value="banque">Banque</option>
            </select>
          </div>
        </div>
        <div class="form-group" style="margin-top:12px">
          <label>Pièce justificative (photo / PDF, max 5 Mo)</label>
          <input type="file" class="form-control" accept="image/*,.pdf" (change)="onJustificatifSelected($event)" style="padding:6px">
          @if (selectedJustificatifFile) {
            <span class="form-hint" style="color:#0ea5e9">📎 Fichier sélectionné : {{ selectedJustificatifFile.name }}</span>
          } @else if (depForm.justificatif) {
            <span class="form-hint"><a [href]="depForm.justificatif" target="_blank" rel="noopener">📎 Justificatif actuel</a></span>
          }
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" (click)="closeDepense()">Annuler</button>
        <button class="btn btn-primary" (click)="saveDepense()" [disabled]="saving()">
          @if (saving()) { <span class="loading-spinner" style="width:16px;height:16px;border-width:2px;margin:0"></span> }
          @else { {{ editingDepense ? 'Mettre à jour' : 'Enregistrer la dépense' }} }
        </button>
      </div>
    </div>
  </div>
}

<!-- MODAL DETTE FOURNISSEUR CPT-04 -->
@if (showDetteModal()) {
  <div class="gw-modal-backdrop" (click)="showDetteModal.set(false)">
    <div class="gw-modal modal-md" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title">📑 Nouvelle dette fournisseur</div>
        <button class="modal-close" (click)="showDetteModal.set(false)">✕</button>
      </div>
      <form [formGroup]="detteForm" (ngSubmit)="saveDette()">
        <div class="modal-body">
          <div class="grid-2">
            <div class="form-group">
              <label>Fournisseur *</label>
              <input class="form-control" formControlName="fournisseur" placeholder="Nom du fournisseur">
            </div>
            <div class="form-group">
              <label>Référence facture *</label>
              <input class="form-control" formControlName="reference" placeholder="Ex: F-2026-014">
            </div>
            <div class="form-group">
              <label>Montant total (FCFA) *</label>
              <input type="number" class="form-control" formControlName="montantTotal" min="1">
            </div>
            <div class="form-group">
              <label>Date d'échéance *</label>
              <input type="date" class="form-control" formControlName="dateEcheance">
            </div>
          </div>
          <div class="form-group" style="margin-top:12px">
            <label>Description *</label>
            <input class="form-control" formControlName="description" placeholder="Ex: Achat préformes / bouchons / étiquettes">
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" (click)="showDetteModal.set(false)">Annuler</button>
          <button type="submit" class="btn btn-primary" [disabled]="saving() || detteForm.invalid">
            {{ saving() ? 'Enregistrement...' : 'Enregistrer la dette' }}
          </button>
        </div>
      </form>
    </div>
  </div>
}

<!-- MODAL RÈGLEMENT DETTE FOURNISSEUR -->
@if (showPayerDetteModal() && selectedDette()) {
  <div class="gw-modal-backdrop" (click)="showPayerDetteModal.set(false)">
    <div class="gw-modal modal-sm" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title">💳 Régler la dette</div>
        <button class="modal-close" (click)="showPayerDetteModal.set(false)">✕</button>
      </div>
      <div class="modal-body">
        <div style="background:#f8fafc;border-radius:8px;padding:12px;margin-bottom:14px">
          <div style="font-weight:700">{{ selectedDette()!.fournisseur }}</div>
          <div style="font-size:12px;color:#64748b">Réf. {{ selectedDette()!.reference }} · Reste : <strong style="color:#ef4444">{{ selectedDette()!.soldeRestant | number:'1.0-0' }} FCFA</strong></div>
        </div>
        <div class="form-group" style="margin-bottom:12px">
          <label>Montant réglé (FCFA) *</label>
          <input type="number" class="form-control" [(ngModel)]="dettePaiementMontant" min="1" [max]="selectedDette()!.soldeRestant">
        </div>
        <div class="form-group">
          <label>Compte de trésorerie *</label>
          <select class="form-control" [(ngModel)]="dettePaiementCompte">
            <option value="caisse_principale">Caisse principale</option>
            <option value="orange_money">Orange Money</option>
            <option value="wave">Wave</option>
            <option value="banque">Banque</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" (click)="showPayerDetteModal.set(false)">Annuler</button>
        <button class="btn btn-primary" (click)="confirmerPaiementDette()" [disabled]="saving() || dettePaiementMontant <= 0">
          {{ saving() ? 'Validation...' : 'Confirmer le règlement' }}
        </button>
      </div>
    </div>
  </div>
}

<!-- MODAL TRANSFERT CPT-05 -->
@if (showTransfertModal()) {
  <div class="gw-modal-backdrop" (click)="closeTransfert()">
    <div class="gw-modal modal-md" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title">🔄 Transfert entre comptes</div>
        <button class="modal-close" (click)="closeTransfert()">✕</button>
      </div>
      <div class="modal-body">
        <div class="grid-2">
          <div class="form-group">
            <label>Compte source *</label>
            <select class="form-control" [(ngModel)]="transfertForm.source">
              <option value="">Sélectionner</option>
              @for (c of comptes; track c.key) {
                <option [value]="c.key">{{ c.nom }} ({{ c.solde | number:'1.0-0' }} F)</option>
              }
            </select>
          </div>
          <div class="form-group">
            <label>Compte destination *</label>
            <select class="form-control" [(ngModel)]="transfertForm.destination">
              <option value="">Sélectionner</option>
              @for (c of comptes; track c.key) {
                <option [value]="c.key" [disabled]="c.key === transfertForm.source">{{ c.nom }}</option>
              }
            </select>
          </div>
        </div>
        <div class="form-group" style="margin-top:12px">
          <label>Montant (FCFA) *</label>
          <input type="number" class="form-control" [(ngModel)]="transfertForm.montant" placeholder="0">
          @if (transfertForm.source) {
            <span class="form-hint">Solde disponible : {{ soldePour(transfertForm.source) | number:'1.0-0' }} FCFA</span>
          }
        </div>
        <div class="form-group" style="margin-top:12px">
          <label>Motif</label>
          <input class="form-control" [(ngModel)]="transfertForm.motif" placeholder="Motif du transfert">
        </div>
        @if (erreurTransfert) {
          <div class="gw-alert alert-danger" style="margin-top:12px">
            <span class="alert-icon">❌</span>
            <div class="alert-content">{{ erreurTransfert }}</div>
          </div>
        }
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" (click)="closeTransfert()">Annuler</button>
        <button class="btn btn-primary" (click)="saveTransfert()" [disabled]="saving()">
          @if (saving()) { <span class="loading-spinner" style="width:16px;height:16px;border-width:2px;margin:0"></span> }
          @else { Effectuer le transfert }
        </button>
      </div>
    </div>
  </div>
}

<!-- MODAL CLÔTURE CPT-09 -->
@if (showClotureModal()) {
  <div class="gw-modal-backdrop" (click)="closeCloture()">
    <div class="gw-modal modal-md" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title">🔒 Clôture de la période</div>
        <button class="modal-close" (click)="closeCloture()">✕</button>
      </div>
      <div class="modal-body">
        <div class="gw-alert alert-warning">
          <span class="alert-icon">⚠️</span>
          <div class="alert-content">
            <div class="alert-title">Attention</div>
            Après clôture, aucune écriture ne pourra être modifiée pour la période <strong>{{ currentMonth }}</strong>.
          </div>
        </div>
        <div class="form-group" style="margin-top:16px">
          <label>Confirmez en saisissant le nom du mois :</label>
          <input class="form-control" [(ngModel)]="confirmationCloture" [placeholder]="'Tapez : ' + currentMonth">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" (click)="closeCloture()">Annuler</button>
        <button class="btn btn-danger" (click)="confirmerCloture()"
                [disabled]="confirmationCloture.trim().toLowerCase() !== currentMonth.toLowerCase()">
          🔒 Confirmer la clôture
        </button>
      </div>
    </div>
  </div>
}

<!-- MODAL RÉOUVERTURE -->
@if (showReouvModal()) {
  <div class="gw-modal-backdrop" (click)="closeReouv()">
    <div class="gw-modal modal-md" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title">🔓 Réouverture de période</div>
        <button class="modal-close" (click)="closeReouv()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Motif de réouverture *</label>
          <input class="form-control" [(ngModel)]="motifReouverture" placeholder="Expliquer la raison de la réouverture">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" (click)="closeReouv()">Annuler</button>
        <button class="btn btn-warning" (click)="confirmerReouverture()" [disabled]="!motifReouverture.trim()">
          🔓 Rouvrir la période
        </button>
      </div>
    </div>
  </div>
}
  `
})
export class ComptabiliteComponent implements OnInit {
  dataService = inject(DataService);
  toastService = inject(ToastService);
  authService = inject(AuthService);
  private waService = inject(WhatsappService);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  depenses = signal<Depense[]>([]);
  dettesFournisseurs = signal<DetteFournisseur[]>([]);
  saving = signal(false);
  showDepenseModal = signal(false);
  showDetteModal = signal(false);
  showPayerDetteModal = signal(false);
  selectedDette = signal<DetteFournisseur | null>(null);
  showTransfertModal = signal(false);
  showClotureModal = signal(false);
  showReouvModal = signal(false);
  activeTab = signal('tresorerie');

  editingDepense: Depense | null = null;
  selectedJustificatifFile: File | null = null;
  dettePaiementMontant = 0;
  dettePaiementCompte = 'caisse_principale';

  detteForm = this.fb.group({
    fournisseur: ['', [Validators.required]],
    reference: ['', [Validators.required]],
    description: ['', [Validators.required]],
    montantTotal: [0, [Validators.required, Validators.min(1)]],
    dateEcheance: ['', [Validators.required]],
  });

  private currentMonthKey = new Date().toISOString().slice(0, 7);
  currentMonth = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  tabs = [
    { id: 'tresorerie', label: 'Trésorerie', icon: '💳' },
    { id: 'journal', label: 'Journal', icon: '📒' },
    { id: 'depenses', label: 'Dépenses', icon: '💸' },
    { id: 'resultat', label: 'Résultat', icon: '📊' },
    { id: 'creances', label: 'Créances', icon: '⏳' },
    { id: 'fournisseurs', label: 'Fournisseurs', icon: '📑' },
    { id: 'arretes', label: 'Arrêtés', icon: '🏧' },
  ];

  comptes = [
    { key: 'caisse_principale', nom: 'Caisse espèces', solde: 0, icon: '💵', bg: '#f0fdf4' },
    { key: 'orange_money', nom: 'Orange Money', solde: 0, icon: '🟠', bg: '#fff7ed' },
    { key: 'wave', nom: 'Wave', solde: 0, icon: '🌊', bg: '#eff6ff' },
    { key: 'moov_money', nom: 'Moov Money', solde: 0, icon: '🟣', bg: '#faf5ff' },
    { key: 'banque', nom: 'Compte bancaire', solde: 0, icon: '🏦', bg: '#f5f3ff' },
  ];

  recettes: { label: string; montant: number }[] = [
    { label: 'Ventes au comptant', montant: 0 },
    { label: 'Encaissements crédit / acompte', montant: 0 },
  ];
  charges: { label: string; montant: number }[] = [];
  margesProduits: { nom: string; qte: number; ca: number; cout: number }[] = [];

  tranches = [
    { label: 'Total créances', montant: 0, nb: 0, color: '#ef4444' },
    { label: '0–30 jours', montant: 0, nb: 0, color: '#f59e0b' },
    { label: '31–60 jours', montant: 0, nb: 0, color: '#ef4444' },
    { label: '+60 jours', montant: 0, nb: 0, color: '#b91c1c' },
  ];
  creances: { id?: string; nom: string; telephone: string; whatsapp?: string; j30: number; j60: number; j60p: number }[] = [];
  periodes: PeriodeComptable[] = [];

  journalLignes: JournalLigne[] = [];
  journalFiltered: JournalLigne[] = [];
  journalFiltreCompte = '';
  journalDateDebut = '';
  journalDateFin = '';

  transfertForm: TransfertForm = { source: '', destination: '', montant: 0, motif: '' };
  erreurTransfert = '';

  arreteForm: ArreteForm = { caisse: '', montantTheorique: 0, montantCompte: 0, explication: '' };
  arreteHistorique: ArreteHistorique[] = [];

  confirmationCloture = '';
  motifReouverture = '';
  periodeARouvrir: PeriodeComptable | null = null;

  selectedPeriode = this.currentMonthKey;
  searchDepense = '';
  filterCategorie = '';
  depForm: Partial<Depense> = this.defaultDepForm();

  private rawVentes: Vente[] = [];
  private rawPaiements: Paiement[] = [];
  private rawDepenses: Depense[] = [];
  private rawTransferts: any[] = [];
  private rawProduits: Produit[] = [];
  private rawClients: Client[] = [];

  defaultDepForm(): Partial<Depense> {
    return { categorie: '', montant: 0, description: '', fournisseur: '', compteTresorerie: 'caisse_principale' };
  }

  private toDate(val: any): Date {
    if (val instanceof Date) return val;
    if (val?.toDate) return val.toDate();
    return val ? new Date(val) : new Date();
  }

  formatPeriodeLabel(ym: string): string {
    if (!ym || !ym.includes('-')) return ym || this.currentMonth;
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, (m || 1) - 1, 1);
    const str = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  availablePeriodes(): string[] {
    const set = new Set<string>([this.currentMonthKey]);
    this.periodes.forEach(p => set.add(p.mois));
    this.rawVentes.forEach(v => set.add(this.toDate(v.createdAt).toISOString().slice(0, 7)));
    this.rawDepenses.forEach(d => { if (d.periode) set.add(d.periode); });
    return Array.from(set).sort().reverse();
  }

  ngOnInit() {
    this.dataService.initPeriodeIfMissing(this.currentMonthKey).catch(() => {});

    this.dataService.getVentes().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(ventes => {
        this.rawVentes = ventes.map(v => ({ ...v, createdAt: this.toDate(v.createdAt) }));
        this.recomputeResultat();
        this.recomputeCreances();
        this.rebuildTresorerieEtJournal();
        this.cdr.markForCheck();
      });

    this.dataService.getPaiements().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(paiements => {
        this.rawPaiements = paiements.map(p => ({ ...p, createdAt: this.toDate(p.createdAt) }));
        this.rebuildTresorerieEtJournal();
        this.cdr.markForCheck();
      });

    this.dataService.getDepenses().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(depenses => {
        this.rawDepenses = depenses.map(d => ({ ...d, createdAt: this.toDate(d.createdAt) }));
        this.depenses.set(this.rawDepenses);
        this.recomputeResultat();
        this.rebuildTresorerieEtJournal();
        this.cdr.markForCheck();
      });

    this.dataService.getTransferts().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(transferts => {
        this.rawTransferts = transferts;
        this.rebuildTresorerieEtJournal();
        this.cdr.markForCheck();
      });

    this.dataService.getProduits().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(produits => {
        this.rawProduits = produits;
        this.recomputeResultat();
        this.cdr.markForCheck();
      });

    this.dataService.getClients().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(clients => {
        this.rawClients = clients;
        this.recomputeCreances();
        this.cdr.markForCheck();
      });

    this.dataService.getPeriodes().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => {
        this.periodes = data.map((p: any) => {
          const mois = p.periode || p.id;
          return {
            id: p.id || mois,
            mois,
            label: this.formatPeriodeLabel(mois),
            statut: p.statut || 'ouverte',
            cloturePar: p.cloturePar,
            clotureDate: p.clotureAt?.toDate ? p.clotureAt.toDate() : p.clotureAt,
            motifReouverture: p.rouvertureMotif,
          };
        });
        this.cdr.markForCheck();
      });

    this.dataService.getArretesCaisse().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => {
        this.arreteHistorique = data.map((a: any) => ({
          id: a.id,
          caisse: a.caisse,
          date: this.toDate(a.createdAt || a.date),
          montantTheorique: a.montantTheorique || 0,
          montantCompte: a.montantCompte || 0,
          ecart: a.ecart || 0,
          explication: a.explication || '',
          operateur: a.operateur || '—',
        }));
        this.cdr.markForCheck();
      });

    this.dataService.getDettesFournisseurs().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => {
        this.dettesFournisseurs.set(data);
        this.cdr.markForCheck();
      });
  }

  private rebuildTresorerieEtJournal() {
    const soldes: Record<string, number> = {
      caisse_principale: 0, orange_money: 0, wave: 0, moov_money: 0, banque: 0
    };
    const raw: Omit<JournalLigne, 'solde'>[] = [];

    for (const p of this.rawPaiements) {
      const compte = p.compteTresorerie || this.dataService.compteFromMoyen(p.moyen);
      soldes[compte] = (soldes[compte] || 0) + (p.montant || 0);
      const v = this.rawVentes.find(vt => vt.id === p.venteId);
      raw.push({
        date: this.toDate(p.createdAt),
        libelle: `Encaissement ${v ? v.numero + ' — ' + v.clientNom : p.venteId}`,
        entree: p.montant || 0,
        sortie: 0,
        compte,
      });
    }

    for (const d of this.rawDepenses) {
      const compte = d.compteTresorerie || 'caisse_principale';
      soldes[compte] = (soldes[compte] || 0) - (d.montant || 0);
      raw.push({
        date: this.toDate(d.createdAt),
        libelle: `Dépense (${d.categorie}) — ${d.description}`,
        entree: 0,
        sortie: d.montant || 0,
        compte,
      });
    }

    for (const t of this.rawTransferts) {
      const m = t.montant || 0;
      const dt = this.toDate(t.createdAt);
      if (t.source) {
        soldes[t.source] = (soldes[t.source] || 0) - m;
        raw.push({
          date: dt,
          libelle: `Transfert vers ${this.nomCompte(t.destination)}${t.motif ? ' : ' + t.motif : ''}`,
          entree: 0,
          sortie: m,
          compte: t.source,
        });
      }
      if (t.destination) {
        soldes[t.destination] = (soldes[t.destination] || 0) + m;
        raw.push({
          date: dt,
          libelle: `Transfert depuis ${this.nomCompte(t.source)}${t.motif ? ' : ' + t.motif : ''}`,
          entree: m,
          sortie: 0,
          compte: t.destination,
        });
      }
    }

    this.comptes.forEach(c => c.solde = soldes[c.key] || 0);

    raw.sort((a, b) => a.date.getTime() - b.date.getTime());
    let solde = 0;
    this.journalLignes = raw.map(l => {
      solde = solde + l.entree - l.sortie;
      return { ...l, solde };
    });
    this.filtrerJournal();
  }

  recomputeResultat() {
    const mois = this.selectedPeriode || this.currentMonthKey;
    const ventesMois = this.rawVentes.filter(v =>
      v.statut !== 'annulee' && this.toDate(v.createdAt).toISOString().slice(0, 7) === mois
    );

    const caComptant = ventesMois.filter(v => v.typeVente === 'comptant').reduce((s, v) => s + (v.total || 0), 0);
    const caCredit = ventesMois.filter(v => v.typeVente !== 'comptant').reduce((s, v) => s + (v.total || 0), 0);
    this.recettes = [
      { label: 'Ventes au comptant', montant: caComptant },
      { label: 'Ventes crédit / acompte', montant: caCredit },
    ];

    const depMois = this.rawDepenses.filter(d => d.periode === mois);
    const grouped: Record<string, number> = {};
    depMois.forEach(d => { grouped[d.categorie] = (grouped[d.categorie] || 0) + (d.montant || 0); });
    this.charges = Object.entries(grouped).map(([label, montant]) => ({ label, montant }));

    // Marges par produit
    const prodMap: Record<string, { nom: string; qte: number; ca: number; cout: number }> = {};
    for (const v of ventesMois) {
      for (const l of v.lignes || []) {
        const prod = this.rawProduits.find(p => p.id === l.produitId);
        const key = l.produitId || l.produitNom;
        if (!prodMap[key]) {
          prodMap[key] = { nom: l.produitNom || prod?.nom || 'Produit', qte: 0, ca: 0, cout: 0 };
        }
        prodMap[key].qte += l.quantite || 0;
        prodMap[key].ca += l.total || 0;
        prodMap[key].cout += (l.quantite || 0) * (prod?.coutAchat || 0);
      }
    }
    this.margesProduits = Object.values(prodMap).sort((a, b) => b.ca - a.ca);
  }

  private recomputeCreances() {
    const now = Date.now();
    const map: Record<string, { id?: string; nom: string; telephone: string; whatsapp?: string; j30: number; j60: number; j60p: number }> = {};
    const impayees = this.rawVentes.filter(v => v.statut !== 'annulee' && (v.soldeRestant || 0) > 0);

    for (const v of impayees) {
      const client = this.rawClients.find(c => c.id === v.clientId);
      const key = v.clientId || v.clientNom;
      if (!map[key]) {
        map[key] = {
          id: client?.id || v.clientId,
          nom: client?.nom || v.clientNom,
          telephone: client?.telephone || '',
          whatsapp: client?.whatsapp,
          j30: 0, j60: 0, j60p: 0
        };
      }
      const days = Math.floor((now - this.toDate(v.createdAt).getTime()) / 86400000);
      if (days <= 30) map[key].j30 += v.soldeRestant;
      else if (days <= 60) map[key].j60 += v.soldeRestant;
      else map[key].j60p += v.soldeRestant;
    }

    this.creances = Object.values(map).sort((a, b) => (b.j30 + b.j60 + b.j60p) - (a.j30 + a.j60 + a.j60p));
    this.tranches = [
      { label: 'Total créances', montant: this.totalCreances(), nb: this.creances.length, color: '#ef4444' },
      { label: '0–30 jours', montant: this.totalJ30(), nb: this.creances.filter(c => c.j30 > 0).length, color: '#f59e0b' },
      { label: '31–60 jours', montant: this.totalJ60(), nb: this.creances.filter(c => c.j60 > 0).length, color: '#ef4444' },
      { label: '+60 jours', montant: this.totalJ60p(), nb: this.creances.filter(c => c.j60p > 0).length, color: '#b91c1c' },
    ];
  }

  filtrerJournal() {
    let result = [...this.journalLignes];
    if (this.journalFiltreCompte) result = result.filter(l => l.compte === this.journalFiltreCompte);
    if (this.journalDateDebut) result = result.filter(l => l.date >= new Date(this.journalDateDebut));
    if (this.journalDateFin) result = result.filter(l => l.date <= new Date(this.journalDateFin + 'T23:59:59'));
    let running = 0;
    this.journalFiltered = result.map(l => {
      running = running + l.entree - l.sortie;
      return { ...l, solde: running };
    });
  }

  totalEntrees() { return this.journalFiltered.reduce((s, l) => s + l.entree, 0); }
  totalSorties() { return this.journalFiltered.reduce((s, l) => s + l.sortie, 0); }
  soldeNet() { return this.totalEntrees() - this.totalSorties(); }
  totalRecettes() { return this.recettes.reduce((s, r) => s + r.montant, 0); }
  totalCharges() { return this.charges.reduce((s, c) => s + c.montant, 0); }
  margeBrute() { return this.totalRecettes() - this.margesProduits.reduce((s, p) => s + p.cout, 0); }
  tauxMarge() { const ca = this.totalRecettes(); return ca > 0 ? (this.margeBrute() / ca) * 100 : 0; }
  resultatNet() { return this.totalRecettes() - this.totalCharges(); }
  totalJ30() { return this.creances.reduce((s, c) => s + c.j30, 0); }
  totalJ60() { return this.creances.reduce((s, c) => s + c.j60, 0); }
  totalJ60p() { return this.creances.reduce((s, c) => s + c.j60p, 0); }
  totalCreances() { return this.totalJ30() + this.totalJ60() + this.totalJ60p(); }

  depensesFiltrees(): Depense[] {
    return this.depenses().filter(d => {
      const ms = !this.searchDepense || d.description.toLowerCase().includes(this.searchDepense.toLowerCase()) || (d.fournisseur || '').toLowerCase().includes(this.searchDepense.toLowerCase());
      const mc = !this.filterCategorie || d.categorie === this.filterCategorie;
      return ms && mc;
    });
  }
  totalDepensesFiltrees() { return this.depensesFiltrees().reduce((s, d) => s + d.montant, 0); }
  nomCompte(key: string): string { const c = this.comptes.find(c => c.key === key); return c ? c.nom : key; }
  soldePour(key: string): number { const c = this.comptes.find(c => c.key === key); return c ? c.solde : 0; }
  isAdmin() { const r = this.authService.currentUser?.role; return r === 'admin' || r === 'superadmin'; }
  canCloture() { const r = this.authService.currentUser?.role; return r === 'admin' || r === 'superadmin' || r === 'comptable'; }

  openDepense(dep?: Depense) {
    this.editingDepense = dep || null;
    this.selectedJustificatifFile = null;
    this.depForm = dep ? { ...dep } : this.defaultDepForm();
    this.showDepenseModal.set(true);
  }
  closeDepense() {
    this.showDepenseModal.set(false);
    this.editingDepense = null;
    this.selectedJustificatifFile = null;
  }

  onJustificatifSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    if (file && file.size > 5 * 1024 * 1024) {
      this.toastService.error('Le justificatif ne doit pas dépasser 5 Mo.');
      input.value = '';
      this.selectedJustificatifFile = null;
      return;
    }
    this.selectedJustificatifFile = file;
  }

  async saveDepense() {
    if (!this.depForm.categorie || !this.depForm.montant || !this.depForm.description) {
      this.toastService.error('Catégorie, montant et description sont obligatoires.'); return;
    }
    this.saving.set(true);
    try {
      let justificatifUrl = this.depForm.justificatif;
      if (this.selectedJustificatifFile) {
        try {
          justificatifUrl = await this.dataService.uploadJustificatif(this.selectedJustificatifFile, 'justificatifs');
        } catch (uploadErr: any) {
          console.warn('Upload justificatif ignoré:', uploadErr);
          this.toastService.warning('Cloud Storage non disponible : dépense enregistrée sans pièce jointe.');
        }
      }

      if (this.editingDepense?.id) {
        await this.dataService.updateDepense(this.editingDepense.id, {
          categorie: this.depForm.categorie,
          montant: this.depForm.montant,
          description: this.depForm.description,
          fournisseur: this.depForm.fournisseur || '',
          compteTresorerie: this.depForm.compteTresorerie,
          justificatif: justificatifUrl,
        });
        void this.dataService.logAudit(
          'DEPENSE_MODIFIEE',
          `Dépense ${this.depForm.categorie}`,
          `${this.depForm.description} — ${(this.depForm.montant || 0).toLocaleString('fr-FR')} FCFA`,
          this.authService.currentUser?.uid || '',
          this.authService.currentUser?.displayName || ''
        );
        this.toastService.success('Dépense mise à jour avec succès !');
      } else {
        await this.dataService.addDepense({
          ...this.depForm as Depense,
          justificatif: justificatifUrl,
          periode: new Date().toISOString().slice(0, 7),
          createdAt: new Date(),
          operateur: this.authService.currentUser?.displayName || 'Inconnu'
        });
        void this.dataService.logAudit(
          'DEPENSE_CREEE',
          `Dépense ${this.depForm.categorie}`,
          `${this.depForm.description} — ${(this.depForm.montant || 0).toLocaleString('fr-FR')} FCFA`,
          this.authService.currentUser?.uid || '',
          this.authService.currentUser?.displayName || ''
        );
        this.toastService.success('Dépense enregistrée avec succès !');
      }
      this.closeDepense();
    } catch (err: any) {
      const msg: string = err?.message || '';
      if (msg.startsWith('PERIODE_CLOTUREE:')) {
        this.toastService.error(`Période comptable ${msg.split(':')[1]} clôturée : aucune dépense autorisée.`);
      } else {
        this.toastService.error('Erreur lors de l\'enregistrement.');
      }
    }
    finally { this.saving.set(false); }
  }

  // ── CPT-04: Dettes fournisseurs ───────────────────────
  totalDettesFournisseurs() { return this.dettesFournisseurs().reduce((s, d) => s + (d.soldeRestant || 0), 0); }
  dettesOuvertesCount() { return this.dettesFournisseurs().filter(d => (d.soldeRestant || 0) > 0).length; }
  isEchue(d: DetteFournisseur): boolean {
    if (!d.dateEcheance || (d.soldeRestant || 0) <= 0) return false;
    return new Date(d.dateEcheance) < new Date(new Date().toDateString());
  }
  dettesEchuesCount() { return this.dettesFournisseurs().filter(d => this.isEchue(d)).length; }

  openNewDette() {
    this.detteForm.reset({ fournisseur: '', reference: '', description: '', montantTotal: 0, dateEcheance: '' });
    this.showDetteModal.set(true);
  }

  async saveDette() {
    if (this.detteForm.invalid) return;
    const v = this.detteForm.value;
    this.saving.set(true);
    try {
      const montant = Number(v.montantTotal || 0);
      await this.dataService.addDetteFournisseur({
        fournisseur: v.fournisseur!.trim(),
        reference: v.reference!.trim(),
        description: v.description!.trim(),
        montantTotal: montant,
        montantPaye: 0,
        soldeRestant: montant,
        dateEcheance: v.dateEcheance!,
        statut: 'impayee',
        operateur: this.authService.currentUser?.displayName || 'Comptable',
      });
      this.toastService.success('Dette fournisseur enregistrée.');
      this.showDetteModal.set(false);
    } catch {
      this.toastService.error('Erreur lors de l\'enregistrement de la dette.');
    } finally {
      this.saving.set(false);
    }
  }

  openPayerDette(d: DetteFournisseur) {
    this.selectedDette.set(d);
    this.dettePaiementMontant = d.soldeRestant;
    this.dettePaiementCompte = 'caisse_principale';
    this.showPayerDetteModal.set(true);
  }

  async confirmerPaiementDette() {
    const d = this.selectedDette();
    if (!d || this.dettePaiementMontant <= 0) return;
    this.saving.set(true);
    try {
      await this.dataService.payerDetteFournisseur(d, this.dettePaiementMontant, this.dettePaiementCompte);
      this.toastService.success(`Règlement de ${this.dettePaiementMontant.toLocaleString('fr-FR')} FCFA enregistré.`);
      this.showPayerDetteModal.set(false);
    } catch {
      this.toastService.error('Erreur lors du règlement fournisseur.');
    } finally {
      this.saving.set(false);
    }
  }

  openTransfert() { this.transfertForm = { source: '', destination: '', montant: 0, motif: '' }; this.erreurTransfert = ''; this.showTransfertModal.set(true); }
  closeTransfert() { this.showTransfertModal.set(false); }

  async saveTransfert() {
    this.erreurTransfert = '';
    if (!this.transfertForm.source || !this.transfertForm.destination) { this.erreurTransfert = 'Veuillez sélectionner les deux comptes.'; return; }
    if (this.transfertForm.source === this.transfertForm.destination) { this.erreurTransfert = 'Les comptes doivent être différents.'; return; }
    if (!this.transfertForm.montant || this.transfertForm.montant <= 0) { this.erreurTransfert = 'Le montant doit être > 0.'; return; }
    const solde = this.soldePour(this.transfertForm.source);
    if (this.transfertForm.montant > solde) { this.erreurTransfert = `Solde insuffisant (${solde.toLocaleString('fr-FR')} FCFA disponibles).`; return; }
    this.saving.set(true);
    try {
      await this.dataService.addTransfert({
        source: this.transfertForm.source,
        destination: this.transfertForm.destination,
        montant: this.transfertForm.montant,
        motif: this.transfertForm.motif,
        userId: this.authService.currentUser?.uid || 'unknown'
      });
      this.toastService.success(`Transfert de ${this.transfertForm.montant.toLocaleString('fr-FR')} FCFA effectué !`);
      this.closeTransfert();
    } catch { this.toastService.error('Erreur lors du transfert.'); }
    finally { this.saving.set(false); }
  }

  calcMontantTheorique() {
    const c = this.comptes.find(c => c.key === this.arreteForm.caisse);
    this.arreteForm.montantTheorique = c ? c.solde : 0;
    this.arreteForm.montantCompte = 0;
    this.arreteForm.explication = '';
  }

  async validerArrete() {
    if (!this.arreteForm.caisse) { this.toastService.error('Sélectionnez une caisse.'); return; }
    if (this.arreteForm.montantCompte < 0) { this.toastService.error('Montant compté invalide.'); return; }
    const ecart = this.arreteForm.montantCompte - this.arreteForm.montantTheorique;
    if (ecart !== 0 && !this.arreteForm.explication.trim()) { this.toastService.error('Explication requise pour l\'écart.'); return; }
    this.saving.set(true);
    try {
      await this.dataService.saveArrete({
        caisse: this.arreteForm.caisse,
        montantTheorique: this.arreteForm.montantTheorique,
        montantCompte: this.arreteForm.montantCompte,
        ecart,
        explication: this.arreteForm.explication,
        operateur: this.authService.currentUser?.displayName || 'Inconnu',
        userId: this.authService.currentUser?.uid || 'unknown'
      });
      this.toastService.success('Arrêté de caisse validé !');
      this.arreteForm = { caisse: '', montantTheorique: 0, montantCompte: 0, explication: '' };
    } catch { this.toastService.error('Erreur lors de la validation.'); }
    finally { this.saving.set(false); }
  }

  ouvrirCloture() { this.confirmationCloture = ''; this.showClotureModal.set(true); }
  closeCloture() { this.showClotureModal.set(false); }

  async confirmerCloture() {
    const p = this.periodes.find(p => p.statut === 'ouverte') || { id: this.currentMonthKey, label: this.currentMonth };
    const userId = this.authService.currentUser?.displayName || 'Inconnu';
    try {
      await this.dataService.cloturerPeriode(p.id, userId);
      this.toastService.success(`Période ${p.label} clôturée avec succès !`);
    } catch {
      this.toastService.error('Erreur lors de la clôture.');
    }
    this.closeCloture();
  }

  rouvrir(p: PeriodeComptable) { this.periodeARouvrir = p; this.motifReouverture = ''; this.showReouvModal.set(true); }
  closeReouv() { this.showReouvModal.set(false); this.periodeARouvrir = null; }

  async confirmerReouverture() {
    if (!this.periodeARouvrir) return;
    const userId = this.authService.currentUser?.displayName || 'Inconnu';
    try {
      await this.dataService.rouvrirPeriode(this.periodeARouvrir.id, this.motifReouverture, userId);
      this.toastService.success(`Période ${this.periodeARouvrir.label} réouverte. Motif journalisé.`);
    } catch {
      this.toastService.error('Erreur lors de la réouverture.');
    }
    this.closeReouv();
  }

  arreterCaisse() {
    const rows = this.journalFiltered.map(l => `<tr style="background:${l.entree > 0 ? '#f0fdf4' : (l.sortie > 0 ? '#fef2f2' : 'white')}"><td>${new Date(l.date).toLocaleDateString('fr-FR')}</td><td>${l.libelle}</td><td>${this.nomCompte(l.compte)}</td><td style="color:green">${l.entree > 0 ? '+ ' + l.entree.toLocaleString('fr-FR') + ' F' : '—'}</td><td style="color:red">${l.sortie > 0 ? '- ' + l.sortie.toLocaleString('fr-FR') + ' F' : '—'}</td><td>${l.solde.toLocaleString('fr-FR')} FCFA</td></tr>`).join('');
    const html = `<!DOCTYPE html><html><head><title>Arrêté de caisse</title><style>body{font-family:Arial,sans-serif;font-size:12px}h1{text-align:center}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 10px}th{background:#f1f5f9}tfoot td{font-weight:700}</style></head><body><h1>ARRÊTÉ DE CAISSE — ${this.currentMonth.toUpperCase()}</h1><p>Généré le ${new Date().toLocaleDateString('fr-FR')} par ${this.authService.currentUser?.displayName || 'Inconnu'}</p><table><thead><tr><th>Date</th><th>Libellé</th><th>Compte</th><th>Entrée</th><th>Sortie</th><th>Solde</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="3" style="text-align:right">TOTAUX</td><td style="color:green">+ ${this.totalEntrees().toLocaleString('fr-FR')} F</td><td style="color:red">- ${this.totalSorties().toLocaleString('fr-FR')} F</td><td>${this.soldeNet().toLocaleString('fr-FR')} FCFA</td></tr></tfoot></table></body></html>`;
    const w = window.open('', '_blank')!; w.document.write(html); w.document.close(); w.print();
  }

  exportResultatPDF() {
    const html = `<!DOCTYPE html><html><head><title>Compte de résultat</title><style>body{font-family:Arial,sans-serif;font-size:13px}h1{text-align:center}.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee}</style></head><body><h1>COMPTE DE RÉSULTAT — ${this.formatPeriodeLabel(this.selectedPeriode).toUpperCase()}</h1><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:16px 0"><div style="padding:12px;background:#f0fdf4;border-radius:8px;text-align:center"><div>CA</div><strong style="color:green">${this.totalRecettes().toLocaleString('fr-FR')} FCFA</strong></div><div style="padding:12px;background:#fff7ed;border-radius:8px;text-align:center"><div>Marge brute</div><strong style="color:orange">${this.margeBrute().toLocaleString('fr-FR')} F (${this.tauxMarge().toFixed(1)}%)</strong></div><div style="padding:12px;background:#eff6ff;border-radius:8px;text-align:center"><div>Résultat net</div><strong style="color:blue">${this.resultatNet().toLocaleString('fr-FR')} FCFA</strong></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:24px"><div><h3 style="color:green">🟢 RECETTES</h3>${this.recettes.map(r => `<div class="row"><span>${r.label}</span><strong>${r.montant.toLocaleString('fr-FR')} FCFA</strong></div>`).join('')}</div><div><h3 style="color:red">🔴 CHARGES</h3>${this.charges.map(c => `<div class="row"><span>${c.label}</span><strong>${c.montant.toLocaleString('fr-FR')} FCFA</strong></div>`).join('')}</div></div><div style="margin-top:16px;padding:16px;background:#0f172a;border-radius:8px;display:flex;justify-content:space-between"><span style="color:white;font-weight:700">RÉSULTAT NET</span><span style="color:#4ade80;font-weight:800;font-size:18px">${this.resultatNet().toLocaleString('fr-FR')} FCFA</span></div></body></html>`;
    const w = window.open('', '_blank')!; w.document.write(html); w.document.close(); w.print();
  }

  exportBalanceAgeePDF() {
    const rows = this.creances.map(c => `<tr><td>${c.nom}</td><td>${c.telephone}</td><td>${c.j30 > 0 ? c.j30.toLocaleString('fr-FR') + ' F' : '—'}</td><td>${c.j60 > 0 ? c.j60.toLocaleString('fr-FR') + ' F' : '—'}</td><td>${c.j60p > 0 ? c.j60p.toLocaleString('fr-FR') + ' F' : '—'}</td><td><strong>${(c.j30 + c.j60 + c.j60p).toLocaleString('fr-FR')} FCFA</strong></td></tr>`).join('');
    const html = `<!DOCTYPE html><html><head><title>Balance âgée</title><style>body{font-family:Arial,sans-serif;font-size:12px}h1{text-align:center}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 10px}th{background:#f1f5f9}tfoot td{font-weight:700}</style></head><body><h1>BALANCE ÂGÉE — ${this.currentMonth.toUpperCase()}</h1><table><thead><tr><th>Client</th><th>Téléphone</th><th>0-30j</th><th>31-60j</th><th>+60j</th><th>Total</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="2"><strong>TOTAL GÉNÉRAL</strong></td><td>${this.totalJ30().toLocaleString('fr-FR')} F</td><td>${this.totalJ60().toLocaleString('fr-FR')} F</td><td>${this.totalJ60p().toLocaleString('fr-FR')} F</td><td>${this.totalCreances().toLocaleString('fr-FR')} FCFA</td></tr></tfoot></table></body></html>`;
    const w = window.open('', '_blank')!; w.document.write(html); w.document.close(); w.print();
  }

  async relancerWhatsApp(c: { id?: string; nom: string; telephone: string; whatsapp?: string; j30: number; j60: number; j60p: number }) {
    try {
      const res = await this.waService.relancer({
        id: c.id, nom: c.nom, telephone: c.telephone, whatsapp: c.whatsapp, solde: c.j30 + c.j60 + c.j60p,
      });
      if (res.mode === 'openwa') {
        this.toastService.success(`Relance WhatsApp envoyée à ${c.nom}.`);
      } else {
        this.toastService.info(`WhatsApp Web ouvert pour ${c.nom}.`);
      }
    } catch (err) {
      this.toastService.error(waErrorMessage(err, 'Erreur lors de la relance WhatsApp.'));
    }
  }
}

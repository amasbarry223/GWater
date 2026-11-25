import { Component, signal, inject, OnInit, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToastService } from '../../core/toast.service';
import { WhatsappService, waErrorMessage } from '../../core/whatsapp.service';
import { DataService } from '../../core/data.service';
import { AuthService } from '../../core/auth.service';
import { Vente, Produit, Client, Paiement, Depense, Livraison } from '../../core/models';

type Onglet = 'ventes' | 'creances' | 'stock' | 'caisse' | 'depenses' | 'livraisons';

interface BalanceAgee {
  clientId?: string;
  clientNom: string;
  telephone: string;
  whatsapp?: string;
  total: number;
  j0_30: number;
  j31_60: number;
  jPlus60: number;
}

interface LigneStock {
  produit: string;
  categorie: string;
  stock: number;
  coutAchat: number;
  valeurTotale: number;
  statut: string;
}

interface MouvementCaisse {
  dateObj: Date;
  date: string;
  libelle: string;
  compte: string;
  debit: number;
  credit: number;
  solde: number;
}

interface DepenseCategorie {
  categorie: string;
  montant: number;
  pourcentage: number;
}

@Component({
  selector: 'app-rapports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [],
  template: `
<div class="page-header">
  <div>
    <h1 class="page-title">📊 Rapports & Analyses</h1>
    <p class="page-sub">Tableaux de bord analytiques en temps réel et exports</p>
  </div>
  <div style="display:flex;gap:8px">
    <button class="btn btn-outline" (click)="exportCsv()">📥 Export Excel (CSV)</button>
    <button class="btn btn-primary" (click)="exportPdf()">🖨️ Export PDF</button>
  </div>
</div>

<!-- ONGLETS -->
<div class="gw-card" style="margin-bottom:16px;padding:0">
  <div style="display:flex;border-bottom:1px solid var(--gw-border);flex-wrap:wrap">
    @for (tab of tabs; track tab.key) {
      <button
        style="padding:14px 20px;border:none;background:transparent;cursor:pointer;font-size:13px;border-bottom:3px solid transparent;transition:all 0.2s"
        [style.border-bottom-color]="activeTab() === tab.key ? 'var(--gw-primary)' : 'transparent'"
        [style.color]="activeTab() === tab.key ? 'var(--gw-primary)' : 'var(--gw-muted)'"
        [style.font-weight]="activeTab() === tab.key ? '600' : '400'"
        (click)="activeTab.set(tab.key)">
        {{ tab.icon }} {{ tab.label }}
      </button>
    }
  </div>
</div>

<!-- === ONGLET VENTES === -->
@if (activeTab() === 'ventes') {
  <div class="gw-card" style="margin-bottom:16px;padding:16px">
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
      <div class="form-group" style="margin:0">
        <label class="form-label">Date début</label>
        <input class="form-control" type="date" [(ngModel)]="filtreVentes.dateDebut" (change)="filtrerVentes()" />
      </div>
      <div class="form-group" style="margin:0">
        <label class="form-label">Date fin</label>
        <input class="form-control" type="date" [(ngModel)]="filtreVentes.dateFin" (change)="filtrerVentes()" />
      </div>
      <div class="form-group" style="margin:0">
        <label class="form-label">Vendeur</label>
        <input class="form-control" type="text" placeholder="Tous les vendeurs" [(ngModel)]="filtreVentes.vendeur" (input)="filtrerVentes()" />
      </div>
      <div class="form-group" style="margin:0">
        <label class="form-label">Produit</label>
        <input class="form-control" type="text" placeholder="Tous les produits" [(ngModel)]="filtreVentes.produit" (input)="filtrerVentes()" />
      </div>
      <button class="btn btn-primary" (click)="filtrerVentes()">🔍 Filtrer</button>
    </div>
  </div>

  <!-- KPIs ventes -->
  <div class="grid-kpi" style="margin-bottom:16px">
    <div class="kpi-card">
      <div class="kpi-label">Total ventes</div>
      <div class="kpi-value">{{ kpiVentes().count }}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">CA total</div>
      <div class="kpi-value">{{ formatFcfa(kpiVentes().ca) }}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Payé</div>
      <div class="kpi-value" style="color:var(--gw-success)">{{ formatFcfa(kpiVentes().paye) }}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Créances</div>
      <div class="kpi-value" style="color:var(--gw-danger)">{{ formatFcfa(kpiVentes().creances) }}</div>
    </div>
  </div>

  <div class="gw-card">
    <div class="gw-table-wrapper">
      <table class="gw-table">
        <thead>
          <tr>
            <th>N° Vente</th>
            <th>Date</th>
            <th>Client</th>
            <th>Vendeur</th>
            <th>Total</th>
            <th>Payé</th>
            <th>Reste</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          @for (v of ventesData(); track v.id) {
            <tr>
              <td><strong>{{ v.numero }}</strong></td>
              <td>{{ v.createdAt | date:'dd/MM/yyyy' }}</td>
              <td>{{ v.clientNom }}</td>
              <td>{{ v.vendeurNom }}</td>
              <td>{{ formatFcfa(v.total) }}</td>
              <td style="color:var(--gw-success)">{{ formatFcfa(v.montantPaye) }}</td>
              <td [style.color]="v.soldeRestant > 0 ? 'var(--gw-danger)' : ''">{{ formatFcfa(v.soldeRestant) }}</td>
              <td>
                <span class="badge" [class]="statutBadge(v.paiementStatut)">{{ v.paiementStatut }}</span>
              </td>
            </tr>
          }
          @if (ventesData().length === 0) {
            <tr><td colspan="8" style="text-align:center;padding:32px;color:var(--gw-muted)">Aucune vente trouvée</td></tr>
          }
        </tbody>
        <tfoot>
          <tr style="background:var(--gw-surface-2);font-weight:600">
            <td colspan="4">TOTAUX</td>
            <td>{{ formatFcfa(kpiVentes().ca) }}</td>
            <td>{{ formatFcfa(kpiVentes().paye) }}</td>
            <td>{{ formatFcfa(kpiVentes().creances) }}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
}

<!-- === ONGLET BALANCE AGEE === -->
@if (activeTab() === 'creances') {
  <div class="grid-kpi" style="margin-bottom:16px">
    <div class="kpi-card">
      <div class="kpi-label">Total créances</div>
      <div class="kpi-value" style="color:var(--gw-danger)">{{ formatFcfa(totalCreances()) }}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">0-30 jours</div>
      <div class="kpi-value" style="color:var(--gw-warning)">{{ formatFcfa(totalJ030()) }}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">31-60 jours</div>
      <div class="kpi-value" style="color:orange">{{ formatFcfa(totalJ3160()) }}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">+60 jours</div>
      <div class="kpi-value" style="color:var(--gw-danger)">{{ formatFcfa(totalJPlus60()) }}</div>
    </div>
  </div>

  <div class="gw-card">
    <div class="gw-table-wrapper">
      <table class="gw-table">
        <thead>
          <tr>
            <th>Client</th>
            <th>Téléphone</th>
            <th style="text-align:right">0-30j</th>
            <th style="text-align:right">31-60j</th>
            <th style="text-align:right">+60j</th>
            <th style="text-align:right">Total dû</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          @for (b of balanceAgee(); track b.clientNom) {
            <tr>
              <td><strong>{{ b.clientNom }}</strong></td>
              <td>{{ b.telephone || '—' }}</td>
              <td style="text-align:right">{{ formatFcfa(b.j0_30) }}</td>
              <td style="text-align:right" [style.color]="b.j31_60 > 0 ? 'orange' : ''">{{ formatFcfa(b.j31_60) }}</td>
              <td style="text-align:right" [style.color]="b.jPlus60 > 0 ? 'var(--gw-danger)' : ''">{{ formatFcfa(b.jPlus60) }}</td>
              <td style="text-align:right;font-weight:600;color:var(--gw-danger)">{{ formatFcfa(b.total) }}</td>
              <td>
                <button class="btn btn-sm btn-success-outline" (click)="relanceWhatsapp(b)" title="Relance WhatsApp">
                  📲 Relancer
                </button>
              </td>
            </tr>
          }
          @if (balanceAgee().length === 0) {
            <tr><td colspan="7" style="text-align:center;padding:32px;color:var(--gw-muted)">Aucune créance en cours 🎉</td></tr>
          }
        </tbody>
      </table>
    </div>
  </div>
}

<!-- === ONGLET STOCK === -->
@if (activeTab() === 'stock') {
  <div class="grid-kpi" style="margin-bottom:16px">
    <div class="kpi-card">
      <div class="kpi-label">Produits actifs</div>
      <div class="kpi-value">{{ stockData().length }}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Valeur totale stock</div>
      <div class="kpi-value">{{ formatFcfa(valeurTotaleStock()) }}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">En alerte</div>
      <div class="kpi-value" style="color:var(--gw-warning)">{{ stockEnAlerte() }}</div>
    </div>
  </div>

  <div class="gw-card">
    <div class="gw-table-wrapper">
      <table class="gw-table">
        <thead>
          <tr>
            <th>Produit</th>
            <th>Catégorie</th>
            <th style="text-align:right">Stock actuel</th>
            <th style="text-align:right">Coût unitaire</th>
            <th style="text-align:right">Valeur totale</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          @for (s of stockData(); track s.produit) {
            <tr>
              <td><strong>{{ s.produit }}</strong></td>
              <td>{{ s.categorie }}</td>
              <td style="text-align:right">{{ s.stock }}</td>
              <td style="text-align:right">{{ formatFcfa(s.coutAchat) }}</td>
              <td style="text-align:right;font-weight:600">{{ formatFcfa(s.valeurTotale) }}</td>
              <td>
                <span class="badge" [class]="s.statut === 'ok' ? 'badge-success' : 'badge-warning'">
                  {{ s.statut === 'ok' ? '✅ Normal' : '⚠️ Alerte' }}
                </span>
              </td>
            </tr>
          }
          @if (stockData().length === 0) {
            <tr><td colspan="6" style="text-align:center;padding:32px;color:var(--gw-muted)">Aucun produit enregistré</td></tr>
          }
        </tbody>
        <tfoot>
          <tr style="background:var(--gw-surface-2);font-weight:600">
            <td colspan="4">VALEUR TOTALE</td>
            <td style="text-align:right">{{ formatFcfa(valeurTotaleStock()) }}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
}

<!-- === ONGLET CAISSE === -->
@if (activeTab() === 'caisse') {
  <div class="gw-card" style="margin-bottom:16px;padding:16px">
    <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
      <div class="form-group" style="margin:0">
        <label class="form-label">Période début</label>
        <input class="form-control" type="date" [(ngModel)]="filtreCaisse.dateDebut" (change)="filtrerCaisse()" />
      </div>
      <div class="form-group" style="margin:0">
        <label class="form-label">Période fin</label>
        <input class="form-control" type="date" [(ngModel)]="filtreCaisse.dateFin" (change)="filtrerCaisse()" />
      </div>
      <div class="form-group" style="margin:0">
        <label class="form-label">Compte</label>
        <select class="form-control" [(ngModel)]="filtreCaisse.compte" (change)="filtrerCaisse()">
          <option value="">Tous les comptes</option>
          <option value="Caisse principale">Caisse principale</option>
          <option value="Orange Money">Orange Money</option>
          <option value="Wave">Wave</option>
          <option value="Moov Money">Moov Money</option>
          <option value="Banque">Banque</option>
        </select>
      </div>
    </div>
  </div>

  <div class="grid-kpi" style="margin-bottom:16px">
    <div class="kpi-card">
      <div class="kpi-label">Total entrées</div>
      <div class="kpi-value" style="color:var(--gw-success)">{{ formatFcfa(totalEntrees()) }}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Total sorties</div>
      <div class="kpi-value" style="color:var(--gw-danger)">{{ formatFcfa(totalSorties()) }}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Solde net</div>
      <div class="kpi-value" style="color:var(--gw-primary)">{{ formatFcfa(soldeCloture()) }}</div>
    </div>
  </div>

  <div class="gw-card">
    <div class="gw-table-wrapper">
      <table class="gw-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Libellé</th>
            <th>Compte</th>
            <th style="text-align:right">Débit</th>
            <th style="text-align:right">Crédit</th>
            <th style="text-align:right">Solde</th>
          </tr>
        </thead>
        <tbody>
          @for (m of mouvementsCaisse(); track $index) {
            <tr>
              <td>{{ m.date }}</td>
              <td>{{ m.libelle }}</td>
              <td><span class="badge badge-info">{{ m.compte }}</span></td>
              <td style="text-align:right;color:var(--gw-danger)">
                {{ m.debit > 0 ? formatFcfa(m.debit) : '-' }}
              </td>
              <td style="text-align:right;color:var(--gw-success)">
                {{ m.credit > 0 ? formatFcfa(m.credit) : '-' }}
              </td>
              <td style="text-align:right;font-weight:600">{{ formatFcfa(m.solde) }}</td>
            </tr>
          }
          @if (mouvementsCaisse().length === 0) {
            <tr><td colspan="6" style="text-align:center;padding:32px;color:var(--gw-muted)">Aucun mouvement enregistré</td></tr>
          }
        </tbody>
      </table>
    </div>
  </div>
}

<!-- === ONGLET DEPENSES === -->
@if (activeTab() === 'depenses') {
  <div class="grid-kpi" style="margin-bottom:16px">
    <div class="kpi-card">
      <div class="kpi-label">Total dépenses</div>
      <div class="kpi-value" style="color:var(--gw-danger)">{{ formatFcfa(totalDepenses()) }}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Catégories</div>
      <div class="kpi-value">{{ depensesCategories().length }}</div>
    </div>
  </div>

  <div class="gw-card" style="margin-bottom:16px;padding:20px">
    <h3 style="margin-bottom:16px;font-size:14px;font-weight:600">Répartition par catégorie</h3>
    @for (d of depensesCategories(); track d.categorie) {
      <div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px">
          <span>{{ d.categorie }}</span>
          <span style="font-weight:600">{{ formatFcfa(d.montant) }} ({{ d.pourcentage | number:'1.0-1' }}%)</span>
        </div>
        <div style="background:var(--gw-border);border-radius:4px;height:10px;overflow:hidden">
          <div style="height:100%;background:var(--gw-primary);border-radius:4px;transition:width 0.5s"
            [style.width]="d.pourcentage + '%'"></div>
        </div>
      </div>
    }
    @if (depensesCategories().length === 0) {
      <div style="text-align:center;padding:16px;color:var(--gw-muted)">Aucune dépense enregistrée</div>
    }
  </div>

  <div class="gw-card">
    <div class="gw-table-wrapper">
      <table class="gw-table">
        <thead>
          <tr>
            <th>Catégorie</th>
            <th style="text-align:right">Montant</th>
            <th style="text-align:right">% du total</th>
          </tr>
        </thead>
        <tbody>
          @for (d of depensesCategories(); track d.categorie) {
            <tr>
              <td><strong>{{ d.categorie }}</strong></td>
              <td style="text-align:right">{{ formatFcfa(d.montant) }}</td>
              <td style="text-align:right">
                <span class="badge badge-info">{{ d.pourcentage | number:'1.0-1' }}%</span>
              </td>
            </tr>
          }
        </tbody>
        <tfoot>
          <tr style="background:var(--gw-surface-2);font-weight:600">
            <td>TOTAL</td>
            <td style="text-align:right">{{ formatFcfa(totalDepenses()) }}</td>
            <td style="text-align:right">100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
}

<!-- === ONGLET TOURNÉES & LIVRAISONS === -->
@if (activeTab() === 'livraisons') {
  <div class="gw-card" style="margin-bottom:16px;padding:16px">
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
      <div class="form-group" style="margin:0">
        <label class="form-label">Livreur</label>
        <input class="form-control" type="text" placeholder="Tous les livreurs" [(ngModel)]="filtreLivraisons.livreur" (input)="filtrerLivraisons()" />
      </div>
      <div class="form-group" style="margin:0">
        <label class="form-label">Statut</label>
        <select class="form-control" [(ngModel)]="filtreLivraisons.statut" (change)="filtrerLivraisons()">
          <option value="">Tous les statuts</option>
          <option value="a_livrer">À livrer</option>
          <option value="en_cours">En cours</option>
          <option value="livree">Livrée</option>
          <option value="echec">Échec</option>
        </select>
      </div>
    </div>
  </div>

  <div class="grid-kpi" style="margin-bottom:16px">
    <div class="kpi-card">
      <div class="kpi-label">Total livraisons</div>
      <div class="kpi-value">{{ kpiLivraisons().total }}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Livrées</div>
      <div class="kpi-value" style="color:var(--gw-success)">{{ kpiLivraisons().livrees }}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Échecs</div>
      <div class="kpi-value" style="color:var(--gw-danger)">{{ kpiLivraisons().echecs }}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Taux de réussite</div>
      <div class="kpi-value" style="color:var(--gw-primary)">{{ kpiLivraisons().taux | number:'1.0-1' }}%</div>
    </div>
  </div>

  <div class="gw-card">
    <div class="gw-table-wrapper">
      <table class="gw-table">
        <thead>
          <tr><th>N° Facture</th><th>Client</th><th>Adresse</th><th>Livreur</th><th>Date prévue</th><th>Statut</th><th>Motif échec</th></tr>
        </thead>
        <tbody>
          @for (l of livraisonsData(); track l.id) {
            <tr>
              <td><strong>{{ l.venteNumero }}</strong></td>
              <td>{{ l.clientNom }}</td>
              <td>{{ l.adresse || '—' }}</td>
              <td>{{ l.livreur || 'Non affecté' }}</td>
              <td>{{ l.datePrevue || '—' }}</td>
              <td><span class="badge" [class]="l.statut === 'livree' ? 'badge-success' : l.statut === 'echec' ? 'badge-danger' : 'badge-info'">{{ l.statut }}</span></td>
              <td style="font-size:12px;color:#ef4444">{{ l.motifEchec || '—' }}</td>
            </tr>
          }
          @if (livraisonsData().length === 0) {
            <tr><td colspan="7" style="text-align:center;padding:32px;color:var(--gw-muted)">Aucune livraison trouvée</td></tr>
          }
        </tbody>
      </table>
    </div>
  </div>
}
  `,
})
export class RapportsComponent implements OnInit {
  private toast = inject(ToastService);
  private waService = inject(WhatsappService);
  private dataService = inject(DataService);
  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);

  activeTab = signal<Onglet>('ventes');

  tabs: { key: Onglet; label: string; icon: string }[] = [
    { key: 'ventes', label: 'Ventes / Période', icon: '🛒' },
    { key: 'creances', label: 'Balance âgée', icon: '⏳' },
    { key: 'stock', label: 'État du stock', icon: '📦' },
    { key: 'caisse', label: 'Journal de caisse', icon: '💵' },
    { key: 'depenses', label: 'Dépenses', icon: '💸' },
    { key: 'livraisons', label: 'Tournées & Livraisons', icon: '🚚' },
  ];

  filtreVentes = { dateDebut: '', dateFin: '', vendeur: '', produit: '' };
  filtreCaisse = { dateDebut: '', dateFin: '', compte: '' };
  filtreLivraisons = { livreur: '', statut: '' };

  ventesData = signal<Vente[]>([]);
  balanceAgee = signal<BalanceAgee[]>([]);
  stockData = signal<LigneStock[]>([]);
  mouvementsCaisse = signal<MouvementCaisse[]>([]);
  depensesData = signal<DepenseCategorie[]>([]);
  livraisonsData = signal<Livraison[]>([]);

  private allVentes: Vente[] = [];
  private allClients: Client[] = [];
  private allPaiements: Paiement[] = [];
  private allDepenses: Depense[] = [];
  private allMouvementsCaisse: MouvementCaisse[] = [];
  private allLivraisons: Livraison[] = [];

  private compteLabel(key: string): string {
    return ({
      caisse_principale: 'Caisse principale',
      orange_money: 'Orange Money',
      wave: 'Wave',
      moov_money: 'Moov Money',
      banque: 'Banque',
    } as Record<string, string>)[key] || key || 'Caisse principale';
  }

  private toDate(val: any): Date {
    if (val instanceof Date) return val;
    if (val?.toDate) return val.toDate();
    return val ? new Date(val) : new Date();
  }

  ngOnInit() {
    this.dataService.getVentes().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(ventes => {
        this.allVentes = ventes
          .filter(v => v.statut !== 'annulee')
          .map(v => ({ ...v, createdAt: this.toDate(v.createdAt) }));
        this.filtrerVentes();
        this.rebuildBalanceAgee();
        this.rebuildCaisse();
      });

    this.dataService.getClients().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(clients => {
        this.allClients = clients;
        this.rebuildBalanceAgee();
      });

    this.dataService.getProduits().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(produits => {
        this.stockData.set(produits.filter(p => p.statut !== 'inactif').map(p => ({
          produit: p.nom,
          categorie: p.categorie || 'Boisson',
          stock: p.stock || 0,
          coutAchat: p.coutAchat || 0,
          valeurTotale: (p.stock || 0) * (p.coutAchat || 0),
          statut: (p.stock || 0) <= (p.seuilAlerte || 0) ? 'alerte' : 'ok',
        })));
      });

    this.dataService.getPaiements().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(paiements => {
        this.allPaiements = paiements.map(p => ({ ...p, createdAt: this.toDate(p.createdAt) }));
        this.rebuildCaisse();
      });

    this.dataService.getLivraisons().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(livs => {
        this.allLivraisons = livs;
        this.filtrerLivraisons();
      });

    if (this.authService.hasRole('superadmin', 'admin', 'comptable')) {
      this.dataService.getDepenses().pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(depenses => {
          this.allDepenses = depenses.map(d => ({ ...d, createdAt: this.toDate(d.createdAt) }));
          const grouped: Record<string, number> = {};
          for (const d of this.allDepenses) {
            grouped[d.categorie] = (grouped[d.categorie] || 0) + (d.montant || 0);
          }
          this.depensesData.set(
            Object.entries(grouped)
              .map(([categorie, montant]) => ({ categorie, montant, pourcentage: 0 }))
              .sort((a, b) => b.montant - a.montant)
          );
          this.rebuildCaisse();
        });
    }
  }

  private rebuildBalanceAgee() {
    const now = Date.now();
    const map: Record<string, BalanceAgee> = {};
    for (const v of this.allVentes) {
      if ((v.soldeRestant || 0) <= 0) continue;
      const client = this.allClients.find(c => c.id === v.clientId);
      const key = v.clientId || v.clientNom;
      if (!map[key]) {
        map[key] = {
          clientId: client?.id || v.clientId,
          clientNom: client?.nom || v.clientNom,
          telephone: client?.telephone || '',
          whatsapp: client?.whatsapp,
          total: 0, j0_30: 0, j31_60: 0, jPlus60: 0
        };
      }
      const days = Math.floor((now - this.toDate(v.createdAt).getTime()) / 86400000);
      map[key].total += v.soldeRestant;
      if (days <= 30) map[key].j0_30 += v.soldeRestant;
      else if (days <= 60) map[key].j31_60 += v.soldeRestant;
      else map[key].jPlus60 += v.soldeRestant;
    }
    this.balanceAgee.set(Object.values(map).sort((a, b) => b.total - a.total));
  }

  private rebuildCaisse() {
    const raw: Omit<MouvementCaisse, 'solde'>[] = [];
    for (const p of this.allPaiements) {
      const v = this.allVentes.find(vt => vt.id === p.venteId);
      const d = this.toDate(p.createdAt);
      const key = p.compteTresorerie || this.dataService.compteFromMoyen(p.moyen);
      raw.push({
        dateObj: d,
        date: d.toLocaleDateString('fr-FR'),
        libelle: `Encaissement ${v ? v.numero + ' — ' + v.clientNom : p.venteId}`,
        compte: this.compteLabel(key),
        debit: 0,
        credit: p.montant || 0,
      });
    }
    for (const d of this.allDepenses) {
      const dt = this.toDate(d.createdAt);
      raw.push({
        dateObj: dt,
        date: dt.toLocaleDateString('fr-FR'),
        libelle: `Dépense ${d.categorie} — ${d.description}`,
        compte: this.compteLabel(d.compteTresorerie),
        debit: d.montant || 0,
        credit: 0,
      });
    }
    raw.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
    let solde = 0;
    this.allMouvementsCaisse = raw.map(m => {
      solde = solde + m.credit - m.debit;
      return { ...m, solde };
    });
    this.filtrerCaisse();
  }

  filtrerVentes() {
    let list = [...this.allVentes];
    if (this.filtreVentes.dateDebut) {
      const d = new Date(this.filtreVentes.dateDebut);
      list = list.filter(v => this.toDate(v.createdAt) >= d);
    }
    if (this.filtreVentes.dateFin) {
      const d = new Date(this.filtreVentes.dateFin + 'T23:59:59');
      list = list.filter(v => this.toDate(v.createdAt) <= d);
    }
    if (this.filtreVentes.vendeur.trim()) {
      const q = this.filtreVentes.vendeur.trim().toLowerCase();
      list = list.filter(v => (v.vendeurNom || '').toLowerCase().includes(q));
    }
    if (this.filtreVentes.produit.trim()) {
      const q = this.filtreVentes.produit.trim().toLowerCase();
      list = list.filter(v => (v.lignes || []).some(l => (l.produitNom || '').toLowerCase().includes(q)));
    }
    this.ventesData.set(list);
  }

  filtrerCaisse() {
    let list = [...this.allMouvementsCaisse];
    if (this.filtreCaisse.dateDebut) {
      const d = new Date(this.filtreCaisse.dateDebut);
      list = list.filter(m => m.dateObj >= d);
    }
    if (this.filtreCaisse.dateFin) {
      const d = new Date(this.filtreCaisse.dateFin + 'T23:59:59');
      list = list.filter(m => m.dateObj <= d);
    }
    if (this.filtreCaisse.compte) {
      list = list.filter(m => m.compte === this.filtreCaisse.compte);
    }
    let solde = 0;
    this.mouvementsCaisse.set(list.map(m => {
      solde = solde + m.credit - m.debit;
      return { ...m, solde };
    }));
  }

  depensesCategories() {
    const total = this.depensesData().reduce((s, d) => s + d.montant, 0);
    return this.depensesData().map(d => ({ ...d, pourcentage: total > 0 ? (d.montant / total) * 100 : 0 }));
  }

  totalDepenses() { return this.depensesData().reduce((s, d) => s + d.montant, 0); }
  totalCreances() { return this.balanceAgee().reduce((s, b) => s + b.total, 0); }
  totalJ030() { return this.balanceAgee().reduce((s, b) => s + b.j0_30, 0); }
  totalJ3160() { return this.balanceAgee().reduce((s, b) => s + b.j31_60, 0); }
  totalJPlus60() { return this.balanceAgee().reduce((s, b) => s + b.jPlus60, 0); }
  valeurTotaleStock() { return this.stockData().reduce((s, l) => s + l.valeurTotale, 0); }
  stockEnAlerte() { return this.stockData().filter(s => s.statut === 'alerte').length; }

  totalEntrees() { return this.mouvementsCaisse().reduce((s, m) => s + m.credit, 0); }
  totalSorties() { return this.mouvementsCaisse().reduce((s, m) => s + m.debit, 0); }
  soldeCloture() { return this.totalEntrees() - this.totalSorties(); }

  kpiVentes() {
    const v = this.ventesData();
    return {
      count: v.length,
      ca: v.reduce((s, x) => s + (x.total || 0), 0),
      paye: v.reduce((s, x) => s + (x.montantPaye || 0), 0),
      creances: v.reduce((s, x) => s + (x.soldeRestant || 0), 0),
    };
  }

  filtrerLivraisons() {
    let list = [...this.allLivraisons];
    if (this.filtreLivraisons.livreur.trim()) {
      const q = this.filtreLivraisons.livreur.trim().toLowerCase();
      list = list.filter(l => (l.livreur || '').toLowerCase().includes(q));
    }
    if (this.filtreLivraisons.statut) {
      list = list.filter(l => l.statut === this.filtreLivraisons.statut);
    }
    this.livraisonsData.set(list);
  }

  kpiLivraisons() {
    const list = this.livraisonsData();
    const livrees = list.filter(l => l.statut === 'livree').length;
    const echecs = list.filter(l => l.statut === 'echec').length;
    const terminees = livrees + echecs;
    return {
      total: list.length,
      livrees,
      echecs,
      taux: terminees > 0 ? (livrees / terminees) * 100 : 0,
    };
  }

  async relanceWhatsapp(b: BalanceAgee) {
    try {
      const res = await this.waService.relancer({
        id: b.clientId, nom: b.clientNom, telephone: b.telephone, whatsapp: b.whatsapp, solde: b.total,
      });
      this.toast.success(res.mode === 'openwa'
        ? `Relance WhatsApp envoyée à ${b.clientNom}`
        : `Relance WhatsApp ouverte pour ${b.clientNom}`);
    } catch (err) {
      this.toast.error(waErrorMessage(err, 'Erreur lors de la relance WhatsApp'));
    }
  }

  exportPdf() {
    const tab = this.activeTab();
    const html = this.buildPrintHtml(tab);
    const win = window.open('', '_blank', 'width=900,height=700');
    if (win) {
      win.document.write(html);
      win.document.close();
      this.toast.success('Fenêtre d\'impression ouverte.');
    }
  }

  exportCsv() {
    const tab = this.activeTab();
    let csv = '';
    let filename = 'rapport.csv';

    if (tab === 'ventes') {
      csv = 'Numero;Date;Client;Vendeur;Total;Paye;Reste;Statut\n';
      csv += this.ventesData().map(v =>
        `${v.numero};${new Date(v.createdAt).toLocaleDateString('fr-FR')};${v.clientNom};${v.vendeurNom};${v.total};${v.montantPaye};${v.soldeRestant};${v.paiementStatut}`
      ).join('\n');
      filename = 'ventes.csv';
    } else if (tab === 'creances') {
      csv = 'Client;Telephone;0-30j;31-60j;+60j;Total\n';
      csv += this.balanceAgee().map(b =>
        `${b.clientNom};${b.telephone};${b.j0_30};${b.j31_60};${b.jPlus60};${b.total}`
      ).join('\n');
      filename = 'balance_agee.csv';
    } else if (tab === 'stock') {
      csv = 'Produit;Categorie;Stock;Cout;Valeur;Statut\n';
      csv += this.stockData().map(s =>
        `${s.produit};${s.categorie};${s.stock};${s.coutAchat};${s.valeurTotale};${s.statut}`
      ).join('\n');
      filename = 'stock.csv';
    } else if (tab === 'caisse') {
      csv = 'Date;Libelle;Compte;Debit;Credit;Solde\n';
      csv += this.mouvementsCaisse().map(m =>
        `${m.date};${m.libelle};${m.compte};${m.debit};${m.credit};${m.solde}`
      ).join('\n');
      filename = 'journal_caisse.csv';
    } else if (tab === 'depenses') {
      csv = 'Categorie;Montant;Pourcentage\n';
      csv += this.depensesCategories().map(d =>
        `${d.categorie};${d.montant};${d.pourcentage.toFixed(1)}%`
      ).join('\n');
      filename = 'depenses.csv';
    } else if (tab === 'livraisons') {
      csv = 'Facture;Client;Adresse;Livreur;DatePrevue;Statut;MotifEchec\n';
      csv += this.livraisonsData().map(l =>
        `${l.venteNumero};${l.clientNom};${l.adresse || ''};${l.livreur || ''};${l.datePrevue || ''};${l.statut};${l.motifEchec || ''}`
      ).join('\n');
      filename = 'livraisons.csv';
    }

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.success('Export CSV téléchargé.');
  }

  statutBadge(statut: string) {
    if (statut === 'paye') return 'badge-success';
    if (statut === 'partiel') return 'badge-warning';
    return 'badge-danger';
  }

  formatFcfa(val: number): string {
    return Math.round(val).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + ' FCFA';
  }

  private buildPrintHtml(tab: Onglet): string {
    const titles: Record<Onglet, string> = {
      ventes: 'Rapport des Ventes',
      creances: 'Balance Âgée des Créances',
      stock: 'État du Stock',
      caisse: 'Journal de Caisse',
      depenses: 'Dépenses par Catégorie',
      livraisons: 'Rapport Tournées & Livraisons',
    };
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${titles[tab]}</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px}
h1{color:#0ea5e9;font-size:18px;margin-bottom:16px}
table{width:100%;border-collapse:collapse}
th{background:#0ea5e9;color:white;padding:8px;text-align:left}
td{padding:6px 8px;border-bottom:1px solid #eee}
tr:nth-child(even) td{background:#f9fafb}
.footer{margin-top:24px;font-size:10px;color:#777;text-align:center}
@media print{button{display:none}}
</style></head><body>
<h1>💧 GWater — ${titles[tab]}</h1>
<p style="color:#777;margin-bottom:16px">Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
${this.buildTableHtml(tab)}
<div class="footer">GWater © ${new Date().getFullYear()} — Document confidentiel</div>
<script>window.onload=()=>{window.print()}<\/script>
</body></html>`;
  }

  private buildTableHtml(tab: Onglet): string {
    if (tab === 'ventes') {
      const rows = this.ventesData().map(v =>
        `<tr><td>${v.numero}</td><td>${new Date(v.createdAt).toLocaleDateString('fr-FR')}</td><td>${v.clientNom}</td><td>${v.vendeurNom}</td><td>${this.formatFcfa(v.total)}</td><td>${this.formatFcfa(v.montantPaye)}</td><td>${this.formatFcfa(v.soldeRestant)}</td></tr>`
      ).join('');
      return `<table><thead><tr><th>N°</th><th>Date</th><th>Client</th><th>Vendeur</th><th>Total</th><th>Payé</th><th>Reste</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
    if (tab === 'creances') {
      const rows = this.balanceAgee().map(b =>
        `<tr><td>${b.clientNom}</td><td>${b.telephone}</td><td>${this.formatFcfa(b.j0_30)}</td><td>${this.formatFcfa(b.j31_60)}</td><td>${this.formatFcfa(b.jPlus60)}</td><td>${this.formatFcfa(b.total)}</td></tr>`
      ).join('');
      return `<table><thead><tr><th>Client</th><th>Téléphone</th><th>0-30j</th><th>31-60j</th><th>+60j</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
    if (tab === 'stock') {
      const rows = this.stockData().map(s =>
        `<tr><td>${s.produit}</td><td>${s.categorie}</td><td>${s.stock}</td><td>${this.formatFcfa(s.coutAchat)}</td><td>${this.formatFcfa(s.valeurTotale)}</td></tr>`
      ).join('');
      return `<table><thead><tr><th>Produit</th><th>Catégorie</th><th>Stock</th><th>Coût unit.</th><th>Valeur</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
    if (tab === 'caisse') {
      const rows = this.mouvementsCaisse().map(m =>
        `<tr><td>${m.date}</td><td>${m.libelle}</td><td>${m.compte}</td><td>${m.debit > 0 ? this.formatFcfa(m.debit) : '-'}</td><td>${m.credit > 0 ? this.formatFcfa(m.credit) : '-'}</td><td>${this.formatFcfa(m.solde)}</td></tr>`
      ).join('');
      return `<table><thead><tr><th>Date</th><th>Libellé</th><th>Compte</th><th>Débit</th><th>Crédit</th><th>Solde</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
    if (tab === 'depenses') {
      const rows = this.depensesCategories().map(d =>
        `<tr><td>${d.categorie}</td><td>${this.formatFcfa(d.montant)}</td><td>${d.pourcentage.toFixed(1)}%</td></tr>`
      ).join('');
      return `<table><thead><tr><th>Catégorie</th><th>Montant</th><th>%</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
    if (tab === 'livraisons') {
      const rows = this.livraisonsData().map(l =>
        `<tr><td>${l.venteNumero}</td><td>${l.clientNom}</td><td>${l.adresse || '—'}</td><td>${l.livreur || 'Non affecté'}</td><td>${l.statut}</td></tr>`
      ).join('');
      return `<table><thead><tr><th>Facture</th><th>Client</th><th>Adresse</th><th>Livreur</th><th>Statut</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
    return '';
  }
}

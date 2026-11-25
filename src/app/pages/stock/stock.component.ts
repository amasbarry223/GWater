import { Component, ChangeDetectorRef, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../core/data.service';
import { ToastService } from '../../core/toast.service';
import { Produit, MouvementStock, PrixHistorique } from '../../core/models';
import { AuthService } from '../../core/auth.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface InventaireItem {
  produit: Produit;
  stockCompte: number;
}

@Component({
  selector: 'app-stock',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div>
  <div class="page-header">
    <div>
      <div class="page-title">Stock & Produits</div>
      <div class="page-subtitle">Gestion des produits, niveaux de stock et mouvements</div>
    </div>
    <div class="page-actions">
      @if (authService.hasRole('admin', 'superadmin')) {
        <button class="btn btn-secondary" (click)="openDecondModal()">📦→🫗 Déconditionner</button>
      }
      <button class="btn btn-secondary" (click)="activeTab.set('inventaire')">📋 Inventaire</button>
      <button class="btn btn-secondary" (click)="activeTab.set('mouvements')">🔄 Mouvements</button>
      <button class="btn btn-primary" (click)="openModal()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Entrée de stock
      </button>
    </div>
  </div>

  <!-- KPIs globaux -->
  <div class="grid-kpi" style="margin-bottom:20px">
    <div class="kpi-card">
      <div class="kpi-top"><div class="kpi-icon" style="background:#e0f2fe">📦</div></div>
      <div class="kpi-value">{{ produits().length }}</div>
      <div class="kpi-label">Produits actifs</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-top"><div class="kpi-icon" style="background:#fffbeb">⚠️</div></div>
      <div class="kpi-value">{{ alertes().length }}</div>
      <div class="kpi-label">En alerte stock</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-top"><div class="kpi-icon" style="background:#f0fdf4">💰</div></div>
      <div class="kpi-value">{{ valeurStockTotal() | number:'1.0-0' }} F</div>
      <div class="kpi-label">Valeur totale stock</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-top"><div class="kpi-icon" style="background:#fef2f2">🔥</div></div>
      <div class="kpi-value" style="color:#ef4444">{{ totalPertesMonth() | number:'1.0-0' }} F</div>
      <div class="kpi-label">Pertes du mois</div>
    </div>
  </div>

  <!-- Tabs -->
  <div style="display:flex;gap:4px;margin-bottom:20px;background:#f1f5f9;border-radius:10px;padding:4px;width:fit-content">
    <button class="btn" [style.background]="activeTab()==='produits'?'white':'transparent'"
            [style.box-shadow]="activeTab()==='produits'?'var(--gw-shadow)':'none'"
            [style.color]="activeTab()==='produits'?'var(--gw-text)':'#94a3b8'"
            (click)="activeTab.set('produits')">📦 Produits</button>
    <button class="btn" [style.background]="activeTab()==='mouvements'?'white':'transparent'"
            [style.box-shadow]="activeTab()==='mouvements'?'var(--gw-shadow)':'none'"
            [style.color]="activeTab()==='mouvements'?'var(--gw-text)':'#94a3b8'"
            (click)="activeTab.set('mouvements')">🔄 Mouvements</button>
    <button class="btn" [style.background]="activeTab()==='inventaire'?'white':'transparent'"
            [style.box-shadow]="activeTab()==='inventaire'?'var(--gw-shadow)':'none'"
            [style.color]="activeTab()==='inventaire'?'var(--gw-text)':'#94a3b8'"
            (click)="activeTab.set('inventaire')">📋 Inventaire</button>
    <button class="btn" [style.background]="activeTab()==='prix'?'white':'transparent'"
            [style.box-shadow]="activeTab()==='prix'?'var(--gw-shadow)':'none'"
            [style.color]="activeTab()==='prix'?'var(--gw-text)':'#94a3b8'"
            (click)="activeTab.set('prix')">🏷️ Historique prix ({{ prixHistorique().length }})</button>
  </div>

  <!-- ============ ONGLET PRODUITS ============ -->
  @if (activeTab() === 'produits') {
    @for (p of alertes(); track p.id) {
      <div class="gw-alert alert-warning" style="margin-bottom:12px">
        <span class="alert-icon">⚠️</span>
        <div class="alert-content">
          <strong>Stock bas : {{ p.nom }}</strong> — {{ p.stock }} unités restantes (seuil : {{ p.seuilAlerte }})
        </div>
      </div>
    }

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;margin-bottom:24px">
      @for (p of produits(); track p.id) {
        <div class="gw-card">
          <div class="card-body">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px">
              <div style="display:flex;align-items:center;gap:12px">
                <div style="width:48px;height:48px;background:linear-gradient(135deg,#0ea5e9,#2563eb);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px">🫗</div>
                <div>
                  <div style="font-weight:600;font-size:15px">{{ p.nom }}</div>
                  <div style="font-size:11px;color:#94a3b8">{{ p.code }} · {{ p.unite }}</div>
                </div>
              </div>
              <span [class]="'badge ' + (p.stock <= p.seuilAlerte ? 'badge-danger' : 'badge-success')">
                {{ p.stock <= p.seuilAlerte ? '⚠️ Bas' : '✅ OK' }}
              </span>
            </div>

            <!-- Stock bar avec % STK-05 -->
            <div style="margin-bottom:12px">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                <span style="font-size:12px;color:#94a3b8">Stock actuel</span>
                <span style="font-size:16px;font-weight:700">{{ p.stock | number:'1.0-0' }} {{ p.unite }}</span>
              </div>
              <div style="height:8px;background:#f1f5f9;border-radius:4px;overflow:hidden">
                <div [style.width.%]="stockPct(p)" [style.background]="p.stock <= p.seuilAlerte ? '#ef4444' : '#22c55e'"
                     style="height:100%;border-radius:4px;transition:width 0.5s"></div>
              </div>
              <div style="display:flex;justify-content:space-between;margin-top:4px">
                <div style="font-size:11px;color:#94a3b8">Seuil : {{ p.seuilAlerte }}</div>
                <div style="font-size:11px;color:#64748b;font-weight:500">{{ stockPct(p) | number:'1.0-0' }}%</div>
              </div>
            </div>

            <!-- Métriques STK-05 -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
              <div style="padding:8px;background:#f8fafc;border-radius:8px">
                <div style="font-size:10px;color:#94a3b8;margin-bottom:2px">Valeur stock</div>
                <div style="font-weight:600;font-size:12px;color:#0ea5e9">{{ (p.stock * p.coutAchat) | number:'1.0-0' }} F</div>
              </div>
              <div style="padding:8px;background:#f8fafc;border-radius:8px">
                <div style="font-size:10px;color:#94a3b8;margin-bottom:2px">Rotation/mois</div>
                <div style="font-weight:600;font-size:12px">{{ rotation(p) | number:'1.1-2' }}x</div>
              </div>
            </div>
            @if (lastEntree(p.id)) {
              <div style="font-size:11px;color:#94a3b8;margin-bottom:12px">
                📦 Dernière entrée : {{ lastEntree(p.id) | date:'dd/MM/yyyy' }}
              </div>
            }

            <!-- Tarifs -->
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
              <div style="text-align:center;padding:8px;background:#f8fafc;border-radius:8px">
                <div style="font-size:10px;color:#94a3b8">Détail</div>
                <div style="font-weight:600;font-size:13px">{{ p.prixDetail | number:'1.0-0' }} F</div>
              </div>
              <div style="text-align:center;padding:8px;background:#f8fafc;border-radius:8px">
                <div style="font-size:10px;color:#94a3b8">Gros</div>
                <div style="font-weight:600;font-size:13px">{{ p.prixGros | number:'1.0-0' }} F</div>
              </div>
              <div style="text-align:center;padding:8px;background:#f8fafc;border-radius:8px">
                <div style="font-size:10px;color:#94a3b8">Revendeur</div>
                <div style="font-weight:600;font-size:13px">{{ p.prixRevendeur | number:'1.0-0' }} F</div>
              </div>
            </div>

            <div style="display:flex;gap:8px">
              <button class="btn btn-primary" style="flex:1;justify-content:center" (click)="openEntree(p)">
                ➕ Entrée
              </button>
              <button class="btn btn-secondary btn-icon" (click)="openEditProduit(p)" title="Modifier">✏️</button>
            </div>
          </div>
        </div>
      }

      <!-- Add product card -->
      <div class="gw-card" style="border:2px dashed #e2e8f0;cursor:pointer;display:flex;align-items:center;justify-content:center;min-height:200px"
           (click)="openNewProduit()">
        <div style="text-align:center;color:#94a3b8">
          <div style="font-size:36px;margin-bottom:8px">➕</div>
          <div style="font-size:14px;font-weight:500">Ajouter un produit</div>
        </div>
      </div>
    </div>
  }

  <!-- ============ ONGLET MOUVEMENTS ============ -->
  @if (activeTab() === 'mouvements') {
    <div class="gw-table-wrapper">
      <div class="gw-table-toolbar">
        <div class="toolbar-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#94a3b8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Rechercher un mouvement..." [(ngModel)]="searchMvt">
        </div>
        <select class="form-control" style="width:150px;height:34px" [(ngModel)]="filterMvtType">
          <option value="">Tous les types</option>
          <option value="entree">Entrée</option>
          <option value="sortie">Sortie</option>
          <option value="ajustement">Ajustement</option>
          <option value="perte">Perte</option>
        </select>
        <div class="toolbar-spacer"></div>
        <span style="font-size:12px;color:#94a3b8">{{ filteredMouvements().length }} mouvement(s)</span>
      </div>
      <table class="gw-table">
        <thead>
          <tr>
            <th>Date</th><th>Produit</th><th>Type</th>
            <th>Quantité</th><th>Coût unitaire</th><th>Motif</th><th>Opérateur</th>
          </tr>
        </thead>
        <tbody>
          @for (m of filteredMouvements(); track m.id) {
            <tr>
              <td style="font-size:12px;color:#64748b">{{ m.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
              <td><strong>{{ m.produitNom }}</strong></td>
              <td><span [class]="'badge ' + typeBadge(m.type)">{{ typeLabel(m.type) }}</span></td>
              <td>
                <span [style.color]="isPositiveMvt(m)?'#22c55e':'#ef4444'" style="font-weight:600">
                  {{ isPositiveMvt(m) ? '+' : '-' }}{{ m.quantite }}
                </span>
              </td>
              <td>{{ m.cout ? (m.cout | number:'1.0-0') + ' FCFA' : '—' }}</td>
              <td>{{ m.motif || '—' }}</td>
              <td>{{ m.operateur }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  }

  <!-- ============ ONGLET INVENTAIRE STK-07 ============ -->
  @if (activeTab() === 'inventaire') {
    @if (!inventaireStarted()) {
      <div style="display:flex;justify-content:center;margin-top:40px">
        <div class="gw-card" style="max-width:480px;width:100%;text-align:center">
          <div class="card-body" style="padding:48px 32px">
            <div style="font-size:56px;margin-bottom:16px">📋</div>
            <div style="font-size:20px;font-weight:700;margin-bottom:8px">Inventaire physique</div>
            <div style="color:#94a3b8;margin-bottom:8px;font-size:14px">Comptez vos stocks réels et comparez avec le stock théorique</div>
            <div style="color:#64748b;font-size:13px;margin-bottom:28px">{{ produits().length }} produit(s) à inventorier</div>
            <button class="btn btn-primary" style="font-size:15px;padding:12px 28px" (click)="lancerInventaire()">
              🚀 Lancer l'inventaire
            </button>
          </div>
        </div>
      </div>
    } @else {
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-weight:700;font-size:16px">Inventaire physique — {{ inventaireDate() }}</div>
          <div style="font-size:12px;color:#94a3b8">Saisissez le stock compté pour chaque produit</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary" (click)="inventaireStarted.set(false)">Annuler</button>
          @if (authService.hasRole('admin', 'superadmin')) {
            <button class="btn btn-primary" (click)="validerInventaire()">✓ Valider l'inventaire</button>
          } @else {
            <div style="font-size:12px;color:#94a3b8;padding:8px">Validation réservée aux administrateurs</div>
          }
        </div>
      </div>

      <div class="gw-table-wrapper">
        <table class="gw-table">
          <thead>
            <tr>
              <th>Produit</th>
              <th>Stock théorique</th>
              <th>Stock compté</th>
              <th>Écart</th>
            </tr>
          </thead>
          <tbody>
            @for (item of inventaireItems; track item.produit.id; let i = $index) {
              <tr>
                <td>
                  <div style="font-weight:500">{{ item.produit.nom }}</div>
                  <div style="font-size:11px;color:#94a3b8">{{ item.produit.code }} · {{ item.produit.unite }}</div>
                </td>
                <td>
                  <span style="font-weight:600">{{ item.produit.stock }}</span>
                  <span style="font-size:11px;color:#94a3b8;margin-left:4px">{{ item.produit.unite }}</span>
                </td>
                <td>
                  <input type="number" class="form-control" style="width:110px;padding:6px 10px"
                         [(ngModel)]="item.stockCompte" min="0" placeholder="0">
                </td>
                <td>
                  <span [style.color]="(item.stockCompte - item.produit.stock) > 0 ? '#22c55e' : (item.stockCompte - item.produit.stock) < 0 ? '#ef4444' : '#94a3b8'"
                        style="font-weight:700;font-size:15px">
                    {{ (item.stockCompte - item.produit.stock) > 0 ? '+' : '' }}{{ item.stockCompte - item.produit.stock }}
                  </span>
                  @if ((item.stockCompte - item.produit.stock) !== 0) {
                    <span class="badge" [class]="(item.stockCompte - item.produit.stock) > 0 ? 'badge-success' : 'badge-danger'"
                          style="margin-left:6px;font-size:10px">
                      {{ (item.stockCompte - item.produit.stock) > 0 ? 'Surplus' : 'Manque' }}
                    </span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div style="margin-top:16px;padding:12px 16px;background:#f8fafc;border-radius:8px;font-size:12px;color:#64748b">
        {{ inventaireItems.filter(i => i.stockCompte !== i.produit.stock).length }} écart(s) détecté(s) —
        La validation créera des mouvements d'ajustement automatiques.
      </div>
    }
  }

  <!-- ============ ONGLET HISTORIQUE PRIX STK-02 ============ -->
  @if (activeTab() === 'prix') {
    <div class="gw-table-wrapper">
      <div class="gw-table-toolbar">
        <div style="font-weight:600;font-size:14px">Historique des changements tarifaires</div>
        <div class="toolbar-spacer"></div>
        <span style="font-size:12px;color:#94a3b8">{{ prixHistorique().length }} modification(s)</span>
      </div>
      <table class="gw-table">
        <thead>
          <tr><th>Date</th><th>Produit</th><th>Prix Détail</th><th>Prix Gros</th><th>Prix Revendeur</th><th>Opérateur</th></tr>
        </thead>
        <tbody>
          @for (h of prixHistorique(); track h.id) {
            <tr>
              <td style="font-size:12px;color:#64748b">{{ h.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
              <td><strong>{{ h.produitNom }}</strong></td>
              <td>{{ h.ancienPrixDetail | number:'1.0-0' }} → <strong style="color:#0ea5e9">{{ h.nouveauPrixDetail | number:'1.0-0' }} F</strong></td>
              <td>{{ h.ancienPrixGros | number:'1.0-0' }} → <strong style="color:#0ea5e9">{{ h.nouveauPrixGros | number:'1.0-0' }} F</strong></td>
              <td>{{ h.ancienPrixRevendeur | number:'1.0-0' }} → <strong style="color:#0ea5e9">{{ h.nouveauPrixRevendeur | number:'1.0-0' }} F</strong></td>
              <td style="font-size:12px">{{ h.operateur }}</td>
            </tr>
          }
          @if (prixHistorique().length === 0) {
            <tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:28px">Aucun changement de prix enregistré</td></tr>
          }
        </tbody>
      </table>
    </div>
  }
</div>

<!-- ============ MODAL MOUVEMENT STK-08 ============ -->
@if (showModal()) {
  <div class="gw-modal-backdrop" (click)="closeModal()">
    <div class="gw-modal modal-sm" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title">{{ modalTitle() }}</div>
        <button class="modal-close" (click)="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group" style="margin-bottom:16px">
          <label>Produit *</label>
          <select class="form-control" [(ngModel)]="mvtForm.produitId" (change)="onProduitChange()">
            <option value="">Sélectionner un produit</option>
            @for (p of produits(); track p.id) {
              <option [value]="p.id">{{ p.nom }}</option>
            }
          </select>
        </div>
        <div class="form-group" style="margin-bottom:16px">
          <label>Type de mouvement *</label>
          <select class="form-control" [(ngModel)]="mvtForm.type" (change)="onTypeChange()">
            <option value="entree">Entrée (réapprovisionnement)</option>
            <option value="ajustement">Ajustement d'inventaire</option>
            <option value="perte">Perte / Casse</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom:16px">
          <label>Quantité *</label>
          <input type="number" class="form-control" [(ngModel)]="mvtForm.quantite" placeholder="0" min="1">
        </div>
        @if (mvtForm.type === 'entree') {
          <div class="form-group" style="margin-bottom:16px">
            <label>Coût unitaire (FCFA)</label>
            <input type="number" class="form-control" [(ngModel)]="mvtForm.cout" placeholder="0">
          </div>
        }
        <!-- STK-08: Perte enhancements -->
        @if (mvtForm.type === 'perte') {
          <div class="form-group" style="margin-bottom:12px">
            <label>Motif *</label>
            <select class="form-control" [(ngModel)]="mvtForm.motif">
              <option value="">-- Sélectionner un motif --</option>
              @for (s of motifSuggestions; track s) {
                <option [value]="s">{{ s }}</option>
              }
            </select>
          </div>
          @if (mvtForm.motif === 'Autre') {
            <div class="form-group" style="margin-bottom:12px">
              <label>Préciser le motif</label>
              <input class="form-control" [(ngModel)]="mvtMotifCustom" placeholder="Décrire la perte...">
            </div>
          }
          @if (valeurPerte > 0) {
            <div class="gw-alert alert-warning" style="margin-bottom:12px">
              <span class="alert-icon">💸</span>
              <div class="alert-content">
                <strong>Valeur de la perte :</strong> {{ valeurPerte | number:'1.0-0' }} FCFA
              </div>
            </div>
          }
        } @else {
          <div class="form-group">
            <label>Motif / Note</label>
            <input class="form-control" [(ngModel)]="mvtForm.motif" placeholder="Motif du mouvement...">
          </div>
        }
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" (click)="closeModal()">Annuler</button>
        <button class="btn btn-primary" (click)="saveMouvement()" [disabled]="saving()">
          @if (saving()) { <span class="loading-spinner" style="width:16px;height:16px;border-width:2px;margin:0"></span> }
          @else { Enregistrer }
        </button>
      </div>
    </div>
  </div>
}

<!-- ============ MODAL PRODUIT STK-Edit ============ -->
@if (showProduitModal()) {
  <div class="gw-modal-backdrop" (click)="showProduitModal.set(false)">
    <div class="gw-modal modal-lg" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <div>
          <div class="modal-title">{{ editingProduit ? 'Modifier le produit' : 'Nouveau produit' }}</div>
        </div>
        <button class="modal-close" (click)="showProduitModal.set(false)">✕</button>
      </div>
      <div class="modal-body">
        <div class="grid-2">
          <div class="form-group">
            <label>Nom du produit *</label>
            <input class="form-control" [(ngModel)]="produitForm.nom" placeholder="Ex: Eau minérale 1.5L">
          </div>
          <div class="form-group">
            <label>Code *</label>
            <input class="form-control" [(ngModel)]="produitForm.code" placeholder="Ex: EAU-15L" style="font-family:monospace">
          </div>
          <div class="form-group">
            <label>Catégorie</label>
            <input class="form-control" [(ngModel)]="produitForm.categorie" placeholder="Ex: Boisson">
          </div>
          <div class="form-group">
            <label>Unité</label>
            <select class="form-control" [(ngModel)]="produitForm.unite">
              <option value="unite">Unité</option>
              <option value="pack">Pack</option>
              <option value="palette">Palette</option>
            </select>
          </div>
          @if (produitForm.unite === 'pack' || produitForm.unite === 'palette') {
            <div class="form-group">
              <label>Unités par pack / palette</label>
              <input type="number" class="form-control" [(ngModel)]="produitForm.unitesParPack" min="1" placeholder="Ex: 24">
            </div>
          }
          <div class="form-group">
            <label>Prix détail (FCFA)</label>
            <input type="number" class="form-control" [(ngModel)]="produitForm.prixDetail" placeholder="0">
          </div>
          <div class="form-group">
            <label>Prix gros (FCFA)</label>
            <input type="number" class="form-control" [(ngModel)]="produitForm.prixGros" placeholder="0">
          </div>
          <div class="form-group">
            <label>Prix revendeur (FCFA)</label>
            <input type="number" class="form-control" [(ngModel)]="produitForm.prixRevendeur" placeholder="0">
          </div>
          <div class="form-group">
            <label>Coût d'achat (FCFA)</label>
            <input type="number" class="form-control" [(ngModel)]="produitForm.coutAchat" placeholder="0">
          </div>
          <div class="form-group">
            <label>Seuil d'alerte stock</label>
            <input type="number" class="form-control" [(ngModel)]="produitForm.seuilAlerte" placeholder="100">
          </div>
          <div class="form-group">
            <label>Statut</label>
            <select class="form-control" [(ngModel)]="produitForm.statut">
              <option value="actif">Actif</option>
              <option value="inactif">Inactif</option>
            </select>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" (click)="showProduitModal.set(false)">Annuler</button>
        <button class="btn btn-primary" (click)="saveProduit()" [disabled]="savingProduit()">
          @if (savingProduit()) { <span class="loading-spinner" style="width:16px;height:16px;border-width:2px;margin:0"></span> }
          @else { {{ editingProduit ? 'Enregistrer' : 'Créer le produit' }} }
        </button>
      </div>
    </div>
  </div>
}

<!-- ============ MODAL DÉCONDITIONNEMENT PACK -> UNITÉ STK-01 ============ -->
@if (showDecondModal()) {
  <div class="gw-modal-backdrop" (click)="showDecondModal.set(false)">
    <div class="gw-modal modal-md" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title">📦→🫗 Déconditionner un pack en unités</div>
        <button class="modal-close" (click)="showDecondModal.set(false)">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group" style="margin-bottom:12px">
          <label>Produit Pack source *</label>
          <select class="form-control" [(ngModel)]="decondForm.packProduitId" (change)="onPackSelect()">
            <option value="">Sélectionner un pack</option>
            @for (p of packProduits(); track p.id) {
              <option [value]="p.id">{{ p.nom }} (stock: {{ p.stock }})</option>
            }
          </select>
        </div>
        <div class="form-group" style="margin-bottom:12px">
          <label>Produit Unité destination *</label>
          <select class="form-control" [(ngModel)]="decondForm.uniteProduitId">
            <option value="">Sélectionner le produit à l'unité</option>
            @for (p of uniteProduits(); track p.id) {
              <option [value]="p.id">{{ p.nom }} (stock: {{ p.stock }})</option>
            }
          </select>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label>Nombre de packs à ouvrir *</label>
            <input type="number" class="form-control" [(ngModel)]="decondForm.nbPacks" min="1">
          </div>
          <div class="form-group">
            <label>Unités par pack *</label>
            <input type="number" class="form-control" [(ngModel)]="decondForm.unitesParPack" min="1">
          </div>
        </div>
        @if (decondForm.nbPacks > 0 && decondForm.unitesParPack > 0) {
          <div class="gw-alert alert-info" style="margin-top:12px">
            <span class="alert-icon">ℹ️</span>
            <div class="alert-content">
              Cette opération retirera <strong>{{ decondForm.nbPacks }} pack(s)</strong> et ajoutera <strong>{{ decondForm.nbPacks * decondForm.unitesParPack }} unité(s)</strong> atomiquement.
            </div>
          </div>
        }
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" (click)="showDecondModal.set(false)">Annuler</button>
        <button class="btn btn-primary" (click)="confirmerDecond()" [disabled]="saving()">
          {{ saving() ? 'Conversion...' : 'Confirmer la conversion' }}
        </button>
      </div>
    </div>
  </div>
}
  `
})
export class StockComponent implements OnInit {
  dataService = inject(DataService);
  toastService = inject(ToastService);
  authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  produits = signal<Produit[]>([]);
  mouvements = signal<MouvementStock[]>([]);
  prixHistorique = signal<PrixHistorique[]>([]);
  alertes = signal<Produit[]>([]);
  loading = signal(true);
  saving = signal(false);
  savingProduit = signal(false);
  showModal = signal(false);
  showProduitModal = signal(false);
  showDecondModal = signal(false);
  inventaireStarted = signal(false);
  activeTab = signal<'produits' | 'mouvements' | 'inventaire' | 'prix'>('produits');
  modalTitle = signal('Entrée de stock');

  decondForm = { packProduitId: '', uniteProduitId: '', nbPacks: 1, unitesParPack: 24 };

  inventaireItems: InventaireItem[] = [];
  editingProduit: Produit | null = null;
  mvtMotifCustom = '';
  searchMvt = '';
  filterMvtType = '';

  filteredMouvements(): MouvementStock[] {
    const q = this.searchMvt.trim().toLowerCase();
    return this.mouvements().filter(m => {
      const matchType = !this.filterMvtType || m.type === this.filterMvtType;
      const matchQuery = !q || m.produitNom.toLowerCase().includes(q) || (m.motif || '').toLowerCase().includes(q) || (m.operateur || '').toLowerCase().includes(q);
      return matchType && matchQuery;
    });
  }

  isPositiveMvt(m: MouvementStock): boolean {
    if (m.delta !== undefined) return m.delta >= 0;
    return m.type === 'entree';
  }

  mvtForm: Partial<MouvementStock> & { produitId?: string } = {
    type: 'entree', quantite: 0, motif: '', cout: 0, produitId: ''
  };

  produitForm: Partial<Produit> = {};

  motifSuggestions = ['Bouteilles cassées', 'Produits périmés', 'Vol', 'Dégâts matériels', 'Autre'];

  ngOnInit() { this.loadData(); }

  loadData() {
    this.loading.set(true);

    this.dataService.getProduits().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (data) => {
        this.produits.set(data);
        this.alertes.set(data.filter(p => p.stock <= p.seuilAlerte));
        this.loading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.toastService.error('Erreur chargement produits');
        this.loading.set(false);
      }
    });

    this.dataService.getMouvements().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (data) => {
        this.mouvements.set(data.map(m => ({
          ...m,
          createdAt: (m.createdAt as any)?.toDate?.() ?? new Date(m.createdAt as any)
        })));
        this.cdr.markForCheck();
      },
      error: (err) => console.error('Erreur chargement mouvements', err)
    });

    this.dataService.getPrixHistorique().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (data) => {
        this.prixHistorique.set(data);
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  packProduits() { return this.produits().filter(p => p.unite === 'pack' || p.unite === 'palette'); }
  uniteProduits() { return this.produits().filter(p => p.unite === 'unite'); }

  openDecondModal() {
    this.decondForm = { packProduitId: '', uniteProduitId: '', nbPacks: 1, unitesParPack: 24 };
    this.showDecondModal.set(true);
  }

  onPackSelect() {
    const p = this.produits().find(pr => pr.id === this.decondForm.packProduitId);
    if (p?.unitesParPack) this.decondForm.unitesParPack = p.unitesParPack;
  }

  async confirmerDecond() {
    if (!this.decondForm.packProduitId || !this.decondForm.uniteProduitId) {
      this.toastService.error('Sélectionnez le pack source et le produit destination.');
      return;
    }
    this.saving.set(true);
    try {
      await this.dataService.deconditionnerPack(this.decondForm);
      this.toastService.success(`Conversion effectuée : +${this.decondForm.nbPacks * this.decondForm.unitesParPack} unités ajoutées.`);
      this.showDecondModal.set(false);
    } catch (err: any) {
      this.toastService.error(err?.message || 'Erreur lors de la conversion.');
    } finally {
      this.saving.set(false);
    }
  }

  // STK-05: Métriques
  stockPct(p: Produit) {
    const max = Math.max(p.seuilAlerte * 3, p.stock);
    return Math.min(100, (p.stock / max) * 100);
  }

  valeurStockTotal(): number {
    return this.produits().reduce((s, p) => s + p.stock * p.coutAchat, 0);
  }

  rotation(p: Produit): number {
    const now = new Date();
    const sorties = this.mouvements()
      .filter(m => m.produitId === p.id && m.type === 'sortie' &&
                   m.createdAt.getMonth() === now.getMonth() &&
                   m.createdAt.getFullYear() === now.getFullYear())
      .reduce((s, m) => s + m.quantite, 0);
    return p.stock > 0 ? sorties / p.stock : 0;
  }

  lastEntree(produitId: string | undefined): Date | null {
    if (!produitId) return null;
    const entrees = this.mouvements()
      .filter(m => m.produitId === produitId && m.type === 'entree')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return entrees.length > 0 ? entrees[0].createdAt : null;
  }

  // STK-08: Pertes
  totalPertesMonth(): number {
    const now = new Date();
    return this.mouvements()
      .filter(m => m.type === 'perte' &&
                   m.createdAt.getMonth() === now.getMonth() &&
                   m.createdAt.getFullYear() === now.getFullYear())
      .reduce((sum, m) => {
        const p = this.produits().find(pr => pr.id === m.produitId);
        return sum + (m.quantite * (p?.coutAchat || m.cout || 0));
      }, 0);
  }

  get valeurPerte(): number {
    if (!this.mvtForm.produitId || !this.mvtForm.quantite) return 0;
    const p = this.produits().find(pr => pr.id === this.mvtForm.produitId);
    return (p?.coutAchat || 0) * (this.mvtForm.quantite || 0);
  }

  typeBadge(type: string) {
    return ({ entree: 'badge-success', sortie: 'badge-secondary', ajustement: 'badge-info', perte: 'badge-danger' } as any)[type] || 'badge-secondary';
  }

  typeLabel(type: string) {
    return ({ entree: '↑ Entrée', sortie: '↓ Sortie', ajustement: '⇄ Ajustement', perte: '✗ Perte' } as any)[type] || type;
  }

  // STK-07: Inventaire
  inventaireDate(): string {
    return new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  lancerInventaire() {
    this.inventaireItems = this.produits().map(p => ({ produit: p, stockCompte: p.stock }));
    this.inventaireStarted.set(true);
  }

  async validerInventaire() {
    const ecarts = this.inventaireItems.filter(i => i.stockCompte !== i.produit.stock);
    if (ecarts.length === 0) {
      this.toastService.info('Aucun écart constaté. L\'inventaire est conforme !');
      return;
    }
    if (!confirm(`Valider l'inventaire ? ${ecarts.length} mouvement(s) d'ajustement seront créés pour les écarts constatés.`)) return;

    const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const results = await Promise.allSettled(ecarts.map(async item => {
      const ecart = item.stockCompte - item.produit.stock;
      await this.dataService.addMouvement({
        produitId: item.produit.id!,
        produitNom: item.produit.nom,
        type: 'ajustement',
        quantite: Math.abs(ecart),
        delta: ecart,
        motif: `Inventaire physique du ${dateStr} (théorique ${item.produit.stock} → compté ${item.stockCompte})`,
        operateur: this.authService.currentUser?.displayName || 'Admin',
        createdAt: new Date(),
      });
      void this.dataService.logAudit(
        'STOCK_AJUSTE',
        item.produit.nom,
        `Inventaire du ${dateStr} : ${item.produit.stock} → ${item.stockCompte} (écart ${ecart >= 0 ? '+' : ''}${ecart})`,
        this.authService.currentUser?.uid || '',
        this.authService.currentUser?.displayName || 'Admin'
      );
    }));
    const count = results.filter(r => r.status === 'fulfilled').length;
    this.toastService.success(`Inventaire validé ! ${count} ajustement(s) créé(s).`);
    this.inventaireStarted.set(false);
    this.inventaireItems = [];
  }

  // Modals
  openModal() {
    this.mvtForm = { type: 'entree', quantite: 0, motif: '', cout: 0, produitId: '' };
    this.mvtMotifCustom = '';
    this.modalTitle.set('Nouveau mouvement de stock');
    this.showModal.set(true);
  }

  openEntree(p: Produit) {
    this.mvtForm = { type: 'entree', quantite: 0, motif: '', cout: p.coutAchat, produitId: p.id };
    this.mvtMotifCustom = '';
    this.modalTitle.set('Entrée de stock — ' + p.nom);
    this.showModal.set(true);
  }

  openEditProduit(p: Produit) {
    this.editingProduit = p;
    this.produitForm = { ...p };
    this.showProduitModal.set(true);
  }

  openNewProduit() {
    this.editingProduit = null;
    this.produitForm = {
      code: '', nom: '', categorie: 'Boisson', unite: 'unite',
      prixDetail: 0, prixGros: 0, prixRevendeur: 0, coutAchat: 0,
      seuilAlerte: 100, statut: 'actif'
    };
    this.showProduitModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.mvtForm = { type: 'entree', quantite: 0, motif: '', cout: 0, produitId: '' };
    this.mvtMotifCustom = '';
  }

  onProduitChange() {}
  onTypeChange() { this.mvtForm.motif = ''; this.mvtMotifCustom = ''; }

  async saveMouvement() {
    if (!this.mvtForm.produitId || !this.mvtForm.quantite) {
      this.toastService.error('Produit et quantité sont obligatoires.');
      return;
    }
    if (this.mvtForm.type === 'perte' && !this.mvtForm.motif) {
      this.toastService.error('Le motif est obligatoire pour une perte.');
      return;
    }

    let finalMotif = this.mvtForm.motif;
    if (this.mvtForm.type === 'perte' && this.mvtForm.motif === 'Autre') {
      finalMotif = this.mvtMotifCustom || 'Autre perte';
    }

    this.saving.set(true);
    try {
      const produit = this.produits().find(p => p.id === this.mvtForm.produitId);
      await this.dataService.addMouvement({
        produitId: this.mvtForm.produitId!,
        produitNom: produit?.nom || '',
        type: this.mvtForm.type as any,
        quantite: this.mvtForm.quantite!,
        cout: this.mvtForm.cout,
        motif: finalMotif,
        operateur: this.authService.currentUser?.displayName || 'Inconnu',
        createdAt: new Date(),
      });
      this.toastService.success('Mouvement enregistré avec succès !');
      this.closeModal();
    } catch {
      this.toastService.error('Erreur lors de l\'enregistrement.');
    } finally {
      this.saving.set(false);
    }
  }

  async saveProduit() {
    if (!this.produitForm.nom || !this.produitForm.code) {
      this.toastService.error('Nom et code sont obligatoires.');
      return;
    }
    this.savingProduit.set(true);
    try {
      if (this.editingProduit?.id) {
        await this.dataService.updateProduit(this.editingProduit.id, this.produitForm, this.editingProduit);
        this.toastService.success('Produit modifié avec succès !');
      } else {
        await this.dataService.addProduit({
          code: this.produitForm.code!,
          nom: this.produitForm.nom!,
          categorie: this.produitForm.categorie || 'Boisson',
          unite: (this.produitForm.unite as any) || 'unite',
          unitesParPack: this.produitForm.unitesParPack,
          prixDetail: this.produitForm.prixDetail || 0,
          prixGros: this.produitForm.prixGros || 0,
          prixRevendeur: this.produitForm.prixRevendeur || 0,
          coutAchat: this.produitForm.coutAchat || 0,
          stock: 0,
          seuilAlerte: this.produitForm.seuilAlerte || 100,
          statut: 'actif',
        });
        this.toastService.success('Produit créé avec succès !');
      }
      this.showProduitModal.set(false);
      this.editingProduit = null;
      this.produitForm = {};
    } catch {
      this.toastService.error('Erreur lors de la sauvegarde du produit.');
    } finally {
      this.savingProduit.set(false);
    }
  }
}

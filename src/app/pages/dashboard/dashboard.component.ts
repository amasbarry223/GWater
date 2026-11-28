import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { DataService } from '../../core/data.service';
import { AuthService } from '../../core/auth.service';
import { FcfaPipe } from '../../core/fcfa.pipe';
import { Client, Depense, Livraison, Paiement, Produit, Vente } from '../../core/models';
import { EvolutionPeriod, SalesEvolutionChartComponent } from './components/sales-evolution-chart.component';
import { SalesDonutChartComponent } from './components/sales-donut-chart.component';

const FR_NUMBER_FORMAT = new Intl.NumberFormat('fr-FR');

interface RecentVenteRow {
  id: string;
  numero: string;
  client: string;
  produits: string;
  montant: string;
  date: string;
  statut: string;
  badgeClass: string;
}

interface TransfertRecord {
  montant?: number;
  source?: string;
  destination?: string;
}

interface PeriodeRecord {
  id?: string;
  periode?: string;
  statut?: string;
  cloturePar?: string;
}

interface ArreteRecord {
  createdAt?: unknown;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, FcfaPipe, SalesEvolutionChartComponent, SalesDonutChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; }

    /* =====================================================
       AQUATIC HERO BANNER (Compact & Action-Oriented)
       ===================================================== */
    .dash-hero {
      position: relative;
      margin: 0 -26px 16px;
      padding: 66px 26px 18px;
      background:
        radial-gradient(circle at 68% 35%, rgba(186, 230, 253, 0.72) 0%, rgba(226, 242, 255, 0.3) 45%, transparent 72%),
        linear-gradient(120deg, #eaf4fe 0%, #dceeff 48%, #d4ebff 75%, #e6f3fe 100%);
      overflow: hidden;
      min-height: 132px;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 20px;
    }
    .dash-hero::after {
      content: '';
      position: absolute;
      inset: auto 0 0 0;
      height: 28px;
      background: linear-gradient(180deg, rgba(238, 245, 252, 0) 0%, rgba(238, 245, 252, 0.96) 100%);
      pointer-events: none;
      z-index: 2;
    }
    .hero-copy {
      position: relative;
      z-index: 3;
      max-width: 520px;
      padding-bottom: 4px;
    }
    .hero-greeting {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 24px;
      font-weight: 800;
      color: #0b2242;
      letter-spacing: -0.025em;
      line-height: 1.18;
      margin: 0;
    }
    .hero-wave-emoji {
      font-size: 25px;
      line-height: 1;
      display: inline-block;
    }
    .hero-subtitle {
      font-size: 13.5px;
      color: #354c68;
      margin: 5px 0 0;
      font-weight: 500;
    }
    .hero-visual {
      position: absolute;
      right: 160px;
      bottom: -14px;
      height: 148px;
      width: 480px;
      max-width: 48%;
      object-fit: contain;
      object-position: right bottom;
      pointer-events: none;
      z-index: 1;
      opacity: 0.9;
    }
    .hero-actions {
      position: relative;
      z-index: 3;
      display: flex;
      align-items: center;
      gap: 10px;
      padding-bottom: 4px;
      flex-shrink: 0;
    }
    .hero-cta {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 10px 18px;
      min-height: 44px;
      border-radius: 12px;
      background: linear-gradient(90deg, #005ad6 0%, #0072f5 100%);
      color: #ffffff;
      font-size: 13.5px;
      font-weight: 700;
      text-decoration: none;
      box-shadow: 0 6px 16px rgba(0, 90, 214, 0.28);
      transition: transform 0.14s ease, box-shadow 0.14s ease;
    }
    .hero-cta:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 20px rgba(0, 90, 214, 0.36);
    }

    /* Top Operational Alert / Error Banners */
    .dash-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 14px;
      margin-bottom: 16px;
      font-size: 13px;
      font-weight: 600;
      flex-wrap: wrap;
    }
    .dash-banner.is-warning {
      background: #fff5e0;
      border: 1px solid #fbd38d;
      color: #7c3b03;
    }
    .dash-banner.is-error {
      background: #feeceb;
      border: 1px solid #f5b7b1;
      color: #991b1b;
    }
    .dash-banner-main {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    /* Loading Skeletons */
    .skeleton-card {
      border-radius: 18px;
      min-height: 112px;
      background: linear-gradient(90deg, #e5eff9 25%, #f1f7fd 50%, #e5eff9 75%);
      background-size: 200% 100%;
      animation: gw-shimmer 1.4s infinite linear;
      border: 1px solid #dbe8f6;
    }
    @keyframes gw-shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* =====================================================
       ROW 1 — 4 PASTEL KPI CARDS
       ===================================================== */
    .dash-kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 16px;
      margin-bottom: 18px;
      position: relative;
      z-index: 3;
    }

    .pastel-kpi {
      position: relative;
      border-radius: 18px;
      padding: 17px 18px 16px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.85);
      box-shadow: 0 8px 22px -6px rgba(10, 42, 88, 0.08);
      display: flex;
      align-items: flex-start;
      gap: 13px;
      min-height: 112px;
      text-decoration: none;
      color: inherit;
    }
    .pastel-kpi.kpi-sky {
      background: linear-gradient(135deg, #e8f4ff 0%, #d2e9ff 100%);
    }
    .pastel-kpi.kpi-mint {
      background: linear-gradient(135deg, #e8fcf2 0%, #d2f6e5 100%);
    }
    .pastel-kpi.kpi-lavender {
      background: linear-gradient(135deg, #f1ecff 0%, #e4dbff 100%);
    }
    .pastel-kpi.kpi-peach {
      background: linear-gradient(135deg, #fff2e6 0%, #ffe3c8 100%);
    }

    .pastel-kpi-icon {
      width: 46px;
      height: 46px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      position: relative;
      z-index: 2;
      margin-top: 2px;
    }
    .kpi-sky .pastel-kpi-icon      { background: rgba(11, 102, 245, 0.14); color: #0b66f5; }
    .kpi-mint .pastel-kpi-icon     { background: rgba(13, 159, 110, 0.14); color: #0c9463; }
    .kpi-lavender .pastel-kpi-icon { background: rgba(109, 40, 217, 0.14); color: #6d28d9; }
    .kpi-peach .pastel-kpi-icon    { background: rgba(234, 88, 12, 0.14); color: #e2580c; }

    .pastel-kpi-body {
      position: relative;
      z-index: 2;
      min-width: 0;
      flex: 1;
    }
    .pastel-kpi-label {
      font-size: 13px;
      font-weight: 600;
      color: #29415f;
      margin-bottom: 5px;
    }
    .pastel-kpi-value-row {
      display: flex;
      align-items: baseline;
      gap: 7px;
      flex-wrap: wrap;
    }
    .pastel-kpi-value {
      font-size: 22px;
      font-weight: 800;
      color: #0b1f3b;
      letter-spacing: -0.025em;
      line-height: 1.15;
      font-variant-numeric: tabular-nums;
    }
    .pastel-kpi-unit {
      font-size: 14px;
      font-weight: 700;
      color: #163052;
    }
    .pastel-kpi-sub {
      font-size: 11.5px;
      font-weight: 600;
      color: #36574c;
      margin-top: 6px;
      font-variant-numeric: tabular-nums;
    }
    .pastel-kpi-trend {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      margin-top: 6px;
      font-size: 12px;
      font-weight: 700;
      color: #0d9464;
    }
    .pastel-kpi-trend.inline {
      margin-top: 0;
    }
    .pastel-kpi-trend.down {
      color: #cf2e2e;
    }
    .pastel-kpi-trend.neutral {
      color: #4b6584;
    }

    .kpi-deco-svg {
      position: absolute;
      right: 8px;
      bottom: 6px;
      pointer-events: none;
      z-index: 1;
    }
    .kpi-deco-boxes {
      position: absolute;
      right: 8px;
      bottom: 4px;
      width: 68px;
      height: auto;
      pointer-events: none;
      z-index: 1;
    }

    /* =====================================================
       ROW 2 — ANALYTICS (Évolution + Répartition)
       ===================================================== */
    .dash-analytics-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.56fr) minmax(0, 1fr);
      gap: 18px;
      margin-bottom: 18px;
    }

    .repartition-card {
      background: #ffffff;
      border-radius: 18px;
      box-shadow: var(--gw-shadow);
      border: 1px solid rgba(226, 237, 249, 0.9);
      overflow: hidden;
      display: grid;
      grid-template-columns: 1.08fr 0.92fr;
      min-height: 295px;
    }
    .repartition-left {
      padding: 18px 16px 18px 20px;
      display: flex;
      flex-direction: column;
    }
    .repartition-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      font-weight: 700;
      color: var(--gw-text);
      margin: 0 0 12px;
    }
    .repartition-icon {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: #eceeff;
      color: #4f46e5;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .repartition-chart-slot {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .repartition-right {
      position: relative;
      background-color: #d9eeff;
      background-image: url('/images/repartition-water-panel.svg');
      background-size: cover;
      background-position: center;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      padding: 20px 18px;
    }
    .repartition-promo-title {
      font-size: 17px;
      font-weight: 800;
      color: #0b2242;
      letter-spacing: -0.02em;
      line-height: 1.2;
      position: relative;
      z-index: 2;
    }
    .repartition-promo-sub {
      font-size: 12.5px;
      font-weight: 600;
      color: #1f446b;
      margin-top: 4px;
      line-height: 1.35;
      max-width: 145px;
      position: relative;
      z-index: 2;
    }

    /* =====================================================
       ROW 3 — DERNIÈRES VENTES + ACTIONS RAPIDES + ALERTE STOCK
       ===================================================== */
    .dash-bottom-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.85fr) minmax(0, 1.15fr) minmax(0, 0.96fr);
      gap: 18px;
      align-items: stretch;
    }

    .bottom-card {
      background: #ffffff;
      border-radius: 18px;
      box-shadow: var(--gw-shadow);
      border: 1px solid rgba(226, 237, 249, 0.9);
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
    }

    .bottom-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 12px;
    }
    .bottom-card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      font-weight: 700;
      color: var(--gw-text);
      margin: 0;
    }
    .bottom-card-link {
      font-size: 12.5px;
      font-weight: 600;
      color: #005ad6;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .bottom-card-link:hover { text-decoration: underline; }

    /* Compact Dashboard Sales Table */
    .dash-table-wrap {
      overflow-x: auto;
      flex: 1;
    }
    .dash-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;
    }
    .dash-table thead th {
      text-align: left;
      padding: 8px 8px 9px;
      font-size: 11.5px;
      font-weight: 600;
      color: #52667d;
      border-bottom: 1px solid #eef3f9;
      white-space: nowrap;
    }
    .dash-table tbody td {
      padding: 10px 8px;
      color: var(--gw-text);
      border-bottom: 1px solid #f4f7fb;
      white-space: nowrap;
      vertical-align: middle;
    }
    .dash-table tbody tr:last-child td { border-bottom: none; }
    .dash-table tbody tr:hover { background: #f8fbff; }
    .sale-ref {
      font-weight: 700;
      color: #163254;
      font-variant-numeric: tabular-nums;
    }
    .sale-amount {
      font-weight: 700;
      color: #0b1f3b;
      font-variant-numeric: tabular-nums;
    }
    .sale-date {
      color: #5b718c;
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }

    /* Actions Rapides 4 Pastel Tiles */
    .quick-actions-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      flex: 1;
      align-items: stretch;
    }
    .quick-tile {
      border-radius: 14px;
      padding: 14px 8px;
      text-decoration: none;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 9px;
      transition: transform 0.16s ease, box-shadow 0.16s ease;
    }
    .quick-tile:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 18px -6px rgba(10, 42, 88, 0.14);
    }
    .quick-tile.tile-blue     { background: linear-gradient(180deg, #e8f4ff 0%, #dceeff 100%); color: #0b66f5; }
    .quick-tile.tile-mint     { background: linear-gradient(180deg, #e7fbf1 0%, #d8f5e7 100%); color: #0c9463; }
    .quick-tile.tile-lavender { background: linear-gradient(180deg, #f2edff 0%, #e7dfff 100%); color: #6d28d9; }
    .quick-tile.tile-peach    { background: linear-gradient(180deg, #fff2e6 0%, #ffe6cf 100%); color: #e2580c; }
    .quick-tile-icon {
      width: 38px;
      height: 38px;
      border-radius: 11px;
      background: rgba(255, 255, 255, 0.72);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .quick-tile-label {
      font-size: 12px;
      font-weight: 700;
      color: #162e4d;
      line-height: 1.22;
    }

    /* Alerte Stock Amber Card */
    .stock-alert-card {
      position: relative;
      border-radius: 18px;
      background: linear-gradient(135deg, #fff4df 0%, #ffe2b7 100%);
      border: 1px solid rgba(255, 224, 178, 0.9);
      box-shadow: var(--gw-shadow);
      padding: 18px 18px 18px 20px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .stock-alert-card.healthy {
      background: linear-gradient(135deg, #e8fcf2 0%, #d2f5e4 100%);
      border-color: rgba(167, 243, 208, 0.9);
    }
    .stock-alert-content {
      position: relative;
      z-index: 2;
      max-width: 68%;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .stock-alert-title {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 15px;
      font-weight: 800;
      color: #8c4803;
      margin: 0;
    }
    .stock-alert-card.healthy .stock-alert-title {
      color: #065f46;
    }
    .stock-alert-copy {
      font-size: 12.5px;
      line-height: 1.45;
      color: #4a3519;
      margin: 0;
    }
    .stock-alert-copy strong {
      color: #2c1d09;
    }
    .stock-alert-highlight {
      color: #b45309;
      font-weight: 700;
    }
    .stock-alert-card.healthy .stock-alert-copy { color: #164e3f; }
    .stock-alert-card.healthy .stock-alert-highlight { color: #059669; }

    .stock-alert-cta {
      align-self: flex-start;
      margin-top: 4px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 15px;
      min-height: 36px;
      border-radius: 999px;
      background: linear-gradient(90deg, #b45309 0%, #c2610c 100%);
      color: #ffffff;
      font-size: 12px;
      font-weight: 700;
      text-decoration: none;
      box-shadow: 0 5px 14px rgba(180, 83, 9, 0.28);
      transition: transform 0.14s ease, box-shadow 0.14s ease;
    }
    .stock-alert-cta:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 18px rgba(180, 83, 9, 0.36);
    }
    .stock-alert-card.healthy .stock-alert-cta {
      background: linear-gradient(90deg, #047857 0%, #059669 100%);
      box-shadow: 0 5px 14px rgba(4, 120, 87, 0.28);
    }
    .stock-alert-bottle {
      position: relative;
      z-index: 2;
      height: 152px;
      width: auto;
      margin: -10px -6px -14px 0;
      flex-shrink: 0;
      pointer-events: none;
    }

    /* =====================================================
       RESPONSIVE BREAKPOINTS
       ===================================================== */
    @media (max-width: 1320px) {
      .dash-bottom-grid {
        grid-template-columns: 1fr 1fr;
      }
      .stock-alert-card {
        grid-column: span 2;
      }
    }

    @media (max-width: 1180px) {
      .dash-kpi-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .dash-analytics-grid {
        grid-template-columns: 1fr;
      }
      .hero-visual {
        right: 14px;
        opacity: 0.35;
      }
    }

    @media (max-width: 820px) {
      .dash-hero {
        margin: 0 -16px 16px;
        padding: 64px 16px 16px;
        min-height: 116px;
        flex-direction: column;
        align-items: flex-start;
      }
      .hero-greeting { font-size: 21px; }
      .hero-visual { opacity: 0.2; height: 120px; }
      .dash-kpi-grid { grid-template-columns: 1fr; }
      .dash-bottom-grid { grid-template-columns: 1fr; }
      .stock-alert-card { grid-column: auto; }
      .repartition-card { grid-template-columns: 1fr; }
      .repartition-right { min-height: 150px; }
      .quick-actions-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  `],
  template: `
<!-- AQUATIC HERO BANNER -->
<section class="dash-hero" aria-label="Bienvenue sur GWater">
  <div class="hero-copy">
    <h1 class="hero-greeting">
      <span class="hero-wave-emoji" aria-hidden="true">👋</span>
      <span>Bonjour {{ displayName() }} !</span>
    </h1>
    <p class="hero-subtitle">Activité du {{ todayLabel() }} — aperçu en temps réel de votre distribution d'eau.</p>
  </div>

  <img class="hero-visual" src="/images/hero-water-bottles.svg" alt="" aria-hidden="true"/>

  @if (isAdmin() || isVendeur()) {
    <div class="hero-actions">
      <a class="hero-cta" routerLink="/ventes">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        <span>Nouvelle vente</span>
      </a>
    </div>
  }
</section>

@if (loadError()) {
  <div class="dash-banner is-error" role="alert">
    <div class="dash-banner-main">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2L1 21h22L12 2zm1 15h-2v-2h2v2zm0-4h-2V9h2v4z"/>
      </svg>
      <span>{{ loadError() }}</span>
    </div>
    <button type="button" class="btn btn-danger btn-sm" (click)="retryLoad()">Réessayer</button>
  </div>
}

<!-- ===================================================== -->
<!-- VUE ADMIN / SUPERADMIN                                -->
<!-- ===================================================== -->
@if (isAdmin()) {
  @if (!loading() && stockAlertes().length > 0) {
    <div class="dash-banner is-warning" role="status">
      <div class="dash-banner-main">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2L1 21h22L12 2zm1 15h-2v-2h2v2zm0-4h-2V9h2v4z"/>
        </svg>
        <span>
          <strong>{{ stockAlertes().length }} {{ stockAlertes().length > 1 ? 'produits sous le seuil' : 'produit sous le seuil' }}</strong>
          — Point critique : {{ stockAlertes()[0].nom }} ({{ formatNumber(stockAlertes()[0].stock) }} restant{{ stockAlertes()[0].stock > 1 ? 's' : '' }}).
        </span>
      </div>
      <a class="btn btn-warning btn-sm" routerLink="/stock">Gérer le stock</a>
    </div>
  }

  <!-- ROW 1: 4 PASTEL KPI CARDS -->
  @if (loading()) {
    <section class="dash-kpi-grid" aria-label="Chargement des indicateurs">
      <div class="skeleton-card" aria-hidden="true"></div>
      <div class="skeleton-card" aria-hidden="true"></div>
      <div class="skeleton-card" aria-hidden="true"></div>
      <div class="skeleton-card" aria-hidden="true"></div>
    </section>
  } @else {
    <section class="dash-kpi-grid" aria-label="Indicateurs clés">
      <!-- 1. Ventes Aujourd'hui -->
      <a class="pastel-kpi kpi-sky" routerLink="/ventes">
        <div class="pastel-kpi-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
          </svg>
        </div>
        <div class="pastel-kpi-body">
          <div class="pastel-kpi-label">Ventes Aujourd'hui</div>
          <div class="pastel-kpi-value">{{ caJour() | fcfa }}</div>
          <div class="pastel-kpi-trend" [class.down]="ventesTrend().direction === 'down'" [class.neutral]="ventesTrend().direction === 'flat'">
            {{ ventesTrend().text }}
            @if (livraisonsAFaire().length > 0) {
              <span style="margin-left:6px;color:#1e3a5f">• {{ livraisonsAFaire().length }} livr. en attente</span>
            }
          </div>
        </div>
        <svg class="kpi-deco-svg" width="84" height="42" viewBox="0 0 84 42" fill="none" aria-hidden="true">
          <path d="M2 38 L18 28 L31 32 L49 17 L63 22 L82 6 L82 42 L2 42 Z" fill="#0b74f5" fill-opacity="0.14"/>
          <path d="M2 38 L18 28 L31 32 L49 17 L63 22 L82 6" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.65"/>
        </svg>
      </a>

      <!-- 2. Stock Total -->
      <a class="pastel-kpi kpi-mint" routerLink="/stock">
        <div class="pastel-kpi-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
          </svg>
        </div>
        <div class="pastel-kpi-body">
          <div class="pastel-kpi-label">Stock Total</div>
          <div class="pastel-kpi-value-row">
            <span class="pastel-kpi-value">{{ formatNumber(stockSummary().total) }}</span>
            <span class="pastel-kpi-unit">bouteille{{ stockSummary().total > 1 ? 's' : '' }}</span>
          </div>
          <div class="pastel-kpi-sub">0,5 L : {{ formatNumber(stockSummary().s05) }} | 1,5 L : {{ formatNumber(stockSummary().s15) }}</div>
        </div>
        <img class="kpi-deco-boxes" src="/images/kpi-boxes.svg" alt="" aria-hidden="true"/>
      </a>

      <!-- 3. Clients Actifs -->
      <a class="pastel-kpi kpi-lavender" routerLink="/clients">
        <div class="pastel-kpi-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <div class="pastel-kpi-body">
          <div class="pastel-kpi-label">Clients Actifs</div>
          <div class="pastel-kpi-value-row">
            <span class="pastel-kpi-value">{{ formatNumber(clientsActifs()) }}</span>
            @if (clientsTrend()) {
              <span class="pastel-kpi-trend inline">{{ clientsTrend() }}</span>
            }
          </div>
          <div class="pastel-kpi-sub" style="color:#4c3880">{{ totalClients() }} {{ totalClients() > 1 ? 'enregistrés' : 'enregistré' }} au total</div>
        </div>
        <svg class="kpi-deco-svg" width="76" height="54" viewBox="0 0 76 54" fill="none" aria-hidden="true">
          <circle cx="20" cy="22" r="8" fill="#8b5cf6" opacity="0.22"/>
          <path d="M8 50 C8 40, 13 35, 20 35 C27 35, 32 40, 32 50 Z" fill="#8b5cf6" opacity="0.22"/>
          <circle cx="56" cy="22" r="8" fill="#8b5cf6" opacity="0.22"/>
          <path d="M44 50 C44 40, 49 35, 56 35 C63 35, 68 40, 68 50 Z" fill="#8b5cf6" opacity="0.22"/>
          <circle cx="38" cy="18" r="10" fill="#7c3aed" opacity="0.32"/>
          <path d="M22 52 C22 39, 29 33, 38 33 C47 33, 54 39, 54 52 Z" fill="#7c3aed" opacity="0.32"/>
        </svg>
      </a>

      <!-- 4. Solde Caisse & Créances -->
      <a class="pastel-kpi kpi-peach" routerLink="/comptabilite">
        <div class="pastel-kpi-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3"/>
            <path d="M16 12h5v4h-5a2 2 0 0 1 0-4z"/>
          </svg>
        </div>
        <div class="pastel-kpi-body">
          <div class="pastel-kpi-label">Solde Caisse</div>
          <div class="pastel-kpi-value">{{ totalTresorerie() | fcfa }}</div>
          <div class="pastel-kpi-sub" style="color:#7c3e12">
            Créances : {{ creancesTotal() | fcfa }}
          </div>
        </div>
        <svg class="kpi-deco-svg" width="84" height="42" viewBox="0 0 84 42" fill="none" aria-hidden="true">
          <path d="M4 37 L18 25 L30 30 L45 19 L58 24 L80 8 L80 42 L4 42 Z" fill="#f97316" fill-opacity="0.14"/>
          <path d="M4 37 L18 25 L30 30 L45 19 L58 24 L80 8" stroke="#ea580c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.65"/>
        </svg>
      </a>
    </section>
  }

  <!-- ROW 2: ÉVOLUTION DES VENTES + RÉPARTITION DES VENTES -->
  @defer (on idle) {
    <section class="dash-analytics-grid" aria-label="Analyses des ventes">
      <app-sales-evolution-chart
        [labels]="evolutionData().labels"
        [series05L]="evolutionData().s05"
        [series15L]="evolutionData().s15"
        [period]="evoPeriod()"
        (periodChange)="evoPeriod.set($event)" />

      <div class="repartition-card">
        <div class="repartition-left">
          <h2 class="repartition-title">
            <span class="repartition-icon" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11 2v10h10a10 10 0 1 1-10-10zm2 0a10 10 0 0 1 8 8h-8V2z"/>
              </svg>
            </span>
            <span>Répartition des Ventes</span>
          </h2>
          <div class="repartition-chart-slot">
            <app-sales-donut-chart
              [pct05L]="repartitionData().pct05"
              [pct15L]="repartitionData().pct15"
              [total05L]="repartitionData().total05"
              [total15L]="repartitionData().total15"
              [hasData]="repartitionData().hasData" />
          </div>
        </div>

        <div class="repartition-right">
          <div class="repartition-promo-title">0,5 L &amp; 1,5 L</div>
          <div class="repartition-promo-sub">La fraîcheur où que vous soyez</div>
        </div>
      </div>
    </section>
  } @placeholder {
    <section class="dash-analytics-grid" aria-hidden="true">
      <div class="skeleton-card" style="min-height:295px"></div>
      <div class="skeleton-card" style="min-height:295px"></div>
    </section>
  }

  <!-- ROW 3: DERNIÈRES VENTES + ACTIONS RAPIDES + ALERTE STOCK -->
  <section class="dash-bottom-grid" aria-label="Activité récente et actions">
    <!-- Dernières Ventes -->
    <div class="bottom-card">
      <div class="bottom-card-header">
        <h2 class="bottom-card-title">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0066e6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
          </svg>
          <span>Dernières Ventes</span>
        </h2>
        <a class="bottom-card-link" routerLink="/ventes">Tout afficher</a>
      </div>

      <div class="dash-table-wrap">
        <table class="dash-table" aria-label="Dernières ventes">
          <thead>
            <tr>
              <th scope="col"># Réf.</th>
              <th scope="col">Client</th>
              <th scope="col">Produits</th>
              <th scope="col">Montant</th>
              <th scope="col">Date</th>
              <th scope="col">Statut</th>
            </tr>
          </thead>
          <tbody>
            @for (v of recentVentes(); track v.id || v.numero) {
              <tr>
                <td class="sale-ref">{{ v.numero }}</td>
                <td>{{ v.client }}</td>
                <td>{{ v.produits }}</td>
                <td class="sale-amount">{{ v.montant }}</td>
                <td class="sale-date">{{ v.date }}</td>
                <td><span class="badge" [class]="v.badgeClass">{{ v.statut }}</span></td>
              </tr>
            }
            @if (!loading() && recentVentes().length === 0) {
              <tr>
                <td colspan="6" style="text-align:center;padding:24px 8px;color:var(--gw-muted)">
                  Aucune vente enregistrée.
                  <a routerLink="/ventes" style="color:#005ad6;font-weight:600;margin-left:6px;text-decoration:none">Créer une vente</a>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Actions Rapides -->
    <div class="bottom-card">
      <div class="bottom-card-header">
        <h2 class="bottom-card-title">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0066e6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          <span>Actions Rapides</span>
        </h2>
      </div>

      <div class="quick-actions-grid">
        <a class="quick-tile tile-blue" routerLink="/ventes">
          <span class="quick-tile-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
          </span>
          <span class="quick-tile-label">Nouvelle<br>Vente</span>
        </a>

        <a class="quick-tile tile-mint" routerLink="/stock">
          <span class="quick-tile-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
          </span>
          <span class="quick-tile-label">Gérer le<br>Stock</span>
        </a>

        <a class="quick-tile tile-lavender" routerLink="/clients">
          <span class="quick-tile-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/>
              <line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
            </svg>
          </span>
          <span class="quick-tile-label">Ajouter<br>Client</span>
        </a>

        <a class="quick-tile tile-peach" routerLink="/rapports">
          <span class="quick-tile-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </span>
          <span class="quick-tile-label">Voir<br>Rapports</span>
        </a>
      </div>
    </div>

    <!-- Alerte Stock -->
    <div class="stock-alert-card" [class.healthy]="stockAlertes().length === 0" [attr.role]="stockAlertes().length > 0 ? 'status' : null">
      <div class="stock-alert-content">
        <h2 class="stock-alert-title">
          @if (stockAlertes().length > 0) {
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2L1 21h22L12 2zm1 15h-2v-2h2v2zm0-4h-2V9h2v4z"/>
            </svg>
            <span>Alerte Stock ({{ stockAlertes().length }})</span>
          } @else {
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <span>Suivi Stock</span>
          }
        </h2>

        @if (featuredStockProduit(); as prod) {
          @if (stockAlertes().length > 0) {
            <p class="stock-alert-copy">
              Le stock du produit <strong>{{ prod.nom }}</strong> est faible
              <span class="stock-alert-highlight">({{ formatNumber(prod.stock) }} {{ unitLabel(prod) }}).</span>
            </p>
          } @else {
            <p class="stock-alert-copy">
              Tous les produits sont disponibles. Point bas actuel : <strong>{{ prod.nom }}</strong>
              <span class="stock-alert-highlight">({{ formatNumber(prod.stock) }} en stock).</span>
            </p>
          }
        } @else {
          <p class="stock-alert-copy">Ajoutez vos références d'eau pour activer la surveillance automatique des seuils.</p>
        }

        <a class="stock-alert-cta" routerLink="/stock">
          {{ stockAlertes().length > 0 ? 'Réapprovisionner' : 'Gérer le stock' }}
        </a>
      </div>

      <img class="stock-alert-bottle" src="/images/alert-bottle.svg" alt="" aria-hidden="true"/>
    </div>
  </section>
}

<!-- ===================================================== -->
<!-- VUE VENDEUR                                           -->
<!-- ===================================================== -->
@if (isVendeur()) {
  <section class="dash-kpi-grid" aria-label="Indicateurs vendeur">
    <div class="pastel-kpi kpi-sky">
      <div class="pastel-kpi-body">
        <div class="pastel-kpi-label">Mes ventes du jour</div>
        <div class="pastel-kpi-value">{{ vendeurStats().caJour | fcfa }}</div>
      </div>
    </div>
    <div class="pastel-kpi kpi-mint">
      <div class="pastel-kpi-body">
        <div class="pastel-kpi-label">Mes ventes du mois</div>
        <div class="pastel-kpi-value">{{ vendeurStats().caMois | fcfa }}</div>
      </div>
    </div>
    <div class="pastel-kpi kpi-lavender">
      <div class="pastel-kpi-body">
        <div class="pastel-kpi-label">Livraisons en attente</div>
        <div class="pastel-kpi-value">{{ livraisonsAFaire().length }}</div>
      </div>
    </div>
    <div class="pastel-kpi kpi-peach">
      <div class="pastel-kpi-body">
        <div class="pastel-kpi-label">Encaissements du jour</div>
        <div class="pastel-kpi-value">{{ encaissementsJour() | fcfa }}</div>
      </div>
    </div>
  </section>

  <div class="grid-2">
    <div class="bottom-card">
      <div class="bottom-card-header">
        <h2 class="bottom-card-title">Mes 10 dernières ventes</h2>
        <a class="bottom-card-link" routerLink="/ventes">Tout afficher</a>
      </div>
      <div class="dash-table-wrap">
        <table class="dash-table" aria-label="Mes 10 dernières ventes">
          <thead><tr><th scope="col"># Réf.</th><th scope="col">Client</th><th scope="col">Montant</th><th scope="col">Statut</th></tr></thead>
          <tbody>
            @for (v of mesVentes(); track v.id || v.numero) {
              <tr>
                <td class="sale-ref">{{ v.numero }}</td>
                <td>{{ v.client }}</td>
                <td class="sale-amount">{{ v.montant }}</td>
                <td><span class="badge" [class]="v.badgeClass">{{ v.statut }}</span></td>
              </tr>
            }
            @if (!loading() && mesVentes().length === 0) {
              <tr><td colspan="4" style="text-align:center;color:var(--gw-muted);padding:24px">Aucune vente enregistrée</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <div class="bottom-card">
      <div class="bottom-card-header">
        <h2 class="bottom-card-title">Livraisons en attente</h2>
        <span class="badge badge-warning">{{ livraisonsAFaire().length }} en attente</span>
      </div>
      @for (l of livraisonsAFaire(); track l.id || l.venteNumero) {
        <div style="display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-bottom:1px solid #f0f5fb">
          <div>
            <div style="font-weight:700;font-size:13px">{{ l.clientNom }}</div>
            <div style="font-size:12px;color:var(--gw-muted)">{{ l.adresse || 'Adresse non renseignée' }} • {{ l.venteNumero }}</div>
          </div>
          <span class="badge" [class]="l.statut === 'en_cours' ? 'badge-info' : 'badge-warning'">
            {{ l.statut === 'en_cours' ? 'En cours' : 'À livrer' }}
          </span>
        </div>
      }
      @if (!loading() && livraisonsAFaire().length === 0) {
        <div style="text-align:center;padding:24px;color:var(--gw-muted)">Aucune livraison en attente</div>
      }
    </div>
  </div>
}

<!-- ===================================================== -->
<!-- VUE COMPTABLE                                         -->
<!-- ===================================================== -->
@if (isComptable()) {
  @if (!loading() && !arreteJourFait()) {
    <div class="gw-alert alert-warning" role="status" style="margin-bottom:18px">
      <div class="alert-content">
        <div class="alert-title">Arrêté de caisse non effectué</div>
        L'arrêté de caisse du jour n'a pas encore été validé.
      </div>
      <a class="btn btn-warning btn-sm" routerLink="/comptabilite">Effectuer l'arrêté</a>
    </div>
  }

  <section class="dash-kpi-grid" aria-label="Indicateurs comptables">
    <div class="pastel-kpi kpi-sky">
      <div class="pastel-kpi-body">
        <div class="pastel-kpi-label">Trésorerie totale</div>
        <div class="pastel-kpi-value">{{ totalTresorerie() | fcfa }}</div>
      </div>
    </div>
    <div class="pastel-kpi kpi-peach">
      <div class="pastel-kpi-body">
        <div class="pastel-kpi-label">Créances en cours</div>
        <div class="pastel-kpi-value">{{ creancesTotal() | fcfa }}</div>
      </div>
    </div>
    <div class="pastel-kpi kpi-lavender">
      <div class="pastel-kpi-body">
        <div class="pastel-kpi-label">Dépenses du mois</div>
        <div class="pastel-kpi-value">{{ depensesMois() | fcfa }}</div>
      </div>
    </div>
    <div class="pastel-kpi kpi-mint">
      <div class="pastel-kpi-body">
        <div class="pastel-kpi-label">Résultat net</div>
        <div class="pastel-kpi-value">{{ resultatNet() | fcfa }}</div>
      </div>
    </div>
  </section>

  <div class="grid-2">
    <div class="bottom-card">
      <div class="bottom-card-header">
        <h2 class="bottom-card-title">Trésorerie par compte</h2>
        <a class="bottom-card-link" routerLink="/comptabilite">Voir les comptes</a>
      </div>
      @for (c of comptesTresorerie(); track c.key) {
        <div style="display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid #f0f5fb">
          <div>
            <div style="font-weight:700;font-size:13px">{{ c.nom }}</div>
            <div style="font-size:11.5px;color:var(--gw-muted)">{{ c.type }}</div>
          </div>
          <strong class="tabular-nums" [style.color]="c.solde >= 0 ? '#047857' : '#b91c1c'">{{ c.solde | fcfa }}</strong>
        </div>
      }
    </div>

    <div class="bottom-card">
      <div class="bottom-card-header">
        <h2 class="bottom-card-title">Périodes comptables</h2>
        <a class="bottom-card-link" routerLink="/comptabilite">Gérer les périodes</a>
      </div>
      <div class="dash-table-wrap">
        <table class="dash-table" aria-label="Périodes comptables">
          <thead><tr><th scope="col">Période</th><th scope="col">Statut</th><th scope="col">Clôturé par</th></tr></thead>
          <tbody>
            @for (p of periodes(); track p.id ?? p.periode) {
              <tr>
                <td class="sale-ref">{{ p.periode || p.id }}</td>
                <td>
                  <span class="badge" [class]="p.statut === 'cloturee' ? 'badge-danger' : 'badge-success'">
                    {{ p.statut === 'cloturee' ? 'Clôturée' : 'Ouverte' }}
                  </span>
                </td>
                <td class="sale-date">{{ p.cloturePar || '—' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  </div>
}
  `
})
export class DashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly dataService = inject(DataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload$ = new Subject<void>();

  // Reactive state signals
  readonly ventes = signal<Vente[]>([]);
  readonly clients = signal<Client[]>([]);
  readonly produits = signal<Produit[]>([]);
  readonly paiements = signal<Paiement[]>([]);
  readonly depenses = signal<Depense[]>([]);
  readonly transferts = signal<TransfertRecord[]>([]);
  readonly livraisons = signal<Livraison[]>([]);
  readonly periodes = signal<PeriodeRecord[]>([]);
  readonly arretes = signal<ArreteRecord[]>([]);
  readonly evoPeriod = signal<EvolutionPeriod>('7d');
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  // Role & User Computeds
  readonly displayName = computed(() => this.authService.currentUser?.displayName || 'Utilisateur');
  readonly todayLabel = computed(() =>
    new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  );
  readonly isAdmin = computed(() => {
    const r = this.authService.currentUser?.role;
    return r === 'admin' || r === 'superadmin';
  });
  readonly isVendeur = computed(() => this.authService.currentUser?.role === 'vendeur');
  readonly isComptable = computed(() => this.authService.currentUser?.role === 'comptable');

  // Active (non-cancelled) sales
  private readonly ventesActives = computed(() => this.ventes().filter(v => v.statut !== 'annulee'));

  // KPI 1: Ventes Aujourd'hui & Trend
  readonly caJour = computed(() => {
    const todayStr = new Date().toDateString();
    return this.ventesActives()
      .filter(v => this.toDate(v.createdAt)?.toDateString() === todayStr)
      .reduce((sum, v) => sum + (v.total || 0), 0);
  });

  readonly ventesTrend = computed(() => {
    const now = new Date();
    const todayStr = now.toDateString();
    const yesterdayStr = new Date(now.getTime() - 86400000).toDateString();

    const todaySales = this.ventesActives().filter(v => this.toDate(v.createdAt)?.toDateString() === todayStr);
    const yesterdayCa = this.ventesActives()
      .filter(v => this.toDate(v.createdAt)?.toDateString() === yesterdayStr)
      .reduce((s, v) => s + (v.total || 0), 0);
    const todayCa = this.caJour();

    if (yesterdayCa > 0) {
      const pct = Math.round(((todayCa - yesterdayCa) / yesterdayCa) * 100);
      if (pct >= 0) return { text: `↑ +${pct}%`, direction: 'up' as const };
      return { text: `↓ ${pct}%`, direction: 'down' as const };
    }
    if (todaySales.length > 0) {
      return { text: `↑ ${todaySales.length} vente${todaySales.length > 1 ? 's' : ''} du jour`, direction: 'up' as const };
    }
    return { text: 'Aucune vente ce jour', direction: 'flat' as const };
  });

  // KPI 2: Stock Total (with 0,5 L & 1,5 L breakdown)
  readonly stockSummary = computed(() => {
    const prods = this.produits();
    let s05 = 0;
    let s15 = 0;
    let total = 0;
    for (const p of prods) {
      const qty = p.stock || 0;
      const bottles = p.unite === 'pack' && p.unitesParPack ? qty * p.unitesParPack : qty;
      total += bottles;
      const tag = `${p.code} ${p.nom}`.toLowerCase();
      if (tag.includes('05l') || tag.includes('0.5') || tag.includes('0,5') || tag.includes('pack-05')) {
        s05 += bottles;
      } else if (tag.includes('15l') || tag.includes('1.5') || tag.includes('1,5')) {
        s15 += bottles;
      }
    }
    return { total, s05, s15 };
  });

  // KPI 3: Clients Actifs
  readonly clientsActifs = computed(() => this.clients().filter(c => c.statut === 'actif').length);
  readonly totalClients = computed(() => this.clients().length);
  readonly clientsTrend = computed(() => {
    const list = this.clients();
    if (list.length === 0) return '';
    const mois = this.localYearMonth(new Date());
    const createdThisMonth = list.filter(c => {
      const d = this.toDate(c.createdAt);
      return d !== null && this.localYearMonth(d) === mois;
    }).length;
    if (createdThisMonth <= 0) return '';
    const pct = Math.max(1, Math.round((createdThisMonth / list.length) * 100));
    return `↑ +${pct}%`;
  });

  // KPI 4: Solde Caisse / Trésorerie consolidée
  readonly comptesTresorerie = computed(() => {
    const soldes: Record<string, number> = {
      caisse_principale: 0, orange_money: 0, wave: 0, moov_money: 0, banque: 0,
    };
    for (const p of this.paiements()) {
      const k = p.compteTresorerie || this.dataService.compteFromMoyen(p.moyen);
      soldes[k] = (soldes[k] || 0) + (p.montant || 0);
    }
    for (const d of this.depenses()) {
      const k = d.compteTresorerie || 'caisse_principale';
      soldes[k] = (soldes[k] || 0) - (d.montant || 0);
    }
    for (const t of this.transferts()) {
      const m = t.montant || 0;
      if (t.source) soldes[t.source] = (soldes[t.source] || 0) - m;
      if (t.destination) soldes[t.destination] = (soldes[t.destination] || 0) + m;
    }
    return [
      { key: 'caisse_principale', nom: 'Caisse espèces', type: 'Espèces', solde: soldes['caisse_principale'] },
      { key: 'orange_money', nom: 'Orange Money', type: 'Mobile Money', solde: soldes['orange_money'] },
      { key: 'wave', nom: 'Wave', type: 'Mobile Money', solde: soldes['wave'] },
      { key: 'moov_money', nom: 'Moov Money', type: 'Mobile Money', solde: soldes['moov_money'] },
      { key: 'banque', nom: 'Compte bancaire', type: 'Virement / Chèque', solde: soldes['banque'] },
    ];
  });

  readonly totalTresorerie = computed(() =>
    this.comptesTresorerie().reduce((sum, c) => sum + c.solde, 0)
  );

  // Stock Alerts
  readonly stockAlertes = computed(() =>
    this.produits()
      .filter(p => p.stock <= p.seuilAlerte)
      .sort((a, b) => a.stock - b.stock)
  );

  readonly featuredStockProduit = computed(() => {
    const alerts = this.stockAlertes();
    if (alerts.length > 0) return alerts[0];
    const all = [...this.produits()].sort((a, b) => a.stock - b.stock);
    return all[0] ?? null;
  });

  // Chart 1: Évolution des Ventes (0,5 L vs 1,5 L)
  readonly evolutionData = computed(() => {
    const period = this.evoPeriod();
    const daysCount = period === '7d' ? 7 : 30;
    const now = new Date();
    const bucketCount = period === '7d' ? 7 : 6;
    const bucketSize = Math.ceil(daysCount / bucketCount);

    const labels: string[] = [];
    const s05: number[] = [];
    const s15: number[] = [];

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dayMs = 86400000;

    if (period === '7d') {
      const slotMap = new Map<string, { label: string; v05: number; v15: number }>();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(startOfToday - i * dayMs);
        const rawDay = d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');
        const label = rawDay.charAt(0).toUpperCase() + rawDay.slice(1, 3);
        slotMap.set(d.toDateString(), { label, v05: 0, v15: 0 });
      }
      for (const v of this.ventesActives()) {
        const d = this.toDate(v.createdAt);
        if (!d) continue;
        const slot = slotMap.get(d.toDateString());
        if (!slot) continue;
        const split = this.splitVenteFormats(v);
        slot.v05 += split.v05;
        slot.v15 += split.v15;
      }
      for (const s of slotMap.values()) {
        labels.push(s.label);
        s05.push(s.v05);
        s15.push(s.v15);
      }
    } else {
      for (let b = bucketCount - 1; b >= 0; b--) {
        const endTs = startOfToday - b * bucketSize * dayMs + dayMs - 1;
        const startTs = endTs - bucketSize * dayMs + 1;
        const startD = new Date(startTs);
        const endD = new Date(endTs);
        const startLbl = startD.toLocaleDateString('fr-FR', { day: '2-digit' });
        const endLbl = endD.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        labels.push(`${startLbl}–${endLbl}`);
        let v05 = 0;
        let v15 = 0;
        for (const v of this.ventesActives()) {
          const d = this.toDate(v.createdAt);
          if (!d) continue;
          const ts = d.getTime();
          if (ts >= startTs && ts <= endTs) {
            const split = this.splitVenteFormats(v);
            v05 += split.v05;
            v15 += split.v15;
          }
        }
        s05.push(v05);
        s15.push(v15);
      }
    }

    return { labels, s05, s15 };
  });

  // Chart 2: Répartition des Ventes (Donut 0,5 L vs 1,5 L)
  readonly repartitionData = computed(() => {
    let total05 = 0;
    let total15 = 0;
    for (const v of this.ventesActives()) {
      const split = this.splitVenteFormats(v);
      total05 += split.v05;
      total15 += split.v15;
    }
    const total = total05 + total15;
    if (total <= 0) {
      return { pct05: 0, pct15: 0, total05: 0, total15: 0, hasData: false };
    }
    const pct05 = Math.round((total05 / total) * 100);
    return { pct05, pct15: 100 - pct05, total05, total15, hasData: true };
  });

  // Recent Sales Table
  readonly recentVentes = computed<RecentVenteRow[]>(() =>
    this.ventes().slice(0, 4).map(v => {
      const d = this.toDate(v.createdAt);
      return {
        id: v.id || '',
        numero: v.numero,
        client: v.clientNom,
        produits: this.summarizeLignes(v),
        montant: this.formatFCFA(v.total),
        date: d ? this.formatShortDate(d) : '—',
        statut: this.statutLabel(v.statut),
        badgeClass: this.statutBadge(v.statut),
      };
    })
  );

  // Vendeur & Comptable derived data
  readonly vendeurStats = computed(() => {
    const uid = this.authService.currentUser?.uid;
    const now = new Date();
    const todayStr = now.toDateString();
    const mois = this.localYearMonth(now);
    const mine = this.ventesActives().filter(v => v.vendeurId === uid);
    return {
      caJour: mine.filter(v => this.toDate(v.createdAt)?.toDateString() === todayStr).reduce((s, v) => s + (v.total || 0), 0),
      caMois: mine.filter(v => {
        const d = this.toDate(v.createdAt);
        return d !== null && this.localYearMonth(d) === mois;
      }).reduce((s, v) => s + (v.total || 0), 0),
    };
  });

  readonly mesVentes = computed<RecentVenteRow[]>(() => {
    const uid = this.authService.currentUser?.uid;
    return this.ventes()
      .filter(v => v.vendeurId === uid)
      .slice(0, 10)
      .map(v => {
        const d = this.toDate(v.createdAt);
        return {
          id: v.id || '',
          numero: v.numero,
          client: v.clientNom,
          produits: this.summarizeLignes(v),
          montant: this.formatFCFA(v.total),
          date: d ? this.formatShortDate(d) : '—',
          statut: this.statutLabel(v.statut),
          badgeClass: this.statutBadge(v.statut),
        };
      });
  });

  readonly livraisonsAFaire = computed(() =>
    this.livraisons().filter(l => l.statut === 'a_livrer' || l.statut === 'en_cours').slice(0, 8)
  );

  readonly encaissementsJour = computed(() => {
    const todayStr = new Date().toDateString();
    return this.paiements()
      .filter(p => this.toDate(p.createdAt)?.toDateString() === todayStr)
      .reduce((s, p) => s + (p.montant || 0), 0);
  });

  readonly creancesTotal = computed(() =>
    this.ventesActives().filter(v => (v.soldeRestant || 0) > 0).reduce((s, v) => s + (v.soldeRestant || 0), 0)
  );

  readonly depensesMois = computed(() => {
    const mois = this.localYearMonth(new Date());
    return this.depenses().filter(d => d.periode === mois).reduce((s, d) => s + (d.montant || 0), 0);
  });

  readonly resultatNet = computed(() => {
    const mois = this.localYearMonth(new Date());
    const caMois = this.ventesActives()
      .filter(v => {
        const d = this.toDate(v.createdAt);
        return d !== null && this.localYearMonth(d) === mois;
      })
      .reduce((s, v) => s + (v.total || 0), 0);
    return caMois - this.depensesMois();
  });

  readonly arreteJourFait = computed(() => {
    const todayStr = new Date().toDateString();
    return this.arretes().some(a => this.toDate(a.createdAt)?.toDateString() === todayStr);
  });

  ngOnInit(): void {
    this.subscribeStreams();
    this.reload$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.subscribeStreams();
    });
  }

  retryLoad(): void {
    this.loadError.set(null);
    this.loading.set(true);
    this.reload$.next();
  }

  private subscribeStreams(): void {
    const handleStreamError = () => {
      this.loadError.set('Impossible de charger certaines données en temps réel. Vérifiez votre connexion.');
      this.loading.set(false);
      return of([]);
    };

    this.dataService.getVentes().pipe(
      catchError(handleStreamError),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(list => {
      this.ventes.set(list);
      this.loading.set(false);
    });

    this.dataService.getClients().pipe(
      catchError(handleStreamError),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(list => this.clients.set(list));

    this.dataService.getProduits().pipe(
      catchError(handleStreamError),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(list => this.produits.set(list));

    this.dataService.getPaiements().pipe(
      catchError(handleStreamError),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(list => this.paiements.set(list));

    this.authService.currentUser$.pipe(
      switchMap(user => {
        const role = user?.role;
        if (role === 'vendeur' || role === 'admin' || role === 'superadmin') {
          return this.dataService.getLivraisons().pipe(catchError(handleStreamError));
        }
        return of([] as Livraison[]);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(list => this.livraisons.set(list));

    this.authService.currentUser$.pipe(
      switchMap(user => {
        const role = user?.role;
        if (role === 'admin' || role === 'superadmin' || role === 'comptable') {
          return this.dataService.getDepenses().pipe(catchError(handleStreamError));
        }
        return of([] as Depense[]);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(list => this.depenses.set(list));

    this.authService.currentUser$.pipe(
      switchMap(user => {
        const role = user?.role;
        if (role === 'admin' || role === 'superadmin' || role === 'comptable') {
          return this.dataService.getTransferts().pipe(catchError(handleStreamError));
        }
        return of([]);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(list => this.transferts.set(list as TransfertRecord[]));

    this.authService.currentUser$.pipe(
      switchMap(user => {
        const role = user?.role;
        if (role === 'admin' || role === 'superadmin' || role === 'comptable') {
          return this.dataService.getPeriodes().pipe(catchError(handleStreamError));
        }
        return of([]);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(list => this.periodes.set((list as PeriodeRecord[]).slice(0, 6)));

    this.authService.currentUser$.pipe(
      switchMap(user => {
        const role = user?.role;
        if (role === 'admin' || role === 'superadmin' || role === 'comptable') {
          return this.dataService.getArretesCaisse().pipe(catchError(handleStreamError));
        }
        return of([]);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(list => this.arretes.set(list as ArreteRecord[]));
  }

  formatFCFA(n: number): string {
    return `${FR_NUMBER_FORMAT.format(Math.round(Number.isFinite(n) ? n : 0))} FCFA`;
  }

  formatNumber(n: number): string {
    return FR_NUMBER_FORMAT.format(Math.round(Number.isFinite(n) ? n : 0));
  }

  unitLabel(prod: Produit): string {
    const qty = prod.stock || 0;
    if (prod.unite === 'unite') {
      return qty > 1 ? 'bouteilles restantes' : 'bouteille restante';
    }
    return qty > 1 ? `${prod.unite}s restants` : `${prod.unite} restant`;
  }

  private localYearMonth(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  private toDate(val: unknown): Date | null {
    if (!val) return null;
    if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
    if (typeof val === 'object' && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
      const d = (val as { toDate: () => Date }).toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(val as string | number);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private formatShortDate(d: Date): string {
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).replace(',', '');
  }

  private splitVenteFormats(v: Vente): { v05: number; v15: number } {
    if (!v.lignes || v.lignes.length === 0) {
      return { v05: 0, v15: 0 };
    }
    let v05 = 0;
    let v15 = 0;
    for (const l of v.lignes) {
      const name = (l.produitNom || '').toLowerCase();
      const amount = l.total || (l.quantite * l.prixUnitaire) || 0;
      if (name.includes('1.5') || name.includes('1,5') || name.includes('15l')) {
        v15 += amount;
      } else if (name.includes('0.5') || name.includes('0,5') || name.includes('05l')) {
        v05 += amount;
      }
    }
    return { v05, v15 };
  }

  private summarizeLignes(v: Vente): string {
    if (!v.lignes || v.lignes.length === 0) return '—';
    const first = v.lignes[0];
    const rawName = first.produitNom || 'Produit';
    const shortName = rawName
      .replace(/eau\s*(minérale)?\s*/i, '')
      .replace(/0\.5\s*l/i, '0,5 L')
      .replace(/1\.5\s*l/i, '1,5 L')
      .trim();
    const base = `${first.quantite} x ${shortName || rawName}`;
    return v.lignes.length > 1 ? `${base} (+${v.lignes.length - 1})` : base;
  }

  private statutLabel(s: string): string {
    const map: Record<string, string> = {
      payee: 'Payée',
      validee: 'Validée',
      livree: 'Livrée',
      en_attente: 'En attente',
      annulee: 'Annulée',
    };
    return map[s] || s;
  }

  private statutBadge(s: string): string {
    const map: Record<string, string> = {
      payee: 'badge-success',
      validee: 'badge-info',
      livree: 'badge-success',
      en_attente: 'badge-warning',
      annulee: 'badge-danger',
    };
    return map[s] || 'badge-secondary';
  }
}

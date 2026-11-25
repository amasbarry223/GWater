import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule, AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';
import { AuthService } from '../core/auth.service';
import { ToastService } from '../core/toast.service';
import { DataService } from '../core/data.service';
import { Client, Produit, Vente } from '../core/models';

type NavIconKey =
  | 'dashboard'
  | 'clients'
  | 'ventes'
  | 'stock'
  | 'livreurs'
  | 'comptabilite'
  | 'rapports'
  | 'admin'
  | 'section-ventes';

interface NavItem {
  label: string;
  icon: NavIconKey;
  route: string;
  roles?: string[];
}

interface NavSection {
  id: string;
  label: string;
  icon?: NavIconKey;
  items: NavItem[];
}

interface SearchHit {
  kind: 'client' | 'produit' | 'vente';
  label: string;
  sub: string;
  route: string;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, FormsModule, AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="gw-layout">
  <!-- Mobile Drawer Backdrop -->
  <div class="sidebar-mobile-backdrop" [class.open]="mobileOpen()" (click)="mobileOpen.set(false)"></div>

  <!-- SIDEBAR -->
  <aside class="gw-sidebar" [class.collapsed]="collapsed()" [class.mobile-open]="mobileOpen()">
    <!-- Brand -->
    <div class="sidebar-brand">
      <div class="brand-droplet" aria-hidden="true">
        <svg width="34" height="36" viewBox="0 0 36 40" fill="none">
          <defs>
            <linearGradient id="gwDropGrad" x1="6" y1="2" x2="30" y2="38" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#8ae2ff"/>
              <stop offset="48%" stop-color="#0ea5e9"/>
              <stop offset="100%" stop-color="#0052cc"/>
            </linearGradient>
          </defs>
          <path d="M18 2C18 2 4 17.5 4 26C4 33.732 10.268 39 18 39C25.732 39 32 33.732 32 26C32 17.5 18 2 18 2Z" fill="url(#gwDropGrad)"/>
          <path d="M13 24.5C13 20.5 15.5 15.8 18 12.2C14.8 15.8 10.5 21.2 10.5 25.2C10.5 28.8 12.8 31.8 16 32.8C14.2 30.8 13 28 13 24.5Z" fill="#ffffff" opacity="0.65"/>
          <ellipse cx="14.2" cy="21" rx="2.1" ry="4.4" fill="#ffffff" opacity="0.72" transform="rotate(-18 14.2 21)"/>
        </svg>
      </div>
      <div class="brand-text">
        <div class="brand-name">GWater</div>
        <div class="brand-sub">Gestion d'eau</div>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="sidebar-nav" aria-label="Navigation principale">
      <!-- Top-level direct links -->
      @for (item of primaryItems; track item.route) {
        @if (isItemVisible(item)) {
          <a class="nav-link"
             [routerLink]="item.route"
             routerLinkActive="active"
             (click)="mobileOpen.set(false)"
             [title]="collapsed() ? item.label : ''">
            <span class="nav-icon" aria-hidden="true">
              <ng-container *ngTemplateOutlet="iconTpl; context: { $implicit: item.icon }"></ng-container>
            </span>
            <span class="nav-label">{{ item.label }}</span>
          </a>
        }
      }

      <!-- Grouped collapsible sections -->
      @for (section of navSections; track section.id) {
        @if (isSectionVisible(section)) {
          <div class="nav-section">
            <button type="button"
                    class="nav-section-header"
                    (click)="toggleSection(section.id)"
                    [attr.aria-expanded]="isSectionOpen(section.id)">
              <span class="nav-section-title">
                @if (section.icon) {
                  <span class="nav-icon" aria-hidden="true">
                    <ng-container *ngTemplateOutlet="iconTpl; context: { $implicit: section.icon }"></ng-container>
                  </span>
                }
                <span>{{ section.label }}</span>
              </span>
              <svg class="nav-chevron" [class.open]="isSectionOpen(section.id)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            @if (isSectionOpen(section.id) || collapsed()) {
              @for (item of section.items; track item.route) {
                @if (isItemVisible(item)) {
                  <a class="nav-link"
                     [class.indented]="!collapsed() && section.items.length > 1"
                     [routerLink]="item.route"
                     routerLinkActive="active"
                     (click)="mobileOpen.set(false)"
                     [title]="collapsed() ? item.label : ''">
                    <span class="nav-icon" aria-hidden="true">
                      <ng-container *ngTemplateOutlet="iconTpl; context: { $implicit: item.icon }"></ng-container>
                    </span>
                    <span class="nav-label">{{ item.label }}</span>
                    @if (item.route === '/stock' && stockAlertes().length > 0) {
                      <span class="nav-badge">{{ stockAlertes().length }}</span>
                    }
                  </a>
                }
              }
            }
          </div>
        }
      }
    </nav>

    <!-- Bottom Aquatic Promo Brand Card -->
    <div class="sidebar-promo">
      <svg class="sidebar-promo-drop" viewBox="0 0 32 36" fill="none" aria-hidden="true">
        <path d="M16 2C16 2 4 15.8 4 23.2C4 29.8 9.4 34.5 16 34.5C22.6 34.5 28 29.8 28 23.2C28 15.8 16 2 16 2Z" fill="#ffffff" fill-opacity="0.94"/>
        <ellipse cx="12.5" cy="20.5" rx="2" ry="4.2" fill="#0ea5e9" fill-opacity="0.35" transform="rotate(-16 12.5 20.5)"/>
      </svg>
      <div class="sidebar-promo-title">GWater</div>
      <div class="sidebar-promo-copy">Une eau de qualité, une vie en bonne santé !</div>
    </div>

    <!-- Footer User Chip -->
    <div class="sidebar-footer">
      <div class="user-card" role="button" tabindex="0" (click)="showProfileModal.set(true)" (keydown.enter)="showProfileModal.set(true)">
        <div class="user-avatar">{{ userInitials() }}</div>
        <div class="user-info">
          <div class="user-name">{{ authService.currentUser?.displayName || 'Super Admin' }}</div>
          <div class="user-role">{{ roleLabel() }}</div>
        </div>
        <svg class="user-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
    </div>
  </aside>

  <!-- MAIN AREA -->
  <div class="gw-main" [class.is-dashboard]="isDashboardRoute()">
    <header class="gw-header">
      <button type="button" class="header-toggle" (click)="mobileOpen.set(!mobileOpen())" aria-label="Ouvrir le menu">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      <!-- Global Search Pill -->
      <div class="header-search" style="position:relative">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="color:#7c94b0;flex-shrink:0" aria-hidden="true">
          <circle cx="11" cy="11" r="7.5"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <label class="sr-only" for="global-search-input">Rechercher un client, une vente ou un produit</label>
        <input id="global-search-input"
               name="globalSearch"
               type="search"
               placeholder="Rechercher un client, une vente..."
               [(ngModel)]="searchQuery"
               (input)="onSearch()"
               (focus)="onSearch()">
        @if (searchResults().length > 0) {
          <div class="gw-dropdown" style="left:0;right:auto;top:46px;width:340px;max-height:300px;overflow-y:auto;z-index:220">
            @for (res of searchResults(); track res.label + res.sub) {
              <div class="dd-item" (click)="goToResult(res.route)">
                <span style="width:28px;height:28px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0"
                      [style.background]="res.kind === 'client' ? '#efeaff' : res.kind === 'vente' ? '#e5f3ff' : '#e6fbf1'"
                      [style.color]="res.kind === 'client' ? '#6d28d9' : res.kind === 'vente' ? '#0b66f5' : '#0d9f6e'">
                  {{ res.kind === 'client' ? 'CL' : res.kind === 'vente' ? 'VT' : 'ST' }}
                </span>
                <div style="min-width:0">
                  <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ res.label }}</div>
                  <div style="font-size:11px;color:#7c90a9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ res.sub }}</div>
                </div>
              </div>
            }
          </div>
        }
      </div>

      <div class="header-spacer"></div>

      <div class="header-actions">
        <!-- Notifications (Live Stock Alerts) -->
        <div style="position:relative">
          <button type="button" class="header-btn" aria-label="Notifications" title="Notifications" (click)="showNotifs.set(!showNotifs()); showUserDd.set(false)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            @if (stockAlertes().length > 0) {
              <span class="notif-count">{{ stockAlertes().length }}</span>
            }
          </button>

          @if (showNotifs()) {
            <div class="gw-dropdown" style="right:0;width:310px;z-index:220">
              <div style="padding:10px 12px;font-weight:700;font-size:12.5px;border-bottom:1px solid var(--gw-border-soft);color:var(--gw-text);display:flex;justify-content:space-between;align-items:center">
                <span>Notifications stock</span>
                <span class="badge" [class]="stockAlertes().length > 0 ? 'badge-danger' : 'badge-success'">{{ stockAlertes().length }}</span>
              </div>
              @for (p of stockAlertes(); track p.id) {
                <div class="dd-item" (click)="showNotifs.set(false); router.navigate(['/stock'])">
                  <span style="width:28px;height:28px;border-radius:8px;background:#fff3dc;color:#d97706;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  </span>
                  <div>
                    <div style="font-size:12.5px;font-weight:600;color:var(--gw-text)">{{ p.nom }}</div>
                    <div style="font-size:11px;color:#cf2e2e">{{ p.stock }} {{ p.unite }} restant(s) (seuil : {{ p.seuilAlerte }})</div>
                  </div>
                </div>
              }
              @if (stockAlertes().length === 0) {
                <div style="padding:18px 12px;text-align:center;color:var(--gw-muted);font-size:12.5px">
                  Tous les niveaux de stock sont conformes.
                </div>
              }
            </div>
          }
        </div>

        <!-- User Pill Dropdown -->
        <div style="position:relative">
          <button type="button" class="header-user-pill" (click)="showUserDd.set(!showUserDd()); showNotifs.set(false)">
            <span class="header-user-avatar">{{ userInitials() }}</span>
            <span class="header-user-name">{{ authService.currentUser?.displayName || 'Super Admin' }}</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color:#6c829d">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          @if (showUserDd()) {
            <div class="gw-dropdown" style="z-index:220">
              <div class="dd-item" (click)="showUserDd.set(false); showProfileModal.set(true)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <span>Mon profil</span>
              </div>
              @if (authService.hasRole('superadmin', 'admin')) {
                <div class="dd-item" (click)="showUserDd.set(false); router.navigate(['/admin'])">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  <span>Administration</span>
                </div>
              }
              <div class="dd-divider"></div>
              <div class="dd-item danger" (click)="logout()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                <span>Déconnexion</span>
              </div>
            </div>
          }
        </div>
      </div>
    </header>

    <main class="gw-content">
      <router-outlet />
    </main>
  </div>
</div>

<!-- SVG Icon Templates -->
<ng-template #iconTpl let-icon>
  @switch (icon) {
    @case ('dashboard') {
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.2L3 10.5v9.8c0 .9.7 1.7 1.7 1.7H9.5v-6.5h5V22h4.8c.9 0 1.7-.7 1.7-1.7v-9.8L12 3.2z"/></svg>
    }
    @case ('clients') {
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    }
    @case ('section-ventes') {
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="14" x2="12" y2="14"/></svg>
    }
    @case ('ventes') {
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
    }
    @case ('stock') {
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
    }
    @case ('livreurs') {
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
    }
    @case ('comptabilite') {
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
    }
    @case ('rapports') {
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
    }
    @case ('admin') {
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    }
  }
</ng-template>

<!-- MODAL MON PROFIL -->
@if (showProfileModal()) {
  <div class="gw-modal-backdrop" (click)="showProfileModal.set(false)">
    <div class="gw-modal modal-sm" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title">Mon profil</div>
        <button type="button" class="modal-close" aria-label="Fermer" (click)="showProfileModal.set(false)">✕</button>
      </div>
      <div class="modal-body">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px">
          <div style="width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#1698ff,#0062d6);color:white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px">
            {{ userInitials() }}
          </div>
          <div>
            <div style="font-weight:700;font-size:15.5px;color:var(--gw-text)">{{ authService.currentUser?.displayName }}</div>
            <div style="font-size:12.5px;color:var(--gw-muted)">{{ authService.currentUser?.email }}</div>
          </div>
        </div>
        <div style="background:#f5f9fe;border:1px solid var(--gw-border-soft);border-radius:12px;padding:14px;font-size:13px;display:grid;gap:8px">
          <div style="display:flex;justify-content:space-between">
            <span style="color:var(--gw-muted)">Rôle</span>
            <strong>{{ roleLabel() }}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="color:var(--gw-muted)">Statut</span>
            <span class="badge badge-success">{{ authService.currentUser?.status || 'actif' }}</span>
          </div>
        </div>
      </div>
      <div class="modal-footer" style="justify-content:space-between">
        <button type="button" class="btn btn-danger btn-sm" (click)="logout()">Déconnexion</button>
        <div style="display:flex;gap:8px">
          <button type="button" class="btn btn-secondary btn-sm" (click)="resetMyPassword()">Mot de passe</button>
          <button type="button" class="btn btn-primary btn-sm" (click)="showProfileModal.set(false)">Fermer</button>
        </div>
      </div>
    </div>
  </div>
}

<!-- TOAST CONTAINER -->
<div class="gw-toast-container">
  @for (toast of (toastService.toasts$ | async); track toast.id) {
    <div class="gw-toast" [class]="'toast-' + toast.type" [class.toast-leave]="toast.leaving">
      <span class="toast-icon">{{ toastIcon(toast.type) }}</span>
      <span class="toast-text">{{ toast.message }}</span>
      <span class="toast-close" (click)="toastService.dismiss(toast.id)">✕</span>
    </div>
  }
</div>

<!-- Click outside overlays -->
@if (showUserDd() || showNotifs() || searchResults().length > 0) {
  <div style="position:fixed;inset:0;z-index:99" (click)="closeOverlays()"></div>
}
  `,
})
export class LayoutComponent implements OnInit {
  readonly authService = inject(AuthService);
  readonly toastService = inject(ToastService);
  readonly router = inject(Router);
  private readonly dataService = inject(DataService);
  private readonly destroyRef = inject(DestroyRef);

  readonly collapsed = signal(false);
  readonly mobileOpen = signal(false);
  readonly showNotifs = signal(false);
  readonly showUserDd = signal(false);
  readonly showProfileModal = signal(false);
  readonly currentUrl = signal('/dashboard');
  readonly stockAlertes = signal<Produit[]>([]);
  readonly searchResults = signal<SearchHit[]>([]);
  readonly openSections = signal<Record<string, boolean>>({
    ventes: true,
    finances: true,
    analyse: true,
    systeme: true,
  });

  readonly isDashboardRoute = computed(() => {
    const url = this.currentUrl();
    return url === '/dashboard' || url === '/';
  });

  searchQuery = '';

  private clientsCache: Client[] = [];
  private produitsCache: Produit[] = [];
  private ventesCache: Vente[] = [];

  readonly primaryItems: NavItem[] = [
    { label: 'Tableau de bord', icon: 'dashboard', route: '/dashboard' },
    { label: 'Clients', icon: 'clients', route: '/clients' },
  ];

  readonly navSections: NavSection[] = [
    {
      id: 'ventes',
      label: 'Ventes',
      icon: 'section-ventes',
      items: [
        { label: 'Ventes', icon: 'ventes', route: '/ventes', roles: ['superadmin', 'admin', 'vendeur'] },
        { label: 'Stock', icon: 'stock', route: '/stock' },
        { label: 'Livreurs', icon: 'livreurs', route: '/livreurs', roles: ['superadmin', 'admin', 'vendeur'] },
      ],
    },
    {
      id: 'finances',
      label: 'Finances',
      items: [
        { label: 'Comptabilité', icon: 'comptabilite', route: '/comptabilite', roles: ['superadmin', 'admin', 'comptable'] },
      ],
    },
    {
      id: 'analyse',
      label: 'Analyse',
      items: [
        { label: 'Rapports', icon: 'rapports', route: '/rapports' },
      ],
    },
    {
      id: 'systeme',
      label: 'Système',
      items: [
        { label: 'Administration', icon: 'admin', route: '/admin', roles: ['superadmin', 'admin'] },
      ],
    },
  ];

  ngOnInit(): void {
    this.currentUrl.set(this.router.url.split('?')[0]);
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(e => {
      this.currentUrl.set(e.urlAfterRedirects.split('?')[0]);
      this.mobileOpen.set(false);
    });

    this.dataService.getProduits().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(produits => {
        this.produitsCache = produits;
        this.stockAlertes.set(produits.filter(p => p.stock <= p.seuilAlerte));
      });

    this.dataService.getClients().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(clients => { this.clientsCache = clients; });

    this.dataService.getVentes().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(ventes => { this.ventesCache = ventes; });
  }

  toggleSection(id: string): void {
    this.openSections.update(state => ({ ...state, [id]: !state[id] }));
  }

  isSectionOpen(id: string): boolean {
    return this.openSections()[id] !== false;
  }

  userInitials(): string {
    const name = this.authService.currentUser?.displayName || 'SA';
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  roleLabel(): string {
    const labels: Record<string, string> = {
      superadmin: 'Administrateur',
      admin: 'Administrateur',
      vendeur: 'Vendeur',
      comptable: 'Comptable',
    };
    return labels[this.authService.currentUser?.role || ''] || 'Utilisateur';
  }

  isSectionVisible(section: NavSection): boolean {
    return section.items.some(i => this.isItemVisible(i));
  }

  isItemVisible(item: NavItem): boolean {
    if (!item.roles) return true;
    return this.authService.hasRole(...item.roles);
  }

  toastIcon(type: string): string {
    const icons: Record<string, string> = {
      success: '✓',
      error: '✕',
      warning: '!',
      info: 'i',
    };
    return icons[type] || 'i';
  }

  onSearch(): void {
    const q = this.searchQuery.trim().toLowerCase();
    if (q.length < 2) {
      this.searchResults.set([]);
      return;
    }

    const clientHits: SearchHit[] = this.clientsCache
      .filter(c => c.nom.toLowerCase().includes(q) || c.telephone.includes(q) || c.code.toLowerCase().includes(q))
      .slice(0, 3)
      .map(c => ({ kind: 'client', label: c.nom, sub: `Client • ${c.code} • ${c.telephone}`, route: '/clients' }));

    const venteHits: SearchHit[] = this.ventesCache
      .filter(v => v.numero.toLowerCase().includes(q) || v.clientNom.toLowerCase().includes(q))
      .slice(0, 3)
      .map(v => ({ kind: 'vente', label: `${v.numero} — ${v.clientNom}`, sub: `Vente • ${new Intl.NumberFormat('fr-FR').format(Math.round(v.total))} FCFA`, route: '/ventes' }));

    const prodHits: SearchHit[] = this.produitsCache
      .filter(p => p.nom.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
      .slice(0, 3)
      .map(p => ({ kind: 'produit', label: p.nom, sub: `Produit • Stock : ${p.stock} ${p.unite}`, route: '/stock' }));

    this.searchResults.set([...clientHits, ...venteHits, ...prodHits]);
  }

  goToResult(route: string): void {
    this.searchQuery = '';
    this.searchResults.set([]);
    this.router.navigate([route]);
  }

  closeOverlays(): void {
    this.showUserDd.set(false);
    this.showNotifs.set(false);
    this.searchResults.set([]);
  }

  async resetMyPassword(): Promise<void> {
    const email = this.authService.currentUser?.email;
    if (!email) return;
    try {
      await this.authService.sendPasswordReset(email);
      this.toastService.success(`Un lien de réinitialisation a été envoyé à ${email}.`);
      this.showProfileModal.set(false);
    } catch {
      this.toastService.error('Impossible d\'envoyer l\'e-mail de réinitialisation.');
    }
  }

  async logout(): Promise<void> {
    this.closeOverlays();
    this.showProfileModal.set(false);
    await this.authService.logout();
  }
}

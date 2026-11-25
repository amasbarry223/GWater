import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { roleGuard } from './core/role.guard';
import { guestGuard } from './core/guest.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  { path: 'setup', loadComponent: () => import('./pages/setup/setup.component').then(m => m.SetupComponent) },
  {
    path: '',
    loadComponent: () => import('./layout/layout.component').then(m => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'clients',
        canActivate: [roleGuard],
        data: { roles: ['superadmin', 'admin', 'vendeur', 'comptable'] },
        loadComponent: () => import('./pages/clients/clients.component').then(m => m.ClientsComponent)
      },
      {
        path: 'stock',
        canActivate: [roleGuard],
        data: { roles: ['superadmin', 'admin', 'vendeur', 'comptable'] },
        loadComponent: () => import('./pages/stock/stock.component').then(m => m.StockComponent)
      },
      {
        path: 'ventes',
        canActivate: [roleGuard],
        data: { roles: ['superadmin', 'admin', 'vendeur'] },
        loadComponent: () => import('./pages/ventes/ventes.component').then(m => m.VentesComponent)
      },
      {
        path: 'livreurs',
        canActivate: [roleGuard],
        data: { roles: ['superadmin', 'admin', 'vendeur'] },
        loadComponent: () => import('./pages/livreurs/livreurs.component').then(m => m.LivreursComponent)
      },
      {
        path: 'comptabilite',
        canActivate: [roleGuard],
        data: { roles: ['superadmin', 'admin', 'comptable'] },
        loadComponent: () => import('./pages/comptabilite/comptabilite.component').then(m => m.ComptabiliteComponent)
      },
      {
        path: 'rapports',
        canActivate: [roleGuard],
        data: { roles: ['superadmin', 'admin', 'vendeur', 'comptable'] },
        loadComponent: () => import('./pages/rapports/rapports.component').then(m => m.RapportsComponent)
      },
      {
        path: 'admin',
        canActivate: [roleGuard],
        data: { roles: ['superadmin', 'admin'] },
        loadComponent: () => import('./pages/admin/admin.component').then(m => m.AdminComponent)
      },
    ]
  },
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found.component').then(m => m.NotFoundComponent)
  }
];

import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { roleGuard } from './core/role.guard';
import { guestGuard } from './core/guest.guard';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Connexion — GWater',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'setup',
    title: 'Configuration — GWater',
    loadComponent: () => import('./pages/setup/setup.component').then(m => m.SetupComponent)
  },
  {
    path: '',
    loadComponent: () => import('./layout/layout.component').then(m => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        title: 'Tableau de bord — GWater',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'clients',
        title: 'Clients — GWater',
        canActivate: [roleGuard],
        data: { roles: ['superadmin', 'admin', 'vendeur', 'comptable'] },
        loadComponent: () => import('./pages/clients/clients.component').then(m => m.ClientsComponent)
      },
      {
        path: 'stock',
        title: 'Stock — GWater',
        canActivate: [roleGuard],
        data: { roles: ['superadmin', 'admin', 'vendeur', 'comptable'] },
        loadComponent: () => import('./pages/stock/stock.component').then(m => m.StockComponent)
      },
      {
        path: 'ventes',
        title: 'Ventes — GWater',
        canActivate: [roleGuard],
        data: { roles: ['superadmin', 'admin', 'vendeur'] },
        loadComponent: () => import('./pages/ventes/ventes.component').then(m => m.VentesComponent)
      },
      {
        path: 'livreurs',
        title: 'Livreurs — GWater',
        canActivate: [roleGuard],
        data: { roles: ['superadmin', 'admin', 'vendeur'] },
        loadComponent: () => import('./pages/livreurs/livreurs.component').then(m => m.LivreursComponent)
      },
      {
        path: 'comptabilite',
        title: 'Comptabilité — GWater',
        canActivate: [roleGuard],
        data: { roles: ['superadmin', 'admin', 'comptable'] },
        loadComponent: () => import('./pages/comptabilite/comptabilite.component').then(m => m.ComptabiliteComponent)
      },
      {
        path: 'rapports',
        title: 'Rapports — GWater',
        canActivate: [roleGuard],
        data: { roles: ['superadmin', 'admin', 'vendeur', 'comptable'] },
        loadComponent: () => import('./pages/rapports/rapports.component').then(m => m.RapportsComponent)
      },
      {
        path: 'admin',
        title: 'Administration — GWater',
        canActivate: [roleGuard],
        data: { roles: ['superadmin', 'admin'] },
        loadComponent: () => import('./pages/admin/admin.component').then(m => m.AdminComponent)
      },
    ]
  },
  {
    path: '**',
    title: 'Page introuvable — GWater',
    loadComponent: () => import('./pages/not-found/not-found.component').then(m => m.NotFoundComponent)
  }
];

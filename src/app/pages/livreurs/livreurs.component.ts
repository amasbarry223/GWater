import { Component, signal, inject, OnInit, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../core/toast.service';
import { DataService } from '../../core/data.service';
import { Livreur } from '../../core/models';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-livreurs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [],
  template: `
<div class="page-header">
  <div>
    <h1 class="page-title">🚚 Livreurs</h1>
    <p class="page-sub">Gestion des livreurs de GWater</p>
  </div>
  <button class="btn btn-primary" (click)="openModal()">+ Nouveau livreur</button>
</div>

<!-- Barre de recherche -->
<div class="gw-card" style="margin-bottom:16px;padding:12px 16px">
  <input class="form-control" style="max-width:320px" type="text"
    placeholder="🔍 Rechercher par nom, téléphone..."
    [(ngModel)]="searchQuery" />
</div>

<!-- Tableau -->
<div class="gw-card">
  <div class="gw-table-wrapper">
    <table class="gw-table">
      <thead>
        <tr>
          <th>Nom</th>
          <th>Téléphone</th>
          <th>Véhicule</th>
          <th>Statut</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        @for (l of filteredLivreurs(); track l.id) {
          <tr>
            <td><strong>{{ l.nom }}</strong></td>
            <td>{{ l.telephone }}</td>
            <td>{{ l.vehicule }}</td>
            <td>
              <span class="badge" [class]="l.statut === 'actif' ? 'badge-success' : 'badge-danger'">
                {{ l.statut === 'actif' ? '✅ Actif' : '⛔ Inactif' }}
              </span>
            </td>
            <td>
              <button class="btn btn-sm btn-outline" (click)="openModal(l)" style="margin-right:6px">✏️ Modifier</button>
              <button class="btn btn-sm"
                [class]="l.statut === 'actif' ? 'btn-danger-outline' : 'btn-success-outline'"
                (click)="toggleStatut(l)">
                {{ l.statut === 'actif' ? '⛔ Désactiver' : '✅ Activer' }}
              </button>
            </td>
          </tr>
        }
        @if (filteredLivreurs().length === 0) {
          <tr>
            <td colspan="5" style="text-align:center;color:var(--gw-muted);padding:32px">
              Aucun livreur trouvé
            </td>
          </tr>
        }
      </tbody>
    </table>
  </div>
  <div style="padding:12px 16px;color:var(--gw-muted);font-size:12px">
    {{ filteredLivreurs().length }} livreur(s) affiché(s)
  </div>
</div>

<!-- MODAL -->
@if (showModal()) {
  <div class="gw-modal-backdrop" (click)="closeModal()"></div>
  <div class="gw-modal">
    <div class="gw-modal-header">
      <h3>{{ editing() ? 'Modifier le livreur' : 'Nouveau livreur' }}</h3>
      <button class="modal-close" (click)="closeModal()">✕</button>
    </div>
    <div class="gw-modal-body">
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Nom complet *</label>
          <input class="form-control" [(ngModel)]="form.nom" placeholder="ex: Jean Dupont" />
        </div>
        <div class="form-group">
          <label class="form-label">Téléphone *</label>
          <input class="form-control" [(ngModel)]="form.telephone" placeholder="+224 XXX XXX XXX" />
        </div>
        <div class="form-group">
          <label class="form-label">Véhicule</label>
          <input class="form-control" [(ngModel)]="form.vehicule" placeholder="ex: Moto, Camionnette..." />
        </div>
        <div class="form-group">
          <label class="form-label">Statut</label>
          <select class="form-control" [(ngModel)]="form.statut">
            <option value="actif">Actif</option>
            <option value="inactif">Inactif</option>
          </select>
        </div>
      </div>
    </div>
    <div class="gw-modal-footer">
      <button class="btn btn-outline" (click)="closeModal()">Annuler</button>
      <button class="btn btn-primary" (click)="saveLivreur()">
        {{ editing() ? 'Enregistrer' : 'Créer' }}
      </button>
    </div>
  </div>
}
  `,
})
export class LivreursComponent implements OnInit {
  private toast = inject(ToastService);
  dataService = inject(DataService);
  private destroyRef = inject(DestroyRef);

  showModal = signal(false);
  editing = signal(false);
  loading = signal(true);
  saving = signal(false);
  searchQuery = '';

  livreurs = signal<Livreur[]>([]);

  form: Livreur = this.emptyForm();
  private editingId: string | null = null;

  ngOnInit() {
    this.loading.set(true);
    this.dataService.getLivreurs().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (data) => {
        this.livreurs.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.toast.error('Erreur de chargement des livreurs');
        this.loading.set(false);
      }
    });
  }

  filteredLivreurs() {
    const q = this.searchQuery.toLowerCase();
    if (!q) return this.livreurs();
    return this.livreurs().filter(l =>
      l.nom.toLowerCase().includes(q) || l.telephone.includes(q)
    );
  }

  openModal(livreur?: Livreur) {
    if (livreur) {
      this.form = { ...livreur };
      this.editingId = livreur.id ?? null;
      this.editing.set(true);
    } else {
      this.form = this.emptyForm();
      this.editingId = null;
      this.editing.set(false);
    }
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  async saveLivreur() {
    if (!this.form.nom.trim() || !this.form.telephone.trim()) {
      this.toast.error('Le nom et le téléphone sont obligatoires.');
      return;
    }
    this.saving.set(true);
    try {
      if (this.editing() && this.editingId) {
        await this.dataService.updateLivreur(this.editingId, {
          nom: this.form.nom,
          telephone: this.form.telephone,
          vehicule: this.form.vehicule,
          statut: this.form.statut,
        });
        this.toast.success('Livreur modifié avec succès.');
      } else {
        await this.dataService.addLivreur({
          nom: this.form.nom,
          telephone: this.form.telephone,
          vehicule: this.form.vehicule,
          statut: this.form.statut,
        });
        this.toast.success('Livreur créé avec succès.');
      }
      this.closeModal();
    } catch {
      this.toast.error('Erreur lors de la sauvegarde.');
    } finally {
      this.saving.set(false);
    }
  }

  async toggleStatut(livreur: Livreur) {
    if (!livreur.id) return;
    const newStatut = livreur.statut === 'actif' ? 'inactif' : 'actif';
    try {
      await this.dataService.updateLivreur(livreur.id, { statut: newStatut });
      const msg = newStatut === 'inactif' ? 'Livreur désactivé.' : 'Livreur réactivé.';
      this.toast.info(msg);
    } catch {
      this.toast.error('Erreur lors de la mise à jour du statut.');
    }
  }

  private emptyForm(): Livreur {
    return { nom: '', telephone: '', vehicule: '', statut: 'actif' };
  }
}

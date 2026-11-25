import { Injectable } from '@angular/core';
import { Vente, LigneVente, AppSettings } from './models';

@Injectable({ providedIn: 'root' })
export class PrintService {

  printFacture(vente: Vente, lignes: LigneVente[], settings?: AppSettings | null): void {
    const nomEnt = settings?.nomEntreprise || 'GWater Distribution';
    const adresse = settings?.adresse || 'Conakry, Guinée';
    const tel = settings?.telephone || '';
    const email = settings?.email || 'contact@gwater.com';
    const devise = settings?.devise || 'FCFA';

    const lignesHtml = (lignes || []).length > 0
      ? lignes.map(l => `
      <tr>
        <td>${l.produitNom}</td>
        <td style="text-align:center">${l.quantite}</td>
        <td style="text-align:right">${this.formatMontant(l.prixUnitaire, devise)}</td>
        <td style="text-align:right;color:#ef4444">${l.remise > 0 ? '-' + this.formatMontant(l.remise, devise) : '—'}</td>
        <td style="text-align:right;font-weight:600">${this.formatMontant(l.total, devise)}</td>
      </tr>`).join('')
      : `<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:16px">Aucune ligne de produit</td></tr>`;

    const dateStr = vente.createdAt
      ? new Date(vente.createdAt).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
      : '';

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Facture ${vente.numero}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 28px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 3px solid #0ea5e9; padding-bottom: 16px; }
    .brand { font-size: 24px; font-weight: 800; color: #0ea5e9; }
    .brand-sub { font-size: 11px; color: #555; margin-top: 4px; }
    .facture-meta { text-align: right; }
    .facture-meta h2 { font-size: 20px; color: #0ea5e9; letter-spacing: 1px; }
    .parties { display: flex; justify-content: space-between; margin-bottom: 20px; }
    .partie { flex: 1; }
    .partie h4 { font-size: 10px; text-transform: uppercase; color: #888; margin-bottom: 6px; letter-spacing: 1px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #0ea5e9; color: white; padding: 9px 10px; text-align: left; font-size: 11px; }
    td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) td { background: #f8fafc; }
    .totaux { margin-left: auto; width: 280px; }
    .totaux-row { display: flex; justify-content: space-between; padding: 5px 0; }
    .totaux-row.total { font-weight: 800; font-size: 15px; color: #0ea5e9; border-top: 2px solid #0ea5e9; margin-top: 6px; padding-top: 8px; }
    .mentions { margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 10px; color: #777; text-align: center; }
    @media print { body { padding: 10px; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">💧 ${nomEnt}</div>
      <div class="brand-sub">${adresse}</div>
      <div class="brand-sub">${[tel, email].filter(Boolean).join(' · ')}</div>
    </div>
    <div class="facture-meta">
      <h2>FACTURE</h2>
      <div style="font-family:monospace;font-weight:700;font-size:15px">${vente.numero}</div>
      <div>Date : ${dateStr}</div>
      <div>Statut : ${vente.paiementStatut === 'paye' ? '✅ Payée' : vente.paiementStatut === 'partiel' ? '⏳ Partiel' : '⚠️ Non payée'}</div>
    </div>
  </div>

  <div class="parties">
    <div class="partie">
      <h4>Émis par</h4>
      <strong>${vente.vendeurNom || nomEnt}</strong><br>
      Type : ${vente.typeVente === 'comptant' ? 'Comptant' : vente.typeVente === 'credit' ? 'Crédit' : 'Acompte'}
    </div>
    <div class="partie" style="text-align:right">
      <h4>Facturé à</h4>
      <strong>${vente.clientNom}</strong>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Désignation</th>
        <th style="text-align:center">Qté</th>
        <th style="text-align:right">Prix unit.</th>
        <th style="text-align:right">Remise</th>
        <th style="text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>${lignesHtml}</tbody>
  </table>

  <div class="totaux">
    <div class="totaux-row"><span>Sous-total</span><span>${this.formatMontant(vente.sousTotal, devise)}</span></div>
    ${vente.remise > 0 ? `<div class="totaux-row"><span>Remise globale</span><span style="color:#ef4444">-${this.formatMontant(vente.remise, devise)}</span></div>` : ''}
    <div class="totaux-row total"><span>TOTAL</span><span>${this.formatMontant(vente.total, devise)}</span></div>
    ${vente.montantPaye > 0 ? `<div class="totaux-row" style="color:#16a34a"><span>Montant payé</span><span>${this.formatMontant(vente.montantPaye, devise)}</span></div>` : ''}
    ${vente.soldeRestant > 0 ? `<div class="totaux-row" style="color:#ef4444"><span>Solde restant</span><span>${this.formatMontant(vente.soldeRestant, devise)}</span></div>` : ''}
  </div>

  <div class="mentions">
    <p>Merci pour votre confiance ! — ${nomEnt}</p>
    <p style="margin-top:4px">Document généré automatiquement le ${new Date().toLocaleString('fr-FR')}</p>
  </div>

  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=720');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }

  printRecu(vente: Vente, settings?: AppSettings | null): void {
    const nomEnt = settings?.nomEntreprise || 'GWater Distribution';
    const adresse = settings?.adresse || 'Conakry, Guinée';
    const tel = settings?.telephone || '';
    const devise = settings?.devise || 'FCFA';
    const dateStr = vente.createdAt
      ? new Date(vente.createdAt).toLocaleDateString('fr-FR')
      : '';

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Ticket ${vente.numero}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; padding: 10px; }
    .center { text-align: center; }
    .sep { border-top: 1px dashed #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; padding: 2px 0; }
    .bold { font-weight: 700; }
    .total { font-size: 14px; font-weight: 700; }
    @media print { body { width: 80mm; } }
  </style>
</head>
<body>
  <div class="center bold" style="font-size:15px">💧 ${nomEnt}</div>
  <div class="center" style="font-size:10px">${adresse}</div>
  ${tel ? `<div class="center" style="font-size:10px">${tel}</div>` : ''}
  <div class="sep"></div>
  <div class="row"><span>Ticket N°</span><span>${vente.numero}</span></div>
  <div class="row"><span>Date</span><span>${dateStr}</span></div>
  <div class="row"><span>Client</span><span>${vente.clientNom}</span></div>
  <div class="row"><span>Vendeur</span><span>${vente.vendeurNom}</span></div>
  <div class="sep"></div>
  ${(vente.lignes || []).map(l => `
  <div class="row">
    <span>${l.produitNom} x${l.quantite}</span>
    <span>${this.formatMontant(l.total, devise)}</span>
  </div>`).join('')}
  <div class="sep"></div>
  <div class="row total"><span>TOTAL</span><span>${this.formatMontant(vente.total, devise)}</span></div>
  ${vente.montantPaye > 0 ? `<div class="row"><span>Payé</span><span>${this.formatMontant(vente.montantPaye, devise)}</span></div>` : ''}
  ${vente.soldeRestant > 0 ? `<div class="row"><span>Reste</span><span>${this.formatMontant(vente.soldeRestant, devise)}</span></div>` : ''}
  <div class="sep"></div>
  <div class="center" style="font-size:10px;margin-top:4px">Merci pour votre achat !</div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=340,height=600');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }

  private formatMontant(val: number, devise = 'FCFA'): string {
    return Math.round(val || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + ' ' + devise;
  }
}

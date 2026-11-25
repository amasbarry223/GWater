import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WhatsappService {

  /** Ouvre WhatsApp Web avec un message de relance de solde dû */
  openRelance(client: { nom: string; telephone: string; solde: number }): void {
    const tel = this.sanitizeTel(client.telephone);
    const montantFmt = this.formatFcfa(client.solde);
    const message = `Bonjour ${client.nom},\n\nNous vous rappelons que vous avez un solde dû de *${montantFmt}* auprès de GWater.\n\nMerci de régulariser votre situation dans les meilleurs délais.\n\nCordialement,\nL'équipe GWater 💧`;
    this.openWhatsApp(tel, message);
  }

  /** Ouvre WhatsApp Web avec un message de partage de facture */
  partagerFacture(vente: { numero: string; total: number; clientNom: string }, tel: string): void {
    const telSanitized = this.sanitizeTel(tel);
    const totalFmt = this.formatFcfa(vente.total);
    const message = `Bonjour ${vente.clientNom},\n\nVeuillez trouver ci-joint votre facture *N° ${vente.numero}* d'un montant de *${totalFmt}*.\n\nMerci pour votre confiance.\n\nCordialement,\nGWater 💧`;
    this.openWhatsApp(telSanitized, message);
  }

  /** Ouvre WhatsApp Web avec un message de relance pour impayé avec jours de retard */
  openRelanceImpaye(client: { nom: string; telephone: string }, montant: number, joursRetard: number): void {
    const tel = this.sanitizeTel(client.telephone);
    const montantFmt = this.formatFcfa(montant);
    const message = `Bonjour ${client.nom},\n\nNous souhaitons attirer votre attention sur une facture impayée de *${montantFmt}* arrivée à échéance depuis *${joursRetard} jour(s)*.\n\nNous vous prions de bien vouloir effectuer le règlement dans les plus brefs délais afin d'éviter toute interruption de service.\n\nPour tout renseignement, n'hésitez pas à nous contacter.\n\nCordialement,\nService Recouvrement — GWater 💧`;
    this.openWhatsApp(tel, message);
  }

  private openWhatsApp(tel: string, message: string): void {
    const encoded = encodeURIComponent(message);
    const url = tel
      ? `https://wa.me/${tel}?text=${encoded}`
      : `https://web.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
  }

  private sanitizeTel(tel: string): string {
    // Garde uniquement les chiffres et le + initial
    return tel.replace(/[\s\-().]/g, '').replace(/^00/, '+');
  }

  private formatFcfa(val: number): string {
    return Math.round(val).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + ' FCFA';
  }
}

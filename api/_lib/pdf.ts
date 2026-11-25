/**
 * Générateur de PDF A4 minimal (PDF 1.4, police Helvetica intégrée) sans dépendance externe.
 * Gère les caractères accentués français via l'encodage WinAnsiEncoding.
 */

const A4_W = 595;
const A4_H = 842;

/** Convertit une chaîne UTF-8 en octets WinAnsi (CP1252) et échappe les caractères PDF. */
function pdfText(s: string): string {
  const clean = (s || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/—/g, '-');
  let out = '';
  for (const ch of clean) {
    const code = ch.codePointAt(0) ?? 32;
    if (ch === '\\' || ch === '(' || ch === ')') {
      out += '\\' + ch;
    } else if (code >= 32 && code <= 126) {
      out += ch;
    } else if (code >= 160 && code <= 255) {
      out += '\\' + code.toString(8).padStart(3, '0');
    } else {
      out += ' ';
    }
  }
  return `(${out})`;
}

export interface RelevePdfInput {
  entreprise: string;
  adresse?: string;
  telephoneEntreprise?: string;
  client: { code: string; nom: string; telephone: string; quartier?: string; solde: number };
  factures: { numero: string; date: string; total: number; paye: number; reste: number; statut: string }[];
  dateEdition: string;
}

function fmt(n: number): string {
  return Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
}

export function genererRelevePdf(input: RelevePdfInput): Buffer {
  const cmds: string[] = [];
  const text = (x: number, y: number, str: string, size = 10, bold = false) => {
    cmds.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${x} ${y} Tm ${pdfText(str)} Tj ET`);
  };
  const line = (x1: number, y1: number, x2: number, y2: number, lw = 0.6) => {
    cmds.push(`${lw} w ${x1} ${y1} m ${x2} ${y2} l S`);
  };
  const rect = (x: number, y: number, w: number, h: number, r: number, g: number, b: number) => {
    cmds.push(`q ${r} ${g} ${b} rg ${x} ${y} ${w} ${h} re f Q`);
  };

  // En-tête
  cmds.push('0.05 0.65 0.91 RG 0.05 0.65 0.91 rg');
  text(40, 795, input.entreprise || 'GWater Distribution', 18, true);
  cmds.push('0 0 0 rg 0.3 0.3 0.3 RG');
  if (input.adresse || input.telephoneEntreprise) {
    text(40, 778, [input.adresse, input.telephoneEntreprise].filter(Boolean).join(' - '), 9);
  }
  text(390, 795, 'RELEVE DE COMPTE', 13, true);
  text(390, 780, `Edite le ${input.dateEdition}`, 9);
  line(40, 766, 555, 766, 1.2);

  // Fiche client
  rect(40, 695, 515, 60, 0.96, 0.97, 0.98);
  text(52, 738, `Client : ${input.client.nom} (${input.client.code})`, 11, true);
  text(52, 720, `Telephone : ${input.client.telephone || '-'}`, 9);
  text(300, 720, `Quartier : ${input.client.quartier || '-'}`, 9);
  const soldeTxt = input.client.solde > 0 ? `Solde impaye : ${fmt(input.client.solde)}` : 'Compte solde';
  if (input.client.solde > 0) cmds.push('0.86 0.15 0.15 rg');
  else cmds.push('0.09 0.64 0.29 rg');
  text(52, 703, soldeTxt, 11, true);
  cmds.push('0 0 0 rg');

  // Tableau des factures
  let y = 668;
  text(40, y, 'Historique des factures recentes', 11, true);
  y -= 18;
  rect(40, y - 4, 515, 18, 0.92, 0.95, 0.97);
  text(46, y, 'N Facture', 9, true);
  text(145, y, 'Date', 9, true);
  text(230, y, 'Total', 9, true);
  text(325, y, 'Paye', 9, true);
  text(415, y, 'Reste', 9, true);
  text(500, y, 'Statut', 9, true);
  y -= 20;

  if (input.factures.length === 0) {
    text(46, y, 'Aucune facture enregistree.', 9);
    y -= 18;
  } else {
    for (const f of input.factures.slice(0, 28)) {
      if (y < 60) break;
      text(46, y, f.numero.slice(0, 16), 9);
      text(145, y, f.date, 9);
      text(230, y, fmt(f.total), 9);
      text(325, y, fmt(f.paye), 9);
      text(415, y, fmt(f.reste), 9, f.reste > 0);
      text(500, y, f.statut, 9);
      line(40, y - 5, 555, y - 5, 0.3);
      y -= 17;
    }
  }

  // Pied de page
  cmds.push('0.45 0.45 0.45 rg');
  text(40, 36, `${input.entreprise || 'GWater Distribution'} - Document genere automatiquement`, 8);

  const stream = cmds.join('\n');
  const streamBytes = Buffer.byteLength(stream, 'latin1');

  const objs = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_W} ${A4_H}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >> endobj`,
    `4 0 obj << /Length ${streamBytes} >>\nstream\n${stream}\nendstream\nendobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> endobj',
    '6 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >> endobj',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const o of objs) {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += o + '\n';
  }
  const xrefPos = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += `trailer << /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}


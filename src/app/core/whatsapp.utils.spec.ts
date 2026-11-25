import {
  normalizePhone, toChatId, renderTemplate, buildRelanceMessage, niveauPourRetard,
  joursDeRetard, deciderRelanceAuto, isOptOutMessage, buildWaMeUrl, mergeWhatsappSettings,
  DEFAULT_WHATSAPP_SETTINGS, formatFcfa,
} from './whatsapp.utils';

describe('whatsapp.utils', () => {
  describe('normalizePhone', () => {
    it('préfixe l\'indicatif sur un numéro local', () => {
      expect(normalizePhone('621 00 00 00')).toBe('224621000000');
      expect(normalizePhone('0621000000')).toBe('224621000000');
    });
    it('conserve un numéro international', () => {
      expect(normalizePhone('+224 621-00-00-00')).toBe('224621000000');
      expect(normalizePhone('00224621000000')).toBe('224621000000');
      expect(normalizePhone('224621000000')).toBe('224621000000');
      expect(normalizePhone('+33 6 12 34 56 78')).toBe('33612345678');
    });
    it('rejette les numéros inexploitables', () => {
      expect(normalizePhone('')).toBe('');
      expect(normalizePhone(undefined)).toBe('');
      expect(normalizePhone('abc')).toBe('');
      expect(normalizePhone('+12')).toBe('');
    });
    it('respecte un indicatif personnalisé', () => {
      expect(normalizePhone('77 123 45 67', '221')).toBe('221771234567');
    });
  });

  it('toChatId produit le format OpenWA', () => {
    expect(toChatId('621000000')).toBe('224621000000@c.us');
    expect(toChatId('')).toBe('');
  });

  it('renderTemplate remplace les variables', () => {
    expect(renderTemplate('Bonjour {{nom}}, {{ montant }} {{inconnu}}!', { nom: 'Awa', montant: 10 }))
      .toBe('Bonjour Awa, 10 !');
  });

  it('buildRelanceMessage formate montant et signature', () => {
    const msg = buildRelanceMessage(DEFAULT_WHATSAPP_SETTINGS, 'relance1', { nom: 'Awa', montant: 150000, jours: 16.7 });
    expect(msg).toContain('Awa');
    expect(msg).toContain(formatFcfa(150000));
    expect(msg).toContain('16 jour');
    expect(msg).toContain(DEFAULT_WHATSAPP_SETTINGS.signature);
  });

  it('niveauPourRetard choisit le palier le plus élevé atteint', () => {
    const p = DEFAULT_WHATSAPP_SETTINGS.paliers;
    expect(niveauPourRetard(0, p)).toBeNull();
    expect(niveauPourRetard(3, p)).toBe('rappel');
    expect(niveauPourRetard(29, p)).toBe('relance1');
    expect(niveauPourRetard(90, p)).toBe('mise_en_demeure');
  });

  it('joursDeRetard tient compte du délai de paiement', () => {
    const now = new Date('2026-03-31T12:00:00Z');
    expect(joursDeRetard(new Date('2026-03-01T12:00:00Z'), 30, now)).toBe(0);
    expect(joursDeRetard(new Date('2026-03-01T12:00:00Z'), 10, now)).toBe(20);
    expect(joursDeRetard(null, 10, now)).toBe(0);
  });

  describe('deciderRelanceAuto', () => {
    const base = {
      paliers: DEFAULT_WHATSAPP_SETTINGS.paliers, delaiMin: 7, cycle: '2026-01-01',
      now: new Date('2026-03-01T09:00:00Z'),
    };
    it('envoie le premier palier atteint', () => {
      expect(deciderRelanceAuto({ ...base, joursRetard: 5 })).toEqual({ envoyer: true, niveau: 'rappel', raison: 'ok' });
    });
    it('n\'envoie pas deux fois le même palier sur un même cycle', () => {
      const d = deciderRelanceAuto({ ...base, joursRetard: 10, dernierNiveau: 'rappel', dernierCycle: '2026-01-01',
        derniereRelanceAt: new Date('2026-02-01') });
      expect(d.envoyer).toBe(false);
    });
    it('repart de zéro sur un nouveau cycle', () => {
      const d = deciderRelanceAuto({ ...base, joursRetard: 5, dernierNiveau: 'relance2', dernierCycle: '2025-10-01',
        derniereRelanceAt: new Date('2026-01-01') });
      expect(d).toMatchObject({ envoyer: true, niveau: 'rappel' });
    });
    it('respecte le délai minimum', () => {
      const d = deciderRelanceAuto({ ...base, joursRetard: 20, dernierNiveau: 'rappel', dernierCycle: '2026-01-01',
        derniereRelanceAt: new Date('2026-02-27T09:00:00Z') });
      expect(d).toMatchObject({ envoyer: false, raison: 'délai minimum non écoulé' });
    });
    it('respecte l\'opt-out', () => {
      expect(deciderRelanceAuto({ ...base, joursRetard: 90, optOut: true }).envoyer).toBe(false);
    });
  });

  it('isOptOutMessage reconnaît STOP / ARRÊT', () => {
    expect(isOptOutMessage('stop')).toBe(true);
    expect(isOptOutMessage(' Arrêt svp')).toBe(true);
    expect(isOptOutMessage('Je paie demain')).toBe(false);
    expect(isOptOutMessage('stopper')).toBe(false);
  });

  it('buildWaMeUrl n\'utilise que des chiffres', () => {
    expect(buildWaMeUrl('+224 621 00 00 00', 'Salut')).toBe('https://wa.me/224621000000?text=Salut');
    expect(buildWaMeUrl('', 'Salut')).toBe('https://web.whatsapp.com/send?text=Salut');
  });

  it('mergeWhatsappSettings complète et trie les paliers', () => {
    const s = mergeWhatsappSettings({ actif: true, paliers: [{ jours: 30, niveau: 'relance2' }, { jours: 1, niveau: 'rappel' }],
      templates: { rappel: 'X' } as any });
    expect(s.actif).toBe(true);
    expect(s.paliers.map(p => p.jours)).toEqual([1, 30]);
    expect(s.templates.rappel).toBe('X');
    expect(s.templates.relance1).toBe(DEFAULT_WHATSAPP_SETTINGS.templates.relance1);
  });
});


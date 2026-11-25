import { createConverter, normalizeTimestamps, stripUndefined } from './firestore.converters';
import { Client } from './models';

describe('firestore.converters', () => {
  it('normalizeTimestamps converts Firestore-like Timestamp objects recursively', () => {
    const fixedDate = new Date('2026-11-25T10:00:00Z');
    const fakeTs = { toDate: () => fixedDate };
    const res = normalizeTimestamps<any>({
      nom: 'Client A',
      createdAt: fakeTs,
      nested: { updatedAt: fakeTs },
      list: [{ at: fakeTs }],
    });
    expect(res.createdAt).toBe(fixedDate);
    expect(res.nested.updatedAt).toBe(fixedDate);
    expect(res.list[0].at).toBe(fixedDate);
  });

  it('stripUndefined removes undefined keys while keeping falsy values', () => {
    const clean = stripUndefined({ a: 0, b: '', c: false, d: null, e: undefined });
    expect(clean).toEqual({ a: 0, b: '', c: false, d: null });
    expect('e' in clean).toBe(false);
  });

  it('createConverter serializes without id/undefined and deserializes with id + Date', () => {
    const converter = createConverter<Client>();
    const serialized = converter.toFirestore({
      id: 'cli-1',
      code: 'CLI-0001',
      nom: 'Boutique Test',
      type: 'boutique',
      telephone: '+224620000000',
      whatsapp: undefined,
      adresse: 'Kaloum',
      quartier: 'Kaloum',
      grilleTarifaire: 'gros',
      modePaiement: 'especes',
      plafondCredit: 100000,
      delaiPaiement: 30,
      solde: 0,
      statut: 'actif',
    });
    expect(serialized['id']).toBeUndefined();
    expect('whatsapp' in serialized).toBe(false);
    expect(serialized['nom']).toBe('Boutique Test');

    const date = new Date('2026-11-25T12:00:00Z');
    const snap = {
      id: 'cli-1',
      data: () => ({ nom: 'Boutique Test', createdAt: { toDate: () => date } }),
    } as any;
    const model = converter.fromFirestore(snap);
    expect(model.id).toBe('cli-1');
    expect(model.createdAt).toEqual(date);
  });
});

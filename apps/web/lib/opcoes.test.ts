import { describe, expect, it } from 'vitest';
import {
  formatCents, hasOptions, launchBody, linePrice, moveRow, nameKey, OPTION_MESSAGES, optionsBody, priceCents, toggleAddon,
  toRow, validateChoice, validateOptions, type MenuOptions, type OptionRow,
} from './opcoes';

// SPEC/2026-11-17-tela-de-variacoes-e-adicionais.md (T-01)
const row = (name: string, price: string, key = name): OptionRow => ({ key, name, price });
const flat = (text: string) => text.replace(/\s/g, ' ');

const pizza: MenuOptions = {
  menuItemId: 7,
  variants: [{ id: 1, name: 'Média', price: '40.00' }, { id: 2, name: 'Grande', price: '55.00' }],
  addons: [{ id: 5, name: 'Borda', price: '8.00' }, { id: 6, name: 'Orégano', price: '0.00' }],
};

describe('valores e nomes', () => {
  it.each([['40', 4000], ['40,5', 4050], ['1.234,56', 123456], ['R$ 8', 800], ['0', 0]])('preço %s', (raw, cents) => {
    expect(priceCents(raw)).toBe(cents);
  });

  it('preço inválido é null', () => {
    expect(priceCents('')).toBeNull();
    expect(priceCents('1,234')).toBeNull();
    expect(priceCents('-1')).toBeNull();
  });

  it('chave sem acentos e maiúsculas', () => {
    expect(nameKey('  Orégano ')).toBe(nameKey('OREGANO'));
  });

  it('linha editável a partir da opção salva', () => {
    expect(toRow({ id: 3, name: 'Média', price: '40.00' }, 0)).toEqual({ key: 's3-0', name: 'Média', price: '40,00' });
  });
});

describe('listas (RN-01 a RN-03)', () => {
  it('aceita variações com preço e adicional de preço zero', () => {
    expect(validateOptions([row('Média', '40'), row('Grande', '55')], [row('Orégano', '0')])).toBeNull();
  });

  it('recusa nome vazio ou longo', () => {
    expect(validateOptions([row(' ', '40')], [])).toBe(OPTION_MESSAGES.name);
    expect(validateOptions([], [row('x'.repeat(61), '1')])).toBe(OPTION_MESSAGES.name);
  });

  it('recusa nome repetido sem diferenciar acento e maiúsculas', () => {
    expect(validateOptions([], [row('Borda', '8', 'a'), row('borda', '9', 'b')])).toBe('A opção borda está repetida.');
    expect(validateOptions([row('Média', '1', 'a'), row('MEDIA', '2', 'b')], [])).toBe('A opção MEDIA está repetida.');
  });

  it('variação precisa de preço maior que zero; adicional aceita zero', () => {
    expect(validateOptions([row('Média', '0')], [])).toBe('Informe um preço válido para Média.');
    expect(validateOptions([], [row('Borda', 'x')])).toBe('Informe um preço válido para Borda.');
  });

  it('limita 20 variações e 30 adicionais', () => {
    const many = (count: number) => Array.from({ length: count }, (_, index) => row(`Op ${index}`, '1'));
    expect(validateOptions(many(21), [])).toBe(OPTION_MESSAGES.limit);
    expect(validateOptions([], many(31))).toBe(OPTION_MESSAGES.limit);
    expect(validateOptions(many(20), many(30))).toBeNull();
  });

  it('monta o corpo na ordem com preço em número', () => {
    expect(optionsBody([row(' Média ', '40'), row('Grande', '55,5')], [row('Borda', '8')])).toEqual({
      variants: [{ name: 'Média', price: 40 }, { name: 'Grande', price: 55.5 }],
      addons: [{ name: 'Borda', price: 8 }],
    });
  });

  it('sobe e desce linhas sem passar dos limites', () => {
    expect(moveRow(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveRow(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
    expect(moveRow(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moveRow(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });
});

describe('escolha ao lançar (RN-04 a RN-06)', () => {
  it('sabe se o item tem opções', () => {
    expect(hasOptions(pizza)).toBe(true);
    expect(hasOptions({ menuItemId: 1, variants: [], addons: [] })).toBe(false);
    expect(hasOptions(null)).toBe(false);
  });

  it('preço = variação + adicionais, vezes a quantidade', () => {
    expect(linePrice('30.00', pizza, 2, [5], 2)).toEqual({ unitCents: 6300, totalCents: 12600 });
    expect(linePrice('30.00', pizza, null, [], 1)).toEqual({ unitCents: 3000, totalCents: 3000 });
    expect(linePrice('30.00', pizza, 1, [5, 6], 1).unitCents).toBe(4800);
  });

  it('exige variação quando há e limita adicionais', () => {
    expect(validateChoice('Pizza', pizza, null, [])).toBe('Escolha a variação de Pizza: Média, Grande.');
    expect(validateChoice('Pizza', pizza, 2, [5])).toBeNull();
    expect(validateChoice('Suco', { menuItemId: 2, variants: [], addons: pizza.addons }, null, [])).toBeNull();
    expect(validateChoice('Pizza', pizza, 1, Array.from({ length: 11 }, (_, i) => i))).toBe(OPTION_MESSAGES.addons);
  });

  it('corpo do lançamento e marcação de adicionais', () => {
    expect(launchBody(7, 2, 2, [5])).toEqual({ menuItemId: 7, quantity: 2, variantId: 2, addonIds: [5] });
    expect(launchBody(7, 1, null, [])).toEqual({ menuItemId: 7, quantity: 1 });
    expect(toggleAddon([5], 6)).toEqual([5, 6]);
    expect(toggleAddon([5, 6], 5)).toEqual([6]);
    expect(flat(formatCents(6300))).toBe('R$ 63,00');
  });
});

import { describe, expect, it } from 'vitest';
import { buildLine, optionPriceCents, parseOptions, StoredOption } from '../src/menu-options/option-rules';

// Regras puras de variações e adicionais (SPEC/2026-11-16-variacoes-e-adicionais.md).
describe('RN-02: preço da opção', () => {
  it('aceita até 2 casas; adicional pode ser zero', () => {
    expect(optionPriceCents(18.5, false, 'P')).toBe(1850);
    expect(optionPriceCents('0.10', false, 'P')).toBe(10);
    expect(optionPriceCents(0, true, 'Sem cebola')).toBe(0);
    expect(optionPriceCents(100000, false, 'P')).toBe(10_000_000);
  });

  it.each([
    [0, false],
    [-1, true],
    [1.005, true],
    ['', true],
    ['abc', true],
    [null, true],
    [100000.01, true],
  ])('recusa %s (zero permitido: %s)', (value, allowZero) => {
    expect(() => optionPriceCents(value, allowZero, 'Granola')).toThrow('Informe um preço válido para Granola.');
  });
});

describe('RN-01 a RN-03: listas de opções', () => {
  it('limpa nomes e converte preços', () => {
    expect(
      parseOptions({
        variants: [{ name: ' 300  ml ', price: 15 }, { name: '500 ml', price: '22.50' }],
        addons: [{ name: 'Granola', price: 2 }, { name: 'Sem açúcar', price: 0 }],
      }),
    ).toEqual({
      variants: [{ name: '300 ml', priceCents: 1500 }, { name: '500 ml', priceCents: 2250 }],
      addons: [{ name: 'Granola', priceCents: 200 }, { name: 'Sem açúcar', priceCents: 0 }],
    });
  });

  it('listas ausentes viram vazias', () => {
    expect(parseOptions({})).toEqual({ variants: [], addons: [] });
    expect(parseOptions({ variants: null, addons: [] })).toEqual({ variants: [], addons: [] });
  });

  it('recusa variação de preço zero, nomes inválidos ou repetidos e listas que não são listas', () => {
    expect(() => parseOptions({ variants: [{ name: 'P', price: 0 }] })).toThrow('Informe um preço válido para P.');
    expect(() => parseOptions({ addons: [{ name: '  ', price: 1 }] })).toThrow('Informe o nome de cada opção, de 1 a 60 caracteres.');
    expect(() => parseOptions({ addons: [{ name: 'x'.repeat(61), price: 1 }] })).toThrow('Informe o nome de cada opção, de 1 a 60 caracteres.');
    expect(() => parseOptions({ addons: [null] })).toThrow('Informe o nome de cada opção, de 1 a 60 caracteres.');
    expect(() => parseOptions({ addons: [{ name: 'Leite em pó', price: 1 }, { name: 'leite em PO', price: 2 }] })).toThrow(
      'A opção leite em PO está repetida.',
    );
    expect(() => parseOptions({ variants: 'P, G' })).toThrow('Informe as opções em listas.');
  });

  it('o mesmo nome pode estar nas duas listas', () => {
    expect(parseOptions({ variants: [{ name: 'Grande', price: 10 }], addons: [{ name: 'Grande', price: 1 }] }).addons).toHaveLength(1);
  });

  it('limita 20 variações e 30 adicionais', () => {
    const list = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `Opção ${i}`, price: 1 }));
    expect(parseOptions({ variants: list(20), addons: list(30) }).variants).toHaveLength(20);
    expect(() => parseOptions({ variants: list(21) })).toThrow('Cadastre no máximo 20 variações e 30 adicionais por item.');
    expect(() => parseOptions({ addons: list(31) })).toThrow('Cadastre no máximo 20 variações e 30 adicionais por item.');
  });
});

describe('RF-03, RN-04 a RN-07: linha da comanda', () => {
  const acai = { name: 'Açaí', priceCents: 1200 };
  const sizes: StoredOption[] = [
    { id: 1, name: '300 ml', priceCents: 1500 },
    { id: 2, name: '500 ml', priceCents: 2250 },
  ];
  const extras: StoredOption[] = [
    { id: 10, name: 'Granola', priceCents: 200 },
    { id: 11, name: 'Leite em pó', priceCents: 350 },
    { id: 12, name: 'Sem açúcar', priceCents: 0 },
  ];

  it('soma variação e adicionais no preço unitário (CA-01)', () => {
    expect(buildLine(acai, sizes, extras, { variantId: 2, addonIds: [10, 11, 12] })).toEqual({
      nameSnapshot: 'Açaí (500 ml)',
      variantName: '500 ml',
      unitPriceCents: 2800,
      addons: [
        { name: 'Granola', priceCents: 200 },
        { name: 'Leite em pó', priceCents: 350 },
        { name: 'Sem açúcar', priceCents: 0 },
      ],
    });
  });

  it('sem variações, usa o preço do item, com ou sem adicionais', () => {
    expect(buildLine(acai, [], [], {})).toEqual({ nameSnapshot: 'Açaí', variantName: null, unitPriceCents: 1200, addons: [] });
    expect(buildLine(acai, [], extras, { variantId: null, addonIds: null })).toMatchObject({ unitPriceCents: 1200 });
    expect(buildLine(acai, [], extras, { addonIds: [11] })).toMatchObject({ nameSnapshot: 'Açaí', unitPriceCents: 1550 });
  });

  it('exige variação quando o item tem variações (P-1)', () => {
    expect(() => buildLine(acai, sizes, extras, {})).toThrow('Escolha a variação de Açaí: 300 ml, 500 ml.');
  });

  it('recusa opção de outro item, adicional repetido e mais de 10 adicionais', () => {
    expect(() => buildLine(acai, sizes, extras, { variantId: 3 })).toThrow('Variação não encontrada para este item.');
    expect(() => buildLine(acai, sizes, extras, { variantId: 1, addonIds: [99] })).toThrow('Adicional não encontrado para este item.');
    expect(() => buildLine(acai, sizes, extras, { variantId: 1, addonIds: [10, 11, 10] })).toThrow('O adicional Granola foi escolhido duas vezes.');
    const many: StoredOption[] = Array.from({ length: 11 }, (_, i) => ({ id: 100 + i, name: `A${i}`, priceCents: 0 }));
    expect(buildLine(acai, [], many, { addonIds: many.slice(0, 10).map((a) => a.id) }).addons).toHaveLength(10);
    expect(() => buildLine(acai, [], many, { addonIds: many.map((a) => a.id) })).toThrow('Escolha no máximo 10 adicionais por item.');
  });
});

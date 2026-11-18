import { describe, expect, it } from 'vitest';
import {
  centsLabel, earnLabel, parseRule, pointsEarned, pointsLabel, pointsValueCents, ruleChanges, ruleExamples, ruleForm,
  signedPoints, validateRule, type LoyaltyRule,
} from './fidelidade';

const standard: LoyaltyRule = { pointsPerReal: 1, centsPerPoint: 5, minRedeemPoints: 100 };

describe('validação da regra (RN-01)', () => {
  it('aceita a regra padrão e os limites', () => {
    expect(validateRule(ruleForm(standard))).toBeNull();
    expect(validateRule({ pointsPerReal: '0', centsPerPoint: '1', minRedeemPoints: '1' })).toBeNull();
    expect(validateRule({ pointsPerReal: '100', centsPerPoint: '1000', minRedeemPoints: '100.000' })).toBeNull();
  });

  it.each([
    [{ pointsPerReal: '101' }, 'pontos por real'],
    [{ pointsPerReal: '1,5' }, 'pontos por real'],
    [{ centsPerPoint: '0' }, 'valor do ponto em centavos'],
    [{ centsPerPoint: '1001' }, 'valor do ponto em centavos'],
    [{ minRedeemPoints: '0' }, 'resgate mínimo'],
    [{ minRedeemPoints: '' }, 'resgate mínimo'],
  ])('recusa %o citando %s', (change, label) => {
    expect(validateRule({ ...ruleForm(standard), ...change })).toBe(`Regra de fidelidade inválida: ${label}.`);
  });

  it('lê o formulário como inteiros, aceitando ponto de milhar', () => {
    expect(parseRule({ pointsPerReal: '2', centsPerPoint: '10', minRedeemPoints: '1.000' })).toEqual({ pointsPerReal: 2, centsPerPoint: 10, minRedeemPoints: 1000 });
  });

  it('envia só os campos alterados', () => {
    expect(ruleChanges(standard, ruleForm(standard))).toEqual({});
    expect(ruleChanges(standard, { ...ruleForm(standard), centsPerPoint: '10' })).toEqual({ centsPerPoint: 10 });
  });
});

describe('cálculo e exemplos (RN-02)', () => {
  it('pontos ganhos são a parte inteira', () => {
    expect(pointsEarned(10_000, standard)).toBe(100);
    expect(pointsEarned(1_999, standard)).toBe(19);
    expect(pointsEarned(1_999, { pointsPerReal: 0 })).toBe(0);
  });

  it('valor dos pontos em centavos', () => {
    expect(pointsValueCents(100, standard)).toBe(500);
  });

  it('exemplos da regra padrão', () => {
    expect(ruleExamples(standard)).toEqual({ earned: 100, minRedeemValueCents: 500, spendForMinimumCents: 10_000 });
  });

  it('com ganho desligado não há gasto para o mínimo', () => {
    expect(ruleExamples({ ...standard, pointsPerReal: 0 }).spendForMinimumCents).toBeNull();
  });

  it('arredonda para cima o gasto necessário', () => {
    expect(ruleExamples({ pointsPerReal: 3, centsPerPoint: 5, minRedeemPoints: 100 }).spendForMinimumCents).toBe(3334);
  });
});

describe('rótulos (RN-03, RNF-01)', () => {
  it('pontos com milhar e singular', () => {
    expect(pointsLabel(1)).toBe('1 ponto');
    expect(pointsLabel(1250)).toBe('1.250 pontos');
    expect(pointsLabel(-30)).toBe('30 pontos');
  });

  it('sinal do extrato vem do valor da API', () => {
    expect(signedPoints(120)).toBe('+120');
    expect(signedPoints(-100)).toBe('−100');
    expect(signedPoints(0)).toBe('0');
  });

  it('descreve o ganho', () => {
    expect(earnLabel({ pointsPerReal: 1 })).toBe('1 ponto por real');
    expect(earnLabel({ pointsPerReal: 2 })).toBe('2 pontos por real');
    expect(earnLabel({ pointsPerReal: 0 })).toBe('Ganho de pontos desligado');
  });

  it('formata centavos em reais', () => {
    expect(centsLabel(500).replace(/\s/g, ' ')).toBe('R$ 5,00');
  });
});

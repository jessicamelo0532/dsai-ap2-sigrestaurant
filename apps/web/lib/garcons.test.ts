import { describe, expect, it } from 'vitest';
import {
  createBody, monthToDate, ordersLabel, parseRate, rateLabel, sortWaiters, updateBody, validatePeriod,
  validateWaiterForm, waiterCounts, type Waiter,
} from './garcons';

const waiters: Waiter[] = [
  { id: 1, name: 'Rui', commissionRate: '10.00', active: false },
  { id: 2, name: 'Bia', commissionRate: '12.50', active: true },
  { id: 3, name: 'Ana', commissionRate: '8.00', active: true },
];

describe('taxa de comissão (RN-02)', () => {
  it.each([['12,5', 12.5], ['12.5', 12.5], ['12,5%', 12.5], [' 30 ', 30], ['0', 0]])('lê %s', (raw, value) => {
    expect(parseRate(raw)).toBe(value);
  });

  it('vazio usa o padrão da API', () => {
    expect(parseRate('')).toBeNull();
    expect(parseRate(' % ')).toBeNull();
  });

  it.each(['abc', '-1', '1,234', '1.2.3'])('marca %s como inválido', (raw) => {
    expect(parseRate(raw)).toBeNaN();
  });

  it('formata com vírgula e sem casas sobrando', () => {
    expect(rateLabel('10.00')).toBe('10%');
    expect(rateLabel('12.50')).toBe('12,5%');
    expect(rateLabel('x')).toBe('—');
  });
});

describe('formulário (RN-01, RN-02)', () => {
  it('aceita nome e comissão válidos ou vazia', () => {
    expect(validateWaiterForm({ name: 'Rui', commissionRate: '12,5' })).toBeNull();
    expect(validateWaiterForm({ name: 'Rui', commissionRate: '' })).toBeNull();
    expect(validateWaiterForm({ name: 'Rui', commissionRate: '30' })).toBeNull();
  });

  it('recusa nome curto ou longo', () => {
    expect(validateWaiterForm({ name: ' R ', commissionRate: '' })).toMatch(/nome/);
    expect(validateWaiterForm({ name: 'x'.repeat(81), commissionRate: '' })).toMatch(/nome/);
  });

  it('recusa comissão acima de 30% ou inválida', () => {
    expect(validateWaiterForm({ name: 'Rui', commissionRate: '30,01' })).toMatch(/0 a 30%/);
    expect(validateWaiterForm({ name: 'Rui', commissionRate: 'dez' })).toMatch(/0 a 30%/);
  });

  it('monta o cadastro com ou sem comissão', () => {
    expect(createBody({ name: '  Rui   Lima ', commissionRate: '12,5' })).toEqual({ name: 'Rui Lima', commissionRate: 12.5 });
    expect(createBody({ name: 'Rui', commissionRate: '' })).toEqual({ name: 'Rui' });
  });

  it('a edição envia só o que mudou', () => {
    expect(updateBody(waiters[1], { name: 'Bia', commissionRate: '12,5' })).toEqual({});
    expect(updateBody(waiters[1], { name: 'Beatriz', commissionRate: '12,5' })).toEqual({ name: 'Beatriz' });
    expect(updateBody(waiters[1], { name: 'Bia', commissionRate: '15' })).toEqual({ commissionRate: 15 });
  });
});

describe('lista (RF-02)', () => {
  it('ativos primeiro e depois por nome', () => {
    expect(sortWaiters(waiters).map((waiter) => waiter.name)).toEqual(['Ana', 'Bia', 'Rui']);
  });

  it('conta ativos e inativos', () => {
    expect(waiterCounts(waiters)).toEqual({ active: 2, inactive: 1 });
  });
});

describe('período (RF-06, RN-03)', () => {
  it('padrão é o mês até hoje', () => {
    expect(monthToDate(new Date(2026, 10, 17))).toEqual({ from: '2026-11-01', to: '2026-11-17' });
  });

  it('exige as duas datas em ordem', () => {
    expect(validatePeriod({ from: '2026-11-01', to: '2026-11-17' })).toBeNull();
    expect(validatePeriod({ from: '2026-11-01', to: '2026-11-01' })).toBeNull();
    expect(validatePeriod({ from: '', to: '2026-11-17' })).toMatch(/duas datas/);
    expect(validatePeriod({ from: '2026-11-18', to: '2026-11-17' })).toMatch(/anterior/);
  });

  it('rotula a quantidade de contas', () => {
    expect(ordersLabel(1)).toBe('1 conta');
    expect(ordersLabel(3)).toBe('3 contas');
  });
});

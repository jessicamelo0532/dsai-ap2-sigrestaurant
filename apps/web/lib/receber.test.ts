import { describe, expect, it } from 'vitest';
import {
  defaultDueDate, filterCounts, filterReceivables, formatDay, isoDay, receivableTitle, saleBody, validateReceipt, validateSale,
  type Receivable,
} from './receber';

// SPEC/2026-11-17-contas-a-receber.md (T-05, lógica da tela)
const base: Receivable = {
  id: 1, orderId: 10, tableNumber: 4, customerId: 5, customerName: 'Ana', amount: '60.00', issuedAt: '2026-11-10',
  dueDate: '2026-11-15', status: 'OPEN', situation: 'OVERDUE', paymentMethod: null, receivedAt: null, notes: null,
};
const list: Receivable[] = [
  base,
  { ...base, id: 2, situation: 'UPCOMING', dueDate: '2026-11-27' },
  { ...base, id: 3, status: 'PAID', situation: null, paymentMethod: 'PIX', receivedAt: '2026-11-12' },
];
const today = new Date(2026, 10, 17, 15);

describe('filtros (RF-05)', () => {
  it('em aberto, vencidos, quitados e todos', () => {
    expect(filterReceivables(list, 'abertos').map((r) => r.id)).toEqual([1, 2]);
    expect(filterReceivables(list, 'vencidos').map((r) => r.id)).toEqual([1]);
    expect(filterReceivables(list, 'quitados').map((r) => r.id)).toEqual([3]);
    expect(filterReceivables(list, 'todos')).toHaveLength(3);
    expect(filterCounts(list)).toEqual({ abertos: 2, vencidos: 1, quitados: 1, todos: 3 });
  });
});

describe('venda a prazo (RF-04, RN-03, RN-04)', () => {
  it('vencimento padrão daqui a 30 dias, virando o mês', () => {
    expect(defaultDueDate(today)).toBe('2026-12-17');
    expect(defaultDueDate(new Date(2026, 11, 20))).toBe('2027-01-19');
    expect(isoDay(today)).toBe('2026-11-17');
  });

  it('exige cliente e vencimento de hoje em diante', () => {
    expect(validateSale({ customerId: 5, dueDate: '2026-11-17', notes: '' }, today)).toBeNull();
    expect(validateSale({ customerId: null, dueDate: '2026-12-01', notes: '' }, today)).toBe('Informe o cliente para vender a prazo.');
    expect(validateSale({ customerId: 5, dueDate: '', notes: '' }, today)).toBe('Informe o vencimento no formato AAAA-MM-DD.');
    expect(validateSale({ customerId: 5, dueDate: '2026-11-16', notes: '' }, today)).toBe('O vencimento não pode ser antes de hoje.');
    expect(validateSale({ customerId: 5, dueDate: '2026-12-01', notes: 'x'.repeat(201) }, today)).toBe('A observação pode ter até 200 caracteres.');
  });

  it('corpo sem observação vazia', () => {
    expect(saleBody({ customerId: 5, dueDate: '2026-12-01', notes: ' ' })).toEqual({ customerId: 5, dueDate: '2026-12-01' });
    expect(saleBody({ customerId: 5, dueDate: '2026-12-01', notes: ' paga sexta ' })).toEqual({ customerId: 5, dueDate: '2026-12-01', notes: 'paga sexta' });
  });
});

describe('baixa (RN-06)', () => {
  it('entre a venda e hoje', () => {
    expect(validateReceipt(base, '2026-11-17', today)).toBeNull();
    expect(validateReceipt(base, '2026-11-18', today)).toBe('A data do recebimento não pode ser futura.');
    expect(validateReceipt(base, '2026-11-09', today)).toBe('O recebimento não pode ser antes da venda.');
    expect(validateReceipt(base, 'ontem', today)).toMatch(/AAAA-MM-DD/);
  });
});

describe('rótulos', () => {
  it('data e título', () => {
    expect(formatDay('2026-11-05')).toBe('05/11/2026');
    expect(formatDay(null)).toBe('—');
    expect(receivableTitle(base)).toBe('Comanda #10 · mesa 04');
  });
});

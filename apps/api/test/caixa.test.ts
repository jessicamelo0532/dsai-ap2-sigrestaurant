import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CashMovementDto, CloseCashDto, OpenCashDto } from '../src/cash/cash.dto';
import { CashController } from '../src/cash/cash.controller';
import { CashService } from '../src/cash/cash.service';
import { openOrder, prisma, resetDatabase, service } from './support/database';

// Relógio controlado: o turno começa às 11h (UTC) de 16/11.
const clock = { now: new Date('2026-11-16T11:00:00.000Z') };
const cash = new CashService(prisma, () => clock.now);
const cashController = new CashController(cash);
const at = (iso: string) => { clock.now = new Date(iso); };

beforeEach(async () => {
  await resetDatabase();
  at('2026-11-16T11:00:00.000Z');
});
afterAll(() => prisma.$disconnect());

type Method = 'CASH' | 'CREDIT' | 'DEBIT' | 'PIX';

async function paid(table: number, price: number, method: Method, paidAt: string) {
  const { order } = await openOrder(table, 1, price);
  await service.closeOrder(order.id, { paymentMethod: method });
  return prisma.order.update({ where: { id: order.id }, data: { paidAt: new Date(paidAt) } });
}

// Turno aberto às 11h com R$ 100 de troco; vendas, sangria e reforço até as 15h.
async function busyShift() {
  await cashController.open({ operator: '  Ana Souza  ', openingAmount: 100 });
  await paid(1, 45.5, 'CASH', '2026-11-16T12:00:00.000Z');
  await paid(2, 60, 'PIX', '2026-11-16T12:30:00.000Z');
  await paid(3, 25, 'DEBIT', '2026-11-16T13:00:00.000Z');
  await paid(4, 10, 'CASH', '2026-11-16T13:30:00.000Z');
  await paid(5, 999, 'CASH', '2026-11-16T10:59:00.000Z');
  at('2026-11-16T14:00:00.000Z');
  await cashController.withdraw({ amount: 40, reason: 'Depósito no banco' });
  await cashController.deposit({ amount: 5, reason: 'Moedas para troco' });
  at('2026-11-16T15:00:00.000Z');
}

describe('RF-01 a RF-03: abrir, movimentar e acompanhar', () => {
  it('CA-01: esperado em dinheiro = troco + vendas em dinheiro + reforço − sangria; demais formas = vendas', async () => {
    await busyShift();

    const current = await cashController.current();

    expect(current).toMatchObject({
      status: 'OPEN',
      openedBy: 'Ana Souza',
      openingAmount: '100.00',
      sales: { CASH: '55.50', CREDIT: '0.00', DEBIT: '25.00', PIX: '60.00' },
      expected: { CASH: '120.50', CREDIT: '0.00', DEBIT: '25.00', PIX: '60.00' },
      counted: null,
      differences: null,
      divergent: false,
    });
    expect(current?.movements.map((movement) => [movement.type, movement.amount, movement.reason])).toEqual([
      ['WITHDRAWAL', '40.00', 'Depósito no banco'],
      ['DEPOSIT', '5.00', 'Moedas para troco'],
    ]);
  });

  it('sem turno aberto, o turno atual é nulo', async () => {
    expect(await cash.current()).toBeNull();
  });

  it('CA-05: não abre um segundo turno', async () => {
    await cash.open({ operator: 'Ana', openingAmount: 0 });

    await expect(cash.open({ operator: 'Bruno', openingAmount: 50 })).rejects.toThrow('Já existe um turno de caixa aberto.');
    expect(await prisma.cashSession.count()).toBe(1);
  });

  it('CA-05: sangria não passa do dinheiro na gaveta', async () => {
    await cash.open({ operator: 'Ana', openingAmount: 30 });
    await paid(1, 20, 'CASH', '2026-11-16T10:59:59.000Z');
    await paid(2, 20, 'PIX', '2026-11-16T11:00:00.000Z');
    at('2026-11-16T12:00:00.000Z');

    await expect(cash.withdraw({ amount: 30.01, reason: 'Pagamento de entrega' })).rejects.toThrow(
      'Saldo insuficiente no caixa: há R$ 30,00 em dinheiro.',
    );
    await expect(cash.withdraw({ amount: 30, reason: 'Pagamento de entrega' })).resolves.toMatchObject({ expected: { CASH: '0.00', PIX: '20.00' } });
  });

  it('CA-05: sem turno aberto, sangria, reforço e fechamento são recusados', async () => {
    await expect(cash.withdraw({ amount: 1, reason: 'Teste' })).rejects.toThrow('Não há turno de caixa aberto.');
    await expect(cash.deposit({ amount: 1, reason: 'Teste' })).rejects.toThrow('Não há turno de caixa aberto.');
    await expect(cash.close({ operator: 'Ana', counted: { CASH: 0, CREDIT: 0, DEBIT: 0, PIX: 0 } })).rejects.toThrow('Não há turno de caixa aberto.');
  });

  it('recusa valores e textos inválidos', async () => {
    await expect(cash.open({ operator: 'A', openingAmount: 0 })).rejects.toThrow('Informe o nome de quem abre o caixa');
    await expect(cash.open({ operator: 'Ana', openingAmount: -1 })).rejects.toThrow('Informe o troco inicial');
    await cash.open({ operator: 'Ana', openingAmount: 100 });
    await expect(cash.withdraw({ amount: 0, reason: 'Teste' })).rejects.toThrow('Informe o valor da sangria maior que zero');
    await expect(cash.deposit({ amount: 1.005, reason: 'Teste' })).rejects.toThrow('Informe o valor do reforço maior que zero');
    await expect(cash.deposit({ amount: 5, reason: 'ok' })).rejects.toThrow('Informe o motivo do reforço, de 3 a 200 caracteres.');
  });
});

describe('RF-04: fechar com conferência', () => {
  it('CA-02: informado igual ao esperado fecha sem diferença e sem exigir observação', async () => {
    await busyShift();

    const closed = await cashController.close({ operator: 'Bruno Lima', counted: { CASH: 120.5, CREDIT: 0, DEBIT: 25, PIX: 60 } });

    expect(closed).toMatchObject({ status: 'CLOSED', closedBy: 'Bruno Lima', divergent: false, notes: null });
    expect(closed.closedAt?.toISOString()).toBe('2026-11-16T15:00:00.000Z');
    expect(closed.differences?.every((row) => row.difference === '0.00')).toBe(true);
    expect(await cash.current()).toBeNull();
  });

  it('CA-03: diferença aparece por forma e exige justificativa', async () => {
    await busyShift();
    const counted = { CASH: 118, CREDIT: 0, DEBIT: 26, PIX: 60 };

    await expect(cash.close({ operator: 'Bruno', counted })).rejects.toThrow('Explique a diferença de caixa antes de fechar o turno.');
    expect((await cash.current())?.status).toBe('OPEN');

    const closed = await cash.close({ operator: 'Bruno', counted, notes: 'Troco errado na mesa 4' });

    expect(closed.divergent).toBe(true);
    expect(closed.differences).toEqual([
      { method: 'CASH', expected: '120.50', counted: '118.00', difference: '-2.50' },
      { method: 'CREDIT', expected: '0.00', counted: '0.00', difference: '0.00' },
      { method: 'DEBIT', expected: '25.00', counted: '26.00', difference: '1.00' },
      { method: 'PIX', expected: '60.00', counted: '60.00', difference: '0.00' },
    ]);
    expect(closed.notes).toBe('Troco errado na mesa 4');
  });

  it('CA-04: conta paga depois do fechamento não entra no turno fechado', async () => {
    await busyShift();
    await cash.close({ operator: 'Bruno', counted: { CASH: 120.5, CREDIT: 0, DEBIT: 25, PIX: 60 } });
    await paid(9, 80, 'PIX', '2026-11-16T15:30:00.000Z');

    const [closed] = await cash.list(new Date('2026-11-16T00:00:00.000Z'), new Date('2026-11-17T00:00:00.000Z'));

    expect(closed.sales.PIX).toBe('60.00');
    expect(closed.expected.PIX).toBe('60.00');
  });

  it('recusa valor informado negativo ou faltando', async () => {
    await cash.open({ operator: 'Ana', openingAmount: 0 });

    await expect(cash.close({ operator: 'Ana', counted: { CASH: -1, CREDIT: 0, DEBIT: 0, PIX: 0 } })).rejects.toThrow(
      'Informe o valor conferido em CASH',
    );
    await expect(cash.close({ operator: 'Ana', counted: { CASH: 0, CREDIT: 0, DEBIT: 0 } as never })).rejects.toThrow(
      'Informe o valor conferido em PIX',
    );
  });
});

describe('RF-05: histórico de turnos', () => {
  it('CA-06: lista os turnos do período, do mais recente para o mais antigo, com os valores guardados', async () => {
    await cash.open({ operator: 'Ana', openingAmount: 50 });
    at('2026-11-16T18:00:00.000Z');
    await cash.close({ operator: 'Ana', counted: { CASH: 50, CREDIT: 0, DEBIT: 0, PIX: 0 } });
    at('2026-11-17T11:00:00.000Z');
    await cash.open({ operator: 'Bruno', openingAmount: 80 });

    const list = await cashController.sessions('2026-11-16', '2026-11-17');

    expect(list.map((session) => [session.openedBy, session.status])).toEqual([['Bruno', 'OPEN'], ['Ana', 'CLOSED']]);
    expect(list[1]).toMatchObject({ expected: { CASH: '50.00' }, counted: { CASH: '50.00' }, divergent: false });
    expect(await cashController.sessions('2026-11-17', '2026-11-17')).toHaveLength(1);
  });

  it('consulta um turno pelo id e avisa quando não existe', async () => {
    const opened = await cash.open({ operator: 'Ana', openingAmount: 10 });

    await expect(cashController.session(opened.id)).resolves.toMatchObject({ openedBy: 'Ana', openingAmount: '10.00' });
    await expect(cash.get(999)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('recusa período inválido', () => {
    expect(() => cashController.sessions('16/11/2026', '2026-11-17')).toThrow('Informe datas válidas no formato AAAA-MM-DD.');
  });
});

describe('validação dos dados de entrada', () => {
  async function invalidFields<T extends object>(dto: new () => T, body: Record<string, unknown>) {
    const errors = await validate(plainToInstance(dto, body), { whitelist: true, forbidNonWhitelisted: true });
    return errors.map((error) => error.property).sort();
  }

  it('abertura, movimento e fechamento', async () => {
    expect(await invalidFields(OpenCashDto, { operator: 'Ana', openingAmount: 100 })).toEqual([]);
    expect(await invalidFields(OpenCashDto, { operator: 'A', openingAmount: -1 })).toEqual(['openingAmount', 'operator']);
    expect(await invalidFields(CashMovementDto, { amount: 10.5, reason: 'Banco' })).toEqual([]);
    expect(await invalidFields(CashMovementDto, { amount: 10.555, reason: 'ok' })).toEqual(['amount', 'reason']);
    expect(await invalidFields(CloseCashDto, { operator: 'Ana', counted: { CASH: 1, CREDIT: 0, DEBIT: 0, PIX: 0 } })).toEqual([]);
    expect(await invalidFields(CloseCashDto, { operator: 'Ana', counted: { CASH: -1, CREDIT: 0, DEBIT: 0, PIX: 0 } })).toEqual(['counted']);
  });
});

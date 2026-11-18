import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CashService } from '../src/cash/cash.service';
import { CustomersService } from '../src/customers/customers.service';
import { ReceivablesController } from '../src/receivables/receivables.controller';
import { ReceiveDto, SellOnAccountDto } from '../src/receivables/receivables.dto';
import { ReceivablesService } from '../src/receivables/receivables.service';
import { openOrder, prisma, resetDatabase, service } from './support/database';

// SPEC/2026-11-17-contas-a-receber.md (T-02 a T-04). Relógio controlado: 17/11, 15h (UTC).
const clock = { now: new Date('2026-11-17T15:00:00.000Z') };
const receivables = new ReceivablesService(prisma, () => clock.now);
const controller = new ReceivablesController(receivables);
const customers = new CustomersService(prisma);
const cash = new CashService(prisma, () => clock.now);

beforeEach(async () => {
  await resetDatabase();
  clock.now = new Date('2026-11-17T15:00:00.000Z');
});
afterAll(() => prisma.$disconnect());

async function orderWithCustomer(table: number, price: number, name = 'Ana Teste') {
  const { order } = await openOrder(table, 2, price);
  const customer = await customers.create({ name });
  await customers.assignToOrder(order.id, { customerId: customer.id });
  return { order, customer };
}

describe('RF-01 e CA-01: venda a prazo', () => {
  it('fecha a comanda, libera a mesa e cria o título com o total', async () => {
    const { order, customer } = await orderWithCustomer(4, 30);

    const receivable = await controller.sellOnAccount(order.id, { dueDate: '2026-12-17', notes: ' paga no dia 17 ' });

    expect(receivable).toMatchObject({
      orderId: order.id, tableNumber: 4, customerId: customer.id, customerName: 'Ana Teste', amount: '60.00',
      issuedAt: '2026-11-17', dueDate: '2026-12-17', status: 'OPEN', situation: 'UPCOMING', notes: 'paga no dia 17',
    });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('ON_ACCOUNT');
    expect((await service.listTables()).find((table) => table.number === 4)?.order).toBeNull();
  });

  it('usa o cliente informado quando a comanda não tem cliente', async () => {
    const { order } = await openOrder(2, 1, 25);
    const bia = await customers.create({ name: 'Bia Teste' });

    const receivable = await receivables.sellOnAccount(order.id, { customerId: bia.id, dueDate: '2026-11-17' });

    expect(receivable).toMatchObject({ customerName: 'Bia Teste', amount: '25.00', situation: 'DUE_TODAY' });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).customerId).toBe(bia.id);
  });
});

describe('CA-02: fora da receita e do caixa do turno', () => {
  it('o relatório financeiro e o caixa não contam a venda a prazo', async () => {
    await cash.open({ operator: 'Ana', openingAmount: 0 });
    clock.now = new Date('2026-11-17T16:00:00.000Z');
    const { order } = await orderWithCustomer(4, 30);
    const paid = (await openOrder(5, 1, 10)).order;
    await service.closeOrder(paid.id, { paymentMethod: 'PIX' });
    // O fechamento à vista usa o relógio real; o pagamento é posto dentro do turno simulado.
    await prisma.order.update({ where: { id: paid.id }, data: { paidAt: new Date('2026-11-17T16:00:00.000Z') } });
    await receivables.sellOnAccount(order.id, { dueDate: '2026-12-01' });

    const report = await service.report(new Date('2026-11-17T00:00:00.000Z'), new Date('2026-11-18T00:00:00.000Z'));
    expect(report).toMatchObject({ paidOrders: 1, revenue: expect.anything() });
    expect(Number(report.revenue)).toBe(10);
    const current = await cash.current();
    expect(current?.sales).toMatchObject({ PIX: '10.00', CASH: '0.00' });
  });
});

describe('CA-03: recusas', () => {
  it('sem cliente, cliente desativado e vencimento fora do prazo', async () => {
    const { order } = await openOrder(1, 1, 20);
    const inactive = await customers.create({ name: 'Caio Teste' });
    await customers.update(inactive.id, { active: false });

    await expect(receivables.sellOnAccount(order.id, { dueDate: '2026-12-01' })).rejects.toThrow('Informe o cliente para vender a prazo.');
    await expect(receivables.sellOnAccount(order.id, { customerId: inactive.id, dueDate: '2026-12-01' })).rejects.toThrow('Este cliente está desativado.');
    await expect(receivables.sellOnAccount(order.id, { customerId: inactive.id, dueDate: '2026-11-16' })).rejects.toThrow('O vencimento não pode ser antes de hoje.');
    await expect(receivables.sellOnAccount(order.id, { customerId: inactive.id, dueDate: '2027-11-18' })).rejects.toThrow('O vencimento pode ser de até 365 dias.');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('OPEN');
  });

  it('comanda já fechada, sem itens ou inexistente', async () => {
    const { order, customer } = await orderWithCustomer(1, 20);
    await service.closeOrder(order.id, { paymentMethod: 'CASH' });
    await expect(receivables.sellOnAccount(order.id, { customerId: customer.id, dueDate: '2026-12-01' })).rejects.toThrow('Esta comanda já foi fechada.');
    await expect(receivables.sellOnAccount(9999, { customerId: customer.id, dueDate: '2026-12-01' })).rejects.toThrow('Comanda não encontrada.');
  });
});

describe('RF-02, RN-07 e CA-04: resumo e lista', () => {
  it('soma em aberto igual à soma dos títulos, vencidos, próximos 7 dias e recebidos', async () => {
    const a = await orderWithCustomer(1, 10, 'Ana Teste');
    const b = await orderWithCustomer(2, 20, 'Bia Teste');
    const c = await orderWithCustomer(3, 30, 'Caio Teste');
    const d = await orderWithCustomer(4, 40, 'Duda Teste');
    clock.now = new Date('2026-11-10T15:00:00.000Z');
    await receivables.sellOnAccount(a.order.id, { dueDate: '2026-11-15' });
    clock.now = new Date('2026-11-17T15:00:00.000Z');
    await receivables.sellOnAccount(b.order.id, { dueDate: '2026-11-17' });
    await receivables.sellOnAccount(c.order.id, { dueDate: '2026-11-27' });
    const paid = await receivables.sellOnAccount(d.order.id, { dueDate: '2026-11-20' });
    await receivables.receive(paid.id, { paymentMethod: 'PIX' });

    const result = await controller.list();

    expect(result.today).toBe('2026-11-17');
    expect(result.summary).toEqual({ openCount: 3, open: '120.00', overdue: '20.00', dueNext7Days: '40.00', paidCount: 1, received: '80.00' });
    const openSum = result.receivables.filter((r) => r.status === 'OPEN').reduce((sum, r) => sum + Number(r.amount), 0);
    expect(openSum).toBe(Number(result.summary.open));
    expect(result.receivables.map((r) => [r.customerName, r.situation])).toEqual([
      ['Ana Teste', 'OVERDUE'], ['Bia Teste', 'DUE_TODAY'], ['Duda Teste', null], ['Caio Teste', 'UPCOMING'],
    ]);
    expect((await controller.list('OPEN')).receivables).toHaveLength(3);
    expect((await controller.list('PAID')).receivables.map((r) => r.customerName)).toEqual(['Duda Teste']);
  });
});

describe('RF-03, RN-06 e CA-05: baixa', () => {
  it('registra forma e data e não deixa receber duas vezes', async () => {
    const { order } = await orderWithCustomer(1, 15);
    clock.now = new Date('2026-11-10T12:00:00.000Z');
    const receivable = await receivables.sellOnAccount(order.id, { dueDate: '2026-11-30' });
    clock.now = new Date('2026-11-17T12:00:00.000Z');

    const received = await controller.receive(receivable.id, { paymentMethod: 'PIX', receivedAt: '2026-11-12' });

    expect(received).toMatchObject({ status: 'PAID', paymentMethod: 'PIX', receivedAt: '2026-11-12', situation: null });
    await expect(receivables.receive(receivable.id, { paymentMethod: 'CASH' })).rejects.toThrow('Este título já foi recebido.');
    await expect(receivables.receive(9999, { paymentMethod: 'CASH' })).rejects.toThrow('Título não encontrado.');
  });

  it('recusa data futura ou antes da venda', async () => {
    const { order } = await orderWithCustomer(1, 15);
    const receivable = await receivables.sellOnAccount(order.id, { dueDate: '2026-11-30' });

    await expect(receivables.receive(receivable.id, { paymentMethod: 'PIX', receivedAt: '2026-11-18' })).rejects.toThrow('A data do recebimento não pode ser futura.');
    await expect(receivables.receive(receivable.id, { paymentMethod: 'PIX', receivedAt: '2026-11-16' })).rejects.toThrow('O recebimento não pode ser antes da venda.');
  });
});

describe('validação de entrada', () => {
  it('forma de pagamento obrigatória e cliente opcional', async () => {
    const fields = async (cls: new () => object, data: object) => (await validate(plainToInstance(cls, data))).map((e) => e.property).sort();
    expect(await fields(ReceiveDto, { paymentMethod: 'PIX' })).toEqual([]);
    expect(await fields(ReceiveDto, { paymentMethod: 'CHEQUE' })).toEqual(['paymentMethod']);
    expect(await fields(SellOnAccountDto, { dueDate: '2026-12-01' })).toEqual([]);
    expect(await fields(SellOnAccountDto, { customerId: 0, dueDate: '2026-12-01' })).toEqual(['customerId']);
  });
});

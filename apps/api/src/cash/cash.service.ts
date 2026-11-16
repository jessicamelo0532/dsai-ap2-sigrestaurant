import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { CashMovement, CashSession, Prisma } from '@prisma/client';
import { orderTotalCents, orderTotalSelect, toCents } from '../common/order-total';
import { PrismaService } from '../prisma.service';
import { centsToDecimal } from '../purchasing/purchase-rules';
import { CashMovementDto, CloseCashDto, OpenCashDto } from './cash.dto';
import {
  assertWithdrawal,
  ByMethod,
  cents,
  closingNotes,
  differences,
  expectedByMethod,
  hasDivergence,
  Method,
  METHODS,
  salesByMethod,
  text,
} from './cash-rules';

// O relógio é injetável para testes (RNF-03).
export const CASH_CLOCK = 'CASH_CLOCK';
export type Clock = () => Date;

type Db = Pick<Prisma.TransactionClient, 'order'>;
type SessionWithMovements = CashSession & { movements: CashMovement[] };

const decimals = (values: ByMethod) => Object.fromEntries(METHODS.map((method) => [method, centsToDecimal(values[method])]));
const NO_SESSION = 'Não há turno de caixa aberto.';

// Caixa por turno (SPEC/2026-11-16-caixa-por-turno.md).
@Injectable()
export class CashService {
  private readonly now: Clock;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(CASH_CLOCK) clock?: Clock,
  ) {
    this.now = clock ?? (() => new Date());
  }

  // RF-01 e RN-01
  async open(dto: OpenCashDto) {
    const operator = text(dto.operator, 2, 80, 'Informe o nome de quem abre o caixa, de 2 a 80 caracteres.');
    const openingCents = cents(dto.openingAmount, 'Informe o troco inicial, zero ou mais, com até 2 casas decimais.');
    const session = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('caixa'))`;
      if (await tx.cashSession.findFirst({ where: { status: 'OPEN' } })) {
        throw new BadRequestException('Já existe um turno de caixa aberto.');
      }
      return tx.cashSession.create({
        data: { openedBy: operator, openingAmount: centsToDecimal(openingCents), openedAt: this.now() },
        include: { movements: true },
      });
    });
    return this.describe(session);
  }

  // RF-02: sangria (RN-05) e reforço.
  withdraw(dto: CashMovementDto) {
    return this.move('WITHDRAWAL', dto);
  }

  deposit(dto: CashMovementDto) {
    return this.move('DEPOSIT', dto);
  }

  // RF-03
  async current() {
    const session = await this.prisma.cashSession.findFirst({ where: { status: 'OPEN' }, include: { movements: true } });
    return session ? this.describe(session) : null;
  }

  // RF-04, RN-07 e RN-08: guarda esperado e informado; diferença exige justificativa.
  async close(dto: CloseCashDto) {
    const operator = text(dto.operator, 2, 80, 'Informe o nome de quem fecha o caixa, de 2 a 80 caracteres.');
    const counted = Object.fromEntries(
      METHODS.map((method) => [method, cents(dto.counted?.[method], `Informe o valor conferido em ${method}, zero ou mais, com até 2 casas decimais.`)]),
    ) as ByMethod;
    const session = await this.prisma.$transaction(async (tx) => {
      const open = await this.lockOpenSession(tx);
      const closedAt = this.now();
      const expected = await this.expected(tx, open, closedAt);
      const notes = closingNotes(hasDivergence(differences(expected, counted)), dto.notes);
      return tx.cashSession.update({
        where: { id: open.id },
        data: {
          status: 'CLOSED',
          closedBy: operator,
          closedAt,
          notes,
          expectedCash: centsToDecimal(expected.CASH),
          expectedCredit: centsToDecimal(expected.CREDIT),
          expectedDebit: centsToDecimal(expected.DEBIT),
          expectedPix: centsToDecimal(expected.PIX),
          countedCash: centsToDecimal(counted.CASH),
          countedCredit: centsToDecimal(counted.CREDIT),
          countedDebit: centsToDecimal(counted.DEBIT),
          countedPix: centsToDecimal(counted.PIX),
        },
        include: { movements: true },
      });
    });
    return this.describe(session);
  }

  // RF-05
  async list(start: Date, end: Date) {
    const sessions = await this.prisma.cashSession.findMany({
      where: { openedAt: { gte: start, lt: end } },
      orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
      include: { movements: true },
    });
    return Promise.all(sessions.map((session) => this.describe(session)));
  }

  async get(id: number) {
    const session = await this.prisma.cashSession.findUnique({ where: { id }, include: { movements: true } });
    if (!session) throw new NotFoundException('Turno de caixa não encontrado.');
    return this.describe(session);
  }

  private async move(type: 'WITHDRAWAL' | 'DEPOSIT', dto: CashMovementDto) {
    const label = type === 'WITHDRAWAL' ? 'da sangria' : 'do reforço';
    const amountCents = cents(dto.amount, `Informe o valor ${label} maior que zero, com até 2 casas decimais.`, true);
    const reason = text(dto.reason, 3, 200, `Informe o motivo ${label}, de 3 a 200 caracteres.`);
    const session = await this.prisma.$transaction(async (tx) => {
      const open = await this.lockOpenSession(tx);
      if (type === 'WITHDRAWAL') assertWithdrawal((await this.expected(tx, open, this.now())).CASH, amountCents);
      await tx.cashMovement.create({
        data: { sessionId: open.id, type, amount: centsToDecimal(amountCents), reason, createdAt: this.now() },
      });
      return tx.cashSession.findUniqueOrThrow({ where: { id: open.id }, include: { movements: true } });
    });
    return this.describe(session);
  }

  // RNF-02 e RN-06: trava o turno aberto.
  private async lockOpenSession(tx: Prisma.TransactionClient): Promise<SessionWithMovements> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('caixa'))`;
    const open = await tx.cashSession.findFirst({ where: { status: 'OPEN' }, include: { movements: true } });
    if (!open) throw new BadRequestException(NO_SESSION);
    return open;
  }

  // RN-03: contas pagas a partir da abertura e antes do fim do turno.
  private async sales(db: Db, session: CashSession, until: Date): Promise<ByMethod> {
    const orders = await db.order.findMany({
      where: { status: 'PAID', paidAt: { gte: session.openedAt, lt: until }, paymentMethod: { not: null } },
      select: { paymentMethod: true, ...orderTotalSelect },
    });
    return salesByMethod(
      orders.map((order) => ({
        method: order.paymentMethod as Method,
        cents: orderTotalCents(order),
      })),
    );
  }

  // RN-04
  private async expected(db: Db, session: SessionWithMovements, until: Date): Promise<ByMethod> {
    return expectedByMethod(
      toCents(session.openingAmount),
      await this.sales(db, session, until),
      session.movements.map((movement) => ({ type: movement.type, cents: toCents(movement.amount) })),
    );
  }

  private async describe(session: SessionWithMovements) {
    const until = session.closedAt ?? new Date(this.now().getTime() + 1);
    const sales = await this.sales(this.prisma, session, until);
    const closed = session.status === 'CLOSED';
    const expected: ByMethod = closed
      ? { CASH: toCents(session.expectedCash), CREDIT: toCents(session.expectedCredit), DEBIT: toCents(session.expectedDebit), PIX: toCents(session.expectedPix) }
      : await this.expected(this.prisma, session, until);
    const counted: ByMethod | null = closed
      ? { CASH: toCents(session.countedCash), CREDIT: toCents(session.countedCredit), DEBIT: toCents(session.countedDebit), PIX: toCents(session.countedPix) }
      : null;
    const rows = counted ? differences(expected, counted) : null;
    return {
      id: session.id,
      status: session.status,
      openedBy: session.openedBy,
      openedAt: session.openedAt,
      openingAmount: centsToDecimal(toCents(session.openingAmount)),
      closedBy: session.closedBy,
      closedAt: session.closedAt,
      sales: decimals(sales),
      movements: [...session.movements]
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id)
        .map((movement) => ({ id: movement.id, type: movement.type, amount: centsToDecimal(toCents(movement.amount)), reason: movement.reason, createdAt: movement.createdAt })),
      expected: decimals(expected),
      counted: counted ? decimals(counted) : null,
      differences: rows
        ? rows.map((row) => ({ method: row.method, expected: centsToDecimal(row.expectedCents), counted: centsToDecimal(row.countedCents), difference: centsToDecimal(row.differenceCents) }))
        : null,
      divergent: rows ? hasDivergence(rows) : false,
      notes: session.notes,
    };
  }
}

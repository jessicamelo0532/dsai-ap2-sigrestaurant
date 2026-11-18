// Tela do caixa por turno (SPEC/2026-11-17-tela-do-caixa.md).
// Funções puras: recebem o turno como GET /cash/current devolve e preparam a tela.
// Dinheiro em centavos inteiros nas contas (RNF-02); a API devolve valores como texto "12.50".

export type CashMethod = 'CASH' | 'CREDIT' | 'DEBIT' | 'PIX';
export type ByMethod<T = string> = Record<CashMethod, T>;
export type CashMovementType = 'WITHDRAWAL' | 'DEPOSIT';

export type CashMovement = {
  id: number;
  type: CashMovementType;
  amount: string;
  reason: string;
  createdAt: string;
};

export type CashDifference = { method: CashMethod; expected: string; counted: string; difference: string };

export type CashSession = {
  id: number;
  status: 'OPEN' | 'CLOSED';
  openedBy: string;
  openedAt: string;
  openingAmount: string;
  closedBy: string | null;
  closedAt: string | null;
  sales: ByMethod;
  movements: CashMovement[];
  expected: ByMethod;
  counted: ByMethod | null;
  differences: CashDifference[] | null;
  divergent: boolean;
  notes: string | null;
};

export const CASH_METHODS: CashMethod[] = ['CASH', 'CREDIT', 'DEBIT', 'PIX'];

export const methodLabels: Record<CashMethod, string> = {
  CASH: 'Dinheiro',
  CREDIT: 'Crédito',
  DEBIT: 'Débito',
  PIX: 'Pix',
};

export const movementLabels: Record<CashMovementType, string> = {
  WITHDRAWAL: 'Sangria',
  DEPOSIT: 'Reforço',
};

// RN-04: aceita "12,50", "12.50", "1.234,56" e o prefixo "R$". Devolve centavos ou null se inválido.
// Mais de 2 casas decimais é inválido (RN-01/RN-02), igual à API.
export function parseMoneyInput(raw: string): number | null {
  let text = raw.replace(/R\$/i, '').replace(/\s+/g, '');
  if (!text) return null;
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [reais, centavos = ''] = text.split('.');
  return Number(reais) * 100 + Number(centavos.padEnd(2, '0'));
}

// Texto "12.50" da API (ou número) para centavos.
export function toCents(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  return Math.round(Number(value) * 100);
}

// Centavos para o corpo da requisição: a API recebe número com até 2 casas.
export const centsToAmount = (cents: number) => cents / 100;

// RNF-01: "R$ 1.234,56", com sinal quando negativo.
export function brl(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const reais = String(Math.floor(absolute / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}R$ ${reais},${String(absolute % 100).padStart(2, '0')}`;
}

const length = (value: string) => value.trim().replace(/\s+/g, ' ').length;

// RN-01: abertura.
export function validateOpenForm(form: { operator: string; openingAmount: string }): string | null {
  const operator = length(form.operator);
  if (operator < 2 || operator > 80) return 'Informe o operador (2 a 80 caracteres).';
  const cents = parseMoneyInput(form.openingAmount === '' ? '0' : form.openingAmount);
  if (cents === null) return 'Informe o troco inicial em reais, com até 2 casas (ex.: 150,00).';
  return null;
}

// RN-01: sangria e reforço.
export function validateMovementForm(type: CashMovementType, form: { amount: string; reason: string }): string | null {
  const label = type === 'WITHDRAWAL' ? 'da sangria' : 'do reforço';
  const cents = parseMoneyInput(form.amount);
  if (cents === null || cents === 0) return `Informe o valor ${label} maior que zero, com até 2 casas.`;
  const reason = length(form.reason);
  if (reason < 3 || reason > 200) return `Informe o motivo ${label} (3 a 200 caracteres).`;
  return null;
}

export type ClosingRow = { method: CashMethod; expectedCents: number; countedCents: number; differenceCents: number };

// RN-04: campo vazio no fechamento vale zero; texto inválido devolve null.
export function countedCents(raw: string): number | null {
  return raw.trim() === '' ? 0 : parseMoneyInput(raw);
}

// RN-03: prévia da diferença por forma, a partir do esperado que a API devolveu.
export function closingPreview(expected: ByMethod, counted: ByMethod<string>): ClosingRow[] {
  return CASH_METHODS.map((method) => {
    const expectedCents = toCents(expected[method]);
    const countedValue = countedCents(counted[method]) ?? 0;
    return { method, expectedCents, countedCents: countedValue, differenceCents: countedValue - expectedCents };
  });
}

export const hasDifference = (rows: { differenceCents: number }[]) => rows.some((row) => row.differenceCents !== 0);

export function differenceLabel(cents: number): string {
  if (cents === 0) return 'Confere';
  return cents > 0 ? `Sobra de ${brl(cents)}` : `Falta de ${brl(-cents)}`;
}

// RN-01, RN-02 e RN-03: fechamento.
export function validateCloseForm(
  form: { operator: string; counted: ByMethod<string>; notes: string },
  expected: ByMethod,
): string | null {
  const operator = length(form.operator);
  if (operator < 2 || operator > 80) return 'Informe o operador (2 a 80 caracteres).';
  for (const method of CASH_METHODS) {
    if (countedCents(form.counted[method]) === null) return `Valor contado em ${methodLabels[method]} inválido: use reais com até 2 casas.`;
  }
  const notes = form.notes.trim().length;
  if (notes > 500) return 'A observação pode ter até 500 caracteres.';
  if (hasDifference(closingPreview(expected, form.counted)) && notes < 5) {
    return 'Explique a diferença de caixa antes de fechar o turno.';
  }
  return null;
}

// Corpo do POST /cash/close (RF-05).
export function closeBody(form: { operator: string; counted: ByMethod<string>; notes: string }) {
  const counted = Object.fromEntries(
    CASH_METHODS.map((method) => [method, centsToAmount(countedCents(form.counted[method]) ?? 0)]),
  ) as ByMethod<number>;
  const notes = form.notes.trim();
  return { operator: form.operator.trim(), counted, ...(notes ? { notes } : {}) };
}

export const emptyCounted = (): ByMethod<string> => ({ CASH: '', CREDIT: '', DEBIT: '', PIX: '' });

export function totalCents(values: ByMethod): number {
  return CASH_METHODS.reduce((total, method) => total + toCents(values[method]), 0);
}

// RF-06: período padrão do histórico, últimos 30 dias no fuso do aparelho.
export function historyRange(today = new Date(), days = 30): { from: string; to: string } {
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));
  return { from: localDay(start), to: localDay(today) };
}

export function localDay(date: Date): string {
  const two = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const two = (value: number) => String(value).padStart(2, '0');
  return `${two(date.getDate())}/${two(date.getMonth() + 1)} ${two(date.getHours())}:${two(date.getMinutes())}`;
}

export function sessionStatusLabel(session: Pick<CashSession, 'status' | 'divergent'>): string {
  if (session.status === 'OPEN') return 'Aberto';
  return session.divergent ? 'Fechado com diferença' : 'Fechado sem diferença';
}

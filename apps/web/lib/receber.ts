// Contas a receber na tela (SPEC/2026-11-17-contas-a-receber.md).
// Funções puras: recebem os títulos como GET /receivables devolve e preparam a tela.

export type Situation = 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING';
export type PaymentMethod = 'CASH' | 'CREDIT' | 'DEBIT' | 'PIX';

export type Receivable = {
  id: number;
  orderId: number;
  tableNumber: number;
  customerId: number;
  customerName: string;
  amount: string;
  issuedAt: string;
  dueDate: string;
  status: 'OPEN' | 'PAID';
  situation: Situation | null;
  paymentMethod: PaymentMethod | null;
  receivedAt: string | null;
  notes: string | null;
};

export type ReceivableSummary = { openCount: number; open: string; overdue: string; dueNext7Days: string; paidCount: number; received: string };
export type ReceivableList = { today: string; summary: ReceivableSummary; receivables: Receivable[] };

export type ReceivableFilter = 'abertos' | 'vencidos' | 'quitados' | 'todos';

export const FILTERS: { id: ReceivableFilter; label: string }[] = [
  { id: 'abertos', label: 'Em aberto' },
  { id: 'vencidos', label: 'Vencidos' },
  { id: 'quitados', label: 'Quitados' },
  { id: 'todos', label: 'Todos' },
];

export const situationLabels: Record<Situation, string> = { OVERDUE: 'Vencido', DUE_TODAY: 'Vence hoje', UPCOMING: 'A vencer' };
export const methodLabels: Record<PaymentMethod, string> = { CASH: 'Dinheiro', CREDIT: 'Crédito', DEBIT: 'Débito', PIX: 'Pix' };

// RF-05
export function filterReceivables(list: readonly Receivable[], filter: ReceivableFilter): Receivable[] {
  if (filter === 'abertos') return list.filter((entry) => entry.status === 'OPEN');
  if (filter === 'vencidos') return list.filter((entry) => entry.situation === 'OVERDUE');
  if (filter === 'quitados') return list.filter((entry) => entry.status === 'PAID');
  return [...list];
}

export function filterCounts(list: readonly Receivable[]): Record<ReceivableFilter, number> {
  return {
    abertos: filterReceivables(list, 'abertos').length,
    vencidos: filterReceivables(list, 'vencidos').length,
    quitados: filterReceivables(list, 'quitados').length,
    todos: list.length,
  };
}

const two = (value: number) => String(value).padStart(2, '0');
export const isoDay = (date: Date) => `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;

// RF-04 (P-1): vencimento padrão daqui a 30 dias.
export function defaultDueDate(today = new Date(), days = 30): string {
  const due = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
  return isoDay(due);
}

// RN-03 e RN-04 na tela, com as mensagens da API (o limite de dias é conferido pela API).
export function validateSale(form: { customerId: number | null; dueDate: string; notes: string }, today = new Date()): string | null {
  if (!form.customerId) return 'Informe o cliente para vender a prazo.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dueDate)) return 'Informe o vencimento no formato AAAA-MM-DD.';
  if (form.dueDate < isoDay(today)) return 'O vencimento não pode ser antes de hoje.';
  if (form.notes.trim().length > 200) return 'A observação pode ter até 200 caracteres.';
  return null;
}

export function saleBody(form: { customerId: number | null; dueDate: string; notes: string }) {
  const notes = form.notes.trim();
  return { customerId: form.customerId, dueDate: form.dueDate, ...(notes ? { notes } : {}) };
}

// RN-06 na tela.
export function validateReceipt(receivable: Pick<Receivable, 'issuedAt'>, receivedAt: string, today = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(receivedAt)) return 'Informe a data do recebimento no formato AAAA-MM-DD.';
  if (receivedAt > isoDay(today)) return 'A data do recebimento não pode ser futura.';
  if (receivedAt < receivable.issuedAt) return 'O recebimento não pode ser antes da venda.';
  return null;
}

// "2026-11-17" -> "17/11/2026" sem passar por fuso.
export function formatDay(day: string | null): string {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return '—';
  const [year, month, date] = day.split('-');
  return `${date}/${month}/${year}`;
}

export function receivableTitle(entry: Pick<Receivable, 'orderId' | 'tableNumber'>): string {
  return `Comanda #${entry.orderId} · mesa ${two(entry.tableNumber)}`;
}

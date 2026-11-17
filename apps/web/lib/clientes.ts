// Tela de clientes e histórico (SPEC/2026-11-17-tela-de-clientes.md).
// Funções puras: recebem os dados como a API devolve e preparam a tela.

export type Customer = {
  id: number;
  name: string;
  phone: string | null;
  notes: string | null;
  active: boolean;
};

export type CustomerHistory = {
  customer: Customer;
  period: { from: string; to: string } | null;
  visits: number;
  totalSpent: string;
  averageTicket: string;
  firstVisit: string | null;
  lastVisit: string | null;
  favorites: { name: string; quantity: number }[];
  orders: { id: number; paidAt: string; tableNumber: number; total: string }[];
};

export type CustomerForm = { name: string; phone: string; notes: string };

export const NAME_ERROR = 'Informe o nome do cliente, de 2 a 80 caracteres.';
export const PHONE_ERROR = 'Informe o telefone com DDD, com 10 ou 11 dígitos.';
export const NOTES_ERROR = 'A observação deve ter até 300 caracteres.';

export const cleanName = (name: string) => name.trim().replace(/\s+/g, ' ');

// RN-02: tira espaços, parênteses, traços e o +55 do começo.
export function phoneDigits(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  return trimmed.startsWith('+55') ? digits.slice(2) : digits;
}

// RNF-01: (91) 99999-9999 ou (91) 3333-4444; outro tamanho fica como veio.
export function formatPhone(phone: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
}

// RN-01 a RN-03.
export function validateCustomerForm(form: CustomerForm): string | null {
  const name = cleanName(form.name).length;
  if (name < 2 || name > 80) return NAME_ERROR;
  if (form.phone.trim()) {
    const digits = phoneDigits(form.phone).length;
    if (digits !== 10 && digits !== 11) return PHONE_ERROR;
  }
  if (form.notes.trim().length > 300) return NOTES_ERROR;
  return null;
}

// RF-03: campos opcionais vazios não vão no corpo.
export function createBody(form: CustomerForm) {
  const phone = form.phone.trim();
  const notes = form.notes.trim();
  return { name: cleanName(form.name), ...(phone ? { phone } : {}), ...(notes ? { notes } : {}) };
}

// RF-04: só o que mudou; apagar telefone ou observação envia null.
export function updateBody(customer: Customer, form: CustomerForm) {
  const body: { name?: string; phone?: string | null; notes?: string | null } = {};
  const name = cleanName(form.name);
  if (name !== customer.name) body.name = name;
  const phone = form.phone.trim();
  if (phone ? phoneDigits(phone) !== (customer.phone ?? '') : customer.phone !== null) body.phone = phone || null;
  const notes = form.notes.trim();
  if ((notes || null) !== (customer.notes ?? null)) body.notes = notes || null;
  return body;
}

export function formFrom(customer: Customer | null): CustomerForm {
  return { name: customer?.name ?? '', phone: formatPhone(customer?.phone ?? null), notes: customer?.notes ?? '' };
}

// RF-02: parâmetros da lista.
export function listQuery(search: string, includeInactive: boolean): string {
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (includeInactive) params.set('all', 'true');
  const query = params.toString();
  return query ? `/customers?${query}` : '/customers';
}

// RN-04: as duas datas vazias ou as duas preenchidas em ordem.
export function validateHistoryPeriod(period: { from: string; to: string }): string | null {
  if (!period.from && !period.to) return null;
  if (!period.from || !period.to) return 'Preencha as duas datas ou deixe as duas vazias para ver tudo.';
  if (period.from > period.to) return 'A data inicial deve ser anterior ou igual à data final.';
  return null;
}

export function historyPath(id: number, period: { from: string; to: string }): string {
  return period.from && period.to ? `/customers/${id}/history?from=${period.from}&to=${period.to}` : `/customers/${id}/history`;
}

export function visitsLabel(count: number): string {
  if (count === 0) return 'Nenhuma visita';
  return count === 1 ? '1 visita' : `${count} visitas`;
}

export function formatDay(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const two = (value: number) => String(value).padStart(2, '0');
  return `${two(date.getDate())}/${two(date.getMonth() + 1)}/${date.getFullYear()}`;
}

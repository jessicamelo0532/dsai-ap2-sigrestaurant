const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export type OrderItem = { id: number; menuItemId: number | null; nameSnapshot: string; unitPrice: string; quantity: number };
export type Order = { id: number; tableNumber: number; status: 'OPEN' | 'PAID' | 'CANCELLED'; openedAt: string; items: OrderItem[] };
export type Table = { id: number; number: number; capacity: number; order: Order | null };
export type MenuItem = { id: number; name: string; description: string | null; category: string; price: string; available: boolean };
export type Expense = { id: number; description: string; amount: string; incurredAt: string };
export type Report = { paidOrders: number; revenue: string; expenses: string; expenseCount: number; balance: string; payments: Record<string, string> };

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
      cache: 'no-store',
    });
  } catch {
    throw new Error('Não foi possível conectar à API. Confira se o servidor está ligado.');
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.message;
    throw new Error(Array.isArray(message) ? message.join(' ') : message || 'Não foi possível concluir a operação.');
  }
  return body as T;
}

export const money = (value: string | number) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const orderTotal = (order: Order | null) => order?.items.reduce((total, item) => total + Number(item.unitPrice) * item.quantity, 0) ?? 0;
export const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export type OrderItem = { id: number; menuItemId: number | null; nameSnapshot: string; unitPrice: string; quantity: number };
export type Order = { id: number; tableNumber: number; status: 'OPEN' | 'PAID' | 'CANCELLED'; paymentMethod?: string | null; openedAt: string; paidAt?: string | null; items: OrderItem[] };
// zoneId: SPEC/2026-11-17-zonas-do-salao.md (opcional para dados e respostas antigos).
export type Table = { id: number; number: number; capacity: number; zoneId?: number; order: Order | null };
export type MenuItem = { id: number; name: string; description: string | null; category: string; price: string; available: boolean };
export type Expense = { id: number; description: string; amount: string; incurredAt: string };
export type Report = { paidOrders: number; revenue: string; expenses: string; expenseCount: number; balance: string; payments: Record<string, string> };

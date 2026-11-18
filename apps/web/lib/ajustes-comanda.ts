// Alterar quantidade e cancelar comanda (SPEC/2026-11-17-quantidade-e-cancelamento-na-comanda.md).

// RN-01: mesma faixa da API e do adaptador local.
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 500;

export const CANCEL_CLOSED_MESSAGE = 'Apenas comandas abertas podem ser canceladas.';

export const canDecrease = (quantity: number) => quantity > MIN_QUANTITY;
export const canIncrease = (quantity: number) => quantity < MAX_QUANTITY;

// RF-01: próxima quantidade dentro da faixa.
export function nextQuantity(quantity: number, delta: 1 | -1): number {
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, quantity + delta));
}

// RF-02
export function cancelConfirmation(tableNumber: number): string {
  return `Cancelar a comanda da mesa ${String(tableNumber).padStart(2, '0')}? Os itens lançados não serão cobrados.`;
}

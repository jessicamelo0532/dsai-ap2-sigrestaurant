'use client';

import { Minus, Plus } from 'lucide-react';
import { canDecrease, canIncrease, nextQuantity } from '@/lib/ajustes-comanda';

// − quantidade + de uma linha da comanda (SPEC/2026-11-17-quantidade-e-cancelamento-na-comanda.md, RF-01).

type Props = {
  name: string;
  quantity: number;
  disabled: boolean;
  onChange: (quantity: number) => void;
};

export function QuantidadeLinha({ name, quantity, disabled, onChange }: Props) {
  return (
    <span className="qty-stepper" role="group" aria-label={`Quantidade de ${name}`}>
      <button type="button" className="qty-button" disabled={disabled || !canDecrease(quantity)} onClick={() => onChange(nextQuantity(quantity, -1))} aria-label={`Diminuir ${name}`}><Minus size={14} /></button>
      <b aria-live="polite">{quantity}</b>
      <button type="button" className="qty-button" disabled={disabled || !canIncrease(quantity)} onClick={() => onChange(nextQuantity(quantity, 1))} aria-label={`Aumentar ${name}`}><Plus size={14} /></button>
    </span>
  );
}

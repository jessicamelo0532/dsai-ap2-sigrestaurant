'use client';

import { useEffect, useState } from 'react';
import { CirclePlus, Trash2, Users } from 'lucide-react';
import { storeRequest } from '@/lib/store';
import { dueCents } from '@/lib/comanda';
import { paymentLabels } from '@/lib/impressao';
import type { Order, OrderSplit } from '@/lib/types';
import {
  defaultNames, modeLabel, moneyDecimal, SPLIT_MODES, splitByItem, splitByValue, splitEqual,
  splitSummary, validateDrafts, type SplitDraft, type SplitMode,
} from '@/lib/divisao';

type DivisaoContaProps = {
  order: Order;
  onChanged: () => void;
  onClosed: (order: Order) => void;
  onCancel: () => void;
};

// Divisão de conta por consumidor (SPEC/2026-11-19-divisao-de-conta.md).
// Só desenha: as regras puras estão em lib/divisao.ts e no local-store.
export function DivisaoConta({ order, onChanged, onClosed, onCancel }: DivisaoContaProps) {
  const [splits, setSplits] = useState<OrderSplit[]>(order.splits ?? []);
  const [mode, setMode] = useState<SplitMode>('EQUAL');
  const [count, setCount] = useState('2');
  const [itemOwners, setItemOwners] = useState<Record<number, number>>({});
  const [values, setValues] = useState<{ name: string; amount: string }[]>([
    { name: 'Pessoa 1', amount: '' }, { name: 'Pessoa 2', amount: '' },
  ]);
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSplits(order.splits ?? []);
  }, [order.id, order.splits]);

  const people = Math.max(2, Math.min(50, Number(count) || 2));
  const summary = splitSummary(splits);
  const total = dueCents(order);

  async function send(action: () => Promise<Order>, success?: string): Promise<Order | null> {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const updated = await action();
      setSplits(updated.splits ?? []);
      if (success) setMessage(success);
      onChanged();
      return updated;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível concluir a ação.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function create(drafts: SplitDraft[]) {
    const invalid = validateDrafts(drafts, total);
    if (invalid) {
      setError(invalid);
      return;
    }
    await send(
      () => storeRequest<Order>(`/orders/${order.id}/splits`, {
        method: 'POST',
        body: JSON.stringify({ splits: drafts }),
      }),
      'Conta dividida.',
    );
  }

  function createEqual() {
    try {
      void create(splitEqual(total, people));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível dividir.');
    }
  }

  function createByItem() {
    try {
      const assignments = Array.from({ length: people }, (_, index) => ({
        name: defaultNames(people)[index],
        itemIds: order.items.filter((item) => (itemOwners[item.id] ?? 0) === index).map((item) => item.id),
      }));
      void create(splitByItem(order, assignments));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível dividir.');
    }
  }

  function createByValue() {
    try {
      void create(splitByValue(values, total));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível dividir.');
    }
  }

  async function pay(split: OrderSplit) {
    const updated = await send(
      () => storeRequest<Order>(`/orders/${order.id}/splits/${split.id}/pay`, {
        method: 'POST',
        body: JSON.stringify({ paymentMethod }),
      }),
      `Parcela de ${split.name} paga.`,
    );
    if (updated?.status === 'PAID') onClosed(updated);
  }

  async function undo() {
    await send(
      () => storeRequest<Order>(`/orders/${order.id}/splits`, { method: 'DELETE' }),
      'Divisão desfeita.',
    );
  }

  function updateValue(index: number, key: 'name' | 'amount', value: string) {
    setValues(values.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
  }

  return (
    <div className="payment-form">
      <div className="order-total"><span>Total a pagar</span><strong>{moneyDecimal(total)}</strong></div>

      {error && <div className="kitchen-error" role="alert">{error}</div>}
      {message && <div className="kitchen-message" role="status">{message}</div>}

      {!splits.length ? <>
        <p>Como você quer dividir?</p>
        <div className="floor-filters" role="group" aria-label="Modo de divisão">
          {SPLIT_MODES.map((option) => (
            <button key={option} className="floor-filter" aria-pressed={mode === option} onClick={() => setMode(option)}>
              {modeLabel(option)}
            </button>
          ))}
        </div>

        <label>Pessoas<input type="number" min={2} max={50} value={count} onChange={(event) => setCount(event.target.value)} /></label>

        {mode === 'EQUAL' && <button className="button button-dark" disabled={busy} onClick={createEqual}><Users size={16} />Dividir por igual</button>}

        {mode === 'ITEM' && <>
          <p>Cada linha da comanda fica inteira com uma pessoa.</p>
          <div className="order-lines">
            {order.items.map((item) => (
              <div className="order-line" key={item.id}>
                <div className="line-copy"><strong>{item.nameSnapshot}</strong><small>{item.quantity} × {item.unitPrice}</small></div>
                <select
                  aria-label={`Pessoa do item ${item.nameSnapshot}`}
                  value={itemOwners[item.id] ?? 0}
                  onChange={(event) => setItemOwners({ ...itemOwners, [item.id]: Number(event.target.value) })}
                >
                  {Array.from({ length: people }, (_, index) => <option key={index} value={index}>{defaultNames(people)[index]}</option>)}
                </select>
              </div>
            ))}
          </div>
          <button className="button button-dark" disabled={busy} onClick={createByItem}><Users size={16} />Dividir por item</button>
        </>}

        {mode === 'VALUE' && <>
          {values.map((row, index) => (
            <div className="form-two" key={index}>
              <label>Nome da pessoa {index + 1}<input value={row.name} onChange={(event) => updateValue(index, 'name', event.target.value)} /></label>
              <label>Valor da pessoa {index + 1}<input type="number" min="0.01" step="0.01" value={row.amount} onChange={(event) => updateValue(index, 'amount', event.target.value)} /></label>
            </div>
          ))}
          <div className="form-actions">
            <button type="button" className="button button-light" onClick={() => setValues([...values, { name: `Pessoa ${values.length + 1}`, amount: '' }])}><CirclePlus size={16} />Adicionar pessoa</button>
            {values.length > 2 && <button type="button" className="button button-light" onClick={() => setValues(values.slice(0, -1))}><Trash2 size={16} />Remover última</button>}
          </div>
          <button className="button button-dark" disabled={busy} onClick={createByValue}><Users size={16} />Dividir por valor</button>
        </>}
      </> : <>
        <div className="categoria-summary">
          <span className="count-pill">{summary.count} parcelas</span>
          <span className="count-pill">{summary.paidCount} pagas</span>
          <span className="count-pill">Falta {summary.remaining}</span>
        </div>
        <label>Forma de pagamento<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>{Object.entries(paymentLabels).filter(([method]) => method !== 'MIXED').map(([method, label]) => <option key={method} value={method}>{label}</option>)}</select></label>
        <div className="expense-list">
          {splits.map((split) => (
            <div className="expense-row" key={split.id}>
              <span className="expense-copy"><strong>{split.name}</strong><small>{split.paid ? `Pago em ${paymentLabels[split.paymentMethod ?? ''] ?? split.paymentMethod}` : 'Em aberto'}</small></span>
              <b>{moneyDecimal(Math.round(Number(split.amount) * 100))}</b>
              {!split.paid && <button className="button button-dark" disabled={busy} onClick={() => void pay(split)}>Pagar {split.name}</button>}
            </div>
          ))}
        </div>
        {!summary.paidCount && <button className="button button-light" disabled={busy} onClick={() => void undo()}><Trash2 size={16} />Desfazer divisão</button>}
        {summary.allPaid && <p>A conta foi fechada e a mesa liberada.</p>}
      </>}

      <div className="form-actions"><button type="button" className="button button-light" onClick={onCancel}>Fechar</button></div>
    </div>
  );
}

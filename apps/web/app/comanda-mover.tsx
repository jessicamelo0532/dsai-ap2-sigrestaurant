'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowRightLeft, History, Merge } from 'lucide-react';
import { storeRequest } from '@/lib/store';
import type { Order, Table } from '@/lib/types';
import {
  cleanReason, describeEvent, eventTime, freeTablesFor, mergeCandidates, sortEvents, validateReason, type OrderEvent,
} from '@/lib/mover';

// Transferir comanda e juntar contas pela tela (SPEC/2026-11-17-mover-e-juntar-na-tela.md).

type Props = {
  order: Order;
  tableId: number;
  tables: Table[];
  // Recarrega as mesas e, depois de transferir, seleciona a mesa nova.
  onMoved: (tableId: number) => void;
};

type Mode = 'transfer' | 'merge' | null;

const errorText = (caught: unknown, fallback: string) => (caught instanceof Error ? caught.message : fallback);
const tableName = (number: number) => `Mesa ${String(number).padStart(2, '0')}`;

export function ComandaMover({ order, tableId, tables, onMoved }: Props) {
  const [mode, setMode] = useState<Mode>(null);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [message, setMessage] = useState('');

  const free = freeTablesFor(tables, tableId);
  const others = mergeCandidates(tables, order.id);

  const loadHistory = useCallback(async () => {
    try {
      setEvents(sortEvents(await storeRequest<OrderEvent[]>(`/orders/${order.id}/history`)));
    } catch {
      setEvents([]);
    }
  }, [order.id]);

  useEffect(() => { void loadHistory(); }, [loadHistory, order.items.length, order.tableNumber]);

  return (
    <section className="mover" aria-label="Mesa e contas">
      <div className="mover-actions">
        <button
          className="button button-light"
          disabled={!free.length}
          title={free.length ? undefined : 'Nenhuma mesa livre'}
          onClick={() => { setMessage(''); setMode(mode === 'transfer' ? null : 'transfer'); }}
        ><ArrowRightLeft size={15} />Transferir mesa</button>
        <button
          className="button button-light"
          disabled={!others.length}
          title={others.length ? undefined : 'Nenhuma outra conta aberta'}
          onClick={() => { setMessage(''); setMode(mode === 'merge' ? null : 'merge'); }}
        ><Merge size={15} />Juntar contas</button>
      </div>
      {!free.length && <small className="mover-hint">Nenhuma mesa livre para transferir.</small>}

      {mode === 'transfer' && (
        <MoveForm
          label="Mesa de destino"
          options={free.map((table) => ({ value: table.id, label: `${tableName(table.number)} · ${table.capacity} lugares` }))}
          submitLabel="Transferir"
          onCancel={() => setMode(null)}
          onSubmit={async (target, reason) => {
            await storeRequest(`/orders/${order.id}/transfer`, { method: 'POST', body: JSON.stringify({ tableId: target, reason }) });
            const table = free.find((entry) => entry.id === target);
            setMode(null);
            setMessage(`Comanda transferida para a ${table ? tableName(table.number).toLowerCase() : 'nova mesa'}.`);
            onMoved(target);
          }}
        />
      )}

      {mode === 'merge' && (
        <MoveForm
          label="Trazer a conta da"
          options={others.map((table) => ({ value: table.order!.id, label: `${tableName(table.number)} · comanda #${table.order!.id}` }))}
          submitLabel="Juntar nesta conta"
          onCancel={() => setMode(null)}
          onSubmit={async (sourceOrderId, reason) => {
            await storeRequest(`/orders/${order.id}/merge`, { method: 'POST', body: JSON.stringify({ sourceOrderId, reason }) });
            const source = others.find((table) => table.order!.id === sourceOrderId);
            setMode(null);
            setMessage(`Conta da ${source ? tableName(source.number).toLowerCase() : 'outra mesa'} juntada a esta.`);
            onMoved(tableId);
          }}
        />
      )}

      {message && <p className="mover-ok" role="status">{message}</p>}

      {!!events.length && (
        <div className="mover-history">
          <span className="mover-history-title"><History size={14} />Histórico da comanda</span>
          <ol aria-label="Histórico da comanda">
            {events.map((event) => (
              <li key={event.id}>
                <strong>{describeEvent(event)}</strong>
                <small>{eventTime(event.createdAt)} · {event.reason}</small>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

type MoveFormProps = {
  label: string;
  options: { value: number; label: string }[];
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (value: number, reason: string) => Promise<void>;
};

function MoveForm({ label, options, submitLabel, onCancel, onSubmit }: MoveFormProps) {
  const [value, setValue] = useState(options[0]?.value ?? 0);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const invalid = validateReason(reason);
    if (invalid) { setError(invalid); return; }
    setBusy(true); setError('');
    try {
      await onSubmit(value, cleanReason(reason));
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível concluir a mudança.'));
    } finally { setBusy(false); }
  }

  return (
    <form className="mover-form" onSubmit={submit}>
      <label>{label}
        <select value={value} onChange={(e) => setValue(Number(e.target.value))}>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label>Motivo
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: cliente pediu mesa na janela" maxLength={220} />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="mover-form-actions">
        <button type="button" className="button button-light" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="button button-dark" disabled={busy}>{busy ? 'Salvando…' : submitLabel}</button>
      </div>
    </form>
  );
}

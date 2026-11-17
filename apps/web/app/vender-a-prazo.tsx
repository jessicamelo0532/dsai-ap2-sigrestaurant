'use client';

import { useEffect, useState } from 'react';
import { storeRequest } from '@/lib/store';
import type { Order } from '@/lib/types';
import { defaultDueDate, saleBody, validateSale } from '@/lib/receber';

// Vender a prazo pela comanda (SPEC/2026-11-17-contas-a-receber.md, RF-04).

type Customer = { id: number; name: string; phone: string | null; active?: boolean };

type Props = {
  order: Order;
  totalLabel: string;
  onCancel: () => void;
  onDone: (message: string) => void;
};

const errorText = (caught: unknown, fallback: string) => (caught instanceof Error ? caught.message : fallback);

export function VenderAPrazo({ order, totalLabel, onCancel, onDone }: Props) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<Customer[] | null>(null);
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Usa o cliente já ligado à comanda, se houver.
  useEffect(() => {
    if (!order.customerId) return;
    storeRequest<Customer>(`/customers/${order.customerId}`).then(setCustomer).catch(() => setCustomer(null));
  }, [order.customerId]);

  async function find() {
    if (search.trim().length < 2) { setError('Digite pelo menos 2 letras ou números para buscar.'); return; }
    setError('');
    try {
      setOptions(await storeRequest<Customer[]>(`/customers?search=${encodeURIComponent(search.trim())}`));
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível buscar clientes.'));
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const form = { customerId: customer?.id ?? null, dueDate, notes };
    const invalid = validateSale(form);
    if (invalid) { setError(invalid); return; }
    setBusy(true); setError('');
    try {
      await storeRequest(`/orders/${order.id}/on-account`, { method: 'POST', body: JSON.stringify(saleBody(form)) });
      onDone(`Venda a prazo registrada para ${customer!.name}.`);
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível vender a prazo.'));
    } finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label="Vender a prazo">
        <div className="modal-heading"><div><div className="eyebrow">COMANDA #{order.id}</div><h2>Vender a prazo</h2></div><button className="icon-button" onClick={onCancel} aria-label="Fechar">×</button></div>
        <form className="modal-form" onSubmit={submit}>
          <p className="receber-total">Total que fica a receber: <b>{totalLabel}</b></p>
          {customer ? (
            <div className="prazo-customer">
              <span>Cliente</span><strong>{customer.name}</strong>
              <button type="button" className="button button-light" onClick={() => { setCustomer(null); setOptions(null); }}>Trocar</button>
            </div>
          ) : (
            <div className="prazo-search">
              <label>Cliente<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome ou telefone" /></label>
              <button type="button" className="button button-light" onClick={() => void find()}>Buscar</button>
              {options && !options.length && <small className="atendimento-muted">Nenhum cliente encontrado. Cadastre na seção Clientes.</small>}
              {options && !!options.length && (
                <ul className="atendimento-options">
                  {options.map((option) => <li key={option.id}><button type="button" className="button button-light" onClick={() => { setCustomer(option); setError(''); }}>{option.name}{option.phone ? ` · ${option.phone}` : ''}</button></li>)}
                </ul>
              )}
            </div>
          )}
          <label>Vencimento<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
          <label>Observação (opcional)<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: paga na sexta" maxLength={220} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions">
            <button type="button" className="button button-light" onClick={onCancel}>Cancelar</button>
            <button type="submit" className="button button-dark" disabled={busy}>{busy ? 'Salvando…' : 'Confirmar venda a prazo'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Gift, Search, UserRound, UserX, Users } from 'lucide-react';
import { storeRequest } from '@/lib/store';
import { money } from '@/lib/format';
import type { Order } from '@/lib/types';
import {
  customerLabel, discountCents, hasRedemption, maxRedeemablePoints, parsePoints, redeemPreview, subtotalCents,
  validateRedeem, waiterChoices, type CustomerOption, type LoyaltyRule, type WaiterOption,
} from '@/lib/comanda';

// Atendimento na comanda: garçom, cliente e pontos (SPEC/2026-11-17-atendimento-na-comanda.md).

type Props = {
  order: Order;
  // Recarrega a comanda depois de cada ação (RF-06).
  onChanged: () => void;
};

const errorText = (caught: unknown, fallback: string) => (caught instanceof Error ? caught.message : fallback);
const points = (value: number) => value.toLocaleString('pt-BR');

export function ComandaAtendimento({ order, onChanged }: Props) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function act(request: () => Promise<unknown>, success: string) {
    setBusy(true); setError(''); setMessage('');
    try {
      await request();
      setMessage(success);
      onChanged();
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível atualizar a comanda.'));
    } finally { setBusy(false); }
  }

  return (
    <section className="atendimento" aria-label="Atendimento">
      <strong className="atendimento-title">Atendimento</strong>
      <WaiterBlock order={order} busy={busy} act={act} />
      <CustomerBlock order={order} busy={busy} act={act} />
      {order.customerId ? <PointsBlock order={order} busy={busy} act={act} /> : null}
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="atendimento-ok" role="status">{message}</p>}
    </section>
  );
}

type Act = (request: () => Promise<unknown>, success: string) => Promise<void>;
type BlockProps = { order: Order; busy: boolean; act: Act };

function WaiterBlock({ order, busy, act }: BlockProps) {
  const [waiters, setWaiters] = useState<WaiterOption[]>([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    storeRequest<WaiterOption[]>('/waiters?all=true')
      .then((list) => { setWaiters(list ?? []); setLoadError(''); })
      .catch((caught) => setLoadError(errorText(caught, 'Não foi possível carregar os garçons.')));
  }, []);

  const choices = waiterChoices(waiters, order.waiterId);

  return (
    <div className="atendimento-block">
      <label className="atendimento-label" htmlFor={`garcom-${order.id}`}><Users size={14} />Garçom</label>
      <select
        id={`garcom-${order.id}`}
        value={order.waiterId ?? ''}
        disabled={busy || !choices.length}
        onChange={(event) => {
          const waiterId = Number(event.target.value);
          const chosen = choices.find((waiter) => waiter.id === waiterId);
          if (chosen) void act(() => storeRequest(`/orders/${order.id}/waiter`, { method: 'PUT', body: JSON.stringify({ waiterId }) }), `${chosen.name} atende esta mesa.`);
        }}
      >
        <option value="" disabled>{choices.length ? 'Escolha o garçom' : 'Nenhum garçom ativo'}</option>
        {choices.map((waiter) => <option key={waiter.id} value={waiter.id}>{waiter.name}{waiter.active ? '' : ' (inativo)'}</option>)}
      </select>
      {loadError && <small className="form-error">{loadError}</small>}
    </div>
  );
}

function CustomerBlock({ order, busy, act }: BlockProps) {
  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<CustomerOption[] | null>(null);
  const [error, setError] = useState('');
  const locked = hasRedemption(order);

  useEffect(() => {
    if (!order.customerId) { setCustomer(null); return; }
    storeRequest<CustomerOption>(`/customers/${order.customerId}`)
      .then(setCustomer)
      .catch(() => setCustomer({ id: order.customerId!, name: `Cliente #${order.customerId}`, phone: null }));
  }, [order.customerId]);

  async function find(event: React.FormEvent) {
    event.preventDefault();
    if (search.trim().length < 2) { setError('Digite pelo menos 2 letras ou números para buscar.'); return; }
    setError('');
    try {
      setOptions(await storeRequest<CustomerOption[]>(`/customers?search=${encodeURIComponent(search.trim())}`));
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível buscar clientes.'));
    }
  }

  function link(chosen: CustomerOption) {
    setSearching(false); setOptions(null); setSearch('');
    void act(() => storeRequest(`/orders/${order.id}/customer`, { method: 'PUT', body: JSON.stringify({ customerId: chosen.id }) }), `${chosen.name} ligado à comanda.`);
  }

  return (
    <div className="atendimento-block">
      <span className="atendimento-label"><UserRound size={14} />Cliente</span>
      {customer ? (
        <div className="atendimento-row">
          <b>{customerLabel(customer)}</b>
          <button
            className="button button-light"
            disabled={busy || locked}
            title={locked ? 'Desfaça o resgate de pontos antes de trocar o cliente.' : undefined}
            onClick={() => void act(() => storeRequest(`/orders/${order.id}/customer`, { method: 'PUT', body: JSON.stringify({ customerId: null }) }), 'Cliente tirado da comanda.')}
          ><UserX size={15} />Tirar cliente</button>
        </div>
      ) : !searching ? (
        <button className="button button-light" disabled={busy} onClick={() => setSearching(true)}><Search size={15} />Ligar cliente</button>
      ) : (
        <>
          <form className="atendimento-search" onSubmit={find}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome ou telefone" aria-label="Buscar cliente da comanda" />
            <button type="submit" className="button button-light">Buscar</button>
            <button type="button" className="button button-light" onClick={() => { setSearching(false); setOptions(null); setError(''); }}>Cancelar</button>
          </form>
          {error && <small className="form-error" role="alert">{error}</small>}
          {options && !options.length && <small className="atendimento-muted">Nenhum cliente encontrado. Cadastre na seção Clientes.</small>}
          {options && !!options.length && (
            <ul className="atendimento-options">
              {options.map((option) => <li key={option.id}><button className="button button-light" onClick={() => link(option)}>{customerLabel(option)}</button></li>)}
            </ul>
          )}
        </>
      )}
      {locked && customer && <small className="atendimento-muted">Desfaça o resgate de pontos antes de trocar o cliente.</small>}
    </div>
  );
}

function PointsBlock({ order, busy, act }: BlockProps) {
  const [balance, setBalance] = useState<number | null>(null);
  const [rule, setRule] = useState<LoyaltyRule | null>(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const redeemed = order.loyaltyPoints ?? 0;
  const subtotal = subtotalCents(order);

  const load = useCallback(async () => {
    try {
      const [loyalty, settings] = await Promise.all([
        storeRequest<{ balance: number }>(`/customers/${order.customerId}/loyalty`),
        storeRequest<LoyaltyRule>('/loyalty/settings'),
      ]);
      setBalance(loyalty.balance);
      setRule(settings);
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível carregar os pontos.'));
    }
  }, [order.customerId]);

  useEffect(() => { void load(); }, [load, redeemed]);

  if (hasRedemption(order)) {
    return (
      <div className="atendimento-block">
        <span className="atendimento-label"><Gift size={14} />Pontos</span>
        <div className="atendimento-row">
          <b>{points(redeemed)} pontos usados · desconto de {money(discountCents(order) / 100)}</b>
          <button className="button button-light" disabled={busy} onClick={() => void act(() => storeRequest(`/orders/${order.id}/loyalty`, { method: 'DELETE' }), 'Resgate desfeito: os pontos voltaram para o cliente.')}>Desfazer resgate</button>
        </div>
      </div>
    );
  }

  if (balance === null || !rule) {
    return <div className="atendimento-block"><span className="atendimento-label"><Gift size={14} />Pontos</span>{error ? <small className="form-error" role="alert">{error}</small> : <small className="atendimento-muted">Carregando saldo…</small>}</div>;
  }

  const max = maxRedeemablePoints(balance, subtotal, rule);
  const requested = parsePoints(amount);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const invalid = validateRedeem(requested, { balance: balance!, subtotalCents: subtotal, rule: rule! });
    if (invalid) { setError(invalid); return; }
    setError('');
    setAmount('');
    void act(() => storeRequest(`/orders/${order.id}/loyalty`, { method: 'POST', body: JSON.stringify({ points: requested }) }), `${points(requested)} pontos usados como desconto.`);
  }

  return (
    <div className="atendimento-block">
      <span className="atendimento-label"><Gift size={14} />Pontos</span>
      <small className="atendimento-muted">Saldo: {points(balance)} pontos · mínimo para usar: {points(rule.minRedeemPoints)}{max ? ` · dá para usar até ${points(max)}` : ''}</small>
      <form className="atendimento-search" onSubmit={submit}>
        <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={max ? String(max) : 'Pontos'} aria-label="Pontos para usar" />
        <button type="submit" className="button button-light" disabled={busy}>Usar pontos</button>
      </form>
      {redeemPreview(requested, rule) && <small className="atendimento-muted" role="note">{redeemPreview(requested, rule)}</small>}
      {error && <small className="form-error" role="alert">{error}</small>}
    </div>
  );
}

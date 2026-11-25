'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Banknote, Bike, Check, ChefHat, CirclePlus, MapPin, Pencil, Phone, RefreshCw, Search, ServerOff, Truck, Wifi, X } from 'lucide-react';
import { ApiError } from '@/lib/api-client';
import { storeRequest } from '@/lib/store';
import { money } from '@/lib/format';
import type { MenuItem } from '@/lib/types';
import { formatPhone, type Customer } from '@/lib/clientes';
import { validateNote } from '@/lib/cozinha';
import {
  canCancel, canDeliver, canDispatch, canEdit, canPay, createBody, FILTERS, formFrom, formatDateTime, itemCount,
  itemPath, listPath, PAYMENT_METHODS, situationLabel, situationOf, summarize, updateBody, validateDeliveryForm,
  type DeliveryFilter, type DeliveryForm, type DeliveryOrder, type PaymentMethod,
} from '@/lib/delivery';
import { EscolherOpcoes } from './escolher-opcoes';
import { QuantidadeLinha } from './quantidade-linha';

// Seção Delivery (SPEC/2026-11-25-tela-de-delivery.md).

type Props = {
  mode: 'api' | 'local';
  canConnect: boolean;
  onConnect: () => void;
  menu: MenuItem[];
};

const errorText = (caught: unknown, fallback: string) => (caught instanceof Error ? caught.message : fallback);

export function DeliveryPanel({ mode, canConnect, onConnect, menu }: Props) {
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [filter, setFilter] = useState<DeliveryFilter>('ativos');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<DeliveryOrder | null>(null);

  const load = useCallback(async () => {
    if (mode !== 'api') return;
    try {
      setOrders(await storeRequest<DeliveryOrder[]>(listPath(filter)));
      setError('');
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível carregar os pedidos de delivery.'));
    }
  }, [mode, filter]);

  useEffect(() => { void load(); }, [load]);

  async function advance(order: DeliveryOrder, action: 'dispatch' | 'delivered') {
    setError(''); setMessage('');
    try {
      await storeRequest(`/delivery-orders/${order.id}/${action}`, { method: 'POST' });
      setMessage(action === 'dispatch' ? `Pedido de ${order.recipient} saiu para entrega.` : `Pedido de ${order.recipient} entregue.`);
      await load();
      if (detail?.id === order.id) setDetail(null);
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível mudar a situação da entrega.'));
    }
  }

  if (mode === 'local') {
    return (
      <section className="page-section">
        <div className="page-heading"><div><div className="eyebrow">ENTREGA</div><h1>Delivery</h1><p>Os pedidos de entrega existem no modo servidor.</p></div></div>
        <div className="panel kitchen-offline">
          <span className="kitchen-offline-icon"><ServerOff size={26} /></span>
          <strong>Delivery precisa do servidor</strong>
          <p>No modo navegador os dados ficam só neste aparelho. Conecte ao servidor para criar e acompanhar pedidos de entrega.</p>
          {canConnect ? <button className="button button-dark" onClick={onConnect}><Wifi size={17} />Conectar ao servidor</button> : <small>Este build não tem endereço de API configurado (<code>NEXT_PUBLIC_API_URL</code>).</small>}
        </div>
      </section>
    );
  }

  const summary = summarize(orders);

  return (
    <section className="page-section">
      <div className="page-heading">
        <div><div className="eyebrow">ENTREGA</div><h1>Delivery</h1><p>Pedidos para entrega: endereço, taxa, cozinha e acompanhamento.</p></div>
        <div className="delivery-heading-actions">
          <button className="button button-light" onClick={() => void load()}><RefreshCw size={16} />Atualizar</button>
          <button className="button button-dark" onClick={() => { setMessage(''); setCreating(true); }}><CirclePlus size={17} />Novo pedido</button>
        </div>
      </div>

      {error && <div className="kitchen-error" role="alert">{error}</div>}
      {message && <div className="kitchen-message" role="status">{message}</div>}

      <div className="delivery-summary" aria-label="Resumo">
        <div><span>Na lista</span><strong>{summary.count}</strong><small>pedidos</small></div>
        <div><span>Recebidos</span><strong>{summary.received}</strong><small>aguardando saída</small></div>
        <div><span>Saiu para entrega</span><strong>{summary.outForDelivery}</strong><small>em rota</small></div>
        <div><span>Total</span><strong>{money(summary.totalCents / 100)}</strong><small>na lista</small></div>
      </div>

      <div className="floor-filters" role="group" aria-label="Filtrar pedidos">
        {FILTERS.map((option) => (
          <button key={option.id} className="floor-filter" aria-pressed={filter === option.id} onClick={() => setFilter(option.id)}>{option.label}</button>
        ))}
      </div>

      {!orders.length && (
        <div className="empty-state compact">
          <Bike size={22} />
          <strong>Nenhum pedido neste filtro</strong>
          <span>Crie um pedido de entrega para começar.</span>
        </div>
      )}

      <ul className="delivery-list">
        {orders.map((order) => (
          <li key={order.id} className="delivery-card">
            <div className="delivery-card-copy">
              <div className="delivery-card-head">
                <strong>{order.recipient}</strong>
                <span className={`delivery-badge ${situationOf(order).toLowerCase()}`}>{situationLabel(order)}</span>
              </div>
              <span><MapPin size={13} />{order.deliveryAddress}</span>
              {order.deliveryPhone && <span><Phone size={13} />{formatPhone(order.deliveryPhone)}</span>}
              <small>Aberto em {formatDateTime(order.openedAt)} · {itemCount(order)} item(ns) · <b>{money(order.total)}</b></small>
            </div>
            <div className="delivery-card-actions">
              {canDispatch(order) && <button className="button button-light" onClick={() => void advance(order, 'dispatch')}><Truck size={15} />Saiu para entrega</button>}
              {canDeliver(order) && <button className="button button-light" onClick={() => void advance(order, 'delivered')}><Check size={15} />Entregue</button>}
              <button className="button button-dark" onClick={() => setDetail(order)}>Abrir</button>
            </div>
          </li>
        ))}
      </ul>

      {creating && (
        <DeliveryFormModal
          order={null}
          onCancel={() => setCreating(false)}
          onSaved={(created) => {
            setCreating(false);
            setMessage('Pronto, pedido de delivery criado.');
            void load();
            if (created) setDetail(created);
          }}
        />
      )}

      {detail && (
        <DeliveryDetail
          initial={detail}
          menu={menu}
          onClose={() => setDetail(null)}
          onChanged={() => void load()}
          onMessage={(text) => setMessage(text)}
        />
      )}
    </section>
  );
}

function DeliveryDetail({ initial, menu, onClose, onChanged, onMessage }: {
  initial: DeliveryOrder;
  menu: MenuItem[];
  onClose: () => void;
  onChanged: () => void;
  onMessage: (text: string) => void;
}) {
  const [order, setOrder] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [choosing, setChoosing] = useState<MenuItem | null>(null);
  const [search, setSearch] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');

  const reload = useCallback(async () => {
    try {
      setOrder(await storeRequest<DeliveryOrder>(`/delivery-orders/${initial.id}`));
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) {
        onMessage('O pedido foi removido porque ficou sem itens.');
        onChanged();
        onClose();
        return;
      }
      setError(errorText(caught, 'Não foi possível atualizar o pedido.'));
    }
  }, [initial.id, onChanged, onClose, onMessage]);

  async function run(action: () => Promise<unknown>, success: string, close = false) {
    setBusy(true); setError('');
    try {
      await action();
      onMessage(success);
      onChanged();
      if (close) onClose(); else await reload();
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível concluir a ação.'));
    } finally { setBusy(false); }
  }

  async function changeQuantity(itemId: number, next: number) {
    setBusy(true); setError('');
    try {
      await storeRequest(`/orders/${order.id}/items/${itemId}`, { method: 'PATCH', body: JSON.stringify({ quantity: next }) });
      onChanged();
      await reload();
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível mudar a quantidade.'));
    } finally { setBusy(false); }
  }

  async function removeItem(itemId: number, name: string) {
    if (!window.confirm(`Remover “${name}” do pedido?`)) return;
    setBusy(true); setError('');
    try {
      await storeRequest(`/orders/${order.id}/items/${itemId}`, { method: 'DELETE' });
      onChanged();
      await reload();
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível remover o item.'));
    } finally { setBusy(false); }
  }

  function sendKitchen() {
    const invalid = validateNote(note);
    if (invalid) { setError(invalid); return; }
    void run(
      () => storeRequest(`/orders/${order.id}/kitchen`, { method: 'POST', body: JSON.stringify({ ...(note.trim() ? { note: note.trim() } : {}) }) }),
      'Pedido enviado para a cozinha.',
    );
    setNote('');
  }

  const visibleMenu = useMemo(() => {
    const term = search.trim().toLowerCase();
    return menu
      .filter((item) => item.available && (!term || item.name.toLowerCase().includes(term) || item.category.toLowerCase().includes(term)))
      .slice(0, 8);
  }, [menu, search]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal-card delivery-detail" role="dialog" aria-modal="true" aria-label={`Pedido de ${order.recipient}`}>
        <div className="modal-heading">
          <div>
            <div className="eyebrow">PEDIDO DE ENTREGA</div>
            <h2>{order.recipient}</h2>
            <span className={`delivery-badge ${situationOf(order).toLowerCase()}`}>{situationLabel(order)}</span>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        {error && <div className="kitchen-error" role="alert">{error}</div>}

        <div className="delivery-detail-info">
          <p><MapPin size={15} />{order.deliveryAddress}</p>
          {order.deliveryPhone && <p><Phone size={15} />{formatPhone(order.deliveryPhone)}</p>}
          <p><Bike size={15} />Aberto em {formatDateTime(order.openedAt)}</p>
          {order.dispatchedAt && <p><Truck size={15} />Saiu em {formatDateTime(order.dispatchedAt)}</p>}
          {order.deliveredAt && <p><Check size={15} />Entregue em {formatDateTime(order.deliveredAt)}</p>}
        </div>

        <ul className="delivery-detail-items">
          {order.items.map((item) => (
            <li key={item.id}>
              <div className="delivery-item-copy">
                <strong>{item.nameSnapshot}</strong>
                {!!item.addons?.length && <small>{item.addons.map((addon) => addon.name).join(' · ')}</small>}
                <small>{item.quantity} × {money(item.unitPrice)}</small>
              </div>
              {order.status === 'OPEN'
                ? <QuantidadeLinha name={item.nameSnapshot} quantity={item.quantity} disabled={busy} onChange={(next) => void changeQuantity(item.id, next)} />
                : <span className="delivery-item-qty">{item.quantity}</span>}
              <b>{money(Number(item.unitPrice) * item.quantity)}</b>
              {order.status === 'OPEN' && <button className="line-remove" aria-label={`Remover ${item.nameSnapshot}`} disabled={busy} onClick={() => void removeItem(item.id, item.nameSnapshot)}><X size={14} /></button>}
            </li>
          ))}
          {!order.items.length && <li className="delivery-empty">Nenhum item neste pedido ainda.</li>}
        </ul>

        {order.status === 'OPEN' && (
          <div className="delivery-add">
            <div className="add-items-title">
              <strong>Adicionar item</strong>
              <label className="quantity-picker">Qtd.<input type="number" min="1" max="500" value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(500, Number(event.target.value) || 1)))} /></label>
            </div>
            <label className="delivery-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar no cardápio" aria-label="Buscar no cardápio" /></label>
            <div className="delivery-menu">
              {visibleMenu.map((item) => (
                <button key={item.id} className="delivery-menu-item" disabled={busy} onClick={() => setChoosing(item)}>
                  <span><strong>{item.name}</strong><small>{item.category}</small></span><b>{money(item.price)}</b>
                </button>
              ))}
              {!visibleMenu.length && <small className="cliente-muted">Nenhum item disponível encontrado.</small>}
            </div>
          </div>
        )}

        <dl className="delivery-totals">
          <div><dt>Subtotal</dt><dd>{money(order.subtotal)}</dd></div>
          {Number(order.discount) > 0 && <div><dt>Desconto</dt><dd>− {money(order.discount)}</dd></div>}
          <div><dt>Taxa de entrega</dt><dd>{money(order.deliveryFee)}</dd></div>
          <div className="grand"><dt>Total</dt><dd>{money(order.total)}</dd></div>
        </dl>

        {order.status === 'OPEN' && (
          <div className="delivery-kitchen">
            <input value={note} maxLength={201} onChange={(event) => setNote(event.target.value)} placeholder="Observação para a cozinha (opcional)" aria-label="Observação para a cozinha" />
            <button className="button button-light" disabled={busy || !order.items.length} onClick={sendKitchen}><ChefHat size={16} />Enviar para a cozinha</button>
          </div>
        )}

        <div className="delivery-detail-actions">
          {canEdit(order) && <button className="button button-light" disabled={busy} onClick={() => setEditing(true)}><Pencil size={15} />Editar dados</button>}
          {canPay(order) && order.items.length > 0 && <button className="button button-dark" disabled={busy} onClick={() => setPaying(true)}><Banknote size={16} />Pagar</button>}
          {canCancel(order) && <button className="button button-light" disabled={busy} onClick={() => { if (window.confirm(`Cancelar o pedido de ${order.recipient}?`)) void run(() => storeRequest(`/orders/${order.id}/cancel`, { method: 'POST' }), 'Pedido cancelado.', true); }}><X size={15} />Cancelar</button>}
          {canDispatch(order) && <button className="button button-light" disabled={busy} onClick={() => void run(() => storeRequest(`/delivery-orders/${order.id}/dispatch`, { method: 'POST' }), 'Pedido saiu para entrega.')}><Truck size={15} />Saiu para entrega</button>}
          {canDeliver(order) && <button className="button button-dark" disabled={busy} onClick={() => void run(() => storeRequest(`/delivery-orders/${order.id}/delivered`, { method: 'POST' }), 'Pedido entregue.')}><Check size={15} />Entregue</button>}
        </div>

        {editing && (
          <DeliveryFormModal
            order={order}
            onCancel={() => setEditing(false)}
            onSaved={() => { setEditing(false); onMessage('Pronto, dados do pedido atualizados.'); onChanged(); void reload(); }}
          />
        )}
        {paying && (
          <PayModal
            order={order}
            onCancel={() => setPaying(false)}
            onPaid={(text) => { setPaying(false); onMessage(text); onChanged(); onClose(); }}
          />
        )}
        {choosing && (
          <EscolherOpcoes
            item={choosing}
            quantity={quantity}
            launchPath={itemPath(order.id)}
            eyebrow="LANÇAR NO PEDIDO"
            doneMessage="Pronto, item lançado no pedido."
            onCancel={() => setChoosing(null)}
            onDone={(text) => { setChoosing(null); onMessage(text); onChanged(); void reload(); }}
          />
        )}
      </div>
    </div>
  );
}

function DeliveryFormModal({ order, onCancel, onSaved }: {
  order: DeliveryOrder | null;
  onCancel: () => void;
  onSaved: (order?: DeliveryOrder) => void;
}) {
  const [form, setForm] = useState<DeliveryForm>(() => formFrom(order));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [searching, setSearching] = useState(false);
  const editing = Boolean(order);

  useEffect(() => {
    if (!order?.customerId) return;
    let active = true;
    storeRequest<Customer>(`/customers/${order.customerId}`)
      .then((customer) => { if (active) setSelected(customer); })
      .catch(() => { if (active) setSelected(null); });
    return () => { active = false; };
  }, [order?.customerId]);

  const set = (key: keyof DeliveryForm, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function searchCustomers() {
    setSearching(true); setError('');
    try {
      const query = customerQuery.trim();
      setCustomers(await storeRequest<Customer[]>(query ? `/customers?search=${encodeURIComponent(query)}` : '/customers'));
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível buscar os clientes.'));
    } finally { setSearching(false); }
  }

  function pick(customer: Customer) {
    setSelected(customer);
    setForm((current) => ({ ...current, customerId: customer.id }));
    setCustomers([]);
    setCustomerQuery('');
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const invalid = validateDeliveryForm(form);
    if (invalid) { setError(invalid); return; }
    setBusy(true); setError('');
    try {
      if (order) {
        const body = updateBody(order, form);
        if (!Object.keys(body).length) { onSaved(order); return; }
        onSaved(await storeRequest<DeliveryOrder>(`/delivery-orders/${order.id}`, { method: 'PATCH', body: JSON.stringify(body) }));
      } else {
        onSaved(await storeRequest<DeliveryOrder>('/delivery-orders', { method: 'POST', body: JSON.stringify(createBody(form)) }));
      }
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível salvar o pedido.'));
    } finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <div className="modal-card delivery-form" role="dialog" aria-modal="true" aria-label={editing ? 'Editar pedido' : 'Novo pedido de delivery'}>
        <div className="modal-heading"><div><div className="eyebrow">DELIVERY</div><h2>{editing ? 'Editar pedido' : 'Novo pedido'}</h2></div><button className="icon-button" onClick={onCancel} aria-label="Fechar">×</button></div>
        <form className="modal-form" onSubmit={submit}>
          <label>Quem recebe<input value={form.recipient} onChange={(event) => set('recipient', event.target.value)} placeholder="Ex.: Ana Souza" /></label>
          <label>Endereço de entrega<input value={form.address} onChange={(event) => set('address', event.target.value)} placeholder="Rua, número, bairro" /></label>
          <div className="form-two">
            <label>Telefone (opcional)<input inputMode="tel" value={form.phone} onChange={(event) => set('phone', event.target.value)} placeholder="(91) 99999-9999" /></label>
            <label>Taxa de entrega (R$)<input inputMode="decimal" value={form.fee} onChange={(event) => set('fee', event.target.value)} placeholder="0,00" /></label>
          </div>

          {!editing && (
            <div className="delivery-customer">
              <span className="delivery-customer-label">Cliente (opcional)</span>
              {selected ? (
                <div className="delivery-customer-picked">
                  <strong>{selected.name}</strong>
                  <button type="button" className="button button-light" onClick={() => { setSelected(null); setForm((current) => ({ ...current, customerId: null })); }}>Remover</button>
                </div>
              ) : (
                <>
                  <div className="delivery-customer-search">
                    <input value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="Buscar por nome ou telefone" aria-label="Buscar cliente" />
                    <button type="button" className="button button-light" disabled={searching} onClick={() => void searchCustomers()}>{searching ? 'Buscando…' : 'Buscar'}</button>
                  </div>
                  {!!customers.length && (
                    <ul className="delivery-customer-list">
                      {customers.map((customer) => (
                        <li key={customer.id}><button type="button" onClick={() => pick(customer)}><strong>{customer.name}</strong>{customer.phone && <span>{formatPhone(customer.phone)}</span>}</button></li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions">
            <button type="button" className="button button-light" onClick={onCancel}>Cancelar</button>
            <button type="submit" className="button button-dark" disabled={busy}>{busy ? 'Salvando…' : editing ? 'Salvar' : 'Criar pedido'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PayModal({ order, onCancel, onPaid }: {
  order: DeliveryOrder;
  onCancel: () => void;
  onPaid: (message: string) => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await storeRequest(`/orders/${order.id}/close`, { method: 'POST', body: JSON.stringify({ paymentMethod: method }) });
      const label = PAYMENT_METHODS.find((entry) => entry.id === method)?.label ?? method;
      onPaid(`Pedido de ${order.recipient} pago em ${label}.`);
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível fechar o pedido.'));
    } finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label="Pagar pedido">
        <div className="modal-heading"><div><div className="eyebrow">DELIVERY</div><h2>Pagar {order.recipient}</h2></div><button className="icon-button" onClick={onCancel} aria-label="Fechar">×</button></div>
        <form className="modal-form" onSubmit={submit}>
          <p className="delivery-pay-total">Total do pedido <strong>{money(order.total)}</strong></p>
          <label>Forma de pagamento
            <select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
            </select>
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions">
            <button type="button" className="button button-light" onClick={onCancel}>Cancelar</button>
            <button type="submit" className="button button-dark" disabled={busy}>{busy ? 'Fechando…' : 'Confirmar pagamento'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

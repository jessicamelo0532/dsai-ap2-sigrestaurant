'use client';

import { useCallback, useEffect, useState } from 'react';
import { CirclePlus, History, Pencil, Phone, Power, Search, ServerOff, UsersRound, Wifi } from 'lucide-react';
import { storeRequest } from '@/lib/store';
import { money } from '@/lib/format';
import {
  createBody, formatDay, formatPhone, formFrom, historyPath, listQuery, updateBody, validateCustomerForm,
  validateHistoryPeriod, visitsLabel, type Customer, type CustomerHistory,
} from '@/lib/clientes';

// Tela de clientes e histórico de consumo (SPEC/2026-11-17-tela-de-clientes.md).

type Props = {
  mode: 'api' | 'local';
  canConnect: boolean;
  onConnect: () => void;
};

const errorText = (caught: unknown, fallback: string) => (caught instanceof Error ? caught.message : fallback);

// RNF-02: espera o operador parar de digitar.
const SEARCH_DELAY_MS = 300;

export function ClientesPanel({ mode, canConnect, onConnect }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Customer | 'new' | null>(null);
  const [historyOf, setHistoryOf] = useState<Customer | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    if (mode !== 'api') return;
    try {
      setCustomers(await storeRequest<Customer[]>(listQuery(query, includeInactive)));
      setError('');
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível carregar os clientes.'));
    }
  }, [mode, query, includeInactive]);

  useEffect(() => { void load(); }, [load]);

  async function toggle(customer: Customer) {
    setBusy(true); setError(''); setMessage('');
    try {
      await storeRequest(`/customers/${customer.id}`, { method: 'PATCH', body: JSON.stringify({ active: !customer.active }) });
      setMessage(customer.active ? `${customer.name} foi desativado.` : `${customer.name} foi reativado.`);
      await load();
    } catch (caught) {
      setError(errorText(caught, `Não foi possível alterar ${customer.name}.`));
    } finally { setBusy(false); }
  }

  if (mode === 'local') {
    return (
      <section className="page-section">
        <div className="page-heading"><div><div className="eyebrow">RELACIONAMENTO</div><h1>Clientes</h1><p>O cadastro de clientes e o histórico existem no modo servidor.</p></div></div>
        <div className="panel kitchen-offline">
          <span className="kitchen-offline-icon"><ServerOff size={26} /></span>
          <strong>Clientes precisam do servidor</strong>
          <p>No modo navegador os dados ficam só neste aparelho. Conecte ao servidor para cadastrar clientes e ver o histórico.</p>
          {canConnect ? <button className="button button-dark" onClick={onConnect}><Wifi size={17} />Conectar ao servidor</button> : <small>Este build não tem endereço de API configurado (<code>NEXT_PUBLIC_API_URL</code>).</small>}
        </div>
      </section>
    );
  }

  return (
    <section className="page-section">
      <div className="page-heading">
        <div><div className="eyebrow">RELACIONAMENTO</div><h1>Clientes</h1><p>Cadastre quem frequenta a casa e veja o que cada cliente costuma pedir.</p></div>
        <button className="button button-dark" onClick={() => { setMessage(''); setEditing('new'); }}><CirclePlus size={17} />Novo cliente</button>
      </div>

      {error && <div className="kitchen-error" role="alert">{error}</div>}
      {message && <div className="kitchen-message" role="status">{message}</div>}

      <div className="panel cliente-panel">
        <div className="cliente-toolbar">
          <label className="cliente-search"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou telefone" aria-label="Buscar cliente" /></label>
          <label className="cliente-check"><input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />Mostrar desativados</label>
        </div>
        {!customers.length && !error && <span className="cliente-muted">Nenhum cliente encontrado.</span>}
        <ul className="cliente-list">
          {customers.map((customer) => (
            <li key={customer.id} className={`cliente-row${customer.active ? '' : ' inactive'}`}>
              <div className="cliente-copy">
                <strong>{customer.name}</strong>
                {customer.phone && <span><Phone size={13} />{formatPhone(customer.phone)}</span>}
                {customer.notes && <small>{customer.notes}</small>}
              </div>
              {!customer.active && <span className="cliente-badge">Desativado</span>}
              <div className="ticket-actions">
                <button className="button button-light" onClick={() => setHistoryOf(customer)} aria-label={`Histórico de ${customer.name}`}><History size={15} />Histórico</button>
                <button className="button button-light" disabled={busy} onClick={() => { setMessage(''); setEditing(customer); }} aria-label={`Editar ${customer.name}`}><Pencil size={15} />Editar</button>
                <button className="button button-light" disabled={busy} onClick={() => void toggle(customer)} aria-label={`${customer.active ? 'Desativar' : 'Reativar'} ${customer.name}`}><Power size={15} />{customer.active ? 'Desativar' : 'Reativar'}</button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {editing && (
        <CustomerFormModal
          customer={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={(text) => { setEditing(null); setMessage(text); void load(); }}
        />
      )}
      {historyOf && <HistoryModal customer={historyOf} onClose={() => setHistoryOf(null)} />}
    </section>
  );
}

function CustomerFormModal({ customer, onCancel, onSaved }: { customer: Customer | null; onCancel: () => void; onSaved: (message: string) => void }) {
  const [form, setForm] = useState(formFrom(customer));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const title = customer ? `Editar ${customer.name}` : 'Novo cliente';
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const invalid = validateCustomerForm(form);
    if (invalid) { setError(invalid); return; }
    setBusy(true); setError('');
    try {
      if (customer) {
        const body = updateBody(customer, form);
        if (Object.keys(body).length) await storeRequest(`/customers/${customer.id}`, { method: 'PATCH', body: JSON.stringify(body) });
        onSaved('Pronto, cliente atualizado.');
      } else {
        await storeRequest('/customers', { method: 'POST', body: JSON.stringify(createBody(form)) });
        onSaved('Pronto, cliente cadastrado.');
      }
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível salvar o cliente.'));
    } finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-heading"><div><div className="eyebrow">RELACIONAMENTO</div><h2>{title}</h2></div><button className="icon-button" onClick={onCancel} aria-label="Fechar">×</button></div>
        <form className="modal-form" onSubmit={submit}>
          <label>Nome<input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex.: Ana Souza" /></label>
          <label>Telefone com DDD (opcional)<input inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(91) 99999-9999" /></label>
          <label>Observação (opcional)<textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} placeholder="Ex.: prefere mesa na varanda" /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions">
            <button type="button" className="button button-light" onClick={onCancel}>Cancelar</button>
            <button type="submit" className="button button-dark" disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HistoryModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const [period, setPeriod] = useState({ from: '', to: '' });
  const [history, setHistory] = useState<CustomerHistory | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async (range: { from: string; to: string }) => {
    const invalid = validateHistoryPeriod(range);
    if (invalid) { setError(invalid); return; }
    try {
      setHistory(await storeRequest<CustomerHistory>(historyPath(customer.id, range)));
      setError('');
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível carregar o histórico.'));
    }
  }, [customer.id]);

  useEffect(() => { void load({ from: '', to: '' }); }, [load]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card cliente-history" role="dialog" aria-modal="true" aria-label={`Histórico de ${customer.name}`}>
        <div className="modal-heading"><div><div className="eyebrow">HISTÓRICO</div><h2>{customer.name}</h2></div><button className="icon-button" onClick={onClose} aria-label="Fechar">×</button></div>
        <div className="cliente-period">
          <label>De<input type="date" value={period.from} onChange={(e) => setPeriod((p) => ({ ...p, from: e.target.value }))} /></label>
          <label>Até<input type="date" value={period.to} onChange={(e) => setPeriod((p) => ({ ...p, to: e.target.value }))} /></label>
          <button className="button button-light" onClick={() => void load(period)}>Filtrar</button>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {history && (
          <>
            <dl className="cliente-stats">
              <div><dt>Visitas</dt><dd>{visitsLabel(history.visits)}</dd></div>
              <div><dt>Total gasto</dt><dd>{money(history.totalSpent)}</dd></div>
              <div><dt>Ticket médio</dt><dd>{money(history.averageTicket)}</dd></div>
              <div><dt>Primeira visita</dt><dd>{formatDay(history.firstVisit)}</dd></div>
              <div><dt>Última visita</dt><dd>{formatDay(history.lastVisit)}</dd></div>
            </dl>
            {!!history.favorites.length && (
              <div className="cliente-favorites"><strong>Mais pedidos</strong>
                <ol>{history.favorites.map((item) => <li key={item.name}>{item.name} <span>× {item.quantity}</span></li>)}</ol>
              </div>
            )}
            {!history.orders.length && <span className="cliente-muted">Nenhuma comanda paga {history.period ? 'no período' : 'ainda'}.</span>}
            {!!history.orders.length && (
              <ul className="cliente-orders" aria-label="Comandas pagas">
                {history.orders.map((order) => (
                  <li key={order.id}><span>{formatDay(order.paidAt)}</span><span>Mesa {String(order.tableNumber).padStart(2, '0')}</span><b>{money(order.total)}</b></li>
                ))}
              </ul>
            )}
          </>
        )}
        <div className="form-actions"><button className="button button-light" onClick={onClose}><UsersRound size={15} />Voltar aos clientes</button></div>
      </div>
    </div>
  );
}

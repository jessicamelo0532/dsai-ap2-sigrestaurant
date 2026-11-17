'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart3, CirclePlus, Pencil, Power, RefreshCw, ServerOff, Trash2, UserRound, Wifi } from 'lucide-react';
import { storeRequest } from '@/lib/store';
import { money } from '@/lib/format';
import {
  createBody, DEFAULT_COMMISSION, MAX_COMMISSION, monthToDate, ordersLabel, rateLabel, sortWaiters, updateBody,
  validatePeriod, validateWaiterForm, waiterCounts, type Waiter, type WaiterReport,
} from '@/lib/garcons';

// Tela de garçons e relatório de comissão (SPEC/2026-11-17-tela-de-garcons.md).

type Props = {
  mode: 'api' | 'local';
  canConnect: boolean;
  onConnect: () => void;
};

const errorText = (caught: unknown, fallback: string) => (caught instanceof Error ? caught.message : fallback);

export function GarconsPanel({ mode, canConnect, onConnect }: Props) {
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Waiter | 'new' | null>(null);

  const load = useCallback(async () => {
    if (mode !== 'api') return;
    try {
      setWaiters(await storeRequest<Waiter[]>('/waiters?all=true'));
      setError('');
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível carregar os garçons.'));
    }
  }, [mode]);

  useEffect(() => { void load(); }, [load]);

  async function change(waiter: Waiter, request: () => Promise<unknown>, done: string) {
    setBusy(true); setError(''); setMessage('');
    try {
      await request();
      setMessage(done);
      await load();
    } catch (caught) {
      setError(errorText(caught, `Não foi possível alterar ${waiter.name}.`));
    } finally { setBusy(false); }
  }

  const toggle = (waiter: Waiter) => change(
    waiter,
    () => storeRequest(`/waiters/${waiter.id}`, { method: 'PATCH', body: JSON.stringify({ active: !waiter.active }) }),
    waiter.active ? `${waiter.name} foi desativado.` : `${waiter.name} foi reativado.`,
  );

  const remove = (waiter: Waiter) => {
    if (!window.confirm(`Excluir ${waiter.name}? Garçom com comandas não pode ser excluído; nesse caso, desative.`)) return;
    void change(waiter, () => storeRequest(`/waiters/${waiter.id}`, { method: 'DELETE' }), `${waiter.name} foi excluído.`);
  };

  if (mode === 'local') {
    return (
      <section className="page-section">
        <div className="page-heading"><div><div className="eyebrow">EQUIPE</div><h1>Garçons</h1><p>O cadastro da equipe e a comissão existem no modo servidor.</p></div></div>
        <div className="panel kitchen-offline">
          <span className="kitchen-offline-icon"><ServerOff size={26} /></span>
          <strong>Garçons precisam do servidor</strong>
          <p>No modo navegador os dados ficam só neste aparelho. Conecte ao servidor para cadastrar a equipe e ver a comissão.</p>
          {canConnect ? <button className="button button-dark" onClick={onConnect}><Wifi size={17} />Conectar ao servidor</button> : <small>Este build não tem endereço de API configurado (<code>NEXT_PUBLIC_API_URL</code>).</small>}
        </div>
      </section>
    );
  }

  const counts = waiterCounts(waiters);

  return (
    <section className="page-section">
      <div className="page-heading">
        <div><div className="eyebrow">EQUIPE</div><h1>Garçons</h1><p>Cadastre a equipe, ajuste a comissão e veja quanto cada garçom vendeu.</p></div>
        <button className="button button-dark" onClick={() => { setMessage(''); setEditing('new'); }}><CirclePlus size={17} />Novo garçom</button>
      </div>

      {error && <div className="kitchen-error" role="alert">{error}</div>}
      {message && <div className="kitchen-message" role="status">{message}</div>}

      <div className="panel garcom-panel">
        <div className="garcom-head"><UserRound size={18} /><strong>Equipe</strong><span className="count-pill">{counts.active} ativos · {counts.inactive} inativos</span></div>
        {!waiters.length && !error && <span className="caixa-muted">Nenhum garçom cadastrado.</span>}
        <ul className="garcom-list">
          {sortWaiters(waiters).map((waiter) => (
            <li key={waiter.id} className={`garcom-row${waiter.active ? '' : ' inactive'}`}>
              <div><strong>{waiter.name}</strong><span>Comissão {rateLabel(waiter.commissionRate)}</span></div>
              <span className={`status-badge ${waiter.active ? 'status-open' : 'status-closed'}`}>{waiter.active ? 'Ativo' : 'Inativo'}</span>
              <div className="ticket-actions">
                <button className="button button-light" disabled={busy} onClick={() => { setMessage(''); setEditing(waiter); }} aria-label={`Editar ${waiter.name}`}><Pencil size={15} />Editar</button>
                <button className="button button-light" disabled={busy} onClick={() => void toggle(waiter)} aria-label={`${waiter.active ? 'Desativar' : 'Ativar'} ${waiter.name}`}><Power size={15} />{waiter.active ? 'Desativar' : 'Ativar'}</button>
                <button className="button button-light" disabled={busy} onClick={() => remove(waiter)} aria-label={`Excluir ${waiter.name}`}><Trash2 size={15} />Excluir</button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <CommissionReport />

      {editing && (
        <WaiterForm
          waiter={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={(text) => { setEditing(null); setMessage(text); void load(); }}
        />
      )}
    </section>
  );
}

function WaiterForm({ waiter, onCancel, onSaved }: { waiter: Waiter | null; onCancel: () => void; onSaved: (message: string) => void }) {
  const [form, setForm] = useState({ name: waiter?.name ?? '', commissionRate: waiter ? String(Number(waiter.commissionRate)).replace('.', ',') : '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const title = waiter ? `Editar ${waiter.name}` : 'Novo garçom';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const invalid = validateWaiterForm(form);
    if (invalid) { setError(invalid); return; }
    setBusy(true); setError('');
    try {
      if (waiter) {
        const body = updateBody(waiter, form);
        if (Object.keys(body).length) await storeRequest(`/waiters/${waiter.id}`, { method: 'PATCH', body: JSON.stringify(body) });
        onSaved(`${form.name.trim()} foi atualizado.`);
      } else {
        await storeRequest('/waiters', { method: 'POST', body: JSON.stringify(createBody(form)) });
        onSaved(`${form.name.trim()} foi cadastrado.`);
      }
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível salvar o garçom.'));
    } finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-heading"><div><div className="eyebrow">EQUIPE</div><h2>{title}</h2></div><button className="icon-button" onClick={onCancel} aria-label="Fechar">×</button></div>
        <form className="modal-form" onSubmit={submit}>
          <label>Nome<input value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} placeholder="Ex.: Rui" /></label>
          <label>Comissão (%)<input inputMode="decimal" value={form.commissionRate} onChange={(e) => setForm((c) => ({ ...c, commissionRate: e.target.value }))} placeholder={`${DEFAULT_COMMISSION} (padrão), até ${MAX_COMMISSION}`} /></label>
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

function CommissionReport() {
  const [period, setPeriod] = useState(monthToDate());
  const [report, setReport] = useState<WaiterReport | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async (range: { from: string; to: string }) => {
    const invalid = validatePeriod(range);
    if (invalid) { setError(invalid); return; }
    try {
      setReport(await storeRequest<WaiterReport>(`/reports/waiters?from=${range.from}&to=${range.to}`));
      setError('');
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível carregar o relatório.'));
    }
  }, []);

  useEffect(() => { void load(monthToDate()); }, [load]);

  return (
    <div className="panel garcom-panel">
      <div className="garcom-head"><BarChart3 size={18} /><strong>Vendas e comissão por garçom</strong></div>
      <div className="garcom-period">
        <label>De<input type="date" value={period.from} onChange={(e) => setPeriod((p) => ({ ...p, from: e.target.value }))} /></label>
        <label>Até<input type="date" value={period.to} onChange={(e) => setPeriod((p) => ({ ...p, to: e.target.value }))} /></label>
        <button className="button button-light" onClick={() => void load(period)}><RefreshCw size={16} />Ver período</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {report && !report.waiters.length && <span className="caixa-muted">Nenhuma conta paga no período.</span>}
      {report && !!report.waiters.length && (
        <table className="caixa-table" aria-label="Vendas e comissão por garçom">
          <thead><tr><th>Garçom</th><th>Contas</th><th>Receita</th><th>Ticket médio</th><th>Comissão</th></tr></thead>
          <tbody>
            {report.waiters.map((row) => (
              <tr key={`${row.waiterId ?? 'sem'}-${row.name}`}><td>{row.name}</td><td>{ordersLabel(row.paidOrders)}</td><td>{money(row.revenue)}</td><td>{money(row.averageTicket)}</td><td><b>{money(row.commission)}</b></td></tr>
            ))}
          </tbody>
          <tfoot><tr><td>Total</td><td>{ordersLabel(report.totals.paidOrders)}</td><td>{money(report.totals.revenue)}</td><td></td><td><b>{money(report.totals.commission)}</b></td></tr></tfoot>
        </table>
      )}
    </div>
  );
}

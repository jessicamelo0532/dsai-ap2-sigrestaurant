'use client';

import { useCallback, useEffect, useState } from 'react';
import { HandCoins, RefreshCw, ServerOff, Wifi } from 'lucide-react';
import { storeRequest } from '@/lib/store';
import { money } from '@/lib/format';
import {
  filterCounts, filterReceivables, FILTERS, formatDay, isoDay, methodLabels, receivableTitle, situationLabels, validateReceipt,
  type PaymentMethod, type Receivable, type ReceivableFilter, type ReceivableList,
} from '@/lib/receber';

// Seção A receber (SPEC/2026-11-17-contas-a-receber.md, RF-05).

type Props = {
  mode: 'api' | 'local';
  canConnect: boolean;
  onConnect: () => void;
};

const errorText = (caught: unknown, fallback: string) => (caught instanceof Error ? caught.message : fallback);

export function ReceberPanel({ mode, canConnect, onConnect }: Props) {
  const [data, setData] = useState<ReceivableList | null>(null);
  const [filter, setFilter] = useState<ReceivableFilter>('abertos');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [receiving, setReceiving] = useState<Receivable | null>(null);

  const load = useCallback(async () => {
    if (mode !== 'api') return;
    try {
      setData(await storeRequest<ReceivableList>('/receivables'));
      setError('');
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível carregar as contas a receber.'));
    }
  }, [mode]);

  useEffect(() => { void load(); }, [load]);

  if (mode === 'local') {
    return (
      <section className="page-section">
        <div className="page-heading"><div><div className="eyebrow">FINANCEIRO</div><h1>A receber</h1><p>As vendas a prazo existem no modo servidor.</p></div></div>
        <div className="panel kitchen-offline">
          <span className="kitchen-offline-icon"><ServerOff size={26} /></span>
          <strong>Contas a receber precisam do servidor</strong>
          <p>No modo navegador os dados ficam só neste aparelho. Conecte ao servidor para vender a prazo e acompanhar os recebimentos.</p>
          {canConnect ? <button className="button button-dark" onClick={onConnect}><Wifi size={17} />Conectar ao servidor</button> : <small>Este build não tem endereço de API configurado (<code>NEXT_PUBLIC_API_URL</code>).</small>}
        </div>
      </section>
    );
  }

  const list = data?.receivables ?? [];
  const visible = filterReceivables(list, filter);
  const counts = filterCounts(list);

  return (
    <section className="page-section">
      <div className="page-heading">
        <div><div className="eyebrow">FINANCEIRO</div><h1>A receber</h1><p>Vendas a prazo: quem deve, quanto e até quando.</p></div>
        <button className="button button-light" onClick={() => void load()}><RefreshCw size={16} />Atualizar</button>
      </div>

      {error && <div className="kitchen-error" role="alert">{error}</div>}
      {message && <div className="kitchen-message" role="status">{message}</div>}

      {data && (
        <div className="receber-summary" aria-label="Resumo">
          <div><span>Em aberto</span><strong>{money(data.summary.open)}</strong><small>{data.summary.openCount} títulos</small></div>
          <div className="danger"><span>Vencido</span><strong>{money(data.summary.overdue)}</strong><small>cobrar agora</small></div>
          <div><span>Próximos 7 dias</span><strong>{money(data.summary.dueNext7Days)}</strong><small>a vencer</small></div>
          <div className="ok"><span>Recebido</span><strong>{money(data.summary.received)}</strong><small>{data.summary.paidCount} títulos</small></div>
        </div>
      )}

      <div className="floor-filters" role="group" aria-label="Filtrar títulos">
        {FILTERS.map((option) => (
          <button key={option.id} className="floor-filter" aria-pressed={filter === option.id} onClick={() => setFilter(option.id)}>
            {option.label}<b>{counts[option.id]}</b>
          </button>
        ))}
      </div>

      {data && !visible.length && <div className="empty-state compact"><HandCoins size={22} /><strong>Nenhum título neste filtro</strong><span>Vendas a prazo são feitas pela comanda, em “Vender a prazo”.</span></div>}

      <ul className="receber-list">
        {visible.map((entry) => (
          <li key={entry.id} className={`receber-row ${entry.situation === 'OVERDUE' ? 'overdue' : ''}`}>
            <div className="receber-copy">
              <strong>{entry.customerName}</strong>
              <span>{receivableTitle(entry)} · vendida em {formatDay(entry.issuedAt)}</span>
              {entry.notes && <small>{entry.notes}</small>}
            </div>
            <div className="receber-due">
              <b>{money(entry.amount)}</b>
              {entry.status === 'OPEN'
                ? <span className={`receber-badge ${entry.situation?.toLowerCase()}`}>{entry.situation ? situationLabels[entry.situation] : ''} · {formatDay(entry.dueDate)}</span>
                : <span className="receber-badge paid">Recebido em {formatDay(entry.receivedAt)} · {entry.paymentMethod ? methodLabels[entry.paymentMethod] : ''}</span>}
            </div>
            {entry.status === 'OPEN' && <button className="button button-dark" onClick={() => { setMessage(''); setReceiving(entry); }} aria-label={`Receber de ${entry.customerName}`}>Receber</button>}
          </li>
        ))}
      </ul>

      {receiving && (
        <ReceiveForm
          receivable={receiving}
          onCancel={() => setReceiving(null)}
          onDone={(text) => { setReceiving(null); setMessage(text); void load(); }}
        />
      )}
    </section>
  );
}

function ReceiveForm({ receivable, onCancel, onDone }: { receivable: Receivable; onCancel: () => void; onDone: (message: string) => void }) {
  const [method, setMethod] = useState<PaymentMethod>('PIX');
  const [receivedAt, setReceivedAt] = useState(isoDay(new Date()));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const invalid = validateReceipt(receivable, receivedAt);
    if (invalid) { setError(invalid); return; }
    setBusy(true); setError('');
    try {
      await storeRequest(`/receivables/${receivable.id}/receive`, { method: 'POST', body: JSON.stringify({ paymentMethod: method, receivedAt }) });
      onDone(`Recebido: ${receivable.customerName}, ${Number(receivable.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`);
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível dar baixa.'));
    } finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label="Dar baixa">
        <div className="modal-heading"><div><div className="eyebrow">A RECEBER</div><h2>Receber de {receivable.customerName}</h2></div><button className="icon-button" onClick={onCancel} aria-label="Fechar">×</button></div>
        <form className="modal-form" onSubmit={submit}>
          <p className="receber-total">{receivableTitle(receivable)} · <b>{Number(receivable.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b></p>
          <label>Forma de pagamento
            <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {(Object.keys(methodLabels) as PaymentMethod[]).map((key) => <option key={key} value={key}>{methodLabels[key]}</option>)}
            </select>
          </label>
          <label>Data do recebimento<input type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions">
            <button type="button" className="button button-light" onClick={onCancel}>Cancelar</button>
            <button type="submit" className="button button-dark" disabled={busy}>{busy ? 'Salvando…' : 'Confirmar recebimento'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

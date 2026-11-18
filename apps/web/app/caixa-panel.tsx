'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, History, Lock, RefreshCw, ServerOff, Unlock, Wifi } from 'lucide-react';
import { storeRequest } from '@/lib/store';
import {
  brl, CASH_METHODS, centsToAmount, closeBody, closingPreview, differenceLabel, emptyCounted, formatDateTime,
  hasDifference, historyRange, methodLabels, movementLabels, parseMoneyInput, sessionStatusLabel, toCents,
  totalCents, validateCloseForm, validateMovementForm, validateOpenForm,
  type ByMethod, type CashMovementType, type CashSession,
} from '@/lib/caixa';

// Tela do caixa por turno (SPEC/2026-11-17-tela-do-caixa.md).

type Props = {
  mode: 'api' | 'local';
  canConnect: boolean;
  onConnect: () => void;
};

const errorText = (caught: unknown, fallback: string) => (caught instanceof Error ? caught.message : fallback);

export function CaixaPanel({ mode, canConnect, onConnect }: Props) {
  const [current, setCurrent] = useState<CashSession | null>(null);
  const [history, setHistory] = useState<CashSession[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [movement, setMovement] = useState<CashMovementType | null>(null);
  const [closing, setClosing] = useState(false);

  const load = useCallback(async () => {
    if (mode !== 'api') return;
    const { from, to } = historyRange();
    try {
      const [open, sessions] = await Promise.all([
        storeRequest<CashSession | null>('/cash/current'),
        storeRequest<CashSession[]>(`/cash/sessions?from=${from}&to=${to}`),
      ]);
      setCurrent(open);
      setHistory(sessions ?? []);
      setError('');
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível carregar o caixa.'));
    } finally {
      setLoaded(true);
    }
  }, [mode]);

  useEffect(() => { void load(); }, [load]);

  async function done(text: string) {
    setMovement(null);
    setClosing(false);
    setMessage(text);
    await load();
  }

  if (mode === 'local') {
    return (
      <section className="page-section">
        <div className="page-heading"><div><div className="eyebrow">CAIXA</div><h1>Caixa do turno</h1><p>O caixa é registrado para toda a equipe e existe no modo servidor.</p></div></div>
        <div className="panel kitchen-offline">
          <span className="kitchen-offline-icon"><ServerOff size={26} /></span>
          <strong>O caixa precisa do servidor</strong>
          <p>No modo navegador os dados ficam só neste aparelho. Conecte ao servidor para abrir e fechar o caixa.</p>
          {canConnect ? <button className="button button-dark" onClick={onConnect}><Wifi size={17} />Conectar ao servidor</button> : <small>Este build não tem endereço de API configurado (<code>NEXT_PUBLIC_API_URL</code>).</small>}
        </div>
      </section>
    );
  }

  return (
    <section className="page-section">
      <div className="page-heading">
        <div><div className="eyebrow">CAIXA</div><h1>Caixa do turno</h1><p>Abra o turno, registre sangrias e reforços e feche conferindo cada forma de pagamento.</p></div>
        <button className="button button-light" onClick={() => void load()}><RefreshCw size={16} />Atualizar</button>
      </div>

      {error && <div className="kitchen-error" role="alert">{error}</div>}
      {message && <div className="kitchen-message" role="status">{message}</div>}

      {loaded && !current && <OpenForm onOpened={(session) => void done(`Turno aberto por ${session.openedBy}.`)} />}

      {current && (
        <CurrentSession
          session={current}
          onMovement={(type) => { setMessage(''); setMovement(type); }}
          onClose={() => { setMessage(''); setClosing(true); }}
        />
      )}

      <HistoryList sessions={history} />

      {current && movement && (
        <MovementForm type={movement} onCancel={() => setMovement(null)} onSaved={(type) => void done(`${movementLabels[type]} registrada.`)} />
      )}
      {current && closing && (
        <CloseForm expected={current.expected} onCancel={() => setClosing(false)} onClosed={(session) => void done(session.divergent ? 'Turno fechado com diferença registrada.' : 'Turno fechado sem diferença.')} />
      )}
    </section>
  );
}

function OpenForm({ onOpened }: { onOpened: (session: CashSession) => void }) {
  const [operator, setOperator] = useState('');
  const [openingAmount, setOpeningAmount] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const invalid = validateOpenForm({ operator, openingAmount });
    if (invalid) { setError(invalid); return; }
    setBusy(true); setError('');
    try {
      const cents = parseMoneyInput(openingAmount === '' ? '0' : openingAmount) ?? 0;
      onOpened(await storeRequest<CashSession>('/cash/open', {
        method: 'POST',
        body: JSON.stringify({ operator: operator.trim(), openingAmount: centsToAmount(cents) }),
      }));
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível abrir o turno.'));
    } finally { setBusy(false); }
  }

  return (
    <form className="panel caixa-open" onSubmit={submit} aria-label="Abrir turno">
      <div className="caixa-open-copy"><Unlock size={20} /><div><strong>Nenhum turno aberto</strong><span>Informe quem está no caixa e o troco que ficou na gaveta.</span></div></div>
      <div className="form-row">
        <label>Operador<input value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="Ex.: Ana" /></label>
        <label>Troco inicial (R$)<input inputMode="decimal" value={openingAmount} onChange={(e) => setOpeningAmount(e.target.value)} placeholder="0,00" /></label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" className="button button-dark" disabled={busy}>{busy ? 'Abrindo…' : 'Abrir turno'}</button>
    </form>
  );
}

function CurrentSession({ session, onMovement, onClose }: { session: CashSession; onMovement: (type: CashMovementType) => void; onClose: () => void }) {
  return (
    <div className="panel caixa-current">
      <header className="caixa-current-head">
        <div>
          <span className="status-badge status-open">Aberto</span>
          <strong>Turno de {session.openedBy}</strong>
          <small>Aberto em {formatDateTime(session.openedAt)} · troco inicial {brl(toCents(session.openingAmount))}</small>
        </div>
        <div className="ticket-actions">
          <button className="button button-light" onClick={() => onMovement('WITHDRAWAL')}><ArrowUpCircle size={16} />Sangria</button>
          <button className="button button-light" onClick={() => onMovement('DEPOSIT')}><ArrowDownCircle size={16} />Reforço</button>
          <button className="button button-dark" onClick={onClose}><Lock size={16} />Fechar turno</button>
        </div>
      </header>

      <table className="caixa-table" aria-label="Esperado por forma de pagamento">
        <thead><tr><th>Forma</th><th>Vendas</th><th>Esperado</th></tr></thead>
        <tbody>
          {CASH_METHODS.map((method) => (
            <tr key={method}><td>{methodLabels[method]}</td><td>{brl(toCents(session.sales[method]))}</td><td><b>{brl(toCents(session.expected[method]))}</b></td></tr>
          ))}
        </tbody>
        <tfoot><tr><td>Total</td><td>{brl(totalCents(session.sales))}</td><td><b>{brl(totalCents(session.expected))}</b></td></tr></tfoot>
      </table>

      <div className="caixa-movements">
        <strong>Movimentações</strong>
        {!session.movements.length && <span className="caixa-muted">Nenhuma sangria ou reforço neste turno.</span>}
        <ul>
          {session.movements.map((entry) => (
            <li key={entry.id} className={`caixa-movement ${entry.type.toLowerCase()}`}>
              <span>{formatDateTime(entry.createdAt)}</span>
              <b>{movementLabels[entry.type]}</b>
              <span className="caixa-reason">{entry.reason}</span>
              <strong>{entry.type === 'WITHDRAWAL' ? '−' : '+'} {brl(toCents(entry.amount))}</strong>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function MovementForm({ type, onCancel, onSaved }: { type: CashMovementType; onCancel: () => void; onSaved: (type: CashMovementType) => void }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const label = movementLabels[type];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const invalid = validateMovementForm(type, { amount, reason });
    if (invalid) { setError(invalid); return; }
    setBusy(true); setError('');
    try {
      await storeRequest(type === 'WITHDRAWAL' ? '/cash/withdrawals' : '/cash/deposits', {
        method: 'POST',
        body: JSON.stringify({ amount: centsToAmount(parseMoneyInput(amount) ?? 0), reason: reason.trim() }),
      });
      onSaved(type);
    } catch (caught) {
      setError(errorText(caught, `Não foi possível registrar a ${label.toLowerCase()}.`));
    } finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={label}>
        <div className="modal-heading"><div><div className="eyebrow">CAIXA</div><h2>{label}</h2></div><button className="icon-button" onClick={onCancel} aria-label="Fechar">×</button></div>
        <form className="modal-form" onSubmit={submit}>
          <label>Valor (R$)<input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" /></label>
          <label>Motivo<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={type === 'WITHDRAWAL' ? 'Ex.: depósito no banco' : 'Ex.: troco extra'} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions">
            <button type="button" className="button button-light" onClick={onCancel}>Cancelar</button>
            <button type="submit" className="button button-dark" disabled={busy}>{busy ? 'Salvando…' : `Registrar ${label.toLowerCase()}`}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CloseForm({ expected, onCancel, onClosed }: { expected: ByMethod; onCancel: () => void; onClosed: (session: CashSession) => void }) {
  const [operator, setOperator] = useState('');
  const [counted, setCounted] = useState(emptyCounted());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const rows = closingPreview(expected, counted);
  const divergent = hasDifference(rows);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const form = { operator, counted, notes };
    const invalid = validateCloseForm(form, expected);
    if (invalid) { setError(invalid); return; }
    setBusy(true); setError('');
    try {
      onClosed(await storeRequest<CashSession>('/cash/close', { method: 'POST', body: JSON.stringify(closeBody(form)) }));
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível fechar o turno.'));
    } finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label="Fechar turno">
        <div className="modal-heading"><div><div className="eyebrow">CAIXA</div><h2>Fechar turno</h2></div><button className="icon-button" onClick={onCancel} aria-label="Fechar">×</button></div>
        <form className="modal-form" onSubmit={submit}>
          <label>Operador<input value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="Quem está fechando" /></label>
          <div className="caixa-count">
            {rows.map((row) => (
              <label key={row.method}>
                <span>{methodLabels[row.method]} <small>esperado {brl(row.expectedCents)}</small></span>
                <input inputMode="decimal" aria-label={`Contado em ${methodLabels[row.method]}`} value={counted[row.method]} onChange={(e) => setCounted((c) => ({ ...c, [row.method]: e.target.value }))} placeholder="0,00" />
                <em className={row.differenceCents === 0 ? 'diff-ok' : row.differenceCents > 0 ? 'diff-over' : 'diff-short'}>{differenceLabel(row.differenceCents)}</em>
              </label>
            ))}
          </div>
          <label>Observação {divergent ? '(obrigatória: explique a diferença)' : '(opcional)'}<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions">
            <button type="button" className="button button-light" onClick={onCancel}>Cancelar</button>
            <button type="submit" className="button button-dark" disabled={busy}>{busy ? 'Fechando…' : 'Fechar turno'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HistoryList({ sessions }: { sessions: CashSession[] }) {
  return (
    <div className="panel caixa-history">
      <div className="caixa-history-head"><History size={18} /><strong>Turnos dos últimos 30 dias</strong></div>
      {!sessions.length && <span className="caixa-muted">Nenhum turno no período.</span>}
      <ul>
        {sessions.map((session) => (
          <li key={session.id} className={`caixa-session${session.divergent ? ' divergent' : ''}`}>
            <div>
              <strong>{session.openedBy}</strong>
              <span>{formatDateTime(session.openedAt)} → {formatDateTime(session.closedAt)}</span>
            </div>
            <span className={`status-badge ${session.status === 'OPEN' ? 'status-open' : session.divergent ? 'status-divergent' : 'status-closed'}`}>{sessionStatusLabel(session)}</span>
            {session.differences && session.divergent && (
              <small className="caixa-diffs">
                {session.differences.filter((row) => toCents(row.difference) !== 0).map((row) => `${methodLabels[row.method]}: ${differenceLabel(toCents(row.difference))}`).join(' · ')}
              </small>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

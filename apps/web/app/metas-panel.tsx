'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeftRight, ChevronLeft, ChevronRight, Pencil, ServerOff, Target, Trash2, Wifi } from 'lucide-react';
import { storeRequest } from '@/lib/store';
import { money } from '@/lib/format';
import {
  actualValueLabel, barWidth, currentMonth, goalBody, goalForm, goalValueLabel, METRICS, metricLabels, monthLabel,
  percentLabel, shiftMonth, validateComparePeriod, validateGoalForm, variationLabel, variationTone, windowLabel, yearOf,
  type Goal, type GoalProgress, type PeriodComparison,
} from '@/lib/metas';

// Tela de metas de vendas e comparativo (SPEC/2026-11-17-tela-de-metas.md).

type Props = {
  mode: 'api' | 'local';
  canConnect: boolean;
  onConnect: () => void;
};

const errorText = (caught: unknown, fallback: string) => (caught instanceof Error ? caught.message : fallback);
const formatMoney = (value: string) => money(value);

export function MetasPanel({ mode, canConnect, onConnect }: Props) {
  const [month, setMonth] = useState(currentMonth());
  const [progress, setProgress] = useState<GoalProgress | null>(null);
  const [yearGoals, setYearGoals] = useState<Goal[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    if (mode !== 'api') return;
    try {
      const [next, goals] = await Promise.all([
        storeRequest<GoalProgress>(`/goals/${month}/progress`),
        storeRequest<Goal[]>(`/goals?year=${yearOf(month)}`),
      ]);
      setProgress(next);
      setYearGoals(goals ?? []);
      setError('');
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível carregar as metas.'));
    }
  }, [mode, month]);

  useEffect(() => { void load(); }, [load]);

  async function remove() {
    if (!window.confirm(`Remover a meta de ${monthLabel(month)}?`)) return;
    setMessage(''); setError('');
    try {
      await storeRequest(`/goals/${month}`, { method: 'DELETE' });
      setMessage('Meta removida.');
      await load();
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível remover a meta.'));
    }
  }

  if (mode === 'local') {
    return (
      <section className="page-section">
        <div className="page-heading"><div><div className="eyebrow">DESEMPENHO</div><h1>Metas</h1><p>As metas de vendas existem no modo servidor.</p></div></div>
        <div className="panel kitchen-offline">
          <span className="kitchen-offline-icon"><ServerOff size={26} /></span>
          <strong>As metas precisam do servidor</strong>
          <p>No modo navegador os dados ficam só neste aparelho. Conecte ao servidor para definir e acompanhar as metas.</p>
          {canConnect ? <button className="button button-dark" onClick={onConnect}><Wifi size={17} />Conectar ao servidor</button> : <small>Este build não tem endereço de API configurado (<code>NEXT_PUBLIC_API_URL</code>).</small>}
        </div>
      </section>
    );
  }

  const goal = progress?.goal ?? null;

  return (
    <section className="page-section">
      <div className="page-heading">
        <div><div className="eyebrow">DESEMPENHO</div><h1>Metas</h1><p>Defina a meta do mês e acompanhe quanto falta para chegar lá.</p></div>
        <div className="meta-actions">
          <button className="button button-dark" onClick={() => { setMessage(''); setEditing(true); }}><Pencil size={16} />{goal ? 'Alterar meta' : 'Definir meta'}</button>
          {goal && <button className="button button-light" onClick={() => void remove()}><Trash2 size={16} />Remover meta</button>}
        </div>
      </div>

      <div className="meta-month" role="group" aria-label="Mês">
        <button className="icon-button" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Mês anterior"><ChevronLeft size={18} /></button>
        <strong>{monthLabel(month)}</strong>
        <button className="icon-button" onClick={() => setMonth((m) => shiftMonth(m, 1))} aria-label="Próximo mês"><ChevronRight size={18} /></button>
      </div>

      {error && <div className="kitchen-error" role="alert">{error}</div>}
      {message && <div className="kitchen-message" role="status">{message}</div>}

      {progress && (
        <div className="meta-grid">
          {METRICS.map((metric) => {
            const attainment = progress.attainment[metric];
            const variation = progress.variation[metric];
            return (
              <article key={metric} className="panel meta-card" aria-label={metricLabels[metric]}>
                <header><Target size={16} /><strong>{metricLabels[metric]}</strong></header>
                <div className="meta-values">
                  <span>Realizado <b>{actualValueLabel(metric, progress.actual, formatMoney)}</b></span>
                  <span>Meta <b>{goalValueLabel(metric, goal, formatMoney)}</b></span>
                </div>
                <div className="meta-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={barWidth(attainment)} aria-label={`Atingimento de ${metricLabels[metric]}`}>
                  <span style={{ width: `${barWidth(attainment)}%` }} />
                </div>
                <footer>
                  <span className="meta-attainment">{attainment === null ? 'sem meta' : `${percentLabel(attainment)} da meta`}</span>
                  <span className={`meta-variation ${variationTone(variation)}`}>{variationLabel(variation)} vs. mês anterior</span>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {!!yearGoals.length && (
        <div className="panel meta-year">
          <strong>Metas de {yearOf(month)}</strong>
          <ul>
            {yearGoals.map((entry) => (
              <li key={entry.month}>
                <button className={`button ${entry.month === month ? 'button-dark' : 'button-light'}`} onClick={() => setMonth(entry.month)}>
                  {monthLabel(entry.month)}
                </button>
                <span>{[entry.revenue && `receita ${money(entry.revenue)}`, entry.orders && `${entry.orders} comandas`, entry.averageTicket && `ticket ${money(entry.averageTicket)}`].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ComparePeriods />

      {editing && (
        <GoalModal
          month={month}
          goal={goal}
          onCancel={() => setEditing(false)}
          onSaved={() => { setEditing(false); setMessage(`Meta de ${monthLabel(month)} salva.`); void load(); }}
        />
      )}
    </section>
  );
}

function GoalModal({ month, goal, onCancel, onSaved }: { month: string; goal: Goal | null; onCancel: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(goalForm(goal));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const invalid = validateGoalForm(form);
    if (invalid) { setError(invalid); return; }
    setBusy(true); setError('');
    try {
      await storeRequest(`/goals/${month}`, { method: 'PUT', body: JSON.stringify(goalBody(form)) });
      onSaved();
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível salvar a meta.'));
    } finally { setBusy(false); }
  }

  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={`Meta de ${monthLabel(month)}`}>
        <div className="modal-heading"><div><div className="eyebrow">METAS</div><h2>Meta de {monthLabel(month)}</h2></div><button className="icon-button" onClick={onCancel} aria-label="Fechar">×</button></div>
        <form className="modal-form" onSubmit={submit}>
          <p className="meta-hint">Preencha pelo menos uma. Deixe vazio o que não quiser acompanhar.</p>
          <label>Receita (R$)<input inputMode="decimal" value={form.revenue} onChange={(e) => set('revenue', e.target.value)} placeholder="Ex.: 50.000,00" /></label>
          <label>Comandas pagas<input inputMode="numeric" value={form.orders} onChange={(e) => set('orders', e.target.value)} placeholder="Ex.: 600" /></label>
          <label>Ticket médio (R$)<input inputMode="decimal" value={form.averageTicket} onChange={(e) => set('averageTicket', e.target.value)} placeholder="Ex.: 85,00" /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions">
            <button type="button" className="button button-light" onClick={onCancel}>Cancelar</button>
            <button type="submit" className="button button-dark" disabled={busy}>{busy ? 'Salvando…' : 'Salvar meta'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ComparePeriods() {
  const [period, setPeriod] = useState({ from: '', to: '' });
  const [result, setResult] = useState<PeriodComparison | null>(null);
  const [error, setError] = useState('');

  async function compare(event: React.FormEvent) {
    event.preventDefault();
    const invalid = validateComparePeriod(period);
    if (invalid) { setError(invalid); return; }
    try {
      setResult(await storeRequest<PeriodComparison>(`/reports/compare?from=${period.from}&to=${period.to}`));
      setError('');
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível comparar os períodos.'));
    }
  }

  return (
    <div className="panel meta-compare">
      <div className="meta-compare-head"><ArrowLeftRight size={18} /><strong>Comparar períodos</strong></div>
      <form className="meta-period" onSubmit={compare}>
        <label>De<input type="date" value={period.from} onChange={(e) => setPeriod((p) => ({ ...p, from: e.target.value }))} /></label>
        <label>Até<input type="date" value={period.to} onChange={(e) => setPeriod((p) => ({ ...p, to: e.target.value }))} /></label>
        <button type="submit" className="button button-light">Comparar</button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      {result && (
        <table className="meta-table" aria-label="Comparativo de períodos">
          <thead><tr><th></th><th>{windowLabel(result.current.window)}</th><th>{windowLabel(result.previous.window)}</th><th>Variação</th></tr></thead>
          <tbody>
            {METRICS.map((metric) => (
              <tr key={metric}>
                <td>{metricLabels[metric]}</td>
                <td><b>{actualValueLabel(metric, result.current, formatMoney)}</b></td>
                <td>{actualValueLabel(metric, result.previous, formatMoney)}</td>
                <td className={`meta-variation ${variationTone(result.variation[metric])}`}>{variationLabel(result.variation[metric])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

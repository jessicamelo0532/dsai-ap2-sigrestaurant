'use client';

import { useCallback, useEffect, useState } from 'react';
import { Gift, Pencil, Search, ServerOff, Wifi } from 'lucide-react';
import { storeRequest } from '@/lib/store';
import { money } from '@/lib/format';
import {
  centsLabel, earnLabel, entryLabels, pointsLabel, ruleChanges, ruleExamples, ruleForm, RULE_FIELDS, signedPoints,
  validateRule, parseRule, type CustomerLoyalty, type LoyaltyRule,
} from '@/lib/fidelidade';

// Tela do programa de fidelidade (SPEC/2026-11-17-tela-de-fidelidade.md).

type Props = {
  mode: 'api' | 'local';
  canConnect: boolean;
  onConnect: () => void;
};

// Só o que a consulta precisa do cliente (GET /customers).
type CustomerOption = { id: number; name: string; phone: string | null };

const errorText = (caught: unknown, fallback: string) => (caught instanceof Error ? caught.message : fallback);

const formatDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const two = (value: number) => String(value).padStart(2, '0');
  return `${two(date.getDate())}/${two(date.getMonth() + 1)}/${date.getFullYear()}`;
};

export function FidelidadePanel({ mode, canConnect, onConnect }: Props) {
  const [rule, setRule] = useState<LoyaltyRule | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    if (mode !== 'api') return;
    try {
      setRule(await storeRequest<LoyaltyRule>('/loyalty/settings'));
      setError('');
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível carregar a regra de fidelidade.'));
    }
  }, [mode]);

  useEffect(() => { void load(); }, [load]);

  if (mode === 'local') {
    return (
      <section className="page-section">
        <div className="page-heading"><div><div className="eyebrow">RELACIONAMENTO</div><h1>Fidelidade</h1><p>O programa de pontos existe no modo servidor.</p></div></div>
        <div className="panel kitchen-offline">
          <span className="kitchen-offline-icon"><ServerOff size={26} /></span>
          <strong>A fidelidade precisa do servidor</strong>
          <p>No modo navegador os dados ficam só neste aparelho. Conecte ao servidor para ver a regra e o saldo dos clientes.</p>
          {canConnect ? <button className="button button-dark" onClick={onConnect}><Wifi size={17} />Conectar ao servidor</button> : <small>Este build não tem endereço de API configurado (<code>NEXT_PUBLIC_API_URL</code>).</small>}
        </div>
      </section>
    );
  }

  const examples = rule ? ruleExamples(rule) : null;

  return (
    <section className="page-section">
      <div className="page-heading">
        <div><div className="eyebrow">RELACIONAMENTO</div><h1>Fidelidade</h1><p>Confira a regra de pontos e consulte o saldo de cada cliente.</p></div>
        {rule && <button className="button button-dark" onClick={() => { setMessage(''); setEditing(true); }}><Pencil size={16} />Alterar regra</button>}
      </div>

      {error && <div className="kitchen-error" role="alert">{error}</div>}
      {message && <div className="kitchen-message" role="status">{message}</div>}

      {rule && examples && (
        <div className="panel fidelidade-rule" aria-label="Regra atual">
          <div className="fidelidade-head"><Gift size={18} /><strong>Regra atual</strong></div>
          <ul className="fidelidade-facts">
            <li><b>{earnLabel(rule)}</b><span>pagos na conta</span></li>
            <li><b>Cada ponto vale {centsLabel(rule.centsPerPoint)}</b><span>no resgate</span></li>
            <li><b>Resgate mínimo de {pointsLabel(rule.minRedeemPoints)}</b><span>vale {centsLabel(examples.minRedeemValueCents)}</span></li>
          </ul>
          <p className="fidelidade-example">
            Uma conta de {centsLabel(10_000)} gera <b>{pointsLabel(examples.earned)}</b>.
            {examples.spendForMinimumCents !== null && <> O cliente chega ao resgate mínimo depois de gastar <b>{centsLabel(examples.spendForMinimumCents)}</b>.</>}
          </p>
        </div>
      )}

      <CustomerLookup />

      {rule && editing && (
        <RuleForm
          rule={rule}
          onCancel={() => setEditing(false)}
          onSaved={(next) => { setEditing(false); setRule(next); setMessage('Pronto, regra de fidelidade atualizada.'); }}
        />
      )}
    </section>
  );
}

function RuleForm({ rule, onCancel, onSaved }: { rule: LoyaltyRule; onCancel: () => void; onSaved: (rule: LoyaltyRule) => void }) {
  const [form, setForm] = useState(ruleForm(rule));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const invalid = validateRule(form);
  const preview = invalid ? null : ruleExamples(parseRule(form));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (invalid) { setError(invalid); return; }
    const changes = ruleChanges(rule, form);
    if (!Object.keys(changes).length) { onCancel(); return; }
    setBusy(true); setError('');
    try {
      onSaved(await storeRequest<LoyaltyRule>('/loyalty/settings', { method: 'PUT', body: JSON.stringify(changes) }));
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível salvar a regra.'));
    } finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label="Alterar regra de fidelidade">
        <div className="modal-heading"><div><div className="eyebrow">FIDELIDADE</div><h2>Alterar regra</h2></div><button className="icon-button" onClick={onCancel} aria-label="Fechar">×</button></div>
        <form className="modal-form" onSubmit={submit}>
          {RULE_FIELDS.map((field) => (
            <label key={field.key}>
              {field.label[0].toUpperCase() + field.label.slice(1)} ({field.min} a {field.max.toLocaleString('pt-BR')})
              <input inputMode="numeric" value={form[field.key]} onChange={(e) => setForm((c) => ({ ...c, [field.key]: e.target.value }))} />
            </label>
          ))}
          {preview && (
            <p className="fidelidade-preview" role="note">
              Com esta regra, uma conta de {centsLabel(10_000)} gera {pointsLabel(preview.earned)} e o resgate mínimo vale {centsLabel(preview.minRedeemValueCents)}.
            </p>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions">
            <button type="button" className="button button-light" onClick={onCancel}>Cancelar</button>
            <button type="submit" className="button button-dark" disabled={busy}>{busy ? 'Salvando…' : 'Salvar regra'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CustomerLookup() {
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<CustomerOption[] | null>(null);
  const [chosen, setChosen] = useState<CustomerOption | null>(null);
  const [loyalty, setLoyalty] = useState<CustomerLoyalty | null>(null);
  const [error, setError] = useState('');

  async function find(event: React.FormEvent) {
    event.preventDefault();
    const term = search.trim();
    if (term.length < 2) { setError('Digite pelo menos 2 letras ou números para buscar.'); return; }
    setError(''); setChosen(null); setLoyalty(null);
    try {
      setOptions(await storeRequest<CustomerOption[]>(`/customers?search=${encodeURIComponent(term)}`));
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível buscar clientes.'));
    }
  }

  async function choose(customer: CustomerOption) {
    setChosen(customer); setError('');
    try {
      setLoyalty(await storeRequest<CustomerLoyalty>(`/customers/${customer.id}/loyalty`));
    } catch (caught) {
      setLoyalty(null);
      setError(errorText(caught, 'Não foi possível carregar os pontos.'));
    }
  }

  return (
    <div className="panel fidelidade-lookup">
      <div className="fidelidade-head"><Search size={18} /><strong>Consultar cliente</strong></div>
      <form className="fidelidade-search" onSubmit={find}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome ou telefone" aria-label="Buscar cliente" />
        <button type="submit" className="button button-light">Buscar</button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      {options && !options.length && <span className="fidelidade-muted">Nenhum cliente encontrado.</span>}
      {options && !!options.length && !chosen && (
        <ul className="fidelidade-options">
          {options.map((customer) => (
            <li key={customer.id}><button className="button button-light" onClick={() => void choose(customer)}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ''}</button></li>
          ))}
        </ul>
      )}
      {chosen && loyalty && (
        <div className="fidelidade-balance">
          <div className="fidelidade-balance-head">
            <div><span>Saldo de {chosen.name}</span><strong>{pointsLabel(loyalty.balance)}</strong><small>valem {money(loyalty.balanceValue)}</small></div>
            <button className="button button-light" onClick={() => { setChosen(null); setLoyalty(null); }}>Outro cliente</button>
          </div>
          {!loyalty.entries.length && <span className="fidelidade-muted">Nenhum movimento de pontos ainda.</span>}
          {!!loyalty.entries.length && (
            <ul className="fidelidade-entries" aria-label="Extrato de pontos">
              {loyalty.entries.map((entry) => (
                <li key={entry.id} className={entry.points < 0 ? 'out' : 'in'}>
                  <span>{formatDate(entry.createdAt)}</span>
                  <b>{entryLabels[entry.type]}</b>
                  <span>{entry.orderId ? `Comanda #${entry.orderId}` : '—'}</span>
                  <strong>{signedPoints(entry.points)}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

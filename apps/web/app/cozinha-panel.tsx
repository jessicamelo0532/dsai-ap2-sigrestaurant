'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChefHat, Clock3, Flame, RefreshCw, ServerOff, TriangleAlert, Wifi } from 'lucide-react';
import { storeRequest } from '@/lib/store';
import {
  actionLabels, allowedActions, bandHint, bandLabels, bandOf, canChangePriority, channelLabels,
  filterCounts, filterQueue, formatWait, itemCountLabel, KITCHEN_REFRESH_MS, kitchenFilters,
  nextPriority, placeLabel, priorityLabels, queueCards, sortQueue, statusLabels, summarize,
  ticketCountLabel, ticketTitle, validateChangedBy, waiterLabel,
  type KitchenAction, type KitchenFilter, type KitchenQueue, type KitchenTicket,
} from '@/lib/cozinha';

// Tela da cozinha (SPEC/2026-11-17-tela-da-cozinha.md). Só desenha: a lógica está em lib/cozinha.ts.

type CozinhaPanelProps = {
  mode: 'api' | 'local';
  canConnect: boolean;
  onConnect: () => void;
};

const bandClass = (band: string) => band.toLowerCase().replace('_', '-');

export function CozinhaPanel({ mode, canConnect, onConnect }: CozinhaPanelProps) {
  const [queue, setQueue] = useState<KitchenQueue | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [filter, setFilter] = useState<KitchenFilter>('todas');
  const [priorityFor, setPriorityFor] = useState<KitchenTicket | null>(null);
  const [changedBy, setChangedBy] = useState('');
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    if (mode !== 'api') return;
    try {
      setQueue(await storeRequest<KitchenQueue>('/kitchen/queue'));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar a fila da cozinha.');
    }
  }, [mode]);

  // RF-06: atualiza sozinha enquanto a tela está aberta.
  useEffect(() => {
    if (mode !== 'api') return;
    void load();
    const timer = window.setInterval(() => void load(), KITCHEN_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load, mode]);

  const tickets = useMemo(() => queue?.tickets ?? [], [queue]);
  const summary = useMemo(() => summarize(tickets), [tickets]);
  const counts = useMemo(() => filterCounts(tickets), [tickets]);
  const visible = useMemo(() => sortQueue(filterQueue(tickets, filter)), [tickets, filter]);
  const queued = queueCards(tickets);

  async function act(ticket: KitchenTicket, action: KitchenAction) {
    setBusyId(ticket.id);
    setMessage('');
    try {
      await storeRequest(`/kitchen/tickets/${ticket.id}/${action}`, { method: 'POST' });
      setMessage(`${ticketTitle(ticket)}: ${actionLabels[action].toLowerCase()} registrado.`);
      await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Não foi possível mudar a situação do pedido.');
    } finally {
      setBusyId(null);
    }
  }

  function openPriority(ticket: KitchenTicket) {
    setPriorityFor(ticket);
    setChangedBy('');
    setFormError('');
  }

  // RF-04 e RN-03: valida "quem mudou" antes de chamar a API.
  async function submitPriority(event: React.FormEvent) {
    event.preventDefault();
    if (!priorityFor) return;
    const invalid = validateChangedBy(changedBy);
    if (invalid) {
      setFormError(invalid);
      return;
    }
    const priority = nextPriority(priorityFor.priority);
    setBusyId(priorityFor.id);
    try {
      await storeRequest(`/kitchen/tickets/${priorityFor.id}/priority`, {
        method: 'PUT',
        body: JSON.stringify({ priority, changedBy: changedBy.trim() }),
      });
      setMessage(`${ticketTitle(priorityFor)}: prioridade ${priorityLabels[priority].toLowerCase()} registrada.`);
      setPriorityFor(null);
      await load();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Não foi possível mudar a prioridade.');
    } finally {
      setBusyId(null);
    }
  }

  // RF-08: no modo navegador não existe fila de produção.
  if (mode === 'local') {
    return (
      <section className="page-section kitchen">
        <div className="page-heading">
          <div>
            <div className="eyebrow">PRODUÇÃO</div>
            <h1>Cozinha</h1>
            <p>A fila de produção é compartilhada pela equipe e existe no modo servidor.</p>
          </div>
        </div>
        <div className="panel kitchen-offline">
          <span className="kitchen-offline-icon"><ServerOff size={26} /></span>
          <strong>A cozinha precisa do servidor</strong>
          <p>
            No modo navegador os dados ficam só neste aparelho, então a cozinha não veria o pedido lançado no
            salão. Conecte ao servidor para enviar pedidos e acompanhar a fila.
          </p>
          {canConnect
            ? <button className="button button-dark" onClick={onConnect}><Wifi size={17} />Conectar ao servidor</button>
            : <small>Este build não tem endereço de API configurado (<code>NEXT_PUBLIC_API_URL</code>).</small>}
        </div>
      </section>
    );
  }

  return (
    <section className="page-section kitchen">
      <div className="page-heading">
        <div>
          <div className="eyebrow">PRODUÇÃO</div>
          <h1>Cozinha</h1>
          <p>Fila de produção: prioridade alta primeiro, depois a ordem de chegada.</p>
        </div>
        <div className="kitchen-heading-actions">
          <span className="floor-live"><i />Atualiza sozinho a cada {KITCHEN_REFRESH_MS / 1000} s</span>
          <button className="button button-light" onClick={() => void load()} disabled={busyId !== null}>
            <RefreshCw size={16} />Atualizar
          </button>
        </div>
      </div>

      {error && <div className="kitchen-error" role="alert"><TriangleAlert size={17} />{error}</div>}
      {message && <div className="kitchen-message" role="status">{message}</div>}

      <div className="kitchen-stats">
        <div className="kitchen-card total-card"><span className="finance-icon"><ChefHat size={18} /></span><small>Na fila</small><strong>{summary.total}</strong><span>{ticketCountLabel(summary.total)}</span></div>
        <div className="kitchen-card"><span className="finance-icon"><Clock3 size={18} /></span><small>Aguardando</small><strong>{summary.byStatus.QUEUED}</strong><span>para começar</span></div>
        <div className="kitchen-card"><span className="finance-icon"><Flame size={18} /></span><small>Em preparo</small><strong>{summary.byStatus.PREPARING}</strong><span>na chapa</span></div>
        <div className="kitchen-card ready-card"><span className="finance-icon"><ChefHat size={18} /></span><small>Prontos</small><strong>{summary.byStatus.READY}</strong><span>para entregar</span></div>
        <div className={`kitchen-card late-card ${summary.byBand.ATRASADO ? 'has-late' : ''}`}><span className="finance-icon"><TriangleAlert size={18} /></span><small>Atrasados</small><strong>{summary.byBand.ATRASADO}</strong><span>{bandHint.ATRASADO}</span></div>
        <div className="kitchen-card high-card"><span className="finance-icon"><Flame size={18} /></span><small>Alta prioridade</small><strong>{summary.highPriority}</strong><span>pedidos destacados</span></div>
      </div>

      <div className="floor-filters" role="group" aria-label="Filtros da fila">
        {kitchenFilters.map((option) => (
          <button key={option.id} className="floor-filter" aria-pressed={filter === option.id} onClick={() => setFilter(option.id)}>
            {option.label}<b>{counts[option.id]}</b>
          </button>
        ))}
      </div>

      {!queued.length && !error && (
        <div className="empty-state kitchen-empty">
          <ChefHat size={26} />
          <strong>Nenhum pedido na cozinha</strong>
          <span>Envie uma comanda pela Visão geral para ela aparecer aqui.</span>
        </div>
      )}

      {!!queued.length && !visible.length && (
        <div className="empty-state kitchen-empty">
          <ChefHat size={24} />
          <strong>Nada neste filtro</strong>
          <span>Escolha outro filtro para ver os pedidos.</span>
        </div>
      )}

      <div className="kitchen-queue">
        {visible.map((ticket) => (
          <article key={ticket.id} className={`kitchen-ticket band-${bandClass(bandOf(ticket))} ${ticket.priority === 'HIGH' ? 'high' : ''}`}>
            <header className="ticket-head">
              <div>
                <span className="ticket-id">{ticketTitle(ticket)}</span>
                <h2>{placeLabel(ticket)}</h2>
                <p>
                  <span className={`channel-tag ${ticket.channel === 'DELIVERY' ? 'delivery' : ''}`}>{channelLabels[ticket.channel] ?? 'Salão'}</span>
                  <span>{waiterLabel(ticket.waiterName)}</span>
                </p>
              </div>
              <div className="ticket-badges">
                <span className={`status-badge status-${ticket.status.toLowerCase()}`}>{statusLabels[ticket.status]}</span>
                <span className={`band-badge band-${bandClass(bandOf(ticket))}`}>{bandLabels[bandOf(ticket)]}</span>
                {ticket.priority === 'HIGH' && <span className="priority-badge"><Flame size={13} />Alta</span>}
              </div>
            </header>

            <div className="ticket-time">
              <Clock3 size={15} />
              <strong>{formatWait(ticket.waitingMinutes)}</strong>
              <span>{ticket.status === 'READY' ? 'esperando a entrega' : bandHint[bandOf(ticket)]}</span>
            </div>

            <ul className="ticket-items">
              {ticket.items.map((item) => (
                <li key={item.id}>
                  <b>{item.quantity}×</b>
                  <span>
                    {item.name}
                    {!!item.addons.length && <small>{item.addons.join(' · ')}</small>}
                  </span>
                </li>
              ))}
            </ul>

            {ticket.note && <p className="ticket-note">Observação: {ticket.note}</p>}

            <div className="ticket-actions">
              {allowedActions(ticket.status).map((action) => (
                <button
                  key={action}
                  className={`button ${action === 'deliver' ? 'button-dark' : 'button-light'}`}
                  disabled={busyId !== null}
                  onClick={() => void act(ticket, action)}
                >
                  {actionLabels[action]}
                </button>
              ))}
              {canChangePriority(ticket.status) && (
                <button className="button button-ghost" disabled={busyId !== null} onClick={() => openPriority(ticket)}>
                  <Flame size={15} />{ticket.priority === 'HIGH' ? 'Voltar a normal' : 'Marcar alta'}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      {priorityFor && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPriorityFor(null); }}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="Mudar prioridade">
            <div className="modal-heading">
              <div>
                <div className="eyebrow">{ticketTitle(priorityFor)} · {placeLabel(priorityFor)}</div>
                <h2>Prioridade {priorityLabels[nextPriority(priorityFor.priority)].toLowerCase()}</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setPriorityFor(null)} aria-label="Fechar">×</button>
            </div>
            <form className="modal-form" onSubmit={submitPriority}>
              <label>
                Quem mudou a prioridade
                <input
                  value={changedBy}
                  onChange={(event) => { setChangedBy(event.target.value); setFormError(''); }}
                  placeholder="Nome de quem está na cozinha"
                  autoFocus
                />
              </label>
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <div className="form-actions">
                <button type="button" className="button button-light" onClick={() => setPriorityFor(null)}>Cancelar</button>
                <button type="submit" className="button button-dark" disabled={busyId !== null}>Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, CirclePlus, Clock3, Phone, RefreshCw, ServerOff, UserRound, Users, Wifi } from 'lucide-react';
import { storeRequest } from '@/lib/store';
import {
  allowedReservationActions, DEFAULT_DURATION, durationOptions, filterCounts, filterReservations,
  formatRange, formatTime, localDay, peopleLabel, reservationActionLabels, reservationCountLabel,
  reservationFilters, statusLabels, tableLabel, toLocalIso, validateReservationForm,
  type AvailableTable, type Reservation, type ReservationFilter,
} from '@/lib/reservas';

type Props = {
  mode: 'api' | 'local';
  canConnect: boolean;
  onConnect: () => void;
  onOpenTable: (tableNumber: number) => void;
};

export function ReservasPanel({ mode, canConnect, onConnect, onOpenTable }: Props) {
  const [day, setDay] = useState(localDay());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [filter, setFilter] = useState<ReservationFilter>('todas');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    if (mode !== 'api') return;
    try {
      setReservations(await storeRequest<Reservation[]>(`/reservations?date=${day}`));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar as reservas.');
    }
  }, [day, mode]);

  useEffect(() => { void load(); }, [load]);

  const counts = filterCounts(reservations);
  const visible = filterReservations(reservations, filter);

  async function act(id: number, action: 'seat' | 'cancel' | 'no-show', tableNumber?: number) {
    setBusy(true); setMessage(''); setError('');
    try {
      const updated = await storeRequest<Reservation>(`/reservations/${id}/${action}`, { method: 'POST' });
      setMessage(action === 'seat'
        ? `${tableLabel(updated.tableNumber)}: cliente marcado como presente.`
        : action === 'cancel' ? 'Reserva cancelada.' : 'Falta registrada.');
      await load();
      if (action === 'seat' && tableNumber) setSeatedTable(tableNumber);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível alterar a reserva.');
    } finally { setBusy(false); }
  }

  const [seatedTable, setSeatedTable] = useState<number | null>(null);

  if (mode === 'local') {
    return (
      <section className="page-section">
        <div className="page-heading"><div><div className="eyebrow">AGENDA</div><h1>Reservas</h1><p>A agenda é compartilhada pela equipe e existe no modo servidor.</p></div></div>
        <div className="panel kitchen-offline">
          <span className="kitchen-offline-icon"><ServerOff size={26} /></span>
          <strong>Reservas precisam do servidor</strong>
          <p>No modo navegador os dados ficam só neste aparelho. Conecte ao servidor para ver e registrar reservas.</p>
          {canConnect ? <button className="button button-dark" onClick={onConnect}><Wifi size={17} />Conectar ao servidor</button> : <small>Este build não tem endereço de API configurado (<code>NEXT_PUBLIC_API_URL</code>).</small>}
        </div>
      </section>
    );
  }

  return (
    <section className="page-section">
      <div className="page-heading">
        <div><div className="eyebrow">AGENDA</div><h1>Reservas</h1><p>Veja as reservas do dia e encaminhe o cliente para a mesa.</p></div>
        <button className="button button-dark" onClick={() => { setShowForm(true); setSeatedTable(null); }}><CirclePlus size={17} />Nova reserva</button>
      </div>

      <div className="reserva-toolbar">
        <label className="reserva-day"><CalendarDays size={16} />Dia<input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label>
        <button className="button button-light" onClick={() => void load()} disabled={busy}><RefreshCw size={16} />Atualizar</button>
        <span className="count-pill">{reservationCountLabel(reservations.length)}</span>
      </div>

      {error && <div className="kitchen-error" role="alert">{error}</div>}
      {message && <div className="kitchen-message" role="status">{message}</div>}
      {seatedTable !== null && (
        <div className="kitchen-message" role="status">
          Cliente na {tableLabel(seatedTable)}. <button className="button button-dark" style={{marginLeft:8}} onClick={() => onOpenTable(seatedTable)}>Abrir comanda</button>
        </div>
      )}

      <div className="floor-filters" role="group" aria-label="Filtros de reservas">
        {reservationFilters.map((option) => (
          <button key={option.id} className="floor-filter" aria-pressed={filter === option.id} onClick={() => setFilter(option.id)}>
            {option.label}<b>{counts[option.id]}</b>
          </button>
        ))}
      </div>

      {!visible.length && !error && (
        <div className="empty-state compact"><CalendarDays size={22} /><strong>Nenhuma reserva neste filtro</strong><span>Escolha outro filtro ou outro dia.</span></div>
      )}

      <div className="reserva-list">
        {visible.map((reservation) => (
          <article key={reservation.id} className={`reserva-card status-${reservation.status.toLowerCase()}`}>
            <header className="reserva-head">
              <div>
                <strong>{reservation.customerName}</strong>
                <span className={`status-badge status-${reservation.status.toLowerCase()}`}>{statusLabels[reservation.status]}</span>
              </div>
              <span className="reserva-table">{tableLabel(reservation.tableNumber)}</span>
            </header>
            <p className="reserva-meta">
              <span><Clock3 size={14} />{formatRange(reservation.startsAt, reservation.endsAt)}</span>
              <span><Users size={14} />{peopleLabel(reservation.partySize)}</span>
              {reservation.customerPhone && <span><Phone size={14} />{reservation.customerPhone}</span>}
            </p>
            {reservation.notes && <p className="reserva-notes">{reservation.notes}</p>}
            <div className="ticket-actions">
              {allowedReservationActions(reservation.status).map((action) => (
                <button key={action} className={`button ${action === 'seat' ? 'button-dark' : 'button-light'}`} disabled={busy} onClick={() => void act(reservation.id, action, reservation.tableNumber)}>
                  {reservationActionLabels[action]}
                </button>
              ))}
              {reservation.status === 'SEATED' && (
                <button className="button button-dark" onClick={() => onOpenTable(reservation.tableNumber)}>Abrir comanda</button>
              )}
            </div>
          </article>
        ))}
      </div>

      {showForm && <ReservaForm day={day} onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); void load(); setMessage('Pronto, reserva criada.'); }} />}
    </section>
  );
}

function ReservaForm({ day, onClose, onCreated }: { day: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ customerName: '', customerPhone: '', partySize: '2', startsAt: `${day}T19:00`, durationMinutes: String(DEFAULT_DURATION), notes: '', tableId: '' });
  const [tables, setTables] = useState<AvailableTable[]>([]);
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function lookup() {
    const partySize = Number(form.partySize);
    if (!form.startsAt || !Number.isInteger(partySize) || partySize < 1) { setError('Informe pessoas e horário para buscar mesas.'); return; }
    setLooking(true); setError(''); setTables([]);
    try {
      const list = await storeRequest<AvailableTable[]>(`/reservations/availability?startsAt=${encodeURIComponent(toLocalIso(form.startsAt))}&partySize=${partySize}&durationMinutes=${form.durationMinutes}`);
      setTables(list);
      if (!list.length) setError('Nenhuma mesa livre para esse horário e número de pessoas.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível buscar mesas.'); }
    finally { setLooking(false); }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const partySize = Number(form.partySize);
    const tableId = form.tableId ? Number(form.tableId) : null;
    const invalid = validateReservationForm({ customerName: form.customerName, partySize, startsAt: form.startsAt, tableId });
    if (invalid) { setError(invalid); return; }
    setBusy(true); setError('');
    try {
      await storeRequest('/reservations', { method: 'POST', body: JSON.stringify({
        tableId, customerName: form.customerName.trim(), ...(form.customerPhone.trim() ? { customerPhone: form.customerPhone.trim() } : {}),
        partySize, startsAt: toLocalIso(form.startsAt), durationMinutes: Number(form.durationMinutes),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      }) });
      onCreated();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível criar a reserva.'); }
    finally { setBusy(false); }
  }

  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value, ...(key !== 'tableId' ? { tableId: '' } : {}) }));

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label="Nova reserva">
        <div className="modal-heading"><div><div className="eyebrow">AGENDA</div><h2>Nova reserva</h2></div><button className="icon-button" onClick={onClose} aria-label="Fechar">×</button></div>
        <form className="modal-form" onSubmit={submit}>
          <label><UserRound size={14} /> Nome do cliente<input value={form.customerName} onChange={(e) => set('customerName', e.target.value)} placeholder="Ex.: Ana" /></label>
          <div className="form-row">
            <label>Pessoas<input type="number" min={1} max={100} value={form.partySize} onChange={(e) => set('partySize', e.target.value)} /></label>
            <label>Duração<select value={form.durationMinutes} onChange={(e) => set('durationMinutes', e.target.value)}>{durationOptions.map((d) => <option key={d} value={d}>{d} min</option>)}</select></label>
          </div>
          <label><Clock3 size={14} /> Início<input type="datetime-local" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} /></label>
          <label>Telefone (opcional)<input value={form.customerPhone} onChange={(e) => set('customerPhone', e.target.value)} placeholder="(91) 99999-9999" /></label>
          <button type="button" className="button button-light" onClick={() => void lookup()} disabled={looking}>{looking ? 'Buscando…' : 'Buscar mesas livres'}</button>
          {!!tables.length && (
            <label>Mesa livre<select value={form.tableId} onChange={(e) => setForm((c) => ({ ...c, tableId: e.target.value }))}>
              <option value="">Escolha a mesa</option>
              {tables.map((t) => <option key={t.id} value={t.id}>{tableLabel(t.number)} · {t.capacity} lugares</option>)}
            </select></label>
          )}
          <label>Observações (opcional)<input value={form.notes} onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))} placeholder="Ex.: aniversário" /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions">
            <button type="button" className="button button-light" onClick={onClose}>Cancelar</button>
            <button type="submit" className="button button-dark" disabled={busy}>{busy ? 'Salvando…' : 'Criar reserva'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

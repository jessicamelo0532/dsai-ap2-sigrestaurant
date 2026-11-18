'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, CirclePlus, Copy, Eraser, Save, ServerOff, Trash2, Wifi } from 'lucide-react';
import { storeRequest } from '@/lib/store';
import type { MenuItem } from '@/lib/types';
import {
  newRow, repeatOnWorkdays, statusLabel, toRows, validateWindows, WEEKDAYS, windowsBody, type Availability, type WindowRow,
} from '@/lib/horarios';

// Aba Horários do Cardápio (SPEC/2026-11-17-tela-de-horarios-do-cardapio.md).

type Props = {
  mode: 'api' | 'local';
  canConnect: boolean;
  onConnect: () => void;
  menu: MenuItem[];
  // Recarrega o cardápio: a lista do pedido depende das janelas.
  onChanged: () => void;
};

const errorText = (caught: unknown, fallback: string) => (caught instanceof Error ? caught.message : fallback);

export function HorariosPanel({ mode, canConnect, onConnect, menu, onChanged }: Props) {
  const [itemId, setItemId] = useState<number | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [rows, setRows] = useState<WindowRow[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode !== 'api' || itemId === null) return;
    setAvailability(null); setError(''); setMessage('');
    storeRequest<Availability>(`/menu-items/${itemId}/availability`)
      .then((loaded) => { setAvailability(loaded); setRows(toRows(loaded.windows)); })
      .catch((caught) => setError(errorText(caught, 'Não foi possível carregar os horários.')));
  }, [mode, itemId]);

  if (mode === 'local') {
    return (
      <div className="panel kitchen-offline">
        <span className="kitchen-offline-icon"><ServerOff size={26} /></span>
        <strong>Horários do cardápio precisam do servidor</strong>
        <p>No modo navegador os dados ficam só neste aparelho. Conecte ao servidor para definir em que dias e horários cada item aparece.</p>
        {canConnect ? <button className="button button-dark" onClick={onConnect}><Wifi size={17} />Conectar ao servidor</button> : <small>Este build não tem endereço de API configurado (<code>NEXT_PUBLIC_API_URL</code>).</small>}
      </div>
    );
  }

  const update = (index: number, change: Partial<WindowRow>) => setRows((current) => current.map((row, i) => (i === index ? { ...row, ...change } : row)));

  async function save() {
    const invalid = validateWindows(rows);
    if (invalid) { setError(invalid); setMessage(''); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const saved = await storeRequest<Availability>(`/menu-items/${itemId}/availability`, { method: 'PUT', body: JSON.stringify(windowsBody(rows)) });
      setAvailability(saved);
      setRows(toRows(saved.windows));
      setMessage(saved.alwaysAvailable ? 'Pronto, o item fica sempre disponível.' : 'Pronto, horários salvos.');
      onChanged();
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível salvar os horários.'));
    } finally { setBusy(false); }
  }

  return (
    <div className="panel horarios-panel">
      <label className="opcoes-item">Item do cardápio
        <select value={itemId ?? ''} onChange={(e) => setItemId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Escolha o item</option>
          {[...menu].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </select>
      </label>

      {itemId === null && <p className="opcoes-hint">Escolha um item para definir em que dias e horários ele aparece no pedido. Sem janelas, o item fica sempre disponível.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="opcoes-ok" role="status">{message}</p>}

      {availability && (
        <>
          <p className={`horarios-status ${availability.alwaysAvailable ? 'always' : availability.availableNow ? 'open' : 'closed'}`}>
            <CalendarClock size={16} />{statusLabel(availability)}
          </p>

          <div className="horarios-list" role="list" aria-label="Janelas de horário">
            {!rows.length && <small className="opcoes-hint">Nenhuma janela: o item aparece em qualquer horário.</small>}
            {rows.map((row, index) => (
              <div key={row.key} className="horarios-row" role="listitem">
                <select value={row.weekday} onChange={(e) => update(index, { weekday: Number(e.target.value) })} aria-label={`Dia da janela ${index + 1}`}>
                  {WEEKDAYS.map((day, weekday) => <option key={day} value={weekday}>{day}</option>)}
                </select>
                <input value={row.start} onChange={(e) => update(index, { start: e.target.value })} placeholder="11:00" aria-label={`Início da janela ${index + 1}`} />
                <input value={row.end} onChange={(e) => update(index, { end: e.target.value })} placeholder="15:00" aria-label={`Fim da janela ${index + 1}`} />
                <button type="button" className="icon-button" onClick={() => setRows((current) => repeatOnWorkdays(current, index))} aria-label={`Repetir a janela ${index + 1} nos dias úteis`} title="Repetir nos dias úteis"><Copy size={15} /></button>
                <button type="button" className="icon-button danger" onClick={() => setRows((current) => current.filter((_, i) => i !== index))} aria-label={`Remover a janela ${index + 1}`}><Trash2 size={15} /></button>
              </div>
            ))}
          </div>

          <div className="horarios-actions">
            <button type="button" className="button button-light" onClick={() => setRows((current) => [...current, newRow()])}><CirclePlus size={15} />Incluir janela</button>
            <button type="button" className="button button-light" disabled={!rows.length} onClick={() => setRows([])}><Eraser size={15} />Sempre disponível</button>
            <button type="button" className="button button-dark" disabled={busy} onClick={() => void save()}><Save size={15} />{busy ? 'Salvando…' : 'Salvar horários'}</button>
          </div>
        </>
      )}
    </div>
  );
}

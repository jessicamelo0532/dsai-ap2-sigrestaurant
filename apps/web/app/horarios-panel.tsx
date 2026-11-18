'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, ServerOff, Wifi } from 'lucide-react';
import { storeRequest } from '@/lib/store';
import type { MenuItem } from '@/lib/types';
import { statusLabel, toRows, validateWindows, windowsBody, type Availability, type WindowRow } from '@/lib/horarios';
import { JanelasEditor } from './janelas-editor';

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

          <JanelasEditor
            rows={rows}
            onChange={setRows}
            onSave={() => void save()}
            busy={busy}
            emptyText="Nenhuma janela: o item aparece em qualquer horário."
            clearLabel="Sempre disponível"
            saveLabel="Salvar horários"
          />
        </>
      )}
    </div>
  );
}

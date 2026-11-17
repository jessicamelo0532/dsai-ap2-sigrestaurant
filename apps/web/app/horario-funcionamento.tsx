'use client';

import { useEffect, useState } from 'react';
import { storeRequest } from '@/lib/store';
import { toRows, validateWindows, windowsBody, type AvailabilityWindow, type WindowRow } from '@/lib/horarios';
import { JanelasEditor } from './janelas-editor';

// Horário de funcionamento da casa (SPEC/2026-11-17-horario-de-funcionamento.md, RF-03).

type OpeningHours = { configured: boolean; windows: AvailabilityWindow[] };

const errorText = (caught: unknown, fallback: string) => (caught instanceof Error ? caught.message : fallback);

export function HorarioFuncionamento({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<WindowRow[] | null>(null);
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    storeRequest<OpeningHours>('/opening-hours')
      .then((hours) => { setRows(toRows(hours.windows)); setConfigured(hours.configured); })
      .catch((caught) => setError(errorText(caught, 'Não foi possível carregar o horário de funcionamento.')));
  }, []);

  async function save() {
    if (!rows) return;
    const invalid = validateWindows(rows);
    if (invalid) { setError(invalid); setMessage(''); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const saved = await storeRequest<OpeningHours>('/opening-hours', { method: 'PUT', body: JSON.stringify(windowsBody(rows)) });
      setRows(toRows(saved.windows));
      setConfigured(saved.configured);
      setMessage(saved.configured ? 'Pronto, horário de funcionamento salvo.' : 'Pronto: sem horário cadastrado, as reservas valem para qualquer horário.');
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível salvar o horário.'));
    } finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card horario-modal" role="dialog" aria-modal="true" aria-label="Horário de funcionamento">
        <div className="modal-heading"><div><div className="eyebrow">RESERVAS</div><h2>Horário de funcionamento</h2></div><button className="icon-button" onClick={onClose} aria-label="Fechar">×</button></div>
        <p className="opcoes-hint">
          {configured
            ? 'As reservas só são aceitas quando cabem inteiras numa janela do dia.'
            : 'Sem horário cadastrado, as reservas são aceitas em qualquer horário.'}
        </p>
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="opcoes-ok" role="status">{message}</p>}
        {rows && (
          <JanelasEditor
            rows={rows}
            onChange={setRows}
            onSave={() => void save()}
            busy={busy}
            emptyText="Nenhuma janela cadastrada."
            clearLabel="Sem horário"
            saveLabel="Salvar horário"
            listLabel="Janelas de funcionamento"
          />
        )}
      </div>
    </div>
  );
}

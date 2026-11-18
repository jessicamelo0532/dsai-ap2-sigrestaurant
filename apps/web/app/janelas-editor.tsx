'use client';

import { CirclePlus, Copy, Eraser, Save, Trash2 } from 'lucide-react';
import { newRow, repeatOnWorkdays, WEEKDAYS, type WindowRow } from '@/lib/horarios';

// Lista editável de janelas de dia e horário, usada pelos horários do cardápio
// (SPEC/2026-11-17-tela-de-horarios-do-cardapio.md) e pelo horário de funcionamento
// (SPEC/2026-11-17-horario-de-funcionamento.md).

type Props = {
  rows: WindowRow[];
  onChange: (rows: WindowRow[]) => void;
  onSave: () => void;
  busy: boolean;
  emptyText: string;
  clearLabel: string;
  saveLabel: string;
  listLabel?: string;
};

export function JanelasEditor({ rows, onChange, onSave, busy, emptyText, clearLabel, saveLabel, listLabel = 'Janelas de horário' }: Props) {
  const update = (index: number, change: Partial<WindowRow>) => onChange(rows.map((row, i) => (i === index ? { ...row, ...change } : row)));

  return (
    <>
      <div className="horarios-list" role="list" aria-label={listLabel}>
        {!rows.length && <small className="opcoes-hint">{emptyText}</small>}
        {rows.map((row, index) => (
          <div key={row.key} className="horarios-row" role="listitem">
            <select value={row.weekday} onChange={(e) => update(index, { weekday: Number(e.target.value) })} aria-label={`Dia da janela ${index + 1}`}>
              {WEEKDAYS.map((day, weekday) => <option key={day} value={weekday}>{day}</option>)}
            </select>
            <input value={row.start} onChange={(e) => update(index, { start: e.target.value })} placeholder="11:00" aria-label={`Início da janela ${index + 1}`} />
            <input value={row.end} onChange={(e) => update(index, { end: e.target.value })} placeholder="15:00" aria-label={`Fim da janela ${index + 1}`} />
            <button type="button" className="icon-button" onClick={() => onChange(repeatOnWorkdays(rows, index))} aria-label={`Repetir a janela ${index + 1} nos dias úteis`} title="Repetir nos dias úteis"><Copy size={15} /></button>
            <button type="button" className="icon-button danger" onClick={() => onChange(rows.filter((_, i) => i !== index))} aria-label={`Remover a janela ${index + 1}`}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>

      <div className="horarios-actions">
        <button type="button" className="button button-light" onClick={() => onChange([...rows, newRow()])}><CirclePlus size={15} />Incluir janela</button>
        <button type="button" className="button button-light" disabled={!rows.length} onClick={() => onChange([])}><Eraser size={15} />{clearLabel}</button>
        <button type="button" className="button button-dark" disabled={busy} onClick={onSave}><Save size={15} />{busy ? 'Salvando…' : saveLabel}</button>
      </div>
    </>
  );
}

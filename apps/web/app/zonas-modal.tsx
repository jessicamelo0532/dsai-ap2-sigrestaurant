'use client';

import { useState } from 'react';
import { Check, CirclePlus, Pencil, Trash2, X } from 'lucide-react';
import { storeRequest } from '@/lib/store';
import type { Table } from '@/lib/types';
import { deleteBlocker, duplicateZone, sortZones, tablesLabel, validateZoneName, ZONE_MESSAGES, type Zone } from '@/lib/zonas';

// Janela Zonas da tela Salão (SPEC/2026-11-17-zonas-do-salao.md, RF-08).

type Props = {
  zones: Zone[];
  tables: Table[];
  onClose: () => void;
  // Recarrega zonas e mesas depois de cada mudança.
  onChanged: () => void;
};

const errorText = (caught: unknown, fallback: string) => (caught instanceof Error ? caught.message : fallback);
const tableName = (number: number) => `Mesa ${String(number).padStart(2, '0')}`;

export function ZonasModal({ zones, tables, onClose, onChanged }: Props) {
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const ordered = sortZones(zones);
  const countOf = (zoneId: number) => tables.filter((table) => table.zoneId === zoneId).length;

  async function act(request: () => Promise<unknown>, success: string) {
    setBusy(true); setError(''); setMessage('');
    try {
      await request();
      setMessage(success);
      onChanged();
      return true;
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível alterar as zonas.'));
      return false;
    } finally { setBusy(false); }
  }

  // RN-01 e RN-02 antes de enviar, com as mesmas mensagens da API.
  function nameProblem(name: string, ignoreId?: number): string | null {
    const invalid = validateZoneName(name);
    if (invalid) return invalid;
    const same = duplicateZone(zones, name, ignoreId);
    return same ? ZONE_MESSAGES.duplicate(same.name) : null;
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const problem = nameProblem(newName);
    if (problem) { setError(problem); setMessage(''); return; }
    if (await act(() => storeRequest('/zones', { method: 'POST', body: JSON.stringify({ name: newName }) }), `Zona ${newName.trim()} criada.`)) setNewName('');
  }

  async function rename(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const problem = nameProblem(editing.name, editing.id);
    if (problem) { setError(problem); setMessage(''); return; }
    if (await act(() => storeRequest(`/zones/${editing.id}`, { method: 'PATCH', body: JSON.stringify({ name: editing.name }) }), 'Zona renomeada.')) setEditing(null);
  }

  function remove(zone: Zone) {
    const blocker = deleteBlocker(zone, zones, countOf(zone.id));
    if (blocker) { setError(blocker); setMessage(''); return; }
    if (!window.confirm(`Excluir a zona ${zone.name}?`)) return;
    void act(() => storeRequest(`/zones/${zone.id}`, { method: 'DELETE' }), `Zona ${zone.name} excluída.`);
  }

  function move(table: Table, zoneId: number) {
    const zone = zones.find((entry) => entry.id === zoneId);
    void act(() => storeRequest(`/tables/${table.id}`, { method: 'PATCH', body: JSON.stringify({ zoneId }) }), `${tableName(table.number)} foi para ${zone?.name ?? 'a zona escolhida'}.`);
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card zonas-modal" role="dialog" aria-modal="true" aria-label="Zonas do salão">
        <div className="modal-heading"><div><div className="eyebrow">SALÃO</div><h2>Zonas</h2></div><button className="icon-button" onClick={onClose} aria-label="Fechar">×</button></div>

        <form className="zonas-create" onSubmit={create}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex.: Varanda" aria-label="Nome da nova zona" />
          <button type="submit" className="button button-dark" disabled={busy}><CirclePlus size={16} />Criar zona</button>
        </form>

        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="zonas-ok" role="status">{message}</p>}

        <ul className="zonas-list" aria-label="Zonas">
          {ordered.map((zone) => (
            <li key={zone.id}>
              {editing?.id === zone.id ? (
                <form className="zonas-rename" onSubmit={rename}>
                  <input value={editing.name} onChange={(e) => setEditing({ id: zone.id, name: e.target.value })} aria-label={`Novo nome de ${zone.name}`} autoFocus />
                  <button type="submit" className="icon-button" disabled={busy} aria-label="Salvar nome"><Check size={16} /></button>
                  <button type="button" className="icon-button" onClick={() => setEditing(null)} aria-label="Cancelar"><X size={16} /></button>
                </form>
              ) : (
                <>
                  <span><strong>{zone.name}</strong><small>{tablesLabel(countOf(zone.id))}</small></span>
                  <span className="zonas-actions">
                    <button className="icon-button" disabled={busy} onClick={() => { setError(''); setEditing({ id: zone.id, name: zone.name }); }} aria-label={`Renomear ${zone.name}`}><Pencil size={15} /></button>
                    <button className="icon-button" disabled={busy} onClick={() => remove(zone)} aria-label={`Excluir ${zone.name}`}><Trash2 size={15} /></button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>

        {!!tables.length && (
          <div className="zonas-tables">
            <strong>Mesas</strong>
            <ul>
              {[...tables].sort((a, b) => a.number - b.number).map((table) => (
                <li key={table.id}>
                  <label htmlFor={`zona-mesa-${table.id}`}>{tableName(table.number)}</label>
                  <select id={`zona-mesa-${table.id}`} value={table.zoneId ?? ordered[0]?.id} disabled={busy} onChange={(e) => move(table, Number(e.target.value))}>
                    {ordered.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
                  </select>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

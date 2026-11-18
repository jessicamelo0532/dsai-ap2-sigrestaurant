'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, CirclePlus, Save, ServerOff, Trash2, Wifi } from 'lucide-react';
import { storeRequest } from '@/lib/store';
import type { MenuItem } from '@/lib/types';
import { moveRow, optionsBody, toRow, validateOptions, type MenuOptions, type OptionRow } from '@/lib/opcoes';

// Aba Opções do Cardápio (SPEC/2026-11-17-tela-de-variacoes-e-adicionais.md, RF-01 a RF-03).

type Props = {
  mode: 'api' | 'local';
  canConnect: boolean;
  onConnect: () => void;
  menu: MenuItem[];
};

const errorText = (caught: unknown, fallback: string) => (caught instanceof Error ? caught.message : fallback);
let counter = 0;
const newRow = (): OptionRow => ({ key: `n${++counter}`, name: '', price: '' });

export function OpcoesPanel({ mode, canConnect, onConnect, menu }: Props) {
  const [itemId, setItemId] = useState<number | null>(null);
  const [variants, setVariants] = useState<OptionRow[]>([]);
  const [addons, setAddons] = useState<OptionRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode !== 'api' || itemId === null) return;
    setLoaded(false); setError(''); setMessage('');
    storeRequest<MenuOptions>(`/menu-items/${itemId}/options`)
      .then((options) => {
        setVariants(options.variants.map(toRow));
        setAddons(options.addons.map(toRow));
        setLoaded(true);
      })
      .catch((caught) => setError(errorText(caught, 'Não foi possível carregar as opções.')));
  }, [mode, itemId]);

  if (mode === 'local') {
    return (
      <div className="panel kitchen-offline">
        <span className="kitchen-offline-icon"><ServerOff size={26} /></span>
        <strong>Variações e adicionais precisam do servidor</strong>
        <p>No modo navegador os dados ficam só neste aparelho. Conecte ao servidor para cadastrar tamanhos e adicionais.</p>
        {canConnect ? <button className="button button-dark" onClick={onConnect}><Wifi size={17} />Conectar ao servidor</button> : <small>Este build não tem endereço de API configurado (<code>NEXT_PUBLIC_API_URL</code>).</small>}
      </div>
    );
  }

  async function save() {
    const invalid = validateOptions(variants, addons);
    if (invalid) { setError(invalid); setMessage(''); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const saved = await storeRequest<MenuOptions>(`/menu-items/${itemId}/options`, { method: 'PUT', body: JSON.stringify(optionsBody(variants, addons)) });
      setVariants(saved.variants.map(toRow));
      setAddons(saved.addons.map(toRow));
      setMessage('Pronto, opções salvas.');
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível salvar as opções.'));
    } finally { setBusy(false); }
  }

  const item = menu.find((entry) => entry.id === itemId) ?? null;

  return (
    <div className="panel opcoes-panel">
      <label className="opcoes-item">Item do cardápio
        <select value={itemId ?? ''} onChange={(e) => setItemId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Escolha o item</option>
          {[...menu].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </select>
      </label>

      {!item && <p className="opcoes-hint">Escolha um item para cadastrar tamanhos (variações, cada uma com seu preço) e adicionais (somados ao preço).</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="opcoes-ok" role="status">{message}</p>}

      {item && loaded && (
        <>
          <OptionList
            title="Variações"
            hint={`Substituem o preço do item (${Number(item.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}). Se houver, o garçom escolhe uma ao lançar.`}
            rows={variants}
            ordered
            onChange={setVariants}
          />
          <OptionList
            title="Adicionais"
            hint="Somados ao preço. Podem ter preço zero."
            rows={addons}
            onChange={setAddons}
          />
          <div className="form-actions">
            <button className="button button-dark" disabled={busy} onClick={() => void save()}><Save size={16} />{busy ? 'Salvando…' : 'Salvar opções'}</button>
          </div>
        </>
      )}
    </div>
  );
}

function OptionList({ title, hint, rows, ordered = false, onChange }: { title: string; hint: string; rows: OptionRow[]; ordered?: boolean; onChange: (rows: OptionRow[]) => void }) {
  const update = (index: number, change: Partial<OptionRow>) => onChange(rows.map((row, i) => (i === index ? { ...row, ...change } : row)));
  return (
    <fieldset className="opcoes-list">
      <legend>{title}</legend>
      <small className="opcoes-hint">{hint}</small>
      {!rows.length && <small className="opcoes-hint">Nenhuma cadastrada.</small>}
      {rows.map((row, index) => (
        <div key={row.key} className="opcoes-row">
          <input value={row.name} onChange={(e) => update(index, { name: e.target.value })} placeholder="Nome" aria-label={`${title}: nome ${index + 1}`} />
          <input value={row.price} onChange={(e) => update(index, { price: e.target.value })} placeholder="0,00" inputMode="decimal" aria-label={`${title}: preço ${index + 1}`} />
          {ordered && <button type="button" className="icon-button" onClick={() => onChange(moveRow(rows, index, -1))} aria-label={`Subir ${row.name || `linha ${index + 1}`}`}><ArrowUp size={15} /></button>}
          {ordered && <button type="button" className="icon-button" onClick={() => onChange(moveRow(rows, index, 1))} aria-label={`Descer ${row.name || `linha ${index + 1}`}`}><ArrowDown size={15} /></button>}
          <button type="button" className="icon-button danger" onClick={() => onChange(rows.filter((_, i) => i !== index))} aria-label={`Remover ${row.name || `linha ${index + 1}`}`}><Trash2 size={15} /></button>
        </div>
      ))}
      <button type="button" className="button button-light" onClick={() => onChange([...rows, newRow()])}><CirclePlus size={15} />Incluir {title === 'Variações' ? 'variação' : 'adicional'}</button>
    </fieldset>
  );
}

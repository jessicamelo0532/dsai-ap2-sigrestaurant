'use client';

import { useEffect, useRef, useState } from 'react';
import { storeRequest } from '@/lib/store';
import type { MenuItem } from '@/lib/types';
import { formatCents, hasOptions, launchBody, linePrice, toggleAddon, validateChoice, type MenuOptions } from '@/lib/opcoes';

// Escolha de variação e adicionais ao lançar (SPEC/2026-11-17-tela-de-variacoes-e-adicionais.md, RF-04 e RF-05).

type Props = {
  item: MenuItem;
  tableId?: number;
  quantity: number;
  // SPEC/2026-11-25-tela-de-delivery.md: a mesma escolha lança em outra rota (pedido de delivery).
  launchPath?: string;
  eyebrow?: string;
  doneMessage?: string;
  onDone: (message: string) => void;
  onCancel: () => void;
};

const errorText = (caught: unknown, fallback: string) => (caught instanceof Error ? caught.message : fallback);

export function EscolherOpcoes({ item, tableId, quantity, launchPath, eyebrow = 'LANÇAR NA COMANDA', doneMessage = 'Pronto, item lançado na comanda.', onDone, onCancel }: Props) {
  const endpoint = launchPath ?? `/tables/${tableId}/items`;
  const [options, setOptions] = useState<MenuOptions | null>(null);
  const [variantId, setVariantId] = useState<number | null>(null);
  const [addonIds, setAddonIds] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  async function launch(body: ReturnType<typeof launchBody>) {
    setBusy(true); setError('');
    try {
      await storeRequest(endpoint, { method: 'POST', body: JSON.stringify(body) });
      onDone(doneMessage);
    } catch (caught) {
      setError(errorText(caught, 'Não foi possível lançar o item.'));
    } finally { setBusy(false); }
  }

  // RF-04: sem opções, lança direto como antes.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    storeRequest<MenuOptions>(`/menu-items/${item.id}/options`)
      .then((loaded) => {
        if (!hasOptions(loaded)) { void launch(launchBody(item.id, quantity, null, [])); return; }
        setOptions(loaded);
      })
      .catch(() => { void launch(launchBody(item.id, quantity, null, [])); });
  }, []);

  if (!options) {
    return error
      ? <div className="modal-backdrop"><div className="modal-card" role="alertdialog" aria-label="Erro ao lançar"><p className="form-error" role="alert">{error}</p><div className="form-actions"><button className="button button-light" onClick={onCancel}>Fechar</button></div></div></div>
      : null;
  }

  const price = linePrice(item.price, options, variantId, addonIds, quantity);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const invalid = validateChoice(item.name, options!, variantId, addonIds);
    if (invalid) { setError(invalid); return; }
    void launch(launchBody(item.id, quantity, variantId, addonIds));
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={`Opções de ${item.name}`}>
        <div className="modal-heading"><div><div className="eyebrow">{eyebrow}</div><h2>{item.name}</h2></div><button className="icon-button" onClick={onCancel} aria-label="Fechar">×</button></div>
        <form className="modal-form escolha-form" onSubmit={submit}>
          {!!options.variants.length && (
            <fieldset className="escolha-group">
              <legend>Variação (escolha uma)</legend>
              {options.variants.map((variant) => (
                <label key={variant.id} className="escolha-option">
                  <input type="radio" name="variacao" checked={variantId === variant.id} onChange={() => setVariantId(variant.id)} />
                  <span>{variant.name}</span><b>{formatCents(Math.round(Number(variant.price) * 100))}</b>
                </label>
              ))}
            </fieldset>
          )}
          {!!options.addons.length && (
            <fieldset className="escolha-group">
              <legend>Adicionais (opcional)</legend>
              {options.addons.map((addon) => (
                <label key={addon.id} className="escolha-option">
                  <input type="checkbox" checked={addonIds.includes(addon.id)} onChange={() => setAddonIds((ids) => toggleAddon(ids, addon.id))} />
                  <span>{addon.name}</span><b>+ {formatCents(Math.round(Number(addon.price) * 100))}</b>
                </label>
              ))}
            </fieldset>
          )}
          <p className="escolha-total" aria-label="Preço da linha">
            <span>{quantity} × {formatCents(price.unitCents)}</span><strong>{formatCents(price.totalCents)}</strong>
          </p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions">
            <button type="button" className="button button-light" onClick={onCancel}>Cancelar</button>
            <button type="submit" className="button button-dark" disabled={busy}>{busy ? 'Lançando…' : 'Lançar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

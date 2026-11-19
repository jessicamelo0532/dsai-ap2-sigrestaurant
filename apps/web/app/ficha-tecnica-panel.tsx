'use client';

import { useCallback, useEffect, useState } from 'react';
import { CirclePlus, Pencil, ServerOff, Trash2, Wifi } from 'lucide-react';
import { money, storeRequest } from '@/lib/store';
import type { Ingredient, IngredientUnit, MenuItem, RecipeLine, RecipeView } from '@/lib/types';
import {
  costCents, findIngredientDuplicate, formatMargin, INGREDIENT_IN_USE, INGREDIENT_UNITS,
  ingredientName, marginPercent, recipeCostCents, RECIPE_DUPLICATE, unitLabel, validateCost,
  validateIngredientName, validateQuantity, validateRecipe, validateUnit,
} from '@/lib/ficha-tecnica';

type FichaTecnicaPanelProps = {
  menu: MenuItem[];
  mode: 'api' | 'local';
  canConnect: boolean;
  onConnect: () => void;
  onChanged?: () => void;
};

// Aba Ficha técnica do cardápio (SPEC/2026-11-19-ficha-tecnica-e-margem.md).
// Só desenha: as regras puras estão em lib/ficha-tecnica.ts e no local-store.
export function FichaTecnicaPanel({ menu, mode, canConnect, onConnect, onChanged }: FichaTecnicaPanelProps) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(menu[0]?.id ?? null);
  const [lines, setLines] = useState<RecipeLine[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<IngredientUnit>('UN');
  const [cost, setCost] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [recipeIngredientId, setRecipeIngredientId] = useState('');
  const [recipeQuantity, setRecipeQuantity] = useState('1');

  const selectedItem = menu.find((item) => item.id === selectedMenuId) ?? null;

  const loadIngredients = useCallback(async () => {
    try {
      setIngredients(await storeRequest<Ingredient[]>('/ingredients'));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar os ingredientes.');
    }
  }, []);

  const loadRecipe = useCallback(async (menuItemId: number | null) => {
    if (!menuItemId) {
      setLines([]);
      return;
    }
    try {
      const view = await storeRequest<RecipeView>(`/menu-items/${menuItemId}/recipe`);
      setLines(view.items.map(({ ingredientId, quantity }) => ({ ingredientId, quantity })));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar a ficha técnica.');
    }
  }, []);

  useEffect(() => {
    if (mode === 'local') void loadIngredients();
  }, [mode, loadIngredients]);

  useEffect(() => {
    if (mode === 'local') void loadRecipe(selectedMenuId);
  }, [mode, selectedMenuId, loadRecipe]);

  if (mode !== 'local') {
    return (
      <div className="panel kitchen-offline">
        <span className="kitchen-offline-icon"><ServerOff size={26} /></span>
        <strong>Ficha técnica no modo navegador</strong>
        <p>
          A API de estoque já tem ingredientes e receita, mas ainda não tem custo por ingrediente nem margem.
          Use o modo navegador para cadastrar o custo manual e ver a margem do prato.
        </p>
        {canConnect
          ? <button className="button button-dark" onClick={onConnect}><Wifi size={17} />Conectar ao servidor</button>
          : <small>Este build não tem endereço de API configurado (<code>NEXT_PUBLIC_API_URL</code>).</small>}
      </div>
    );
  }

  const liveCost = recipeCostCents(lines, ingredients);
  const liveMargin = selectedItem ? marginPercent(costCents(selectedItem.price), liveCost) : null;

  async function send(action: () => Promise<unknown>, success?: string): Promise<boolean> {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      await loadIngredients();
      if (success) setMessage(success);
      onChanged?.();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível concluir a ação.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submitIngredient(event: React.FormEvent) {
    event.preventDefault();
    const cleanName = ingredientName(name);
    const invalid = validateIngredientName(cleanName) ?? validateUnit(unit) ?? validateCost(cost);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (findIngredientDuplicate(ingredients, cleanName, editingId ?? undefined)) {
      setError('Já existe um ingrediente com esse nome.');
      return;
    }
    const body = { name: cleanName, unit, cost: Number(cost.replace(',', '.')).toFixed(2) };
    const ok = await send(
      () => editingId === null
        ? storeRequest('/ingredients', { method: 'POST', body: JSON.stringify(body) })
        : storeRequest(`/ingredients/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) }),
      editingId === null ? 'Ingrediente cadastrado.' : 'Ingrediente atualizado.',
    );
    if (ok) {
      setName('');
      setUnit('UN');
      setCost('');
      setEditingId(null);
    }
  }

  function startEdit(ingredient: Ingredient) {
    setName(ingredient.name);
    setUnit(ingredient.unit);
    setCost(ingredient.cost);
    setEditingId(ingredient.id);
    setError('');
    setMessage('');
  }

  function cancelEdit() {
    setName('');
    setUnit('UN');
    setCost('');
    setEditingId(null);
  }

  function removeIngredient(ingredient: Ingredient) {
    if ((ingredient.usage ?? 0) > 0) {
      setError(INGREDIENT_IN_USE);
      return;
    }
    if (!window.confirm(`Remover o ingrediente “${ingredient.name}”?`)) return;
    void send(() => storeRequest(`/ingredients/${ingredient.id}`, { method: 'DELETE' }), 'Ingrediente removido.');
  }

  function addLine(event: React.FormEvent) {
    event.preventDefault();
    const ingredientId = Number(recipeIngredientId);
    if (!ingredientId) {
      setError('Escolha um ingrediente da lista.');
      return;
    }
    if (lines.some((line) => line.ingredientId === ingredientId)) {
      setError(RECIPE_DUPLICATE);
      return;
    }
    const invalid = validateQuantity(recipeQuantity);
    if (invalid) {
      setError(invalid);
      return;
    }
    setLines([...lines, { ingredientId, quantity: Number(recipeQuantity.replace(',', '.')) }]);
    setRecipeIngredientId('');
    setRecipeQuantity('1');
    setError('');
    setMessage('');
  }

  async function saveRecipe() {
    if (!selectedMenuId) return;
    const invalid = validateRecipe(lines, ingredients);
    if (invalid) {
      setError(invalid);
      return;
    }
    const ok = await send(
      () => storeRequest(`/menu-items/${selectedMenuId}/recipe`, {
        method: 'PUT',
        body: JSON.stringify({ items: lines }),
      }),
      'Ficha técnica salva.',
    );
    if (ok) await loadRecipe(selectedMenuId);
  }

  return (
    <div className="panel ficha-tecnica-panel">
      <div className="menu-toolbar">
        <div>
          <h2>Ficha técnica <span className="count-pill">{ingredients.length}</span></h2>
          <p>Cadastre o custo dos ingredientes e monte a receita de cada prato.</p>
        </div>
        <span className="count-pill">Margem sobre o preço de venda</span>
      </div>

      {error && <div className="kitchen-error" role="alert">{error}</div>}
      {message && <div className="kitchen-message" role="status">{message}</div>}

      <div className="finance-columns">
        <div className="panel">
          <div className="panel-heading"><div><h2>Ingredientes</h2><p>Custo por unidade informado manualmente.</p></div></div>
          <form className="modal-form" onSubmit={submitIngredient}>
            <label>Nome<input autoFocus required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Queijo mussarela" /></label>
            <div className="form-two">
              <label>Unidade<select value={unit} onChange={(event) => setUnit(event.target.value as IngredientUnit)}>{INGREDIENT_UNITS.map((value) => <option key={value} value={value}>{value} — {unitLabel(value)}</option>)}</select></label>
              <label>Custo (R$)<input required type="number" min="0" step="0.01" value={cost} onChange={(event) => setCost(event.target.value)} placeholder="0,00" /></label>
            </div>
            <div className="form-actions">
              {editingId !== null && <button type="button" className="button button-light" onClick={cancelEdit}>Cancelar</button>}
              <button className="button button-dark" type="submit" disabled={busy}><CirclePlus size={16} />{editingId === null ? 'Adicionar ingrediente' : 'Salvar ingrediente'}</button>
            </div>
          </form>
          <div className="expense-list">
            {ingredients.map((ingredient) => (
              <div className="expense-row" key={ingredient.id}>
                <span className="expense-copy"><strong>{ingredient.name}</strong><small>{unitLabel(ingredient.unit)} · {ingredient.usage ?? 0} ficha(s)</small></span>
                <b>{money(Number(ingredient.cost))}</b>
                <button className="icon-button" aria-label={`Editar ${ingredient.name}`} onClick={() => startEdit(ingredient)}><Pencil size={15} /></button>
                <button className="icon-button danger" aria-label={`Remover ${ingredient.name}`} disabled={busy || (ingredient.usage ?? 0) > 0} onClick={() => removeIngredient(ingredient)}><Trash2 size={15} /></button>
              </div>
            ))}
            {!ingredients.length && <div className="empty-state compact"><strong>Nenhum ingrediente cadastrado</strong><span>Comece pelo que você compra toda semana.</span></div>}
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading"><div><h2>Receita do prato</h2><p>Quantidade de cada ingrediente por porção.</p></div></div>
          <label>Item do cardápio<select value={selectedMenuId ?? ''} onChange={(event) => setSelectedMenuId(Number(event.target.value) || null)}>{menu.map((item) => <option key={item.id} value={item.id}>{item.name} — {money(Number(item.price))}</option>)}</select></label>
          {!menu.length && <div className="empty-state compact"><strong>Nenhum item no cardápio</strong><span>Cadastre um prato para montar a ficha.</span></div>}
          {selectedItem && <>
            <div className="order-total"><span>Custo do prato</span><strong>{money(liveCost / 100)}</strong></div>
            <div className="order-total"><span>Margem</span><strong>{formatMargin(liveMargin)}</strong></div>
            <form className="modal-form" onSubmit={addLine}>
              <label>Ingrediente<select value={recipeIngredientId} onChange={(event) => setRecipeIngredientId(event.target.value)}><option value="">Escolha um ingrediente</option>{ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name} ({ingredient.unit})</option>)}</select></label>
              <label>Quantidade<input type="number" min="0.001" step="0.001" value={recipeQuantity} onChange={(event) => setRecipeQuantity(event.target.value)} /></label>
              <div className="form-actions"><button className="button button-light" type="submit" disabled={busy}><CirclePlus size={16} />Adicionar à ficha</button></div>
            </form>
            <div className="order-lines">
              {lines.map((line) => {
                const ingredient = ingredients.find((entry) => entry.id === line.ingredientId);
                return (
                  <div className="order-line" key={line.ingredientId}>
                    <div className="line-copy"><strong>{ingredient?.name ?? 'Ingrediente'}</strong><small>{line.quantity} × {money(Number(ingredient?.cost ?? 0))}</small></div>
                    <button className="line-remove" aria-label={`Remover ${ingredient?.name ?? 'ingrediente'} da ficha`} onClick={() => setLines(lines.filter((entry) => entry.ingredientId !== line.ingredientId))}><Trash2 size={14} /></button>
                  </div>
                );
              })}
              {!lines.length && <div className="empty-order-copy">Nenhum ingrediente na ficha deste prato.</div>}
            </div>
            <button className="button button-dark" disabled={busy} onClick={() => void saveRecipe()}>Salvar ficha técnica</button>
          </>}
        </div>
      </div>
    </div>
  );
}

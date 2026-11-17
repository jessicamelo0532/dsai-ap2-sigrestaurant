'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, CirclePlus, Layers, Pencil, ServerOff, Sparkles, Trash2, Wifi } from 'lucide-react';
import { storeRequest } from '@/lib/store';
import {
  canDelete, canMove, categoryName, findDuplicate, importMessage, itemCountLabel, moveCategory,
  sortCategories, summarizeCategories, validateCategoryName, DUPLICATE_NAME, EMPTY_LIST,
  type ImportResult, type MenuCategory,
} from '@/lib/categorias';

// Aba Categorias do cardápio (SPEC/2026-11-17-tela-de-categorias.md).
// Só desenha: as regras puras estão em lib/categorias.ts e na API.

type CategoriasPanelProps = {
  mode: 'api' | 'local';
  canConnect: boolean;
  onConnect: () => void;
  onChanged?: () => void;
};

export function CategoriasPanel({ mode, canConnect, onConnect, onChanged }: CategoriasPanelProps) {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [formError, setFormError] = useState('');
  const [editing, setEditing] = useState<MenuCategory | null>(null);
  const [editName, setEditName] = useState('');

  const load = useCallback(async () => {
    if (mode !== 'api') return;
    try {
      setCategories(sortCategories(await storeRequest<MenuCategory[]>('/menu-categories')));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar as categorias.');
    }
  }, [mode]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = summarizeCategories(categories);

  async function send(action: () => Promise<unknown>, success?: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      await load();
      onChanged?.();
      if (success) setMessage(success);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível concluir a ação.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submitCreate(event: React.FormEvent) {
    event.preventDefault();
    const invalid = validateCategoryName(name);
    if (invalid) {
      setFormError(invalid);
      return;
    }
    if (findDuplicate(categories, name)) {
      setFormError(DUPLICATE_NAME);
      return;
    }
    const created = await send(
      () => storeRequest('/menu-categories', { method: 'POST', body: JSON.stringify({ name: categoryName(name) }) }),
      'Pronto, categoria criada.',
    );
    if (created) {
      setName('');
      setFormError('');
    }
  }

  async function submitRename(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const invalid = validateCategoryName(editName);
    if (invalid) {
      setFormError(invalid);
      return;
    }
    if (findDuplicate(categories, editName, editing.id)) {
      setFormError(DUPLICATE_NAME);
      return;
    }
    const ok = await send(
      () => storeRequest(`/menu-categories/${editing.id}`, { method: 'PATCH', body: JSON.stringify({ name: categoryName(editName) }) }),
      'Pronto, categoria renomeada.',
    );
    if (ok) {
      setEditing(null);
      setFormError('');
    }
  }

  function move(id: number, direction: 'up' | 'down') {
    if (!canMove(categories, id, direction)) return;
    const ids = moveCategory(categories, id, direction);
    void send(
      () => storeRequest('/menu-categories/order', { method: 'PUT', body: JSON.stringify({ ids }) }),
      'Pronto, ordem atualizada.',
    );
  }

  function remove(category: MenuCategory) {
    if (!canDelete(category)) return;
    void send(() => storeRequest(`/menu-categories/${category.id}`, { method: 'DELETE' }), 'Pronto, categoria apagada.');
  }

  async function importFromItems() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await storeRequest<ImportResult>('/menu-categories/import', { method: 'POST' });
      setMessage(importMessage(result));
      await load();
      onChanged?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível importar as categorias.');
    } finally {
      setBusy(false);
    }
  }

  // RF-08: categorias cadastradas só existem no modo servidor.
  if (mode === 'local') {
    return (
      <div className="panel kitchen-offline">
        <span className="kitchen-offline-icon"><ServerOff size={26} /></span>
        <strong>Categorias precisam do servidor</strong>
        <p>
          No modo navegador o cardápio usa a categoria como texto livre em cada item. Conecte ao servidor para
          cadastrar categorias, definir a ordem e ligar os itens.
        </p>
        {canConnect
          ? <button className="button button-dark" onClick={onConnect}><Wifi size={17} />Conectar ao servidor</button>
          : <small>Este build não tem endereço de API configurado (<code>NEXT_PUBLIC_API_URL</code>).</small>}
      </div>
    );
  }

  return (
    <div className="panel categorias-panel">
      <div className="menu-toolbar">
        <div>
          <h2>Categorias <span className="count-pill">{summary.total}</span></h2>
          <p>A ordem daqui é a ordem em que o cardápio aparece para a equipe.</p>
        </div>
        <button className="button button-light" onClick={() => void importFromItems()} disabled={busy}>
          <Sparkles size={16} />Importar dos itens
        </button>
      </div>

      {error && <div className="kitchen-error" role="alert">{error}</div>}
      {message && <div className="kitchen-message" role="status">{message}</div>}

      <div className="categoria-summary">
        <span className="count-pill">{summary.total} categorias</span>
        <span className="count-pill">{itemCountLabel(summary.linkedItems)} ligados</span>
        <span className="count-pill">{summary.empty} sem itens</span>
      </div>

      <form className="categoria-create" onSubmit={submitCreate}>
        <label>
          Nova categoria
          <input
            value={name}
            onChange={(event) => { setName(event.target.value); setFormError(''); }}
            maxLength={51}
            placeholder="Ex.: Sobremesas"
          />
        </label>
        <button type="submit" className="button button-dark" disabled={busy}><CirclePlus size={16} />Criar</button>
      </form>
      {formError && !editing && <p className="form-error" role="alert">{formError}</p>}

      {!categories.length && !error && (
        <div className="empty-state compact">
          <Layers size={22} />
          <strong>{EMPTY_LIST}</strong>
          <span>Crie a primeira categoria ou importe dos itens do cardápio.</span>
        </div>
      )}

      <div className="categoria-list">
        {categories.map((category, index) => (
          <div className="categoria-row" key={category.id}>
            {editing?.id === category.id ? (
              <form className="categoria-rename" onSubmit={submitRename}>
                <input
                  autoFocus
                  value={editName}
                  onChange={(event) => { setEditName(event.target.value); setFormError(''); }}
                  maxLength={51}
                  aria-label={`Novo nome para ${category.name}`}
                />
                <button type="submit" className="button button-dark" disabled={busy}>Salvar</button>
                <button type="button" className="button button-light" onClick={() => { setEditing(null); setFormError(''); }}>Cancelar</button>
              </form>
            ) : (
              <span className="categoria-copy">
                <strong>{category.name}</strong>
                <small>{itemCountLabel(category.itemCount ?? 0)}</small>
              </span>
            )}
            {editing?.id !== category.id && (
              <span className="categoria-actions">
                <button
                  className="icon-button"
                  aria-label={`Mover ${category.name} para cima`}
                  disabled={busy || !canMove(categories, category.id, 'up')}
                  onClick={() => move(category.id, 'up')}
                ><ArrowUp size={16} /></button>
                <button
                  className="icon-button"
                  aria-label={`Mover ${category.name} para baixo`}
                  disabled={busy || !canMove(categories, category.id, 'down')}
                  onClick={() => move(category.id, 'down')}
                ><ArrowDown size={16} /></button>
                <button
                  className="icon-button"
                  aria-label={`Renomear ${category.name}`}
                  disabled={busy}
                  onClick={() => { setEditing(category); setEditName(category.name); setFormError(''); }}
                ><Pencil size={16} /></button>
                <button
                  className="icon-button danger"
                  aria-label={`Apagar ${category.name}`}
                  disabled={busy || !canDelete(category)}
                  onClick={() => remove(category)}
                ><Trash2 size={16} /></button>
              </span>
            )}
            <span className="categoria-position">{index + 1}º</span>
          </div>
        ))}
      </div>
      {formError && editing && <p className="form-error" role="alert">{formError}</p>}
    </div>
  );
}

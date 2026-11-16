'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Clock3, Plus } from 'lucide-react';
import { money } from '@/lib/store';
import {
  buildFloor, filterCounts, filterFloor, FLOOR_REFRESH_MS, formatElapsed, summarizeFloor,
  type FloorFilter, type FloorTable,
} from '@/lib/salao';
import type { Table } from '@/lib/types';

// Visão do salão (SPEC/2026-11-16-visao-do-salao.md). Só desenha: a lógica está em lib/salao.ts.

const FILTERS: { id: FloorFilter; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'ocupadas', label: 'Ocupadas' },
  { id: 'livres', label: 'Livres' },
];

const cents = (value: number) => money(value / 100);
const tableName = (number: number) => `Mesa ${String(number).padStart(2, '0')}`;
const clock = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const sinceText = (minutes: number) => (minutes < 1 ? 'agora mesmo' : `há ${formatElapsed(minutes)}`);
const itemsText = (count: number) => (count === 1 ? '1 item' : `${count} itens`);

type SalaoPanelProps = {
  tables: Table[];
  onOpenTable: (tableId: number) => void;
  onRefresh: () => void;
};

export function SalaoPanel({ tables, onOpenTable, onRefresh }: SalaoPanelProps) {
  const [filter, setFilter] = useState<FloorFilter>('todas');
  const [now, setNow] = useState(() => new Date());

  // RF-09: atualiza os dados e o relógio enquanto a tela está aberta.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
      onRefresh();
    }, FLOOR_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [onRefresh]);

  const floor = useMemo(() => buildFloor(tables, now), [tables, now]);
  const summary = summarizeFloor(floor);
  const counts = filterCounts(floor);
  const visible = filterFloor(floor, filter);

  return (
    <section className="page-section floor">
      <div className="page-heading">
        <div>
          <div className="eyebrow">SALÃO AGORA</div>
          <h1>Salão</h1>
          <p>Mesas ocupadas, o que cada uma pediu e as contas em aberto.</p>
        </div>
        <span className="floor-live"><i />Atualiza sozinho a cada {FLOOR_REFRESH_MS / 1000} s</span>
      </div>

      <div className="floor-summary">
        <div className="floor-stat"><span>Mesas ocupadas</span><strong>{summary.occupied} de {summary.tables}</strong><small>{summary.free} livres</small></div>
        <div className="floor-stat"><span>Contas abertas</span><strong>{summary.occupied}</strong><small>em atendimento</small></div>
        <div className="floor-stat"><span>Total em aberto</span><strong>{cents(summary.openTotalCents)}</strong><small>a receber no salão</small></div>
        <div className="floor-stat">
          <span>Conta mais antiga</span>
          <strong>{summary.oldest ? tableName(summary.oldest.number) : '—'}</strong>
          <small>{summary.oldest ? `aberta ${sinceText(summary.oldest.minutesOpen)}` : 'nenhuma conta aberta'}</small>
        </div>
      </div>

      <div className="floor-filters" role="group" aria-label="Filtrar mesas">
        {FILTERS.map((option) => (
          <button key={option.id} className="floor-filter" aria-pressed={filter === option.id} onClick={() => setFilter(option.id)}>
            {option.label}<b>{counts[option.id]}</b>
          </button>
        ))}
      </div>

      <div className="floor-grid">
        {visible.map((table) => (table.orderId
          ? <OccupiedCard key={table.id} table={table} onOpen={() => onOpenTable(table.id)} />
          : <FreeCard key={table.id} table={table} onOpen={() => onOpenTable(table.id)} />))}
        {!visible.length && (
          <div className="empty-state">
            <strong>{tables.length ? 'Nenhuma mesa neste filtro' : 'O salão está vazio'}</strong>
            <span>{tables.length ? 'Escolha outro filtro para ver as mesas.' : 'Adicione mesas na Visão geral.'}</span>
          </div>
        )}
      </div>
    </section>
  );
}

function OccupiedCard({ table, onOpen }: { table: FloorTable; onOpen: () => void }) {
  return (
    <article className="floor-card busy" aria-label={`${tableName(table.number)}, ocupada`}>
      <header><strong>{tableName(table.number)}</strong><span className="floor-badge">Conta aberta</span></header>
      <p className="floor-meta"><Clock3 size={15} />Aberta às {clock(table.openedAt!)} · {sinceText(table.minutesOpen ?? 0)}</p>
      <ul className="floor-lines">
        {table.lines.map((line) => (
          <li key={`${line.name}-${line.unitPriceCents}`}>
            <span className="floor-qty">{line.quantity}×</span>
            <span className="floor-name">{line.name}</span>
            <span className="floor-sub">{cents(line.subtotalCents)}</span>
          </li>
        ))}
      </ul>
      <footer><span>{itemsText(table.itemCount)} · {table.capacity} lugares</span><strong>{cents(table.totalCents)}</strong></footer>
      <button className="button button-dark floor-action" onClick={onOpen}>Ver comanda <ArrowUpRight size={16} /></button>
    </article>
  );
}

function FreeCard({ table, onOpen }: { table: FloorTable; onOpen: () => void }) {
  return (
    <article className="floor-card free" aria-label={`${tableName(table.number)}, livre`}>
      <span className="floor-free-copy"><strong>{tableName(table.number)}</strong><span>Livre · {table.capacity} lugares</span></span>
      <button className="button button-light floor-action" onClick={onOpen}><Plus size={16} />Lançar pedido</button>
    </article>
  );
}

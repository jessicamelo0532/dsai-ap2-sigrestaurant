'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Clock3, Map as MapIcon, Plus, QrCode } from 'lucide-react';
import { money, storeRequest } from '@/lib/store';
import {
  buildFloor, filterCounts, filterFloor, FLOOR_REFRESH_MS, formatElapsed, summarizeFloor,
  type FloorFilter, type FloorTable,
} from '@/lib/salao';
import type { Table } from '@/lib/types';
import { filterByZone, groupByZone, occupancyLabel, sortZones, type Zone, type ZoneFilter } from '@/lib/zonas';
import { ZonasModal } from './zonas-modal';
import { QrMesas } from './qr-mesas';

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
  // Zonas (SPEC/2026-11-17-zonas-do-salao.md, RF-07 e RF-08). Sem zonas, a tela fica como antes.
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneFilter, setZoneFilter] = useState<ZoneFilter>('todas');
  const [showZones, setShowZones] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const loadZones = useCallback(() => {
    storeRequest<Zone[]>('/zones').then((list) => setZones(Array.isArray(list) ? list : [])).catch(() => setZones([]));
  }, []);

  useEffect(() => { loadZones(); }, [loadZones, tables]);

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
  const zoneById = new Map(tables.map((table) => [table.id, table.zoneId]));
  const zoned = floor.map((table) => ({ ...table, zoneId: zoneById.get(table.id) }));
  const visible = filterByZone(filterFloor(zoned, filter), zoneFilter);
  const groups = zones.length > 1 || zoneFilter !== 'todas' ? groupByZone(zones, visible).filter((group) => group.tables.length) : [];
  const card = (table: FloorTable) => (table.orderId
    ? <OccupiedCard key={table.id} table={table} onOpen={() => onOpenTable(table.id)} />
    : <FreeCard key={table.id} table={table} onOpen={() => onOpenTable(table.id)} />);

  return (
    <section className="page-section floor">
      <div className="page-heading">
        <div>
          <div className="eyebrow">SALÃO AGORA</div>
          <h1>Salão</h1>
          <p>Mesas ocupadas, o que cada uma pediu e as contas em aberto.</p>
        </div>
        <div className="floor-heading-actions">
          <span className="floor-live"><i />Atualiza sozinho a cada {FLOOR_REFRESH_MS / 1000} s</span>
          {!!zones.length && <button className="button button-light" onClick={() => setShowZones(true)}><MapIcon size={16} />Zonas</button>}
          {!!tables.length && <button className="button button-light" onClick={() => setShowQr(true)}><QrCode size={16} />QR das mesas</button>}
        </div>
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

      {zones.length > 1 && (
        <div className="floor-filters zone-filters" role="group" aria-label="Filtrar por zona">
          <button className="floor-filter" aria-pressed={zoneFilter === 'todas'} onClick={() => setZoneFilter('todas')}>Todas as zonas</button>
          {sortZones(zones).map((zone) => (
            <button key={zone.id} className="floor-filter" aria-pressed={zoneFilter === zone.id} onClick={() => setZoneFilter(zone.id)}>{zone.name}</button>
          ))}
        </div>
      )}

      {groups.map((group) => (
        <section key={group.zone.id} className="zone-group" aria-label={`Zona ${group.zone.name}`}>
          <header className="zone-heading"><strong>{group.zone.name}</strong><span>{occupancyLabel(group.occupied, group.tables.length)}</span></header>
          <div className="floor-grid">{group.tables.map(card)}</div>
        </section>
      ))}

      <div className="floor-grid">
        {!groups.length && visible.map(card)}
        {!visible.length && (
          <div className="empty-state">
            <strong>{tables.length ? 'Nenhuma mesa neste filtro' : 'O salão está vazio'}</strong>
            <span>{tables.length ? 'Escolha outro filtro para ver as mesas.' : 'Adicione mesas na Visão geral.'}</span>
          </div>
        )}
      </div>

      {showZones && <ZonasModal zones={zones} tables={tables} onClose={() => setShowZones(false)} onChanged={() => { loadZones(); onRefresh(); }} />}
      {showQr && <QrMesas tables={tables} origin={window.location.origin} onClose={() => setShowQr(false)} />}
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

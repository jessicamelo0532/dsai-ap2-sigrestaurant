'use client';

import { useMemo, useState } from 'react';
import { CalendarRange, TrendingDown, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { money } from '@/lib/store';
import { centsOf, formatShare, share, type SalesReport } from '@/lib/sales-report';

type Props = { report: SalesReport };
type Metric = 'revenue' | 'orders';

const count = (value: number) => value.toLocaleString('pt-BR');
const shortDate = (date: string) => {
  const [, month, day] = date.split('-');
  return `${day}/${month}`;
};

function chartGeometry(report: SalesReport, metric: Metric) {
  const values = report.byDay.map((day) => (metric === 'revenue' ? centsOf(day.revenue) : day.orders));
  const max = Math.max(...values, 1);
  const width = 640;
  const height = 180;
  const left = 42;
  const right = 16;
  const top = 18;
  const bottom = 34;
  const innerWidth = width - left - right;
  const innerHeight = height - top - bottom;
  const points = values.map((value, index) => {
    const x = values.length === 1 ? left + innerWidth / 2 : left + (index / (values.length - 1)) * innerWidth;
    const y = top + innerHeight - (value / max) * innerHeight;
    return { x, y, value, day: report.byDay[index] };
  });
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const area = points.length
    ? `${line} L${points[points.length - 1].x.toFixed(1)} ${top + innerHeight} L${points[0].x.toFixed(1)} ${top + innerHeight} Z`
    : '';
  return { points, line, area, max, width, height, left, right, top, bottom, innerHeight };
}

export function RelatorioEvolucaoDiaria({ report }: Props) {
  const [metric, setMetric] = useState<Metric>('revenue');
  const [page, setPage] = useState(1);
  const pageSize = 7;
  const totalPages = Math.ceil(report.byDay.length / pageSize);
  const pagedDays = report.byDay.slice((page - 1) * pageSize, page * pageSize);
  const geometry = useMemo(() => chartGeometry(report, metric), [report, metric]);
  const totalCents = centsOf(report.revenue);
  const best = useMemo(
    () => [...report.byDay].sort((a, b) => centsOf(b.revenue) - centsOf(a.revenue))[0],
    [report.byDay],
  );
  const weakest = useMemo(
    () => [...report.byDay].sort((a, b) => centsOf(a.revenue) - centsOf(b.revenue))[0],
    [report.byDay],
  );

  if (!report.byDay.length) {
    return (
      <div className="report-block report-daily-empty">
        <CalendarRange size={26} />
        <strong>Nenhuma venda no período</strong>
        <span>Feche uma conta para acompanhar a evolução diária.</span>
      </div>
    );
  }

  const labelEvery = Math.max(1, Math.ceil(geometry.points.length / 7));

  return (
    <div className="report-daily" aria-label="Evolução diária das vendas">
      <div className="report-block-head report-daily-head">
        <div>
          <div className="eyebrow">EVOLUÇÃO DIÁRIA</div>
          <h3>Como as vendas caminharam</h3>
          <p>Receita e contas pagas por dia, no horário de Belém (UTC−3).</p>
        </div>
        <div className="report-toggle" role="group" aria-label="Métrica da evolução diária">
          <button type="button" aria-pressed={metric === 'revenue'} onClick={() => setMetric('revenue')}>Receita</button>
          <button type="button" aria-pressed={metric === 'orders'} onClick={() => setMetric('orders')}>Contas</button>
        </div>
      </div>

      <div className="report-daily-summary">
        <div>
          <small>Dias com venda</small>
          <strong>{count(report.byDay.length)}</strong>
          <span>de {count(report.byDay.length)} dias listados</span>
        </div>
        <div>
          <small>Melhor dia</small>
          <strong>{best ? shortDate(best.date) : '—'}</strong>
          <span>{best ? `${money(best.revenue)} · ${best.label}` : 'sem venda'}</span>
        </div>
        <div>
          <small>Dia mais fraco</small>
          <strong>{weakest ? shortDate(weakest.date) : '—'}</strong>
          <span>{weakest ? `${money(weakest.revenue)} · ${weakest.label}` : 'sem venda'}</span>
        </div>
      </div>

      <div className="report-pagination" style={{ marginTop: 12 }}>
        <button
          className={`button button-small ${page === 1 ? 'disabled' : ''}`}
          onClick={() => setPage(page - 1)}
          disabled={page === 1}
        >
          <ChevronLeft size={12} /> Anterior
        </button>
        <span>página {page} de {totalPages}</span>
        <button
          className={`button button-small ${page === totalPages ? 'disabled' : ''}`}
          onClick={() => setPage(page + 1)}
          disabled={page === totalPages || totalPages <= 1}
        >
          Próximo <ChevronRight size={12} />
        </button>
      </div>

      <div className="report-daily-chart">
        <svg
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
          role="img"
          aria-label={`${metric === 'revenue' ? 'Receita' : 'Contas pagas'} por dia no período`}
        >
          <line x1={geometry.left} y1={geometry.top + geometry.innerHeight} x2={geometry.width - geometry.right} y2={geometry.top + geometry.innerHeight} className="daily-axis" />
          <line x1={geometry.left} y1={geometry.top} x2={geometry.left} y2={geometry.top + geometry.innerHeight} className="daily-axis" />
          <text x={geometry.left - 6} y={geometry.top + 4} textAnchor="end" className="daily-axis-label">
            {metric === 'revenue' ? money(geometry.max / 100) : count(geometry.max)}
          </text>
          <text x={geometry.left - 6} y={geometry.top + geometry.innerHeight + 4} textAnchor="end" className="daily-axis-label">0</text>
          {geometry.points.length > 1 && <path d={geometry.area} className="daily-area" />}
          {geometry.points.length > 1 && <path d={geometry.line} className="daily-line" />}
          {geometry.points.map((point, index) => (
            <g key={point.day.date}>
              <circle cx={point.x} cy={point.y} r={geometry.points.length === 1 ? 6 : 3.5} className="daily-dot">
                <title>{`${shortDate(point.day.date)} · ${money(point.day.revenue)} · ${point.day.orders} contas`}</title>
              </circle>
              {(index % labelEvery === 0 || index === geometry.points.length - 1) && (
                <text x={point.x} y={geometry.height - 10} textAnchor="middle" className="daily-axis-label">
                  {shortDate(point.day.date)}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      <div className="report-table-scroll">
        <table className="report-table report-daily-table" aria-label="Evolução diária">
          <caption>Receita e contas por dia</caption>
          <thead>
            <tr><th>Data</th><th>Dia</th><th>Contas</th><th>Receita</th><th>Participação</th><th>vs. média</th></tr>
          </thead>
          <tbody>
            {pagedDays.map((day) => {
              const dayShare = share(centsOf(day.revenue), totalCents);
              const average = totalCents / report.byDay.length;
              const delta = centsOf(day.revenue) - average;
              return (
                <tr key={day.date}>
                  <td><strong>{shortDate(day.date)}</strong><small>{day.date}</small></td>
                  <td>{day.label}</td>
                  <td>{count(day.orders)}</td>
                  <td>{money(day.revenue)}</td>
                  <td><span className="report-share">{formatShare(dayShare)}</span></td>
                  <td>
                    <span className={`report-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'}`}>
                      {delta > 0 ? <TrendingUp size={13} /> : delta < 0 ? <TrendingDown size={13} /> : null}
                      {delta === 0 ? 'na média' : `${delta > 0 ? '+' : '−'}${money(Math.abs(delta) / 100)}`}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

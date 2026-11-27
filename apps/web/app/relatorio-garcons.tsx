'use client';

import { useMemo, useState } from 'react';
import { BadgeCheck, Users } from 'lucide-react';
import { money } from '@/lib/store';
import { centsOf, formatShare, share, type SalesReport, type WaiterStat } from '@/lib/sales-report';

type Props = { report: SalesReport };
type Metric = 'revenue' | 'orders' | 'averageTicket';

const count = (value: number) => value.toLocaleString('pt-BR');
const metricValue = (waiter: WaiterStat, metric: Metric) => {
  if (metric === 'orders') return waiter.orders;
  if (metric === 'averageTicket') return centsOf(waiter.averageTicket);
  return centsOf(waiter.revenue);
};
const metricLabel = (metric: Metric) => (
  metric === 'orders' ? 'contas' : metric === 'averageTicket' ? 'ticket médio' : 'receita'
);

export function RelatorioGarcons({ report }: Props) {
  const [metric, setMetric] = useState<Metric>('revenue');
  const waiters = useMemo(
    () => [...report.byWaiter].sort((a, b) => metricValue(b, metric) - metricValue(a, metric) || a.waiterName.localeCompare(b.waiterName, 'pt-BR')),
    [report.byWaiter, metric],
  );
  const max = Math.max(...waiters.map((waiter) => metricValue(waiter, metric)), 1);
  const podium = waiters.slice(0, 3);
  const total = report.paidOrders;

  if (!waiters.length) {
    return (
      <div className="report-block report-waiter-empty">
        <Users size={26} />
        <strong>Nenhum garçom no período</strong>
        <span>As comandas pagas ainda não têm garçom associado.</span>
      </div>
    );
  }

  return (
    <div className="report-waiters" aria-label="Desempenho por garçom">
      <div className="report-block-head report-waiter-head">
        <div>
          <div className="eyebrow">EQUIPE</div>
          <h3>Desempenho por garçom</h3>
          <p>Contas pagas, receita e ticket médio de cada profissional.</p>
        </div>
        <div className="report-toggle" role="group" aria-label="Métrica por garçom">
          <button type="button" aria-pressed={metric === 'revenue'} onClick={() => setMetric('revenue')}>Receita</button>
          <button type="button" aria-pressed={metric === 'orders'} onClick={() => setMetric('orders')}>Contas</button>
          <button type="button" aria-pressed={metric === 'averageTicket'} onClick={() => setMetric('averageTicket')}>Ticket</button>
        </div>
      </div>

      <div className="report-podium" aria-label="Pódio de garçons">
        {podium.map((waiter, index) => (
          <div className={`report-podium-card place-${index + 1}`} key={waiter.waiterName}>
            <span className="report-podium-place">{index + 1}º</span>
            <BadgeCheck size={16} />
            <strong>{waiter.waiterName}</strong>
            <small>{metricLabel(metric)}</small>
            <b>{metric === 'orders' ? count(waiter.orders) : money(metric === 'averageTicket' ? waiter.averageTicket : waiter.revenue)}</b>
          </div>
        ))}
      </div>

      <div className="report-waiter-summary">
        <div><small>Garçons no período</small><strong>{count(waiters.length)}</strong></div>
        <div><small>Contas pagas</small><strong>{count(total)}</strong></div>
        <div><small>Receita total</small><strong>{money(report.revenue)}</strong></div>
        <div><small>Ticket médio da casa</small><strong>{money(report.averageTicket)}</strong></div>
      </div>

      <div className="report-table-scroll">
        <table className="report-table report-waiter-table" aria-label={`Garçons por ${metricLabel(metric)}`}>
          <caption>Desempenho por garçom ordenado por {metricLabel(metric)}</caption>
          <thead>
            <tr><th>#</th><th>Garçom</th><th>Contas</th><th>Receita</th><th>Ticket médio</th><th>Participação</th><th>Peso</th></tr>
          </thead>
          <tbody>
            {waiters.map((waiter, index) => (
              <tr key={waiter.waiterName}>
                <td>{index + 1}</td>
                <td><strong>{waiter.waiterName}</strong><small>{formatShare(share(waiter.orders, total))} das contas</small></td>
                <td>{count(waiter.orders)}</td>
                <td>{money(waiter.revenue)}</td>
                <td>{money(waiter.averageTicket)}</td>
                <td><span className="report-share">{formatShare(waiter.share)}</span></td>
                <td>
                  <span className="report-waiter-bar" aria-hidden="true">
                    <i style={{ width: `${Math.round((metricValue(waiter, metric) / max) * 100)}%` }} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="report-muted">
        Comandas sem garçom aparecem como “Sem garçom”. O ticket médio é a receita dividida pelas contas do profissional.
      </p>
    </div>
  );
}

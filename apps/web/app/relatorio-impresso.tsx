'use client';

import { useMemo } from 'react';
import { Printer, X } from 'lucide-react';
import { money } from '@/lib/store';
import { salesInsights } from '@/lib/sales-comparison';
import { PAYMENT_LABELS, centsOf, formatShare, topItems, type SalesReport } from '@/lib/sales-report';

type Props = { report: SalesReport; previous: SalesReport; onClose: () => void };

const count = (value: number) => value.toLocaleString('pt-BR');

export function RelatorioImpresso({ report, previous, onClose }: Props) {
  const generatedAt = useMemo(
    () => new Date().toLocaleString('pt-BR', { timeZone: 'America/Belem', dateStyle: 'short', timeStyle: 'short' }),
    [],
  );
  const insights = useMemo(() => salesInsights(report, previous), [report, previous]);
  const items = topItems(report, 'revenue');
  const bestHours = [...report.byHour].sort((a, b) => centsOf(b.revenue) - centsOf(a.revenue)).slice(0, 6);

  return (
    <div className="report-print-overlay" role="dialog" aria-modal="true" aria-label="Relatório para impressão">
      <div className="report-print-toolbar">
        <strong>Prévia de impressão</strong>
        <div>
          <button className="button button-light" type="button" onClick={() => window.print()}>
            <Printer size={16} />Imprimir
          </button>
          <button className="button button-light" type="button" onClick={onClose}>
            <X size={16} />Fechar
          </button>
        </div>
      </div>

      <article className="report-print-sheet">
        <header className="report-print-head">
          <div>
            <span className="report-print-brand">Mesa Clara</span>
            <h1>Relatório de vendas</h1>
            <p>Período de {report.from} a {report.to} · horário de Belém (UTC−3)</p>
          </div>
          <div className="report-print-meta">
            <span>Emitido em {generatedAt}</span>
            <span>{count(report.paidOrders)} contas pagas</span>
          </div>
        </header>

        <section className="report-print-kpis" aria-label="Resumo do período">
          <div><small>Receita</small><strong>{money(report.revenue)}</strong></div>
          <div><small>Receita líquida</small><strong>{money(report.netRevenue)}</strong></div>
          <div><small>Ticket médio</small><strong>{money(report.averageTicket)}</strong></div>
          <div><small>Itens vendidos</small><strong>{count(report.itemsSold)}</strong></div>
        </section>

        <section className="report-print-section">
          <h2>Itens de maior receita</h2>
          <table>
            <thead><tr><th>#</th><th>Item</th><th>Categoria</th><th>Qtd.</th><th>Receita</th><th>Part.</th></tr></thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={`${item.name}-${item.category}`}>
                  <td>{index + 1}</td>
                  <td>{item.name}</td>
                  <td>{item.category}</td>
                  <td>{count(item.quantity)}</td>
                  <td>{money(item.revenue)}</td>
                  <td>{formatShare(item.share)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="report-print-columns">
          <section className="report-print-section">
            <h2>Receita por categoria</h2>
            <table>
              <thead><tr><th>Categoria</th><th>Qtd.</th><th>Receita</th><th>Part.</th></tr></thead>
              <tbody>
                {report.byCategory.map((category) => (
                  <tr key={category.category}>
                    <td>{category.category}</td>
                    <td>{count(category.quantity)}</td>
                    <td>{money(category.revenue)}</td>
                    <td>{formatShare(category.share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="report-print-section">
            <h2>Formas de pagamento</h2>
            <table>
              <thead><tr><th>Forma</th><th>Contas</th><th>Receita</th><th>Part.</th></tr></thead>
              <tbody>
                {report.byPayment.map((payment) => (
                  <tr key={payment.method}>
                    <td>{PAYMENT_LABELS[payment.method]}</td>
                    <td>{count(payment.orders)}</td>
                    <td>{money(payment.revenue)}</td>
                    <td>{formatShare(payment.share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <div className="report-print-columns">
          <section className="report-print-section">
            <h2>Dias da semana</h2>
            <table>
              <thead><tr><th>Dia</th><th>Contas</th><th>Receita</th></tr></thead>
              <tbody>
                {report.byWeekday.map((day) => (
                  <tr key={day.weekday}>
                    <td>{day.label}</td>
                    <td>{count(day.orders)}</td>
                    <td>{money(day.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="report-print-section">
            <h2>Horários de maior receita</h2>
            <table>
              <thead><tr><th>Hora</th><th>Contas</th><th>Receita</th></tr></thead>
              <tbody>
                {bestHours.map((hour) => (
                  <tr key={hour.hour}>
                    <td>{hour.hour}h</td>
                    <td>{count(hour.orders)}</td>
                    <td>{money(hour.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <section className="report-print-section report-print-insights">
          <h2>Leitura do período</h2>
          <ul>
            {insights.map((insight) => <li key={insight.title}><strong>{insight.title}:</strong> {insight.text}</li>)}
          </ul>
        </section>

        <footer className="report-print-foot">
          <span>Mesa Clara · relatório gerado a partir das comandas pagas no período.</span>
          <span>{report.from} — {report.to}</span>
        </footer>
      </article>
    </div>
  );
}

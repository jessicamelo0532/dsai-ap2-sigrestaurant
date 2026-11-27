'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, BarChart3, CalendarDays, Clock3, CreditCard, Download, FileBarChart, GitCompareArrows, Printer,
  RefreshCw, TrendingDown, TrendingUp, Trophy,
} from 'lucide-react';
import { money } from '@/lib/store';
import {
  LIMIT_OPTIONS, PAYMENT_LABELS, categoryHourIntensity, centsOf, csvMoney, downloadCsv, formatChange, formatShare,
  hasSales, previousPeriod, reportFilename, salesReportCsv, topItems, validatePeriod,
  type HourMetric, type Rank, type SalesReport,
} from '@/lib/sales-report';
import { storeRequest } from '@/lib/store';
import { RelatoriosComparativo } from './relatorios-comparativo';
import { RelatorioImpresso } from './relatorio-impresso';
import { RelatorioExportJson } from './relatorio-export-json';

type Props = { from: string; to: string; mode: 'api' | 'local' };

const count = (value: number) => value.toLocaleString('pt-BR');
const percent = (value: number, max: number) => (max === 0 ? 0 : Math.round((value / max) * 100));

function Trend({ current, previous }: { current: string; previous: string }) {
  const text = formatChange(current, previous);
  const positive = text.startsWith('+');
  const negative = text.startsWith('-');
  return (
    <span className={`report-trend ${positive ? 'up' : negative ? 'down' : 'flat'}`}>
      {positive ? <TrendingUp size={14} /> : negative ? <TrendingDown size={14} /> : null}
      {text}
    </span>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="report-kpi">
      <small>{label}</small>
      <strong>{value}</strong>
      <span>{hint}</span>
    </div>
  );
}

function Ranking({ report, rank, onRank }: { report: SalesReport; rank: Rank; onRank: (rank: Rank) => void }) {
  const items = topItems(report, rank);
  const max = Math.max(...items.map((item) => centsOf(item.revenue)), 1);
  return (
    <div className="report-block">
      <div className="report-block-head">
        <div>
          <div className="eyebrow">O QUE VENDE</div>
          <h3>Itens mais vendidos</h3>
          <p>Ranking dos itens que mais saíram no período.</p>
        </div>
        <div className="report-toggle" role="group" aria-label="Ordenar ranking">
          <button type="button" aria-pressed={rank === 'quantity'} onClick={() => onRank('quantity')}>Por quantidade</button>
          <button type="button" aria-pressed={rank === 'revenue'} onClick={() => onRank('revenue')}>Por receita</button>
        </div>
      </div>
      {items.length ? (
        <div className="report-table-scroll">
          <table className="report-table" aria-label={`Itens por ${rank === 'quantity' ? 'quantidade' : 'receita'}`}>
            <caption>Itens mais vendidos por {rank === 'quantity' ? 'quantidade' : 'receita'}</caption>
            <thead>
              <tr><th>#</th><th>Item</th><th>Categoria</th><th>Qtd.</th><th>Receita</th><th>Participação</th></tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={`${item.name}-${item.category}`}>
                  <td>{index + 1}</td>
                  <td>
                    <strong>{item.name}</strong>
                    <span className="report-row-bar"><i style={{ width: `${percent(centsOf(item.revenue), max)}%` }} /></span>
                  </td>
                  <td>{item.category}</td>
                  <td>{count(item.quantity)}</td>
                  <td>{money(item.revenue)}</td>
                  <td><span className="report-share">{formatShare(item.share)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="report-muted">Nenhum item vendido no período.</p>}
    </div>
  );
}

function Categories({ report }: { report: SalesReport }) {
  const max = Math.max(...report.byCategory.map((category) => centsOf(category.revenue)), 1);
  return (
    <div className="report-block">
      <div className="report-block-head">
        <div>
          <div className="eyebrow">DE ONDE VEM</div>
          <h3>Receita por categoria</h3>
          <p>Quanto cada parte do cardápio puxa do faturamento.</p>
        </div>
        <span className="count-pill">{report.byCategory.length}</span>
      </div>
      {report.byCategory.length ? (
        <ul className="report-bars" aria-label="Receita por categoria">
          {report.byCategory.map((category) => (
            <li key={category.category}>
              <div className="report-bar-label">
                <strong>{category.category}</strong>
                <span>{money(category.revenue)} · {formatShare(category.share)}</span>
              </div>
              <div className="report-bar-track">
                <i style={{ width: `${percent(centsOf(category.revenue), max)}%` }} />
              </div>
              <small>{count(category.quantity)} itens</small>
            </li>
          ))}
        </ul>
      ) : <p className="report-muted">Nenhuma categoria vendida no período.</p>}
    </div>
  );
}

function Hours({ report, metric, onMetric }: { report: SalesReport; metric: HourMetric; onMetric: (metric: HourMetric) => void }) {
  const value = (entry: SalesReport['byHour'][number]) => metric === 'revenue' ? centsOf(entry.revenue) : entry.orders;
  const max = Math.max(...report.byHour.map(value), 1);
  return (
    <div className="report-block">
      <div className="report-block-head">
        <div>
          <div className="eyebrow">QUANDO VENDE</div>
          <h3>Movimento por hora</h3>
          <p>Horário de Belém (UTC−3), a partir do pagamento.</p>
        </div>
        <div className="report-toggle" role="group" aria-label="Métrica por hora">
          <button type="button" aria-pressed={metric === 'revenue'} onClick={() => onMetric('revenue')}>Receita</button>
          <button type="button" aria-pressed={metric === 'orders'} onClick={() => onMetric('orders')}>Contas</button>
        </div>
      </div>
      <div className="report-columns-scroll">
        <div className="report-columns" role="img" aria-label={`${metric === 'revenue' ? 'Receita' : 'Contas'} por hora`}>
          {report.byHour.map((entry) => (
            <div className="report-column" key={entry.hour}>
              <div className="report-column-track">
                <i
                  style={{ height: `${percent(value(entry), max)}%` }}
                  title={`${entry.hour}h: ${metric === 'revenue' ? money(entry.revenue) : `${entry.orders} contas`}`}
                />
              </div>
              <span>{entry.hour}h</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Weekdays({ report }: { report: SalesReport }) {
  const max = Math.max(...report.byWeekday.map((day) => centsOf(day.revenue)), 1);
  return (
    <div className="report-block">
      <div className="report-block-head">
        <div>
          <div className="eyebrow">MELHORES DIAS</div>
          <h3>Receita por dia</h3>
          <p>Compare o movimento de cada dia da semana.</p>
        </div>
        <CalendarDays size={18} />
      </div>
      <div className="report-weekdays">
        {report.byWeekday.map((day) => (
          <div className="report-weekday" key={day.weekday}>
            <div className="report-column-track">
              <i style={{ height: `${percent(centsOf(day.revenue), max)}%` }} title={`${day.label}: ${money(day.revenue)}`} />
            </div>
            <strong>{day.label.slice(0, 3)}</strong>
            <small>{count(day.orders)}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function Payments({ report }: { report: SalesReport }) {
  const max = Math.max(...report.byPayment.map((payment) => centsOf(payment.revenue)), 1);
  return (
    <div className="report-block">
      <div className="report-block-head">
        <div>
          <div className="eyebrow">COMO PAGAM</div>
          <h3>Formas de pagamento</h3>
          <p>Distribuição da receita por meio de pagamento.</p>
        </div>
        <CreditCard size={18} />
      </div>
      <ul className="report-bars" aria-label="Receita por forma de pagamento">
        {report.byPayment.map((payment) => (
          <li key={payment.method}>
            <div className="report-bar-label">
              <strong>{PAYMENT_LABELS[payment.method]}</strong>
              <span>{money(payment.revenue)} · {formatShare(payment.share)}</span>
            </div>
            <div className="report-bar-track">
              <i style={{ width: `${percent(centsOf(payment.revenue), max)}%` }} />
            </div>
            <small>{count(payment.orders)} contas</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Heatmap({ report }: { report: SalesReport }) {
  const max = Math.max(...report.categoryByHour.flatMap((row) => row.hours.map(centsOf)), 0);
  if (!report.categoryByHour.length) return null;
  return (
    <div className="report-block report-heatmap-block">
      <div className="report-block-head">
        <div>
          <div className="eyebrow">CRUZAMENTO</div>
          <h3>Categoria × hora</h3>
          <p>Onde a receita se concentra ao longo do dia.</p>
        </div>
        <FileBarChart size={18} />
      </div>
      <div className="report-heatmap-scroll" tabIndex={0} aria-label="Tabela de categoria por hora">
        <table className="report-heatmap">
          <caption>Categoria por hora</caption>
          <thead>
            <tr>
              <th scope="col">Categoria</th>
              {report.byHour.map((hour) => <th scope="col" key={hour.hour}>{hour.hour}h</th>)}
            </tr>
          </thead>
          <tbody>
            {report.categoryByHour.map((row) => (
              <tr key={row.category}>
                <th scope="row">{row.category}</th>
                {row.hours.map((value, hour) => {
                  const intensity = max === 0 ? 0 : categoryHourIntensity(report, value);
                  return (
                    <td
                      key={hour}
                      style={{ background: intensity ? `rgba(106, 91, 199, ${0.08 + (intensity / 100) * 0.78})` : undefined }}
                      className={intensity > 55 ? 'strong' : ''}
                      title={`${row.category} · ${hour}h · ${money(value)}`}
                    >
                      {centsOf(value) ? csvMoney(value) : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RelatoriosVendasPanel({ from, to, mode }: Props) {
  const [report, setReport] = useState<SalesReport | null>(null);
  const [previous, setPrevious] = useState<SalesReport | null>(null);
  const [limit, setLimit] = useState<number>(LIMIT_OPTIONS[0]);
  const [rank, setRank] = useState<Rank>('quantity');
  const [hourMetric, setHourMetric] = useState<HourMetric>('revenue');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [view, setView] = useState<'report' | 'compare'>('report');
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const invalid = validatePeriod(from, to);
    if (invalid) {
      setError(invalid);
      setReport(null);
      setPrevious(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    const before = previousPeriod(from, to);
    Promise.all([
      storeRequest<SalesReport>(`/reports/sales?from=${from}&to=${to}&limit=${limit}`),
      storeRequest<SalesReport>(`/reports/sales?from=${before.from}&to=${before.to}&limit=${limit}`),
    ]).then(([current, last]) => {
      if (!active) return;
      setReport(current);
      setPrevious(last);
    }).catch((caught: unknown) => {
      if (!active) return;
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar o relatório.');
      setReport(null);
      setPrevious(null);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [from, to, limit, reload]);

  const hasData = useMemo(() => hasSales(report), [report]);

  const exportCsv = () => {
    if (!report) return;
    try {
      downloadCsv(reportFilename(from, to), salesReportCsv(report));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível exportar o CSV.');
    }
  };

  return (
    <section className="report-panel" aria-label="Relatórios de vendas">
      <div className="report-head">
        <div>
          <div className="eyebrow">RELATÓRIOS DE VENDAS</div>
          <h2>O que a casa vendeu</h2>
          <p>Só comandas pagas no período. {mode === 'local' ? 'Cálculo local neste navegador.' : 'Dados do servidor.'}</p>
        </div>
        <div className="report-actions">
          <label className="report-select">
            Itens no ranking
            <select value={limit} onChange={(event) => setLimit(Number(event.target.value))} aria-label="Itens no ranking">
              {LIMIT_OPTIONS.map((option) => <option value={option} key={option}>{option}</option>)}
            </select>
          </label>
          <button className="button button-light" type="button" onClick={exportCsv} disabled={!report}>
            <Download size={16} />Exportar CSV
          </button>
          <RelatorioExportJson current={report} previous={previous} />
          <button className="button button-light" type="button" onClick={() => setPrinting(true)} disabled={!report}>
            <Printer size={16} />Imprimir
          </button>
          <button className="button button-light" type="button" onClick={() => setReload((value) => value + 1)} disabled={loading}>
            <RefreshCw size={16} />Atualizar
          </button>
        </div>
      </div>

      <div className="report-view-tabs" role="tablist" aria-label="Visão do relatório">
        <button type="button" role="tab" aria-selected={view === 'report'} onClick={() => setView('report')}>
          <BarChart3 size={15} />Visão geral
        </button>
        <button type="button" role="tab" aria-selected={view === 'compare'} onClick={() => setView('compare')} disabled={!previous}>
          <GitCompareArrows size={15} />Comparativo
        </button>
      </div>

      {error && (
        <div className="report-error" role="alert">
          <AlertCircle size={20} />
          <div><strong>Não foi possível carregar o relatório</strong><p>{error}</p></div>
          <button className="button button-light" type="button" onClick={() => setReload((value) => value + 1)}>Tentar de novo</button>
        </div>
      )}

      {loading && !report && !error && <div className="report-loading" role="status">Carregando relatório…</div>}

      {!loading && !error && report && !hasData && (
        <div className="report-empty">
          <BarChart3 size={26} />
          <strong>Nenhuma venda no período</strong>
          <span>Feche uma conta entre {from} e {to} para ver o relatório.</span>
        </div>
      )}

      {report && hasData && view === 'compare' && previous && (
        <RelatoriosComparativo current={report} previous={previous} />
      )}

      {report && hasData && view === 'report' && (
        <>
          <div className="report-compare" aria-label="Comparação com o período anterior">
            <div className="report-compare-card">
              <small>Receita</small>
              <strong>{money(report.revenue)}</strong>
              <Trend current={report.revenue} previous={previous?.revenue ?? '0'} />
              <span>antes: {money(previous?.revenue ?? 0)}</span>
            </div>
            <div className="report-compare-card">
              <small>Contas pagas</small>
              <strong>{count(report.paidOrders)}</strong>
              <Trend current={String(report.paidOrders)} previous={String(previous?.paidOrders ?? 0)} />
              <span>antes: {count(previous?.paidOrders ?? 0)}</span>
            </div>
            <div className="report-compare-card">
              <small>Ticket médio</small>
              <strong>{money(report.averageTicket)}</strong>
              <Trend current={report.averageTicket} previous={previous?.averageTicket ?? '0'} />
              <span>antes: {money(previous?.averageTicket ?? 0)}</span>
            </div>
          </div>

          <div className="report-kpis">
            <Kpi label="Contas pagas" value={count(report.paidOrders)} hint="no período" />
            <Kpi label="Receita" value={money(report.revenue)} hint="preço de venda" />
            <Kpi label="Ticket médio" value={money(report.averageTicket)} hint="por conta" />
            <Kpi label="Itens vendidos" value={count(report.itemsSold)} hint="unidades" />
            <Kpi label="Descontos" value={money(report.discounts)} hint="pontos e ajustes" />
            <Kpi label="Taxas de entrega" value={money(report.deliveryFees)} hint="delivery" />
            <Kpi label="Receita líquida" value={money(report.netRevenue)} hint="receita − descontos + taxas" />
          </div>

          <div className="report-grid">
            <Ranking report={report} rank={rank} onRank={setRank} />
            <Categories report={report} />
          </div>

          <div className="report-grid">
            <Hours report={report} metric={hourMetric} onMetric={setHourMetric} />
            <Weekdays report={report} />
          </div>

          <div className="report-grid">
            <Payments report={report} />
            <div className="report-block report-highlight">
              <div className="report-block-head">
                <div>
                  <div className="eyebrow">LEITURA RÁPIDA</div>
                  <h3>Destaques do período</h3>
                  <p>O que os números contam sobre o movimento.</p>
                </div>
                <Trophy size={18} />
              </div>
              <ul className="report-highlights">
                <li><strong>Campeão de quantidade</strong><span>{report.topByQuantity[0]?.name ?? '—'} · {report.topByQuantity[0] ? count(report.topByQuantity[0].quantity) : 0} itens</span></li>
                <li><strong>Campeão de receita</strong><span>{report.topByRevenue[0]?.name ?? '—'} · {report.topByRevenue[0] ? money(report.topByRevenue[0].revenue) : money(0)}</span></li>
                <li><strong>Categoria líder</strong><span>{report.byCategory[0]?.category ?? '—'} · {report.byCategory[0] ? formatShare(report.byCategory[0].share) : '0%'}</span></li>
                <li><strong>Melhor hora</strong><span>{bestHour(report)} · {money(bestHourRevenue(report))}</span></li>
                <li><strong>Pagamento preferido</strong><span>{bestPayment(report)} · {formatShare(bestPaymentShare(report))}</span></li>
              </ul>
            </div>
          </div>

          <Heatmap report={report} />

          <p className="report-foot"><Clock3 size={14} />Horário de Belém (UTC−3). Relatório gerado a partir de {from} até {to}.</p>
        </>
      )}

      {printing && report && (
        <RelatorioImpresso report={report} previous={previous ?? report} onClose={() => setPrinting(false)} />
      )}
    </section>
  );
}

function bestHour(report: SalesReport): string {
  const best = [...report.byHour].sort((a, b) => centsOf(b.revenue) - centsOf(a.revenue))[0];
  return best && centsOf(best.revenue) ? `${best.hour}h` : '—';
}

function bestHourRevenue(report: SalesReport): string {
  const best = [...report.byHour].sort((a, b) => centsOf(b.revenue) - centsOf(a.revenue))[0];
  return best?.revenue ?? '0';
}

function bestPayment(report: SalesReport): string {
  const best = [...report.byPayment].sort((a, b) => centsOf(b.revenue) - centsOf(a.revenue))[0];
  return best && centsOf(best.revenue) ? PAYMENT_LABELS[best.method] : '—';
}

function bestPaymentShare(report: SalesReport): number {
  const best = [...report.byPayment].sort((a, b) => centsOf(b.revenue) - centsOf(a.revenue))[0];
  return best?.share ?? 0;
}

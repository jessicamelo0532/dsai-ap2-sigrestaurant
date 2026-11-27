'use client';

import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Download, GitCompareArrows, Minus, Sparkles } from 'lucide-react';
import { money } from '@/lib/store';
import {
  compareCategories, compareItems, comparePayments, compareTotals, compareWeekdays, comparisonCsv, salesInsights,
} from '@/lib/sales-comparison';
import { downloadCsv, formatChange, type Rank, type SalesReport } from '@/lib/sales-report';

type Props = { current: SalesReport; previous: SalesReport };

const count = (value: number) => value.toLocaleString('pt-BR');

function Delta({ current, previous, suffix = '%' }: { current: string | number; previous: string | number; suffix?: string }) {
  const text = formatChange(current, previous);
  const up = text.startsWith('+');
  const down = text.startsWith('-');
  return (
    <span className={`report-delta ${up ? 'up' : down ? 'down' : 'flat'}`}>
      {up ? <ArrowUpRight size={13} /> : down ? <ArrowDownRight size={13} /> : <Minus size={13} />}
      {text === 'sem base' ? text : `${text}${suffix}`}
    </span>
  );
}

export function RelatoriosComparativo({ current, previous }: Props) {
  const [rank, setRank] = useState<Rank>('revenue');
  const totals = useMemo(() => compareTotals(current, previous), [current, previous]);
  const categories = useMemo(() => compareCategories(current, previous), [current, previous]);
  const payments = useMemo(() => comparePayments(current, previous), [current, previous]);
  const weekdays = useMemo(() => compareWeekdays(current, previous), [current, previous]);
  const items = useMemo(() => compareItems(current, previous, rank), [current, previous, rank]);
  const insights = useMemo(() => salesInsights(current, previous), [current, previous]);

  const exportCsv = () => {
    downloadCsv(`comparativo-vendas-${current.from}-a-${current.to}.csv`, comparisonCsv(current, previous));
  };

  return (
    <div className="report-comparison" aria-label="Comparativo entre períodos">
      <div className="report-comparison-head">
        <div>
          <div className="eyebrow">PERÍODO A PERÍODO</div>
          <h3>Comparativo detalhado</h3>
          <p>
            Atual: {current.from} a {current.to}. Anterior: {previous.from} a {previous.to}.
          </p>
        </div>
        <button className="button button-light" type="button" onClick={exportCsv}>
          <Download size={16} />Exportar comparativo
        </button>
      </div>

      <div className="report-insights" aria-label="Leitura do comparativo">
        {insights.map((insight) => (
          <div className="report-insight" key={insight.title}>
            <Sparkles size={16} />
            <div><strong>{insight.title}</strong><p>{insight.text}</p></div>
          </div>
        ))}
      </div>

      <div className="report-block">
        <div className="report-block-head">
          <div>
            <div className="eyebrow">TOTAIS</div>
            <h3>Indicadores lado a lado</h3>
            <p>Receita, volume, ticket e ajustes contra o período anterior.</p>
          </div>
          <GitCompareArrows size={18} />
        </div>
        <div className="report-table-scroll">
          <table className="report-table report-compare-table" aria-label="Comparativo de totais">
            <caption>Comparativo de totais</caption>
            <thead>
              <tr><th>Indicador</th><th>Atual</th><th>Anterior</th><th>Variação</th></tr>
            </thead>
            <tbody>
              {totals.map((row) => (
                <tr key={row.key}>
                  <td><strong>{row.label}</strong></td>
                  <td>{row.format === 'money' ? money(row.current) : row.current}</td>
                  <td>{row.format === 'money' ? money(row.previous) : row.previous}</td>
                  <td><Delta current={row.current} previous={row.previous} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="report-grid">
        <div className="report-block">
          <div className="report-block-head">
            <div>
              <div className="eyebrow">CARDÁPIO</div>
              <h3>Categorias</h3>
              <p>Receita por categoria nos dois períodos.</p>
            </div>
          </div>
          {categories.length ? (
            <div className="report-table-scroll">
              <table className="report-table" aria-label="Comparativo de categorias">
                <caption>Categorias no comparativo</caption>
                <thead>
                  <tr><th>Categoria</th><th>Atual</th><th>Anterior</th><th>Variação</th></tr>
                </thead>
                <tbody>
                  {categories.map((row) => (
                    <tr key={row.category}>
                      <td><strong>{row.category}</strong><small>{count(row.currentQuantity)} un. agora · {count(row.previousQuantity)} antes</small></td>
                      <td>{money(row.currentRevenue)}</td>
                      <td>{money(row.previousRevenue)}</td>
                      <td><Delta current={row.currentRevenue} previous={row.previousRevenue} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="report-muted">Nenhuma categoria nos períodos comparados.</p>}
        </div>

        <div className="report-block">
          <div className="report-block-head">
            <div>
              <div className="eyebrow">RECEBIMENTO</div>
              <h3>Formas de pagamento</h3>
              <p>Como a receita foi paga em cada período.</p>
            </div>
          </div>
          <div className="report-table-scroll">
            <table className="report-table" aria-label="Comparativo de formas de pagamento">
              <caption>Formas de pagamento no comparativo</caption>
              <thead>
                <tr><th>Forma</th><th>Atual</th><th>Anterior</th><th>Variação</th></tr>
              </thead>
              <tbody>
                {payments.map((row) => (
                  <tr key={row.method}>
                    <td><strong>{row.label}</strong><small>{count(row.currentOrders)} contas agora · {count(row.previousOrders)} antes</small></td>
                    <td>{money(row.currentRevenue)}</td>
                    <td>{money(row.previousRevenue)}</td>
                    <td><Delta current={row.currentRevenue} previous={row.previousRevenue} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="report-block">
        <div className="report-block-head">
          <div>
            <div className="eyebrow">SEMANA</div>
            <h3>Dias da semana</h3>
            <p>Receita e volume de contas por dia, nos dois períodos.</p>
          </div>
        </div>
        <div className="report-table-scroll">
          <table className="report-table" aria-label="Comparativo por dia da semana">
            <caption>Dias da semana no comparativo</caption>
            <thead>
              <tr><th>Dia</th><th>Atual</th><th>Anterior</th><th>Contas</th><th>Variação</th></tr>
            </thead>
            <tbody>
              {weekdays.map((row) => (
                <tr key={row.weekday}>
                  <td><strong>{row.label}</strong></td>
                  <td>{money(row.currentRevenue)}</td>
                  <td>{money(row.previousRevenue)}</td>
                  <td>{count(row.currentOrders)} · {count(row.previousOrders)}</td>
                  <td><Delta current={row.currentRevenue} previous={row.previousRevenue} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="report-block">
        <div className="report-block-head">
          <div>
            <div className="eyebrow">ITENS</div>
            <h3>Itens lado a lado</h3>
            <p>Os itens que mais pesaram em cada período.</p>
          </div>
          <div className="report-toggle" role="group" aria-label="Ordenar comparativo de itens">
            <button type="button" aria-pressed={rank === 'revenue'} onClick={() => setRank('revenue')}>Por receita</button>
            <button type="button" aria-pressed={rank === 'quantity'} onClick={() => setRank('quantity')}>Por quantidade</button>
          </div>
        </div>
        {items.length ? (
          <div className="report-table-scroll">
            <table className="report-table" aria-label={`Comparativo de itens por ${rank === 'revenue' ? 'receita' : 'quantidade'}`}>
              <caption>Itens no comparativo</caption>
              <thead>
                <tr><th>Item</th><th>Categoria</th><th>Qtd. atual</th><th>Qtd. anterior</th><th>Receita atual</th><th>Receita anterior</th><th>Variação</th></tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={`${row.name}-${row.category}`}>
                    <td><strong>{row.name}</strong></td>
                    <td>{row.category}</td>
                    <td>{count(row.currentQuantity)}</td>
                    <td>{count(row.previousQuantity)}</td>
                    <td>{money(row.currentRevenue)}</td>
                    <td>{money(row.previousRevenue)}</td>
                    <td><Delta current={row.currentRevenue} previous={row.previousRevenue} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="report-muted">Nenhum item nos períodos comparados.</p>}
      </div>
    </div>
  );
}

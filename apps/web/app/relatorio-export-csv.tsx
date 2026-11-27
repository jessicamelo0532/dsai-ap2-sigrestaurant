'use client';

import { Download, Copy } from 'lucide-react';
import { useState } from 'react';
import { salesReportToCsv, downloadCsvFromReport } from '@/lib/sales-report';
import { SalesReport } from '@/lib/sales-report';

type Props = {
  report: SalesReport;
  filename?: string;
};

export function RelatorioExportCsv({ report, filename }: Props) {
  const [copiado, setCopiado] = useState<boolean>(false);
  const periodFilename = filename || `vendas-${report.from}_a_${report.to}`;

  const handleExport = () => {
    downloadCsvFromReport(periodFilename, report);
  };

  const handleCopy = () => {
    const content = salesReportToCsv(report);
    navigator.clipboard.writeText(content).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  };

  return (
    <div className="flex gap-2">
      <button
        type="button"
        className="button button-light"
        onClick={handleExport}
        aria-label="Exportar relatório de vendas em CSV"
      >
        <Download size={16} /> CSV
      </button>
      <button
        type="button"
        className={`button button-light ${copiado ? 'copiado' : ''}`}
        onClick={handleCopy}
        aria-label="Copiar conteúdo do CSV para a área de transferência"
        disabled={copiado}
      >
        <Copy size={16} /> {copiado ? 'Copiado!' : 'Copiar'}
      </button>
    </div>
  );
}
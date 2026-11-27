'use client';

import { Download } from 'lucide-react';
import { downloadCsvFromReport } from '@/lib/sales-report';
import { SalesReport } from '@/lib/sales-report';

type Props = {
  report: SalesReport;
  filename?: string;
};

export function RelatorioExportCsv({ report, filename }: Props) {
  const handleExport = () => {
    const periodFilename = filename || `vendas-${report.from}_a_${report.to}`;
    downloadCsvFromReport(periodFilename, report);
  };

  return (
    <button
      type="button"
      className="button button-light"
      onClick={handleExport}
      aria-label="Exportar relatório de vendas em CSV"
    >
      <Download size={16} /> CSV
    </button>
  );
}
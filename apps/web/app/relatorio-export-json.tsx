'use client';

import { useState } from 'react';
import { Copy, Download, FileJson, X } from 'lucide-react';
import { buildExportJson } from '@/lib/sales-export-json';
import type { SalesReport } from '@/lib/sales-report';

type Props = {
  current: SalesReport | null;
  previous: SalesReport | null;
  onClose?: () => void;
};

export function RelatorioExportJson({ current, previous, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const [json, setJson] = useState('');
  const [copied, setCopied] = useState(false);

  const open = () => {
    if (!current) return;
    setJson(JSON.stringify(buildExportJson(current, previous), null, 2));
    setCopied(false);
    setVisible(true);
  };

  const close = () => {
    setVisible(false);
    onClose?.();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    if (!current) return;
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `relatorio-vendas-${current.from}-a-${current.to}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <button className="button button-light" type="button" onClick={open} disabled={!current}>
        <FileJson size={16} />Exportar JSON
      </button>

      {visible && (
        <div className="export-json-overlay" role="dialog" aria-modal="true" aria-label="Exportação JSON">
          <div className="export-json-sheet">
            <header className="export-json-head">
              <div>
                <strong>Prévia do JSON</strong>
                <small>{current?.from} — {current?.to}</small>
              </div>
              <button className="export-json-close" type="button" onClick={close} aria-label="Fechar prévia">
                <X size={18} />
              </button>
            </header>
            <pre className="export-json-content" aria-label="Conteúdo JSON">{json}</pre>
            <div className="export-json-actions">
              <button className="button button-light" type="button" onClick={copy}>
                <Copy size={16} />{copied ? 'Copiado' : 'Copiar'}
              </button>
              <button className="button button-light" type="button" onClick={download}>
                <Download size={16} />Baixar JSON
              </button>
              <button className="button button-light" type="button" onClick={close}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

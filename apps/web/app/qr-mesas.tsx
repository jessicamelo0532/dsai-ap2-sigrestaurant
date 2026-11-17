'use client';

import { useMemo } from 'react';
import { Printer, QrCode } from 'lucide-react';
import { encodeQr, qrPath } from '@/lib/qrcode';
import { tableTitle, tableUrl } from '@/lib/link-mesa';
import type { Table } from '@/lib/types';

// Cartões com QR code das mesas (SPEC/2026-11-17-pwa-e-qr-das-mesas.md, RF-05).

type Props = {
  tables: Pick<Table, 'id' | 'number' | 'capacity'>[];
  origin: string;
  onClose: () => void;
};

export function QrCard({ number, origin }: { number: number; origin: string }) {
  const url = tableUrl(origin, number);
  const qr = useMemo(() => encodeQr(url), [url]);
  const side = qr.size + 8;
  return (
    <article className="qr-card" aria-label={`QR da ${tableTitle(number)}`}>
      <svg viewBox={`0 0 ${side} ${side}`} role="img" aria-label={`QR code que abre a ${tableTitle(number)}`} shapeRendering="crispEdges">
        <rect width={side} height={side} fill="#fff" />
        <path d={qrPath(qr)} fill="#111" />
      </svg>
      <strong>{tableTitle(number)}</strong>
      <span>Aponte a câmera do celular</span>
      <small>{url}</small>
    </article>
  );
}

export function QrMesas({ tables, origin, onClose }: Props) {
  const ordered = [...tables].sort((a, b) => a.number - b.number);
  return (
    <div className="modal-backdrop qr-print" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card qr-modal" role="dialog" aria-modal="true" aria-label="QR das mesas">
        <div className="modal-heading qr-no-print">
          <div><div className="eyebrow">SALÃO</div><h2>QR das mesas</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar">×</button>
        </div>
        <p className="qr-hint qr-no-print"><QrCode size={15} />Imprima e deixe um cartão em cada mesa: ao ler o código, o celular abre a comanda daquela mesa.</p>
        {!ordered.length && <p className="qr-hint">Nenhuma mesa cadastrada.</p>}
        <div className="qr-grid">
          {ordered.map((table) => <QrCard key={table.id} number={table.number} origin={origin} />)}
        </div>
        <div className="form-actions qr-no-print">
          <button className="button button-light" onClick={onClose}>Fechar</button>
          <button className="button button-dark" disabled={!ordered.length} onClick={() => window.print()}><Printer size={16} />Imprimir</button>
        </div>
      </div>
    </div>
  );
}

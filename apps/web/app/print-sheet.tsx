'use client';

import { Printer } from 'lucide-react';
import { itemCountLabel, type Bobina, type Cupom } from '@/lib/impressao';

// Prévia e conteúdo impresso da bobina e do cupom (SPEC/2026-11-17-impressao-de-cupom.md).

type PrintSheetProps = {
  doc: Bobina | Cupom;
  onClose: () => void;
};

export function PrintSheet({ doc, onClose }: PrintSheetProps) {
  const bobina = doc.kind === 'bobina';
  return (
    <div
      className="modal-backdrop print-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={bobina ? 'Bobina da comanda' : 'Cupom da conta'}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="modal-card print-card">
        <div className="modal-heading no-print">
          <div>
            <div className="eyebrow">{doc.title}</div>
            <h2>{bobina ? 'Bobina da comanda' : 'Cupom da conta'}</h2>
          </div>
        </div>

        <div className="print-sheet">
          <header>
            <strong>{doc.restaurant}</strong>
            <small>{doc.subtitle}</small>
            <h3>{doc.title}</h3>
            <p>{doc.table}</p>
          </header>

          <ul>
            {doc.lines.map((line, index) => (
              <li key={`${line.name}-${index}`}>
                <span>{line.quantity}× {line.name}</span>
                <b>{line.total}</b>
              </li>
            ))}
            {!doc.lines.length && <li><span>Nenhum item</span><b>—</b></li>}
          </ul>

          <p className="print-total"><span>Total</span><b>{doc.total}</b></p>

          {bobina
            ? (
              <>
                <p className="print-meta">Aberta em {doc.openedAt} · {itemCountLabel(doc.itemCount)}</p>
                {doc.note && <p className="print-note">Observação: {doc.note}</p>}
              </>
            )
            : (
              <>
                <p className="print-meta">Pagamento: {doc.payment}</p>
                <p className="print-meta">Pago em {doc.paidAt}</p>
                <p className="print-meta">Comanda {doc.orderId}</p>
              </>
            )}

          <p className="print-foot">Obrigado pela visita!</p>
        </div>

        <div className="form-actions no-print">
          <button type="button" className="button button-light" onClick={onClose}>Fechar</button>
          <button type="button" className="button button-dark" onClick={() => window.print()}>
            <Printer size={16} />Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}

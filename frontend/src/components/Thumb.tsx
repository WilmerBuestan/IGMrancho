import { Reservation } from '../api';

/** Miniatura del comprobante en listas; las reservas sin comprobante muestran 💵. */
export default function Thumb({ r, className = 'h-12 w-12' }: { r: Reservation; className?: string }) {
  return (
    <div className={`shrink-0 overflow-hidden rounded-lg bg-igm-100 ${className}`}>
      {!r.receiptUrl ? (
        <div className="grid h-full place-items-center text-lg" title="Sin comprobante">💵</div>
      ) : r.receiptMime === 'application/pdf' ? (
        <div className="grid h-full place-items-center text-xs font-bold">PDF</div>
      ) : (
        <img src={r.receiptUrl} loading="lazy" className="h-full w-full object-cover" alt="" />
      )}
    </div>
  );
}

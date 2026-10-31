import { Status } from '../api';

const STYLES: Record<Status, string> = {
  pendiente: 'bg-oro-300/40 text-oro-600 ring-oro-400/40',
  aprobada: 'bg-igm-100 text-igm-700 ring-igm-400/40',
  rechazada: 'bg-red-50 text-red-700 ring-red-300/50',
};
const LABELS: Record<Status, string> = { pendiente: 'Por verificar', aprobada: 'Aprobada', rechazada: 'Rechazada' };

export default function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, downloadCsv, longDate, mealsText, money, Reservation, Status } from '../../api';
import PageTitle from '../../components/PageTitle';
import Receipt from '../../components/Receipt';
import StatusBadge from '../../components/StatusBadge';

interface Totals { desayuno: number; almuerzo: number; merienda: number; totalCents: number; count: number }
interface ListResponse {
  date: string;
  driveEnabled: boolean;
  summary: Record<'activas' | 'aprobadas' | 'pendientes' | 'rechazadas', Totals>;
  reservations: Reservation[];
}

const FILTERS: { key: Status | 'todas'; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'pendiente', label: 'Por verificar' },
  { key: 'aprobada', label: 'Aprobadas' },
  { key: 'rechazada', label: 'Rechazadas' },
];

const DRIVE_ICON: Record<string, [string, string]> = {
  uploaded: ['☁️', 'Subido a Drive'],
  pending: ['⏳', 'Subiendo a Drive'],
  failed: ['⚠️', 'Falló la subida a Drive (se reintenta)'],
  disabled: ['—', 'Drive no configurado'],
};

export default function ReservationsAdmin() {
  const [params, setParams] = useSearchParams();
  const date = params.get('date') ?? '';
  const filter = (params.get('estado') as Status | null) ?? 'todas';
  const setParam = (k: string, v: string) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); setParams(p, { replace: true }); };
  const setDate = (v: string) => setParam('date', v);
  const setFilter = (v: Status | 'todas') => setParam('estado', v === 'todas' ? '' : v);
  const [q, setQ] = useState('');
  const [data, setData] = useState<ListResponse | null>(null);
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (date) params.set('date', date);
      if (q) params.set('q', q);
      const r = await api<ListResponse>(`/admin/reservations?${params}`, {}, true);
      setData(r);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, q]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    const i = setInterval(load, 30_000);
    return () => { clearTimeout(t); clearInterval(i); };
  }, [load]);

  const shown = date || data?.date || '';
  const shift = (n: number) => { const d = new Date(`${shown}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); setDate(d.toISOString().slice(0, 10)); };

  const list = data?.reservations.filter((r) => filter === 'todas' || r.status === filter) ?? [];
  const s = data?.summary;

  return (
    <div className="space-y-5">
      <PageTitle title="Registrados del día" subtitle={data ? longDate(data.date) : ''}
                 actions={<>
                   <div className="flex items-center gap-1">
                     <button className="btn-ghost px-3 py-2.5" title="Día anterior" onClick={() => shift(-1)} disabled={!shown}>‹</button>
                     <input type="date" className="input py-2.5" value={shown} onChange={(e) => setDate(e.target.value)} />
                     <button className="btn-ghost px-3 py-2.5" title="Día siguiente" onClick={() => shift(1)} disabled={!shown}>›</button>
                   </div>
                   <button className="btn-ghost py-2.5" onClick={() => window.print()}>🖨 Lista para cocina</button>
                   <button className="btn-ghost py-2.5" onClick={() => downloadCsv(`date=${shown}`, `igm-rancho-${shown}.csv`)} disabled={!data}>⬇ Excel</button>
                 </>} />

      {s && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Desayunos" value={s.activas.desayuno} emoji="☕" />
          <Stat label="Almuerzos" value={s.activas.almuerzo} emoji="🍛" />
          <Stat label="Meriendas" value={s.activas.merienda} emoji="🍲" />
          <Stat label="Por verificar" value={s.pendientes.count} emoji="⏳" highlight={s.pendientes.count > 0} />
          <Stat label="Recaudado (aprobado)" value={money(s.aprobadas.totalCents)} emoji="💵" className="col-span-2 md:col-span-1" />
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center print:hidden">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-white p-1 ring-1 ring-igm-900/5">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
                    className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${filter === f.key ? 'bg-igm-800 text-white' : 'text-igm-700 hover:bg-igm-50'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <input className="input py-2.5 sm:max-w-xs sm:ml-auto" placeholder="Buscar nombre, cédula, código…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {data && !data.driveEnabled && (
        <p className="rounded-xl bg-oro-300/20 px-4 py-3 text-sm text-igm-800">Google Drive no está configurado: las capturas se guardan solo en el servidor.</p>
      )}

      {/* Tabla en computadora */}
      <div className="card hidden overflow-hidden md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-igm-50 text-xs uppercase tracking-wide text-igm-500">
            <tr>
              <th className="px-4 py-3">Captura</th><th className="px-4 py-3">Persona</th><th className="px-4 py-3">Ranchos</th>
              <th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-center">Drive</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-igm-100">
            {list.map((r) => (
              <tr key={r.id} className="cursor-pointer hover:bg-igm-50/60" onClick={() => setSelected(r)}>
                <td className="px-4 py-2"><div className="h-12 w-12 overflow-hidden rounded-lg bg-igm-100">
                  {r.receiptMime === 'application/pdf' ? <div className="grid h-full place-items-center text-xs">PDF</div> : <img src={r.receiptUrl} loading="lazy" className="h-full w-full object-cover" alt="" />}
                </div></td>
                <td className="px-4 py-2"><div className="font-semibold">{r.fullName}</div><div className="text-xs text-igm-500">{r.cedula} · {r.code}</div></td>
                <td className="px-4 py-2 text-igm-700">{mealsText(r)}</td>
                <td className="px-4 py-2 text-right font-bold tabular-nums">{money(r.totalCents)}</td>
                <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-2 text-center" title={DRIVE_ICON[r.driveStatus ?? 'pending'][1]}>
                  {r.driveLink ? <a href={r.driveLink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>☁️</a> : DRIVE_ICON[r.driveStatus ?? 'pending'][0]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="p-8 text-center text-igm-400">Sin reservas.</p>}
      </div>

      {/* Tarjetas en celular */}
      <div className="space-y-3 md:hidden">
        {list.map((r) => (
          <button key={r.id} onClick={() => setSelected(r)} className="card flex w-full gap-3 p-3 text-left">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-igm-100">
              {r.receiptMime === 'application/pdf' ? <div className="grid h-full place-items-center text-xs">PDF</div> : <img src={r.receiptUrl} loading="lazy" className="h-full w-full object-cover" alt="" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2"><span className="truncate font-semibold">{r.fullName}</span><StatusBadge status={r.status} /></div>
              <div className="text-xs text-igm-500">{r.cedula}</div>
              <div className="mt-1 flex justify-between text-sm"><span className="text-igm-700">{mealsText(r)}</span><b>{money(r.totalCents)}</b></div>
            </div>
          </button>
        ))}
        {list.length === 0 && <p className="card p-8 text-center text-igm-400">Sin reservas.</p>}
      </div>

      {selected && <ReviewModal r={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); load(); }} />}
    </div>
  );
}

function Stat({ label, value, emoji, highlight, className = '' }: { label: string; value: number | string; emoji: string; highlight?: boolean; className?: string }) {
  return (
    <div className={`card p-4 ${highlight ? 'ring-2 ring-oro-400' : ''} ${className}`}>
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-igm-500"><span>{label}</span><span className="text-lg">{emoji}</span></div>
      <div className="mt-1 text-2xl font-extrabold tabular-nums sm:text-3xl">{value}</div>
    </div>
  );
}

function ReviewModal({ r, onClose, onSaved }: { r: Reservation; onClose: () => void; onSaved: () => void }) {
  const [note, setNote] = useState(r.adminNote ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  async function save(status: Status) {
    setSaving(true);
    try {
      await api(`/admin/reservations/${r.id}`, { method: 'PATCH', body: JSON.stringify({ status, adminNote: note }) }, true);
      onSaved();
    } catch (e) {
      alert((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-igm-950/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-white sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="grid md:grid-cols-[1.1fr_1fr]">
          <div className="bg-igm-950 md:rounded-l-3xl">
            {r.receiptMime === 'application/pdf' ? (
              <iframe src={r.receiptUrl} title="Comprobante" className="h-[60vh] w-full" />
            ) : (
              <a href={r.receiptUrl} target="_blank" rel="noreferrer">
                <img src={r.receiptUrl} alt="Comprobante" className="mx-auto max-h-[60vh] w-full object-contain md:max-h-[85vh]" />
              </a>
            )}
          </div>
          <div className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-extrabold">{r.fullName}</h3>
                <p className="text-sm text-igm-500">{r.cedula}<br />{r.email}</p>
              </div>
              <button onClick={onClose} className="rounded-lg px-2 text-2xl text-igm-400 hover:text-igm-900">×</button>
            </div>
            <div className="rounded-2xl bg-igm-50 p-4 text-sm">
              <div className="flex justify-between"><span className="text-igm-500">Código</span><b className="font-mono">{r.code}</b></div>
              <div className="flex justify-between"><span className="text-igm-500">Fecha</span><b>{longDate(r.serviceDate)}</b></div>
              <div className="flex justify-between"><span className="text-igm-500">Ranchos</span><b>{mealsText(r)}</b></div>
              <div className="flex justify-between"><span className="text-igm-500">Enviada</span><b>{new Date(r.createdAt).toLocaleString('es-EC')}</b></div>
              <div className="mt-2 flex justify-between border-t border-igm-200 pt-2 text-lg"><span>Total</span><b>{money(r.totalCents)}</b></div>
            </div>
            <div className="flex items-center gap-2 text-sm"><span className="text-igm-500">Estado actual:</span><StatusBadge status={r.status} /></div>
            {r.driveLink && <a className="block text-sm font-semibold text-igm-700 underline" href={r.driveLink} target="_blank" rel="noreferrer">Abrir en Google Drive ↗</a>}
            <div>
              <label className="label" htmlFor="note">Nota para la persona (opcional)</label>
              <textarea id="note" className="input min-h-[70px]" placeholder="Ej. El monto no coincide" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button className="btn bg-red-50 text-red-700 hover:bg-red-100" disabled={saving} onClick={() => save('rechazada')}>✕ Rechazar</button>
              <button className="btn-primary" disabled={saving} onClick={() => save('aprobada')}>✓ Aprobar</button>
            </div>
            {r.status !== 'pendiente' && (
              <button className="w-full text-sm text-igm-500 underline" disabled={saving} onClick={() => save('pendiente')}>Volver a “por verificar”</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

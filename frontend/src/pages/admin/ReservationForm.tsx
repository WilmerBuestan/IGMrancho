import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AdminSettings, api, isValidCedula, Meal, MEALS, money, Reservation, Status } from '../../api';
import Stepper from '../../components/Stepper';

/** Crear (r = null) o editar una reserva desde el panel. */
export default function ReservationForm({ r, defaultDate, onClose, onSaved }:
  { r: Reservation | null; defaultDate: string; onClose: () => void; onSaved: (r: Reservation) => void }) {
  const [prices, setPrices] = useState<Record<Meal, number> | null>(null);
  const [fullName, setFullName] = useState(r?.fullName ?? '');
  const [cedula, setCedula] = useState(r?.cedula ?? '');
  const [email, setEmail] = useState(r?.email ?? '');
  const [serviceDate, setServiceDate] = useState(r?.serviceDate ?? defaultDate);
  const [qty, setQty] = useState<Record<Meal, number>>({
    desayuno: r?.desayuno ?? 0, almuerzo: r?.almuerzo ?? 0, merienda: r?.merienda ?? 0,
  });
  const [status, setStatus] = useState<Status>(r?.status ?? 'aprobada');
  const [note, setNote] = useState(r?.adminNote ?? '');
  const [manualTotal, setManualTotal] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { api<AdminSettings>('/admin/settings', {}, true).then((s) => setPrices(s.prices)).catch(() => {}); }, []);

  const qtyChanged = !r || MEALS.some((m) => qty[m.key] !== r[m.key]);
  const autoTotal = useMemo(
    () => (prices ? MEALS.reduce((a, m) => a + qty[m.key] * prices[m.key], 0) : 0),
    [prices, qty],
  );
  // Al editar sin tocar cantidades se mantiene el total original; si cambian, se recalcula con los precios actuales.
  const shownTotal = manualTotal ?? ((r && !qtyChanged ? r.totalCents : autoTotal) / 100).toFixed(2);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!isValidCedula(cedula)) return setError('La cédula no es válida');
    if (MEALS.every((m) => qty[m.key] === 0)) return setError('Elige al menos un rancho');
    const fd = new FormData();
    fd.append('fullName', fullName);
    fd.append('cedula', cedula);
    fd.append('email', email);
    fd.append('serviceDate', serviceDate);
    MEALS.forEach((m) => fd.append(m.key, String(qty[m.key])));
    fd.append('status', status);
    fd.append('adminNote', note);
    if (manualTotal !== null) fd.append('totalCents', String(Math.round(parseFloat(manualTotal || '0') * 100)));
    if (file) fd.append('comprobante', file);
    setSaving(true);
    try {
      const saved = await api<Reservation>(r ? `/admin/reservations/${r.id}` : '/admin/reservations',
        { method: r ? 'PUT' : 'POST', body: fd }, true);
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-igm-950/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()}
            className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl sm:p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-xl font-extrabold">{r ? `Editar reserva ${r.code}` : 'Nueva reserva'}</h3>
            <p className="text-sm text-igm-500">{r ? 'Corrige lo que la persona ingresó mal.' : 'Para quien paga en efectivo o te escribió directamente.'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 text-2xl text-igm-400 hover:text-igm-900">×</button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="f-name">Grado y nombre completo</label>
            <input id="f-name" className="input" required minLength={3} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="f-ced">Cédula</label>
            <input id="f-ced" className="input" inputMode="numeric" maxLength={10} required value={cedula}
                   onChange={(e) => setCedula(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div>
            <label className="label" htmlFor="f-mail">Correo <span className="font-normal text-igm-400">(opcional)</span></label>
            <input id="f-mail" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="f-date">Fecha del servicio</label>
            <input id="f-date" type="date" className="input" required value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="f-status">Estado</label>
            <select id="f-status" className="input" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
              <option value="aprobada">Aprobada</option>
              <option value="pendiente">Por verificar</option>
              <option value="rechazada">Rechazada</option>
            </select>
          </div>
        </div>

        <div className="mt-4 divide-y divide-igm-100 rounded-2xl ring-1 ring-igm-100">
          {MEALS.map((m) => (
            <div key={m.key} className="flex items-center justify-between px-4 py-2.5">
              <span className="font-semibold">{m.emoji} {m.label} {prices && <span className="text-sm font-normal text-igm-500">· {money(prices[m.key])}</span>}</span>
              <Stepper value={qty[m.key]} onChange={(v) => { setQty({ ...qty, [m.key]: v }); setManualTotal(null); }} />
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="f-total">Total ($)</label>
            <input id="f-total" className="input text-lg font-bold" inputMode="decimal" value={shownTotal}
                   onChange={(e) => setManualTotal(e.target.value.replace(',', '.'))} />
            <p className="mt-1 text-xs text-igm-500">
              {manualTotal !== null ? 'Total escrito a mano.' : r && !qtyChanged ? 'Total original de la reserva.' : 'Calculado con los precios actuales; puedes cambiarlo.'}
            </p>
          </div>
          <div>
            <span className="label">{r?.receiptUrl ? 'Cambiar comprobante' : 'Comprobante (opcional)'}</span>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-igm-200 p-3 hover:bg-igm-50">
              <span className="text-2xl">{file ? '📄' : '📎'}</span>
              <span className="min-w-0 truncate text-sm">{file ? file.name : r?.receiptUrl ? 'Mantener el actual' : 'Sin comprobante (efectivo)'}</span>
              <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="f-note">Nota para la persona</label>
            <input id="f-note" className="input" placeholder="Ej. Pagó en efectivo / Se corrigió la cantidad" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={saving}>{saving ? 'Guardando…' : r ? 'Guardar cambios' : 'Crear reserva'}</button>
        </div>
      </form>
    </div>
  );
}

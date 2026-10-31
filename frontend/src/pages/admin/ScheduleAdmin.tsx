import { useEffect, useState } from 'react';
import { addDays, api, longDate, PublicConfig } from '../../api';
import PageTitle, { SaveBar } from '../../components/PageTitle';
import { useSettings } from '../../hooks/useSettings';

export default function ScheduleAdmin() {
  const { settings, save, saving, msg } = useSettings();
  const [open, setOpen] = useState(true);
  const [cutoff, setCutoff] = useState('20:00');
  const [reminder, setReminder] = useState(60);
  const [closed, setClosed] = useState<string[]>([]);
  const [newDate, setNewDate] = useState('');
  const [preview, setPreview] = useState<PublicConfig | null>(null);

  const loadPreview = () => api<PublicConfig>('/config').then(setPreview).catch(() => {});
  useEffect(() => { loadPreview(); }, []);
  useEffect(() => {
    if (!settings) return;
    setOpen(settings.open);
    setCutoff(settings.cutoff);
    setReminder(settings.reminderMinutes ?? 60);
    setClosed(settings.closedDates);
  }, [settings]);

  if (!settings) return <p className="text-igm-500">{msg || 'Cargando…'}</p>;

  const today = new Date().toLocaleDateString('en-CA');
  const addClosed = (d: string) => d && !closed.includes(d) && setClosed([...closed, d].sort());
  const upcoming = closed.filter((d) => d >= today);

  // Próximos 7 días para marcar rápido los días sin servicio
  const week = Array.from({ length: 14 }, (_, i) => addDays(today, i + 1));

  return (
    <div>
      <PageTitle title="Fechas y horarios" subtitle="Controla hasta cuándo se puede reservar y qué días no hay servicio." />

      {preview && (
        <div className="mb-5 rounded-2xl bg-igm-900 p-5 text-white">
          <div className="text-xs font-semibold uppercase tracking-widest text-igm-300">Así lo ve el personal ahora</div>
          <div className="mt-1 text-lg">
            {preview.open
              ? <>Reservando para el <b className="text-oro-400">{longDate(preview.serviceDate).toLowerCase()}</b>, hasta el {longDate(preview.deadline.slice(0, 10)).toLowerCase()} a las {preview.cutoff}</>
              : <b className="text-red-300">Reservas cerradas</b>}
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card space-y-5 p-5">
          <label className="flex items-center justify-between gap-4 rounded-xl bg-igm-50 p-4">
            <span><b>Recibir reservas</b><br /><span className="text-sm text-igm-500">Apágalo para cerrar las reservas por completo</span></span>
            <button type="button" onClick={() => setOpen(!open)}
                    className={`relative h-8 w-14 shrink-0 rounded-full transition ${open ? 'bg-igm-600' : 'bg-igm-200'}`}>
              <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${open ? 'left-7' : 'left-1'}`} />
            </button>
          </label>
          <div>
            <label className="label" htmlFor="cutoff">Hora límite (víspera del servicio)</label>
            <input id="cutoff" type="time" className="input text-xl font-bold" value={cutoff} onChange={(e) => setCutoff(e.target.value)} />
            <p className="mt-2 text-sm text-igm-500">
              Ej. con {cutoff}: para comer el martes hay que reservar hasta el lunes a las {cutoff}. Pasada esa hora, la reserva queda para el siguiente día con servicio.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="reminder">Recordatorio en la app (minutos antes de la hora límite)</label>
            <select id="reminder" className="input" value={reminder} onChange={(e) => setReminder(Number(e.target.value))}>
              <option value={0}>Apagado</option>
              {[15, 30, 45, 60, 90, 120, 180].map((m) => <option key={m} value={m}>{m} minutos antes</option>)}
            </select>
            <p className="mt-2 text-sm text-igm-500">
              Notificación a quienes tienen la app y aún no reservaron.{settings.pushEnabled === false && ' ⚠️ El servidor aún no tiene la llave de Firebase.'}
            </p>
          </div>
        </section>

        <section className="card space-y-4 p-5">
          <div>
            <h2 className="text-lg font-bold">Días sin servicio</h2>
            <p className="text-sm text-igm-500">Feriados, francos o días sin cocina. Nadie podrá reservar para esas fechas.</p>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {week.map((d) => {
              const off = closed.includes(d);
              const dt = new Date(`${d}T12:00:00`);
              return (
                <button key={d} type="button" title={longDate(d)}
                        onClick={() => setClosed(off ? closed.filter((x) => x !== d) : [...closed, d].sort())}
                        className={`rounded-xl py-2 text-center text-xs font-semibold ring-1 transition
                          ${off ? 'bg-red-50 text-red-700 ring-red-200 line-through' : 'bg-white text-igm-800 ring-igm-100 hover:bg-igm-50'}`}>
                  <div className="uppercase">{dt.toLocaleDateString('es-EC', { weekday: 'narrow' })}</div>
                  <div className="text-base">{dt.getDate()}</div>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <input type="date" className="input" min={today} value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            <button type="button" className="btn-ghost shrink-0" onClick={() => { addClosed(newDate); setNewDate(''); }}>Agregar</button>
          </div>
          {upcoming.length > 0 ? (
            <ul className="divide-y divide-igm-100 rounded-xl ring-1 ring-igm-100">
              {upcoming.map((d) => (
                <li key={d} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span>{longDate(d)}</span>
                  <button type="button" className="text-igm-400 hover:text-red-600" onClick={() => setClosed(closed.filter((x) => x !== d))}>Quitar</button>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-igm-400">No hay días bloqueados.</p>}
        </section>
      </div>

      <SaveBar msg={msg} saving={saving} onSave={async () => { if (await save({ open, cutoff, reminderMinutes: reminder, closedDates: closed })) loadPreview(); }} />
    </div>
  );
}

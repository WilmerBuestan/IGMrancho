import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, longDate, MEALS, money } from '../../api';
import StackedBars from '../../components/charts/StackedBars';
import PageTitle from '../../components/PageTitle';

interface Day { date: string; reservas: number; desayuno: number; almuerzo: number; merienda: number; aprobadoCents: number; pendienteCents: number; pendientes: number; rechazadas: number }
interface Person { cedula: string; fullName: string; reservas: number; desayuno: number; almuerzo: number; merienda: number; aprobadoCents: number }
interface Stats {
  today: string; tomorrow: string; nextServiceDate: string; from: string; to: string;
  daily: Day[];
  totals: { reservas: number; ranchos: number; aprobadoCents: number; personas: number; tasaAprobacion: number | null };
  pending: { n: number; cents: number };
  topPeople: Person[];
  byHour: { hour: number; n: number }[];
  drive: { enabled: boolean; uploaded?: number; pending?: number; failed?: number; disabled?: number };
  settings: { open: boolean; cutoff: string };
}

export default function Dashboard() {
  const [s, setS] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = () => api<Stats>('/admin/stats', {}, true).then(setS).catch((e) => setError(e.message));
    load();
    const i = setInterval(load, 60_000);
    return () => clearInterval(i);
  }, []);

  if (error) return <p className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>;
  if (!s) return <p className="text-igm-500">Cargando…</p>;

  const tomorrow = s.daily.find((d) => d.date === s.tomorrow);
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, n: s.byHour.find((x) => x.hour === h)?.n ?? 0 }));
  const hello = new Date().getHours() < 12 ? 'Buenos días' : new Date().getHours() < 19 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div className="space-y-6">
      <PageTitle title={`${hello}, Erick`} subtitle={longDate(s.today)}
                 actions={<Link to={`/admin/reservas?date=${s.tomorrow}`} className="btn-primary">Ver registrados de mañana →</Link>} />

      <div className="flex flex-wrap gap-2 text-sm">
        <Link to="/admin/horarios" className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-semibold ring-1 ${s.settings.open ? 'bg-igm-100 text-igm-800 ring-igm-200' : 'bg-red-50 text-red-700 ring-red-200'}`}>
          <span className={`h-2 w-2 rounded-full ${s.settings.open ? 'bg-igm-500' : 'bg-red-500'}`} />
          {s.settings.open ? `Reservas abiertas · cierre ${s.settings.cutoff}` : 'Reservas cerradas'}
        </Link>
        <Link to="/admin/cuenta" className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 font-semibold text-igm-700 ring-1 ring-igm-100">
          {s.drive.enabled ? `☁️ Drive: ${s.drive.uploaded ?? 0} subidas${s.drive.failed ? ` · ⚠️ ${s.drive.failed} con error` : ''}` : '☁️ Drive sin configurar'}
        </Link>
      </div>

      {/* Lo que la cocina necesita saber */}
      <section className="overflow-hidden rounded-3xl bg-igm-900 text-white">
        <div className="flex flex-col gap-1 px-6 pt-5 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-lg font-bold">Para mañana · {longDate(s.tomorrow).toLowerCase()}</h2>
          <span className="text-sm text-igm-300">{tomorrow?.reservas ?? 0} reservas · sin contar rechazadas</span>
        </div>
        <div className="grid grid-cols-3 divide-x divide-white/10 px-2 py-5">
          {MEALS.map((m) => (
            <div key={m.key} className="px-4 text-center">
              <div className="text-2xl">{m.emoji}</div>
              <div className="mt-1 text-4xl font-extrabold tabular-nums sm:text-5xl">{tomorrow?.[m.key] ?? 0}</div>
              <div className="text-sm text-igm-300">{m.label}s</div>
            </div>
          ))}
        </div>
        {s.nextServiceDate !== s.tomorrow && (
          <div className="bg-black/20 px-6 py-2 text-sm text-igm-200">Las nuevas reservas ya son para el {longDate(s.nextServiceDate).toLowerCase()}.</div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link to="/admin/reservas?estado=pendiente" className={`card p-4 transition hover:shadow-md ${s.pending.n > 0 ? 'ring-2 ring-oro-400' : ''}`}>
          <div className="text-xs font-semibold uppercase tracking-wide text-igm-500">Pagos por verificar</div>
          <div className="mt-1 text-3xl font-extrabold tabular-nums">{s.pending.n}</div>
          <div className="text-sm text-igm-500">{money(s.pending.cents)} en espera</div>
        </Link>
        <Tile label="Recaudado (14 días)" value={money(s.totals.aprobadoCents)} sub="Solo pagos aprobados" />
        <Tile label="Ranchos (14 días)" value={s.totals.ranchos} sub={`${s.totals.reservas} reservas`} />
        <Tile label="Personas" value={s.totals.personas}
              sub={s.totals.tasaAprobacion === null ? 'Sin pagos revisados' : `${Math.round(s.totals.tasaAprobacion * 100)}% de pagos aprobados`} />
      </div>

      <section className="card p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-bold">Ranchos por día</h2>
          <span className="text-xs text-igm-400">Últimos 14 días y reservas futuras · mañana en negrita</span>
        </div>
        <StackedBars data={s.daily} series={MEALS.map((m) => ({ key: m.key, label: m.label, color: m.color }))}
                     highlight={(d) => d.date === s.tomorrow}
                     tooltipTitle={(d) => longDate(d.date)}
                     xLabel={(d) => {
                       const dt = new Date(`${d.date}T12:00:00`);
                       return <><span className="block">{dt.getDate()}</span><span className="hidden uppercase sm:block">{dt.toLocaleDateString('es-EC', { weekday: 'narrow' })}</span></>;
                     }} />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 text-lg font-bold">Quiénes más reservan</h2>
          {s.topPeople.length === 0 ? <p className="text-sm text-igm-400">Aún no hay reservas.</p> : (
            <ol className="divide-y divide-igm-100">
              {s.topPeople.map((p, i) => (
                <li key={p.cedula} className="flex items-center gap-3 py-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-igm-100 text-sm font-bold text-igm-700">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{p.fullName}</div>
                    <div className="text-xs text-igm-500">{p.reservas} reservas · {money(p.aprobadoCents)} pagado</div>
                  </div>
                  <span className="text-lg font-extrabold tabular-nums">{p.desayuno + p.almuerzo + p.merienda}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="card p-5">
          <h2 className="text-lg font-bold">¿A qué hora reservan?</h2>
          <p className="mb-4 text-xs text-igm-400">Reservas registradas por hora del día (14 días)</p>
          <StackedBars data={hours} height={160} series={[{ key: 'n', label: 'Reservas', color: '#476139' }]}
                       tooltipTitle={(h) => `${String(h.hour).padStart(2, '0')}:00 – ${String(h.hour).padStart(2, '0')}:59`}
                       xLabel={(h) => (h.hour % 3 === 0 ? `${h.hour}h` : '')} />
        </section>
      </div>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-igm-500">{label}</div>
      <div className="mt-1 text-3xl font-extrabold tabular-nums">{value}</div>
      <div className="text-sm text-igm-500">{sub}</div>
    </div>
  );
}

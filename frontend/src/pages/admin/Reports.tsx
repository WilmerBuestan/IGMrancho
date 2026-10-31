import { useEffect, useState } from 'react';
import { addDays, api, downloadCsv, longDate, MEALS, money, shortDate } from '../../api';
import StackedBars from '../../components/charts/StackedBars';
import PageTitle from '../../components/PageTitle';

interface Day { date: string; reservas: number; desayuno: number; almuerzo: number; merienda: number; aprobadoCents: number; pendienteCents: number; pendientes: number; rechazadas: number }
interface Person { cedula: string; fullName: string; email: string; reservas: number; desayuno: number; almuerzo: number; merienda: number; aprobadoCents: number; rechazadas: number }
interface Report { from: string; to: string; days: Day[]; people: Person[] }

const today = () => new Date().toLocaleDateString('en-CA');
function presets(): { key: string; label: string; from: string; to: string }[] {
  const t = today();
  const d = new Date(`${t}T12:00:00`);
  const monday = addDays(t, -((d.getDay() + 6) % 7));
  const firstOfMonth = t.slice(0, 8) + '01';
  const lastMonthEnd = addDays(firstOfMonth, -1);
  return [
    { key: 'manana', label: 'Mañana', from: addDays(t, 1), to: addDays(t, 1) },
    { key: 'hoy', label: 'Hoy', from: t, to: t },
    { key: 'semana', label: 'Esta semana', from: monday, to: addDays(monday, 6) },
    { key: 'mes', label: 'Este mes', from: firstOfMonth, to: addDays(addDays(firstOfMonth, 32).slice(0, 8) + '01', -1) },
    { key: 'mes-pasado', label: 'Mes pasado', from: lastMonthEnd.slice(0, 8) + '01', to: lastMonthEnd },
    { key: '30', label: 'Últimos 30 días', from: addDays(t, -29), to: t },
  ];
}

export default function Reports() {
  const [preset, setPreset] = useState('semana');
  const initial = presets().find((p) => p.key === 'semana')!;
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [tab, setTab] = useState<'dia' | 'persona'>('dia');
  const [r, setR] = useState<Report | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Report>(`/admin/report?from=${from}&to=${to}`, {}, true).then(setR).catch((e) => setError(e.message));
  }, [from, to]);

  const pick = (key: string) => {
    const p = presets().find((x) => x.key === key)!;
    setPreset(key); setFrom(p.from); setTo(p.to);
  };

  const sum = (k: keyof Day) => r?.days.reduce((a, d) => a + (d[k] as number), 0) ?? 0;
  const range = from === to ? longDate(from) : `${longDate(from)} — ${longDate(to)}`;

  return (
    <div className="space-y-5">
      <PageTitle title="Reportes" subtitle={range}
                 actions={<>
                   <button className="btn-ghost" onClick={() => window.print()}>🖨 Imprimir</button>
                   <button className="btn-primary" onClick={() => downloadCsv(`from=${from}&to=${to}`, `igm-rancho-${from}_a_${to}.csv`)}>⬇ Descargar Excel</button>
                 </>} />

      <div className="card flex flex-col gap-3 p-3 lg:flex-row lg:items-center print:hidden">
        <div className="flex gap-1 overflow-x-auto">
          {presets().map((p) => (
            <button key={p.key} onClick={() => pick(p.key)}
                    className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${preset === p.key ? 'bg-igm-800 text-white' : 'text-igm-700 hover:bg-igm-50'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 lg:ml-auto">
          <input type="date" className="input py-2" value={from} onChange={(e) => { setPreset(''); setFrom(e.target.value); }} />
          <span className="text-igm-400">a</span>
          <input type="date" className="input py-2" value={to} onChange={(e) => { setPreset(''); setTo(e.target.value); }} />
        </div>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {r && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Tile label="Reservas" value={sum('reservas')} />
            {MEALS.map((m) => <Tile key={m.key} label={`${m.label}s`} value={sum(m.key)} color={m.color} />)}
            <Tile label="Aprobado" value={money(sum('aprobadoCents'))} />
            <Tile label="Por verificar" value={money(sum('pendienteCents'))} />
          </div>

          {r.days.length > 1 && r.days.length <= 62 && (
            <section className="card p-5 print:break-inside-avoid">
              <h2 className="mb-4 text-lg font-bold">Ranchos por día</h2>
              <StackedBars data={r.days} series={MEALS.map((m) => ({ key: m.key, label: m.label, color: m.color }))}
                           tooltipTitle={(d) => longDate(d.date)}
                           xLabel={(d) => (r.days.length <= 16 || new Date(`${d.date}T12:00:00`).getDate() % 5 === 1 ? new Date(`${d.date}T12:00:00`).getDate() : '')} />
            </section>
          )}

          <section className="card overflow-hidden">
            <div className="flex gap-1 border-b border-igm-100 p-2 print:hidden">
              {([['dia', 'Por día'], ['persona', `Por persona (${r.people.length})`]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === k ? 'bg-igm-100 text-igm-900' : 'text-igm-500 hover:bg-igm-50'}`}>{l}</button>
              ))}
            </div>
            <div className="overflow-x-auto">
              {tab === 'dia' ? (
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-igm-50 text-xs uppercase tracking-wide text-igm-500">
                    <tr><Th left>Fecha</Th><Th>Reservas</Th>{MEALS.map((m) => <Th key={m.key}>{m.label}s</Th>)}<Th>Rechazadas</Th><Th>Aprobado</Th><Th>Por verificar</Th></tr>
                  </thead>
                  <tbody className="divide-y divide-igm-100">
                    {r.days.filter((d) => d.reservas || d.rechazadas).map((d) => (
                      <tr key={d.date}>
                        <Td left>{shortDate(d.date)}</Td><Td>{d.reservas}</Td>{MEALS.map((m) => <Td key={m.key}>{d[m.key]}</Td>)}
                        <Td>{d.rechazadas}</Td><Td>{money(d.aprobadoCents)}</Td><Td>{money(d.pendienteCents)}</Td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-igm-50 font-bold">
                    <tr><Td left>Total</Td><Td>{sum('reservas')}</Td>{MEALS.map((m) => <Td key={m.key}>{sum(m.key)}</Td>)}
                      <Td>{sum('rechazadas')}</Td><Td>{money(sum('aprobadoCents'))}</Td><Td>{money(sum('pendienteCents'))}</Td></tr>
                  </tfoot>
                </table>
              ) : (
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-igm-50 text-xs uppercase tracking-wide text-igm-500">
                    <tr><Th left>Persona</Th><Th>Reservas</Th>{MEALS.map((m) => <Th key={m.key}>{m.label}s</Th>)}<Th>Rechazadas</Th><Th>Pagado</Th></tr>
                  </thead>
                  <tbody className="divide-y divide-igm-100">
                    {r.people.map((p) => (
                      <tr key={p.cedula}>
                        <Td left><div className="font-semibold">{p.fullName}</div><div className="text-xs text-igm-500">{p.cedula} · {p.email}</div></Td>
                        <Td>{p.reservas}</Td>{MEALS.map((m) => <Td key={m.key}>{p[m.key]}</Td>)}<Td>{p.rechazadas}</Td><Td>{money(p.aprobadoCents)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {((tab === 'dia' && sum('reservas') + sum('rechazadas') === 0) || (tab === 'persona' && r.people.length === 0)) && (
                <p className="p-8 text-center text-igm-400">No hay reservas en este rango.</p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

const Th = ({ children, left }: { children: React.ReactNode; left?: boolean }) => <th className={`px-4 py-3 ${left ? 'text-left' : 'text-right'}`}>{children}</th>;
const Td = ({ children, left }: { children: React.ReactNode; left?: boolean }) => <td className={`px-4 py-2.5 ${left ? 'text-left' : 'text-right tabular-nums'}`}>{children}</td>;

function Tile({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-igm-500">
        {color && <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />}{label}
      </div>
      <div className="mt-1 text-2xl font-extrabold tabular-nums">{value}</div>
    </div>
  );
}

import Firma from '../components/Firma';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, longDate, PublicConfig } from '../api';
import Logos from '../components/Logos';

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

export default function Welcome() {
  const [cfg, setCfg] = useState<PublicConfig | null>(null);
  useEffect(() => { api<PublicConfig>('/config').then(setCfg).catch(() => {}); }, []);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-igm-950 text-white">
      {/* Fondo: degradado verde con un brillo dorado suave */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#476139_0%,_#263322_45%,_#121a10_100%)]" />
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-oro-400/10 blur-3xl" />

      <main className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-5 py-10 text-center">
        <div className="flex items-center justify-center gap-4 sm:gap-6">
          <Logos className="h-20 sm:h-28 p-2 shadow-xl shadow-black/30" />
        </div>

        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.3em] text-oro-400">{greeting()}</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-6xl">
          Bienvenido a <span className="text-oro-400">IGM Rancho</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-igm-200 sm:text-lg">
          Reserva tu desayuno, almuerzo o merienda del Instituto Geográfico Militar de forma rápida y sin filas.
        </p>

        {cfg && (
          <div className="mt-6 max-w-full rounded-2xl bg-white/10 px-4 py-2 text-sm ring-1 ring-white/15 backdrop-blur sm:rounded-full">
            <span className={`mr-2 inline-block h-2 w-2 rounded-full align-middle ${cfg.open ? 'bg-emerald-400' : 'bg-red-400'}`} />
            {cfg.open
              ? <>Reservas abiertas para el <b>{longDate(cfg.serviceDate).toLowerCase()}</b> hasta las {cfg.cutoff}</>
              : 'Reservas cerradas por el momento'}
          </div>
        )}

        <div className="mt-10 grid w-full max-w-3xl gap-4 sm:grid-cols-2">
          <Link to="/reservar"
                className="group rounded-3xl bg-white p-6 text-left text-igm-950 shadow-2xl shadow-black/30 transition hover:-translate-y-1 sm:p-8">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-oro-400 text-3xl">🍽️</div>
            <h2 className="mt-5 text-2xl font-extrabold">Reservar mi rancho</h2>
            <p className="mt-1 text-igm-600">Elige tus ranchos, paga con el QR y sube tu comprobante.</p>
            <span className="mt-5 inline-flex items-center gap-2 font-bold text-igm-800">
              Entrar como cliente <span className="transition group-hover:translate-x-1">→</span>
            </span>
          </Link>
          <Link to="/admin"
                className="group rounded-3xl bg-white/5 p-6 text-left ring-1 ring-white/15 backdrop-blur transition hover:-translate-y-1 hover:bg-white/10 sm:p-8">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-3xl">🛡️</div>
            <h2 className="mt-5 text-2xl font-extrabold">Administración</h2>
            <p className="mt-1 text-igm-200">Verifica pagos, revisa estadísticas y configura el servicio.</p>
            <span className="mt-5 inline-flex items-center gap-2 font-bold text-oro-400">
              Entrar como administrador <span className="transition group-hover:translate-x-1">→</span>
            </span>
          </Link>
        </div>

        <Link to="/mis-reservas" className="mt-6 text-sm text-igm-300 underline-offset-4 hover:text-white hover:underline">
          ¿Ya reservaste? Consulta el estado de tus reservas
        </Link>
      </main>

      <footer className="relative pb-6 text-center text-xs text-igm-400">
        Instituto Geográfico Militar · Ministerio de Defensa Nacional
        <div className="mt-2 space-x-3">
          <Link to="/privacidad" className="hover:text-white">Privacidad</Link>
          <Link to="/terminos" className="hover:text-white">Términos</Link>
        </div>
        <Firma dark className="mt-3" />
      </footer>
    </div>
  );
}

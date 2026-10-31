import { NavLink, Outlet } from 'react-router-dom';
import Header from '../../components/Header';

const LINKS = [
  { to: '/', label: 'Inicio', icon: '🏠', end: true },
  { to: '/reservar', label: 'Reservar', icon: '🍽️', end: false },
  { to: '/mis-reservas', label: 'Mis reservas', icon: '🧾', end: false },
];

export default function UserLayout() {
  return (
    <div className="min-h-screen">
      <Header>
        <nav className="hidden rounded-xl bg-white/10 p-1 text-sm font-semibold sm:flex">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}
                     className={({ isActive }) => `rounded-lg px-4 py-2 transition ${isActive ? 'bg-white text-igm-900' : 'text-igm-100 hover:bg-white/10'}`}>
              {l.label}
            </NavLink>
          ))}
        </nav>
      </Header>
      <main className="mx-auto max-w-6xl px-4 py-6 pb-28 sm:py-10">
        <Outlet />
      </main>
      {/* Barra de pestañas inferior en celular */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-igm-100 bg-white/95 backdrop-blur sm:hidden"
           style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end}
                   className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-xs font-semibold ${isActive ? 'text-igm-900' : 'text-igm-400'}`}>
            <span className="text-xl">{l.icon}</span>{l.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { adminToken, api } from '../../api';
import Logos from '../../components/Logos';

const MENU = [
  { to: '/admin', label: 'Dashboard', icon: '📊', end: true },
  { to: '/admin/reservas', label: 'Registrados del día', icon: '🧾', end: false },
  { to: '/admin/reportes', label: 'Reportes', icon: '📑', end: false },
  { to: '/admin/precios', label: 'Precios y menú', icon: '💲', end: false },
  { to: '/admin/horarios', label: 'Fechas y horarios', icon: '🗓️', end: false },
  { to: '/admin/cuenta', label: 'Cuenta, QR y Drive', icon: '🏦', end: false },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const logged = Boolean(adminToken.get());

  useEffect(() => {
    const out = () => navigate('/admin/login', { replace: true });
    window.addEventListener('igm-logout', out);
    return () => window.removeEventListener('igm-logout', out);
  }, [navigate]);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  // Contador de pagos por verificar en el menú
  useEffect(() => {
    if (!logged) return;
    const load = () => api<{ pending: { n: number } }>('/admin/stats', {}, true).then((s) => setPending(s.pending.n)).catch(() => {});
    load();
    const i = setInterval(load, 60_000);
    return () => clearInterval(i);
  }, [logged, location.pathname]);

  if (!logged) return <Navigate to="/admin/login" replace />;

  const logout = () => { adminToken.clear(); navigate('/', { replace: true }); };
  const current = MENU.find((m) => (m.end ? location.pathname === m.to : location.pathname.startsWith(m.to)));

  const nav = (
    <nav className="space-y-1">
      {MENU.map((m) => (
        <NavLink key={m.to} to={m.to} end={m.end}
                 className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition
                   ${isActive ? 'bg-white text-igm-900 shadow' : 'text-igm-100 hover:bg-white/10'}`}>
          <span className="text-lg">{m.icon}</span>
          <span className="flex-1">{m.label}</span>
          {m.to === '/admin/reservas' && pending > 0 && (
            <span className="rounded-full bg-oro-400 px-2 py-0.5 text-xs font-extrabold text-igm-950">{pending}</span>
          )}
        </NavLink>
      ))}
    </nav>
  );

  const sidebarFooter = (
    <div className="space-y-1 border-t border-white/10 pt-4">
      <a href="/reservar" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-igm-300 hover:bg-white/10 hover:text-white">
        <span>↗</span> Ver página de reservas
      </a>
      <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-igm-300 hover:bg-white/10 hover:text-white">
        <span>⏻</span> Cerrar sesión
      </button>
    </div>
  );

  const brand = (
    <div className="flex items-center gap-2">
      <Logos className="h-9" />
      <div className="leading-tight">
        <div className="font-extrabold">IGM <span className="text-oro-400">Rancho</span></div>
        <div className="text-xs text-igm-300">Administración</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-72">
      {/* Menú lateral en computadora */}
      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col gap-6 bg-igm-900 p-5 text-white lg:flex print:hidden">
        {brand}
        <div className="flex-1">{nav}</div>
        {sidebarFooter}
      </aside>

      {/* Barra superior + menú desplegable en celular/tablet */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-igm-900 px-4 py-3 text-white lg:hidden print:hidden">
        {brand}
        <button onClick={() => setMenuOpen(true)} className="relative rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold">
          ☰ Menú
          {pending > 0 && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-oro-400" />}
        </button>
      </header>
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-igm-950/60 backdrop-blur-sm" />
          <div className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col gap-6 bg-igm-900 p-5 text-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="font-bold">Menú</span>
              <button onClick={() => setMenuOpen(false)} className="text-2xl text-igm-300">×</button>
            </div>
            <div className="flex-1">{nav}</div>
            {sidebarFooter}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-igm-400 print:hidden">{current?.label}</p>
        <Outlet />
      </main>
    </div>
  );
}

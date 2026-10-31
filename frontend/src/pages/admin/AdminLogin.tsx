import Firma from '../../components/Firma';
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminToken, api } from '../../api';
import Logos from '../../components/Logos';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { token } = await api<{ token: string }>('/admin/login', { method: 'POST', body: JSON.stringify({ user, password }) });
      adminToken.set(token);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_top,_#476139_0%,_#263322_45%,_#121a10_100%)] p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6 sm:p-8">
        <div className="flex justify-center gap-3"><Logos className="h-14" /></div>
        <div className="text-center">
          <div className="text-2xl font-extrabold">IGM <span className="text-oro-500">Rancho</span></div>
          <div className="text-sm text-igm-500">Acceso de administración</div>
        </div>
        <div>
          <label className="label" htmlFor="u">Usuario</label>
          <input id="u" className="input" autoComplete="username" value={user} onChange={(e) => setUser(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="p">Contraseña</label>
          <input id="p" type="password" className="input" autoComplete="current-password" value={password}
                 onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" disabled={loading}>{loading ? 'Entrando…' : 'Entrar'}</button>
        <Link to="/" className="block text-center text-sm text-igm-500 hover:text-igm-900">← Volver al inicio</Link>
        <Firma />
      </form>
    </div>
  );
}

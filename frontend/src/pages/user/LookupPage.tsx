import Contacto from '../../components/Contacto';
import { FormEvent, useEffect, useState } from 'react';
import { api, Contact, longDate, mealsText, money, PublicConfig, Reservation } from '../../api';
import Receipt from '../../components/Receipt';
import StatusBadge from '../../components/StatusBadge';

export default function LookupPage() {
  const saved = JSON.parse(localStorage.getItem('igm-rancho-perfil') ?? '{}');
  const [cedula, setCedula] = useState<string>(saved.cedula ?? '');
  const [email, setEmail] = useState<string>(saved.email ?? '');
  const [list, setList] = useState<Reservation[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function search(e?: FormEvent) {
    e?.preventDefault();
    setError('');
    setLoading(true);
    try {
      setList(await api<Reservation[]>(`/reservations/lookup?cedula=${encodeURIComponent(cedula)}&email=${encodeURIComponent(email)}`));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const [contact, setContact] = useState<Contact | null>(null);
  useEffect(() => { api<PublicConfig>('/config').then((c) => setContact(c.contact)).catch(() => {}); }, []);

  useEffect(() => {
    if (cedula && email) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-extrabold tracking-tight">Mis reservas</h1>
      <Contacto contact={contact} title="¿Algo está mal en tu reserva?" />
      <form onSubmit={search} className="card grid gap-3 p-5 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="lk-ced">Cédula</label>
          <input id="lk-ced" className="input" inputMode="numeric" maxLength={10} required
                 value={cedula} onChange={(e) => setCedula(e.target.value.replace(/\D/g, ''))} />
        </div>
        <div>
          <label className="label" htmlFor="lk-mail">Correo institucional</label>
          <input id="lk-mail" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button className="btn-primary" disabled={loading}>{loading ? 'Buscando…' : 'Buscar'}</button>
      </form>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {list && list.length === 0 && <p className="card p-8 text-center text-igm-500">No encontramos reservas con esos datos.</p>}
      <div className="space-y-3">
        {list?.map((r) => (
          <article key={r.id} className="card flex gap-4 p-4">
            {r.receiptUrl
              ? <Receipt url={r.receiptUrl} mime={r.receiptMime ?? ''} className="h-20 w-20 shrink-0" />
              : <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-igm-100 text-2xl" title="Registrada por la administración">💵</div>}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold">{longDate(r.serviceDate)}</span>
                <StatusBadge status={r.status} />
              </div>
              <div className="mt-1 text-sm text-igm-600">{mealsText(r)}</div>
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="font-mono text-igm-500">{r.code}</span>
                <span className="font-extrabold">{money(r.totalCents)}</span>
              </div>
              {r.adminNote && <p className="mt-2 rounded-lg bg-igm-50 px-3 py-2 text-sm text-igm-700">💬 {r.adminNote}</p>}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

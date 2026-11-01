import Contacto from '../../components/Contacto';
import { AppDownloadBanner } from '../../components/AppDownload';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Contact, isValidCedula, longDate, Meal, MEALS, mealsText, money, PublicConfig } from '../../api';
import Stepper from '../../components/Stepper';

const PROFILE_KEY = 'igm-rancho-perfil';

interface Created { code: string; serviceDate: string; totalCents: number; desayuno: number; almuerzo: number; merienda: number }

export default function ReservePage() {
  const navigate = useNavigate();
  const onLookup = () => navigate('/mis-reservas');
  const [cfg, setCfg] = useState<PublicConfig | null>(null);
  const [loadError, setLoadError] = useState('');
  const [qty, setQty] = useState<Record<Meal, number>>({ desayuno: 0, almuerzo: 0, merienda: 0 });
  const saved = useMemo(() => JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '{}'), []);
  const [fullName, setFullName] = useState<string>(saved.fullName ?? '');
  const [cedula, setCedula] = useState<string>(saved.cedula ?? '');
  const [email, setEmail] = useState<string>(saved.email ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<PublicConfig>('/config').then(setCfg).catch((e) => setLoadError(e.message));
  }, []);

  useEffect(() => {
    if (!file || file.type === 'application/pdf') return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const count = qty.desayuno + qty.almuerzo + qty.merienda;
  const total = cfg ? MEALS.reduce((a, m) => a + qty[m.key] * cfg.prices[m.key], 0) : 0;

  if (loadError) return <div className="card p-8 text-center text-red-700">{loadError}</div>;
  if (!cfg) return <div className="card animate-pulse p-8 text-center text-igm-400">Cargando…</div>;
  if (created) return <Success contact={cfg.contact} created={created} onAgain={() => { setCreated(null); setQty({ desayuno: 0, almuerzo: 0, merienda: 0 }); setFile(null); }} onLookup={onLookup} />;

  const emailOk = email.trim().toLowerCase().endsWith(`@${cfg.emailDomain}`);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (count === 0) return setError('Elige al menos un rancho.');
    if (!isValidCedula(cedula)) return setError('Revisa tu número de cédula.');
    if (!emailOk) return setError(`Usa tu correo institucional @${cfg!.emailDomain}`);
    if (!file) return setError('Sube la captura de tu transferencia.');

    const fd = new FormData();
    fd.append('fullName', fullName);
    fd.append('cedula', cedula);
    fd.append('email', email);
    MEALS.forEach((m) => fd.append(m.key, String(qty[m.key])));
    fd.append('comprobante', file);
    setSending(true);
    try {
      const r = await api<Created>('/reservations', { method: 'POST', body: fd });
      localStorage.setItem(PROFILE_KEY, JSON.stringify({ fullName, cedula, email }));
      setCreated(r);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (!cfg.open) {
    return (
      <div className="card mx-auto max-w-lg p-10 text-center">
        <div className="text-5xl">🔒</div>
        <h1 className="mt-4 text-2xl font-extrabold">Reservas cerradas</h1>
        <p className="mt-2 text-igm-600">Por el momento no se están recibiendo reservas. {cfg.notice}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8">
      {/* 1. Ranchos */}
      <section className="space-y-5 lg:col-start-1">
        <AppDownloadBanner />
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Reserva tu rancho</h1>
          <p className="mt-2 text-igm-600">
            Para el <b className="text-igm-900">{longDate(cfg.serviceDate).toLowerCase()}</b>. Puedes reservar hasta el{' '}
            {longDate(cfg.deadline.slice(0, 10)).toLowerCase()} a las {cfg.cutoff}.
          </p>
        </div>
        {cfg.closedDates.length > 0 && (
          <p className="text-sm text-igm-500">Sin servicio: {cfg.closedDates.slice(0, 4).map((d) => longDate(d)).join(' · ')}</p>
        )}
        {cfg.notice && (
          <div className="rounded-2xl border border-oro-400/50 bg-oro-300/20 p-4 text-sm text-igm-900 whitespace-pre-line">
            📣 {cfg.notice}
          </div>
        )}
        <div className="card divide-y divide-igm-100">
          <StepTitle n={1} title="¿Qué vas a reservar?" />
          {MEALS.map((m) => (
            <div key={m.key} className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-igm-50 text-2xl">{m.emoji}</span>
                <div>
                  <div className="font-bold">{m.label}</div>
                  <div className="text-sm text-igm-500">{money(cfg.prices[m.key])} c/u</div>
                </div>
              </div>
              <Stepper value={qty[m.key]} onChange={(v) => setQty({ ...qty, [m.key]: v })} />
            </div>
          ))}
        </div>
      </section>

      {/* 2. Pago (columna derecha fija en computadora) */}
      <aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <div className="card overflow-hidden lg:sticky lg:top-24">
          <StepTitle n={2} title="Transfiere el valor" />
          <div className="px-5 pb-5">
            <div className="flex items-baseline justify-between rounded-2xl bg-igm-900 px-5 py-4 text-white">
              <span className="text-sm text-igm-300">{count === 0 ? 'Total a pagar' : `${count} rancho${count > 1 ? 's' : ''}`}</span>
              <span className="text-3xl font-extrabold text-oro-400 tabular-nums">{money(total)}</span>
            </div>
            {cfg.qrUrl ? (
              <img src={cfg.qrUrl} alt="QR de pago" className="mx-auto mt-4 aspect-square w-full max-w-[280px] rounded-2xl object-contain ring-1 ring-igm-100" />
            ) : (
              <div className="mt-4 grid aspect-square w-full place-items-center rounded-2xl bg-igm-50 text-sm text-igm-400">QR pendiente</div>
            )}
            <AccountInfo cfg={cfg} />
            <Contacto contact={cfg.contact} className="mt-5 !shadow-none !ring-igm-100" />
          </div>
        </div>
      </aside>

      {/* 3. Datos + comprobante */}
      <section ref={formRef} className="lg:col-start-1">
        <div className="card">
          <StepTitle n={3} title="Tus datos y la captura" />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="fullName">Grado y nombre completo</label>
              <input id="fullName" className="input" required minLength={5} autoComplete="name"
                     placeholder="Ej. Sgos. Juan Pérez" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="cedula">Cédula</label>
              <input id="cedula" className="input" required inputMode="numeric" maxLength={10} placeholder="1712345678"
                     value={cedula} onChange={(e) => setCedula(e.target.value.replace(/\D/g, ''))} />
              {cedula.length === 10 && !isValidCedula(cedula) && <p className="mt-1 text-xs text-red-600">Cédula no válida</p>}
            </div>
            <div>
              <label className="label" htmlFor="email">Correo institucional</label>
              <input id="email" className="input" required type="email" autoComplete="email" placeholder={`usuario@${cfg.emailDomain}`}
                     value={email} onChange={(e) => setEmail(e.target.value)} />
              {email.includes('@') && !emailOk && <p className="mt-1 text-xs text-red-600">Debe terminar en @{cfg.emailDomain}</p>}
            </div>
            <div className="sm:col-span-2">
              <span className="label">Captura de la transferencia</span>
              <label className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed p-4 transition
                                 ${file ? 'border-igm-400 bg-igm-50' : 'border-igm-200 hover:border-igm-400 hover:bg-igm-50'}`}>
                {preview ? (
                  <img src={preview} alt="" className="h-20 w-20 rounded-xl object-cover" />
                ) : (
                  <span className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-igm-100 text-3xl">{file ? '📄' : '📷'}</span>
                )}
                <span className="min-w-0">
                  <span className="block font-semibold">{file ? file.name : 'Toca para subir la captura'}</span>
                  <span className="block text-sm text-igm-500">{file ? 'Toca para cambiarla' : 'Imagen o PDF, máx. 15 MB'}</span>
                </span>
                <input type="file" accept="image/*,application/pdf" className="sr-only"
                       onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
            {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 sm:col-span-2">{error}</p>}
            <button type="submit" disabled={sending} className="btn-primary py-4 text-lg sm:col-span-2">
              {sending ? 'Enviando…' : `Confirmar reserva · ${money(total)}`}
            </button>
          </div>
        </div>
      </section>

      {/* Barra inferior en celular para no perder de vista el total */}
      {count > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(3.6rem+env(safe-area-inset-bottom))] z-20 border-t border-igm-100 bg-white/95 px-4 py-3 shadow-[0_-8px_20px_rgba(0,0,0,0.06)] backdrop-blur sm:bottom-0 lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="leading-tight">
              <div className="text-xs text-igm-500">{count} rancho{count > 1 ? 's' : ''}</div>
              <div className="text-xl font-extrabold tabular-nums">{money(total)}</div>
            </div>
            <button type="button" className="btn-gold" onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth' })}>
              Continuar
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

function StepTitle({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-oro-400 text-sm font-extrabold text-igm-950">{n}</span>
      <h2 className="text-lg font-bold">{title}</h2>
    </div>
  );
}

function AccountInfo({ cfg }: { cfg: PublicConfig }) {
  const [copied, setCopied] = useState(false);
  const a = cfg.account;
  const rows = [['Titular', a.titular], ['Banco', a.banco], ['Cuenta', a.tipo], ['Cédula', a.cedula]].filter(([, v]) => v);
  return (
    <div className="mt-4 space-y-2 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3">
          <span className="text-igm-500">{k}</span>
          <span className="text-right font-semibold">{v}</span>
        </div>
      ))}
      {a.numero && (
        <button type="button" className="btn-ghost mt-2 w-full justify-between"
                onClick={() => navigator.clipboard?.writeText(a.numero).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}>
          <span className="font-mono text-base tracking-wider">{a.numero}</span>
          <span className="text-xs">{copied ? '¡Copiado!' : 'Copiar'}</span>
        </button>
      )}
    </div>
  );
}

function Success({ created, onAgain, onLookup, contact }: { created: Created; onAgain: () => void; onLookup: () => void; contact: Contact }) {
  return (
    <div className="card mx-auto max-w-lg overflow-hidden text-center">
      <div className="bg-igm-900 px-6 py-8 text-white">
        <div className="text-5xl">✅</div>
        <h1 className="mt-3 text-2xl font-extrabold">¡Reserva enviada!</h1>
        <p className="mt-1 text-igm-300">Tu pago será verificado por la administración.</p>
      </div>
      <div className="space-y-4 p-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-igm-500">Código de reserva</div>
          <div className="mt-1 font-mono text-3xl font-extrabold tracking-wider text-igm-900">{created.code}</div>
        </div>
        <div className="rounded-2xl bg-igm-50 p-4 text-sm">
          <div className="font-semibold">{longDate(created.serviceDate)}</div>
          <div className="text-igm-600">{mealsText(created)}</div>
          <div className="mt-1 text-lg font-extrabold">{money(created.totalCents)}</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button className="btn-ghost" onClick={onLookup}>Ver mis reservas</button>
          <button className="btn-primary" onClick={onAgain}>Hacer otra reserva</button>
        </div>
        <Contacto contact={contact} title="¿Te equivocaste en algo?" className="!shadow-none !ring-igm-100" />
      </div>
    </div>
  );
}

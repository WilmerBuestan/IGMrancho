import { useEffect, useState } from 'react';

const APK_URL = '/descargas/IGM-Rancho.apk';

interface AppInfo { version: string; sizeMb: number; date: string }

function useAppInfo(): AppInfo | null {
  const [info, setInfo] = useState<AppInfo | null>(null);
  useEffect(() => {
    fetch('/descargas/app.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setInfo)
      .catch(() => {});
  }, []);
  return info;
}

const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isAndroid = () => /Android/i.test(navigator.userAgent);

/** Botón grande para la pantalla de bienvenida. */
export function AppDownloadCard() {
  const info = useAppInfo();
  if (!info) return null;
  if (isIOS()) {
    return <p className="mt-6 text-sm text-igm-300">📱 La app es para Android. En iPhone usa esta misma página: funciona igual.</p>;
  }
  return (
    <a href={APK_URL} download
       className="group mt-6 flex w-full max-w-3xl items-center gap-4 rounded-3xl bg-oro-400 p-4 text-left text-igm-950 shadow-xl shadow-black/30 transition hover:-translate-y-0.5 hover:bg-oro-300 sm:p-5">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-igm-950 text-2xl">📲</span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-extrabold">Descargar la app para Android</span>
        <span className="block text-sm text-igm-800">
          Versión {info.version} · {info.sizeMb} MB · con avisos cuando tu pago sea aprobado
        </span>
      </span>
      <span className="text-2xl transition group-hover:translate-y-0.5">⬇</span>
    </a>
  );
}

/** Aviso pequeño en la página de reservas, solo en celulares Android. */
export function AppDownloadBanner() {
  const info = useAppInfo();
  const [hidden, setHidden] = useState(() => localStorage.getItem('igm-app-banner') === 'no');
  if (!info || hidden || !isAndroid()) return null;
  const close = () => { localStorage.setItem('igm-app-banner', 'no'); setHidden(true); };
  return (
    <div className="mb-5 flex items-center gap-3 rounded-2xl bg-igm-900 p-3 text-white">
      <span className="text-2xl">📲</span>
      <div className="min-w-0 flex-1 text-sm leading-tight">
        <b>¿Prefieres la app?</b>
        <span className="block text-igm-300">Reserva más rápido y recibe avisos de tu pago.</span>
      </div>
      <a href={APK_URL} download className="rounded-xl bg-oro-400 px-3 py-2 text-sm font-bold text-igm-950">Descargar</a>
      <button onClick={close} aria-label="Cerrar" className="px-1 text-xl text-igm-400">×</button>
    </div>
  );
}

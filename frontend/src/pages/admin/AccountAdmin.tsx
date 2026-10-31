import { useEffect, useState } from 'react';
import { Account, api } from '../../api';
import PageTitle, { SaveBar } from '../../components/PageTitle';
import { useSettings } from '../../hooks/useSettings';

const FIELDS: [keyof Account, string][] = [
  ['titular', 'Titular'], ['cedula', 'Cédula del titular'], ['banco', 'Banco'], ['tipo', 'Tipo de cuenta'], ['numero', 'Número de cuenta'],
];

export default function AccountAdmin() {
  const { settings, setSettings, save, saving, msg, setMsg } = useSettings();
  const [account, setAccount] = useState<Account | null>(null);
  const [qrVersion, setQrVersion] = useState(Date.now());

  useEffect(() => { if (settings) setAccount(settings.account); }, [settings]);
  if (!settings || !account) return <p className="text-igm-500">{msg || 'Cargando…'}</p>;

  async function uploadQr(file: File) {
    const fd = new FormData();
    fd.append('qr', file);
    try {
      await api('/admin/qr', { method: 'POST', body: fd }, true);
      setSettings({ ...settings!, qrFile: 'nuevo' });
      setQrVersion(Date.now());
      setMsg('✓ QR actualizado');
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function retryDrive() {
    await api('/admin/drive/retry', { method: 'POST' }, true);
    setMsg('✓ Reintentando subidas a Drive');
  }

  return (
    <div>
      <PageTitle title="Cuenta, QR y Drive" subtitle="Datos que ve el personal para hacer la transferencia." />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="card p-5">
          <h2 className="mb-4 text-lg font-bold">Cuenta para transferencias</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map(([k, label]) => (
              <div key={k} className={k === 'numero' ? 'sm:col-span-2' : ''}>
                <label className="label" htmlFor={`a-${k}`}>{label}</label>
                <input id={`a-${k}`} className={`input ${k === 'numero' ? 'font-mono text-lg tracking-wider' : ''}`}
                       value={account[k]} onChange={(e) => setAccount({ ...account, [k]: e.target.value })} />
              </div>
            ))}
          </div>
        </section>
        <section className="card flex flex-col items-center gap-4 p-5 text-center">
          <h2 className="self-start text-lg font-bold">Código QR</h2>
          {settings.qrFile
            ? <img src={`/api/qr?v=${qrVersion}`} alt="QR" className="aspect-square w-full max-w-[240px] rounded-2xl object-contain ring-1 ring-igm-100" />
            : <div className="grid aspect-square w-full max-w-[240px] place-items-center rounded-2xl bg-igm-50 text-sm text-igm-400">Sin QR</div>}
          <label className="btn-ghost w-full cursor-pointer">
            {settings.qrFile ? 'Cambiar imagen del QR' : 'Subir imagen del QR'}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && uploadQr(e.target.files[0])} />
          </label>
        </section>
        <section className="card space-y-3 p-5 lg:col-span-2">
          <h2 className="text-lg font-bold">Google Drive</h2>
          <p className="text-sm text-igm-600">
            {settings.driveEnabled
              ? '✅ Conectado. Las capturas se suben a la carpeta “IGM Rancho”, con una subcarpeta por fecha.'
              : '⚠️ No configurado. Agrega GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REFRESH_TOKEN en el .env del servidor. Mientras tanto, las capturas se guardan en el servidor.'}
          </p>
          {settings.driveEnabled && (
            <div className="flex flex-wrap gap-2">
              {settings.driveFolderUrl && <a className="btn-primary" href={settings.driveFolderUrl} target="_blank" rel="noreferrer">Abrir carpeta en Drive ↗</a>}
              <button className="btn-ghost" onClick={retryDrive}>Reintentar subidas fallidas</button>
            </div>
          )}
        </section>
      </div>
      <SaveBar msg={msg} saving={saving} onSave={() => save({ account })} />
    </div>
  );
}

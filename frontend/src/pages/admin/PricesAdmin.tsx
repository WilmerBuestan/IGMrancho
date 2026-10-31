import { useEffect, useState } from 'react';
import { Meal, MEALS, money } from '../../api';
import PageTitle, { SaveBar } from '../../components/PageTitle';
import { useSettings } from '../../hooks/useSettings';

export default function PricesAdmin() {
  const { settings, save, saving, msg } = useSettings();
  const [prices, setPrices] = useState<Record<Meal, string>>({ desayuno: '', almuerzo: '', merienda: '' });
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!settings) return;
    setPrices(Object.fromEntries(MEALS.map((m) => [m.key, (settings.prices[m.key] / 100).toFixed(2)])) as Record<Meal, string>);
    setNotice(settings.notice);
  }, [settings]);

  if (!settings) return <p className="text-igm-500">{msg || 'Cargando…'}</p>;
  const cents = (m: Meal) => Math.round(parseFloat(prices[m] || '0') * 100);

  return (
    <div>
      <PageTitle title="Precios y menú" subtitle="Los cambios aplican a las reservas nuevas; las ya hechas mantienen su precio." />
      <div className="grid gap-4 sm:grid-cols-3">
        {MEALS.map((m) => (
          <div key={m.key} className="card p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-igm-50 text-2xl">{m.emoji}</span>
              <div>
                <div className="font-bold">{m.label}</div>
                <div className="text-xs text-igm-500">Actual: {money(settings.prices[m.key])}</div>
              </div>
            </div>
            <label className="label mt-4" htmlFor={`p-${m.key}`}>Precio ($)</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-igm-400">$</span>
              <input id={`p-${m.key}`} className="input pl-8 text-xl font-bold" inputMode="decimal" value={prices[m.key]}
                     onChange={(e) => setPrices({ ...prices, [m.key]: e.target.value.replace(',', '.') })} />
            </div>
          </div>
        ))}
      </div>

      <div className="card mt-5 p-5">
        <h2 className="text-lg font-bold">Menú del día / aviso</h2>
        <p className="text-sm text-igm-500">Se muestra arriba en la página de reservas. Déjalo vacío para no mostrar nada.</p>
        <textarea className="input mt-3 min-h-[120px]" placeholder={'Ej.\nDesayuno: bolón con café\nAlmuerzo: seco de pollo\nMerienda: arroz con menestra'}
                  value={notice} onChange={(e) => setNotice(e.target.value)} />
      </div>

      <SaveBar msg={msg} saving={saving}
               onSave={() => save({ prices: { desayuno: cents('desayuno'), almuerzo: cents('almuerzo'), merienda: cents('merienda') }, notice })} />
    </div>
  );
}

export default function Stepper({ value, onChange, max = 20 }: { value: number; onChange: (v: number) => void; max?: number }) {
  const btn = 'grid h-11 w-11 place-items-center rounded-xl text-xl font-bold transition disabled:opacity-30';
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label="Quitar" className={`${btn} bg-igm-100 text-igm-800 hover:bg-igm-200`}
              disabled={value <= 0} onClick={() => onChange(value - 1)}>−</button>
      <span className="w-8 text-center text-xl font-bold tabular-nums">{value}</span>
      <button type="button" aria-label="Agregar" className={`${btn} bg-igm-800 text-white hover:bg-igm-700`}
              disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}

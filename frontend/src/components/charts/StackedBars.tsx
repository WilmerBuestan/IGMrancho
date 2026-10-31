import { ReactNode, useState } from 'react';

export interface Series { key: string; label: string; color: string }

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => v / s <= 4)!;
  return Math.ceil(v / step) * step;
}

/**
 * Barras apiladas en HTML: segmentos con 2px de separación, extremo superior
 * redondeado, rejilla tenue y tooltip por columna (la zona de hover es toda la columna).
 */
export default function StackedBars<T extends object>({
  data, series, xLabel, tooltipTitle, highlight, height = 220,
}: {
  data: T[];
  series: Series[];
  xLabel: (row: T) => ReactNode;
  tooltipTitle: (row: T) => ReactNode;
  highlight?: (row: T) => boolean;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const val = (r: T, k: string) => Number((r as Record<string, unknown>)[k] ?? 0);
  const total = (r: T) => series.reduce((a, s) => a + val(r, s.key), 0);
  const max = niceMax(Math.max(0, ...data.map(total)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-igm-700">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm" style={{ background: s.color }} />{s.label}
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        {/* Eje Y */}
        <div className="relative w-7 shrink-0 text-right text-[11px] tabular-nums text-igm-400" style={{ height }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(t / max) * 100}%`, transform: 'translateY(50%)' }}>{t}</span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height }}>
            {ticks.map((t) => (
              <div key={t} className={`absolute inset-x-0 border-t ${t === 0 ? 'border-igm-300' : 'border-dashed border-igm-100'}`}
                   style={{ bottom: `${(t / max) * 100}%` }} />
            ))}
            <div className="absolute inset-0 flex items-end">
              {data.map((row, i) => {
                const t = total(row);
                const visible = series.filter((s) => val(row, s.key) > 0);
                return (
                  <div key={i} className="relative flex h-full flex-1 cursor-default items-end justify-center"
                       onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                       onClick={() => setHover(hover === i ? null : i)}>
                    {hover === i && <div className="absolute inset-y-0 inset-x-0.5 rounded-md bg-igm-900/[0.04]" />}
                    <div className="relative flex w-[58%] max-w-[28px] flex-col-reverse gap-[2px]" style={{ height: `${(t / max) * 100}%` }}>
                      {visible.map((s, j) => (
                        <div key={s.key}
                             className={j === visible.length - 1 ? 'rounded-t-[4px]' : ''}
                             style={{ background: s.color, flexGrow: val(row, s.key), flexBasis: 0, minHeight: 2 }} />
                      ))}
                    </div>
                    {hover === i && (
                      <div className={`pointer-events-none absolute bottom-full z-10 mb-2 w-44 rounded-xl bg-white p-3 text-left text-xs shadow-xl ring-1 ring-igm-900/10
                                       ${i < data.length / 2 ? 'left-0' : 'right-0'}`}>
                        <div className="mb-1.5 font-bold text-igm-900">{tooltipTitle(row)}</div>
                        {series.map((s) => (
                          <div key={s.key} className="flex items-center justify-between gap-2 text-igm-700">
                            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />{s.label}</span>
                            <b className="tabular-nums text-igm-900">{val(row, s.key)}</b>
                          </div>
                        ))}
                        {series.length > 1 && (
                          <div className="mt-1.5 flex justify-between border-t border-igm-100 pt-1.5 font-bold text-igm-900"><span>Total</span><span>{t}</span></div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-1.5 flex">
            {data.map((row, i) => (
              <div key={i} className={`flex-1 text-center text-[10px] leading-tight sm:text-[11px] ${highlight?.(row) ? 'font-bold text-igm-900' : 'text-igm-400'}`}>
                {xLabel(row)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Firma del desarrollador: pequeña pero visible en todas las pantallas. */
export default function Firma({ dark = false, className = '' }: { dark?: boolean; className?: string }) {
  return (
    <p className={`text-center text-[11px] tracking-wide ${dark ? 'text-igm-300' : 'text-igm-500'} ${className}`}>
      Desarrollado por <span className={`font-bold ${dark ? 'text-oro-400' : 'text-igm-800'}`}>Wilmer Buestán</span>
    </p>
  );
}

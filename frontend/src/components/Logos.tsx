import { useState } from 'react';

/** Logo que se oculta solo si el archivo todavía no existe en /public. */
export function Logo({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return <img src={src} alt={alt} onError={() => setOk(false)} className={`object-contain ${className}`} />;
}

export default function Logos({ className = 'h-10 sm:h-12' }: { className?: string }) {
  return (
    <>
      <Logo src="/logo-ministerio.png" alt="Ministerio de Defensa Nacional" className={`w-auto rounded-lg bg-white/95 p-1 ${className}`} />
      <Logo src="/logo-igm.png" alt="Instituto Geográfico Militar" className={`w-auto rounded-lg bg-white/95 p-1 ${className}`} />
    </>
  );
}

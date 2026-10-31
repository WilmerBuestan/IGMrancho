/** Miniatura del comprobante: imagen o ícono de PDF, abre en otra pestaña. */
export default function Receipt({ url, mime, className = '' }: { url: string; mime: string; className?: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer"
       className={`block overflow-hidden rounded-xl bg-igm-100 ring-1 ring-igm-900/10 ${className}`}>
      {mime === 'application/pdf' ? (
        <div className="grid h-full w-full place-items-center p-2 text-center text-xs font-bold text-igm-700">📄 PDF</div>
      ) : (
        <img src={url} alt="Comprobante" loading="lazy" className="h-full w-full object-cover" />
      )}
    </a>
  );
}

import { Contact, prettyPhone, waNumber } from '../api';

const msg = encodeURIComponent('Hola, tengo una consulta sobre mi reserva en IGM Rancho.');

/** "¿Algún problema? Comunícate con Erick Acosta" con botones de WhatsApp y llamada. */
export default function Contacto({ contact, dark = false, title = '¿Algún problema con tu reserva?', className = '' }:
  { contact?: Contact | null; dark?: boolean; title?: string; className?: string }) {
  if (!contact?.phone) return null;
  return (
    <div className={`rounded-2xl p-4 ${dark ? 'bg-white/10 text-white ring-1 ring-white/15 backdrop-blur' : 'bg-white ring-1 ring-igm-900/5 shadow-sm'} ${className}`}>
      <div className="flex items-center gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-xl ${dark ? 'bg-white/10' : 'bg-igm-100'}`}>🙋</span>
        <div className="min-w-0 flex-1 text-left">
          <div className="font-bold">{title}</div>
          <div className={`text-sm ${dark ? 'text-igm-200' : 'text-igm-600'}`}>
            Comunícate con <b>{contact.name}</b> · {prettyPhone(contact.phone)}
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <a href={`https://wa.me/${waNumber(contact.phone)}?text=${msg}`} target="_blank" rel="noreferrer"
           className="btn bg-[#25D366] py-2.5 text-sm text-white hover:brightness-95">💬 WhatsApp</a>
        <a href={`tel:${contact.phone.replace(/\s/g, '')}`}
           className={`btn py-2.5 text-sm ${dark ? 'bg-white/15 text-white hover:bg-white/25' : 'btn-ghost'}`}>📞 Llamar</a>
      </div>
    </div>
  );
}

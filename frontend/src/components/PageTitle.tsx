import { ReactNode } from 'react';

export default function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-igm-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 print:hidden">{actions}</div>}
    </div>
  );
}

export function SaveBar({ msg, saving, onSave }: { msg: string; saving: boolean; onSave: () => void }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex items-center justify-end gap-4 border-t border-igm-100 bg-igm-50/95 px-4 py-3 backdrop-blur lg:-mx-8 lg:px-8">
      {msg && <span className="text-sm font-medium text-igm-700">{msg}</span>}
      <button className="btn-primary" onClick={onSave} disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
    </div>
  );
}

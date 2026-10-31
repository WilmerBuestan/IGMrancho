import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Logos from './Logos';

export default function Header({ children, subtitle, home = '/' }: { children?: ReactNode; subtitle?: string; home?: string }) {
  return (
    <header className="sticky top-0 z-30 bg-igm-900 text-white shadow-lg shadow-igm-950/20 print:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link to={home} className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Logos className="h-9 sm:h-11" />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-lg font-extrabold tracking-tight sm:text-xl">
              IGM <span className="text-oro-400">Rancho</span>
            </div>
            <div className="hidden truncate text-xs text-igm-300 sm:block">{subtitle ?? 'Reserva de alimentación'}</div>
          </div>
        </Link>
        {children}
      </div>
    </header>
  );
}

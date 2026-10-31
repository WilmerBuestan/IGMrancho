import { pool } from './db';

export interface Prices {
  desayuno: number; // centavos
  almuerzo: number;
  merienda: number;
}

export interface Account {
  titular: string;
  banco: string;
  tipo: string;
  numero: string;
  cedula: string;
}

export interface Settings {
  prices: Prices;
  cutoff: string; // "HH:MM" hora local
  account: Account;
  qrFile: string | null;
  notice: string; // aviso / menú del día que se muestra en la página
  open: boolean; // interruptor general de reservas
  closedDates: string[]; // días sin servicio (feriados, franco)
  driveRootId: string | null; // carpeta raíz creada en Drive (se guarda para poder moverla/renombrarla)
}

const DEFAULTS: Settings = {
  prices: { desayuno: 150, almuerzo: 250, merienda: 200 },
  cutoff: '20:00',
  account: { titular: 'Erick Acosta', banco: '', tipo: 'Ahorros', numero: '', cedula: '' },
  qrFile: null,
  notice: '',
  open: true,
  closedDates: [],
  driveRootId: null,
};

export async function getSettings(): Promise<Settings> {
  const { rows } = await pool.query<{ key: string; value: unknown }>('SELECT key, value FROM settings');
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Partial<Settings>;
  return {
    ...DEFAULTS,
    ...stored,
    prices: { ...DEFAULTS.prices, ...(stored.prices ?? {}) },
    account: { ...DEFAULTS.account, ...(stored.account ?? {}) },
  };
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  await pool.query(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, JSON.stringify(value)],
  );
}

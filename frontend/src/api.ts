export type Meal = 'desayuno' | 'almuerzo' | 'merienda';
// Colores de serie validados para daltonismo (paleta de referencia dataviz, slots 1-3).
export const MEALS: { key: Meal; label: string; emoji: string; hint: string; color: string }[] = [
  { key: 'desayuno', label: 'Desayuno', emoji: '☕', hint: 'Mañana', color: '#2a78d6' },
  { key: 'almuerzo', label: 'Almuerzo', emoji: '🍛', hint: 'Mediodía', color: '#eb6834' },
  { key: 'merienda', label: 'Merienda', emoji: '🍲', hint: 'Noche', color: '#1baf7a' },
];

export interface Account { titular: string; banco: string; tipo: string; numero: string; cedula: string }

export interface PublicConfig {
  prices: Record<Meal, number>;
  cutoff: string;
  account: Account;
  notice: string;
  open: boolean;
  qrUrl: string | null;
  serviceDate: string;
  deadline: string;
  emailDomain: string;
  closedDates: string[];
}

export interface AdminSettings {
  prices: Record<Meal, number>;
  cutoff: string;
  account: Account;
  qrFile: string | null;
  notice: string;
  open: boolean;
  closedDates: string[];
  driveEnabled: boolean;
  driveFolderUrl?: string | null;
  reminderMinutes: number;
  pushEnabled?: boolean;
}

export type Status = 'pendiente' | 'aprobada' | 'rechazada';

export interface Reservation {
  id: string;
  code: string;
  serviceDate: string;
  fullName: string;
  cedula?: string;
  email?: string;
  desayuno: number;
  almuerzo: number;
  merienda: number;
  totalCents: number;
  status: Status;
  adminNote: string | null;
  receiptMime: string;
  receiptUrl: string;
  driveStatus?: 'pending' | 'uploaded' | 'failed' | 'disabled';
  driveLink?: string | null;
  createdAt: string;
}

const TOKEN_KEY = 'igm-rancho-admin';
export const adminToken = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}, admin = false): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (admin) headers.set('Authorization', `Bearer ${adminToken.get() ?? ''}`);
  const res = await fetch(`/api${path}`, { ...init, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && admin) {
      adminToken.clear();
      window.dispatchEvent(new Event('igm-logout'));
    }
    throw new ApiError(data.error ?? 'No se pudo conectar con el servidor', res.status);
  }
  return res.json();
}

export const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function shortDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function downloadCsv(query: string, filename: string): Promise<void> {
  return fetch(`/api/admin/export.csv?${query}`, { headers: { Authorization: `Bearer ${adminToken.get()}` } })
    .then((r) => r.blob())
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      Object.assign(document.createElement('a'), { href: url, download: filename }).click();
      URL.revokeObjectURL(url);
    });
}

export function longDate(date: string): string {
  const s = new Date(`${date}T12:00:00`).toLocaleDateString('es-EC', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function mealsText(r: Pick<Reservation, Meal>): string {
  return MEALS.filter((m) => r[m.key] > 0).map((m) => `${r[m.key]} ${m.label.toLowerCase()}${r[m.key] > 1 ? 's' : ''}`).join(' · ');
}

/** Misma validación que el servidor, para avisar antes de enviar. */
export function isValidCedula(c: string): boolean {
  if (!/^\d{10}$/.test(c)) return false;
  const p = Number(c.slice(0, 2));
  if (!((p >= 1 && p <= 24) || p === 30) || Number(c[2]) >= 6) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(c[i]) * (i % 2 === 0 ? 2 : 1);
    if (d > 9) d -= 9;
    sum += d;
  }
  return (10 - (sum % 10)) % 10 === Number(c[9]);
}

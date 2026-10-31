import { config } from './config';

/** Fecha y hora actuales en la zona horaria de la app. */
function nowParts(): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

export function nowMinutes(): number {
  return nowParts().minutes;
}

export function today(): string {
  return nowParts().date;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Se reserva siempre para mañana. Pasada la hora de corte, las reservas
 * de mañana se cierran y la siguiente fecha disponible es pasado mañana.
 */
export function bookingWindow(
  cutoff: string,
  closedDates: string[] = [],
): { serviceDate: string; deadline: string } {
  const { date, minutes } = nowParts();
  const [h, m] = cutoff.split(':').map(Number);
  const cutoffMinutes = h * 60 + m;
  const pastCutoff = minutes >= cutoffMinutes;
  let serviceDate = addDays(date, pastCutoff ? 2 : 1);
  // Los días sin servicio se saltan; la hora límite pasa a ser la víspera del siguiente día con servicio.
  const closed = new Set(closedDates);
  for (let i = 0; i < 60 && closed.has(serviceDate); i++) serviceDate = addDays(serviceDate, 1);
  const deadlineDate = addDays(serviceDate, -1);
  return { serviceDate, deadline: `${deadlineDate} ${cutoff}` };
}

export function isValidDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

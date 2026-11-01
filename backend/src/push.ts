import fs from 'fs';
import { cert, initializeApp, App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { config } from './config';
import { addDays, bookingWindow, nowMinutes, today } from './dates';
import { pool } from './db';
import { getSettings, setSetting } from './settings';

let app: App | null = null;

export function pushEnabled(): boolean {
  return app !== null;
}

export function initPush(): void {
  if (!fs.existsSync(config.firebaseCredentials)) {
    console.log('[push] sin llave de Firebase: notificaciones desactivadas');
    return;
  }
  const creds = JSON.parse(fs.readFileSync(config.firebaseCredentials, 'utf8'));
  app = initializeApp({ credential: cert(creds) });
  console.log(`[push] notificaciones activadas (${creds.project_id})`);
}

interface Message {
  title: string;
  body: string;
  // Pantalla que abre la app al tocar la notificación
  route: string;
}

async function send(tokens: string[], msg: Message): Promise<void> {
  if (!app || tokens.length === 0) return;
  const res = await getMessaging(app).sendEachForMulticast({
    tokens,
    notification: { title: msg.title, body: msg.body },
    data: { route: msg.route },
    android: { priority: 'high', notification: { channelId: 'igm_rancho', color: '#2e3d28' } },
  });
  // Tokens de apps desinstaladas: se limpian
  const dead = res.responses
    .map((r, i) => (!r.success && /registration-token-not-registered|invalid-argument/.test(r.error?.code ?? '') ? tokens[i] : null))
    .filter(Boolean);
  if (dead.length) await pool.query('DELETE FROM devices WHERE token = ANY($1)', [dead]);
}

function safe(p: Promise<void>): void {
  p.catch((e) => console.error('[push]', (e as Error).message));
}

export function notifyAdminsNewPayment(r: { fullName: string; totalCents: number; serviceDate: string }): void {
  safe(
    (async () => {
      const { rows } = await pool.query<{ token: string }>(`SELECT token FROM devices WHERE role = 'admin'`);
      await send(rows.map((x) => x.token), {
        title: '💵 Nuevo pago por verificar',
        body: `${r.fullName} · $${(r.totalCents / 100).toFixed(2)}`,
        route: `/admin/reservas?date=${r.serviceDate}`,
      });
    })(),
  );
}

export function notifyClientStatus(r: { cedula: string; email: string; status: string; code: string; note: string | null }): void {
  if (r.status === 'pendiente') return;
  safe(
    (async () => {
      const { rows } = await pool.query<{ token: string }>(
        `SELECT token FROM devices WHERE cedula = $1 AND email = $2`,
        [r.cedula, r.email],
      );
      const ok = r.status === 'aprobada';
      await send(rows.map((x) => x.token), {
        title: ok ? '✅ Tu rancho está confirmado' : '❌ Tu pago fue rechazado',
        body: ok ? `Reserva ${r.code} aprobada. ¡Buen provecho!` : r.note || `Revisa tu reserva ${r.code} en la app.`,
        route: '/mis-reservas',
      });
    })(),
  );
}

export function notifyClientChange(r: { cedula: string; email: string | null }, title: string, body: string): void {
  if (!r.email) return;
  safe(
    (async () => {
      const { rows } = await pool.query<{ token: string }>(`SELECT token FROM devices WHERE cedula = $1 AND email = $2`, [r.cedula, r.email]);
      await send(rows.map((x) => x.token), { title, body, route: '/mis-reservas' });
    })(),
  );
}

/** Recordatorio antes de la hora límite, solo a quien aún no reservó para el siguiente servicio. */
async function reminderTick(): Promise<void> {
  if (!app) return;
  const s = await getSettings();
  if (!s.open || s.reminderMinutes <= 0) return;
  const { serviceDate } = bookingWindow(s.cutoff, s.closedDates);
  if (s.lastReminderFor === serviceDate) return;
  // La hora límite es la víspera del servicio; el recordatorio sale ese día, X minutos antes.
  if (addDays(serviceDate, -1) !== today()) return;
  const [h, m] = s.cutoff.split(':').map(Number);
  const due = h * 60 + m - s.reminderMinutes;
  const now = nowMinutes();
  if (now < due || now >= h * 60 + m) return;

  await setSetting('lastReminderFor', serviceDate);
  const { rows } = await pool.query<{ token: string }>(
    `SELECT d.token FROM devices d
      WHERE d.cedula IS NOT NULL AND d.reminders
        AND NOT EXISTS (SELECT 1 FROM reservations r
                         WHERE r.cedula = d.cedula AND r.service_date = $1 AND r.status <> 'rechazada')`,
    [serviceDate],
  );
  const left = h * 60 + m - now;
  await send(rows.map((x) => x.token), {
    title: '⏰ ¿Ya reservaste tu rancho?',
    body: `Te quedan ${left >= 60 ? `${Math.round(left / 60)} h` : `${left} min`} para reservar el de mañana (cierre ${s.cutoff}).`,
    route: '/reservar',
  });
  console.log(`[push] recordatorio enviado a ${rows.length} celulares (${serviceDate})`);
}

export function startReminderLoop(): void {
  setInterval(() => reminderTick().catch((e) => console.error('[push]', e)), 60_000);
}

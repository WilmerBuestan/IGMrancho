import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { checkCredentials, issueToken, requireAdmin } from '../auth';
import { driveEnabled } from '../config';
import { addDays, bookingWindow, isValidDate, today } from '../dates';
import { pool } from '../db';
import { syncDrive } from '../drive';
import { notifyClientStatus, pushEnabled } from '../push';
import { getSettings, setSetting } from '../settings';
import { receiptUrl, saveQr } from '../storage';

export const adminRouter = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });

adminRouter.post('/login', loginLimiter, (req, res) => {
  const { user, password } = req.body ?? {};
  if (typeof user !== 'string' || typeof password !== 'string' || !checkCredentials(user, password)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }
  res.json({ token: issueToken() });
});

adminRouter.use(requireAdmin);

function dateParam(v: unknown): string {
  return isValidDate(v) ? v : addDays(today(), 1);
}

const LIST_SQL = `
  SELECT id, code, to_char(service_date, 'YYYY-MM-DD') AS "serviceDate", full_name AS "fullName", cedula, email,
         desayuno, almuerzo, merienda, total_cents AS "totalCents", status, admin_note AS "adminNote",
         receipt_mime AS "receiptMime", drive_status AS "driveStatus", drive_link AS "driveLink",
         created_at AS "createdAt"
    FROM reservations`;

adminRouter.get('/reservations', async (req, res) => {
  const date = dateParam(req.query.date);
  const q = String(req.query.q ?? '').trim();
  const params: unknown[] = [date];
  let where = 'WHERE service_date = $1';
  if (q) {
    params.push(`%${q}%`);
    where += ` AND (full_name ILIKE $2 OR cedula ILIKE $2 OR email ILIKE $2 OR code ILIKE $2)`;
  }
  const { rows } = await pool.query(`${LIST_SQL} ${where} ORDER BY created_at DESC`, params);

  const sum = (status?: string) => {
    const list = status ? rows.filter((r) => r.status === status) : rows.filter((r) => r.status !== 'rechazada');
    return {
      desayuno: list.reduce((a, r) => a + r.desayuno, 0),
      almuerzo: list.reduce((a, r) => a + r.almuerzo, 0),
      merienda: list.reduce((a, r) => a + r.merienda, 0),
      totalCents: list.reduce((a, r) => a + r.totalCents, 0),
      count: list.length,
    };
  };

  res.json({
    date,
    driveEnabled,
    summary: { activas: sum(), aprobadas: sum('aprobada'), pendientes: sum('pendiente'), rechazadas: sum('rechazada') },
    reservations: rows.map((r) => ({ ...r, receiptUrl: receiptUrl(r.id) })),
  });
});

adminRouter.patch('/reservations/:id', async (req, res) => {
  const { status, adminNote } = req.body ?? {};
  if (!['pendiente', 'aprobada', 'rechazada'].includes(status)) return res.status(400).json({ error: 'Estado inválido' });
  const note = typeof adminNote === 'string' && adminNote.trim() ? adminNote.trim().slice(0, 300) : null;
  const { rows } = await pool.query(
    `UPDATE reservations r SET status = $2, admin_note = $3
       FROM (SELECT id, status AS old FROM reservations WHERE id = $1) o
      WHERE r.id = o.id
      RETURNING r.cedula, r.email, r.code, o.old`,
    [req.params.id, status, note],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Reserva no encontrada' });
  if (rows[0].old !== status) notifyClientStatus({ ...rows[0], status, note });
  res.json({ ok: true });
});

/** Rango from..to (inclusive), máximo 366 días. Sin parámetros: mañana. */
function rangeParams(q: Record<string, unknown>): { from: string; to: string } {
  const single = isValidDate(q.date) ? q.date : null;
  let from = isValidDate(q.from) ? q.from : single ?? addDays(today(), 1);
  let to = isValidDate(q.to) ? q.to : single ?? from;
  if (to < from) [from, to] = [to, from];
  if (addDays(from, 366) < to) to = addDays(from, 366);
  return { from, to };
}

adminRouter.get('/export.csv', async (req, res) => {
  const { from, to } = rangeParams(req.query);
  const { rows } = await pool.query(
    `${LIST_SQL} WHERE service_date BETWEEN $1 AND $2 ORDER BY service_date, full_name`,
    [from, to],
  );
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['Código', 'Fecha', 'Nombre', 'Cédula', 'Correo', 'Desayunos', 'Almuerzos', 'Meriendas', 'Total', 'Estado', 'Nota', 'Registrada', 'Drive'];
  const lines = rows.map((r) =>
    [r.code, r.serviceDate, r.fullName, r.cedula, r.email, r.desayuno, r.almuerzo, r.merienda,
     (r.totalCents / 100).toFixed(2), r.status, r.adminNote ?? '', new Date(r.createdAt).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' }),
     r.driveLink ?? ''].map(esc).join(','),
  );
  const name = from === to ? from : `${from}_a_${to}`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="igm-rancho-${name}.csv"`);
  res.send('\uFEFF' + [header.map(esc).join(','), ...lines].join('\r\n'));
});

const DAY_SQL = `
  SELECT to_char(service_date, 'YYYY-MM-DD') AS date,
         COUNT(*) FILTER (WHERE status <> 'rechazada')::int                          AS reservas,
         COALESCE(SUM(desayuno) FILTER (WHERE status <> 'rechazada'), 0)::int        AS desayuno,
         COALESCE(SUM(almuerzo) FILTER (WHERE status <> 'rechazada'), 0)::int        AS almuerzo,
         COALESCE(SUM(merienda) FILTER (WHERE status <> 'rechazada'), 0)::int        AS merienda,
         COALESCE(SUM(total_cents) FILTER (WHERE status = 'aprobada'), 0)::int       AS "aprobadoCents",
         COALESCE(SUM(total_cents) FILTER (WHERE status = 'pendiente'), 0)::int      AS "pendienteCents",
         COUNT(*) FILTER (WHERE status = 'pendiente')::int                           AS pendientes,
         COUNT(*) FILTER (WHERE status = 'rechazada')::int                           AS rechazadas
    FROM reservations
   WHERE service_date BETWEEN $1 AND $2
   GROUP BY service_date ORDER BY service_date`;

const PERSON_SQL = `
  SELECT cedula, MAX(full_name) AS "fullName", MAX(email) AS email,
         COUNT(*) FILTER (WHERE status <> 'rechazada')::int                    AS reservas,
         COALESCE(SUM(desayuno) FILTER (WHERE status <> 'rechazada'), 0)::int  AS desayuno,
         COALESCE(SUM(almuerzo) FILTER (WHERE status <> 'rechazada'), 0)::int  AS almuerzo,
         COALESCE(SUM(merienda) FILTER (WHERE status <> 'rechazada'), 0)::int  AS merienda,
         COALESCE(SUM(total_cents) FILTER (WHERE status = 'aprobada'), 0)::int AS "aprobadoCents",
         COUNT(*) FILTER (WHERE status = 'rechazada')::int                     AS rechazadas
    FROM reservations
   WHERE service_date BETWEEN $1 AND $2
   GROUP BY cedula`;

/** Rellena los días sin reservas para que las gráficas no salten fechas. */
function fillDays<T extends { date: string }>(rows: T[], from: string, to: string, empty: Omit<T, 'date'>): T[] {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const out: T[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(byDate.get(d) ?? ({ date: d, ...empty } as T));
  return out;
}

const EMPTY_DAY = { reservas: 0, desayuno: 0, almuerzo: 0, merienda: 0, aprobadoCents: 0, pendienteCents: 0, pendientes: 0, rechazadas: 0 };

adminRouter.get('/stats', async (_req, res) => {
  const s = await getSettings();
  const next = bookingWindow(s.cutoff, s.closedDates).serviceDate;
  const tomorrow = addDays(today(), 1);
  const from = addDays(today(), -13);
  const to = next > tomorrow ? next : tomorrow;

  const [days, people, pending, drive, hours] = await Promise.all([
    pool.query(DAY_SQL, [from, to]),
    pool.query(`${PERSON_SQL} ORDER BY (SUM(desayuno + almuerzo + merienda) FILTER (WHERE status <> 'rechazada')) DESC NULLS LAST LIMIT 5`, [from, to]),
    pool.query(`SELECT COUNT(*)::int AS n, COALESCE(SUM(total_cents), 0)::int AS cents FROM reservations WHERE status = 'pendiente'`),
    pool.query(`SELECT drive_status AS status, COUNT(*)::int AS n FROM reservations GROUP BY drive_status`),
    pool.query(
      `SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/Guayaquil')::int AS hour, COUNT(*)::int AS n
         FROM reservations WHERE service_date BETWEEN $1 AND $2 GROUP BY 1 ORDER BY 1`,
      [from, to],
    ),
  ]);

  const daily = fillDays(days.rows, from, to, EMPTY_DAY);
  const sum = (k: keyof typeof EMPTY_DAY) => daily.reduce((a, d) => a + (d[k] as number), 0);
  const decided = sum('reservas') - sum('pendientes') + sum('rechazadas');

  res.json({
    today: today(),
    tomorrow,
    nextServiceDate: next,
    from,
    to,
    daily,
    totals: {
      reservas: sum('reservas'),
      ranchos: sum('desayuno') + sum('almuerzo') + sum('merienda'),
      aprobadoCents: sum('aprobadoCents'),
      personas: (await pool.query(`SELECT COUNT(DISTINCT cedula)::int AS n FROM reservations WHERE service_date BETWEEN $1 AND $2`, [from, to])).rows[0].n,
      tasaAprobacion: decided ? (decided - sum('rechazadas')) / decided : null,
    },
    pending: pending.rows[0],
    topPeople: people.rows,
    byHour: hours.rows,
    drive: { enabled: driveEnabled, ...Object.fromEntries(drive.rows.map((r) => [r.status, r.n])) },
    settings: { open: s.open, cutoff: s.cutoff },
  });
});

adminRouter.get('/report', async (req, res) => {
  const { from, to } = rangeParams(req.query);
  const [days, people] = await Promise.all([
    pool.query(DAY_SQL, [from, to]),
    pool.query(`${PERSON_SQL} ORDER BY MAX(full_name)`, [from, to]),
  ]);
  res.json({ from, to, days: fillDays(days.rows, from, to, EMPTY_DAY), people: people.rows });
});

adminRouter.get('/settings', async (_req, res) => {
  const s = await getSettings();
  res.json({ ...s, driveEnabled, pushEnabled: pushEnabled(), driveFolderUrl: s.driveRootId ? `https://drive.google.com/drive/folders/${s.driveRootId}` : null });
});

function cents(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 0 || n > 100_000) throw new Error('Precio inválido');
  return n;
}

adminRouter.put('/settings', async (req, res) => {
  const b = req.body ?? {};
  try {
    if (b.prices) {
      await setSetting('prices', {
        desayuno: cents(b.prices.desayuno),
        almuerzo: cents(b.prices.almuerzo),
        merienda: cents(b.prices.merienda),
      });
    }
  } catch {
    return res.status(400).json({ error: 'Precio inválido' });
  }
  if (b.cutoff !== undefined) {
    if (typeof b.cutoff !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(b.cutoff))
      return res.status(400).json({ error: 'Hora de corte inválida (HH:MM)' });
    await setSetting('cutoff', b.cutoff);
  }
  if (b.account) {
    const a = b.account;
    const str = (v: unknown) => String(v ?? '').trim().slice(0, 100);
    await setSetting('account', {
      titular: str(a.titular), banco: str(a.banco), tipo: str(a.tipo), numero: str(a.numero), cedula: str(a.cedula),
    });
  }
  if (b.notice !== undefined) await setSetting('notice', String(b.notice).slice(0, 1000));
  if (b.open !== undefined) await setSetting('open', Boolean(b.open));
  if (b.reminderMinutes !== undefined) {
    const n = Number(b.reminderMinutes);
    if (!Number.isInteger(n) || n < 0 || n > 600) return res.status(400).json({ error: 'Recordatorio inválido' });
    await setSetting('reminderMinutes', n);
  }
  if (b.closedDates !== undefined) {
    if (!Array.isArray(b.closedDates) || b.closedDates.length > 400 || !b.closedDates.every(isValidDate))
      return res.status(400).json({ error: 'Fechas sin servicio inválidas' });
    const keep = [...new Set<string>(b.closedDates)].filter((d) => d >= addDays(today(), -30)).sort();
    await setSetting('closedDates', keep);
  }
  res.json({ ...(await getSettings()), driveEnabled });
});

const qrUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

adminRouter.post('/qr', qrUpload.single('qr'), async (req, res) => {
  if (!req.file || !req.file.mimetype.startsWith('image/')) return res.status(400).json({ error: 'Sube una imagen del QR' });
  const rel = await saveQr(req.file.buffer);
  await setSetting('qrFile', rel);
  res.json({ ok: true });
});

adminRouter.post('/drive/retry', async (_req, res) => {
  await pool.query(`UPDATE reservations SET drive_attempts = 0 WHERE drive_status IN ('failed', 'disabled')`);
  await syncDrive();
  res.json({ ok: true });
});

/** El celular del admin se registra para recibir avisos de pagos nuevos. */
adminRouter.post('/devices', async (req, res) => {
  const token = String(req.body?.token ?? '');
  if (token.length < 20 || token.length > 4096) return res.status(400).json({ error: 'Token inválido' });
  await pool.query(
    `INSERT INTO devices (token, role) VALUES ($1, 'admin')
     ON CONFLICT (token) DO UPDATE SET role = 'admin', updated_at = now()`,
    [token],
  );
  res.json({ ok: true });
});

adminRouter.delete('/devices/:token', async (req, res) => {
  await pool.query(`UPDATE devices SET role = 'client' WHERE token = $1`, [req.params.token]);
  res.json({ ok: true });
});

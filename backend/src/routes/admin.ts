import crypto from 'crypto';
import fs from 'fs/promises';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { checkCredentials, issueToken, requireAdmin } from '../auth';
import { driveEnabled } from '../config';
import { addDays, bookingWindow, isValidDate, today } from '../dates';
import { pool } from '../db';
import { syncDrive, trashDriveFile } from '../drive';
import { notifyClientChange, notifyClientStatus, pushEnabled } from '../push';
import { getSettings, setSetting } from '../settings';
import { absPath, ALLOWED_MIME, receiptUrl, saveQr, saveReceipt } from '../storage';
import { isValidCedula, newCode, parseQty } from '../validators';

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
         created_at AS "createdAt", created_by AS "createdBy", updated_at AS "updatedAt"
    FROM reservations`;

const withUrl = <T extends { id: string; receiptMime: string | null }>(r: T) => ({
  ...r,
  receiptUrl: r.receiptMime ? receiptUrl(r.id) : null,
});

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
    reservations: rows.map(withUrl),
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
  if (rows[0].old !== status) {
    notifyClientStatus({ ...rows[0], status, note });
    await logHistory(req.params.id, rows[0].code, 'estado', { de: rows[0].old, a: status, nota: note });
  }
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
  if (b.contact) {
    const phone = String(b.contact.phone ?? '').replace(/[^\d+]/g, '');
    if (phone && !/^(\+?593|0)\d{8,9}$/.test(phone)) return res.status(400).json({ error: 'Teléfono inválido (ej. 0996038610)' });
    await setSetting('contact', { name: String(b.contact.name ?? '').trim().slice(0, 80), phone });
  }
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

// ---------- CRUD de reservas (el admin corrige lo que la gente hizo mal) ----------

async function logHistory(id: string, code: string, action: string, detail: Record<string, unknown>): Promise<void> {
  await pool.query(
    'INSERT INTO reservation_history (reservation_id, code, action, detail) VALUES ($1, $2, $3, $4)',
    [id, code, action, JSON.stringify(detail)],
  );
}

const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ALLOWED_MIME.includes(file.mimetype)),
});

const STATUSES = ['pendiente', 'aprobada', 'rechazada'];

interface Input {
  fullName?: string;
  cedula?: string;
  email?: string | null;
  serviceDate?: string;
  desayuno?: number;
  almuerzo?: number;
  merienda?: number;
  totalCents?: number;
  status?: string;
  adminNote?: string | null;
}

/** Valida los campos que vienen del formulario del admin. Con partial=true todos son opcionales. */
function parseInput(b: Record<string, unknown>, partial: boolean): Input | string {
  const out: Input = {};
  const has = (k: string) => b[k] !== undefined && b[k] !== '';
  if (has('fullName') || !partial) {
    const v = String(b.fullName ?? '').trim().replace(/\s+/g, ' ');
    if (v.length < 3 || v.length > 120) return 'Ingresa el nombre completo';
    out.fullName = v;
  }
  if (has('cedula') || !partial) {
    const v = String(b.cedula ?? '').trim();
    if (!isValidCedula(v)) return 'La cédula no es válida';
    out.cedula = v;
  }
  if (b.email !== undefined) {
    // El admin puede registrar a alguien sin correo institucional (pago en efectivo, visitas...)
    const v = String(b.email ?? '').trim().toLowerCase();
    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Correo inválido';
    out.email = v || null;
  }
  if (has('serviceDate') || !partial) {
    if (!isValidDate(b.serviceDate)) return 'Fecha inválida';
    out.serviceDate = b.serviceDate as string;
  }
  try {
    for (const k of ['desayuno', 'almuerzo', 'merienda'] as const) if (has(k) || !partial) out[k] = parseQty(b[k]);
  } catch {
    return 'Cantidades inválidas (máximo 20 por tipo)';
  }
  if (has('totalCents')) {
    const n = Math.round(Number(b.totalCents));
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return 'Total inválido';
    out.totalCents = n;
  }
  if (has('status')) {
    if (!STATUSES.includes(String(b.status))) return 'Estado inválido';
    out.status = String(b.status);
  }
  if (b.adminNote !== undefined) out.adminNote = String(b.adminNote ?? '').trim().slice(0, 300) || null;
  return out;
}

async function priceOf(q: { desayuno: number; almuerzo: number; merienda: number }): Promise<number> {
  const { prices } = await getSettings();
  return q.desayuno * prices.desayuno + q.almuerzo * prices.almuerzo + q.merienda * prices.merienda;
}

/** Crear una reserva a mano (pago en efectivo, alguien que le escribió a Erick...). */
adminRouter.post('/reservations', receiptUpload.single('comprobante'), async (req, res) => {
  const input = parseInput(req.body ?? {}, false);
  if (typeof input === 'string') return res.status(400).json({ error: input });
  const q = { desayuno: input.desayuno!, almuerzo: input.almuerzo!, merienda: input.merienda! };
  if (q.desayuno + q.almuerzo + q.merienda === 0) return res.status(400).json({ error: 'Elige al menos un rancho' });

  const id = crypto.randomUUID();
  let saved: { relPath: string; mime: string } | null = null;
  if (req.file) {
    try {
      saved = await saveReceipt(id, input.serviceDate!, req.file.buffer, req.file.mimetype);
    } catch {
      return res.status(400).json({ error: 'No se pudo leer la imagen del comprobante' });
    }
  }
  const total = input.totalCents ?? (await priceOf(q));
  const code = newCode();
  await pool.query(
    `INSERT INTO reservations (id, code, service_date, full_name, cedula, email, desayuno, almuerzo, merienda,
                               total_cents, receipt_path, receipt_mime, status, admin_note, created_by, drive_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'admin',$15)`,
    [id, code, input.serviceDate, input.fullName, input.cedula, input.email ?? '', q.desayuno, q.almuerzo, q.merienda,
     total, saved?.relPath ?? null, saved?.mime ?? null, input.status ?? 'aprobada', input.adminNote ?? null,
     saved ? 'pending' : 'disabled'],
  );
  await logHistory(id, code, 'creada', { por: 'admin', ...q, total, estado: input.status ?? 'aprobada' });
  if (saved) syncDrive().catch((e) => console.error('[drive]', e));
  const { rows } = await pool.query(`${LIST_SQL} WHERE id = $1`, [id]);
  res.status(201).json(withUrl(rows[0]));
});

const FIELD_LABELS: Record<string, string> = {
  full_name: 'nombre', cedula: 'cédula', email: 'correo', service_date: 'fecha', desayuno: 'desayunos',
  almuerzo: 'almuerzos', merienda: 'meriendas', total_cents: 'total', status: 'estado', admin_note: 'nota',
};

/** Editar cualquier dato de una reserva y, si se envía, reemplazar el comprobante. */
adminRouter.put('/reservations/:id', receiptUpload.single('comprobante'), async (req, res) => {
  const input = parseInput(req.body ?? {}, true);
  if (typeof input === 'string') return res.status(400).json({ error: input });
  const { rows: cur } = await pool.query(
    `SELECT *, to_char(service_date, 'YYYY-MM-DD') AS sd FROM reservations WHERE id = $1`,
    [req.params.id],
  );
  const old = cur[0];
  if (!old) return res.status(404).json({ error: 'Reserva no encontrada' });

  const next = {
    full_name: input.fullName ?? old.full_name,
    cedula: input.cedula ?? old.cedula,
    email: input.email === undefined ? old.email : input.email ?? '',
    service_date: input.serviceDate ?? old.sd,
    desayuno: input.desayuno ?? old.desayuno,
    almuerzo: input.almuerzo ?? old.almuerzo,
    merienda: input.merienda ?? old.merienda,
    status: input.status ?? old.status,
    admin_note: input.adminNote === undefined ? old.admin_note : input.adminNote,
    total_cents: old.total_cents as number,
  };
  if (next.desayuno + next.almuerzo + next.merienda === 0) return res.status(400).json({ error: 'Debe quedar al menos un rancho' });
  const qtyChanged = next.desayuno !== old.desayuno || next.almuerzo !== old.almuerzo || next.merienda !== old.merienda;
  // Si cambian las cantidades y no mandan total, se recalcula con los precios actuales.
  next.total_cents = input.totalCents ?? (qtyChanged ? await priceOf(next) : old.total_cents);

  const changes: Record<string, { de: unknown; a: unknown }> = {};
  for (const k of Object.keys(next) as (keyof typeof next)[]) {
    const before = k === 'service_date' ? old.sd : old[k];
    if (String(before ?? '') !== String(next[k] ?? '')) changes[FIELD_LABELS[k]] = { de: before, a: next[k] };
  }

  let receipt: { relPath: string; mime: string } | null = null;
  if (req.file) {
    try {
      receipt = await saveReceipt(old.id, next.service_date, req.file.buffer, req.file.mimetype);
    } catch {
      return res.status(400).json({ error: 'No se pudo leer la imagen del comprobante' });
    }
    changes.comprobante = { de: old.receipt_path ? 'anterior' : 'sin comprobante', a: 'nuevo' };
  }
  if (Object.keys(changes).length === 0) return res.status(400).json({ error: 'No hay cambios que guardar' });

  await pool.query(
    `UPDATE reservations SET full_name=$2, cedula=$3, email=$4, service_date=$5, desayuno=$6, almuerzo=$7, merienda=$8,
            total_cents=$9, status=$10, admin_note=$11, updated_at=now()
            ${receipt ? ", receipt_path=$12, receipt_mime=$13, drive_status='pending', drive_attempts=0, drive_file_id=NULL, drive_link=NULL" : ''}
      WHERE id=$1`,
    [old.id, next.full_name, next.cedula, next.email, next.service_date, next.desayuno, next.almuerzo, next.merienda,
     next.total_cents, next.status, next.admin_note, ...(receipt ? [receipt.relPath, receipt.mime] : [])],
  );
  if (receipt) {
    if (old.receipt_path && old.receipt_path !== receipt.relPath) await fs.unlink(absPath(old.receipt_path)).catch(() => {});
    trashDriveFile(old.drive_file_id);
    syncDrive().catch((e) => console.error('[drive]', e));
  }
  await logHistory(old.id, old.code, 'editada', changes);

  if (changes.estado) notifyClientStatus({ cedula: next.cedula, email: next.email, status: next.status, code: old.code, note: next.admin_note });
  else notifyClientChange({ cedula: next.cedula, email: next.email }, '✏️ Tu reserva fue actualizada', `La administración corrigió tu reserva ${old.code}. Revísala en la app.`);

  const { rows } = await pool.query(`${LIST_SQL} WHERE id = $1`, [old.id]);
  res.json(withUrl(rows[0]));
});

/** Eliminar una reserva. Queda registrada en el historial y el comprobante va a la papelera de Drive. */
adminRouter.delete('/reservations/:id', async (req, res) => {
  const reason = String(req.body?.reason ?? req.query.reason ?? '').trim().slice(0, 300);
  const { rows } = await pool.query('DELETE FROM reservations WHERE id = $1 RETURNING *, to_char(service_date, \'YYYY-MM-DD\') AS sd', [req.params.id]);
  const r = rows[0];
  if (!r) return res.status(404).json({ error: 'Reserva no encontrada' });
  if (r.receipt_path) await fs.unlink(absPath(r.receipt_path)).catch(() => {});
  trashDriveFile(r.drive_file_id);
  await logHistory(r.id, r.code, 'eliminada', {
    nombre: r.full_name, cedula: r.cedula, fecha: r.sd, desayunos: r.desayuno, almuerzos: r.almuerzo,
    meriendas: r.merienda, total: r.total_cents, estado: r.status, motivo: reason || null,
  });
  notifyClientChange({ cedula: r.cedula, email: r.email }, '🗑️ Tu reserva fue anulada',
    reason ? `Reserva ${r.code}: ${reason}` : `La administración anuló tu reserva ${r.code}.`);
  res.json({ ok: true });
});

adminRouter.get('/reservations/:id/history', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT action, detail, at FROM reservation_history WHERE reservation_id = $1 ORDER BY at DESC LIMIT 50',
    [req.params.id],
  );
  res.json(rows);
});

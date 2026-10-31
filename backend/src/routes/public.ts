import crypto from 'crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { config } from '../config';
import { bookingWindow, today } from '../dates';
import { pool } from '../db';
import { syncDrive } from '../drive';
import { notifyAdminsNewPayment } from '../push';
import { getSettings } from '../settings';
import { absPath, ALLOWED_MIME, receiptUrl, saveReceipt, verifyReceiptSig } from '../storage';
import { isInstitutionalEmail, isValidCedula, parseQty } from '../validators';

export const publicRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ALLOWED_MIME.includes(file.mimetype)),
});

const createLimiter = rateLimit({ windowMs: 10 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });
const lookupLimiter = rateLimit({ windowMs: 10 * 60_000, limit: 60, standardHeaders: true, legacyHeaders: false });

publicRouter.get('/config', async (_req, res) => {
  const s = await getSettings();
  const w = bookingWindow(s.cutoff, s.closedDates);
  res.json({
    prices: s.prices,
    cutoff: s.cutoff,
    account: s.account,
    notice: s.notice,
    open: s.open,
    closedDates: s.closedDates.filter((d) => d >= today()).sort(),
    qrUrl: s.qrFile ? `/api/qr?v=${encodeURIComponent(s.qrFile)}` : null,
    serviceDate: w.serviceDate,
    deadline: w.deadline,
    emailDomain: config.emailDomain,
  });
});

publicRouter.get('/qr', async (_req, res) => {
  const s = await getSettings();
  if (!s.qrFile) return res.status(404).end();
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(absPath(s.qrFile));
});

function newCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (const b of crypto.randomBytes(6)) out += alphabet[b % alphabet.length];
  return `IGM-${out}`;
}

publicRouter.post('/reservations', createLimiter, upload.single('comprobante'), async (req, res) => {
  const s = await getSettings();
  if (!s.open) return res.status(409).json({ error: 'Las reservas están cerradas por el momento' });

  const fullName = String(req.body.fullName ?? '').trim().replace(/\s+/g, ' ');
  const cedula = String(req.body.cedula ?? '').trim();
  const email = String(req.body.email ?? '').trim().toLowerCase();

  if (fullName.length < 5 || fullName.length > 120) return res.status(400).json({ error: 'Ingresa tu nombre completo' });
  if (!isValidCedula(cedula)) return res.status(400).json({ error: 'La cédula no es válida' });
  if (!isInstitutionalEmail(email))
    return res.status(400).json({ error: `Usa tu correo institucional @${config.emailDomain}` });

  let desayuno: number, almuerzo: number, merienda: number;
  try {
    desayuno = parseQty(req.body.desayuno);
    almuerzo = parseQty(req.body.almuerzo);
    merienda = parseQty(req.body.merienda);
  } catch {
    return res.status(400).json({ error: 'Cantidades inválidas (máximo 20 por tipo)' });
  }
  if (desayuno + almuerzo + merienda === 0) return res.status(400).json({ error: 'Elige al menos un rancho' });
  if (!req.file) return res.status(400).json({ error: 'Sube la captura de la transferencia (imagen o PDF)' });

  // La fecha y el precio los decide el servidor, nunca el cliente.
  const { serviceDate } = bookingWindow(s.cutoff, s.closedDates);
  const total =
    desayuno * s.prices.desayuno + almuerzo * s.prices.almuerzo + merienda * s.prices.merienda;

  const id = crypto.randomUUID();
  let saved;
  try {
    saved = await saveReceipt(id, serviceDate, req.file.buffer, req.file.mimetype);
  } catch {
    return res.status(400).json({ error: 'No se pudo leer la imagen. Intenta con otra captura.' });
  }

  const code = newCode();
  await pool.query(
    `INSERT INTO reservations (id, code, service_date, full_name, cedula, email, desayuno, almuerzo, merienda,
                               total_cents, receipt_path, receipt_mime)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [id, code, serviceDate, fullName, cedula, email, desayuno, almuerzo, merienda, total, saved.relPath, saved.mime],
  );

  syncDrive().catch((e) => console.error('[drive]', e));
  notifyAdminsNewPayment({ fullName, totalCents: total, serviceDate });
  res.status(201).json({ code, serviceDate, totalCents: total, desayuno, almuerzo, merienda });
});

publicRouter.get('/reservations/lookup', lookupLimiter, async (req, res) => {
  const cedula = String(req.query.cedula ?? '').trim();
  const email = String(req.query.email ?? '').trim().toLowerCase();
  if (!cedula || !email) return res.status(400).json({ error: 'Ingresa cédula y correo' });

  const { rows } = await pool.query(
    `SELECT id, code, to_char(service_date, 'YYYY-MM-DD') AS "serviceDate", full_name AS "fullName",
            desayuno, almuerzo, merienda, total_cents AS "totalCents", status, admin_note AS "adminNote",
            receipt_mime AS "receiptMime", created_at AS "createdAt"
       FROM reservations
      WHERE cedula = $1 AND email = $2
      ORDER BY service_date DESC, created_at DESC
      LIMIT 60`,
    [cedula, email],
  );
  res.json(rows.map((r) => ({ ...r, receiptUrl: receiptUrl(r.id) })));
});

publicRouter.get('/receipts/:id', async (req, res) => {
  if (!verifyReceiptSig(req.params.id, req.query.sig)) return res.status(403).end();
  const { rows } = await pool.query('SELECT receipt_path, receipt_mime FROM reservations WHERE id = $1', [
    req.params.id,
  ]);
  if (!rows[0]) return res.status(404).end();
  res.setHeader('Content-Type', rows[0].receipt_mime);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(absPath(rows[0].receipt_path));
});

/** La app registra su token de notificaciones con los datos de la persona. */
publicRouter.post('/devices', lookupLimiter, async (req, res) => {
  const token = String(req.body?.token ?? '');
  const cedula = String(req.body?.cedula ?? '').trim() || null;
  const email = String(req.body?.email ?? '').trim().toLowerCase() || null;
  const reminders = req.body?.reminders !== false;
  if (token.length < 20 || token.length > 4096) return res.status(400).json({ error: 'Token inválido' });
  // Un celular que antes era admin sigue siéndolo; solo se actualizan los datos de cliente.
  await pool.query(
    `INSERT INTO devices (token, role, cedula, email, reminders) VALUES ($1, 'client', $2, $3, $4)
     ON CONFLICT (token) DO UPDATE SET cedula = EXCLUDED.cedula, email = EXCLUDED.email,
       reminders = EXCLUDED.reminders, updated_at = now()`,
    [token, cedula, email, reminders],
  );
  res.json({ ok: true });
});

publicRouter.delete('/devices/:token', async (req, res) => {
  await pool.query(`DELETE FROM devices WHERE token = $1 AND role = 'client'`, [req.params.token]);
  res.json({ ok: true });
});

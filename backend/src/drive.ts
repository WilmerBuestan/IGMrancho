import fs from 'fs';
import { google, drive_v3 } from 'googleapis';
import { config, driveEnabled } from './config';
import { pool } from './db';
import { getSettings, setSetting } from './settings';
import { absPath } from './storage';

const MAX_ATTEMPTS = 6;
let client: drive_v3.Drive | null = null;
const folderCache = new Map<string, string>();

function drive(): drive_v3.Drive {
  if (!client) {
    const auth = new google.auth.OAuth2(config.drive.clientId, config.drive.clientSecret);
    auth.setCredentials({ refresh_token: config.drive.refreshToken });
    client = google.drive({ version: 'v3', auth });
  }
  return client;
}

async function findOrCreateFolder(name: string, parentId?: string): Promise<string> {
  const cacheKey = `${parentId ?? 'root'}/${name}`;
  const cached = folderCache.get(cacheKey);
  if (cached) return cached;

  const q = [
    `name = '${name.replace(/'/g, "\\'")}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    'trashed = false',
    parentId ? `'${parentId}' in parents` : "'root' in parents",
  ].join(' and ');
  const found = await drive().files.list({ q, fields: 'files(id)', pageSize: 1 });
  let id = found.data.files?.[0]?.id;
  if (!id) {
    const created = await drive().files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : undefined,
      },
      fields: 'id',
    });
    id = created.data.id!;
  }
  folderCache.set(cacheKey, id);
  return id;
}

let rootId: string | null = null;

/**
 * Carpeta raíz. Se crea una vez y se guarda su ID, así el dueño del Drive puede
 * moverla o renombrarla. Con el permiso drive.file la app solo ve lo que ella creó.
 */
async function rootFolder(): Promise<string> {
  if (config.drive.rootFolderId) return config.drive.rootFolderId;
  if (rootId) return rootId;
  const saved = (await getSettings()).driveRootId;
  if (saved) {
    try {
      const f = await drive().files.get({ fileId: saved, fields: 'id, trashed' });
      if (!f.data.trashed) return (rootId = saved);
    } catch {
      // borrada o inaccesible: se crea otra
    }
  }
  const created = await drive().files.create({
    requestBody: { name: config.drive.rootFolderName, mimeType: 'application/vnd.google-apps.folder' },
    fields: 'id',
  });
  rootId = created.data.id!;
  folderCache.clear();
  await setSetting('driveRootId', rootId);
  return rootId;
}

interface PendingRow {
  id: string;
  code: string;
  service_date: string;
  full_name: string;
  cedula: string;
  receipt_path: string;
  receipt_mime: string;
}

async function uploadOne(r: PendingRow): Promise<void> {
  const dateFolder = await findOrCreateFolder(r.service_date, await rootFolder());
  const ext = r.receipt_mime === 'application/pdf' ? 'pdf' : 'jpg';
  const safeName = r.full_name.normalize('NFD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
  const res = await drive().files.create({
    requestBody: { name: `${r.code}_${r.cedula}_${safeName}.${ext}`, parents: [dateFolder] },
    media: { mimeType: r.receipt_mime, body: fs.createReadStream(absPath(r.receipt_path)) },
    fields: 'id, webViewLink',
  });
  await pool.query(
    `UPDATE reservations SET drive_status = 'uploaded', drive_file_id = $2, drive_link = $3 WHERE id = $1`,
    [r.id, res.data.id, res.data.webViewLink],
  );
}

let running = false;

/** Sube a Drive los comprobantes pendientes. Los fallos se reintentan en la siguiente vuelta. */
export async function syncDrive(): Promise<void> {
  if (running) return;
  running = true;
  try {
    if (!driveEnabled) {
      await pool.query(`UPDATE reservations SET drive_status = 'disabled' WHERE drive_status = 'pending'`);
      return;
    }
    const { rows } = await pool.query<PendingRow>(
      `SELECT id, code, to_char(service_date, 'YYYY-MM-DD') AS service_date, full_name, cedula,
              receipt_path, receipt_mime
         FROM reservations
        WHERE receipt_path IS NOT NULL AND drive_status IN ('pending', 'failed', 'disabled') AND drive_attempts < $1
        ORDER BY created_at LIMIT 20`,
      [MAX_ATTEMPTS],
    );
    for (const r of rows) {
      try {
        await uploadOne(r);
      } catch (err) {
        console.error(`[drive] fallo subiendo ${r.code}:`, (err as Error).message);
        await pool.query(
          `UPDATE reservations SET drive_status = 'failed', drive_attempts = drive_attempts + 1 WHERE id = $1`,
          [r.id],
        );
      }
    }
  } finally {
    running = false;
  }
}

export function startDriveLoop(): void {
  const tick = () => syncDrive().catch((e) => console.error('[drive]', e));
  tick();
  setInterval(tick, 60_000);
}

/** Manda a la papelera de Drive un comprobante (se puede recuperar 30 días desde Drive). */
export async function trashDriveFile(fileId: string | null): Promise<void> {
  if (!driveEnabled || !fileId) return;
  try {
    await drive().files.update({ fileId, requestBody: { trashed: true } });
  } catch (err) {
    console.error('[drive] no se pudo enviar a la papelera:', (err as Error).message);
  }
}

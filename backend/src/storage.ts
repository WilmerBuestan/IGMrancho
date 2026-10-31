import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { config } from './config';

export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];

/**
 * Guarda el comprobante en disco. Las imágenes se normalizan a JPEG de máx.
 * 1600px: así una captura de 4 MB queda en ~200 KB y el Drive dura mucho más.
 */
export async function saveReceipt(
  id: string,
  serviceDate: string,
  buffer: Buffer,
  mime: string,
): Promise<{ relPath: string; mime: string }> {
  const dir = path.join('receipts', serviceDate);
  await fs.mkdir(path.join(config.uploadsDir, dir), { recursive: true });

  if (mime === 'application/pdf') {
    const relPath = path.join(dir, `${id}.pdf`);
    await fs.writeFile(path.join(config.uploadsDir, relPath), buffer);
    return { relPath, mime };
  }

  const relPath = path.join(dir, `${id}.jpg`);
  await sharp(buffer)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toFile(path.join(config.uploadsDir, relPath));
  return { relPath, mime: 'image/jpeg' };
}

export async function saveQr(buffer: Buffer): Promise<string> {
  const relPath = `qr-${Date.now()}.png`;
  await fs.mkdir(config.uploadsDir, { recursive: true });
  await sharp(buffer).rotate().resize({ width: 1000, withoutEnlargement: true }).png().toFile(
    path.join(config.uploadsDir, relPath),
  );
  return relPath;
}

export function absPath(relPath: string): string {
  const abs = path.resolve(config.uploadsDir, relPath);
  if (!abs.startsWith(path.resolve(config.uploadsDir))) throw new Error('Ruta inválida');
  return abs;
}

/** Firma para URLs de comprobantes: solo quien recibe la URL desde la API puede verlos. */
export function signReceipt(id: string): string {
  return crypto.createHmac('sha256', config.jwtSecret).update(`receipt:${id}`).digest('hex').slice(0, 32);
}

export function receiptUrl(id: string): string {
  return `/api/receipts/${id}?sig=${signReceipt(id)}`;
}

export function verifyReceiptSig(id: string, sig: unknown): boolean {
  if (typeof sig !== 'string') return false;
  const expected = signReceipt(id);
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

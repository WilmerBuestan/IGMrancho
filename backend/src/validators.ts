import { config } from './config';

/** Valida una cédula ecuatoriana (10 dígitos, provincia y dígito verificador). */
export function isValidCedula(cedula: string): boolean {
  if (!/^\d{10}$/.test(cedula)) return false;
  const province = Number(cedula.slice(0, 2));
  if (!((province >= 1 && province <= 24) || province === 30)) return false;
  if (Number(cedula[2]) >= 6) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(cedula[i]) * (i % 2 === 0 ? 2 : 1);
    if (d > 9) d -= 9;
    sum += d;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(cedula[9]);
}

export function isInstitutionalEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+$/.test(e) && e.endsWith(`@${config.emailDomain}`);
}

export function parseQty(v: unknown): number {
  const n = Number(v ?? 0);
  if (!Number.isInteger(n) || n < 0 || n > 20) throw new Error('Cantidad inválida');
  return n;
}

import 'dotenv/config';
import path from 'path';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  adminUser: required('ADMIN_USER'),
  adminPassword: required('ADMIN_PASSWORD'),
  uploadsDir: process.env.UPLOADS_DIR ?? path.resolve('uploads'),
  timezone: process.env.TZ_APP ?? 'America/Guayaquil',
  emailDomain: (process.env.EMAIL_DOMAIN ?? 'geograficomilitar.gob.ec').toLowerCase(),
  drive: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN ?? '',
    // Carpeta raíz en Drive; si no se indica, se crea "IGM Rancho" en Mi unidad.
    rootFolderId: process.env.DRIVE_ROOT_FOLDER_ID ?? '',
    rootFolderName: process.env.DRIVE_ROOT_FOLDER_NAME ?? 'IGM Rancho',
  },
};

export const driveEnabled = Boolean(
  config.drive.clientId && config.drive.clientSecret && config.drive.refreshToken,
);

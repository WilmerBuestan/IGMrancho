import 'express-async-errors';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { config, driveEnabled } from './config';
import { migrate } from './db';
import { startDriveLoop } from './drive';
import { initPush, startReminderLoop } from './push';
import { adminRouter } from './routes/admin';
import { publicRouter } from './routes/public';

async function main() {
  await migrate();
  initPush();

  const app = express();
  app.set('trust proxy', 1);
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', publicRouter);
  app.use('/api/admin', adminRouter);

  app.use((err: Error & { code?: string }, _req: Request, res: Response, _next: NextFunction) => {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'El archivo es muy grande (máx. 15 MB)' });
    console.error(err);
    res.status(500).json({ error: 'Error interno, intenta de nuevo' });
  });

  app.listen(config.port, () => {
    console.log(`IGM Rancho API en :${config.port} — Drive ${driveEnabled ? 'activado' : 'desactivado'}`);
  });
  startDriveLoop();
  startReminderLoop();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Autoriza IGM Rancho a subir archivos a TU Google Drive (se hace una sola vez).
// Uso:  npm run drive-auth
// Lee GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET del .env del proyecto y, al terminar,
// escribe GOOGLE_REFRESH_TOKEN en ese mismo .env.
import fs from 'fs';
import http from 'http';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { google } from 'googleapis';

const envPath = fileURLToPath(new URL('../../.env', import.meta.url));
dotenv.config({ path: envPath });

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error(`Pon GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en ${envPath} y vuelve a correr el script.`);
  process.exit(1);
}

const PORT = 53682;
const redirectUri = `http://localhost:${PORT}`;
const oauth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirectUri);
const url = oauth.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  // drive.file: la app solo ve los archivos que ella misma crea, no el resto de tu Drive.
  scope: ['https://www.googleapis.com/auth/drive.file'],
});

console.log('\nAbre este enlace en el navegador e inicia sesión con la cuenta del Drive:\n');
console.log(url, '\n');

http
  .createServer(async (req, res) => {
    const code = new URL(req.url, redirectUri).searchParams.get('code');
    if (!code) return res.end('Sin código');
    try {
      const { tokens } = await oauth.getToken(code);
      if (!tokens.refresh_token) throw new Error('Google no devolvió refresh token');
      const env = fs.readFileSync(envPath, 'utf8');
      const line = `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`;
      fs.writeFileSync(
        envPath,
        /^GOOGLE_REFRESH_TOKEN=.*$/m.test(env) ? env.replace(/^GOOGLE_REFRESH_TOKEN=.*$/m, line) : `${env.trimEnd()}\n${line}\n`,
      );
      res.end('Listo. IGM Rancho ya puede subir a tu Drive. Puedes cerrar esta ventana.');
      console.log(`✓ GOOGLE_REFRESH_TOKEN guardado en ${envPath}`);
      console.log('  Reinicia la API:  docker compose up -d api');
      process.exit(0);
    } catch (err) {
      res.end(`Error: ${err.message}`);
      console.error(err);
      process.exit(1);
    }
  })
  .listen(PORT);

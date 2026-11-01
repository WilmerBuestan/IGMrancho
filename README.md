# IGM Rancho

Reserva de desayuno, almuerzo y merienda para el personal del IGM. La persona elige
cuántos ranchos quiere para mañana, transfiere con el QR de la cuenta de Erick Acosta
y sube la captura. La administración verifica el pago desde `/admin`.

## Stack

| Pieza | Tecnología |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind, servido por nginx (también hace de proxy a `/api`) |
| API | Node 20 + Express + TypeScript, Multer, sharp |
| Base de datos | PostgreSQL 16 |
| Capturas | Copia local en el volumen `uploads_data` + subida a Google Drive (carpeta `IGM Rancho/AAAA-MM-DD/`) |
| Infra | Docker Compose (3 contenedores: `postgres`, `api`, `frontend`) |

## Funciones

**Bienvenida** (`/`): logos del Ministerio y del IGM, saludo, estado de las reservas y dos entradas: *cliente* o *administrador*.

**Modo cliente** (`/reservar`, `/mis-reservas`), con navegación arriba en computadora y pestañas abajo en celular:
- Elegir cantidad de desayunos/almuerzos/meriendas (1, 2 o los que sean).
- Ver total, QR y datos de la cuenta (con botón para copiar el número).
- Nombre, cédula (validada) y correo `@geograficomilitar.gob.ec`; subir captura (imagen o PDF).
- Se reserva para el **siguiente día con servicio** hasta la hora límite de la víspera.
- **Mis reservas**: con cédula + correo se ve el estado (por verificar / aprobada / rechazada) y la captura.
- **Contacto**: si algo sale mal, botones de WhatsApp y llamada a Erick Acosta (0996038610, editable).

**Modo administrador** (`/admin`, menú lateral en computadora y desplegable en celular):
- **Dashboard**: cuánto preparar mañana, pagos por verificar, recaudado, ranchos y personas de 14 días, gráfico de ranchos por día, quiénes más reservan y a qué hora reservan.
- **Registrados del día**: lista con captura, aprobar/rechazar con nota, búsqueda, filtros, navegar entre días, imprimir lista para cocina y exportar a Excel.
- **CRUD de reservas**: crear a mano (pago en efectivo, comprobante opcional), editar cualquier dato (cantidades, fecha, total, estado, comprobante), eliminar con motivo e historial de cambios. La persona recibe un aviso en la app.
- **Reportes**: por rango (mañana, hoy, semana, mes, mes pasado, 30 días o personalizado), totales, gráfico, tablas por día y por persona, Excel e impresión.
- **Precios y menú**: precio de cada tipo y aviso/menú del día.
- **Fechas y horarios**: abrir/cerrar reservas, hora límite y días sin servicio (feriados).
- **Cuenta, QR y Drive**: datos de la cuenta, imagen del QR, contacto para problemas (WhatsApp/llamada) y estado de Google Drive.

El usuario y la contraseña del admin se configuran en `.env` (`ADMIN_USER`, `ADMIN_PASSWORD`).

## Logos

Ya están en `frontend/public/`:
- `logo-igm.png`
- `logo-ministerio.png`

Para cambiarlos, reemplaza los archivos y ejecuta `docker compose up -d --build frontend`.

## Despliegue en el servidor (wilo-server)

Vive en `~/igm-rancho` (clon de https://github.com/WilmerBuestan/IGMrancho), separado de Alfredo y TeConecta.
Publicado en **https://rancho.simtrg.date** mediante su **propio túnel** de Cloudflare (`igm-rancho`).

```bash
# Primera vez
git clone https://github.com/WilmerBuestan/IGMrancho.git ~/igm-rancho && cd ~/igm-rancho
cp .env.example .env   # llenar claves y descomentar COMPOSE_FILE / COMPOSE_PROFILES
docker compose up -d --build

# Actualizar con lo último de GitHub (datos y .env no se tocan)
ssh 192.168.100.134 '~/igm-rancho/actualizar.sh'
```

En el servidor, `.env` define `COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml`: la app escucha solo en
`127.0.0.1:8085` y `cloudflared` (perfil `tunel`) la publica.

### Crear el túnel (una vez)
1. Cloudflare → **Zero Trust → Networks → Tunnels → Create a tunnel** → *Cloudflared* → nombre `igm-rancho`.
2. Copia el token (el texto largo después de `--token`) en `CLOUDFLARE_TUNNEL_TOKEN` del `.env` y pon `COMPOSE_PROFILES=tunel`.
3. *Public hostname*: subdominio `rancho`, dominio `simtrg.date`, servicio **HTTP** → `frontend:80`.
4. `docker compose up -d`.

## Conectar Google Drive (una sola vez)

La app usa OAuth con el Gmail dueño del Drive y el permiso `drive.file`
(solo ve los archivos que ella misma crea, no el resto del Drive).

1. En <https://console.cloud.google.com> crea un proyecto y habilita **Google Drive API**.
2. *Pantalla de consentimiento OAuth*: tipo **Externo**, agrega tu Gmail como usuario de prueba
   y luego **publica la app** ("En producción"); en modo prueba el token caduca a los 7 días.
3. *Credenciales → Crear ID de cliente OAuth* → tipo **App de escritorio**. Copia el ID y el secreto.
4. Pon el ID y el secreto en `.env` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) y, en una computadora con navegador:
   ```bash
   cd backend && npm install && npm run drive-auth
   ```
   Abre el enlace e inicia sesión con el Gmail del Drive. El script guarda `GOOGLE_REFRESH_TOKEN` en `.env`.
5. `docker compose up -d api`. Para el servidor, copia las tres líneas `GOOGLE_*` a su `.env`.

La app crea la carpeta **IGM Rancho** en Mi unidad y recuerda su ID: puedes moverla o renombrarla.

Las capturas se reducen a JPEG de máx. 1600 px (~200 KB): 80 personas al día son ~16 MB diarios.
Si Drive falla, la reserva no se pierde: la captura queda en el servidor y se reintenta cada minuto.
Las reservas hechas antes de conectar Drive se suben solas al conectarlo.

## Desarrollo local

```bash
docker compose up -d postgres            # o un Postgres propio
cd backend && npm run dev                # requiere DATABASE_URL, JWT_SECRET, ADMIN_USER, ADMIN_PASSWORD
cd frontend && npm run dev               # http://localhost:5173 (proxy a :3000)
```

## Próximo: app móvil

La API ya es REST/JSON, así que la app móvil podrá usar los mismos endpoints.

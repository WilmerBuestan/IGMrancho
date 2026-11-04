# IGM Rancho — Lecciones aprendidas

Proyecto archivado el 2026-11-04. Funcionó completo (web, app Android, Drive, notificaciones y CRUD del admin),
pero no se puso en uso: el administrador previsto decidió no usarlo.

## Del proceso

- **Validar la adopción antes de construir en grande.** Se hicieron la web, el panel, la app móvil y las notificaciones
  antes de confirmar que el administrador (quien iba a operar todo a diario) de verdad lo usaría. La próxima vez:
  maqueta o versión mínima → probarla una semana con el usuario real → recién ahí la app móvil y los extras.
- **Preguntar las decisiones de producto al inicio** (identificación, precios, horario límite, almacenamiento) evitó
  rehacer cosas: esas respuestas casi no cambiaron en todo el proyecto.
- **El operador manda.** El CRUD del admin y el contacto de soporte salieron al final; eran lo que el administrador
  más iba a necesitar (la gente le escribe a él cuando se equivoca). Conviene diseñar primero el día a día del admin.

## Técnicas

### Google Drive con Gmail personal
- Una cuenta de servicio no puede guardar en un Drive personal: hace falta OAuth con *refresh token*.
- La pantalla de consentimiento debe estar **publicada**; en modo prueba el token caduca a los 7 días.
- Para publicar, Google pide página principal, política de privacidad y términos en un dominio autorizado.
  **No subir logo**: eso dispara la verificación de marca (días o semanas).
- El permiso `drive.file` solo ve lo que la app crea: no sirve un ID de carpeta creado a mano. Guardar el ID de la
  carpeta que crea la app permite moverla o renombrarla.

### Servidor y Cloudflare
- Un túnel y un `docker compose` propios por proyecto (como TeConecta) evitan tocar lo que ya funciona (Alfredo).
- Los subdominios y túneles de Cloudflare son gratis.
- El asistente del túnel no deja continuar hasta que el conector se conecta: hay que levantar `cloudflared` primero.
- Probar cambios de backend en una **copia aislada** (otro nombre de proyecto, base vacía, sin túnel) y borrarla
  después; nunca sobre los datos reales. Los borrados en producción, siempre con filtro.

### Flutter / Android
- `google_fonts` 9 usa otro paquete de Material: incompatible con Flutter de oct-2026 → quedarse en la 8.
- `file_picker` 13 cambió a `FilePicker.pickFiles(...)` (estático, devuelve lista).
- `receive_sharing_intent` exige `compileSdk = 37`.
- `local_auth` necesita `FlutterFragmentActivity`.
- Firmar con una llave propia desde el primer APK; sin ella las actualizaciones no se instalan encima.
- Servir el APK desde el mismo servidor con un `app.json` de versión hace fácil distribuir a ~80 personas.

### Notificaciones (Firebase Cloud Messaging)
- Un celular puede ser admin **y** cliente a la vez: buscar los destinatarios del cliente por cédula y correo,
  no por rol.
- Probar de punta a punta con el emulador: `adb shell dumpsys notification` muestra lo que llegó.

### Web
- Un solo backend REST para web y app evitó duplicar lógica.
- Paleta de gráficos validada para daltonismo (azul, naranja y aqua) en vez de elegir colores a ojo.

## Si algún día se reactiva

Ver el README. Los respaldos de la base, las capturas y el `.env` del servidor están en
`wilo-server:~/respaldos/igm-rancho/`. La carpeta `~/igm-rancho` y sus volúmenes de Docker siguen en el servidor:
`cd ~/igm-rancho && docker compose up -d` lo vuelve a levantar (si el túnel de Cloudflare aún existe).

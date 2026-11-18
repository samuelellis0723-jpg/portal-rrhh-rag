# Autenticación y vacaciones: prueba en Postman

El backend reutiliza las credenciales de `backend/.env` y los hashes scrypt existentes. No reemplazar ese archivo ni volver a sembrar para probar login. Iniciar desde `backend/` con `npm start`.

## Preparar Postman

Crear y seleccionar un entorno de Postman con valores locales: `base_url=http://127.0.0.1:3001/api/v1`, `origin` con un origen exacto de `ALLOWED_ORIGINS` del `.env` (por ejemplo `http://localhost:5173`), `email`, `demo_password` y `csrf_token`. Para la contraseña usar un secreto local de Postman/Vault; obtener su valor del `.env` de forma privada. No sincronizar, exportar ni compartir valores con secretos, cookies o CSRF. No usar contraseñas como query string. No hace falta Authorization Bearer.

| Email | Variable del `.env` que contiene su contraseña |
|---|---|
| `colaborador@bosqueclaro.example` | `DEMO_COLABORADOR_PASSWORD` |
| `rrhh@bosqueclaro.example` | `DEMO_RRHH_PASSWORD` |

Usar siempre el mismo host en las solicitudes para que Postman reutilice la cookie; `localhost` y `127.0.0.1` tienen almacenes de cookies distintos. Mantener habilitado el cookie jar.

## Recorrido correcto

1. `POST {{base_url}}/auth/login`. Headers: `Origin: {{origin}}`, `Content-Type: application/json`. Body → raw → JSON:

   ```json
   {"email":"{{email}}","password":"{{demo_password}}"}
   ```

   Esperado: **200**, usuario y colaborador con solo los atributos públicos, `csrf_token` y `expires_at`. Postman guarda automáticamente la cookie `bosque_claro_sid` (o el nombre configurado). El token de sesión solo viaja en esa cookie HttpOnly; MySQL conserva su hash. En desarrollo HTTP no lleva Secure; en producción sí.

2. Guardar el CSRF en una variable local. Puede hacerse en el script **Post-response** del login y de `/auth/session`, sin imprimirlo:

   ```javascript
   if (pm.response.code === 200) {
     pm.environment.set('csrf_token', pm.response.json().data.csrf_token);
   }
   ```

3. `GET {{base_url}}/auth/session`, sin body. Esperado: **200**, misma identidad, CSRF estable y vencimiento fijo de ocho horas desde login; consultar sesión no renueva la expiración.

4. `GET {{base_url}}/me/vacaciones?limit=20&offset=0`, sin body. Esperado: **200**, períodos propios, `total` y `total_dias_disponibles`. Los días se devuelven como cadenas con dos decimales. La suma abarca todos los períodos, incluso al consultar una página vacía.

5. `POST {{base_url}}/auth/logout`, sin body. Headers: `Origin: {{origin}}`, `X-CSRF-Token: {{csrf_token}}`. Esperado: **204** sin contenido y cookie eliminada. La fila de sesión queda revocada en MySQL.

6. Repetir session y vacaciones: **401 UNAUTHENTICATED**. Incluso reutilizando la cookie anterior al logout, se recibe 401. No guardar esa cookie en archivos compartidos.

Repetir el recorrido con el otro email y su correspondiente secreto. RRHH consulta únicamente sus vacaciones a través de `/me/vacaciones`.

## Rechazos esperados

| Prueba | Resultado |
|---|---|
| Password incorrecta o correo inexistente | 401 `INVALID_CREDENTIALS`, mismo mensaje genérico |
| Session/vacaciones sin cookie, con cookie falsa, revocada o expirada | 401 `UNAUTHENTICATED` |
| Login sin Origin permitido | 403 `ORIGIN_NOT_ALLOWED` |
| Login con Origin válido y `text/plain` o formulario | 415 `UNSUPPORTED_MEDIA_TYPE` |
| Logout con sesión válida y sin CSRF, CSRF incorrecto o de otra sesión | 403 `CSRF_INVALID`; la sesión sigue vigente |
| Logout con sesión válida y Origin ajeno | 403 `ORIGIN_NOT_ALLOWED`; la sesión sigue vigente |
| Vacaciones con `?colaborador_id=91000001` o `?rol=rrhh` | 400 `VALIDATION_ERROR` para ambos roles |
| Vacaciones con `limit=101`, `offset=-1` o parámetros duplicados | 400 `VALIDATION_ERROR` |
| Login con campos extra, tipos incorrectos o JSON inválido | 400 `VALIDATION_ERROR` |
| Más de diez solicitudes de login por IP en quince minutos | 429 `RATE_LIMITED`, con `Retry-After` |

El límite incluye intentos correctos y entradas inválidas después de validar Origin. Para el recorrido manual normal, hacer las pruebas de límite al final y respetar `Retry-After`.

Los middlewares `requireAuth` y `requireRole(...roles)` se verifican con HTTP y sesiones MySQL reales en un arnés exclusivo de integración: colaborador recibe 403 en una ruta limitada a RRHH y viceversa; el rol actualizado se relee desde MySQL. Esas rutas del arnés **no se publican**. Las rutas reales `/rrhh/reportes` y `/rrhh/reportes/:fecha` ya requieren RRHH: con colaborador devuelven 403. La fecha 2026-11-17 tiene un fixture identificado; una fecha no publicada retorna 404 para RRHH.

## Verificación automatizada y alcance

Desde `backend/`:

```bash
npm test
npm run test:integration
npm run db:verify
npm run smoke
```

Resultado verificado: **61 pruebas unitarias y 13 de integración aprobadas**, integridad de las 14 tablas y 15 migraciones y 60 personas simuladas, y arranque HTTP con salud MySQL 200. Incluye login de ambas cuentas, rechazos de password, restauración de sesión, saldos propios contrastados con SQL, paginación, ambos roles, CSRF, origen, CORS, expiración, revocación, usuario bloqueado, colaborador inactivo, límite real de login y errores de dependencia sin detalles internos.

Las pruebas de integración usan la base de desarrollo configurada y deben ejecutarse sin tráfico concurrente: cambian temporalmente estado/rol de una cuenta demo y restauran los valores; eliminan únicamente las sesiones que ellas crean. Los archivos se ejecutan en serie para evitar interferencias con el chequeo del seeder. No cambian contraseñas ni migraciones.

El límite de login usa memoria por proceso y la IP de conexión sin confiar en `X-Forwarded-For`. Para varias réplicas o un proxy se requiere configurar un limitador compartido y confianza de proxy explícita. La cuenta local MySQL conserva los permisos existentes; la separación de credenciales de ejecución y migración continúa pendiente de un administrador. Frontend, chat y reportes HTTP están implementados. Las consultas de políticas requieren corpus Drive/Qdrant y DeepSeek disponibles; el lector Drive, Gemini y Qdrant se comprobaron, pero Drive está vacío y faltan escritora Google y clave DeepSeek.

## Chat y reportes en Postman

Tras login, `POST {{base_url}}/chat` con Origin, JSON y X-CSRF-Token, cuerpo `{"mensaje":"¿Cuántos días de vacaciones me quedan disponibles?"}` devuelve saldo SQL de la sesión. `GET /chat/historial?limit=20&offset=0` recupera solo su historial. No enviar ID ni rol. Una pregunta documental puede devolver 503 por DeepSeek pendiente; una mixta puede devolver 200 con `estado=parcial`, dato propio y abstención documental explícita.

Con cuenta RRHH, `GET /rrhh/reportes` y `GET /rrhh/reportes/2026-11-17` devuelven historial y fixture; con colaborador devuelven 403. `GET /me/proximo-pago`, `/me/proxima-evaluacion` y `/me/solicitudes` siempre usan identidad de sesión, también para RRHH. Después de logout todas estas rutas devuelven 401.

# Frontend React/Vite de Bosque Claro

El frontend de `frontend/` usa React, Vite, JavaScript y React Router con versiones exactas y lockfile. Consume la autenticación y las vacaciones del backend existente; no tiene cuentas ni cifras precargadas.

## Iniciar en desarrollo

Requiere Node.js 22.12 o superior y el backend/MySQL ya configurados. No reemplazar `backend/.env` ni ejecutar nuevamente el seeder para iniciar la interfaz.

Terminal 1, desde la raíz:

```bash
cd backend
npm start
```

Terminal 2, desde la raíz:

```bash
cd frontend
npm ci
npm run dev
```

Abrir **http://localhost:5173**. Express escucha normalmente en `http://127.0.0.1:3001`. Si el puerto de Vite está ocupado, falla de forma explícita para evitar cambiar a un origen no autorizado.

`frontend/.env.example` documenta los valores públicos; los mismos valores funcionan por defecto sin crear otro `.env`:

```dotenv
VITE_API_URL=/api/v1
API_PROXY_TARGET=http://127.0.0.1:3001
```

Vite reenvía `/api` a Express conservando Origin. La cookie queda vinculada a `localhost`, el mismo host visible en el navegador. El arranque comprueba que `http://localhost:5173` esté en `ALLOWED_ORIGINS` del backend; se verificó que coincide con la configuración existente y que un origen distinto impide el arranque. No se modificó la configuración de credenciales. No abrir la interfaz con `127.0.0.1:5173`, pues sería otro origen.

Para usar otro destino de Express, configurar `API_PROXY_TARGET` en un archivo local `frontend/.env`. Ninguna variable `VITE_*` debe contener secretos. En producción se necesita servir el build con fallback a `index.html` para las rutas de React y configurar `/api` hacia Express, o una URL pública de API con CORS/cookies apropiados; el proxy de Vite solo corresponde a desarrollo y preview.

## Recorrido implementado

- `/login`: correo, contraseña, opción de mostrarla, validación HTML, estado de envío y errores accesibles. No imprime credenciales ni guarda contraseñas.
- Antes de mostrar las rutas, `GET /auth/session` recupera identidad y CSRF. Una sesión existente lleva a `/mi-espacio`; un 401 lleva al login. Un fallo de red/dependencia muestra un error con reintento.
- `/mi-espacio`: nombre, correo, rol y saldo total real; tabla por período y paginación de `GET /me/vacaciones`. RRHH también consulta exclusivamente sus propios datos. Los decimales se conservan como cadenas; solo se cambia el separador para presentación.
- `/chat`: historial privado paginado y persistido en MySQL, envío con CSRF, consultas SQL propias, respuestas mixtas y citas documentales con enlaces. Maneja carga, fallo recuperable, reintento y sesión vencida.
- `/rrhh/reportes`: exclusivo de RRHH, cuatro indicadores, dos gráficas (incluida tendencia de 30 días), pendientes, ocho contenidos e historial. Lee JSON publicado; identifica los fixtures y no genera reportes desde GET.
- Logout: `POST /auth/logout` con cookie y `X-CSRF-Token`, regreso al login tras revocación. Un fallo de conexión no se presenta como cierre exitoso.
- Las rutas privadas dependen de la sesión. Los 401 posteriores eliminan el estado privado; también se controla el vencimiento informado por el servidor y se consulta sesión al volver a la pestaña.

Todas las peticiones están en `src/services/` y usan `credentials: 'include'`. El CSRF queda en memoria, se obtiene nuevamente al recargar y se envía en las mutaciones autenticadas. No hay tokens en localStorage ni sessionStorage; la cookie de sesión es HttpOnly. La autorización definitiva permanece en Express.

La interfaz utiliza tonos neutros y verdes suaves, tipografía con fallback de sistema, espacios amplios, formularios con etiquetas, foco visible, mensajes de estado/error, respeto por movimiento reducido y un detalle de períodos adaptado a móvil. Las fuentes web usan Google Fonts; sin conexión se utiliza la fuente de sistema.

## Estructura

```text
frontend/
  src/
    assets/                  # marca SVG y estilos
    components/              # piezas de UI y proveedor de sesión
    pages/                   # Login, MiEspacio, Chat y Reportes
    routes/
      Routing.jsx
      PrivateRoutes.jsx
    services/                # HTTP, autenticación, vacaciones, chat y reportes
    App.jsx
    main.jsx
  test/auth.spec.js
  playwright.config.js
  vite.config.js
  .env.example
```

## Build y verificaciones

Desde `frontend/`:

```bash
npm run build
npm run test:e2e
```

Playwright inicia Vite y Express si no están activos. Requiere Chromium instalado para esa versión de Playwright; ya estaba disponible en el entorno verificado. En otra máquina puede instalarse con `npx playwright install chromium`. Ejecutar contra la base de desarrollo, sin otras pruebas que modifiquen cuentas demo al mismo tiempo. Las contraseñas se leen privadamente desde el entorno del backend; no se guardan en la configuración del frontend.

Se verificaron **ocho pruebas de navegador**: cuatro escenarios en escritorio y los mismos cuatro en móvil. Cubren ambas cuentas, login correcto e incorrecto, restauración tras recarga, saldo/detalle contrastados con SQL, cambio de tamaño de página, cookies HttpOnly, rutas privadas, logout con revocación MySQL, sesión vencida, reintento tras fallos de red y ausencia de desbordamiento horizontal. Las pruebas no cambian contraseñas ni datos de vacaciones; solo crean sesiones propias, simulan su vencimiento y las eliminan al terminar. Las capturas del espacio privado con datos sintéticos quedan en `frontend/test-results/`, ignorado por Git; no se generan trazas con credenciales.

El fixture actual tiene un período por cuenta demo: los botones anterior/siguiente se deshabilitan correctamente. Se verificó la paginación real cambiando `limit` y comprobando la respuesta y el total de la API; no se agregaron períodos ficticios a la base para forzar varias páginas.

También pasaron 61 pruebas unitarias y 13 de integración del backend, y `db:verify`. El recorrido principal verifica chat SQL persistido tras recarga, restricción de RRHH y dashboard con fixture. La presentación de respuesta mixta y citas tiene un doble HTTP explícito de interfaz; no acredita Drive ni DeepSeek reales. El acceso lector real sigue encontrando Drive vacío y falta la clave DeepSeek.

El build se genera en `frontend/dist/`. Para probarlo localmente, detener primero el dev server y ejecutar `npm run preview`; conserva el puerto 5173 y el proxy hacia Express.

## Aviso de dependencias de desarrollo

La auditoría completa de npm detectó cinco entradas de severidad alta que provienen del mismo aviso de ReDoS en `picomatch`, utilizado por Vite y sus herramientas transitivas. La versión publicada más reciente consultada, 4.0.7, seguía afectada y 4.0.8 no estaba disponible. La corrección automática propuesta bajaba Vite a otra versión mayor; no se aplicó ese cambio de forma automática. Se conserva Vite 8.3.8 y el servidor de desarrollo queda limitado a localhost. `npm audit --omit=dev` reportó cero vulnerabilidades para las dependencias de producción. Este aviso de herramientas de desarrollo queda pendiente de una versión corregida compatible.

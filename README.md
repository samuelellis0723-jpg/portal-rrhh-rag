# Portal RRHH — Bosque Claro

Mini Proyecto #2. Empresa ficticia **Bosque Claro Servicios Digitales S.A.**, Costa Rica, con **60 colaboradores simulados**. Stack: Node.js, Express, Sequelize y MySQL; frontend React/Vite. Este README distingue el código preparado de lo comprobado contra servicios reales.

## Estado de esta etapa

Implementados: backend por capas, 14 modelos/tablas y 15 migraciones, seed reproducible, autenticación con sesiones opacas, cookies y CSRF, saldo propio, consultas personales de chat mediante SQL, reportes RRHH con historial y detalle, y frontend React/Vite con login, chat, dashboard RRHH, restauración de sesión y logout. Las rutas HTTP reales requieren sesión y autorización; los reportes de demo conservan `origen=fixture`.

Verificado con servicios reales: MySQL y los recorridos de navegador de escritorio/móvil; se ejecutaron ocho pruebas de navegador para login/sesión/saldo/logout, consultas de chat SQL persistidas y lectura del dashboard RRHH sobre un fixture. Drive tiene acceso de lectura autorizado, pero la carpeta está vacía (0 archivos). Gemini generó embeddings reales y Qdrant respondió; la sincronización inicial de carpeta vacía terminó correctamente, sin indexar documentos.

Preparados, sin ejecución persistente: publicación a Drive (falta credencial escritora), agente analista con agregaciones SQL y validación del resumen, CLI de generación y worker diario. El worker no está instalado como servicio ni activo como daemon. Falta `DEEPSEEK_API_KEY`; por eso las respuestas de políticas y el resumen diario LLM aún no están verificados. La evaluación HTTP real de 45 preguntas terminó: 15 aprobadas automáticamente, 0 fallidas y 30 bloqueadas; no se acredita todavía el 80 % de aciertos.

## Políticas e ingesta

Hay doce políticas/calendarios editables en [docs/politicas/manifest.json](docs/politicas/manifest.json), nueve HTML para convertir a Google Docs, dos CSV para Google Sheets y un PDF real. Cubren los diez dominios y separan fuentes legales oficiales de propuestas de Bosque Claro. El [informe de investigación](docs/investigacion-politicas.pdf) tiene nueve páginas y fuentes editables.

El agente de ingesta tiene carga inicial, `changes.list`, cursor MySQL, bloqueo, extracción Docs/Sheets/PDF, fragmentación, embeddings OpenAI/Gemini, revisiones deterministas y búsqueda filtrada en Qdrant. El publicador manual usa una credencial escritora separada; el agente solo solicita lectura.

```bash
cd backend
npm run policies:plan
npm run ingest:check -- --live
```

Estado real al 18-11-2026: Drive autorizado para lectura; carpeta permitida vacía. Gemini y Qdrant están accesibles y verificados con la sincronización inicial vacía, por lo que todavía **no hay documentos publicados ni fragmentos indexados**. Falta `GOOGLE_PUBLISH_APPLICATION_CREDENTIALS` para publicar los doce documentos, y falta `DEEPSEEK_API_KEY` para redacción/consulta de políticas. El [prompt de configuración de accesos](docs/PROMPT_GEMINI_ACCESOS.md) y [registro de progreso](docs/PROGRESO.md) explican los pasos pendientes sin incluir secretos. Una sincronización vacía confirma conectividad, no búsqueda semántica sobre políticas.

## Requisitos

- Node.js 24 LTS recomendado (el entorno usado tiene 24.22.2) y npm.
- MySQL **8.0.16+**, con InnoDB y soporte de CHECK; se verificó con MySQL 8.0.46.
- Credenciales MySQL para operaciones de aplicación. El acceso lector de Drive, Gemini embeddings y Qdrant reales ya se comprobaron; para publicar y responder políticas se requieren además la credencial escritora de Drive y la clave DeepSeek.

Las versiones exactas están fijadas en [backend/package.json](backend/package.json) y `package-lock.json`. Sequelize permanece en la rama 6 y Sequelize CLI en 6.6.2. Se fija la dependencia UUID de Sequelize y ExcelJS a 11.1.1, compatible con las funciones v1/v4 utilizadas, para resolver el aviso de la versión transitiva anterior. El lockfile incluye correcciones compatibles adicionales; no se ejecutó `audit fix --force`.

## Instalación y configuración

Desde la raíz:

```bash
cd backend
npm ci
```

Si `backend/.env` no existe, crearlo a partir del ejemplo:

```bash
cp .env.example .env
chmod 600 .env
```

Editar el archivo local y configurar `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_MIGRATION_USER` y `DB_MIGRATION_PASSWORD`. Las variables de migración permiten separar la identidad que cambia el esquema de la que ejecuta Express. En ausencia de `DB_MIGRATION_USER`, CLI reutiliza `DB_USER`. `DB_SOCKET_PATH` es opcional para conexiones por socket.

Si se dispone de un login path de MySQL ya configurado, el script opcional siguiente reutiliza sus valores sin imprimir su contraseña ni cambiar los permisos del servidor. Requiere `my_print_defaults` y se niega a reemplazar un `.env` existente:

```bash
node scripts/bootstrap-local.js NOMBRE_DEL_LOGIN_PATH
```

En esta máquina **ya se creó `backend/.env`**, con permisos 0600, reutilizando el perfil local existente. No reemplazarlo con el ejemplo. La identidad local no tiene GRANT OPTION, por lo que no pudo delegar privilegios; desarrollo usa el mismo perfil para CLI y ejecución. Las dos cuentas provisionales creadas al intentar separar privilegios se retiraron sin tocar bases ni datos. Para un despliegue, un administrador debe proporcionar cuentas separadas con privilegios limitados a la base del proyecto.

`DB_PASSWORD_BASE64` y `DB_MIGRATION_PASSWORD_BASE64` son alternativas para conservar caracteres especiales del perfil sin problemas de escape de dotenv. Tienen prioridad sobre sus variables sin sufijo. **Base64 sigue siendo una credencial, no cifrado**: no compartir ni imprimir esos valores.

Variables `DEMO_COLABORADOR_PASSWORD` y `DEMO_RRHH_PASSWORD`: diferentes entre sí, de 12–256 caracteres. El bootstrap genera valores aleatorios locales; el ejemplo no contiene contraseñas. MySQL almacena solo hashes scrypt con sal aleatoria. Para conocer las contraseñas de demo, consultar el `.env` local de forma privada.

Autenticación usa `ALLOWED_ORIGINS` (orígenes HTTP(S) explícitos separados por coma), `SESSION_COOKIE_NAME` (por defecto `bosque_claro_sid`), `SESSION_TTL_HOURS=8` y `CSRF_SECRET` (al menos 32 bytes). Los valores existentes se conservan. Salud y migraciones no requieren esa configuración. `QDRANT_*`, `GOOGLE_DRIVE_FOLDER_ID`, `GOOGLE_APPLICATION_CREDENTIALS` y `AI_*`/`INGEST_*` configuran Drive lector, embeddings y Qdrant. `DEEPSEEK_API_KEY` y sus opciones `DEEPSEEK_*` son independientes y se reservan para el LLM; la clave todavía falta. La guía detalla la credencial escritora opcional separada.

## Iniciar la interfaz React/Vite

El backend debe estar activo con `cd backend` y `npm start`. En otra terminal, desde la raíz:

```bash
cd frontend
npm ci
npm run dev
```

Abrir **http://localhost:5173**. Vite verifica este origen contra `ALLOWED_ORIGINS` del backend y utiliza un proxy `/api` hacia Express. `frontend/.env.example` define `VITE_API_URL=/api/v1` y `API_PROXY_TARGET=http://127.0.0.1:3001`; esos valores funcionan por defecto. No reemplazar `backend/.env` ni copiar secretos a variables `VITE_*`.

Para verificar el frontend desde `frontend/`:

```bash
npm run build
npm run test:e2e
```

El build y ocho pruebas Chromium de escritorio/móvil están verificados contra Express/MySQL reales. Cubren login, restauración de sesión, saldo, logout, consultas de chat basadas en SQL persistidas y dashboard RRHH leyendo un reporte fixture. La rama de políticas respaldada por Drive no pasó una prueba real porque la carpeta todavía no tiene documentos y falta DeepSeek. Más detalles en [frontend y verificaciones](docs/frontend.md).

La auditoría de dependencias de producción del frontend reportó cero vulnerabilidades. La auditoría completa detectó un aviso transitivo de `picomatch` en las herramientas de desarrollo de Vite, pendiente de corrección compatible; está documentado en la guía.

## Crear base, aplicar esquema y cargar datos

Ejecutar desde `backend/`:

```bash
npm run db:create
npm run db:migrate
npm run db:seed
npm run db:migrate:status
npm run db:verify
```

- `db:create` usa `CREATE DATABASE IF NOT EXISTS`: no elimina ni reinicia bases.
- `db:migrate` aplica las migraciones pendientes; el proyecto conserva 14 migraciones iniciales y una migración posterior. Sequelize registra su estado en `SequelizeMeta`.
- `db:seed` registra el seeder en `SequelizeData`; una segunda ejecución no vuelve a cargarlo. El seeder también comprueba su snapshot si se invoca directamente: no sobrescribe registros, rechaza colisiones o cambios y revierte toda la carga si falla.
- La carga reserva IDs a partir de **91000001**, correos `.example` y origen `fixture`. Una colisión con registros existentes detiene la carga en vez de borrarlos. No cambiar IDs ni contraseñas de cuentas existentes silenciosamente.
- `db:verify` revisa columnas, índices, CHECK, relaciones FK, migraciones aplicadas, cantidades del fixture, consistencia de saldos y hashes de ambas cuentas demo; no imprime hashes ni claves.
- No ejecutar comandos `db:drop`, `sync({ force: true })` ni desactivar claves foráneas para resolver conflictos.

Las migraciones tienen `up`/`down`. Las tablas nuevas llevan una marca de origen para poder completar una migración interrumpida por DDL no transaccional. Una tabla preexistente sin esa marca provoca `SCHEMA_CONFLICT`; no se adopta ni altera automáticamente. La reversión de migraciones borra tablas y no se usa sobre datos que deban conservarse. El `down` del seed solo elimina sus registros si siguen coincidiendo con el fixture y las FK lo permiten, todo en transacción.

## Datos de demostración

Ventana histórica: **2026-08-18 a 2026-11-17 inclusive**. Los pagos/evaluaciones futuros permiten consultar próximas fechas. Son ejemplos operativos, no mínimos legales.

| Tabla | Registros del fixture |
|---|---:|
| colaboradores | 60 |
| usuarios | 60 |
| saldos_vacaciones | 60 |
| solicitudes | 181 |
| incapacidades | 58 |
| movimientos_personal | 65 |
| pagos | 285 |
| evaluaciones | 114 |
| consultas_chat | 322 |
| agent_execution_logs | 644 |
| reportes_diarios | 92 |

Hay ingresos anteriores a la ventana para reconstruir la dotación inicial y movimientos durante los tres meses. Incluye personas inactivas, solicitudes con más de 72 horas pendientes, incapacidades activas y saldos superiores a 20 días.

El seeder no carga `sesiones`, `drive_documentos` ni `drive_sync_state`. Las sesiones se crean al iniciar sesión; la sincronización real creó estado persistente de la carpeta, pero encontró 0 archivos. No se fabrican tokens, documentos ni citas. Cada reporte histórico tiene `origen=fixture` y `generado_por=fixture_sin_llm`; el resumen se calcula sobre el fixture sin llamar a IA. Los días anteriores a la ventana se representan como desconocidos (`null`) en la tendencia, no como ceros observados.

| Cuenta de demo | Rol | Variable local de contraseña |
|---|---|---|
| `colaborador@bosqueclaro.example` | colaborador | `DEMO_COLABORADOR_PASSWORD` |
| `rrhh@bosqueclaro.example` | rrhh | `DEMO_RRHH_PASSWORD` |

Estas cuentas existen en MySQL y pueden usarse en `POST /api/v1/auth/login`. Cambiar las variables después de cargar el seed no modifica sus hashes guardados.

## Iniciar Express y comprobar salud

```bash
npm start
```

Por defecto: `http://127.0.0.1:3001`. En otra terminal:

```bash
curl -i http://127.0.0.1:3001/api/v1/health
```

Con MySQL disponible devuelve HTTP 200:

```json
{"data":{"status":"ok","database":"up"}}
```

Sin conexión devuelve HTTP 503 con `DEPENDENCY_UNAVAILABLE`, `status=degraded` y `database=down`, sin detalles del driver. El servidor puede iniciar aunque MySQL no esté disponible: el endpoint comunica el estado real. No verifica todavía Drive, Qdrant o IA.

Para reinicio automático al editar: `npm run dev`. Para arrancar el servidor real en un puerto temporal, verificar salud y cerrarlo automáticamente:

```bash
npm run smoke
```

## Chat, dashboard y worker

El chat persiste las consultas de datos personales con SQL y la identidad de la sesión. Las respuestas que requieren políticas necesitan documentos indexados y DeepSeek; sin esos accesos no se debe presentar una respuesta documental como verificada. El dashboard requiere rol `rrhh`, lee reportes persistidos y muestra explícitamente los fixtures como simulación.

Para iniciar el worker en una terminal separada (tras iniciar MySQL y configurar el entorno):

```bash
cd backend
npm run worker
```

El proceso comprueba cada 30 segundos el horario `America/Costa_Rica`: reportes a las 07:00 e ingesta diaria independiente a las 02:00. También recupera tareas vencidas después de un reinicio. El código está listo, pero el worker **no está instalado como servicio del sistema ni se mantiene activo automáticamente**; para operación continua hay que ejecutarlo bajo un supervisor o definir un servicio de sistema. Si falta DeepSeek, la generación falla explícitamente y no reemplaza un reporte existente. Los GET de reportes nunca generan datos.

## Pruebas

```bash
npm test
npm run test:integration
```

Las pruebas unitarias/de integración se ejecutan desde `backend/`; las ocho pruebas de navegador desde `frontend/`. Para repetir las últimas: `npm run test:e2e`. Pasaron 61 pruebas unitarias y 13 de integración MySQL sin omisiones. El banco de 45 preguntas terminó con 15 aprobadas automáticamente, 0 fallidas y 30 bloqueadas. Las preguntas 21/22 se rechazaron sin datos. El p90 HTTP de 57 ms incluye errores y rechazos; no acredita el p90 del RAG. Ver [resultados y criterios](docs/evaluacion/README.md). Ver [guía de autenticación y Postman](docs/autenticacion-postman.md).

`npm run db:verify` y `npm run smoke` son comprobaciones adicionales. La base `DB_TEST_NAME` queda reservada para pruebas aisladas futuras: `test:integration` usa la base de desarrollo configurada y sus fixtures, no aplica migraciones sobre otras bases automáticamente.

## Estructura

```text
backend/
  .sequelizerc
  .env.example
  scripts/                    # creación no destructiva, bootstrap, verificación y smoke
  src/
    config/                   # env, config.js para CLI y Sequelize de ejecución
    database/                 # snapshot v1 inmutable y definición de atributos
    models/                   # 14 modelos/tablas y asociaciones explícitas
    migrations/               # 15 migraciones y helper de creación
    seeders/                  # carga transaccional del fixture
    fixtures/                 # generador sintético determinista
    routes/                   # salud, autenticación, chat, datos propios y reportes RRHH
    controllers/
    services/                 # salud, hashes, sesiones y vacaciones
    middleware/               # autenticación, roles, CSRF, CORS, validación y errores
    repositories/             # consultas parametrizadas y agregaciones de reportes
    agents/, prompts/         # chat/datos, políticas, analista e instrucciones
    integrations/, jobs/      # Drive, embeddings, Qdrant, DeepSeek y scheduler
    app.js
    server.js
  test/
```

No editar el snapshot `schema-v1.json` ni migraciones ya aplicadas para cambios funcionales posteriores; crear una nueva migración y actualizar los modelos de forma explícita. Los nombres de tabla/campo se mantienen iguales al DBML, con `timestamps: false` y fechas técnicas en UTC. Los valores DECIMAL permanecen como cadenas.

## Estado ejecutado y verificado

En esta máquina: dependencias instaladas, base de desarrollo y fixtures conservados, migraciones aplicadas y comprobaciones MySQL completadas. Además de los recorridos de navegador, se probaron con MySQL real el acceso al chat SQL persistido y dashboard RRHH con fixture. Drive lector, Gemini y Qdrant tienen conectividad real; la carpeta autorizada contiene cero archivos y la sync inicial vacía no generó puntos. La credencial escritora Drive y la clave DeepSeek siguen pendientes. El worker arrancó y cerró con SIGTERM en una prueba real: la ingesta funcionó independientemente del fallo explícito del reporte por falta de DeepSeek. No está instalado ni activo como servicio; hay una plantilla en infra/bosque-claro-worker.service.example.

La importación visual del DBML en dbdiagram.io, reversión completa de migraciones en una base descartable y evaluación final de la rúbrica no se han ejecutado/completado. La evaluación real está guardada en docs/evaluacion/resultados-actuales.json; requiere repetición con el corpus y DeepSeek para medir calidad semántica y p90 RAG. No se modificaron credenciales. El limitador de login es por proceso; un despliegue con varias réplicas requiere almacenamiento compartido.

Documentos: [enunciado](enunciado.md), [Semana 1](plan-semana-1.md), [DBML](docs/diagrama.dbml), [API](docs/contrato-api.md), [plan de implementación](docs/plan-implementacion.md).

Entregables preparados: [arquitectura](docs/arquitectura.md), [informe técnico editable](docs/informe-tecnico.md), [PDF técnico](docs/informe-tecnico.pdf), [guion de demo](docs/demo.md) y [banco/evaluación](docs/evaluacion/README.md). El video requiere grabación; no se ha fabricado evidencia de publicación o LLM.

La hoja entregable está en [Excel](docs/evaluacion/evaluacion-45.xlsx) y [CSV](docs/evaluacion/evaluacion-45.csv); regenerar con `npm run eval:export` después de `eval:chat`. El informe técnico PDF tiene 11 páginas verificadas. Para renderizar sin Chromium: `node docs/render-informe-tecnico.cjs --html-only` y convertir el HTML a PDF con LibreOffice local (`libreoffice --headless --convert-to pdf --outdir docs docs/informe-tecnico.html`).

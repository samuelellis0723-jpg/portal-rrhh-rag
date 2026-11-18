# Guía del repositorio

## Contexto y alcance

- Leer `enunciado.md`, `plan-semana-1.md` y los diseños de `docs/` antes de implementar.
- Empresa ficticia: Bosque Claro Servicios Digitales S.A., Costa Rica, 60 colaboradores con datos exclusivamente simulados.
- La etapa autorizada por la solicitud del 2026-11-18 comprende completar la práctica: backend/autenticación/frontend existentes; publicación de políticas e ingesta Drive → embeddings Gemini → Qdrant; chat con DeepSeek independiente para clasificación/redacción, memoria aislada y agentes; reportes RRHH, worker diario e ingesta automática; evaluación de 45 preguntas y entregables. Se permite crear/aplicar nuevas migraciones conservando datos y credenciales. No modificar migraciones ya aplicadas. Distinguir preparación local, pruebas con dobles y ejecución con servicios reales; registrar avance en docs/PROGRESO.md y accesos pendientes sin secretos.
- Conservar las fuentes y pendientes legales de Semana 1; un ejemplo de API no convierte una política propuesta en normativa verificada.
- Preferencia del usuario: GPT-6.1 Sol como coordinador y GPT-6 Luna para subagentes. Seleccionar los modelos cuando el entorno lo permita; informar limitaciones sin afirmar cambios de configuración no comprobados. Delegar cuando el usuario lo pida o autorice expresamente.

## Stack y fuentes de verdad

- Backend: Node.js, Express, Sequelize 6 con CLI compatible y driver `mysql2`; MySQL 8.0.16 o superior, InnoDB y `utf8mb4`. Fijar versiones concretas y lockfiles al implementar.
- Frontend: React con Vite, JavaScript y React Router. Express usa CommonJS para facilitar la compatibilidad con Sequelize CLI; frontend usa módulos ES de Vite.
- MySQL contiene identidades, sesiones, saldos, solicitudes, incapacidades, movimientos, pagos, evaluaciones, consultas y reportes. Es la fuente de cifras.
- Google Drive contiene las políticas. Qdrant contiene sus fragmentos y embeddings derivados; no es fuente de saldos ni registros personales.
- No introducir PostgreSQL ni pgvector. La separación MySQL/Qdrant es una decisión del proyecto, permitida por el enunciado.

## Estructura prevista

```text
frontend/
  src/
    components/          # piezas reutilizables de interfaz
    pages/               # composición de componentes por pantalla
    routes/              # rutas y protección visual según sesión/rol
    services/            # cliente HTTP y peticiones a Express
    App.jsx              # integra rutas y proveedores globales
    main.jsx             # monta React en el DOM
backend/
  src/
    config/              # configuración desde entorno; adaptador de Sequelize CLI
    models/              # modelos y asociaciones Sequelize
    migrations/          # cambios de esquema versionados
    seeders/             # datos sintéticos reproducibles
    routes/              # rutas Express y middleware de validación/autorización
    controllers/         # adaptación HTTP, sin SQL ni prompts
    middleware/          # sesión, CSRF, permisos, errores y límites
    services/            # reglas de aplicación y orquestación
    repositories/        # consultas Sequelize parametrizadas
    agents/              # orquestador, políticas, datos, analista, ingesta
    prompts/             # instrucciones versionadas por agente
    integrations/        # Drive, Qdrant y proveedor de IA
    jobs/                # sincronización y reporte diario
    app.js               # configuración de Express
    server.js            # arranque del servidor
docs/
  diagrama.dbml
  contrato-api.md
  plan-implementacion.md
```

La composición del frontend sigue **components → pages → routes → App → main**. Las páginas invocan `src/services/`; no colocar `fetch`, claves o URLs de proveedores en componentes. Las rutas protegidas mejoran la navegación, pero la autorización real siempre ocurre en Express. Los servicios HTTP usan cookies de sesión y el token CSRF del contrato.

## Datos y migraciones

- `docs/diagrama.dbml` define el esquema acordado. Reflejar nombres, tipos, índices, restricciones y asociaciones explícitamente en Sequelize.
- Configurar `.sequelizerc` al implementar para apuntar a las carpetas de `backend/src/`; no generar una segunda estructura de modelos en la raíz.
- Usar migraciones `up`/`down` y seeders; no usar `sequelize.sync({ force: true })` ni `sync({ alter: true })` como mecanismo de esquema.
- No modificar migraciones ya aplicadas: añadir otra. No asumir rollback transaccional de DDL MySQL; diseñar cambios y reversión explícitos.
- Crear primero tablas padre y luego dependientes; resolver `jefe_id` después de insertar colaboradores. Usar transacciones para operaciones DML relacionadas.
- Simular 60 colaboradores y el período 2026-08-18 a 2026-11-17 inclusive. Los reportes anteriores a la integración son fixtures identificados, nunca evidencia de ejecución de agentes.
- No guardar datos reales ni contraseñas en claro. Los ejemplos de cuentas usan el dominio reservado `.example`; las contraseñas de demo se suministran mediante entorno y se almacenan como hash.
- Fechas de negocio `DATE` en `America/Costa_Rica`; instantes persistidos en UTC. Serializar DECIMAL como cadenas en la API para preservar precisión; IDs enteros.

## Agentes y seguridad

- Solo el agente de ingesta accede a Drive; sincroniza altas, ediciones y eliminaciones con `changes.list` y un cursor persistente. Validar siempre pertenencia a la carpeta autorizada.
- Políticas usa Qdrant y el LLM; no accede a cifras personales. Datos usa consultas de lectura permitidas con el ID obtenido de la sesión; el LLM no genera SQL ejecutable.
- El orquestador combina respuestas mixtas conservando la procedencia de cada parte. No aceptar identidad, rol o `colaborador_id` del mensaje, cuerpo o query para consultas propias.
- El analista obtiene cifras por SQL y persiste JSON y resumen; el dashboard solo lee reportes publicados. Programar a las 07:00 `America/Costa_Rica` y evitar duplicados por fecha.
- Registrar la consulta y cada ejecución de agente con fragmentos, latencia y escalamiento. No registrar contraseñas, cookies, tokens ni documentos personales.
- Autenticación con sesión opaca de servidor, cookie HttpOnly y token almacenado solo como hash; revocación y expiración. CSRF y permisos conforme a `docs/contrato-api.md`.
- Para la primera versión, incluso RRHH utiliza `/me/*` para sus datos y `/rrhh/reportes*` para agregados autorizados. No abrir consultas arbitrarias de terceros.
- Una respuesta de política debe citar documento, sección, versión y enlace real a Drive. Si falta respaldo o una dependencia, abstenerse o responder error explícito; no simular una integración exitosa.

## Secretos y validación

- Credenciales en entorno o gestor de secretos. Excluir `.env`, archivos de cuenta de servicio, claves, cookies y volcados; versionar únicamente ejemplos con nombres y valores ficticios.
- El frontend solo recibe configuración pública (por ejemplo, la URL de Express). Toda variable `VITE_*` se considera pública; nunca colocar allí secretos de IA, Drive, Qdrant o MySQL.
- Separar credenciales de migración de las de ejecución. Aplicar mínimo privilegio y repositorios de lectura para el agente de datos.
- Validar límites de entrada y errores sin detalles internos. Probar acceso cruzado, rol, sesiones, citas, consultas mixtas y cifras del reporte.
- Objetivos finales: 45 preguntas evaluadas, al menos 80 % de aciertos, cero fugas en preguntas 21/22, y p90 de latencia menor de 8 segundos. No reportarlos como logrados sin mediciones.

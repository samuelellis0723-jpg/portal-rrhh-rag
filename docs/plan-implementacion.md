# Plan de implementación del MVP

## Estado de ejecución al 18 de noviembre de 2026

La arquitectura descrita más abajo conserva el plan y los criterios de aceptación; el estado de cada etapa se distingue aquí para no confundir diseño con evidencia.

**Verificado en MySQL y navegador:** autenticación, sesión/CSRF/logout, datos personales, chat con consultas SQL persistidas y dashboard RRHH leyendo un reporte fixture. Pasaron ocho recorridos de navegador desktop/móvil. Los fixtures del dashboard tienen `origen=fixture` y no son resultados del agente analista.

**Preparado en código, aún sin operación persistente:** agregaciones y generación de reportes, validación del resumen LLM, API de lectura RRHH, CLI y worker. El worker agenda reportes a las 07:00 `America/Costa_Rica` e ingesta independiente diaria; no está instalado como servicio ni activo como daemon. DeepSeek no está disponible porque falta `DEEPSEEK_API_KEY`, así que no se acredita un resumen LLM ni una política citada por el chat.

**Integraciones reales verificadas parcialmente:** Drive lector tiene acceso a la carpeta autorizada, vacía (0 archivos). Gemini embeddings y Qdrant son accesibles; la sincronización inicial vacía se completó. No hay documentos remotos ni búsqueda semántica sobre ellos. Falta la credencial escritora de Drive, por lo que los 12 documentos locales no se han publicado. Ver [guía de ingesta](ingesta-drive-qdrant.md), [pasos de acceso](PROMPT_GEMINI_ACCESOS.md) y [registro de progreso](PROGRESO.md).

La evaluación HTTP real de 45 preguntas terminó con 15 aprobadas automáticamente, cero fallidas y 30 bloqueadas. No acredita la calidad del RAG hasta publicar/ingerir documentos y habilitar DeepSeek; ver [resultados](evaluacion/README.md). Se conservan los pendientes legales y documentales de [Semana 1](../plan-semana-1.md). El [README](../README.md) contiene comandos reproducibles y estados comprobados.

Stack: Node.js y Express, Sequelize 6 con CLI compatible y `mysql2`, MySQL 8.0.16+; React/Vite; Qdrant; Google Drive. La elección sustituye PostgreSQL/pgvector. Las versiones exactas y lockfiles de backend y frontend están fijados en sus respectivos paquetes.

Stack acordado: Node.js y Express, Sequelize 6 con CLI compatible y `mysql2`, MySQL 8.0.16+; React/Vite; Qdrant; Google Drive. La elección sustituye PostgreSQL/pgvector. Las versiones exactas y lockfiles de backend y frontend ya están fijados en sus respectivos paquetes.

| Origen | Qué contiene | Quién lo consulta |
|---|---|---|
| Google Drive | Políticas académicas revisadas, con versiones, secciones y enlaces | Solo agente de ingesta |
| Qdrant | Fragmentos y embeddings derivados, con metadatos de citas | Agente de políticas |
| MySQL | Identidad, sesión, cifras personales, movimientos, logs y reportes | Repositorios autorizados de Express; agentes de datos y analista |

MySQL es la fuente de cifras; Drive es la fuente de políticas. El LLM clasifica y redacta, nunca establece identidad ni genera cifras o SQL ejecutable. Qdrant se reconstruye desde Drive. El backend coordina las dependencias; el navegador solo accede a Express.

## Orden de trabajo y criterios de salida

Seguir los pasos en este orden. Cada criterio debe tener evidencia antes de declarar que funciona.

### 1. Congelar el contrato y preparar el entorno

Revisar [diagrama.dbml](diagrama.dbml), [contrato-api.md](contrato-api.md) y [AGENTS.md](../AGENTS.md). Pegar el DBML en dbdiagram.io y comprobar su importación antes de traducirlo a migraciones; es diseño, no una migración ejecutable.

En la etapa de implementación, crear los paquetes `backend/` y `frontend/`, fijar versiones compatibles, configurar Sequelize CLI para `backend/src/{config,models,migrations,seeders}` y añadir ejemplos de entorno sin secretos. Separar CommonJS del backend de los módulos ES de Vite. Configurar MySQL/InnoDB/utf8mb4 y Qdrant; no usar `sequelize.sync()` para crear o alterar tablas.

Estado de configuración comprobado el 18-11-2026 (sin exponer valores secretos):

- MySQL: conectividad y credenciales locales verificadas; se conservaron las actuales.
- Qdrant: servicio y colección accesibles; operaciones verificadas durante la sincronización inicial vacía.
- Drive: identidad lectora autorizada y carpeta válida, sin documentos. Falta credencial escritora para publicar.
- IA: Gemini embeddings disponible con dimensión compatible; DeepSeek LLM bloqueado porque falta su API key.
- Aplicación: autenticación, cookie/CSRF y cuentas demo configuradas; sus valores no se reproducen aquí.

No se requiere Drive ni IA para diseñar o verificar persistencia, sesiones, consultas propias y permisos. Sí se requiere MySQL para acreditar la demo de cifras. Configuración pública del frontend: URL de la API; ningún secreto en variables `VITE_*`.

**Salida:** entorno de desarrollo reproducible y variables requeridas documentadas; ninguna clave en Git.

### 2. Traducir DBML a modelos y migraciones

Crear modelos Sequelize con nombres de tabla/campo explícitos, PK, FK, enums, DECIMAL, índices, timestamps y asociaciones que coincidan con el DBML. Definir modelos no crea tablas: el esquema físico se aplica exclusivamente mediante migraciones versionadas.

Crear migraciones en el orden exacto de la tabla siguiente y revertirlas en orden inverso. Los números representan prefijos de orden: al implementar se reemplazan por timestamps ordenados de Sequelize CLI. En cada migración incluir `up` y `down`; no asumir que una transacción revierte DDL MySQL. Traducir los CHECK y nombres de índices explícitamente; las validaciones Sequelize complementan, pero no sustituyen restricciones SQL.

| Orden | Modelo Sequelize | Migración prevista | Asociación principal / carga |
|---|---|---|---|
| 01 | Colaborador | crear-colaboradores | Jefe autorreferente; 60 personas, roles y estado |
| 02 | Usuario | crear-usuarios | Una cuenta por colaborador; hash, sin rol duplicado |
| 03 | Sesion | crear-sesiones | Muchas sesiones por usuario; vacía hasta login |
| 04 | SaldoVacaciones | crear-saldos-vacaciones | Períodos por colaborador; datos sintéticos coherentes |
| 05 | Solicitud | crear-solicitudes | Colaborador solicitante y aprobador; tres meses |
| 06 | Incapacidad | crear-incapacidades | Colaborador; intervalos de tres meses |
| 07 | MovimientoPersonal | crear-movimientos-personal | Colaborador; tres meses y antecedentes necesarios para dotación inicial |
| 08 | Pago | crear-pagos | Colaborador; tres meses y próximos pagos |
| 09 | Evaluacion | crear-evaluaciones | Colaborador; actividad histórica y próxima evaluación |
| 10 | ConsultaChat | crear-consultas-chat | Colaborador; fixtures de tres meses y nuevas consultas reales |
| 11 | AgentExecutionLog | crear-agent-execution-logs | Consulta opcional; cada agente, incluidos trabajos sin chat |
| 12 | ReporteDiario | crear-reportes-diarios | Fecha única; historia sintética de tres meses, distinguible de ejecución |
| 13 | DriveDocumento | crear-drive-documentos | Metadatos de archivos; vacío hasta sincronización real |
| 14 | DriveSyncState | crear-drive-sync-state | Cursor único por carpeta; vacío hasta inicialización real |

Crear cada modelo con `tableName` explícito del DBML y asociaciones con `foreignKey` explícita; no confiar en pluralización automática. No añadir `createdAt`/`updatedAt` implícitos a tablas que no los tienen: usar `timestamps: false` y los nombres fechados del diseño. El campo `consultas_chat.creada_en` corresponde a la fecha del evento exigida por el enunciado; los límites de período de vacaciones reemplazan el campo genérico `periodo` con fechas verificables.

El vínculo jefe/colaborador se configura como relación autorreferente; la jerarquía se carga después de insertar personas. Evitar borrado en cascada de evidencia de chat, personal y reportes; usar estados y las acciones FK del DBML. No se requiere borrar colaboradores para simular una salida.

**Salida:** base vacía creada solo con migraciones, reversión ensayada en una base descartable y correspondencia modelo/esquema revisada. Nada de esto se ha ejecutado aún.

### 3. Crear seeders reproducibles

Ventana histórica fija: **2026-08-18 a 2026-11-17 inclusive**, interpretada en `America/Costa_Rica`. Usar un parámetro de fecha de referencia que permita reproducir la demo; en operación usar el reloj real y mostrar la fecha de los reportes. Se permiten pagos y evaluaciones futuros para las consultas de próxima fecha.

Secuencia de carga:

1. Insertar exactamente 60 colaboradores ficticios, incluyendo al menos un usuario RRHH y uno colaborador para la demo; completar `jefe_id` en una segunda pasada.
2. Crear usuarios asociados y contraseñas con hash a partir de variables de entorno; no sembrar sesiones activas ni tokens conocidos. Usar correos bajo `.example`.
3. Cargar saldos consistentes, incluyendo casos con más de 20 días acumulados; evitar doble conteo entre períodos y solicitudes.
4. Cargar solicitudes aprobadas, pendientes recientes y pendientes con más de tres días; incapacidades comunes y laborales con fechas coherentes.
5. Cargar ingresos, salidas y ascensos históricos. No insertar ingresos durante la ventana para personas cuyo ingreso declarado sea anterior. Las salidas no eliminan registros.
6. Cargar pagos individuales pasados y futuros, y evaluaciones completadas y programadas. Incluir casos sin próxima fecha para probar `null`.
7. Cargar consultas y ejecuciones históricas solo como fixtures identificados, con distribución por días y temas para tendencias. Las consultas reales nuevas deben producir trazas reales.
8. Construir reportes históricos desde los datos sembrados; etiquetarlos como simulados. Un resumen precargado nunca se presenta como resultado del agente analista integrado. Dejar el reporte generado realmente durante la demo distinguible por metadatos.

Usar semilla aleatoria fija y una marca/lote para permitir repetición sin duplicar ni borrar datos ajenos. Deshacer seeders solo sobre sus registros, en orden inverso. Sesiones y cursor de Drive se crean en ejecución, no como credenciales o tokens precargados.

**Salida:** 60 personas, cobertura de tres meses, conciliación de saldos, integridad FK y casos suficientes para los ocho componentes del reporte. Las cantidades son simulación, no derechos laborales.

### 4. Implementar sesión y lectura personal en Express

Implementar primero login, consulta de sesión y logout según contrato. Emitir cookie de sesión opaca HttpOnly, persistir solo hash del token, comprobar expiración/revocación, usuario habilitado y rol actual de colaboradores en cada solicitud. Aplicar protección CSRF, origen permitido y límites de login.

Conectar luego `/me/vacaciones`, `/me/proximo-pago` y `/me/proxima-evaluacion`. El repositorio recibe el `colaborador_id` del contexto autenticado; no del mensaje, query o cuerpo. Enviar parámetros inesperados de identidad debe producir error sin cambiar el ámbito. Importes y días DECIMAL se serializan como cadenas, fechas DATE como `YYYY-MM-DD`, instantes como ISO UTC.

**Salida:** dos cuentas pueden entrar; cada una ve únicamente sus datos; no se devuelve hash, token ni credencial en JSON; logout invalida la sesión. Este paso funciona sin IA ni Drive.

**Estado real:** login, sesión, logout y los endpoints personales implementados; saldo/login/logout se verificaron en navegador con MySQL real. La identidad de datos personales procede de la sesión.

### 5. Integrar una política de extremo a extremo

Resolver primero una política revisada de Semana 1 con pregunta y respuesta esperada. No copiar los placeholders del contrato como citas reales.

1. Publicar el documento académico en Drive y compartir la carpeta con la identidad de ingesta con lectura.
2. El agente de ingesta obtiene texto, encabezados y metadatos; para Docs exporta texto, para Sheets conserva encabezados y contexto de filas, para PDF extrae texto y detecta si requiere OCR. Una extracción fallida queda registrada, no indexada como vacía.
3. Fragmentar inicialmente entre 500 y 1000 tokens con solapamiento configurable; persistir en Qdrant texto, `drive_file_id`, documento, sección, versión, vigencia, enlace Drive, `fragmento_id`, revisión y estado académico aprobado.
4. Fijar un único modelo de embeddings/dimensión por colección. Cambiarlo exige reindexar en colección nueva y cambiar el alias tras verificarla.
5. Implementar el agente de políticas con búsqueda en Qdrant, umbral ajustado con ejemplos y respuesta sustentada en fragmentos recuperados. Tratar el texto documental como datos, no instrucciones para herramientas.
6. El orquestador procesa `/chat`, llama al agente de políticas y entrega respuesta con cita real. Sin evidencia suficiente, abstenerse y ofrecer RRHH; sin dependencia disponible, aplicar el error del contrato.

La escritura de Qdrant no comparte transacción con MySQL. Usar IDs deterministas por archivo/revisión/fragmento, reintentos y retiro de versiones anteriores. Para la demo inicial puede lanzarse la sincronización inicial manualmente, identificándola como tal; todavía no satisface la sincronización automática diaria de la rúbrica.

Payload canónico por fragmento: `fragmento_id`, `drive_file_id`, `documento`, `seccion`, `version`, `vigencia`, `enlace`, `texto`, `revision_indexada` y `estado_documental`. Los nombres coinciden con las citas de la API; filtrar por revisión vigente y estado aprobado para la simulación. No devolver un fragmento de revisión retirada. `drive_documentos` conserva el catálogo de origen y revisión aplicada, no el texto de las políticas ni vectores.

**Salida:** una pregunta devuelve contenido realmente recuperado y un enlace Drive navegable. No se declara éxito con un texto precargado o un enlace de ejemplo.

**Estado real:** las 12 fuentes están preparadas localmente. El acceso lector Drive funciona, pero la carpeta autorizada está vacía; la credencial escritora no está configurada. Gemini embeddings y Qdrant reales se comprobaron y la sincronización inicial vacía terminó sin indexar documentos. Falta publicar y cargar contenido antes de comprobar citas o búsqueda semántica.

### 6. Unir el chat con datos y consultas mixtas

El agente de datos invoca exclusivamente repositorios de lectura permitidos y acotados al usuario. Implementar enrutamiento `politica`, `dato_personal`, `mixta`, `reporte`, `restringida` y `fuera_de_alcance`. La negativa de acceso se decide en servidor aunque el clasificador LLM se equivoque.

Para una pregunta mixta ejecutar las dos ramas, conservar procedencia MySQL/Drive y no presentar una regla sin cita. Si una rama falla, el estado parcial y la parte faltante deben ser explícitos según el contrato. Cada consulta genera su registro y cada agente invocado su ejecución; un solo campo `agente` no sustituye la traza de una consulta mixta.

**Salida:** saldo propio exacto, política citada y respuesta mixta; rechazos sin revelar existencia de terceros; abstención y fuera de alcance comprobados.

**Estado real:** el chat SQL se probó desde navegador con MySQL y la consulta quedó persistida. Falta `DEEPSEEK_API_KEY`; no se declara verificado el camino de políticas con citas ni una consulta mixta con documentos reales.

### 7. Generar un reporte y habilitar su lectura para RRHH

Las agregaciones SQL y la generación idempotente se prepararon para los ocho componentes. Deduplicar personas ausentes al consolidar intervalos superpuestos; calcular días de incapacidad que se solapan con el mes, no toda su duración fuera del mes. Solicitudes con más de tres días se cuentan desde el instante de creación usando corte definido. Rotación mensual: salidas del mes divididas entre promedio de personal activo al inicio y al cierre; devolver `null` si el denominador es cero y exponer la fórmula en el JSON.

El analista calcula JSON, entrega al LLM solo esas cifras para redactar de tres a cinco frases, valida los números del resumen y publica ambos en `reportes_diarios`. Si falla IA o la validación, conservar un reporte previo publicado y no presentar un resumen inventado como generado. La escritura se limita al servicio analista; el dashboard no dispara generación por GET.

La ejecución manual está disponible por CLI; no abrir un endpoint público de generación. Exponer listado e informe por fecha solo al rol RRHH. Usar unicidad por fecha e idempotencia para evitar duplicados.

**Salida:** RRHH abre un reporte persistido y un colaborador recibe 403; cifras conciliadas con SQL y resumen sustentado en el JSON. La ejecución manual de demo no acredita aún programación automática.

**Estado real:** la UI RRHH y la lectura protegida de un fixture se probaron en navegador. Los fixtures no fueron generados por el analista. Falta la clave DeepSeek para producir resumen LLM; el reporte de ejecución real no se da por probado sin ella.

### 8. Conectar React/Vite

Construir en orden: `components/` reutilizables → `pages/` Login, Chat y Reportes → `routes/` públicas/protegidas → `App.jsx` con proveedores/rutas → `main.jsx` que monta React.

Centralizar peticiones en `frontend/src/services/`: cliente HTTP, sesión, chat, datos propios y reportes. Usar `credentials: include`, CSRF y errores del contrato; nada de conexiones directas a MySQL/Qdrant/Drive/IA. Recuperar sesión al recargar, limpiar estado al salir y redirigir tras 401. Ocultar rutas RRHH por UX, conservando autorización de servidor.

**Salida de la primera versión funcional:** iniciar sesión, consultar una política con cita Drive, consultar saldo propio de MySQL y abrir un reporte con cuenta RRHH. Mostrar carga, errores y ausencia de datos sin respuestas ficticias.

**Estado real de interfaz:** build y ocho pruebas Chromium desktop/móvil pasaron con backend/MySQL reales. Login, sesión, saldo, logout, chat SQL persistido y dashboard con fixture están cubiertos. La consulta de política citada queda bloqueada por carpeta Drive sin documentos y ausencia de clave DeepSeek.

### 9. Completar la rúbrica después de demostrar el recorrido pequeño

- Subir/indexar al menos 10 documentos y los tres formatos; cerrar los pendientes de investigación antes de afirmar derechos.
- Sincronización inicial y luego `changes.list`: guardar cursor solo después de procesar el lote; validar carpeta, cambios de permisos, altas, ediciones, eliminaciones y archivos movidos fuera. Ante cursor inválido, reconciliar completamente el índice. Al menos una sincronización automática diaria.
- Programar el analista a las **07:00 America/Costa_Rica**, con bloqueo/ejecución idempotente y recuperación de fallos.
- Dashboard con al menos cuatro indicadores, dos gráficos (uno de tendencia de 30 días), solicitudes pendientes, resumen e historial.
- Añadir memoria de conversación del orquestador con dueño autenticado y límites de contexto. El primer contrato es sin memoria entre mensajes; es una limitación deliberada de la demo pequeña, no cumplimiento completo de esa herramienta del enunciado.
- Evaluar 25 preguntas base y 20 propias; registrar esperada, obtenida, fuente, resultado y latencia. Medir acierto mínimo de 80 %, p90 menor de ocho segundos y cero fugas en preguntas 21 y 22. No declarar resultados antes de medirlos.
- Entregar README, `.env.example` sin secretos, arquitectura, informe técnico de 8–12 páginas y video de cinco minutos. Extras solo después de los obligatorios.

**Estado:** el scheduler/worker está implementado con hora local y tareas independientes, pero no está instalado ni activo como servicio persistente. Las ocho pruebas de navegador verifican la ruta Dashboard→fixture; no acreditan que el worker haya generado ese reporte. La evaluación real registró 15 aprobadas, cero fallidas y 30 bloqueadas; no acredita el 80 % ni el p90 RAG. El worker se probó brevemente con ingesta real independiente y fallo explícito del reporte por falta de DeepSeek, sin instalar un servicio.

## Dependencias y límites de la demo

| Resultado | Requiere | Si falta |
|---|---|---|
| Esquema, modelos y seeders | MySQL y credenciales locales | Implementado y verificado; conservar datos y credenciales |
| Login y saldo propio | MySQL con usuarios/seed, configuración de sesión | Verificado en navegador con backend real |
| Chat de datos personales | MySQL y sesión | Consultas SQL persistidas verificadas en navegador |
| Política con cita | Docs publicados, Drive lector, embeddings, Qdrant y DeepSeek | Drive lector/Gemini/Qdrant responden; carpeta vacía y falta DeepSeek y credencial escritora. No hay cita verificable |
| Dashboard RRHH | Sesión RRHH y reporte persistido | Lectura de fixture real verificada; no confundir con generación del agente |
| Reporte SQL y resumen | MySQL, agregaciones, proveedor IA y validación | Código de generación preparado; resumen real bloqueado por ausencia de DeepSeek |
| Automatización | Worker persistente y zona horaria | Worker preparado para 07:00 CR y sync diario; aún no instalado ni activo |

## Referencias técnicas consultadas para el diseño

Consulta: 17/11/2026. La implementación deberá fijar las versiones compatibles elegidas.

- [DBML: sintaxis, índices, relaciones y CHECK](https://dbml.dbdiagram.io/docs/).
- [MySQL: restricciones CHECK](https://dev.mysql.com/doc/refman/8.0/en/create-table-check-constraints.html): exigir versión que las aplique (8.0.16+).
- [Sequelize 6: migraciones y seeders](https://sequelize.org/docs/v6/other-topics/migrations/): cambios explícitos `up`/`down` y seguimiento de ejecución.
- [Qdrant: payload de puntos](https://qdrant.tech/documentation/concepts/payload/): referencia para metadatos del índice; configuración concreta pendiente de implementación.

## Revisión de estos entregables

El diseño inicial contrastó roles, identidad, campos, enums, decimales, fechas y ocho componentes de reporte. Se revisaron fixtures, fuentes locales y la estructura; el despliegue real posterior incluye MySQL, Drive lector, Gemini y Qdrant con los límites descritos arriba. La importación visual del DBML en dbdiagram.io y la evaluación final de 45 preguntas siguen pendientes. No interpretar los artefactos de diseño ni los fixtures como evidencia de operación del scheduler o del agente de políticas.

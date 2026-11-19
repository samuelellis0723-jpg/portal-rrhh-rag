# Informe técnico

## Bosque Claro: portal de RRHH con datos y políticas trazables

**Mini Proyecto #2 · Costa Rica · 19 de noviembre de 2026**
**Equipo académico · versión de entrega técnica 1.1**

Este informe describe una aplicación para una empresa enteramente ficticia y un conjunto de 60 colaboradores sintéticos. La arquitectura separa las reglas y citas documentales de los datos personales y agregados. El objetivo técnico es responder consultas permitidas con evidencia y abstenerse cuando una dependencia o fuente no está disponible.

**Estado verificado al 19-11-2026:** doce documentos publicados en la carpeta autorizada de Drive, 68 fragmentos activos en Qdrant, embeddings Gemini y DeepSeek operativos. Reporte real del 19-11-2026 persistido con origen ejecución y abierto desde RRHH. La generación fue manual; el worker no está instalado ni activo como servicio. **45/45 (100 %) verificaciones automáticas aprobadas**, **0 fallidas**, **0 bloqueadas**. p90 HTTP **5465 ms** y p90 con documentos **6597 ms**. Preguntas 21/22: **HTTP 403 genérico sin datos**. Los controles automáticos no sustituyen revisión humana de fidelidad ni aprobación jurídica.

El proyecto usa MySQL como fuente de identidad y cifras; Google Drive como fuente de políticas; Qdrant como índice derivado; React/Vite como interfaz y Express como frontera de sesión, autorización y validación. El LLM no autentica personas, no genera SQL ejecutable y no calcula cifras. El material legal en políticas distingue obligaciones oficiales de propuestas simuladas.

**Contenido:** problema y objetivos; arquitectura multiagente; contratos y persistencia; seguridad; corpus/ingesta; chat y memoria; reportes; evaluación; operación, limitaciones y próximos pasos.

<!-- pagebreak -->

# 1. Problema, alcance y objetivos

Bosque Claro es un caso académico para explorar consultas de RRHH repetitivas: saldos de vacaciones, procedimientos internos, calendarios y solicitudes. La solución plantea dos flujos separados. El colaborador utiliza un chat para políticas y datos propios; RRHH consulta reportes agregados previamente calculados. El proyecto no automatiza decisiones laborales ni cambia condiciones reales: la empresa y todos los registros son ficticios.

El enunciado exige al menos diez dominios documentales, cinco responsabilidades de agentes, dos fuentes de verdad y evaluación con 45 preguntas. Los documentos locales cubren vacaciones/feriados, permisos/licencias, incapacidades, jornada/teletrabajo, remuneración, beneficios, ingreso/salida, desempeño, conducta y privacidad. Cada archivo tiene versión, responsable y fecha. El reporte integra ausencias, solicitudes, incapacidades, movimientos, riesgo vacacional, uso del chat, temas y resumen ejecutivo.

La implementación fijó Node.js/Express/Sequelize, MySQL 8 e InnoDB, React/Vite, Google Drive y Qdrant. La base conserva cifras; el índice vectorial contiene texto derivado y metadatos. La elección MySQL/Qdrant cumple la arquitectura permitida por el proyecto, aunque el enunciado sugería PostgreSQL como una opción.

El alcance incluye login con sesiones opacas, cookie, CSRF, rutas propias, frontend, ingesta Drive, chat con historial, políticas/datos, analista y scheduler. Se añadieron saludos sin LLM, calendario contextualizado a Costa Rica y eliminación segura del historial. Las integraciones documentales se probaron con proveedores reales. La revisión visual de documentos privados en el navegador requiere una sesión Google autorizada.

<!-- pagebreak -->

# 2. Arquitectura de los cinco agentes

El orquestador clasifica la consulta y decide qué responsabilidad puede intervenir; el agente de políticas recupera fragmentos de Qdrant; el agente de datos usa consultas SQL parametrizadas con el ID autenticado; el analista produce reportes; y el agente de ingesta mantiene el corpus vectorial. Las tareas del analista y la ingesta están desacopladas del chat y entre sí. El scheduler expone un worker diario que puede reintentar fallos, pero no se presenta como tarea activa hasta iniciar el worker desde un proceso operativo.

La secuencia conversacional inicia en el navegador, pasa por Express y la identidad de sesión, aplica guardias deterministas, y después utiliza clasificación JSON de DeepSeek. Las políticas se recuperan mediante embeddings y búsqueda semántica; DeepSeek redacta respuesta y selección de IDs de citas. Los datos personales se consultan directamente en MySQL sin enviar cifras al agente de políticas. Una consulta mixta concatena la respuesta SQL y la parte documental, conservando citas; si la parte documental falla, la respuesta indica esa ausencia.

El camino de reportes consulta agregados SQL para la fecha de negocio, resume solo los datos calculados y persiste JSON/resumen. El camino de ingesta obtiene cursor de cambios, valida carpeta y exporta formatos, extrae texto, divide en fragmentos y genera vectores. Qdrant se reconstruye desde Drive y no define saldos, permisos ni identidad.

Las responsabilidades tienen APIs pequeñas: `DeepSeekClient.completeJson()` y `complete()`; agentes `PolicyAgent`, `DataAgent`, `AnalystAgent` e `IngestionAgent`; repositorios separados por consultas. Los controladores solo adaptan HTTP. Los archivos de prompts versionados distinguen clasificador y políticas. La implementación no utiliza un framework de grafo: mantiene orquestación explícita en código JavaScript para hacer visibles las decisiones y límites.

<!-- pagebreak -->

# 3. Modelo de datos y contratos

La base deriva de `docs/diagrama.dbml`. El snapshot `schema-v1.json` describe las primeras 14 tablas y migraciones aplicadas; la ampliación de memoria añade `consultas_chat.respuesta_json` mediante migración 15 sin reescribir historia. `current-schema.js` documenta el esquema efectivo. Las tablas incluyen colaboradores y usuarios, sesiones, saldos y solicitudes, incidencias, movimientos, pagos/evaluaciones, consultas y ejecuciones, reportes, catálogo documental y cursor de Drive.

Los datos de ejemplo son reproducibles y usan 60 colaboradores `.example`, con movimientos en una ventana de tres meses. No son observaciones de una organización real ni representan derechos de personas. DECIMAL se devuelve como cadena; las fechas de negocio son civiles de Costa Rica y los instantes técnicos son UTC.

El contrato de API establece errores JSON, validación estricta, paginación `limit`/`offset` de máximo 100 y propiedad de sesión. Los endpoints personales (`/me/vacaciones`, `/me/proximo-pago`, `/me/proxima-evaluacion`, `/me/solicitudes`) no aceptan ID de persona desde query o cuerpo. El chat usa `POST /api/v1/chat` con `{ "mensaje": "..." }`; `GET /api/v1/chat/historial` presenta únicamente filas `origen=ejecucion` del usuario autenticado. Los reportes ofrecen listado/detalle solo a RRHH.

La migración 15 conserva respuesta estructurada, estado y procedencia en consultas_chat; las citas persisten en documentos_citados y las trazas enlazan por consulta_chat_id. La nueva migración 16 añade chat_metricas_eliminadas, con fecha Costa Rica, tema, conteos y sumas de latencia; sin identidad ni contenido. El esquema efectivo contiene 15 modelos y 16 migraciones. Las migraciones anteriores no se modificaron.

<!-- pagebreak -->

# 4. Seguridad, privacidad y manejo de errores

El backend establece la autoridad. Login verifica scrypt, crea secreto aleatorio de sesión y entrega cookie `HttpOnly`; MySQL conserva su hash, vencimiento y revocación. CSRF se deriva con HMAC y su hash se verifica en tiempo constante. En producción la cookie usa `Secure`; `SameSite=Lax` y orígenes explícitos reducen exposición web. Las operaciones mutantes requieren `Origin` autorizado y `X-CSRF-Token`.

La identidad se relee por sesión y el rol único está en `colaboradores.rol`. Los repositorios de datos reciben ese ID, nunca el proporcionado por LLM, texto, query o JSON. El clasificador no puede conceder permiso. Guardias deterministas detectan menciones explícitas de IDs, correos y nombres de otros colaboradores antes de llamar al LLM; además se aplica límite de chat por usuario. Una petición restringida responde con mensaje genérico y no confirma existencia de personas o registros.

El contenido de Drive y las consultas se consideran entradas no confiables. El prompt de políticas prohíbe obedecer instrucciones incrustadas; no hay herramientas disponibles al modelo. Citas se construyen desde fragmentos recuperados, no desde prosa libre. El código valida ID, título, sección, versión, host y consistencia del enlace Drive/Docs/Sheets; rechaza referencias ajenas y cifras numéricas sin respaldo textual.

El agente de políticas no consulta MySQL. El agente de datos no consulta Drive ni inventa políticas. DeepSeek clasifica y redacta, no genera SQL. El analista recibe agregados preparados y su resumen se valida para limitar números. Qdrant no contiene identidades ni saldos. Los secretos permanecen en entorno/backend; ninguna `VITE_*` contiene clave de proveedor.

Los errores de dependencia se traducen a respuestas `503` genéricas. Una respuesta parcial mixta puede conservar el dato SQL, pero explica que no logró verificar la parte de políticas. Rate limits son por proceso y se deben compartir si se despliegan réplicas. Los logs evitan credenciales/tokens, aunque persisten preguntas de chat para memoria y analítica; eso es un tratamiento local intencional del MVP que requiere política de retención antes de producción.

<!-- pagebreak -->

# 5. Corpus y verificación legal

El repositorio conserva doce fuentes Markdown/CSV editables y sus formatos de importación. Nueve exportaciones HTML pueden convertirse a documentos Google nativos; dos CSV se convierten a Sheets; D04 es PDF de texto seleccionable generado desde HTML. Un manifiesto registra IDs documentales locales. Ningún ID o enlace de Drive se inventa.

Las políticas son propuestas académicas de la empresa simulada, marcadas `preparado_simulacion`. Ese estado habilita indexación del corpus de demostración, pero no prueba que el patrono haya aprobado el documento. Los documentos distinguen reglas de leyes y reglamentos de mejoras internas sugeridas. Las obligaciones laborales citadas se contrastaron con fuentes oficiales costarricenses y se dejaron referencias y pendientes en `investigacion-politicas.md` y en cada fuente. El informe no convierte un ejemplo de política en derecho legal.

La etapa legal corrigió referencias inexactas sobre permisos por duelo, incapacidad CCSS/INS, vigencia del plazo de hostigamiento sexual y el alcance de una normativa del MTSS. D04 no calcula una prestación individual sin historial/entidad; D11 separa hostigamiento sexual de otras denuncias; D12 exige completar responsable/tratamientos antes de uso como aviso final. Las fuentes oficiales enumeradas son bases de investigación a la fecha de consulta, no asesoría ni aprobación institucional.

El publicador usa credencial de escritura separada, publica metadatos y evita duplicar por reejecución. El agente lector trabaja con Drive readonly y no publica. El estado operativo observado al 18 de noviembre es: carpeta autorizada con cero documentos; credencial escritora pendiente. El corpus local está completo para preparación, no existe todavía en Drive. La ejecución inicial real de sincronización encontró cero archivos y por tanto generó cero puntos. Esos ceros describen el snapshot observado, no una carga correcta del corpus.

<!-- pagebreak -->

# 6. Ingesta Drive → embeddings → Qdrant

La ingesta se ejecuta desde CLI y también puede ser llamada por el worker de sincronización. Antes del snapshot inicial obtiene `startPageToken`; luego lista los hijos de la carpeta y procesa los archivos permitidos. Cambios incrementales usan `changes.list` con paginación. El cursor se confirma por página después de aplicar cambios. Si Drive invalida cursor con HTTP 410, se reconcilia todo el snapshot bajo el mismo lock MySQL.

Cada archivo se comprueba como hijo directo y no eliminado. Se rechazan shortcuts, archivos fuera de la carpeta, formatos no admitidos y documentos no marcados para simulación. Metadatos se vuelven a leer antes y después de exportar para detectar cambio/movimiento durante extracción. Google Docs exporta texto plano, Sheets exporta XLSX y recorre todas las hojas, PDFParse 2 extrae texto real. No se finge OCR si el PDF es una imagen.

El fragmentador respeta secciones y solapamiento configurable. El fingerprint de revisión incluye proveedor/modelo/dimensión, tamaño/solapamiento del chunker, versión del pipeline, version/modifiedTime de Drive y checksum del contenido. IDs UUID deterministas hacen repetible la subida. Payload incorpora título, sección, versión, enlace, ID Drive, fecha, fragmento, carpeta, estado y embedding space. El modelo SQL registra la revisión activa después de escritura durable; luego se eliminan vectores anteriores. Retiradas se marcan en MySQL y se borran de Qdrant antes de confirmar cursor.

Qdrant usa Cosine, índices de payload y filtros obligatorios por folder, corpus `preparado_simulacion`, embedding space y `drive_revision` activa derivada del catálogo SQL. Esto evita mezclar dimensiones/modelos o servir revisiones antiguas. La reconciliación y las operaciones idempotentes reducen daños ante fallo parcial, pero MySQL/Qdrant no comparten transacción distribuida.

Verificación externa actual: doce documentos Drive (nueve Docs nativos, dos Sheets y un PDF), todos dentro de la carpeta autorizada e indexados; 68 puntos corresponden a revisiones activas. Se volvió a sincronizar sin duplicados. La fragmentación reconoce encabezados numerados exportados desde Google Docs y PDF; una versión nueva del pipeline fuerza reconciliación sin modificar las políticas. Las seis búsquedas de verificación en español recuperaron la fuente esperada con enlaces trazables.

<!-- pagebreak -->

# 7. Chat, memoria y fuentes de respuesta

DeepSeek es proveedor del LLM conversacional, distinto del proveedor de embeddings. El adaptador REST usa `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL` HTTPS y `DEEPSEEK_MODEL` (default `deepseek-flash` verificado en documentación oficial consultada). Clasificación y respuestas JSON usan `response_format=json_object`; la configuración desactiva thinking para respuestas cortas. Salida vacía, truncada, no JSON, HTTP no exitoso o timeout se trata como dependencia fallida.

El clasificador combina reglas permitidas para consultas inequívocas con JSON DeepSeek para ambigüedades. Distingue política, dato propio, mixta, reporte, restringida y fuera de alcance; el saludo aislado se responde sin LLM ni recuperación. El mensaje con saludo y pregunta conserva la intención de la pregunta. Las guardias de privacidad preceden la clasificación; un procedimiento de revisión de recibo no se confunde con un reporte reservado para RRHH.

Para política, la búsqueda debe superar `POLICY_MIN_SCORE`. DeepSeek recibe solamente consulta de política y fragmentos de la recuperación actual. Las consultas mixtas seleccionan la cláusula documental, conservando fechas o plazos normativos, y no comparten la respuesta SQL. No se pasa respuesta SQL ni historial personal al agente RAG. Si el agente de políticas falla, el sistema conserva el resultado personal y devuelve una abstención parcial con escalamiento.

El historial se sirve por dueño de sesión y excluye fixtures. DELETE /chat/historial exige sesión, Origin autorizado y CSRF y rechaza identidad desde query o cuerpo. Un bloqueo MySQL por cuenta serializa envíos y borrado; una transacción acumula métricas anónimas y elimina preguntas, respuestas, citas y logs asociados. Los reportes publicados se conservan, y los nuevos suman métricas eliminadas sin conservar texto ni vínculo personal. La memoria de recuperación está acotada a cinco interacciones; solo la parte de política se devuelve al contexto del agente de políticas, mientras respuesta personal/mixta queda vacía. Un seguimiento puede resolverse a partir del historial y vuelve a pasar guardias de privacidad. `respuesta_json` persiste la respuesta usada para reconstruir el historial.

La UI incluye login, espacio personal, chat y reportes. Chromium comprobó ambas frases de feriados, saludos, saldo MySQL y respuesta mixta real con citas. El calendario utiliza la fecha de Costa Rica y filas del documento publicado, sin fechas de entrenamiento; si falta cobertura, explica la limitación. La separación de cláusulas conserva el tema de vacaciones incluso con pronombres. Los números de sección y versión recuperados forman parte de la evidencia; las cifras sin respaldo se rechazan o se pide una única redacción correctiva con las mismas fuentes.

<!-- pagebreak -->

# 8. Reportes SQL y programación

El analista consulta las ocho áreas del contrato: personas ausentes por tipo/departamento; solicitudes pendientes y antigüedad; incapacidades activas y días del mes; entradas/salidas y rotación; riesgo de vacaciones (>20 días); uso del chatbot y latencia; top de temas y no resueltas; resumen ejecutivo. Las cifras vienen de SQL. Si registros no permiten reconstruir dotación o una ausencia, el reporte marca la métrica no disponible/null en vez de forzar cero.

Las fechas de negocio usan `America/Costa_Rica` (UTC−06:00), y el corte del reporte se representa como instante UTC. Las ausencias deduplican persona por intervalos; solicitudes con más de 72 h se evalúan al corte. El denominador de rotación es promedio de dotación inicio/cierre; si falta información no se calcula una tasa falsa. La tendencia genera 30 días. Los temas y preguntas se anonimizan para evitar exponer el texto literal en el dashboard.

El agente analista construye frases factuales desde el JSON SQL. DeepSeek recibe agregados sin identificadores y selecciona de tres a cinco índices de esas frases para componer el resumen. El servidor conserva exactamente la relación entre métrica y cifra; rechaza índices repetidos, inexistentes o texto inyectado. Este diseño limita la redacción libre para impedir cambios de significado numérico y valida además longitud y pertenencia de números al JSON. Si el LLM falla o inventa cifra, no crea un reporte nuevo ni sobrescribe el anterior. La persistencia por fecha y `GET_LOCK` protegen idempotencia; `reportes_diarios` conserva `origen=ejecucion` o `fixture`.

El script report:generate genera por fecha y conserva reportes existentes. El reporte del 19-11-2026 fue generado manualmente mediante el analista y DeepSeek, con origen=ejecucion; no es un fixture. createDailyWorker agenda reportes 07:00 e ingesta 02:00 America/Costa_Rica, pero el worker no está instalado ni activo como servicio. No hay evidencia de un disparo programado a las 07:00. Las 15 pruebas de integración validan SQL, límites de fecha, sesiones, borrado y métricas; los fixtures históricos se conservan. Los saldos de riesgo son los observados al generar, sin reconstrucción histórica arbitraria.

<!-- pagebreak -->

# 9. Evaluación y evidencia

El banco editable `docs/evaluacion/banco-45.json` contiene las 25 preguntas base y 20 propias, con respuesta/fuente esperada, tipo y rol. El script `backend/scripts/evaluate-chat.js` levanta Express, inicia cuentas demo, dispara HTTP y guarda `docs/evaluacion/resultados-actuales.json`. Comprueba estructura, intención, citas/host/ID, resultados de privacidad 21–22 y saldo SQL para casos definidos. Las dependencias ausentes se registran como bloqueadas, no como aciertos.

Los controles automáticos comprueban estructura, intención, procedencia y cifras propias; no certifican fidelidad semántica completa. Resultado final: **45/45 (100 %) verificaciones automáticas aprobadas**, **0 fallidas**, **0 bloqueadas**. p90 HTTP **5465 ms** y p90 con documentos **6597 ms**. Preguntas 21/22: **HTTP 403 genérico sin datos**. La matriz XLSX/CSV contiene 45 filas y se regeneró desde el JSON. Se conserva la corrida de Gemini (37/45) como evidencia previa; no se cambiaron el banco ni los criterios para aumentar el puntaje.

Verificación final: 67 pruebas unitarias, 15 de integración HTTP/MySQL y ocho pruebas Chromium de escritorio/móvil aprobadas; build React y verificación de esquema correctos. Un recorrido adicional con proveedores reales comprobó saludos, feriados, saldo, consulta mixta, cancelar/eliminar y dashboard posterior. Cancelar no emite DELETE; confirmar deja el historial vacío tras recargar y la memoria no recupera mensajes eliminados. Las pruebas de acceso cruzado y CSRF usan dos identidades temporales y conservan cuentas previas.

El cotejo automático contrastó 79 citas con exportaciones actuales de Drive; sus fragmentos están presentes en la fuente autorizada. El agente revisó documentalmente los ocho fallos previos y las respuestas del recorrido. Al pulsar las citas D01/D02, el navegador de prueba llegó a Google y pidió iniciar sesión; no se acredita lectura visual del documento privado dentro de ese navegador. La revisión humana completa sigue pendiente; el detalle figura en evaluacion/revision-fidelidad.md y el prompt de revisión final. Una corrida intermedia tuvo p90 documental de 8624 ms: las latencias varían y una corrida favorable no garantiza el servicio.

<!-- pagebreak -->

# 10. Operación, límites y conclusiones

La instalación usa `backend/.env.example` como lista de variables ficticias y mantiene credenciales reales solo fuera del repositorio. Las cuentas demo usan correo `.example`; sus contraseñas se obtienen de variables privadas y nunca deben imprimirse en el informe/video. Para operar primero se revisa estado MySQL, se autentica al lector Drive en una carpeta dedicada, se publica el corpus con credencial escritora separada, se ejecuta `ingest:check -- --live`, se sincroniza y se valida search antes de habilitar chat. DeepSeek API key se configura independiente. El LLM nunca se coloca en `VITE_*`.

Comandos representativos desde `backend/`: `npm run db:migrate:status`, `npm run db:verify`, `npm test`, `npm run test:integration`, `npm run ingest:check -- --live`, `npm run ingest:sync`, `npm run ingest:search -- "consulta"`, `npm run report:generate`, `npm run eval:chat`. Los últimos tres necesitan dependencias/corpus/credenciales según la tarea. Las variables privadas y secretos no se copian a documentación.

Limitaciones: políticas académicas no adoptadas, revisión humana completa de fidelidad y vigencia legal pendiente, documentos privados que necesitan sesión Google para comprobación visual, worker sin servicio persistente y video aún sin grabar. Login y límites de chat son por proceso. El resultado automático no representa aprobación jurídica ni disponibilidad continua de proveedores.

La arquitectura fija fronteras entre identidad, cifras y conocimiento documental. La entrega incluye fuentes editables, API/DBML actualizados, reporte técnico/PDF y evaluación exportada. Queda completar la revisión humana en un navegador Google autorizado y grabar el video de cinco minutos; la demo en vivo de quince tiene guion separado. Si se requiere continuidad, iniciar el worker bajo un supervisor y comprobar una ejecución programada antes de atribuirle ese resultado.

## Referencias

1. Bosque Claro, [enunciado](../enunciado.md), [contrato API](contrato-api.md), [plan de implementación](plan-implementacion.md), [modelo DBML](diagrama.dbml).
2. Bosque Claro, [investigación de políticas y fuentes oficiales](investigacion-politicas.md), [guía de ingesta](ingesta-drive-qdrant.md), [manifest de documentos](politicas/manifest.json).
3. DeepSeek, [Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/) y [JSON Output](https://api-docs.deepseek.com/guides/json_mode/).
4. Google, Drive API [changes.list](https://developers.google.com/drive/api/reference/rest/v3/changes/list) y [files.export](https://developers.google.com/drive/api/reference/rest/v3/files/export).

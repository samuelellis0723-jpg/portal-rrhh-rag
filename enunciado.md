
# Mini Proyecto #2: Portal de consulta de políticas de RRHH con RAG multiagente


## Descripción general y objetivos

Cada equipo construirá un portal interno de Recursos Humanos donde cualquier colaborador pregunta en lenguaje natural sobre las políticas de la empresa y recibe una respuesta correcta, citada y basada en documentos reales. El sistema será multiagente: un agente conversacional responde consultas usando un RAG conectado a Google Drive, y un agente analista genera cada día un reporte para el dashboard interno de RRHH a partir de una base de datos.

Al terminar el proyecto, el estudiante será capaz de:

1. Investigar a profundidad cómo funciona un sistema interno de RRHH y convertir ese conocimiento en una base documental para un RAG.
2. Conectar Google Drive (configurado en Google Cloud Console, como en el Mini Proyecto #1) a un pipeline de ingesta, embeddings y base vectorial.
3. Diseñar varios agentes con responsabilidades claras, herramientas propias y un orquestador que los coordine.
4. Combinar dos fuentes de verdad: documentos (RAG) para políticas y una base de datos estructurada para cifras y reportes.
5. Evaluar la calidad de las respuestas con un banco de preguntas y métricas objetivas.

---

## Contexto y problema a resolver

El área de RRHH de una empresa ficticia (cada equipo define su nombre, sector, país y tamaño, por ejemplo 250 colaboradores) recibe a diario decenas de preguntas repetidas: cuántos días de vacaciones me quedan, cómo pido un permiso, cuándo pagan el aguinaldo. Las respuestas existen, pero están dispersas en PDFs, Word y hojas de cálculo dentro de Drive, y responderlas a mano consume horas del equipo.

Además, la jefatura de RRHH necesita cada mañana una foto del estado del personal: ausencias, solicitudes pendientes, incapacidades, rotación y las dudas más frecuentes de los colaboradores. Hoy ese reporte se arma manualmente y llega tarde.

El portal debe resolver ambos problemas sin inventar información: si una política no está en los documentos, el agente debe decirlo y derivar a una persona de RRHH.

**Alcance mínimo:** un chat web para colaboradores, un dashboard interno para RRHH, una carpeta de Drive con al menos 10 documentos de políticas creados por el equipo y una base de datos con datos simulados de al menos 50 colaboradores y 3 meses de movimientos.

---

## Fase 1. Investigación a profundidad (deep research)

Antes de escribir código, cada equipo investiga qué contiene un sistema interno de RRHH real y qué normativa laboral aplica en el país elegido. Esta investigación es la materia prima del RAG: si los documentos son pobres, el agente responderá mal.

La investigación debe cubrir, como mínimo, estos dominios:

| Dominio | Qué investigar | Documento que deben producir para Drive |
| :--- | :--- | :--- |
| **Vacaciones y feriados** | Días por ley, acumulación, fraccionamiento, feriados nacionales | Política de vacaciones y calendario de feriados |
| **Permisos y licencias** | Maternidad, paternidad, duelo, matrimonio, estudio, sin goce | Política de permisos y licencias |
| **Incapacidades** | Enfermedad, accidente laboral, quién paga cada día | Procedimiento de incapacidades |
| **Jornada y asistencia** | Horario, horas extra, teletrabajo, control de marcas | Reglamento de jornada y teletrabajo |
| **Remuneración** | Planilla, fechas de pago, aguinaldo o décimo tercer mes, deducciones | Política salarial y calendario de pagos |
| **Beneficios** | Seguro médico, asociación solidarista o fondo de ahorro, capacitación | Catálogo de beneficios |
| **Ingreso y salida** | Onboarding, periodo de prueba, preaviso, cesantía, liquidación | Manual de onboarding y procedimiento de salida |
| **Desempeño y carrera** | Evaluaciones, ascensos, planes de mejora | Política de evaluación del desempeño |
| **Conducta y convivencia** | Código de ética, acoso laboral y sexual, régimen disciplinario | Código de conducta y protocolo de denuncias |
| **Datos y privacidad** | Protección de datos personales del colaborador | Aviso de privacidad para colaboradores |

**Entregable de esta fase:** un informe de investigación (6 a 10 páginas) con las fuentes consultadas (código de trabajo del país, sitios oficiales del ministerio de trabajo, guías de RRHH) y los 10 o más documentos de políticas redactados por el equipo, listos para subir a Drive.

### Reglas para los documentos:
- Cada documento lleva título, versión, fecha de vigencia y responsable, porque el agente los usará para citar.
- Usen encabezados claros por tema; eso mejora el chunking y la recuperación.
- Las cifras de la empresa ficticia pueden superar la ley (por ejemplo, 15 días de vacaciones en vez del mínimo legal), pero nunca ir por debajo; documenten la diferencia.
- Incluyan al menos un documento en PDF, uno en Google Docs y una hoja de cálculo, para que el pipeline maneje formatos distintos.

---

## Arquitectura del sistema

El sistema tiene dos caminos independientes: el conversacional, que se activa con cada pregunta del colaborador, y el de reportes, que se activa cada mañana sin intervención humana. Ambos comparten el LLM y la base de datos.

- **Colaborador:** chat web consulta en lenguaje natural.
- **LLM (Gemini / Claude):** lo usan todos los agentes.
- **Orquestador:** clasifica la intención y enruta.
- **Programador diario:** dispara a las 7:00 a. m.
- **Agente de políticas:** RAG con citas a Drive (búsqueda semántica en base vectorial de fragmentos + metadatos).
- **Agente de ingesta:** extrae, fragmenta y vectoriza desde Google Drive (vía Drive API `changes.list`).
- **Agente de datos:** consulta SQL de solo lectura filtrada por usuario a PostgreSQL (colaboradores, saldos, solicitudes, incapacidades).
- **Agente analista:** genera reporte diario + resumen en la base de datos (`consultas_chat`, `reportes_diarios`).
- **Dashboard RRHH:** lee `reportes_diarios` (rol RRHH).

La base vectorial guarda solo el conocimiento de los documentos de Drive; PostgreSQL guarda personas, saldos, solicitudes y los logs del chat. El agente de ingesta es el único que habla con Drive, y el dashboard solo lee lo que el agente analista ya escribió.

---

## Agentes del sistema

El sistema tiene cinco agentes obligatorios. Cada uno tiene un único propósito, herramientas propias y un formato de salida definido; el orquestador es el único que habla con el usuario y decide a quién delegar.

| Agente | Responsabilidad | Herramientas | Salida |
| :--- | :--- | :--- | :--- |
| **Orquestador** | Clasifica la intención de la consulta (política, dato personal, reporte, fuera de alcance) y enruta. | Clasificador con LLM, memoria de la conversación. | Agente destino + consulta reformulada. |
| **Agente de políticas (RAG)** | Responde preguntas sobre políticas usando solo los documentos de Drive. | Búsqueda en la base vectorial, LLM. | Respuesta + citas (documento, sección, enlace a Drive). |
| **Agente de datos del colaborador** | Responde datos personales: saldo de vacaciones, solicitudes, próximas fechas de pago. | Consultas SQL de solo lectura, filtradas por el ID del usuario autenticado. | Respuesta con cifras exactas. |
| **Agente analista de reportes** | Genera el reporte diario del dashboard a una hora fija. | SQL de agregación, LLM para el resumen, escritura en la tabla de reportes. | Reporte en JSON + resumen ejecutivo en texto. |
| **Agente de ingesta y sincronización** | Mantiene el índice al día con los cambios en Drive. | Drive API (`changes.list`), extractor de texto, modelo de embeddings. | Fragmentos nuevos o actualizados en la base vectorial. |

**Agentes opcionales para puntos extra:** un agente validador que revisa cada respuesta antes de enviarla (¿está respaldada por las citas?, ¿contiene datos de otra persona?) y un agente de escalamiento que crea un ticket para RRHH cuando la pregunta no tiene respuesta en los documentos.

### Reglas de diseño:
- El agente de políticas nunca consulta la base de datos, y el de datos nunca inventa políticas: si una pregunta mezcla ambos ("¿cuántos días me quedan y puedo pasarlos al año siguiente?"), el orquestador llama a los dos y combina.
- Ningún agente puede devolver información personal de un colaborador distinto al que pregunta, salvo usuarios con rol RRHH.
- Si la confianza de la recuperación es baja (por ejemplo, similitud por debajo del umbral que definan), el agente responde que no encontró la política y ofrece escalar.
- Cada agente registra en una tabla de logs: consulta, agente, fragmentos usados, tiempo de respuesta y si hubo escalamiento. Esos logs alimentan el reporte diario.

---

## Banco de preguntas de prueba

El chatbot debe responder correctamente al menos el 80% de estas preguntas. Cada equipo agrega 20 preguntas propias y define, para todas, la respuesta esperada y el documento fuente.

| # | Pregunta | Tipo | Agente que debe responder |
| :---: | :--- | :--- | :--- |
| **1** | ¿Cuántos días de vacaciones me corresponden al año? | Política | Políticas (RAG) |
| **2** | ¿Cuántos días de vacaciones me quedan disponibles? | Dato personal | Datos del colaborador |
| **3** | ¿Puedo acumular vacaciones para el próximo año? | Política | Políticas (RAG) |
| **4** | ¿Con cuánta anticipación debo solicitar vacaciones? | Política | Políticas (RAG) |
| **5** | ¿Cuántos días de permiso tengo por fallecimiento de un familiar? | Política | Políticas (RAG) |
| **6** | ¿Cuánto dura la licencia de maternidad y la de paternidad? | Política | Políticas (RAG) |
| **7** | Me incapacitaron 5 días, ¿quién paga esos días y cuánto recibo? | Política | Políticas (RAG) |
| **8** | ¿Cuándo pagan el aguinaldo y cómo se calcula? | Política | Políticas (RAG) |
| **9** | ¿Qué día cae mi próximo pago? | Dato personal | Datos del colaborador |
| **10** | ¿Cuántos días puedo trabajar desde casa por semana? | Política | Políticas (RAG) |
| **11** | ¿Cómo se pagan las horas extra? | Política | Políticas (RAG) |
| **12** | ¿Cuánto dura el periodo de prueba? | Política | Políticas (RAG) |
| **13** | Si renuncio, ¿cuántos días de preaviso debo dar? | Política | Políticas (RAG) |
| **14** | ¿Qué incluye mi liquidación si me despiden sin justa causa? | Política | Políticas (RAG) |
| **15** | ¿Qué cubre el seguro médico de la empresa? | Política | Políticas (RAG) |
| **16** | ¿Cómo denuncio un caso de acoso laboral de forma confidencial? | Política | Políticas (RAG) |
| **17** | ¿Cuándo es mi próxima evaluación de desempeño? | Dato personal | Datos del colaborador |
| **18** | ¿En qué estado está mi solicitud de permiso del viernes? | Dato personal | Datos del colaborador |
| **19** | ¿Cuántos días me quedan y puedo pasar los que sobren al otro año? | Mixta | Datos + Políticas |
| **20** | ¿Qué feriados quedan este año? | Política | Políticas (RAG) |
| **21** | ¿Cuántos días de vacaciones tiene mi compañero Juan? | Restringida | Orquestador: debe negarse |
| **22** | ¿Cuál es el salario del gerente general? | Restringida | Orquestador: debe negarse |
| **23** | ¿La empresa da bono por mascotas? | Sin respuesta en docs | Políticas: debe decir que no está y ofrecer escalar |
| **24** | ¿Me recomiendas una película? | Fuera de alcance | Orquestador: redirige al tema de RRHH |
| **25** | (Rol RRHH) ¿Cuántas personas están de vacaciones hoy? | Dato agregado | Datos o Analista |

Las preguntas 21 a 25 son tan importantes como las demás: un sistema que responde todo, incluso lo que no debe, reprueba el criterio de seguridad.

---

## Base de datos y reportes diarios

La base de datos guarda los datos estructurados que el RAG no debe manejar: personas, saldos, solicitudes y registros de uso. El agente analista la consulta cada día a las 7:00 a. m. y publica el reporte en el dashboard de RRHH.

### Tablas mínimas:

| Tabla | Campos principales | Uso |
| :--- | :--- | :--- |
| **colaboradores** | `id`, `nombre`, `departamento`, `puesto`, `fecha_ingreso`, `jefe_id`, `rol`, `estado` | Identidad y estructura |
| **saldos_vacaciones** | `colaborador_id`, `periodo`, `dias_asignados`, `dias_tomados`, `dias_disponibles` | Pregunta "¿cuántos días me quedan?" |
| **solicitudes** | `id`, `colaborador_id`, `tipo`, `fecha_inicio`, `fecha_fin`, `estado`, `aprobador_id`, `creada_en` | Vacaciones, permisos y su estado |
| **incapacidades** | `id`, `colaborador_id`, `tipo`, `fecha_inicio`, `dias`, `entidad` | Ausencias médicas |
| **movimientos_personal** | `id`, `colaborador_id`, `tipo` (ingreso, salida, ascenso), `fecha`, `motivo` | Rotación |
| **consultas_chat** | `id`, `colaborador_id`, `pregunta`, `intencion`, `agente`, `documentos_citados`, `resuelta`, `escalada`, `latencia_ms`, `fecha` | Analítica del chatbot |
| **reportes_diarios** | `id`, `fecha`, `datos_json`, `resumen_texto`, `generado_por` | Lo que lee el dashboard |

### El reporte diario debe incluir como mínimo:
1. Personas ausentes hoy, por tipo (vacaciones, permiso, incapacidad) y por departamento.
2. Solicitudes pendientes de aprobación y cuántas llevan más de 3 días sin respuesta.
3. Incapacidades activas y días acumulados en el mes.
4. Ingresos y salidas del mes, y tasa de rotación acumulada.
5. Colaboradores con más de 20 días de vacaciones acumulados (riesgo de pasivo).
6. Uso del chatbot: consultas del día anterior, porcentaje resuelto sin escalar, latencia promedio.
7. Top 5 de temas más consultados y las preguntas que el RAG no pudo responder (señal de documentos faltantes).
8. Un resumen ejecutivo de 3 a 5 frases, redactado por el LLM a partir de las cifras, nunca inventando números.

**Requisitos del dashboard:** al menos 4 indicadores numéricos, 2 gráficos (uno de tendencia de 30 días), la tabla de solicitudes pendientes, el resumen ejecutivo y un historial para consultar reportes de días anteriores. Solo usuarios con rol RRHH pueden verlo.

**Regla clave:** las cifras salen de SQL, el LLM solo redacta. Si el resumen menciona un número que no está en el JSON del reporte, el reporte se considera incorrecto.

---

## Requerimientos técnicos y stack sugerido

El equipo puede elegir sus herramientas, siempre que justifique la elección en el informe técnico. Esta es una combinación probada:

| Capa | Opción sugerida | Alternativas válidas |
| :--- | :--- | :--- |
| **Fuente de documentos** | Google Drive + Drive API con cuenta de servicio | OAuth 2.0 si cada usuario usa su Drive |
| **Orquestación de agentes** | LangGraph | CrewAI, n8n, OpenAI Agents SDK, Google ADK |
| **LLM** | Gemini o Claude vía API | GPT, modelos abiertos con Ollama |
| **Embeddings** | Modelo de embeddings de Gemini o multilingüe abierto | Cualquiera con buen soporte de español |
| **Base vectorial** | PostgreSQL + pgvector | Qdrant, Chroma, Pinecone |
| **Base de datos** | PostgreSQL (misma instancia) | MySQL, Supabase |
| **Backend** | Python + FastAPI | Node.js + Express |
| **Frontend (chat y dashboard)** | React + una librería de gráficos | Streamlit, Next.js |
| **Programación del reporte** | Cron o scheduler del orquestador | Cloud Scheduler, n8n |

### Requerimientos no funcionales obligatorios:
- Respuesta del chatbot en menos de 8 segundos en el 90% de las consultas.
- Toda respuesta de política incluye al menos una cita con nombre del documento y enlace.
- Inicio de sesión con al menos dos roles: colaborador y RRHH.
- Credenciales en variables de entorno o gestor de secretos; ninguna clave en el repositorio.
- Datos de colaboradores 100% simulados; prohibido usar datos personales reales.
- Sincronización con Drive al menos una vez al día, detectando archivos nuevos, editados y borrados.

---

## Entregables y cronograma

El proyecto dura 5 semanas y se entrega en cinco avances; cada avance se revisa en clase antes de pasar al siguiente.

1. **Semana 1. Investigación:** informe de deep research y los 10 o más documentos de políticas subidos a una carpeta de Drive compartida con la cuenta de servicio.
2. **Semana 2. Datos e ingesta:** modelo de base de datos con datos simulados (50 colaboradores, 3 meses) y pipeline que indexa Drive en la base vectorial.
3. **Semana 3. Agentes conversacionales:** orquestador, agente de políticas y agente de datos funcionando en el chat, con citas.
4. **Semana 4. Reportes y dashboard:** agente analista programado, tabla de reportes y dashboard con rol RRHH.
5. **Semana 5. Evaluación y demo:** resultados del banco de preguntas, ajustes y demo en vivo de 15 minutos.

### Entrega final:
- Repositorio con código, `README` de instalación y archivo `.env.example`.
- Diagrama de arquitectura propio (puede partir del de este enunciado).
- Informe técnico de 8 a 12 páginas: decisiones de diseño, prompts de cada agente, estrategia de chunking, resultados de evaluación y limitaciones.
- Hoja de evaluación con las 45 preguntas (25 base + 20 propias), respuesta esperada, respuesta obtenida y resultado.
- Video de demo de 5 minutos como respaldo de la presentación.

---

## Rúbrica de evaluación

La nota se calcula sobre 100 puntos; se requieren al menos 70 para aprobar y ninguna fuga de datos personales en las preguntas 21 y 22.

| Criterio | Puntos | Excelente (100%) | Insuficiente (menos de 50%) |
| :--- | :---: | :--- | :--- |
| **Investigación y documentos** | 15 | Cubre los 10 dominios, cita normativa del país y los documentos están bien estructurados. | Documentos genéricos, sin fuentes o copiados. |
| **Conexión con Drive e ingesta** | 10 | Indexa varios formatos y sincroniza cambios automáticamente. | Carga manual o un solo formato. |
| **Diseño multiagente** | 20 | Agentes con roles claros, orquestador que enruta bien y resuelve consultas mixtas. | Un solo prompt que hace todo. |
| **Calidad de respuestas (RAG)** | 20 | 80% o más de aciertos, siempre con citas, admite cuando no sabe. | Menos de 60% o respuestas inventadas. |
| **Reportes diarios y dashboard** | 15 | Reporte automático con los 8 elementos, cifras correctas e historial. | Reporte manual o con cifras inventadas. |
| **Seguridad y privacidad** | 10 | Roles, filtros por usuario, secretos protegidos, rechaza preguntas restringidas. | Expone datos de terceros o claves. |
| **Informe técnico y demo** | 10 | Explica decisiones y limitaciones con evidencia; demo fluida. | Informe descriptivo sin análisis. |

**Puntos extra (máximo 10):** agente validador, agente de escalamiento con tickets, respuestas por voz, o evaluación automática con métricas de RAG (fidelidad y relevancia de contexto).

---

## Recomendaciones y recursos

Empiecen pequeño: un documento, un agente y cinco preguntas funcionando de punta a punta valen más que diez agentes a medio hacer.

- Reutilicen la configuración de Google Cloud Console del Mini Proyecto #1 (proyecto, Drive API, cuenta de servicio y scope de solo lectura).
- Guarden en cada fragmento los metadatos del documento (nombre, sección, versión, enlace); sin ellos no hay citas.
- Prueben fragmentos de 500 a 1000 tokens con algo de solapamiento y comparen resultados con el banco de preguntas.
- Escriban el prompt de cada agente en un archivo propio y versiónenlo; es parte de lo que se evalúa.
- Validen el reporte diario comparando sus cifras con una consulta SQL hecha a mano.

### Recursos de referencia:
- Documentación de la Google Drive API.
- Detectar cambios en Drive con `changes.list`.
- Documentación de LangGraph.
- pgvector para PostgreSQL.
- Código de trabajo y sitio oficial del ministerio de trabajo del país elegido.

```

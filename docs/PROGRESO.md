# Registro para retomar Bosque Claro

Fecha: 2026-11-19. Credenciales actuales conservadas, sin valores secretos en este registro.

## Git y alcance

Commit inicial `146d667` en `master`; un único árbol `/home/panterita/Proyectos/portal-rrhh-rag`. Se conservaron los cambios que dejó Gemini y se archivó su JSON en `evaluacion/resultados-2026-11-19-gemini.json`. Trabajo realizado en el árbol actual, sin subagentes ni worktrees adicionales. `.gitignore` conserva las plantillas `.env.example` y excluye entorno privado, credenciales, dependencias y temporales.

## Correcciones verificadas

- Reproducción inicial real en Chromium: «hola», «buenas», «buenos días» y las dos preguntas de feriados devolvían 503. Logs: `DEEPSEEK_API_KEY_MISSING` en el proceso Express antiguo; proceso nuevo pasó llm:check con el entorno existente. Se reinició Express sin editar credenciales.
- Saludos aislados: respuesta breve sin LLM ni búsqueda. Saludo más pregunta: se responde la pregunta. «cuantas vacaciones tengo» conserva saldo SQL propio de sesión.
- Clasificación de procedimientos, incapacidad, liquidación, privacidad, revisión de recibo/evaluación y feriados corregida; «reportar un error» no concede acceso a reportes RRHH. Las guardias de terceros se conservan antes del LLM.
- Feriados: fecha America/Costa_Rica y filas de D02 publicado. Se probó 19-11-2026 → 01-12-2026; fuera de cobertura se abstiene. Respuestas de varios feriados citan todas sus filas. La extracción reconoce secciones numeradas; pipeline v2 reconciliado sobre los doce documentos.
- Consultas mixtas conservan tema de vacaciones al separar cláusulas, incluso «¿Cuántos días me quedan y puedo pasarlos al año siguiente?», sin enviar el saldo al agente de políticas.
- Validación documental mantiene IDs permitidos y cifras respaldadas, incluyendo metadatos reales de sección/versión. Una única corrección de redacción utiliza las mismas fuentes si aparecen cifras no respaldadas. No se modificó el banco ni los criterios de evaluación.
- «Eliminar conversación»: confirmación/cancelación, DELETE /chat/historial con sesión, Origin y CSRF; sin identidad por cuerpo/query. Elimina preguntas, respuestas, citas y logs; no se reutilizan como contexto ni reaparecen tras recarga. Preserva otras cuentas. Migración 16 añade métricas anónimas por día/tema; transacción y bloqueo dedicado por cuenta coordinan envíos concurrentes. Dashboard y agregados se conservan. Contrato API/DBML actualizados.
- Generación/actualización manual de reportes RRHH (`POST /api/v1/rrhh/reportes/generar`): protegida con sesión, rol `rrhh`, `Origin`, CSRF y bloqueo MySQL (`connection.promise().query` en `withDateLock`) coordinado con el worker de las 07:00 `America/Costa_Rica`. Dashboard `/rrhh/reportes` incorpora **Generar reporte de hoy**, **Abrir reporte de hoy** y **Actualizar reporte de hoy** (con confirmación explícita, estado de carga y prevención de doble clic), manteniendo el historial descendente y el detalle completo por fecha. Verificado en navegador real (Chromium/Playwright) contra MySQL/DeepSeek: generación, consulta histórica (`2026-11-17`), actualización sin duplicados (`1` fila para `2026-11-19`), persistencia tras recarga y rechazo `403`/redirección para colaborador. Pruebas backend: 68 unitarias y 15 de integración aprobadas.
- Fichas individuales de colaboradores y 3 reportes mensuales generales (`2026-08`, `2026-09`, `2026-10`):
  - Nueva migración 18 (`20261119000018-crear-asistencias.js`) y seeder idempotente (`20261119020000-asistencias-tres-meses.js`, `origen = 'simulado'`) con **5 301 registros** diarios de jornada/asistencia para los 60 colaboradores respetando `fecha_ingreso`, `fecha_salida`, solicitudes aprobadas, incapacidades y feriados CR. `db:verify` aprobado (16 modelos, 18 migraciones, 13 FKs).
  - Nuevos endpoints RRHH: `GET /api/v1/rrhh/reportes-mensuales`, `GET /api/v1/rrhh/reportes-mensuales/:mes` y `GET /api/v1/rrhh/colaboradores/:id/ficha?mes=YYYY-MM` (sin salarios, diagnósticos ni chats privados).
  - En `/rrhh/reportes`, todos los nombres de **Reporte por persona** enlazan a `/rrhh/colaboradores/:id` (`ColaboradorFicha.jsx`), y se incorporó la sección **Reportes mensuales** (`MonthlyReportsSection.jsx`). Verificado en Chromium/Playwright (Camila Alfaro Murillo, Sofía Vargas Méndez vía buscador, Alejandro Araya Campos, cambio de mes, conciliación de los 3 meses contra MySQL, reporte diario/historial intactos y bloqueo `403` a colaborador). Pruebas backend: 68 unitarias y 16 de integración aprobadas.

## Evidencia final

**45/45 (100 %) verificaciones automáticas aprobadas**, **0 fallidas**, **0 bloqueadas**. p90 HTTP **5465 ms** y p90 con documentos **6597 ms**. Preguntas 21/22: **HTTP 403 genérico sin datos**.

- **67 unitarias**, **15 integración MySQL/HTTP**, **8 Chromium escritorio/móvil** y recorrido adicional real de chat/borrado/dashboard aprobados. Build frontend correcto. Esquema verificado: **15 modelos, 16 migraciones, 12 FK**, 60 colaboradores y fixtures intactos.
- Drive: **12 documentos** (9 Docs, 2 Sheets, 1 PDF), todos en carpeta autorizada e indexados en Qdrant: **68 fragmentos activos**. Reconciliación: 12 indexados; incremental posterior sin cambios/duplicados. Seis búsquedas españolas de ingest:verify aprobadas. Auditoría: **79 citas** contrastadas automáticamente con contenido actual de Drive. Ver `evaluacion/verificacion-fuentes.json`.
- Navegador: saludos, dos frases de feriados, saludo con pregunta, saldo MySQL, mixta con citas, cancelar conserva historial, confirmar elimina y recarga vacía, memoria vacía, otra cuenta intacta y reporte RRHH posterior. Evidencia: `evaluacion/verificacion-navegador.json`. Las citas D01/D02 abren Google, pero el navegador aislado pide sesión: queda la comprobación visual por persona autorizada. No se afirma lectura visual dentro de Drive.
- Reporte real **2026-11-19**, `origen=ejecucion`, generado el **2026-11-19T14:46:17Z** por el analista/DeepSeek mediante ejecución manual reportada por Gemini; persistencia y dashboard verificados. No acreditar ejecución a las 07:00. Los reportes anteriores `fixture` siguen identificados.
- Worker: comprobado **inactivo**, sin servicio instalado/daemon observado. Código agenda reporte 07:00 e ingesta 02:00 America/Costa_Rica. La generación manual no acredita programación operativa.
- Una corrida intermedia aprobó 45/45 con p90 documental **8624 ms**; se redujeron llamadas de clasificación innecesarias para consultas inequívocas. El valor final anterior es una medición, no garantía de latencia futura. Revisión humana completa y aprobación legal siguen pendientes.

## Entrega y acciones pendientes

Informe técnico editable, HTML/PDF actualizado; investigación y políticas conservadas; XLSX/CSV regenerados desde JSON; guion de **video de 5 minutos** en `demo.md` y **demo en vivo de 15 minutos** en `demo-en-vivo.md`.

1. Abrir las citas con una cuenta Google autorizada y completar revisión humana de fidelidad. No hace falta crear claves ni ampliar permisos: usar `PROMPT_GEMINI_REVISION_FINAL.md`.
2. Grabar y adjuntar el video real de cinco minutos; el guion no equivale a una grabación.
3. Para continuidad operativa, iniciar `npm run worker` o instalar un supervisor adaptado al entorno y comprobar un disparo programado. No es necesario para abrir el reporte ya publicado.

Backend: `cd backend && npm start`; frontend: `cd frontend && npm run dev`. No reemplazar `.env`, no reseed ni borrar datos para arrancar. El verificador explícito `node frontend/scripts/verify-chat-live.cjs` confirma el borrado del historial demo: ejecutarlo solo cuando se quiera repetir esa prueba.

Al cerrar las verificaciones se detuvo el Express iniciado para las pruebas. Para volver a usar el portal, ejecutar `npm start` desde `backend/`; el Vite que ya estaba abierto no se detuvo.

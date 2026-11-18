# Registro para retomar Bosque Claro

Fecha: 2026-11-18. Sin secretos. Leer junto a AGENTS, enunciado, contrato API, plan de implementación e ingesta antes de cambiar código.

## Preparación del commit inicial

- Revisados los archivos candidatos, ambos `.env.example`, los PDF y el contenido XML de la hoja de evaluación para detectar formatos conocidos de claves y tokens. Las asignaciones señaladas en pruebas usan valores sintéticos explícitos; no se detectaron credenciales reales en los candidatos.
- Ampliado `.gitignore` para credenciales Google/OAuth, tokens, almacenes de claves, cookies, volcados y temporales. Comprobada la exclusión de `.env`, dependencias y builds, y la inclusión de ambos `.env.example` con campos secretos vacíos. Los archivos privados locales se conservan.
- Antes de delegar código en paralelo, crear una rama y un worktree por agente a partir del commit inicial; integrar y verificar sus resultados. Lectura y configuración de accesos se realizan en el árbol principal.

## Terminado y verificado

- Conservados datos, credenciales y migraciones existentes. Nueva migración 15 aplicada: `consultas_chat.respuesta_json`; snapshot v1 intacto. `db:verify`: 14 modelos, 15 migraciones, 60 personas y fixtures intactos.
- Chat autenticado/CSRF, orquestador, agente SQL propio, políticas Qdrant/DeepSeek, respuestas mixtas con estados parciales, memoria privada/historial paginado y logs. Guardias de terceros antes del LLM; no hay SQL generado por el modelo.
- Frontend `/chat` y `/rrhh/reportes`, integrado al diseño existente. Dashboard con cuatro indicadores, dos gráficos, ocho contenidos, pendientes e historial; distingue fixtures. Historial chat persiste tras recarga.
- Analista con agregados SQL conciliados contra fixture determinista; corregidos GROUP BY y límites UTC/CR. DeepSeek selecciona 3–5 frases factuales del JSON sin poder alterar métricas/cifras. No publica si falla proveedor o validación.
- Worker: reportes 07:00 e ingesta 02:00 America/Costa_Rica, recuperación de tareas vencidas, locks/reintentos y apagado ordenado. Probado brevemente con servicios reales: ingesta independiente y reporte falla explícitamente por clave DeepSeek ausente. No queda daemon instalado ni activo. Plantilla: `infra/bosque-claro-worker.service.example`.
- Pruebas finales: **61 unitarias**, **13 integración MySQL/HTTP sin omisiones**, **8 Chromium escritorio/móvil** y **build frontend** aprobados. Salud HTTP/MySQL 200. Las citas/mixtas de UI incluyen un doble HTTP explícito, no acreditan RAG real.
- Hoja entregable exportada a `docs/evaluacion/evaluacion-45.xlsx` y CSV, con 45 filas. Banco real completo: **45 ejecutadas, 15 aprobadas automáticamente, 0 fallidas, 30 bloqueadas** (27 dependencia, 2 parciales, 1 reporte no publicado). Preguntas 21/22: 403 genérico sin datos. p90 HTTP 57 ms incluye errores; p90 documental null. **No acreditados el 80 % ni la meta de latencia RAG**. Runner sale 2 por bloqueos, no por fallo de prueba. Ver `docs/evaluacion/resultados-actuales.json` y README de evaluación.
- Entregables: arquitectura, informe técnico editable/HTML/PDF de 11 páginas (convertido con LibreOffice y texto/paginación comprobados), investigación y doce documentos existentes, guion de demo, README y RespuestasAqui. Video pendiente de grabación.

## Estado real de accesos

- Drive lector autorizado; carpeta permitida con **0 archivos**. Gemini genera embeddings reales con la dimensión configurada. Qdrant Cloud accesible: colección real con 0 puntos y dimensión/Cosine verificadas. `QDRANT_COLLECTION` válido, sin punto final ni espacios; no se cambió.
- Sync inicial y repetición incremental reales: cero indexados/eliminados/errores. Cursor MySQL persistente. Búsqueda española real: sin resultados. Esto acredita conectividad y sincronización vacía, no corpus ni citas.
- `GOOGLE_PUBLISH_APPLICATION_CREDENTIALS` y `DEEPSEEK_API_KEY` ausentes. `llm:check` lo informa sin mostrar valores. La credencial lectora existe y no se modificó. El usuario confirmó al cierre que todavía no configuró ninguno de los dos accesos y seguirá la guía con Gemini.

## Acción externa exacta

Seguir [PROMPT_GEMINI_ACCESOS.md](PROMPT_GEMINI_ACCESOS.md): autorizar escritor Google separado (OAuth de usuario para Mi unidad o cuenta de servicio en unidad compartida), guardar JSON privado fuera del repositorio y configurar su ruta en `backend/.env`. Crear clave con cuota DeepSeek y configurar `DEEPSEEK_API_KEY` localmente. Mantener intactos lector, Gemini y credenciales MySQL.

Después, desde backend: `npm run llm:check`, `npm run policies:plan`, `npm run policies:publish`, `npm run policies:inspect`; repetir publicación y comprobar doce sin duplicados. Ejecutar `ingest:sync`, repetir, `ingest:verify` y abrir citas reales. Generar reporte con `report:generate`, ejecutar `eval:chat`, revisar fidelidad manualmente y medir p90 RAG. Iniciar `npm run worker` bajo supervisor si se requiere continuidad. Grabar demo después del recorrido documental real.

## Comandos para continuar

Backend: `cd backend && npm start`. Frontend en otra terminal: `cd frontend && npm run dev` (localhost:5173 autorizado). Worker en tercera terminal: `cd backend && npm run worker`. No reemplazar `.env`, no volver a sembrar para iniciar, no borrar datos. No informar publicación, resumen LLM o calidad RAG como aprobados hasta disponer de evidencia real.

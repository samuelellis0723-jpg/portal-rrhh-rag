# Evaluación reproducible

`banco-45.json` conserva las 25 preguntas base y 20 propias con respuestas y fuentes esperadas. Desde backend: `npm run eval:chat`; después `npm run eval:export`. Requiere MySQL, cuentas demo y proveedores reales. Usa Express temporal, inicia/cierra sus sesiones, conserva trazas de ejecución y respeta límites de chat. No cambia credenciales ni fixtures.

Resultado final del 19-11-2026: **45/45 (100 %) verificaciones automáticas aprobadas**, **0 fallidas**, **0 bloqueadas**. p90 HTTP **5465 ms** y p90 con documentos **6597 ms**. Preguntas 21/22: **HTTP 403 genérico sin datos**.

Los valores se calculan sobre el banco completo. Salida CLI: 0 si pasan todas, 1 si hay fallos, 2 si quedan bloqueos. Las dependencias fallidas no cuentan como aciertos. Los controles verifican HTTP, intención, procedencia de documentos, enlaces y saldo SQL. El p90 documental considera respuestas con citas, no errores rápidos. Una corrida intermedia dio p90 documental 8624 ms; la medición final no garantiza una latencia constante.

`resultados-actuales.json`, `evaluacion-45.xlsx` y `evaluacion-45.csv` contienen las 45 filas finales. El JSON original de Gemini (37/45, ocho fallos, p90 4783 ms) se conserva como `resultados-2026-11-19-gemini.json`. No se relajaron preguntas ni criterios.

`verificacion-fuentes.json` verifica doce documentos y 68 puntos activos, y coteja 79 fragmentos citados contra la exportación actual de Drive. Es una comprobación automática de presencia y procedencia, no una revisión jurídica. `revision-fidelidad.md` recoge el cotejo documental del agente y los límites pendientes de revisión humana.

`verificacion-navegador.json` documenta Chromium con proveedores reales: saludos, feriados, saldo, mixta, cancelar/eliminar, recarga y dashboard. Las citas se pulsaron y Google pidió iniciar sesión en el navegador aislado; abrir el documento privado con una persona autorizada sigue pendiente. Las ocho pruebas existentes de frontend incluyen además un doble HTTP explícito para presentación visual: ese bloque no acredita RAG real.

Pruebas: 67 unitarias, 15 MySQL/HTTP, ocho Chromium desktop/móvil y un recorrido adicional real. El script explícito `node frontend/scripts/verify-chat-live.cjs` elimina la conversación demo al confirmar; no ejecutarlo como simple consulta de estado. Nunca mostrar variables privadas en evidencia.

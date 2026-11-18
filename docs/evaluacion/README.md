# Evaluación reproducible

`banco-45.json` contiene las 25 preguntas del enunciado y 20 propias con rol, HTTP/intención esperada, respuesta y fuentes. Desde `backend/`, ejecutar `npm run eval:chat`; requiere MySQL y las dos cuentas demo existentes. Levanta Express en un puerto temporal, inicia y cierra sus sesiones y conserva consultas/trazas reales de evaluación. No cambia contraseñas ni fixtures. Respeta el límite de chat y puede esperar un minuto.

`resultados-actuales.json` registra una fila por pregunta, respuesta obtenida, citas, verificaciones y latencia. El código de salida es **0** si pasan todas las comprobaciones automáticas, **1** si hay fallos y **2** si quedan casos bloqueados. Una variable configurada no acredita el acceso al proveedor: se observa el HTTP real. Se deben revisar manualmente fidelidad, relevancia y distinción de política propuesta frente a obligación legal.

La hoja entregable está en [evaluacion-45.xlsx](evaluacion-45.xlsx) y [evaluacion-45.csv](evaluacion-45.csv). Después de repetir el banco, regenerarlas con `npm run eval:export` desde `backend/`; conservan las respuestas obtenidas y las fuentes del JSON, sin inventar enlaces de Drive.

Resultado real del 18-11-2026: **45 ejecutadas, 15 aprobadas automáticamente, 0 fallidas, 30 bloqueadas**. Ambas preguntas de privacidad 21/22 recibieron 403 genérico sin datos. Los bloqueos corresponden a proveedores/corpus pendientes, respuestas mixtas parciales y reporte diario aún no publicado; no cuentan como aciertos. No se acredita el objetivo de 80 %: la cobertura automática actual es 33,33 % del banco.

El p90 de todas las respuestas HTTP es 57 ms; incluye rechazos y errores rápidos. El p90 de respuestas documentales es `null`, porque no hubo ninguna con citas reales. Este resultado **no acredita** la meta de latencia del RAG. Repetir después de habilitar escritura de Google, publicar e ingerir D01–D12 y configurar DeepSeek conforme a [la guía de accesos](../PROMPT_GEMINI_ACCESOS.md).

Las suites de backend separan pruebas con dobles (unitarias) y MySQL/HTTP reales (`test:integration`). Las pruebas Chromium de `frontend/` usan HTTP/MySQL reales para autenticación, datos propios, historial y reporte fixture; una rama explícitamente interceptada comprueba solo la presentación de citas/respuestas mixtas. No debe usarse como evidencia del LLM ni de Drive.

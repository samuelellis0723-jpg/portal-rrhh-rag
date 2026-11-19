# Bosque Claro: estado y entrega

Actualizado el 19 de noviembre de 2026. Empresa ficticia y 60 colaboradores simulados. Credenciales y fixtures conservados.

**45/45 (100 %) verificaciones automáticas aprobadas**, **0 fallidas**, **0 bloqueadas**. p90 HTTP **5465 ms** y p90 con documentos **6597 ms**. Preguntas 21/22: **HTTP 403 genérico sin datos**.

Se corrigieron saludos, calendario de feriados con fecha de Costa Rica, clasificación de procedimientos y consultas mixtas. El chat permite cancelar o confirmar la eliminación de su historial, con CSRF y propiedad de sesión; borra contenido y memoria, conservando métricas anónimas. Las pruebas cubren acceso cruzado y dashboard posterior.

Drive contiene doce documentos y Qdrant 68 fragmentos activos. El reporte del 19-11-2026 es una ejecución real del analista generada manualmente; el worker sigue inactivo. Google pidió sesión al abrir citas desde el Chromium aislado: falta revisión visual con la cuenta autorizada y revisión humana completa de fidelidad.

Preparados: informe técnico y PDF, JSON/XLSX/CSV de 45 preguntas, [guion de video de 5 minutos](docs/demo.md) y [demo en vivo de 15](docs/demo-en-vivo.md). Falta grabar el video real. [Prompt listo para Gemini](docs/PROMPT_GEMINI_REVISION_FINAL.md) para revisión final sin cambiar accesos.

Para arrancar: `npm start` desde backend y `npm run dev` desde frontend. Abrir http://localhost:5173. No reemplazar `.env` ni volver a sembrar. Para worker continuo, iniciar `npm run worker` bajo un supervisor y comprobar ejecución programada.

Detalle verificable en [PROGRESO](docs/PROGRESO.md) y [evaluación](docs/evaluacion/README.md).

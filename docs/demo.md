# Video de respaldo: cinco minutos

El enunciado pide un video de demo de **5 minutos**, además de la presentación en vivo de **15 minutos**. Este archivo es el guion del video; [demo-en-vivo.md](demo-en-vivo.md) contiene el recorrido de quince minutos. El video todavía debe grabarse.

Bosque Claro y sus 60 colaboradores son ficticios. Preparar las sesiones antes de grabar y pausar la captura al introducir contraseñas. No mostrar `.env`, credenciales, cookies, tokens CSRF ni paneles de facturación.

## Preparación

Iniciar MySQL, Express (`cd backend && npm start`) y Vite (`cd frontend && npm run dev`). Abrir `http://localhost:5173` y una sesión Google autorizada para las citas de Drive. Revisar [PROGRESO.md](PROGRESO.md), el resultado JSON y la hoja XLSX. El reporte del 19-11-2026 tiene `origen=ejecucion`; se generó manualmente con el analista y DeepSeek. El worker no está activo como servicio: no presentar ese reporte como prueba de ejecución programada.

## Guion cronometrado

| Tiempo | Acción y explicación |
|---|---|
| 0:00–0:30 | Presentar la empresa ficticia, los 60 colaboradores y el problema. Mostrar arquitectura: MySQL para cifras; Drive para políticas; Gemini/Qdrant para recuperación; DeepSeek para clasificación y redacción. |
| 0:30–1:10 | Entrar con colaborador sin grabar contraseña. Mostrar saldo propio y recargar. Abrir chat: «hola» y «cuantas vacaciones tengo». Señalar que el saludo no usa LLM y el saldo viene de MySQL. |
| 1:10–2:00 | Preguntar «cuando es el proximo feriado?». Mostrar fecha de referencia de Costa Rica; abrir la cita de D02 y comprobar fila/fecha en Drive. Si la demo ocurre fuera de 2026, explicar que el calendario publicado no cubre el período; no prometer una fecha de otro año. |
| 2:00–2:45 | Pregunta mixta: «¿Cuántos días me quedan y puedo pasarlos al año siguiente?». Distinguir saldo SQL y política D01 propuesta con cita. Preguntar por el saldo de un compañero y mostrar rechazo genérico. |
| 2:45–3:15 | Pulsar «Eliminar conversación», cancelar y mostrar que sigue ahí. Confirmar la eliminación; recargar y mostrar chat vacío. Explicar que preguntas, respuestas, citas y trazas se borran; solo quedan métricas anónimas agregadas. |
| 3:15–4:15 | Ingresar como RRHH y abrir reporte real del 19-11-2026. Mostrar indicadores, dos gráficos, pendientes, temas, resumen e historial. Distinguir `ejecucion` de fixtures y generación manual de scheduler configurado a las 07:00 de Costa Rica. |
| 4:15–4:45 | Mostrar XLSX/CSV y el resumen del JSON final: puntaje automático, fallos/bloqueos, privacidad 21/22 y p90 documental. Leer los valores actuales, sin atribuirles revisión humana completa. |
| 4:45–5:00 | Cerrar sesión. Mencionar límites: políticas académicas, revisión humana de fidelidad y worker sin servicio continuo. Indicar dónde están README, contrato y entregables. |

## Archivos a entregar

Repositorio sin secretos, README y ejemplos de entorno; investigación de nueve páginas; informe técnico y PDF de 8–12 páginas; arquitectura; banco de 45 preguntas, JSON final y hoja XLSX/CSV; enlace o archivo del video grabado de cinco minutos. Revisar las notas de fidelidad y fuentes en `docs/evaluacion/` antes de grabar.

# Demo en vivo: quince minutos

Duración indicada en la Semana 5 del enunciado: **15 minutos**. El video de respaldo es otra pieza de **5 minutos**; su guion está en [demo.md](demo.md).

## Preparación

Abrir el portal, arquitectura, hoja de evaluación, reporte real del 19-11-2026 y dos documentos de Drive con una cuenta Google autorizada. Tener MySQL, Express y Vite activos. Iniciar sesión fuera de la proyección o pausar la pantalla al introducir contraseñas. Mantener cerrados `.env`, gestores de credenciales, consolas con cookies y paneles de cuenta.

Comprobar que las fechas de los ejemplos correspondan al día de la presentación. El calendario D02 cubre 2026; para otra fecha, demostrar la abstención por falta de cobertura. El conjunto de cifras es completamente simulado.

## Guion cronometrado

| Tiempo | Recorrido |
|---|---|
| 0:00–1:00 | Presentar empresa, país, 60 colaboradores sintéticos, problema del chat repetitivo y necesidad del reporte diario. |
| 1:00–2:30 | Explicar los cinco agentes y sus fronteras: orquestador, políticas, datos, ingesta y analista. Drive es fuente documental; MySQL contiene identidades/cifras; Qdrant es reconstruible. Distinguir embeddings Gemini del LLM DeepSeek. |
| 2:30–3:30 | Mostrar los doce documentos publicados: nueve Docs, dos Sheets y un PDF. Identificar versión, sección, responsable y estado académico. Explicar sincronización `changes.list`, cursor persistente, pertenencia a carpeta y revisiones activas. |
| 3:30–5:00 | Colaborador: sesión, saldo y períodos propios. Chat «hola», «cuantas vacaciones tengo» y saludo con pregunta. Recargar para mostrar persistencia y fuente SQL sin cálculo LLM. |
| 5:00–6:30 | Preguntar las dos variantes de feriados; comprobar fecha de Costa Rica y abrir D02 en la fila citada. Explicar modalidad salarial y falta de calendario futuro cuando corresponda. |
| 6:30–8:00 | Pregunta mixta de vacaciones: comparar saldo SQL con D01, abrir sección sobre acumulación. Mostrar un procedimiento (revisión de recibo o evaluación) y su cita. Distinguir propuesta interna de regla legal y dato individual. |
| 8:00–9:15 | Ejecutar privacidad 21/22: rechazo genérico. Preguntar por bono de mascotas: abstención con derivación. Explicar que el texto no puede elevar rol ni proporcionar un ID para consultar terceros. |
| 9:15–10:15 | Eliminar conversación: cancelar conserva contenido; confirmar y recargar deja vacío. Explicar CSRF, propiedad de sesión, bloqueo con envíos concurrentes y conservación exclusiva de métricas anónimas por fecha/tema. |
| 10:15–12:00 | RRHH: abrir reporte `ejecucion` del 19-11-2026; indicadores, dos gráficos, tendencia de 30 días, pendientes, riesgo, ausencias, temas y resumen. Mostrar historial con fixtures identificados. Explicar que ese reporte fue generado manualmente y que `GET` no genera reportes. |
| 12:00–13:00 | Mostrar worker: horarios de reporte 07:00 e ingesta 02:00 America/Costa_Rica, reintentos e independencia. Señalar el estado operativo real; si se inicia manualmente, no llamarlo servicio instalado ni ejecución observada a las 07:00. |
| 13:00–14:15 | Revisar JSON y XLSX/CSV con las 45 preguntas. Explicar criterios automáticos, privacidad, p90 con documentos, correcciones de los ocho fallos previos y límites de la revisión humana. Mostrar evidencia de integración y navegador sin secretos. |
| 14:15–15:00 | Cerrar sesión, mostrar rutas privadas protegidas y ubicar entregables. Reservar el cierre para preguntas y límites concretos, sin prometer aprobación jurídica o continuidad operativa no demostrada. |

## Si falla una dependencia durante la presentación

Mostrar el error explícito y utilizar el video de cinco minutos como respaldo. Las respuestas parciales se identifican por parte SQL/documental. No sustituir una llamada fallida por texto inventado ni presentar un fixture como reporte recién generado. Conservar el JSON de la evaluación medida y aclarar que una corrida anterior no garantiza disponibilidad en ese instante.

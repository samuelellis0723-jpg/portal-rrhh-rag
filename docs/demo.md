# Demo de cinco minutos

Empresa y datos exclusivamente simulados. No mostrar archivos `.env`, contraseñas, credenciales, cookies, CSRF ni pestañas de facturación. El video no está grabado: este archivo es su guion.

## Preparación

Iniciar MySQL, `npm start` en backend y `npm run dev` en frontend. Abrir localhost:5173. Usar las cuentas `.example` existentes y contraseña local privada. Leer [PROGRESO](PROGRESO.md) y comprobar `ingest:check -- --live` y `llm:check`. Para una demo documental completa, publicar los doce documentos, sincronizar, pasar `ingest:verify`, generar un reporte real y repetir evaluación. No sustituir esos pasos por respuestas de ejemplo.

## Guion cronometrado

| Tiempo | Acción y explicación |
|---|---|
| 0:00–0:35 | Presentar Bosque Claro y los 60 colaboradores simulados. Mostrar arquitectura: MySQL guarda identidades/cifras; Drive políticas; Qdrant es derivado. Gemini crea embeddings y DeepSeek clasifica/compone respuestas. |
| 0:35–1:10 | Login colaborador sin grabar la contraseña. Mostrar saldo y períodos. Recargar para comprobar cookie/sesión. |
| 1:10–2:15 | Chat: «¿Cuántos días de vacaciones me quedan disponibles?» y «¿Qué día cae mi próximo pago?». Mostrar la procedencia SQL y recargar el historial. Con accesos completos, preguntar «¿Con cuánta anticipación debo solicitar vacaciones?»; abrir una cita y señalar documento, sección, versión y enlace real. |
| 2:15–2:55 | Pregunta mixta: «¿Cuántos días me quedan y puedo acumularlos al próximo año?». Distinguir saldo SQL y política citada. Preguntar por vacaciones de otro colaborador y comprobar rechazo genérico. Si falta corpus/LLM, mostrar el fallo o respuesta parcial e indicar el bloqueo, sin simular una cita. |
| 2:55–4:10 | Cerrar sesión, ingresar con RRHH. Mostrar cuatro indicadores, dos gráficas, tendencia de 30 días, tabla de pendientes, ausencias por departamento, riesgo, temas, resumen e historial. Señalar claramente si el reporte es fixture o ejecución. Explicar worker de reportes 07:00 Costa Rica e ingesta independiente. |
| 4:10–4:40 | Mostrar hoja de 45 preguntas y resultados obtenidos. Distinguir aciertos, fallos, bloqueos y revisión humana; mencionar privacidad 21/22 y p90 RAG, sin atribuir los errores rápidos a rendimiento del RAG. |
| 4:40–5:00 | Logout y acceso privado rechazado. Cerrar con límites reales: fuentes académicas, dependencias externas, worker bajo supervisor y pendientes que indique PROGRESO. |

## Checklist de entrega

- README, `.env.example`, fuentes editables y lockfiles; sin secretos.
- Arquitectura, investigación legal de nueve páginas e informe técnico de 8–12 páginas.
- Hoja Excel/CSV de evaluación con 45 respuestas esperadas y obtenidas.
- Publicación de doce documentos, formatos nativos y PDF, sincronización repetida sin duplicados y cita abierta: **pendientes de escritura Google**.
- Chat RAG/mixto y resumen nuevo del analista: **pendientes de DeepSeek y corpus real**.
- Grabar video de cinco minutos después de comprobar esos accesos; no afirmar una grabación o aprobación que no existe.

Estado observado el 18-11-2026: autenticación, saldo, chat SQL e historial y dashboard fixture comprobados desde navegador; 61 pruebas unitarias, 13 de integración y ocho de navegador aprobadas. Banco real: 15 verificaciones automáticas aprobadas, cero fallidas y 30 bloqueadas; no acredita 80 %. Drive vacío y Qdrant cero puntos, embeddings Gemini reales correctos. Faltan escritora Drive y clave DeepSeek. Seguir [prompt para Gemini](PROMPT_GEMINI_ACCESOS.md).

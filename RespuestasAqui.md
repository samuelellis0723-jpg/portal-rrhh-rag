# Estado de Bosque Claro y cómo probarlo

Fecha de actualización: 18 de noviembre de 2026. Bosque Claro Servicios Digitales S.A. es una empresa ficticia; los 60 colaboradores y registros son simulados. Se conservaron credenciales locales y datos existentes. Este resumen separa pruebas con MySQL/servicios reales de lo que todavía está preparado o bloqueado.

## Qué funciona

- **Autenticación:** login con correo y contraseña verificada por scrypt, sesión opaca en cookie HttpOnly, restauración de sesión, CSRF, logout con revocación y roles colaborador/RRHH.
- **Datos personales por sesión:** saldo de vacaciones, próximo pago, próxima evaluación y solicitudes. Las consultas identifican a la persona por la sesión.
- **Chat:** preguntas de datos se resuelven con consultas SQL permitidas, se persisten en `consultas_chat` y se probaron desde navegador contra MySQL.
- **Reportes:** el backend expone historial y detalle para RRHH. El dashboard leyó un reporte `origen=fixture`; esto verifica autorización y lectura, no una generación analítica actual.
- **Frontend:** login, recuperación de sesión, chat, dashboard RRHH, saldo y formularios con estados de error. Build ejecutado y ocho pruebas de navegador en desktop/móvil aprobadas contra backend/MySQL reales.
- **Documentación:** 12 políticas/calendarios locales D01–D12, fuentes editables, exportaciones, informe de nueve páginas, publicador e ingesta preparados. El estado documental es simulación, sin aprobación legal o empresarial.

Endpoints principales (base `/api/v1`):

| Método | Ruta | Acceso |
|---|---|---|
| `POST` | `/auth/login` | Pública con origen permitido |
| `GET` | `/auth/session` | Sesión activa |
| `POST` | `/auth/logout` | Sesión activa y CSRF |
| `GET` | `/me/vacaciones` | Colaborador o RRHH, identidad de sesión |
| `GET` | `/me/proximo-pago` | Colaborador o RRHH, identidad de sesión |
| `GET` | `/me/proxima-evaluacion` | Colaborador o RRHH, identidad de sesión |
| `GET` | `/me/solicitudes` | Colaborador o RRHH, identidad de sesión |
| `POST` | `/chat` | Sesión activa y CSRF |
| `GET` | `/chat/historial` | Sesión activa, historial propio |
| `GET` | `/rrhh/reportes` | Solo RRHH; historial paginado persistido |
| `GET` | `/rrhh/reportes/:fecha` | Solo RRHH; detalle existente, no genera por GET |

## Verificación con servicios reales

Ocho pruebas de navegador cubrieron recorridos desktop y móvil: login, restauración de sesión, consulta de saldo, chat de datos SQL con persistencia y lectura del dashboard RRHH con fixture. La evaluación HTTP real de 45 preguntas terminó con 15 aprobadas automáticamente, cero fallidas y 30 bloqueadas; falta habilitar el corpus y DeepSeek para evaluar fidelidad y latencia del RAG.

Drive tiene acceso lector autorizado, pero la carpeta permitida contiene **0 archivos**. La sincronización inicial real de carpeta vacía completó sin crear documentos ni puntos. Gemini generó embeddings reales y Qdrant respondió en las comprobaciones. Esto verifica las dependencias, pero no acredita una búsqueda semántica documental porque aún no hay contenido indexado.

## Accesos que faltan y límites actuales

- Falta la credencial escritora `GOOGLE_PUBLISH_APPLICATION_CREDENTIALS`; por eso las 12 fuentes aún no se publicaron en Drive.
- Falta `DEEPSEEK_API_KEY`; las respuestas de políticas con cita y la redacción LLM del resumen diario no se han probado con proveedor real. El código debe fallar explícitamente sin esa clave; no usar un resumen de fallback como si fuera generado por LLM.
- El scheduler/worker está implementado para generar reportes a las 07:00 y ejecutar ingesta diaria independiente, pero **no está instalado como servicio ni activo como daemon**.
- Los registros históricos del dashboard son fixtures; no afirmar que fueron generados por el agente analista.

La guía [PROMPT_GEMINI_ACCESOS.md](docs/PROMPT_GEMINI_ACCESOS.md) indica cómo completar accesos sin compartir secretos. [PROGRESO.md](docs/PROGRESO.md) registra los estados comprobados. No pegues claves, cookies o contraseñas en documentación o conversaciones.

## Comandos para iniciar

Backend desde una terminal:

```bash
cd backend
npm start
```

Frontend desde otra terminal:

```bash
cd frontend
npm run dev
```

Abre <http://localhost:5173>. Para iniciar el worker en una tercera terminal, una vez se haya configurado el servicio de ejecución:

```bash
cd backend
npm run worker
```

El worker comprueba el horario `America/Costa_Rica`; al reiniciar recupera las tareas vencidas. No se ejecuta automáticamente si el proceso no está activo.

Verificaciones de frontend:

```bash
cd frontend
npm run build
npm run test:e2e
```

Pruebas de backend desde `backend/`:

```bash
npm test
npm run test:integration
```

Para las instrucciones de Postman y cuentas demo sin publicar contraseñas, consulta [docs/autenticacion-postman.md](docs/autenticacion-postman.md). Las contraseñas actuales se conservan en la configuración local privada; este archivo no las muestra.

## Cierre de verificaciones del 18-11-2026

- Backend: 61 pruebas unitarias y 13 de integración MySQL aprobadas, sin omisiones. Salud HTTP 200. Esquema: 14 modelos, 15 migraciones; fixtures y credenciales conservados.
- Frontend: build correcto y ocho pruebas de navegador de escritorio/móvil. Chat SQL e historial tras recarga, sesión, vacaciones, restricciones de rol y dashboard con reportes fixture.
- Banco real: 45 ejecutadas, 15 aprobadas automáticamente, cero fallidas, 30 bloqueadas. Privacidad 21/22: rechazo genérico sin datos. No se acredita el 80 % ni el p90 RAG; ver docs/evaluacion/README.md.
- Drive sigue vacío. Sync inicial e incremental reales sin duplicados en carpeta vacía; búsqueda española sin resultados. Publicación y citas reales requieren escritora Google. DeepSeek requiere DEEPSEEK_API_KEY.
- Worker probado brevemente: ingesta independiente correcta, reporte falla explícitamente por clave ausente, apagado SIGTERM. No queda daemon instalado.
- Instrucciones y prompt listo para Gemini: docs/PROMPT_GEMINI_ACCESOS.md. Registro para retomar: docs/PROGRESO.md. No se muestran secretos.

Entregables nuevos: `docs/arquitectura.md`, `docs/informe-tecnico.md`, HTML y PDF de 11 páginas; `docs/demo.md` con guion de cinco minutos; hoja de 45 preguntas en `docs/evaluacion/evaluacion-45.xlsx` y CSV. El video aún requiere grabación. El usuario confirmó que configurará los accesos siguiendo la guía con Gemini.

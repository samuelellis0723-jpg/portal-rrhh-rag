# Contrato API — Portal de RRHH Bosque Claro

**Versión:** 1.1 (chat con historial propio y reportes)  
**Base URL:** `/api/v1`  
**Stack previsto:** Node.js, Express, Sequelize, MySQL; React/Vite; Qdrant y Google Drive para RAG.  
**Zona de negocio:** `America/Costa_Rica` (Costa Rica).  
**Población:** 60 colaboradores 100% simulados, con ventana de datos simulados del 2026-08-18 al 2026-11-17 inclusive. Pagos y evaluaciones programados pueden tener fechas posteriores.

Este documento define la interfaz HTTP; no implica que las rutas estén implementadas. El backend es la autoridad de identidad y permisos. Nunca acepta del cliente un `colaborador_id` para determinar el dueño de una consulta personal.

## Rutas implementadas

`GET /health` (ruta completa `/api/v1/health`) es pública y comprueba la conexión a MySQL mediante Sequelize. Devuelve 200 con `{"data":{"status":"ok","database":"up"}}`; si falla la conexión, 503 con `error.code=DEPENDENCY_UNAVAILABLE` y `data={"status":"degraded","database":"down"}`. No muestra host, credenciales ni SQL.

También están implementados `POST /auth/login`, `GET /auth/session`, `POST /auth/logout`, `GET /me/vacaciones`, próximos pagos/evaluaciones y solicitudes propias, `POST /chat`, `GET /chat/historial` y lectura de reportes RRHH. Login incluye `expires_at` además de los campos del ejemplo. El límite inicial es de diez peticiones de login por IP de conexión cada quince minutos, incluyendo intentos correctos y entradas inválidas tras validar el origen. El contador reside en memoria por proceso; varias réplicas requieren un limitador compartido. Las rutas de reportes exigen rol RRHH. El chat de políticas y la generación de resúmenes requieren los accesos externos documentados; una ruta implementada no acredita una respuesta real del LLM si falta la clave. Guía de prueba: [Postman](autenticacion-postman.md).

## Convenciones

- JSON UTF-8. Todas las respuestas exitosas tienen `Content-Type: application/json` salvo `204`.
- Los IDs de entidades son enteros JSON, nunca cadenas numéricas.
- Fechas de negocio se expresan como `YYYY-MM-DD` en calendario de Costa Rica. Instantes técnicos se expresan en UTC ISO 8601, por ejemplo `2026-11-17T14:20:00Z`.
- Un error usa la forma común `{"error":{"code":"...","message":"...","details":{}}}`. `details` puede omitirse; no contiene datos personales ni existencia de registros ajenos.
- Paginación: `limit` opcional (predeterminado 20, máximo 100) y `offset` opcional (predeterminado 0, entero no negativo). Las colecciones incluyen `items`, `limit`, `offset`, `total`.
- Se rechazan campos no definidos, IDs no enteros, fechas inválidas y tipos incorrectos con `400 VALIDATION_ERROR`. Límites: `mensaje` de 1 a 4000 caracteres, luego de quitar espacios al inicio y final.
- Acceso personal siempre deriva `colaboradores.id` de la sesión autenticada. El payload no puede elegir persona ni elevar rol. El rol fuente única es `colaboradores.rol` (`colaborador` o `rrhh`), no se duplica en `usuarios`.

## Sesión, autenticación y CSRF

Duración inicial de sesión: ocho horas, sin renovación silenciosa. La sesión es opaca: el navegador recibe un token aleatorio en cookie `HttpOnly`; MySQL almacena únicamente su hash SHA-256 (64 caracteres hexadecimales). El token no se devuelve en JSON. En producción la cookie lleva `Secure`, además de `SameSite=Lax`, `Path=/`, y expiración acorde a `expires_at`. El backend invalida sesión en logout y vencimiento.

Login requiere `Origin` permitido y `Content-Type: application/json`; no acepta credenciales por query string, formularios ni cuerpos de otro tipo. La lista de orígenes permitidos es configuración del servidor. Las mutaciones autenticadas exigen `Origin` permitido, cookie de sesión y `X-CSRF-Token`. El token CSRF se deriva de forma estable por sesión con HMAC-SHA-256 usando un secreto de servidor y el token opaco como entrada; se conserva en la base solo su hash y se devuelve solo en login/session. Así session puede volver a entregarlo sin invertir el hash ni invalidar otras pestañas. Se compara en tiempo constante. Login aplica limitación de intentos; respuestas de credenciales inválidas no revelan si existe email o usuario.

### `POST /auth/login`

Pública. Encabezados requeridos: `Origin`, `Content-Type: application/json`.

```json
{"email":"ana.ejemplo@bosqueclaro.example","password":"contraseña-de-ejemplo"}
```

`200 OK`, configura cookie de sesión:

```json
{
  "data": {
    "usuario": {"id": 14, "colaborador_id": 8, "email": "ana.ejemplo@bosqueclaro.example"},
    "colaborador": {"id": 8, "nombre": "Ana Ejemplo", "rol": "colaborador"},
    "csrf_token": "<token-csrf-aleatorio>"
  }
}
```

No devolver `password_hash`, hash de sesión ni token de sesión. `400 VALIDATION_ERROR`; `401 INVALID_CREDENTIALS` (mensaje genérico); `403 ORIGIN_NOT_ALLOWED`; `415 UNSUPPORTED_MEDIA_TYPE`; `429 RATE_LIMITED`.

### `GET /auth/session`

Requiere cookie válida. Permite restaurar la sesión al cargar la aplicación y recuperar el token CSRF vigente.

```json
{
  "data": {
    "usuario": {"id": 14, "colaborador_id": 8, "email": "ana.ejemplo@bosqueclaro.example"},
    "colaborador": {"id": 8, "nombre": "Ana Ejemplo", "rol": "colaborador"},
    "csrf_token": "<token-csrf-aleatorio>",
    "expires_at": "2026-11-17T22:20:00Z"
  }
}
```

`401 UNAUTHENTICATED` si no hay sesión válida. La respuesta no incluye atributos adicionales del colaborador.

### `POST /auth/logout`

Autenticada y protegida por CSRF. Revoca la sesión actual y limpia la cookie. `204 No Content`. `401 UNAUTHENTICATED`, `403 CSRF_INVALID` o `403 ORIGIN_NOT_ALLOWED` según corresponda.

## Chat RAG

### `POST /chat`

Autenticada y protegida por CSRF. El cuerpo admite exclusivamente `mensaje`; no permite identidad, rol, SQL, selección de agentes ni herramientas. Cada petición válida crea una fila de `consultas_chat` de origen ejecución. Hay una conversación lógica por colaborador, sin `conversacion_id` elegido por el cliente. La respuesta estructurada se persiste en `respuesta_json` mediante la migración 15.

```json
{"mensaje":"¿Qué indica la política sobre solicitar vacaciones?"}
```

`200 OK`, consulta de política respondida con evidencia recuperada:

```json
{
  "data": {
    "consulta_id": 301,
    "intencion": "politica",
    "respuesta": "La política disponible establece ...",
    "estado": "respondida",
    "citas": [
      {
        "documento": "D01 — Política de vacaciones",
        "seccion": "Solicitud y aprobación",
        "version": "0.1",
        "drive_file_id": "<ID_DRIVE_PENDIENTE>",
        "fragmento_id": "<ID_FRAGMENTO_RECUPERADO>",
        "enlace": "<ENLACE_DRIVE_PENDIENTE_DE_VERIFICAR>",
        "fragmento": "<extracto del fragmento recuperado>"
      }
    ],
    "creada_en": "2026-11-17T14:20:00Z"
  }
}
```

`<ENLACE_DRIVE_PENDIENTE_DE_VERIFICAR>` es un marcador explícito, no un enlace real comprobado. En ejecución debe reemplazarse con la URL verificada del documento citado. No se inventan título, sección, enlace, regla laboral ni contenido documental. Si no se recupera evidencia suficiente, responder con abstención y escalamiento, sin cita ficticia:

```json
{
  "data": {
    "consulta_id": 302,
    "intencion": "politica",
    "respuesta": "No encontré información suficiente sobre el bono por mascotas en los documentos disponibles. Puedes consultar a RRHH.",
    "estado": "sin_respaldo",
    "citas": [],
    "escalada": true,
    "creada_en": "2026-11-17T14:21:00Z"
  }
}
```

Dato personal exacto, resuelto por SQL con identidad de sesión:

```json
{
  "data": {
    "consulta_id": 303,
    "intencion": "dato_personal",
    "respuesta": "Tu saldo disponible es 8 días al 2026-11-17.",
    "estado": "respondida",
    "citas": [],
    "dato_personal": {"tipo": "saldo_vacaciones", "dias_disponibles": "8.00", "fecha_corte": "2026-11-17"},
    "creada_en": "2026-11-17T14:22:00Z"
  }
}
```

Consulta mixta: cada parte conserva su fuente y la respuesta no infiere una de la otra.

```json
{
  "data": {
    "consulta_id": 304,
    "intencion": "mixta",
    "respuesta": "Tienes 8 días disponibles. Sobre trasladarlos al próximo año, la política recuperada indica ...",
    "estado": "respondida",
    "citas": [{"documento":"D01 — Política de vacaciones","seccion":"Acumulación","version":"0.1","drive_file_id":"<ID_DRIVE_PENDIENTE>","fragmento_id":"<ID_FRAGMENTO_RECUPERADO>","enlace":"<ENLACE_DRIVE_PENDIENTE_DE_VERIFICAR>"}],
    "dato_personal": {"tipo":"saldo_vacaciones","dias_disponibles":"8.00","fecha_corte":"2026-11-17"},
    "creada_en":"2026-11-17T14:23:00Z"
  }
}
```

Solicitud de datos de otra persona (por ejemplo, vacaciones de un compañero): `403 FORBIDDEN`, cuerpo genérico `{"error":{"code":"FORBIDDEN","message":"No tienes permiso para consultar este recurso."}}`. No confirmar ni negar si la persona o el dato existen. El rol RRHH del MVP solo permite reportes agregados; tampoco habilita acceso a chat personal de terceros.

`400 VALIDATION_ERROR`; `401 UNAUTHENTICATED`; `403 CSRF_INVALID` / `ORIGIN_NOT_ALLOWED` / `FORBIDDEN`; `429 RATE_LIMITED`; `503 DEPENDENCY_UNAVAILABLE` si LLM, Qdrant o la fuente de datos requerida no está disponible. No responder con cifras o políticas de relleno si falla una dependencia.

### `GET /chat/historial`

Autenticada. Parámetros únicos: `limit` (20 por defecto, máximo 100) y `offset` (0 por defecto). El servidor deriva el colaborador exclusivamente de la sesión y devuelve `data:{items,limit,offset,total}`. Los elementos se ordenan por `creada_en DESC, consulta_id DESC` y contienen `consulta_id`, `mensaje`, `intencion`, `respuesta`, `estado`, `citas`, `escalada`, `creada_en` y, cuando corresponda, `dato_personal`, `partes` y `reporte`. No se devuelven filas de otros colaboradores ni de origen fixture, hashes o registros internos de ejecución.

Las respuestas rechazadas usan un mensaje genérico. Las consultas con fallo de servicio se conservan con estado `error` y mensaje recuperable; no se presentan como contestadas. La interfaz invierte la página para mostrar los turnos en orden de lectura. `401 UNAUTHENTICATED`, `400 VALIDATION_ERROR`, `503 DEPENDENCY_UNAVAILABLE`.

### Enrutamiento y dependencias del chat

Las guardias de privacidad y permisos se ejecutan antes de DeepSeek. Las consultas inequívocas de datos propios, reportes permitidos y solicitudes claramente fuera del ámbito pueden resolverse por reglas del servidor; la traza indica `metodo:regla_permitida`. Las demás intenciones se clasifican con DeepSeek. Gemini se conserva exclusivamente como proveedor de embeddings; sus credenciales no se reutilizan como clave DeepSeek.

Las intenciones públicas son `politica`, `dato_personal`, `mixta`, `reporte`, `restringida` y `fuera_de_alcance`. El resultado del clasificador no puede elegir identidad, rol, SQL ni herramientas. El límite inicial de chat es de 30 envíos por usuario por minuto, con 429 y Retry-After; se configura mediante `CHAT_RATE_LIMIT_PER_MINUTE`.

En respuestas mixtas se ejecutan las ramas permitidas de datos y políticas. Si ambas responden, `estado=respondida`; si solo una entrega información, `estado=parcial`, `escalada=true` y `partes` describe `respondida`, `no_disponible` o `sin_respaldo` para cada rama. Una parte ausente nunca se rellena. Si no se obtiene ninguna parte requerida por fallos de dependencia, se devuelve 503.

Una respuesta de política válida exige citas de fragmentos recuperados y enlaces Google cuyo ID coincida; no se aceptan referencias inventadas por el LLM. `POLICY_MIN_SCORE` define un umbral inicial configurable, que todavía requiere calibración con recuperación real. La presencia de números en la evidencia es un control adicional, no una prueba automática de fidelidad semántica.

## Consultas personales SQL

Las tres rutas requieren sesión válida. No aceptan `colaborador_id` ni parámetros de identidad.

### `GET /me/vacaciones`

Devuelve los períodos del colaborador autenticado, ordenados por `periodo_inicio` descendente.

```json
{
  "data": {
    "items": [{"id": 71,"periodo_inicio":"2026-01-01","periodo_fin":"2026-12-31","dias_asignados":"14.00","dias_tomados":"6.00","dias_disponibles":"8.00"}],
    "limit": 20, "offset": 0, "total": 1, "total_dias_disponibles": "8.00"
  }
}
```

### `GET /me/proximo-pago`

Retorna el registro `pagos` con la fecha más cercana igual o posterior a hoy en Costa Rica y estado `programado` o `confirmado`. `200` con `{"data":null}` cuando no hay un pago elegible; no estima fechas. En empates de fecha, seleccionar `id` ascendente.

```json
{"data":{"id":901,"fecha_pago":"2026-11-30","tipo":"salario","periodo_inicio":"2026-11-01","periodo_fin":"2026-11-15","monto":"650000.00","moneda":"CRC","estado":"programado"}}
```

El ejemplo no afirma una fecha real de pago; los datos son de muestra. Se selecciona el registro con la fecha más cercana mayor o igual a la fecha de hoy en Costa Rica y estado `programado` o `confirmado`. Los campos decimales, incluido `monto`, se serializan como cadenas decimales para evitar pérdida de precisión. El campo `monto` es obligatorio y no nulo en el modelo; este ejemplo usa una cifra 100 % simulada.

### `GET /me/proxima-evaluacion`

Retorna la evaluación de estado `programada` con menor `fecha_programada` igual o posterior a la fecha actual de Costa Rica. `200` con `{"data":null}` si no existe. En empates de fecha, seleccionar `id` ascendente.

```json
{"data":{"id":22,"fecha_programada":"2026-12-10","tipo":"desempeno","estado":"programada"}}
```

### `GET /me/solicitudes`

Autenticada. Devuelve `data:{items,limit,offset,total}` con solicitudes propias ordenadas por creación descendente e ID descendente. Usa la paginación estándar y rechaza parámetros de identidad. Cada elemento contiene únicamente ID, tipo, fechas, estado y timestamps operativos. Una referencia natural ambigua como “el viernes” requiere aclarar la fecha; no se asume un registro ni un estado.

## Reportes de RRHH

Estas rutas requieren sesión cuyo rol en `colaboradores` sea `rrhh`. El MVP expone agregados y datos operativos mínimos de solicitudes y riesgo de vacaciones; los IDs de colaboradores en este reporte son visibles solo para RRHH. No expone salarios ajenos, nombres ni respuestas a consultas personales de terceros. Las lecturas GET nunca disparan generación; una fecha sin reporte retorna `404`. La generación y actualización manual se realizan únicamente mediante `POST /rrhh/reportes/generar` con validación `Origin` + CSRF y bloqueo por fecha compartido con el worker automático de las 07:00 `America/Costa_Rica`.

### `GET /rrhh/reportes`

Historial paginado, ordenado por `fecha` descendente. Parámetros: `limit`, `offset`.

```json
{
  "data": {
    "items": [
      {"id": 801,"fecha":"2026-11-17","origen":"ejecucion","esquema_version":1,"generado_por":"agente_analista","generado_en":"2026-11-17T13:00:00Z","resumen_texto":"<resumen ejecutivo de 3 a 5 frases>"}
    ],
    "limit": 20,"offset": 0,"total": 31
  }
}
```

### `POST /rrhh/reportes/generar`

Requiere sesión con rol `rrhh`, origen permitido (`Origin`) y token CSRF (`X-CSRF-Token`). Usa siempre la fecha actual de Costa Rica (`America/Costa_Rica`), coordinada mediante bloqueo `GET_LOCK` en MySQL para evitar duplicados con el worker de las 07:00 a. m. Cuerpo JSON opcional: `{ "actualizar": false | true }` (rechaza cualquier otro campo o parámetro de query con `400 VALIDATION_ERROR`).

- Si no existe reporte para hoy: lo genera, lo persiste en MySQL y responde `201 Created` con el detalle completo del reporte y `estado_generacion: "created"`.
- Si ya existe reporte para hoy y `actualizar` es `false` (u omitido): responde `200 OK` con el reporte existente y `estado_generacion: "exists"`.
- Si ya existe reporte para hoy y `actualizar` es `true`: recalcula las cifras y el resumen; si el proveedor LLM falla, conserva el reporte anterior sin sobrescribirlo y responde `503 DEPENDENCY_UNAVAILABLE`. Si tiene éxito, actualiza el registro de hoy y responde `200 OK` con `estado_generacion: "updated"`.
- Si hay otra generación en curso para la fecha de hoy: responde `409 REPORT_GENERATION_IN_PROGRESS`.

### `GET /rrhh/reportes/:fecha`

`:fecha` debe ser fecha ISO de Costa Rica (`YYYY-MM-DD`). Devuelve el reporte ya persistido en `reportes_diarios.datos_json` y `resumen_texto`. La clave `datos` siempre contiene los ocho componentes mínimos:

```json
{
  "data": {
    "id": 801,
    "fecha": "2026-11-17",
    "generado_en": "2026-11-17T13:00:00Z",
    "generado_por": "agente_analista",
    "origen": "ejecucion",
    "esquema_version": 1,
    "datos": {
      "ausencias": {"fecha":"2026-11-17","total":0,"por_tipo":{"vacaciones":0,"permiso":0,"incapacidad":0},"por_departamento":[]},
      "solicitudes_pendientes": {"total":0,"mas_de_3_dias":0,"items":[]},
      "incapacidades": {"activas":0,"dias_acumulados_mes":0},
      "movimientos_personal": {"ingresos_mes":0,"salidas_mes":0,"rotacion_acumulada_pct":null,"dotacion_inicio_mes":0,"dotacion_corte":0,"formula":"salidas_mes / ((dotacion_inicio_mes + dotacion_corte) / 2) * 100"},
      "riesgo_vacaciones": {"umbral_dias":20,"total_colaboradores":0,"por_departamento":[],"items":[]},
      "uso_chatbot": {"consultas_dia_anterior":0,"resueltas_sin_escalar_pct":null,"latencia_promedio_ms":null,"tendencia_30_dias":[{"fecha":"2026-10-18","consultas":0}]},
      "temas_chatbot": {"top_5":[],"sin_respuesta":[]},
      "resumen_ejecutivo": "<3 a 5 frases redactadas únicamente a partir de estas cifras>"
    },
    "resumen_texto": "<el mismo resumen persistido para lectura directa>"
  }
}
```

El ejemplo del reporte abrevia `tendencia_30_dias` a una fila por legibilidad; la respuesta real debe contener las 30 fechas. Todos los valores del ejemplo son ilustrativos, no resultados de investigación ni de una base creada.

Definiciones de elementos: cada elemento de `por_departamento` es `{ "departamento": "...", "total": 0 }`; cada solicitud es `{ "id": 1, "tipo": "vacaciones", "departamento": "...", "fecha_inicio": "YYYY-MM-DD", "fecha_fin": "YYYY-MM-DD", "creada_en": "UTC ISO-8601", "dias_pendiente": 0 }`. Los temas son `{ "tema": "...", "consultas": 0 }`; `sin_respuesta` contiene preguntas anonimizadas `{ "pregunta": "...", "consultas": 0 }`, sin email ni identificador personal. Cada `riesgo_vacaciones.items` es `{ "colaborador_id": 8, "departamento": "Ingeniería", "dias_disponibles": "24.00" }`, sin nombres. `uso_chatbot.tendencia_30_dias` contiene exactamente 30 filas `{ "fecha": "YYYY-MM-DD", "consultas": 0 }`, desde fecha del reporte menos 30 días hasta el día anterior; los ceros se usan solo cuando SQL confirma que no hubo consultas. Cada elemento de `ausencias.por_departamento` incluye además `por_tipo` con vacaciones, permiso e incapacidad. Para personas con intervalos superpuestos, total cuenta personas distintas; los conteos por tipo pueden solaparse. Los campos `DECIMAL` se representan como cadenas JSON.

Valores desconocidos no se sustituyen por cero: usan `null` y pueden incluir `disponible:false` dentro del componente. Si el reporte no existe, responde `404 NOT_FOUND`. Solo se publican reportes completos; un reporte no generado responde 404. Un fallo de MySQL al leer responde `503 DEPENDENCY_UNAVAILABLE`. Un reporte persistido puede leerse aunque IA, Drive o Qdrant estén caídos; el GET nunca calcula ni fabrica una respuesta alternativa.

### `GET /rrhh/reportes-mensuales`

Requiere sesión con rol `rrhh`. Devuelve los tres meses completos consecutivos disponibles (`2026-10`, `2026-09`, `2026-08`) con su `etiqueta`, `fecha_inicio`, `fecha_fin` y `mes_por_defecto` (`"2026-10"`).

### `GET /rrhh/reportes-mensuales/:mes`

Requiere sesión con rol `rrhh`. `:mes` debe tener formato `YYYY-MM` (`400 VALIDATION_ERROR` si es inválido, `404 NOT_FOUND` si el mes no está disponible). Calcula desde MySQL para `[fecha_inicio, fecha_fin]` en `America/Costa_Rica`:
- `asistencia`: `dias_programados`, `dias_trabajados` (`puntual + tardia`), `dias_puntuales`, `tardias`, `minutos_tardia_total`, `promedio_minutos_tardia`, `faltas`, `ausencias_justificadas: { total, vacaciones, permiso, incapacidad }`, `dias_libres`, `sin_registro`, `porcentaje_asistencia` y `porcentaje_puntualidad` con sus fórmulas explícitas (`formula_porcentaje_asistencia`, `formula_porcentaje_puntualidad`).
- `solicitudes`: `total`, `por_estado: { aprobada, pendiente, rechazada }`, `por_tipo: { vacaciones, permiso }`, `dias_solicitados_en_mes` y `nota_conteo` (distinguiendo número de solicitudes de días dentro del mes).
- `incapacidades`: `total_registros`, `dias_en_mes` y `nota_conteo`.
- `movimientos_personal`: `total`, `ingresos`, `salidas`, `ascensos` e `items` (sin salarios).

### `GET /rrhh/colaboradores/:id/ficha`

Requiere sesión con rol `rrhh`. `:id` debe ser entero positivo; parámetro de query opcional `mes=YYYY-MM` (por defecto el mes completo más reciente, `2026-10`). Rechaza cualquier otro parámetro de query o cuerpo con `400 VALIDATION_ERROR`; devuelve `404 NOT_FOUND` si el colaborador o el mes no existen.
Devuelve:
- `colaborador`: `{ id, nombre, departamento, puesto, estado, fecha_ingreso, fecha_salida }` (sin salarios, diagnósticos médicos ni conversaciones privadas).
- `meses_disponibles` y `periodo` (`mes`, `etiqueta`, `fecha_inicio`, `fecha_fin`, `zona_horaria: "America/Costa_Rica"`).
- `resumen`: `dias_programados`, `dias_trabajados`, `dias_puntuales`, `tardias`, `minutos_tardia_total`, `faltas`, `ausencias_justificadas`, `dias_libres`, `sin_registro`.
- `registro_diario`: lista día por día dentro de la vigencia de empleo con `fecha`, `es_dia_programado`, `estado` (`puntual`, `tardia`, `falta`, `vacaciones`, `permiso`, `incapacidad`, `dia_libre`, `sin_registro`), `hora_entrada_programada`, `hora_entrada_real`, `minutos_tardia` y `origen`.
- `solicitudes`, `incapacidades` (sin diagnósticos) y `movimientos_personal` del período.

## Códigos HTTP comunes

| HTTP | Código | Uso |
|---|---|---|
| `400` | `VALIDATION_ERROR` | JSON, fecha, parámetro o campo inválido |
| `401` | `UNAUTHENTICATED` / `INVALID_CREDENTIALS` | Sesión inválida o login no válido |
| `403` | `FORBIDDEN` / `CSRF_INVALID` / `ORIGIN_NOT_ALLOWED` | Autorización, CSRF u origen |
| `404` | `NOT_FOUND` | Recurso propio inexistente o reporte no disponible para esa fecha |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | Login/chat con tipo de contenido no admitido |
| `429` | `RATE_LIMITED` | Límite de intentos o consultas |
| `503` | `DEPENDENCY_UNAVAILABLE` | MySQL, Qdrant, Drive/índice o proveedor LLM requerido no disponible |

## Reglas adicionales para implementación

- El alias API `usuario.email` se obtiene de `colaboradores.correo`; `expires_at` se obtiene de `sesiones.expira_en`. No duplicar correo ni rol en usuarios.
- `GET /me/vacaciones` admite `limit`/`offset` y agrega `total_dias_disponibles` de todos los períodos del usuario, independientemente de la página. Si no hay períodos: `items: []`, `total: 0`, suma `"0.00"`. La suma usa DECIMAL y se serializa como cadena.
- Los números de días de ejemplos son datos simulados, no una afirmación de mínimos legales. Los tipos de pagos válidos son `salario|aguinaldo|otro`; los estados de evaluación son `programada|completada|cancelada`.
- `POST /chat` también devuelve `escalada` booleano en todas las respuestas exitosas (predeterminado false). Significa ofrecimiento de derivación a RRHH, no creación de un ticket. No hay un sistema de tickets implementado.
- Intención fuera de alcance: 200 con `intencion: "fuera_de_alcance"`, `estado: "fuera_de_alcance"`, `citas: []` y una redirección breve a RRHH. Las preguntas restringidas devuelven 403 y registran rechazo sin consultar datos ajenos.
- Intención `reporte`: solo rol RRHH; leer el reporte ya publicado para la fecha solicitada (hoy si se omite), devolver `consulta_id`, `respuesta` basada en su JSON, `estado`, `citas: []`, `escalada: false` y `reporte: { "fecha": "YYYY-MM-DD", "url": "/api/v1/rrhh/reportes/YYYY-MM-DD" }`. Aplicar los mismos 403/404/503 del endpoint de reportes; el chat tampoco dispara generación.
- Si una rama de una consulta mixta falla después de obtener la otra: 200 con `estado: "parcial"`, `escalada: true` y `partes: { "datos": "respondida", "politicas": "no_disponible" }` (o al revés). Devolver solo el dato obtenido y sus fuentes, explicar la limitación; nunca completar una política sin cita. Si no se obtiene ninguna parte, 503; si solo falta evidencia documental con servicios operativos, `sin_respaldo`.
- Los ejemplos abreviados omiten `escalada: false` por legibilidad. Todo dato de políticas respondido requiere citas con `documento`, `seccion`, `version`, `drive_file_id`, `fragmento_id` y `enlace` real. El campo `fragmento` es opcional; nunca incluye otros datos personales.
- La memoria conversacional recupera como máximo cinco consultas recientes del mismo colaborador, con origen ejecución e ID anterior al turno actual. Los fixtures nunca son memoria. Los seguimientos de datos propios se resuelven a consultas permitidas usando la sesión; las respuestas personales o mixtas no se envían al agente de políticas. Las políticas pueden usar contexto previo de política como datos no confiables, pero la evidencia de una respuesta siempre son los fragmentos recuperados para el turno actual.
- Para estadísticas del reporte, corte a las 07:00 de su fecha CR. Ausencias usan intervalos inclusivos de ese día; pendientes se evalúan al corte usando `creada_en` y `resuelta_en`; antigüedad mayor de tres días equivale a más de 72 horas. Incapacidades acumulan solo días solapados entre inicio de mes y fecha del reporte. La rotación usa la fórmula publicada y devuelve null si la dotación media es cero.
- Chat del día anterior usa el intervalo local [00:00, 00:00 del día siguiente). Porcentaje resuelto = consultas resueltas y no escaladas / total * 100. Sin consultas, porcentaje y latencia son null. Top 5 usa `consultas_chat.tema`; preguntas sin respuesta se anonimizan antes de incluirlas.
- `resumen_ejecutivo` y `resumen_texto` son iguales y tienen de tres a cinco frases; los números provienen del JSON. Los reportes seed llevan `origen: "fixture"`; solo una ejecución real del analista usa `origen: "ejecucion"`. El frontend muestra ese origen.
- Toda respuesta autenticada y todo error de sesión usan `Cache-Control: no-store`. CORS permite solo orígenes configurados y credenciales; nunca `*` con cookies. Para desarrollo, preferir proxy Vite hacia Express y mismo origen. HTTPS y cookie Secure en despliegue.
- La autenticación verifica usuario y colaborador activos en cada solicitud. Los campos no definidos como `colaborador_id` o `rol` en cuerpos/query producen 400; una solicitud de datos ajenos en lenguaje natural produce el 403 genérico ya definido. El cuerpo de chat tampoco puede seleccionar agentes ni herramientas.
- El agente de políticas no consulta Drive en cada chat: usa el índice sincronizado. Drive caído no impide usar un índice ya válido; índice ausente o dependencias requeridas caídas producen 503. Un 503 de chat se registra como fallo operativo, no como respuesta exitosa.

Se registran `consultas_chat` y `agent_execution_logs` para analítica y diagnóstico con acceso restringido. No se escriben contraseñas, cookies, tokens CSRF, token de sesión ni datos personales innecesarios en logs. Las consultas/reporte quedan sujetas al aviso de privacidad y retención que el equipo documente.

## Eliminación de la conversación propia

### `DELETE /chat/historial`

Requiere sesión activa, `Origin` autorizado y `X-CSRF-Token`, igual que `POST /chat`. Sin cuerpo ni parámetros de consulta: rechaza IDs, correos o roles enviados por el cliente. La única conversación del MVP comprende todo el historial `origen=ejecucion` del colaborador de sesión; también RRHH solo puede eliminar el suyo. No existe ruta para borrar conversaciones ajenas.

Devuelve `200` con `{"data":{"eliminadas":12}}`; repetir devuelve cero y no duplica métricas. La interfaz solicita confirmación y permite cancelar sin hacer la petición. La operación serializa envíos y borrados de esa cuenta mediante bloqueo MySQL; en una transacción acumula métricas y elimina preguntas, respuestas JSON, citas y logs de agentes vinculados. El historial y la memoria dejan de contener los mensajes, también tras recargar o abrir otra sesión. Un timeout del bloqueo devuelve `409 CHAT_BUSY` y permite reintentar.

Solo se conserva `chat_metricas_eliminadas`: fecha de Costa Rica, tema controlado, conteo de consultas, resueltas sin escalamiento, sin respuesta, suma de latencias y cantidad de latencias. No contiene identidad, texto, citas, hora individual ni enlaces a mensajes. Los reportes publicados se conservan; los nuevos agregan esas métricas a las consultas restantes para mantener totales, tendencias y promedios. Los fixtures no forman parte del historial ni se eliminan.

Los saludos aislados devuelven `intencion=saludo`, `estado=respondida`, sin citas y sin invocar LLM ni búsqueda documental. Un saludo acompañado de una pregunta sigue las reglas de la pregunta. Las consultas de próximos feriados usan fecha de `America/Costa_Rica` y exclusivamente filas del calendario publicado; si no hay cobertura suficiente se explica la limitación.

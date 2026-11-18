# Políticas e ingesta de Google Drive a Qdrant

## Estado comprobado de los accesos

Inspección de esta etapa, 2026-11-17, sin imprimir valores secretos:

| Recurso | Resultado comprobado |
|---|---|
| Corpus local anterior | Existían el plan de Semana 1 y diseños; no existían las doce políticas redactadas. |
| Corpus local actual | Doce documentos D01–D12 y sus exportaciones, detallados en `politicas/manifest.json`. |
| Documentos ya existentes en Drive | No se pudo inspeccionar: no hay ID de carpeta ni credencial de lectura configurados. No se afirma que Drive esté vacío. |
| Drive API | `GOOGLE_DRIVE_FOLDER_ID` y `GOOGLE_APPLICATION_CREDENTIALS` ausentes; tampoco se encontró ADC local estándar. |
| Conector de Google Drive de la sesión | No estaba conectado al comprobarlo. La conexión puede ayudar a inspeccionar/publicar, pero no suministra por sí sola credenciales al proceso Node. |
| Embeddings | No hay proveedor, modelo, dimensión ni API key configurados en `AI_*`, `INGEST_*` ni claves OpenAI/Gemini del entorno inspeccionado. No se generaron embeddings reales. |
| Qdrant | No hay URL/API key configuradas. La comprobación fuera del aislamiento en `127.0.0.1:6333` devolvió `ECONNREFUSED`. |
| MySQL | Disponible: se verificaron persistencia de cursor, catálogo y exclusión mutua con conexiones reales. Las filas sintéticas de prueba se eliminaron al terminar. |

El código está preparado y tiene pruebas con adaptadores controlados. No se presenta una prueba con dobles como sincronización de Drive real ni como búsqueda semántica real. La autenticación y el frontend existentes conservan sus credenciales.

## Documentos preparados

| ID | Documento | Destino |
|---|---|---|
| D01 | Política de vacaciones | Google Docs |
| D02 | Calendario de feriados de Costa Rica 2026 | Google Sheets |
| D03 | Política de permisos y licencias | Google Docs |
| D04 | Procedimiento de incapacidades | PDF |
| D05 | Jornada, asistencia y teletrabajo | Google Docs |
| D06 | Política salarial y de planilla | Google Docs |
| D07 | Calendario de pagos y obligaciones 2026 | Google Sheets |
| D08 | Catálogo de beneficios | Google Docs |
| D09 | Ingreso y procedimiento de salida | Google Docs |
| D10 | Evaluación del desempeño y desarrollo | Google Docs |
| D11 | Conducta y protocolo de denuncias | Google Docs |
| D12 | Aviso de privacidad | Google Docs |

Las fuentes Markdown y CSV están en `docs/politicas/`. Las nueve exportaciones HTML son importables como documentos nativos de Google; los dos CSV son importables como hojas nativas. El PDF de D04 es un binario real con texto extraíble, generado desde HTML editable. HTML y CSV locales **todavía no son documentos nativos alojados en Google Drive**: falta importarlos con acceso de escritura. El manifiesto no contiene IDs ni enlaces de Drive inventados.

Las políticas identifican empresa ficticia, versión 0.1, responsable, fecha de preparación y secciones. Distinguen obligaciones con referencias oficiales de propuestas administrativas y beneficios hipotéticos. `preparado_simulacion` significa elegible para el corpus académico; no aprobación jurídica ni adopción empresarial. La investigación y sus referencias están en [investigacion-politicas.md](investigacion-politicas.md). El plan de Semana 1 se conserva como antecedente.

## Obtener y configurar Drive

1. Usar un proyecto de [Google Cloud Console](https://console.cloud.google.com/) y habilitar **Google Drive API** en APIs y servicios → Biblioteca. El proyecto puede ser el usado anteriormente; no crear otro si ya existe uno adecuado.
2. Crear o identificar una carpeta exclusiva de políticas. Copiar el ID desde su enlace `/drive/folders/ID` y añadir `GOOGLE_DRIVE_FOLDER_ID=ID` al **archivo existente** `backend/.env`. No sobrescribir su contenido ni cambiar las credenciales MySQL/demo.
3. Para el agente lector, crear una cuenta de servicio en IAM y administración → Cuentas de servicio, o usar una identidad ADC ya autorizada. Compartir **solo esa carpeta** con el correo de la cuenta lectora y permiso de lector. Habilitar una API en el proyecto no equivale a compartir los archivos.
4. Si la política de la organización permite una clave JSON de servicio: en esa cuenta → Claves → Añadir clave → Crear nueva clave → JSON. Conservar el archivo fuera del repositorio, con permisos restringidos, y configurar `GOOGLE_APPLICATION_CREDENTIALS=/ruta/privada/lector-drive.json`. No pegar el JSON en el chat ni en variables `VITE_*`. En despliegue se prefiere una identidad administrada o mecanismo ADC sin clave descargable cuando esté disponible.
5. Alternativamente, usar [Application Default Credentials](https://docs.cloud.google.com/docs/authentication/provide-credentials-adc) de un usuario OAuth con acceso a la carpeta y scope `https://www.googleapis.com/auth/drive.readonly`. Un archivo `authorized_user` ADC no es lo mismo que el JSON descargado de un cliente OAuth: necesita autorización inicial y refresh token. La biblioteca `google-auth-library` puede utilizar ADC sin `GOOGLE_APPLICATION_CREDENTIALS` cuando ya esté configurado.

El agente solicita solo `drive.readonly`. No cambia permisos, no sigue accesos directos, no lee cuerpos fuera de la carpeta y no recorre subcarpetas: colocar los doce documentos como hijos directos. Los metadatos de `changes.list` pueden incluir archivos ajenos; se filtran antes de descargar contenido. El catálogo de esta versión está diseñado para una única carpeta autorizada, no para múltiples clientes o carpetas independientes.

Para publicar los documentos, se requiere una identidad escritora distinta. Configurar su ruta en `GOOGLE_PUBLISH_APPLICATION_CREDENTIALS`; el agente lector nunca utiliza esa variable. En una unidad compartida, una cuenta de servicio con permisos adecuados puede crear archivos. Para Mi unidad personal, usar OAuth de un usuario con almacenamiento: las cuentas de servicio no tienen cuota propia para ser propietarias de archivos personales. No convertir la carpeta en pública para resolver permisos.

## Publicar e inspeccionar el corpus

Desde `backend/`:

```bash
npm run policies:plan
npm run policies:inspect
npm run policies:publish
```

`policies:plan` valida los doce artefactos locales sin hacer solicitudes de red. `inspect` usa lectura para enumerar únicamente los hijos directos de la carpeta. `publish` usa la credencial escritora, convierte HTML a Google Docs y CSV a Google Sheets, y sube D04 como PDF. Guarda en cada archivo propiedades públicas de control: `bosque_claro_document_id`, `bosque_claro_version`, `bosque_claro_estado=preparado_simulacion` y `bosque_claro_checksum`; no son secretos.

La publicación conserva el ID al actualizar, omite contenido sin cambios y rechaza IDs duplicados o nombres existentes que no administre. No borra archivos ni modifica permisos. Si el inventario remoto ya contiene políticas ajenas al publicador, revisarlas antes de decidir cómo incorporarlas; no se sustituyen silenciosamente. Una carga manual debe conservar los formatos nativos y las propiedades de elegibilidad que comprueba la ingesta.

## Obtener acceso real a embeddings

Elegir **un proveedor y un modelo**, con la misma configuración para indexar y buscar. Se implementan solicitudes REST a OpenAI o Gemini; no se necesita un LLM conversacional en esta etapa.

- **Gemini:** crear/importar el proyecto en [Google AI Studio → API keys](https://aistudio.google.com/apikey), crear una clave autorizada para Gemini API y comprobar el modelo de embeddings disponible y su cuota. Configurar `AI_PROVIDER=gemini`, `AI_API_KEY`, `AI_EMBEDDING_MODEL` y `AI_EMBEDDING_DIMENSION` en `backend/.env`. Por ejemplo, `gemini-embedding-001` admite reducción de dimensión; elegir una dimensión documentada por el modelo, no una cifra tomada del vector de otro proveedor. Los permisos de Drive y la clave Gemini son accesos diferentes.
- **OpenAI:** crear una clave de proyecto en [API keys](https://platform.openai.com/api-keys), con permisos para embeddings y crédito/cuota disponibles. Configurar `AI_PROVIDER=openai` y las otras tres variables anteriores. Un ejemplo de modelo es `text-embedding-3-small`, cuya dimensión debe coincidir con la solicitada y con la colección. La suscripción o sesión de ChatGPT/Codex no constituye una clave API configurada en este backend.

Los nombres `AI_*` ya reservados se reutilizan. Si se necesita separar la clave/modelo de ingesta de otro uso futuro, `INGEST_EMBEDDING_PROVIDER`, `INGEST_EMBEDDING_API_KEY`, `INGEST_EMBEDDING_MODEL` y `INGEST_EMBEDDING_DIMENSION` tienen prioridad. No es necesario completar ambos grupos. Solo una solicitud autenticada al endpoint de embeddings acredita acceso real; tener una clave o poder listar modelos no prueba por sí solo que se pueda generar un vector.

El cliente comprueba cantidad, dimensión, valores finitos y vectores no nulos; los dobles de prueba no sirven de reemplazo cuando falla un proveedor. Gemini distingue documentos y consultas con sus task types. La API key se envía en encabezados, no se imprime ni se incorpora a citas.

## Preparar Qdrant

Puede usarse un clúster de [Qdrant Cloud](https://cloud.qdrant.io/) o una instancia local. Para Cloud, obtener URL HTTPS y API key con los permisos requeridos para crear/consultar/actualizar la colección. Configurar en `backend/.env`:

```dotenv
QDRANT_URL=https://tu-cluster-de-qdrant.example
QDRANT_API_KEY=
QDRANT_COLLECTION=bosque_claro_politicas
```

El dominio del ejemplo es ficticio; reemplazarlo con la URL real. En una instalación local accesible sin autenticación, puede omitirse la key. Se preparó `infra/compose.qdrant.yml` con Qdrant **v1.20.2**, almacenamiento persistente y puerto REST expuesto únicamente en `127.0.0.1`. Si Docker está instalado y autorizado en tu máquina, desde la raíz:

```bash
docker compose -f infra/compose.qdrant.yml up -d
```

Después usar `QDRANT_URL=http://127.0.0.1:6333`. Docker no estaba disponible en el entorno inspeccionado y este compose no se ejecutó como prueba de servicio real. No usar `down -v` si se quieren conservar los vectores.

La colección se valida con distancia Cosine y dimensión esperada; una discrepancia produce error y no reemplaza silenciosamente la colección existente. Al cambiar proveedor, modelo o dimensión, usar una colección nueva y una reconciliación completa según el comando de ingesta. No mezclar espacios de embeddings aunque tengan la misma dimensión.

## Ejecutar la ingesta y verificar una búsqueda en español

Una vez completados los accesos, desde `backend/`:

```bash
npm run ingest:check
npm run ingest:check -- --live
npm run policies:inspect
npm run policies:publish
npm run ingest:sync
npm run ingest:search -- "¿Con cuánta anticipación debo solicitar vacaciones?"
npm run ingest:verify
```

`ingest:check` solo revisa configuración; `--live` comprueba permisos de la carpeta, respuesta de Qdrant y generación de un vector real con dimensión válida. Esta última comprobación y las búsquedas consumen la cuota del proveedor. El publicador requiere la credencial escritora separada. Si los archivos ya están publicados y marcados, omitir la publicación.

La primera ejecución toma un `startPageToken` antes del listado inicial. Luego procesa los cambios ocurridos durante ese listado y guarda en `drive_sync_state` el cursor después de completar cada página. Ejecuciones posteriores utilizan `changes.list`: indexan altas/ediciones y retiran borrados, traslados fuera, accesos directos o documentos que dejen de ser elegibles. Un error no confirma la página pendiente; repetir la ejecución reintenta sin crear fragmentos duplicados. Un cursor 410 provoca reconciliación completa bajo el mismo bloqueo.

El bloqueo real usa `GET_LOCK` de MySQL en una conexión dedicada durante la ejecución; `bloqueo_hasta` expone el estado operativo. Las revisiones de documento y los IDs de fragmentos son deterministas e incluyen contenido, versión/modificación, proveedor/modelo/dimensión y configuración de fragmentación. Se actualiza la revisión activa en MySQL solo después de confirmar las escrituras Qdrant; la búsqueda filtra carpeta, espacio de embeddings, estado y revisión activa. La limpieza posterior retira las revisiones anteriores y se puede reintentar si falla.

Los fallos de lectura/embeddings de un documento modificado lo excluyen de búsqueda hasta resolverlo. Una pérdida de permiso sobre la carpeta no se interpreta como carpeta vacía. Hay tiempos límite de red de 45 segundos y límite de descarga de 20 MiB por defecto, configurable con `INGEST_MAX_DOWNLOAD_BYTES`. Los PDF escaneados sin texto requieren OCR externo: se rechazan explícitamente, sin generar texto de relleno.

Para reconciliar expresamente, incluyendo cambios de configuración de fragmentación o un nuevo modelo/colección:

```bash
npm run ingest:sync -- --full
```

`ingest:search` devuelve fragmentos con documento, sección, versión, ID de Drive y enlace. `ingest:verify` ejecuta seis preguntas en español de `docs/politicas/consultas-ingesta.json`, comprueba que el documento esperado aparezca en los cinco primeros resultados y que las citas tengan enlaces Google con el ID correspondiente. No inventa documentos cuando no hay resultados. Abrir el enlace devuelto desde un navegador con un usuario autorizado es una comprobación adicional necesaria; la estructura de una URL no garantiza el permiso de todos los usuarios.

Esta etapa incorpora comandos manuales idempotentes. No se declara cumplida la sincronización automática diaria del enunciado ni la generación de respuestas del agente de políticas; la programación y el chat siguen pendientes.

## Verificaciones realizadas

- **29 pruebas unitarias/locales aprobadas:** regresiones del backend, procesamiento con adaptadores de prueba, paginación y reintentos, cursor 410, permisos, duplicados, cambios de revisión, filtros REST, extracción de archivos y validación del corpus/publicador.
- **9 pruebas de integración aprobadas:** autenticación/saldos y restricciones previas, más persistencia del cursor/catálogo y exclusión mutua con MySQL real. Las filas de prueba se eliminaron mediante sus identificadores propios.
- `db:verify` comprueba las 14 migraciones y los fixtures conservados; `smoke` comprueba el arranque HTTP y salud de MySQL.
- `policies:plan` confirma doce artefactos locales. D04 contiene texto extraíble; el informe de investigación tiene nueve páginas reales.
- La auditoría npm del backend reportó cero vulnerabilidades después de fijar la dependencia UUID compatible de ExcelJS; no se usó `audit fix --force`.
- La comprobación de configuración y la ejecución protegida de verificación semántica informan accesos pendientes. No hay evidencia todavía de carga en Drive, embeddings reales, escritura en Qdrant ni enlaces de Drive abiertos.

Las pruebas con dobles verifican la lógica y los contratos de las solicitudes. No acreditan compatibilidad de una cuenta Google concreta, cuotas del proveedor, relevancia semántica real ni disponibilidad de Qdrant. El paso pendiente es configurar los accesos y ejecutar los comandos de comprobación real anteriores.

Para regenerar exportaciones HTML/PDF e informe después de editar sus fuentes, instalar primero las dependencias del frontend y Chromium de Playwright si faltan, y ejecutar `npm run policies:render` desde `backend/`. Los CSV son editables y los scripts de calendarios en `docs/politicas/` conservan la regla usada para prepararlos. No ejecutar la publicación para comprobar solo los archivos locales.

## Referencias técnicas oficiales

- [Drive changes.list](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/list): paginación y cursores.
- [Carga y conversión de archivos](https://developers.google.com/workspace/drive/api/guides/manage-uploads): formatos de importación nativos.
- [ADC](https://docs.cloud.google.com/docs/authentication/provide-credentials-adc): identidad de las solicitudes Google.
- [Embeddings Gemini](https://ai.google.dev/gemini-api/docs/embeddings) y [claves Gemini](https://ai.google.dev/gemini-api/docs/api-key).
- [Embeddings OpenAI](https://platform.openai.com/docs/api-reference/embeddings).
- [Qdrant local](https://qdrant.tech/documentation/quickstart/) y [release v1.20.2](https://github.com/qdrant/qdrant/releases/tag/v1.20.2).

Consulta de estas referencias: 2026-11-17. Los ejemplos de modelos/configuración no acreditan cuota o acceso para una cuenta que todavía no se configuró.

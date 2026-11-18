# Prompt para Gemini en VS Code: resolver accesos sin exponer secretos

Copia el bloque siguiente. Las credenciales se introducen localmente; no deben aparecer en respuestas, logs, capturas ni archivos versionados.

```text
Continúa el proyecto Bosque Claro en /home/panterita/Proyectos/portal-rrhh-rag.
Lee AGENTS.md, docs/PROGRESO.md y docs/ingesta-drive-qdrant.md. Conserva los datos, las credenciales existentes y las migraciones ya aplicadas.

Estado real comprobado el 18-11-2026 por Codex:
- backend Node/Express/Sequelize/MySQL y frontend React/Vite funcionan.
- Los doce documentos D01-D12 y sus exportaciones están en docs/politicas/manifest.json.
- npm run ingest:check -- --live confirmó Drive autorizado para lectura, carpeta con 0 archivos, Qdrant accesible y Gemini autorizado para generar embeddings con la dimensión configurada.
- QDRANT_COLLECTION es válido, sin punto final accidental y sin espacios. No lo reemplaces arbitrariamente.
- GOOGLE_APPLICATION_CREDENTIALS apunta a una credencial lectora existente. No la sobrescribas ni amplíes sus privilegios: conserva la separación entre lectura y publicación.
- Falta GOOGLE_PUBLISH_APPLICATION_CREDENTIALS, y falta DEEPSEEK_API_KEY.

Objetivo 1: habilitar publicación Google con una identidad escritora separada.
1. Comprueba tipos/permisos de los accesos existentes sin mostrar valores secretos.
2. Guíame en Google Cloud/Drive para usar un usuario OAuth con acceso escritor y almacenamiento si la carpeta está en Mi unidad. Un archivo de cliente OAuth descargado NO es una credencial authorized_user: necesita autorización y refresh token. Puedes preparar un helper OAuth local si hace falta, sin exponer tokens.
3. Alternativamente, si hay una unidad compartida Workspace, usa una cuenta de servicio con permiso suficiente para crear documentos dentro de esa carpeta. Las cuentas de servicio no tienen cuota propia para ser propietarias de archivos en Mi unidad.
4. Guarda la credencial autorizada en una ruta privada fuera del repositorio (permisos 0600) y agrega SOLO su ruta a GOOGLE_PUBLISH_APPLICATION_CREDENTIALS en el backend/.env existente. El agente de ingesta debe seguir usando GOOGLE_APPLICATION_CREDENTIALS para lectura. No publiques la carpeta ni cambies permisos a cualquiera con el enlace.
5. La escritura debe limitarse a GOOGLE_DRIVE_FOLDER_ID. El publicador existente es backend/scripts/publish-policies.js; no crees otra carpeta o documentos duplicados.

Verificación desde backend/ cuando haya escritura:
npm run policies:plan
npm run policies:inspect
npm run policies:publish
npm run policies:inspect

Comprueba doce archivos administrados: nueve Google Docs nativos, dos Google Sheets nativas y un PDF, con las propiedades bosque_claro_document_id/version/estado/checksum. Repite publish: debe omitir los doce como unchanged y no crear duplicados. Los archivos tienen estado preparado_simulacion, no aprobación jurídica.

Después:
npm run ingest:sync
npm run ingest:search -- "¿Con cuánta anticipación debo solicitar vacaciones?"
npm run ingest:verify
Repite sync y comprueba que no duplique puntos. Abre los enlaces reales de las citas con un usuario autorizado. No uses vectores de relleno ni resultados simulados para acreditar estos pasos.

Objetivo 2: habilitar DeepSeek como LLM, manteniendo Gemini para embeddings.
- En https://platform.deepseek.com/ crea una API key con cuota/crédito disponible.
- Introdúcela localmente en DEEPSEEK_API_KEY en backend/.env, nunca en frontend ni variables VITE_*.
- Usar DEEPSEEK_BASE_URL=https://api.deepseek.com y DEEPSEEK_MODEL=deepseek-flash, compatibles con la documentación oficial consultada. Revisar docs/contrato-api.md y código config/llm/integrations/deepseek según el estado actual.
- NO cambiar AI_PROVIDER/AI_API_KEY/AI_EMBEDDING_MODEL/AI_EMBEDDING_DIMENSION existentes: siguen siendo los embeddings Gemini. La clave de DeepSeek es independiente.
- Verifica una solicitud autenticada real a /chat/completions con salida JSON; no imprimas Authorization, clave, cookies ni el contenido de credenciales. Una variable configurada no acredita acceso si falta saldo o permiso.

Verificación desde backend/:
npm run llm:check
npm run report:generate
npm run eval:chat
El evaluador sale con código 0 si todas las verificaciones automáticas pasan, 1 si hay fallos y 2 si quedan casos bloqueados. Lee docs/evaluacion/resultados-actuales.json y realiza además revisión humana de fidelidad. No declares 80% de aciertos a partir de errores 503, respuestas parciales ni pruebas con dobles.

Al terminar informa únicamente estados (autorizado/falló), cantidades, formatos y pruebas realizadas. Actualiza docs/PROGRESO.md. Si el acceso sigue bloqueado, explica el paso exacto que falta; no digas que se publicó o que pasó una prueba sin evidencia.
```

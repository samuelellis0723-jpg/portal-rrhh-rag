# Prompt para Gemini en VS Code: revisión final con el navegador autorizado

Los accesos de Drive, Gemini, Qdrant y DeepSeek ya están configurados. No se solicita crear claves ni cambiar permisos. La comprobación pendiente es abrir las citas en un navegador con sesión Google autorizada y completar la revisión humana antes de grabar.

```text
Retoma /home/panterita/Proyectos/portal-rrhh-rag. Lee AGENTS.md, docs/PROGRESO.md, docs/evaluacion/resultados-actuales.json y docs/evaluacion/verificacion-fuentes.json.

Conserva las credenciales y las migraciones aplicadas. No imprimas secretos, no cambies la carpeta Drive ni compartas documentos públicamente. No modifiques el banco o los criterios de evaluación para mejorar el puntaje.

1. Ayúdame a abrir http://localhost:5173 con la cuenta demo existente, sin mostrar la contraseña. Para Google, utiliza mi navegador con la cuenta autorizada a la carpeta; si pide iniciar sesión, deja que yo lo haga directamente. No exportes cookies ni tokens.
2. Consulta “cuando es feriado”, “cuando es el proximo feriado?” y una pregunta mixta sobre saldo y acumulación. Abre cada cita, comprueba el documento, la versión y la sección/fila; contrasta lo dicho con la fuente real. Usa la fecha de Costa Rica y no extrapoles el calendario 2026.
3. Revisa las respuestas del banco, en especial 7, 14, 20, 32, 35, 37, 38 y 40. Distingue la revisión humana del puntaje automático. Registra observaciones concretas sin afirmar aprobación jurídica de las políticas propuestas.
4. Confirma los accesos 403 genéricos para 21/22. En RRHH abre el reporte real del 19-11-2026. No lo describas como ejecución programada: fue generado manualmente y el worker no está instalado como servicio.
5. Comprueba cancelar/confirmar “Eliminar conversación”; adviérteme que confirmar elimina el historial demo y sus trazas, conservando métricas anónimas. Otra cuenta no puede elegir qué identidad borrar.
6. Sigue docs/demo.md para grabar el video de respaldo de cinco minutos y docs/demo-en-vivo.md para preparar la demo en vivo de quince. Guarda o enlaza el video real; no declares una grabación inexistente.

Si alguna comprobación falla, documenta el caso exacto y conserva evidencia sin secretos. No reinstales accesos que ya funcionan ni vuelvas a sembrar la base para iniciar la aplicación.
```

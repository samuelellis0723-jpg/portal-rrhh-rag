# Cotejo documental y límites de la revisión

Fecha: 19-11-2026. Revisión realizada por el agente sobre las respuestas y fragmentos registrados; **no equivale a revisión humana completa ni aprobación jurídica**. La rúbrica automática permanece intacta. El JSON conserva `calidad_semantica_revision_humana: pendiente`.

## Procedencia comprobada

`verificacion-fuentes.json` coteja 79 citas del banco final y del recorrido Chromium contra exportaciones actuales de los documentos Drive autorizados. Doce documentos y 68 fragmentos de revisiones activas quedaron comprobados. La coincidencia textual acredita presencia/procedencia, no toda la interpretación ni vigencia legal.

Se pulsaron desde el chat las citas del calendario D02 (fila 20) y de vacaciones D01 (secciones 2, 4, 6 e introducción). Google abrió las rutas correctas y pidió iniciar sesión. Por tanto, **queda pendiente abrir y leer visualmente las fuentes privadas con una cuenta Google autorizada**. El texto de los fragmentos se contrastó mediante la API lectora; no se usaron cookies o credenciales de navegador para superar el acceso.

## Ocho fallos anteriores

| Caso | Causa corregida y cotejo de respuesta final |
|---|---|
| 7 · Incapacidad | La clasificación dejó de tratar la pregunta general como una cifra SQL personal. D04, secciones 1, 3 y 6, respalda distinguir CCSS/INS y pedir entidad, cotizaciones y base; no se inventa un monto neto. Se conserva la advertencia sobre vigencia y caso particular. |
| 14 · Liquidación | Se enruta a políticas. D09, secciones 3 y 4, respalda componentes y condiciones según causal/antigüedad; no se calcula liquidación individual. La respuesta conserva límites sobre modalidad contractual y asesoría. |
| 20 · Feriados restantes | Se usa 19-11-2026 en Costa Rica y las filas 20/21 de D02: 01-12 y 25-12. Se distingue clasificación de pago y se remite a Planillas según modalidad salarial. No se extrapola el calendario a 2027. |
| 32 · Error en recibo | Pedir el procedimiento para reportar un error no se clasifica como reporte RRHH restringido. D06, secciones 2 y 5, respalda canal privado de Finanzas, período/rubro y objetivo administrativo de recepción; no expone salarios ni datos bancarios. |
| 35 · Datos del portal | Es una consulta de política de privacidad. D12, secciones 2, 3 y 6, y D10, sección 6, respaldan finalidad y acceso por necesidad, MySQL/Qdrant y restricción de expedientes; no se responde con registros personales. |
| 37 · Primero de diciembre | Ya se recupera D02 y se cita la fila 20 dentro de la hoja: 01-12-2026, Abolición del Ejército, martes, categoría no obligatorio. Observación para revisión humana: la respuesta del banco usa literalmente esa categoría; no debe interpretarse como una regla universal de pago o asistencia. Las respuestas de próximo feriado sí explicitan consultar modalidad salarial con Planillas. |
| 38 · Revisión salarial | D06, secciones 2 y 5, respalda pedir revisión por canal privado e identificar período/rubro. Se distingue objetivo de recepción de una garantía legal de resolución. |
| 40 · Revisión de evaluación | D10, sección 3, respalda observaciones y revisión de procedimiento en diez días hábiles como meta administrativa. La respuesta reconoce que no existe un formulario/canal adicional detallado, en vez de inventarlo. |

## Otros controles revisados

Los saludos aislados no invocan LLM ni búsqueda; saludo con pregunta conserva SQL propio. Las mixtas mantienen por separado saldo y política, incluido el caso con pronombres sin «vacaciones». Las preguntas 21/22 y las inyecciones 41–43 reciben rechazo genérico; no se concede autoridad al rol escrito en el mensaje. Bono/guardería de mascotas conservan abstención sin citas inventadas. El período de prueba se explica sin presentar tres meses como regla universal.

Borrar conversación elimina contenido persistido, respuestas, citas y trazas vinculadas; se comprobó memoria vacía y recarga vacía. Se conserva la tabla sin identidad de métricas por fecha/tema y los reportes publicados. Dos cuentas temporales verifican propiedad, CSRF y el intento de especificar otro ID; otra sesión no puede borrar una conversación elegida por el cliente. Un envío concurrente termina antes del borrado y no reaparece después.

## Revisión humana pendiente

Antes de entregar, revisar en navegador autorizado las fuentes D01/D02 y una muestra de los restantes documentos, y comparar semánticamente las 45 respuestas con las esperadas. Priorizar las condiciones legales de incapacidades, terminación, licencias y privacidad, y la distinción entre política propuesta y normativa verificada. Usar [el prompt final para Gemini](../PROMPT_GEMINI_REVISION_FINAL.md) sin crear credenciales nuevas ni ampliar permisos.

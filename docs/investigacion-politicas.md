# Investigación y preparación del corpus de políticas

**Bosque Claro Servicios Digitales S.A. · Costa Rica · versión 0.1 · 17 de noviembre de 2026**  
**Responsable documental:** equipo académico de RRHH. **Estado:** preparado para simulación; no aprobado por la empresa ni revisado como dictamen jurídico.

## 1. Mandato, alcance y límites

Este informe documenta la búsqueda, clasificación y preparación de doce artefactos de políticas y calendarios para el proyecto ficticio Bosque Claro Servicios Digitales S.A., con 60 colaboradores simulados en Costa Rica. El corpus se construyó para responder al mínimo documental del enunciado y cubrir vacaciones, feriados, permisos/licencias, incapacidades, jornada y teletrabajo, salario, pagos, beneficios, ingreso y salida, desempeño, conducta/denuncias y privacidad. El conjunto no describe prácticas de una empresa real ni representa una aprobación corporativa.

La revisión se centró en fuentes oficiales consultables al 17 de noviembre de 2026: legislación consolidada disponible en SINALEVI/PGR, textos de La Gaceta e Imprenta Nacional, normas y orientación del MTSS, CCSS e INS. Se priorizaron artículos y publicaciones concretas. Una FAQ o criterio administrativo ayuda a interpretar una pregunta práctica, pero no sustituye la ley, el reglamento, la póliza ni el análisis de los hechos. Cuando no fue posible derivar una regla universal —por ejemplo, un porcentaje individual de subsidio— el documento delimita la respuesta en lugar de inventar una cifra.

Las recomendaciones de procedimiento interno aparecen como propuestas académicas. Permisos adicionales, fechas quincenales ilustrativas, beneficios, plazos internos de acuse, mecanismos de evaluación y canales internos no deben responderse como derechos ya adoptados. Su uso requeriría revisión laboral, aprobación de la administración ficticia, comunicación a las personas trabajadoras y coherencia con contratos, reglamentos y práctica. Las obligaciones legales se exponen separadas y con referencias rastreables.

No se encontró un repositorio previo de políticas en el inventario de proyecto revisado; había planes y documentos de diseño, pero no las fuentes previstas. Se prepararon diez archivos Markdown y dos CSV como fuentes editables, HTML importable para Google Docs, CSV para Google Sheets y un PDF auténtico para D04. El manifest registra los doce IDs y sus rutas locales. No se inventaron IDs, citas ni enlaces de Drive: la ausencia de acceso impide afirmar que el corpus se haya subido o que tenga URL de Drive.

## 2. Método de búsqueda y evaluación de fuentes

Se tomó el plan de Semana 1 como inventario inicial de dominios y pendientes, y el enunciado como criterio de cobertura y formatos. Para cada afirmación legal importante se buscó una fuente que identificara número de ley, artículo, autoridad o fecha de publicación. Se usaron SINALEVI/PGR para texto normativo, Imprenta Nacional para publicaciones primarias, y páginas institucionales MTSS, CCSS e INS para calendarios y procedimientos operativos. Las URL y la fecha de consulta se registraron dentro de los documentos fuente para que una futura ingesta pueda conservar procedencia.

La evaluación distingue cuatro niveles: (1) norma legal o reglamentaria, (2) publicación oficial de la reforma, (3) guía administrativa oficial, y (4) propuesta de diseño interno. Una guía oficial puede resumir una norma pero se etiqueta como guía; una opinión administrativa no se eleva a rango legal. Las páginas generales del MTSS no se utilizan como sustento principal cuando hay artículo, resolución o calendario más específico.

También se comprobó consistencia temporal. Por ejemplo, el Reglamento del Seguro de Salud fue reformado mediante acuerdo CCSS 9478 y publicado en noviembre de 2024; el calendario de feriados se refiere exclusivamente al año 2026; y la modificación del artículo 38 de la Ley 7476 por Ley 10029 obliga a reemplazar material anterior que indicaba un plazo distinto. Los documentos incluyen fecha de revisión para advertir que el corpus debe actualizarse cuando cambien la normativa o las fuentes institucionales.

Las afirmaciones que dependen de hechos particulares se transformaron en pasos de verificación. RRHH debe revisar modalidad de pago, salarios reportados, continuidad de incapacidades, póliza, parentesco, contrato o jornada pactada, según corresponda. El agente de políticas debe citar documento, sección, versión y enlace real; si la fuente no permite concluir, la respuesta debe exponer la limitación o abstenerse.

## 3. Resultado de cobertura documental

El catálogo D01–D12 cubre los diez dominios del enunciado y agrega dos instrumentos de calendario en hoja de cálculo. D01 define vacaciones como procedimiento propuesto con salvedades legales; D02 conserva las fechas de feriados 2026 y sus categorías; D03 distingue permisos legales de permisos internos; D04 resume incapacidades y fue exportado además a PDF; D05 aborda jornada, asistencia y teletrabajo; D06 regula como propuesta la administración salarial; D07 es un calendario que separa fechas simuladas de obligaciones; D08 cataloga beneficios hipotéticos; D09 cubre ingreso y salida; D10 propone un ciclo de desempeño; D11 separa hostigamiento sexual legalmente regulado de otras quejas laborales; D12 presenta un aviso propuesto de privacidad.

Los documentos editables se conservan en Markdown y tienen una exportación de destino compatible con el flujo de publicación: HTML para documentos de texto y CSV para hojas. El PDF D04 es un archivo binario generado desde su fuente HTML con Chromium. El archivo `manifest.json` enumera `id`, título, fuente local, exportación, formato objetivo, responsable, versión, fecha, sección y estado `preparado_simulacion`. Esa marca es deliberada: no indica aprobación, carga en Drive ni validación jurídica.

La hoja D02 no convierte automáticamente cada feriado en día libre adicional para cada persona. Su artículo 148 y la modalidad de pago determinan el tratamiento. D07 contiene fechas de pago ordinario de ejemplo, que no deben reemplazar la nómina real ni el sistema MySQL. Los datos personales de identidad, salario, saldos y solicitudes permanecen fuera de Qdrant; los documentos de política solo dan información general.

En conjunto, el inventario ofrece material sustantivo para recuperar reglas y explicar límites. Antes de publicación empresarial convendría un ciclo de aprobación con Legal/RRHH, control de cambios, aprobación del dueño del proceso, fecha efectiva y comunicación. Mantener la versión de fuente ligada al archivo de Drive será esencial para citas y sincronización.

## 4. Hallazgos: tiempo de trabajo, feriados y licencias

La jornada ordinaria y sus límites parten del Código de Trabajo; los detalles de jornada diurna, nocturna, mixta, descansos y extraordinaria deben cotejarse con el texto legal y el horario pactado. El teletrabajo tiene legislación específica (Ley 9738) que requiere acuerdo y condiciones escritas, y no autoriza a inferir que toda plaza puede cambiarse unilateralmente. D05 formula controles operativos propuestos y deja el acuerdo individual como referencia decisiva. La guía MTSS sobre teletrabajo complementa, pero no reemplaza, la ley.

Para los feriados, se usó el calendario oficial MTSS 2026 y se contrastó con el artículo 148 del Código de Trabajo. El CSV separa fecha, nombre, día de semana, carácter obligatorio/no obligatorio y nota. Se incluyeron las doce fechas publicadas para ese año. El tratamiento salarial depende de modalidad de pago, trabajo efectivamente realizado y regla aplicable; por eso se evita resumir la nómina individual solo desde la tabla.

En licencias, el artículo 95 del Código de Trabajo sustenta la licencia de maternidad y los supuestos de paternidad/adopción allí regulados. Ley 10589 incorporó al artículo 69 inciso l) una licencia remunerada por fallecimiento, con duración que depende del grado de parentesco y requisitos concretos. D03 ya no menciona una supuesta reforma de 2026 sin referencia identificable. Para matrimonio, estudio o diligencias no cubiertas, el texto indica explícitamente que cualquier permiso pagado descrito es una mejora propuesta, no un derecho general que se pueda atribuir a toda persona trabajadora.

## 5. Hallazgos: incapacidades, salarios y beneficios

El punto de mayor riesgo de simplificación era calcular subsidios por incapacidad como porcentaje universal. El artículo 35 del Reglamento de Seguro de Salud CCSS determina que el subsidio ordinario por incapacidad se reconoce desde el cuarto día, mientras que una nueva incapacidad dentro de 30 días de la anterior tiene tratamiento desde el primer día. El artículo 36 contempla una base relacionada con los salarios reportados de los últimos doce meses, con exclusiones y límites previstos por la norma. El valor individual exige historial contributivo y resolución aplicable. Por eso D04 no promete un porcentaje CCSS fijo.

El criterio MTSS DAJ-AE-155-06 sirve para explicar el supuesto de pago patronal de la mitad del salario en los primeros tres días de una incapacidad CCSS, pero el documento lo presenta como criterio administrativo que debe leerse junto a norma y hechos, no como garantía universal para cualquier continuidad o reincidencia. Para Riesgos del Trabajo, la FAQ oficial INS informa 60% en los primeros 45 días y cerca de 67% desde el día 46 según salarios reportados. Se limita expresamente a esa póliza, no al SOA ni a CCSS. Una consulta de cinco días sin entidad, período contributivo o salario no permite calcular el total neto con precisión.

El aguinaldo se describe con su período legal de cómputo 1 de diciembre–30 de noviembre y plazo de pago de los primeros veinte días de diciembre conforme a Ley 2412 y orientación MTSS. En cambio, las fechas ordinarias quincenales son simuladas. D08 presenta beneficios —p. ej., capacitación o apoyos— como catálogo hipotético sin presentarlos como oferta existente. El enunciado y los datos de MySQL son la fuente de cifras individuales; un corpus de políticas no puede servir para responder el saldo o salario de una persona.

## 6. Hallazgos: hostigamiento, datos y privacidad

La Ley 7476 regula la prevención y sanción del hostigamiento sexual en el empleo e impone procedimientos y protecciones. El artículo 38 debe citarse en texto vigente: fue reformado por Ley 10029 y fija ocho años para la prescripción en los supuestos de esa norma. La cifra histórica de dos años se excluyó. D11 advierte que el plazo de investigación administrativa tiene reglas distintas y no deben confundirse. Se descartó el Decreto 27969-TSS como fundamento aplicable a Bosque Claro: su artículo 1 lo identifica como Reglamento Autónomo de Servicio del MTSS para sus servidores. No es un reglamento general de la empresa privada y no se trasladan sus procedimientos a este caso. La referencia descartada puede consultarse en https://www.mtss.go.cr/perfiles/lineamientos_circulares_directrices_politicas_internas/lineamientos-circulares-directrices-politicas%20internas/27969-TSS.pdf (artículo 1).

Para otras alegaciones de acoso laboral, el documento no inventa un tipo y plazo universal idéntico a Ley 7476. Se propone recibir quejas y analizar dignidad, normativa laboral, salud y jurisprudencia aplicables, preservando investigación imparcial. Canal, acuse en dos días, separación de roles y plazos internos son diseño académico sin aprobación.

La Ley 8968 y su reglamento proporcionan el marco de protección de datos personales. D12 distingue obligaciones de información, finalidad, proporcionalidad, calidad, seguridad y derechos, de los controles operativos sugeridos. La organización debe identificar al responsable de bases, tratamientos, transferencias y medidas aplicables antes de publicarlo como aviso de privacidad definitivo. La información médica merece especial cuidado y el corpus evita incorporar datos reales.

Para el sistema Bosque Claro, la regla de arquitectura es que Google Drive contiene políticas, Qdrant sus fragmentos y embeddings, y MySQL las cifras e identidades. El proceso de ingesta debe limitarse a una carpeta autorizada y preservar ID, nombre, enlace real, versión/modificación y sección. Sin credenciales, no puede haber sincronización ni citas Drive reales. Hasta obtenerlas, las referencias locales del manifest son solo procedencia del material preparado.

## 7. Registro selectivo de fuentes oficiales

Las fuentes siguientes sostienen afirmaciones concretas incluidas en el corpus. Cada archivo fuente mantiene también sus enlaces junto a la sección correspondiente.

| Materia | Fuente y ubicación | Uso / límite |
|---|---|---|
| Jornada y licencias | Código de Trabajo, MTSS, https://www.mtss.go.cr/elministerio/marco-legal/documentos/codigo_trabajo_cr.pdf | Texto de referencia; revisar artículo aplicable y cambios consolidados. |
| Feriados 2026 | MTSS, https://www.mtss.go.cr/temas-laborales/feriados/feriados_calendario_2026.pdf | Calendario anual publicado para 2026. |
| Teletrabajo | Ley 9738, MTSS, https://www.mtss.go.cr/elministerio/marco-legal/documentos/9738.pdf | Acuerdo y condiciones del teletrabajo; verificar pacto individual. |
| Incapacidad CCSS | Reglamento Seguro de Salud, arts. 35–36, Gaceta 205, https://www.imprentanacional.go.cr/pub/2024/11/01/COMP_01_11_2024.pdf; texto del art. 36 transcrito por Auditoría CCSS, informe AD-AFINPE-0054-2025, pp. 14–15: https://aissfa.ccss.sa.cr/arc/auditoria/informes/AD-AFINPE-0054-2025.pdf | Regla de inicio, reincidencia y base de cálculo; aplicación depende de expediente contributivo. |
| Incapacidad INS | FAQ INS, https://salud.grupoins.com/preguntas-frecuentes/tramite-de-pago-por-incapacidades/ | Tasas informativas de Riesgos del Trabajo; no extrapolar a SOA/CCSS. |
| Primeros días CCSS | MTSS DAJ-AE-155-06, https://www.mtss.go.cr/elministerio/estructura/direccion-asuntos-juridicos/pronunciamientos/daj-ae-155-06%20%20pago%20primeros%20tres%20dias.pdf | Criterio administrativo para el supuesto consultado, no norma general independiente. |
| Aguinaldo | MTSS, https://www.mtss.go.cr/temas-laborales/aguinaldo/preguntas_frecuentes.pdf | Periodo y fecha límite, junto a Ley 2412. |
| Duelo | Ley 10589, PGR, https://www.pgrweb.go.cr/DOCS/NORMAS/1/VIGENTE/L/2020-2029/2020-2024/2024/193D8/170861.HTML | Reforma art. 69 inciso l); duración depende del parentesco/supuesto. |
| Hostigamiento | Ley 7476 consolidada, SINALEVI, https://sinalevi.go.cr/ResultadosNormativa/Informacion?param1=22803&param2=127347&param3=3&param4=116111 | Texto vigente consultado; Art. 38 ocho años tras Ley 10029. |
| Reforma Ley 7476 | Ley 10029, Imprenta Nacional, https://www.imprentanacional.go.cr/pub/2021/10/20/ALCA213_20_10_2021.pdf | Publicación primaria de reforma al plazo de prescripción. |
| Privacidad | Ley 8968, PGR/SCIJ, https://www.pgrweb.go.cr/scij/Busqueda/Normativa/Normas/nrm_texto_completo.aspx?nValor1=1&nValor2=70975 | Marco general; completar responsable, tratamientos y transferencias reales antes de adoptar aviso. |

## 8. Verificación, riesgos residuales y mantenimiento

Se revisó la presencia de doce fuentes Markdown, nueve exportaciones HTML para Google Docs, dos CSV para Google Sheets, el PDF de D04 y un manifest con doce IDs. El PDF es un archivo PDF generado por Chromium, no una extensión HTML renombrada. Las exportaciones deben volver a generarse después de cada cambio Markdown para no separarse de la fuente canónica. Para uso real, cada documento necesita control de vigencia y aprobación; este paquete no crea permisos o enlaces de Drive.

La búsqueda verificó las afirmaciones legales clave descritas en los archivos y corrigió errores de precisión: la referencia no sustentada a reforma 2026 en maternidad, el plazo antiguo de dos años en D11 la falta de artículos/reglas específicas para incapacidades en D04 y la referencia equivocada al reglamento autónomo del MTSS como si fuera general del sector privado. Quedan límites: criterios sobre primeros tres días pueden depender de jurisprudencia y reincidencia; el cálculo personal de subsidios requiere datos de aseguramiento; y el texto consolidado puede modificarse después de la fecha de consulta.

Al integrar con Drive, mantener el manifiesto idempotente, almacenar IDs y enlaces retornados por la API, no inferirlos desde nombres, y comprobar que todo documento pertenezca a la carpeta autorizada. La ingestión debe eliminar o retirar de Qdrant archivos borrados/trasladados y usar `changes.list` con cursor persistente. El usuario debe poder abrir el enlace citado. Ningún resultado de búsqueda debe presentar una fuente local como si fuese un documento publicado.

**Estado al cierre:** paquete documental preparado en local para revisión académica y eventual importación. No aprobado, no publicado, no subido a Drive y no probado en Qdrant. Fecha de revisión de fuentes: 2026-11-17.

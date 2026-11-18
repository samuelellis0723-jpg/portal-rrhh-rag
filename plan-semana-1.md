# Semana 1: investigación y plan documental

Leí completo [enunciado.md](enunciado.md). **La investigación y el plan documental están preparados para revisión; no escribí código ni creé archivos durante la elaboración del plan.** Este archivo se crea posteriormente a solicitud del usuario para conservar el resultado.

Propongo **Bosque Claro Servicios Digitales S.A.**, empresa ficticia privada de software, ubicada en Costa Rica, con **60 colaboradores simulados**.

Ejecuté y esperé a **dos subagentes reales en paralelo**, ambos seleccionados explícitamente como **GPT-6 Luna**. No pude confirmar ni cambiar desde esta sesión el modelo del coordinador a GPT-6.1 Sol; por eso no afirmo que esa parte de la configuración haya quedado verificada.

## 1. Qué entregó cada agente

| Agente | Trabajo realizado | Resultado |
|---|---|---|
| Investigación | Leyó el enunciado y consultó fuentes oficiales para los 10 dominios. Separó hallazgos, propuestas internas y pendientes. | Matriz de fuentes MTSS, PGR/SCIJ, CCSS e INS. Identificó dudas de vigencia, subsidios y contradicciones entre fuentes. |
| Documentación | Leyó el enunciado y propuso un catálogo documental, formatos, secciones, responsables, metadatos y preguntas. | Propuesta de 12 entradas documentales, correspondencia RAG/SQL, índice del informe y dependencias de Drive. |

Revisé sus resultados antes de consolidarlos. **Corregí una conclusión del agente de investigación:** un criterio MTSS de 2023 describía el duelo como permiso discrecional, pero la **Ley 10589 de 2024** introdujo una licencia remunerada por fallecimiento de familiares. El criterio anterior no debe usarse como descripción actual de ese derecho. [Ley 10589, texto consultado en PGR](https://www.pgrweb.go.cr/DOCS/NORMAS/1/VIGENTE/L/2020-2029/2020-2024/2024/193D8/170861.HTML).

## 2. Matriz consolidada: dominio, fuente, documento y pregunta

**Fecha de consulta de esta investigación: 17 de noviembre de 2026.** Una fuente oficial antigua sirve como antecedente; su publicación no acredita por sí sola la vigencia actual de todas sus reglas.

| Dominio | Fuentes oficiales consultadas y alcance | Obligación legal frente a política interna | Documentos propuestos | Pregunta de referencia |
|---|---|---|---|---|
| Vacaciones y feriados | [Código de Trabajo, PDF MTSS](https://www.mtss.go.cr/elministerio/marco-legal/documentos/codigo_trabajo_cr.pdf), especialmente vacaciones y feriados. Pendiente contrastar texto consolidado y calendario 2026. | El mínimo legal debe verificarse y respetarse. Anticipación de solicitudes, circuito de aprobación y mejoras son decisiones internas. | D01 y D02 | ¿Puedo acumular vacaciones? ¿Qué feriados quedan este año? |
| Permisos y licencias | Código anterior y [Ley 10589 sobre duelo](https://www.pgrweb.go.cr/DOCS/NORMAS/1/VIGENTE/L/2020-2029/2020-2024/2024/193D8/170861.HTML). Revisar también maternidad, paternidad y licencias especiales en texto vigente. | Duelo y licencias legales no deben presentarse como beneficios voluntarios. Matrimonio, estudio y permisos adicionales requieren distinguir norma aplicable de propuesta empresarial. | D03 | ¿Cuántos días corresponden por fallecimiento de un familiar? |
| Incapacidades | [Norma técnica INS de 2023](https://www.ins-cr.com/media/16260/norma-t%C3%A9cnica-2023-20-04-2023.pdf) e [informe oficial CCSS de 2025](https://aissfa.ccss.sa.cr/arc/auditoria/informes/AD-AFINPE-0054-2025.pdf). Este último es evidencia secundaria sobre reformas, no reemplaza el reglamento vigente. | Separar enfermedad común de riesgo laboral. Un complemento patronal sería política interna; no presumirlo. | D04 | Me incapacitaron cinco días: ¿quién paga cada día? |
| Jornada y asistencia | Código de Trabajo y [guía básica de teletrabajo MTSS](https://www.mtss.go.cr/perfiles/lineamientos_circulares_directrices_politicas_internas/lineamientos-circulares-directrices-politicas%20internas/Guia_basica_Teletrabajo.pdf). | Jornada y remuneración extraordinaria tienen marco legal. Días remotos, elegibilidad y control de marcas son decisiones internas sujetas a ese marco. | D05 | ¿Cuántos días puedo teletrabajar? ¿Cómo se pagan las extras? |
| Remuneración | [Preguntas frecuentes de aguinaldo, MTSS](https://www.mtss.go.cr/temas-laborales/aguinaldo/preguntas_frecuentes.pdf). Explica período de cálculo y pago. | Aguinaldo es obligación legal. Calendario ordinario y procesos de corrección se definen internamente dentro del marco aplicable. | D06 y D07 | ¿Cómo se calcula el aguinaldo? |
| Beneficios | [Ley de Asociaciones Solidaristas, MTSS](https://www.mtss.go.cr/elministerio/estructura/direccion-de-asuntos-laborales/organizaciones-sociales/normativa/Ley%20de%20Asociaciones%20Solidaristas%20No%206970.pdf) y [orientación MTSS sobre aseguramiento](https://www.mtss.go.cr/temas-laborales/). | Distinguir aseguramiento obligatorio de seguro privado, ahorro adicional o capacitación propuestos. La existencia de una ley solidarista no prueba obligación de crear una asociación. | D08 | ¿Qué cubre el seguro médico de la empresa? |
| Ingreso y salida | Código y [orientación MTSS sobre preaviso y cesantía](https://www.mtss.go.cr/temas-laborales/). | Prestaciones dependen de causal, antigüedad y modalidad contractual. Onboarding y devolución de equipos son procedimientos internos. Evitar un “período de prueba” universal. | D09 | Si renuncio, ¿qué preaviso corresponde? |
| Desempeño y carrera | Código como marco general. El agente no encontró una obligación general privada de usar una frecuencia o escala específica de evaluación. | Ciclo, criterios, ascensos y planes de mejora serán propuestas internas. No presentar la ausencia de un hallazgo como prueba de inexistencia normativa. | D10 | ¿Cómo funciona la evaluación y cómo puedo solicitar revisión? |
| Conducta y convivencia | [Orientación MTSS](https://www.mtss.go.cr/temas-laborales/) y [reforma 10454](https://www.pgrweb.go.cr/DOCS/NORMAS/1/VIGENTE/L/2020-2029/2020-2024/2024/18DC8/168501.HTML). Pendiente leer la Ley 7476 consolidada. | Distinguir hostigamiento sexual de acoso laboral. Ética y disciplina internas deben respetar las garantías aplicables. | D11 | ¿Cómo denuncio un caso de acoso confidencialmente? |
| Datos y privacidad | [Ley 8968, PGR](https://pgrweb.go.cr/DOCS/NORMAS/1/VIGENTE/L/2010-2019/2010-2014/2011/1153F/DCEF7.HTML). El enlace abierto permitió constatar el objetivo del artículo 1; falta revisar articulado completo y reglamento. | El aviso debe explicar el tratamiento previsto. No atribuir a la ley plazos de conservación o requisitos de inscripción sin comprobarlos. | D12 | ¿Para qué se usan mis datos y quién puede consultarlos? |

Pendientes de mayor prioridad:

- **CCSS:** obtener el reglamento vigente y confirmar condiciones, base de cálculo, días iniciales y responsabilidad patronal. Todavía no hay respaldo suficiente para contestar completamente la pregunta de cinco días de incapacidad.
- **Permisos:** contrastar el Código consolidado y reformas posteriores a las versiones consultadas.
- **Hostigamiento sexual:** resolver la contradicción de plazos encontrada en la FAQ del MTSS mediante la Ley 7476 vigente.
- **Feriados:** verificar fechas y tratamiento aplicable en 2026, incluyendo cualquier disposición pertinente.
- **Privacidad:** revisar ley completa, reglamento y aplicabilidad al escenario propuesto.

## 3. Catálogo documental para Drive

Consolidé la propuesta del segundo agente en **12 archivos sustantivos**, separando los calendarios de sus políticas. Así evitamos depender de documentos auxiliares para alcanzar el mínimo.

Metadatos comunes de **cada archivo**: **versión 0.1, estado “borrador académico”, fecha de vigencia propuesta 17/11/2026 para la simulación, condicionada a tu revisión**. Esa fecha no significa aprobación jurídica ni vigencia en una empresa real. Cada documento distinguirá regla legal verificada, propuesta interna y asunto pendiente.

| ID | Título y dominio | Formato | Secciones previstas | Responsable propuesto | Pregunta que responderá |
|---|---|---|---|---|---|
| D01 | Política de vacaciones — Vacaciones y feriados | Google Docs | Alcance; mínimo legal y mejora; solicitud; aprobación; acumulación; fraccionamiento; registro | RRHH | ¿Con cuánta anticipación solicito vacaciones? |
| D02 | Calendario de feriados 2026 — Vacaciones y feriados | Google Sheets | Fecha; denominación; tratamiento; fuente; excepciones; fecha de revisión | RRHH / Planillas | ¿Qué feriados quedan este año? |
| D03 | Política de permisos y licencias — Permisos y licencias | Google Docs | Maternidad; paternidad; duelo; matrimonio; estudio; sin goce; requisitos; aprobación | RRHH / asesoría laboral | ¿Qué licencia corresponde por duelo? |
| D04 | Procedimiento de incapacidades — Incapacidades | PDF | Aviso; comprobante; CCSS/INS; escenarios de pago verificados; privacidad; retorno | RRHH / Salud Ocupacional | ¿Cómo reporto una incapacidad y qué entidad interviene? |
| D05 | Reglamento de jornada, asistencia y teletrabajo — Jornada y asistencia | Google Docs | Horarios; descansos; marcas; extras; acuerdo remoto; equipos; incidencias | RRHH / Operaciones | ¿Cuántos días puedo trabajar desde casa? |
| D06 | Política salarial y aguinaldo — Remuneración | Google Docs | Forma de pago; recibo; deducciones; correcciones; aguinaldo; consultas | Finanzas / Planillas | ¿Cómo se calcula el aguinaldo? |
| D07 | Calendario de pagos 2026 — Remuneración | Google Sheets | Períodos; cortes; fechas generales; ajustes; fuentes; versión | Planillas | ¿Cuáles son las fechas generales de pago? |
| D08 | Catálogo de beneficios — Beneficios | Google Docs | Beneficio; elegibilidad; cobertura; costo; exclusiones; solicitud; contacto | RRHH / Finanzas | ¿Qué cobertura adicional ofrece la empresa? |
| D09 | Manual de ingreso y salida — Ingreso y salida | Google Docs | Onboarding; contrato; accesos; prueba según modalidad; preaviso; prestaciones; activos | RRHH / Legal / TI | ¿Qué incluye una liquidación según la causal? |
| D10 | Política de desempeño y carrera — Desempeño y carrera | Google Docs | Ciclo; criterios; evidencias; revisión; mejora; ascensos; formación | RRHH / líderes | ¿Cómo solicito revisión de mi evaluación? |
| D11 | Código de conducta y protocolo de denuncias — Conducta y convivencia | PDF | Ética; canales; confidencialidad; no represalia; investigación; protección; disciplina | RRHH / comité designado | ¿Cómo presento una denuncia confidencial? |
| D12 | Aviso de privacidad para colaboradores — Datos y privacidad | Google Docs | Responsable; finalidad; categorías; accesos; destinatarios; conservación; derechos; logs e IA | Privacidad / TI | ¿Quién puede consultar mis datos? |

Los PDF conservarían una fuente editable. Los Sheets usarían encabezados claros y filas comprensibles por separado para facilitar su extracción.

El agente también propuso un **registro de fuentes y control de versiones**: es útil como apoyo, pero no sustituye ninguno de los diez dominios.

Dos decisiones para proteger la calidad del RAG:

- Solo ingresar contenido revisado para la simulación; las secciones sin verificar deben provocar abstención o derivación.
- No afirmar que existe seguro privado, asociación, fondo o cobertura sin una decisión documental explícita. La pregunta sobre bono por mascotas debe conservarse como caso sin respuesta documentada y con ofrecimiento de escalamiento.

Los saldos, la próxima fecha de pago personal, la próxima evaluación y el estado de solicitudes —preguntas 2, 9, 17 y 18— requieren **SQL filtrado por usuario**. La 19 combina SQL y RAG. El modelo de datos deberá contemplar las fechas individuales que el esquema mínimo del enunciado no define expresamente.

## 4. Índice del informe de investigación

Propongo **8 páginas**, sin confundirlo con el informe técnico final de 8–12 páginas:

| Página | Contenido |
|---|---|
| 1 | Empresa ficticia, país, sector, tamaño, problema y alcance |
| 2 | Método de investigación, jerarquía de fuentes y control de vigencia |
| 3 | Vacaciones, feriados, permisos y licencias |
| 4 | Incapacidades, jornada, teletrabajo y remuneración |
| 5 | Beneficios, ingreso/salida, desempeño, conducta y privacidad |
| 6 | Catálogo documental: formatos, secciones, responsables y metadatos |
| 7 | Correspondencia entre preguntas, documentos y SQL; privacidad y abstención |
| 8 | Referencias, discrepancias, verificaciones pendientes y preparación de Drive |

## 5. Qué puede quedar listo hoy y qué depende de accesos

| Trabajo de semana 1 | Situación y dependencia |
|---|---|
| Empresa, alcance, catálogo y estructura del informe | Planificados en este documento; pendientes de tu revisión |
| Informe y documentos redactados | Se pueden preparar hoy después de revisar el plan; aún no redactados |
| Reglas legales sensibles | Dependen de verificar fuentes públicas, sin necesitar credenciales |
| Beneficios y procedimientos ficticios | Dependen de definir las propuestas internas; no de contratar servicios reales |
| Docs, Sheets y PDF finales | Dependen de redacción y acceso de edición a Drive para los formatos nativos |
| Carpeta compartida con cuenta de servicio | Depende de identificar o crear la cuenta y concederle acceso |
| Semana 1 completa conforme al enunciado | Requiere informe y documentos efectivamente terminados y subidos; el plan por sí solo no completa ese avance |

Para Drive necesitaremos comprobar **proyecto Google Cloud, Drive API habilitada, identidad de la cuenta de servicio, carpeta autorizada y mecanismo de autenticación**. No he comprobado que existan ni que falten. La ingesta debe tener lectura; la creación documental necesita una identidad con edición. Las credenciales se configurarán fuera del repositorio.

## 6. Siguientes pasos propuestos para terminar el MVP hoy

Después de tu revisión, este sería el orden:

1. **Cerrar semana 1:** verificar primero los puntos legales sensibles, definir propuestas internas, redactar informe y documentos, preparar los tres formatos y subirlos a Drive.
2. **Comprobar accesos temprano:** Drive y proveedor LLM/embeddings con cuota disponible. Configurar MySQL para datos estructurados y Qdrant para fragmentos vectorizados, con secretos fuera del repositorio.
3. **Construir un recorrido completo pequeño:** login con dos roles, un documento indexado, consulta con cita y consulta personal con filtro de identidad.
4. **Completar los cinco agentes obligatorios:** orquestador, políticas, datos, ingesta y analista. Cubrir consultas mixtas y sincronización de archivos nuevos, editados y borrados.
5. **Completar datos y dashboard:** 60 personas simuladas, tres meses de movimientos, ocho componentes del reporte, cuatro indicadores, dos gráficos, pendientes e historial. Programación a las 7:00 a. m. de Costa Rica.
6. **Evaluar y preparar entrega:** 45 preguntas, respuestas esperadas, citas, rechazos, abstención, cifras contrastadas con SQL y medición de latencia; después README, arquitectura, informe técnico y video.

Priorizaría los criterios obligatorios antes de voz u otros extras. El objetivo de evaluación es **al menos 80 % de aciertos y ninguna fuga en las preguntas 21 y 22**; todavía no existen pruebas ni resultados que permitan prometer esa nota.

## 7. Decisión de stack y transición al diseño

Por elección explícita del usuario, la recomendación de PostgreSQL/pgvector queda sustituida por:

| Capa | Elección | Responsabilidad |
|---|---|---|
| Backend | Node.js + Express | Sesión, API, autorización y ejecución de agentes |
| Persistencia relacional | Sequelize + MySQL | Personas, cifras, saldos, solicitudes, pagos, evaluaciones, logs y reportes |
| Frontend | React + Vite | Login, chat y dashboard RRHH |
| Índice vectorial | Qdrant | Fragmentos derivados de políticas, embeddings y metadatos de recuperación/citas |
| Documentos | Google Drive | Fuente documental canónica de las políticas |

El enunciado permite elegir herramientas y contempla MySQL y Qdrant como alternativas. Esta decisión conserva las dos fuentes de verdad: **Drive para políticas y MySQL para cifras**. Qdrant es un índice reconstruible de Drive. Sequelize proporciona modelos y cambios de esquema versionados mediante migraciones y seeders; React/Vite permite separar las pantallas de los servicios HTTP.

La contrapartida es operar y configurar dos servicios de almacenamiento, MySQL y Qdrant. No habrá transacción distribuida entre ellos: la ingesta deberá ser repetible, reintentable y retirar fragmentos obsoletos al cambiar o borrar documentos. No almacenar datos personales en Qdrant. Fijar el modelo/dimensión de embeddings y crear una colección nueva al cambiar de modelo.

El usuario autorizó avanzar con los entregables de diseño: [guía del repositorio](AGENTS.md), [modelo DBML](docs/diagrama.dbml), [contrato API](docs/contrato-api.md) y [plan de implementación](docs/plan-implementacion.md). La redacción completa de políticas, la creación de la base, las migraciones y el código de la aplicación siguen pendientes; este diseño no acredita una integración funcionando ni completa el avance documental de Semana 1.


## Actualización posterior: corpus e ingesta preparados

El plan anterior se conserva como registro histórico. La etapa posterior produjo los doce documentos de políticas, exportaciones para los tres formatos y un informe de investigación de nueve páginas. Las referencias revisadas y las distinciones entre obligación legal y propuesta interna están en [investigacion-politicas.md](docs/investigacion-politicas.md). Se corrigieron el plazo antiguo de hostigamiento sexual, la referencia no sustentada a una reforma de maternidad y la confusión de un reglamento autónomo del MTSS con normas generales para la empresa privada; se precisaron las fuentes CCSS/INS.

El [manifiesto del corpus](docs/politicas/manifest.json) identifica los archivos locales; no prueba publicación en Drive. La ingesta y sus verificaciones están en [ingesta-drive-qdrant.md](docs/ingesta-drive-qdrant.md). Faltan los accesos externos: no se afirma que la carpeta de Drive ya contenga los documentos ni que una búsqueda semántica real esté validada.

# Catálogo territorial de Apartadó para Reportar

**Estado:** catálogo transcrito de la relación suministrada por el responsable del proyecto; no verificado como fuente oficial.  
**Uso previsto:** selección jerárquica de ubicación al proponer un escenario deportivo nuevo.  
**Alcance:** no crea ni modifica datos de MySQL y no autoriza la incorporación de escenarios al inventario oficial.

## 1. Reglas de uso

- La jerarquía urbana es **Zona urbana → Comuna → Barrio**.
- La jerarquía rural es **Zona rural → Corregimiento → Vereda o centro poblado**.
- No se ofrece una lista global, desordenada, de barrios, veredas y centros poblados.
- Se conservan los nombres y agrupaciones tal como fueron entregados. `C.P.` significa **Centro Poblado** y se conserva como clasificación explícita; no se convierte en vereda.
- No se agregan ubicaciones ni se deducen relaciones distintas de las enumeradas aquí.
- Esta transcripción no constituye verificación institucional. Cualquier diferencia futura con una fuente oficial se documentará para revisión; no se corregirá silenciosamente este catálogo.

## 2. Catálogo urbano

### Comuna 1: Bernardo Jaramillo

- La Paz
- Policarpa
- Diana Cardona
- Antonio Roldán
- La Arboleda
- Santa María
- La Alborada
- El Concejo
- Alfonso López
- San Fernando
- 4 de Junio

### Comuna 2: Ocho de Febrero

- Obrero
- Las Brisas
- Primero de Mayo

### Comuna 3: Pueblo Nuevo

- Manzanares
- Parroquial
- Urb. La Navarra
- Pueblo Nuevo
- 9 de Octubre
- La Esperanza
- La Esmeralda
- El Paraíso

### Comuna 4: José Joaquín Vélez

- Centro
- Fundadores
- El Amparo
- Nuevo Apartadó
- Los Álamos
- El Ortiz
- Los Almendros
- Los Pinos
- El Darién
- Villa de Río
- Pueblo Quemado
- Inv. La Libertad
- Urb. Gualcalá
- Santa María
- La Antigua
- La Serranía
- Laureles
- Vélez
- El Estadio
- Nueva Civilización
- El Rosal
- Chinita
- Corrugados
- Simón Bolívar
- El Salvador
- Buenos Aires
- Villa Mateguadua Germán

## 3. Catálogo rural

### Corregimiento: San José de Apartadó

- La Buenos Victoria
- Salsipuedes
- La Balsa
- El Tigre
- Guineo Bajo
- El Osito
- Los Mandarinos
- El Gas
- Guineo Alto
- El Salto
- Arenas Altas
- Arenas Bajas
- El Porvenir
- La Esperanza
- Las Nieves
- Mulatos Cabecera
- Mulatos Medio
- La Resbalosa
- La Hoz
- Rodoxali
- Playa Larga
- Sabaleta
- Las Flores
- La Unión
- C.P. San José de Apartadó

### Corregimiento: Puerto Girón

- Zungo Abajo
- San Pablo
- Punto Rojo
- El Diamante
- El Guaro
- C.P. Bajo El Oso
- C.P. Puerto Girón

### Corregimiento: Churidó

- Churidó Puente
- Churidó Medio
- Churidó Sinaí
- La Pancha
- C.P. Churidó Pueblo

### Corregimiento: El Reposo

- San Martín
- Zungo Arriba
- La Pedroza
- La Danta
- San Miguel
- C.P. Loma Verde
- C.P. Los Naranjales
- C.P. Vijagual
- Zungo Carretera
- Casco Urbano El Reposo

## 4. Conteos de la transcripción

| Nivel | Cantidad |
|---|---:|
| Comunas urbanas | 4 |
| Barrios urbanos | 49 |
| Corregimientos rurales | 4 |
| Veredas/localidades rurales no marcadas explícitamente `C.P.` | 40 |
| Centros poblados identificados explícitamente con `C.P.` | 7 |
| Entradas rurales totales | 47 |

Las 40 entradas rurales no prefijadas `C.P.` se contabilizan como elementos del grupo de veredas/localidades rurales según la estructura suministrada; el conteo no constituye certificación administrativa individual de su categoría. Las siete entradas con `C.P.` mantienen explícitamente su clasificación de centro poblado.

## 5. Selección de ubicación en Reportar

Para un escenario existente, el ciudadano busca y selecciona un registro oficial disponible en el inventario; no modifica su ubicación desde el formulario.

Para un escenario nuevo:

1. Selecciona zona urbana o rural.
2. En zona urbana selecciona una de las cuatro comunas y después únicamente uno de los barrios vinculados a esa comuna.
3. En zona rural selecciona uno de los cuatro corregimientos y después únicamente una entrada perteneciente al corregimiento seleccionado. Las siete opciones prefijadas `C.P.` se presentan y almacenan como centros poblados, no como veredas.
4. Escribe el nombre del escenario o cancha y selecciona una disciplina desde el catálogo existente de SIVEC, no desde texto libre.
5. Escoge la ubicación GPS o manual. GPS solo se solicita tras acción explícita del ciudadano y permiso del navegador. La opción manual utiliza exclusivamente los campos territoriales de la jerarquía anterior; no permite digitar latitud o longitud.
6. La ubicación del escenario se mantiene separada de las fotografías. No se usa EXIF como fuente de coordenadas.

Los valores enviados deben conservar la relación zona/comuna/barrio o zona/corregimiento/localidad; no basta con guardar un texto de ubicación sin su jerarquía. Los escenarios nuevos son propuestas pendientes de revisión CMJ y no aparecen en inventario ni mapa oficial mientras no se aprueben e incorporen. Esa revisión es distinta de validar el reporte y de oficializar el semáforo (D1).

## 6. Catálogo de disciplinas en MySQL

### Evidencia disponible y limitación

La auditoría documental de MySQL describe `disciplina` con estas columnas: `id_disciplina`, `nombre`, `categoria`, `poblacion_objetivo`, `estado` y `cupo_maximo`. El esquema documentado declara `categoria` como `ENUM(DEPORTIVA,CULTURAL)` y `estado` como `ENUM(ACTIVA,INACTIVA)` con default `ACTIVA`.

Las relaciones documentadas incluyen:

- `disciplina_entrenador.id_disciplina → disciplina.id_disciplina`.
- `disciplina_escenario.id_disciplina → disciplina.id_disciplina`.
- `inscripcion.id_disciplina → disciplina.id_disciplina`.
- `cronograma` referencia las parejas disciplina-entrenador y disciplina-escenario mediante claves foráneas compuestas.

En esta revisión se intentó consultar `disciplina` y sus metadatos con la configuración local disponible, usando únicamente `SELECT` e `information_schema`. MySQL devolvió `ER_ACCESS_DENIED_ERROR` antes de confirmar la base de datos de destino; no se obtuvieron filas del catálogo ni se verificó que la conexión correspondiera a `deportes`. Por tanto, **no es posible enumerar de forma comprobada las disciplinas registradas actualmente, sus categorías por fila ni sus estados**. Los valores permitidos de los ENUM descritos arriba son evidencia del esquema auditado, no una lista de valores presentes. No se afirma que el catálogo esté completo.

Antes de implementar el selector se debe repetir una consulta de solo lectura con acceso autorizado, limitada a `id_disciplina`, `nombre`, `categoria` y `estado`, y documentar el resultado con fecha/base consultada sin divulgar datos ajenos al catálogo.

### Integración propuesta

- La fuente del selector será la tabla `disciplina`; no se usará texto libre como fuente principal ni se duplicará una lista fija en el frontend.
- El cliente consultará las opciones disponibles a través de un endpoint de catálogo y mostrará el nombre. La solicitud conservará el identificador de disciplina y la API verificará que exista y esté habilitada.
- Como el formulario solicita una **disciplina deportiva** y el catálogo también admite categoría `CULTURAL`, se propone filtrar por `estado = ACTIVA` y `categoria = DEPORTIVA`. Confirmar ese filtro con el responsable antes de implementarlo; no se pudo comprobar cuántas filas cumplen esas condiciones.
- Si no hay disciplinas disponibles o falla el servicio, se debe mostrar un error claro y bloquear el envío de escenario nuevo; no sustituir el catálogo por texto libre.
- El diseño debe tolerar ampliaciones futuras consultando la base de datos, sin requerir una edición manual de una lista frontend. La administración de nuevas disciplinas debe reutilizar el modelo existente y un proceso autorizado por definir; esta documentación no crea ni modifica disciplinas, ni define cambios adicionales de esquema.

## 7. Observaciones y pendientes de verificación

1. La relación territorial procede únicamente del responsable del proyecto y no incluye una fuente institucional. Verificarla oficialmente antes de presentarla como catálogo oficial.
2. Confirmar con fuente institucional los nombres, grafías, límites y clasificación administrativa; conservar este catálogo mientras no se apruebe una corrección.
3. Obtener acceso de solo lectura autorizado para enumerar filas actuales de `disciplina` y revisar categorías, estados y relaciones efectivas en la instancia que se usará.
4. Aprobar si las opciones ciudadanas serán solo disciplinas activas de categoría deportiva, según la propuesta de este documento.
5. Definir el proceso autorizado de administración del catálogo y validar que las asociaciones de escenario/disciplinas propuestas no creen automáticamente vinculaciones operativas.
6. La forma de almacenar jerarquía territorial para solicitudes nuevas deberá diseñarse en la planificación técnica; este documento no prescribe ni ejecuta una migración.

Este documento es una referencia documental para planificar Reportar. No implica implementación, no altera el catálogo actual ni autoriza cambios en MySQL.

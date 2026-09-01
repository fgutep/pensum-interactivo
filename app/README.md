# Pensum Interactivo — prototipo

Prototipo de baja resolución de la vista de estudiante descrita en
`../pensum-interactivo-product-doc.md`. Sin backend, sin panel de admin:
solo el explorador de pensum, para mostrar el concepto.

## Correr localmente

```
npm install
npm run dev
```

## Datos

Los datos del grafo (`src/data/pensum.generated.json`) se generan a partir
de los dos Excel en la raíz del repo (`PENSUMS PREGRADO...xlsx` y
`PRERREQUISITOS TODOS...xlsx`) con:

```
node scripts/build-data.mjs
```

Vuelve a correr ese comando si los Excel de origen cambian. El script:

- Extrae los cursos y semestres sugeridos de la hoja `PLAN PENSUM IELE CBU3`.
- Cruza cada curso con su fila de prerrequisitos/correquisitos en el export
  de Registro, y parsea la expresión (`Y`/`O`/paréntesis) con un parser
  recursivo-descendente en un árbol AND/OR.
- Solo genera aristas del grafo hacia cursos que existen en este mismo
  pensum; requisitos externos (idiomas, exámenes de clasificación, cursos de
  otros pregrados) se muestran como texto pero no bloquean el estado de
  disponibilidad, porque la app no tiene forma de marcarlos como cumplidos.

## Qué es real aquí y qué es simulado

- **Real:** parseo de las dos hojas de cálculo, el árbol de requisitos, el
  motor de disponibilidad (curso disponible / a un curso / bloqueado),
  ruta crítica, búsqueda/filtro, persistencia en `localStorage` + hash de
  URL para compartir el avance.
- **Simplificado a propósito:** sin autenticación, sin edición, sin import
  de Excel en vivo desde la UI (eso vive en el documento de producto como
  fase futura), sin modo accesible de tabla, sin i18n. El layout es una
  cuadrícula fija por semestre en vez de un layout automático con elkjs.

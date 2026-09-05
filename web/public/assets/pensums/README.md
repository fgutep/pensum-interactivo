# Imágenes de cabecera de los planes

Cada catálogo ("pensum") usa una imagen de cabecera propia, referenciada por la
columna `Catalog.imagePath` (p. ej. `/assets/pensums/iele-cbu3.svg`).

Los `.svg` que hay aquí son **provisionales**. Para poner las definitivas:

1. Deja el archivo con el **mismo nombre base** que el slug del plan
   (`iele-cbu3`, `iele-cbu3-pc`, `ielc-cbu3`, `ielc-cbu3-pc`, `doble-cbu3`).
   Puede ser `.jpg`, `.png`, `.webp` o `.svg`.
2. Si cambias la extensión, actualiza `imagePath` en
   `web/lib/catalogIdentity.ts` y vuelve a correr `npm run seed`
   (o edita la columna desde el panel /administrador cuando exista).

Relación de aspecto recomendada: **5:2** (p. ej. 1200×480). La tarjeta recorta
con `object-fit: cover`.

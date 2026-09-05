// Seed-time presentation identity for the 5 known recommended-pensum catalogs.
// The DB columns on `Catalog` are the runtime source of truth; this map only
// feeds the seed. `subtitle` is computed by the seed (semester count), not here.
//
// To swap in a real header image: drop a file at web/public/assets/pensums/<slug>.<ext>
// and point `imagePath` here (then re-seed), or edit the column from the admin panel.

export interface CatalogIdentity {
  accentColor: string;
  tagline: string;
  imagePath: string;
}

const img = (slug: string) => `/assets/pensums/${slug}.svg`;

export const CATALOG_IDENTITY: Record<string, CatalogIdentity> = {
  "iele-cbu3": {
    accentColor: "#0e8a95",
    tagline: "Energía, potencia, máquinas y sistemas eléctricos de gran escala.",
    imagePath: img("iele-cbu3"),
  },
  "iele-cbu3-pc": {
    accentColor: "#0a6b73",
    tagline: "La ruta de Ing. Eléctrica con un semestre de nivelación en matemáticas.",
    imagePath: img("iele-cbu3-pc"),
  },
  "ielc-cbu3": {
    accentColor: "#1f6fc4",
    tagline: "Circuitos, señales, control y sistemas embebidos.",
    imagePath: img("ielc-cbu3"),
  },
  "ielc-cbu3-pc": {
    accentColor: "#17539a",
    tagline: "La ruta de Ing. Electrónica con un semestre de nivelación en matemáticas.",
    imagePath: img("ielc-cbu3-pc"),
  },
  "doble-cbu3": {
    accentColor: "#6d28d9",
    tagline: "Los dos títulos: Ing. Eléctrica e Ing. Electrónica en un solo plan.",
    imagePath: img("doble-cbu3"),
  },
};

export function identityForSlug(slug: string): CatalogIdentity {
  return (
    CATALOG_IDENTITY[slug] ?? {
      accentColor: "#1f6fc4",
      tagline: "",
      imagePath: img(slug),
    }
  );
}

// Ported from app/src/lib/persistence.ts. Progress state stays client-side only
// (no accounts, no server storage). Now namespaced per catalog slug so a student
// can track several pensums independently.

function storageKey(slug: string) {
  return `pensum:${slug}:approved`;
}

export function loadApprovedFromStorage(slug: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(slug));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function saveApprovedToStorage(slug: string, approved: Set<string>) {
  try {
    localStorage.setItem(storageKey(slug), JSON.stringify([...approved]));
  } catch {
    // storage unavailable (private mode, etc.) - state just won't persist
  }
}

/** The slug already lives in the path, so the hash only carries the code list. */
export function loadApprovedFromHash(): Set<string> | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash.startsWith("aprobadas=")) return null;
  const encoded = hash.slice("aprobadas=".length);
  try {
    const csv = decodeURIComponent(encoded);
    if (!csv) return new Set();
    return new Set(csv.split(","));
  } catch {
    return null;
  }
}

export function approvedToShareUrl(approved: Set<string>): string {
  const csv = [...approved].join(",");
  const url = new URL(window.location.href);
  url.hash = `aprobadas=${encodeURIComponent(csv)}`;
  return url.toString();
}

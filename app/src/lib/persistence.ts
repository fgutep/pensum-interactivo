const STORAGE_KEY = "pensum-iele-approved";

export function loadApprovedFromStorage(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

export function saveApprovedToStorage(approved: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...approved]));
  } catch {
    // storage unavailable (private mode, etc.) - state just won't persist
  }
}

export function loadApprovedFromHash(): Set<string> | null {
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

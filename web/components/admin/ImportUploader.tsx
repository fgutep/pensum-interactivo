"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ImportUploader() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("planes", file);
      const res = await fetch("/api/admin/imports", { method: "POST", body: fd });
      const data = (await res.json()) as { jobId?: number; error?: string };
      if (res.ok && data.jobId) {
        router.push(`/administrador/importar/${data.jobId}`);
        router.refresh();
        return;
      }
      setError(data.error ?? "No se pudo procesar el archivo.");
    } catch {
      setError("Error de red.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-card" onSubmit={submit}>
      <h2>Subir PLANES.xlsx</h2>
      <p className="admin-note">
        La plantilla vigente se genera con <code>npm run export:templates</code>.
        Al subirla se calcula un diff contra la base; nada se aplica hasta que lo
        confirmes.
      </p>
      <input
        className="admin-file"
        type="file"
        accept=".xlsx"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <button className="admin-btn primary" type="submit" disabled={!file || busy}>
        {busy ? "Procesando…" : "Calcular diff"}
      </button>
      {error && <div className="admin-error">{error}</div>}
    </form>
  );
}

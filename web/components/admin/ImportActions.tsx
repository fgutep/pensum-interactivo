"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  jobId: number;
  status: string;
  removals: number;
  conflicts: number;
}

export default function ImportActions({ jobId, status, removals, conflicts }: Props) {
  const router = useRouter();
  const [confirmRemovals, setConfirmRemovals] = useState(false);
  const [forceConflicts, setForceConflicts] = useState(false);
  const [busy, setBusy] = useState<"apply" | "discard" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { applied: boolean }>(null);

  if (status === "applied" || done?.applied) {
    return (
      <div className="import-applied">
        Import aplicado. Los cursos nuevos quedan como <b>por revisar</b> — usa
        “Re-sync” en Catálogos para traer la oferta.
      </div>
    );
  }
  if (status === "discarded") {
    return <div className="admin-note">Este import fue descartado.</div>;
  }

  async function run(kind: "apply" | "discard") {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(`/api/admin/imports/${jobId}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          kind === "apply" ? { confirmRemovals, forceConflicts } : {}
        ),
      });
      const data = (await res.json()) as { error?: string; applied?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Falló la operación.");
        return;
      }
      if (kind === "apply") {
        setDone({ applied: true });
      } else {
        router.push("/administrador/importar");
      }
      router.refresh();
    } catch {
      setError("Error de red.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="import-actions">
      {removals > 0 && (
        <label>
          <input
            type="checkbox"
            checked={confirmRemovals}
            onChange={(e) => setConfirmRemovals(e.target.checked)}
          />
          Eliminar los {removals} curso(s) que ya no están en el Excel
        </label>
      )}
      {conflicts > 0 && (
        <label>
          <input
            type="checkbox"
            checked={forceConflicts}
            onChange={(e) => setForceConflicts(e.target.checked)}
          />
          Sobrescribir los {conflicts} campo(s) bloqueado(s) / editado(s) a mano
        </label>
      )}
      <button
        className="admin-btn primary"
        disabled={busy !== null}
        onClick={() => run("apply")}
      >
        {busy === "apply" ? "Aplicando…" : "Aplicar"}
      </button>
      <button
        className="admin-btn danger"
        disabled={busy !== null}
        onClick={() => run("discard")}
      >
        Descartar
      </button>
      {error && <span className="admin-error">{error}</span>}
    </div>
  );
}

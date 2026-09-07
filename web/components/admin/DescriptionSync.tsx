"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  total: number;
  withDescription: number;
  missing: string[];
}

const CHUNK = 8;

export default function DescriptionSync({ total, withDescription, missing }: Props) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [got, setGot] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const stopRef = useRef(false);

  const target = missing.length;

  async function run() {
    setRunning(true);
    stopRef.current = false;
    setDone(0);
    setGot(0);
    setFailed([]);
    let queue = [...missing];
    let processed = 0;
    let updated = 0;
    const misses: string[] = [];

    while (queue.length > 0 && !stopRef.current) {
      const batch = queue.slice(0, CHUNK);
      let res: Response;
      try {
        res = await fetch("/api/admin/descriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codes: batch, limit: CHUNK }),
        });
      } catch {
        misses.push(...batch);
        break;
      }
      const d = (await res.json()) as {
        updated: string[];
        notFound: string[];
        errors: string[];
      };
      updated += d.updated.length;
      misses.push(...d.notFound, ...d.errors);
      processed += batch.length;
      queue = queue.slice(CHUNK);
      setDone(processed);
      setGot(updated);
      setFailed([...misses]);
    }
    setRunning(false);
    router.refresh();
  }

  const pct = target ? Math.round((done / target) * 100) : 100;

  return (
    <div className="admin-card">
      <h2>Cobertura</h2>
      <p className="admin-note">
        {withDescription} / {total} materias con descripción.
      </p>
      {(running || done > 0) && (
        <>
          <div className="admin-progress">
            <i style={{ width: `${pct}%` }} />
          </div>
          <p className="admin-note">
            {done} / {target} procesadas · {got} nuevas
            {failed.length > 0 && ` · ${failed.length} sin resultado`}
          </p>
        </>
      )}
      <div className="admin-section-actions">
        {!running ? (
          <button
            className="admin-btn primary"
            disabled={target === 0}
            onClick={run}
          >
            Sincronizar faltantes ({target})
          </button>
        ) : (
          <button
            className="admin-btn danger"
            onClick={() => {
              stopRef.current = true;
            }}
          >
            Detener
          </button>
        )}
      </div>
      <p className="admin-note" style={{ marginTop: 8 }}>
        Para una pasada completa offline: <code>npm run scrape:desc</code>.
      </p>
    </div>
  );
}

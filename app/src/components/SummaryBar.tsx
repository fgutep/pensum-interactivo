interface Props {
  mode: "explore" | "progress";
  onModeChange: (mode: "explore" | "progress") => void;
  creditsDone: number;
  creditsTotal: number;
  criticalPath: number;
  onShare: () => void;
  shareFeedback: string | null;
}

export default function SummaryBar({
  mode,
  onModeChange,
  creditsDone,
  creditsTotal,
  criticalPath,
  onShare,
  shareFeedback,
}: Props) {
  return (
    <div className="summary-bar">
      <div className="mode-toggle">
        <button
          className={mode === "explore" ? "active" : ""}
          onClick={() => onModeChange("explore")}
        >
          Explorar
        </button>
        <button
          className={mode === "progress" ? "active" : ""}
          onClick={() => onModeChange("progress")}
        >
          Mi avance
        </button>
      </div>

      {mode === "progress" && (
        <div className="summary-stats">
          <div className="stat">
            <span className="stat-value">
              {creditsDone} / {creditsTotal}
            </span>
            <span className="stat-label">créditos aprobados</span>
          </div>
          <div className="stat">
            <span className="stat-value">{criticalPath}</span>
            <span className="stat-label">semestres mínimos restantes</span>
          </div>
          <button className="share-button" onClick={onShare}>
            {shareFeedback ?? "Copiar enlace de mi avance"}
          </button>
        </div>
      )}
    </div>
  );
}

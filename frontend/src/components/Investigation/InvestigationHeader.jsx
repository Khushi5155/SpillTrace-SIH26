import InvestigationStepper from "./InvestigationStepper";

const STATUS = {
  running: { label: "DETECTING", tone: "running" },
  failed: { label: "DETECTION FAILED", tone: "failed" },
  ready: { label: "DETECTION NOT RUN", tone: "idle" },
  blocked: { label: "NO DETECTION", tone: "idle" },
};

export default function InvestigationHeader({
  title,
  spillId,
  sceneId,
  stages,
  hasSlick,
  detectionComplete,
  next,
  onGo,
  onExport,
  exporting,
  notices,
}) {
  let status = STATUS[stages.detection.state] || { label: "", tone: "idle" };
  if (stages.detection.state === "complete") {
    status = hasSlick
      ? { label: "DETECTION COMPLETE", tone: "complete" }
      : { label: detectionComplete ? "NO SLICK DETECTED" : "DETECTION COMPLETE", tone: "warn" };
  }

  return (
    <header className="inv-header">
      <div className="inv-header-main">
        <div className="inv-title">
          <p className="eyebrow">SPILLTRACE / INVESTIGATION</p>
          <h1 title={title}>{title}</h1>
          <p className="inv-sub">
            <span className={`status-pill status-${status.tone}`}>
              <span className="status-dot" /> {status.label}
            </span>
            <span className="mono">ID {spillId}</span>
            {sceneId && <span>Scene {sceneId}</span>}
          </p>
        </div>

        <div className="inv-header-side">
          <InvestigationStepper stages={stages} next={next} onGo={onGo} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={onExport} disabled={exporting}>
            {exporting ? "Exporting…" : "Export report"}
          </button>
        </div>
      </div>

      {next && (
        <div className="next-action">
          <span className="next-label">NEXT</span>
          <span>{next.text}</span>
          <button type="button" className="link-button" onClick={() => onGo(next.stage)}>
            Go to step ↓
          </button>
        </div>
      )}

      {notices}
    </header>
  );
}

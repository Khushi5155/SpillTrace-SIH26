/**
 * CompatibilityStatus
 *
 * Reusable status component for scene/spill compatibility.
 * Supports: PASS/SUCCESS, WARNING, BLOCKED, INSUFFICIENT_DATA, UNKNOWN/ERROR, LOADING.
 *
 * Backend contract note: the current /api/scenes/{id}/compatibility
 * endpoint only ever returns { compatible: false, reasons: [...] }
 * (see app/services/scene_service.py). There is no "warning" or
 * "insufficient_data" state coming from that endpoint today — those
 * statuses exist here because the candidate-ranking endpoint (Day 7)
 * returns a real HTTP 409 with its own reasons, and because the
 * schema (CompatibilityStatus in app/schemas/candidate.py) defines a
 * "blocked" / "passed" status literal. This component renders
 * whatever status is actually passed to it; it never invents one.
 */

const STATUS_CONFIG = {
  pass: {
    label: "PASS",
    title: "Scenario is ready for analysis",
    description: "SAR, AIS and environmental data are temporally and spatially compatible.",
  },
  success: {
    label: "PASS",
    title: "Scenario is ready for analysis",
    description: "SAR, AIS and environmental data are temporally and spatially compatible.",
  },
  warning: {
    label: "WARNING",
    title: "Scenario has data quality limitations",
    description: "Analysis can continue, but some inputs may contain gaps or uncertainty.",
  },
  blocked: {
    label: "BLOCKED",
    title: "Candidate attribution unavailable",
    description: "The selected data sources are not compatible enough for candidate ranking.",
  },
  insufficient_data: {
    label: "INSUFFICIENT DATA",
    title: "Not enough data to evaluate compatibility",
    description: "The backend does not have enough SAR, AIS, or environmental data to determine compatibility.",
  },
  unknown: {
    label: "UNKNOWN",
    title: "Compatibility could not be determined",
    description: "The backend response could not be interpreted.",
  },
  error: {
    label: "ERROR",
    title: "Compatibility check failed",
    description: "The backend could not be reached or returned an error.",
  },
  loading: {
    label: "CHECKING…",
    title: "Checking data compatibility",
    description: "Waiting on the backend compatibility check.",
  },
};

function normalizeStatus(rawStatus) {
  const key = String(rawStatus || "unknown").toLowerCase();
  return STATUS_CONFIG[key] ? key : "unknown";
}

function CompatibilityStatus({ compatibility, onRankCandidates, rankDisabled }) {
  const rawStatus = compatibility?.status;
  const status = normalizeStatus(rawStatus);
  const reasons = compatibility?.reasons || [];
  const current = STATUS_CONFIG[status];

  const blockingStatuses = ["blocked", "insufficient_data", "unknown", "error", "loading"];
  const isBlocked = blockingStatuses.includes(status);

  return (
    <div className={`compatibility-status compatibility-${status}`}>
      <div className="compatibility-header">
        <div>
          <span className="section-label">DATA COMPATIBILITY</span>
          <h3>{current.title}</h3>
        </div>
        <span className="compatibility-badge">{current.label}</span>
      </div>

      <p>{current.description}</p>

      {reasons.length > 0 && (
        <ul className="compatibility-reasons">
          {reasons.map((reason, index) => (
            <li key={index}>{reason}</li>
          ))}
        </ul>
      )}

      {onRankCandidates && (
        <button
          type="button"
          className="primary-button"
          disabled={isBlocked || rankDisabled}
          onClick={onRankCandidates}
        >
          {isBlocked ? "Candidate Ranking Unavailable" : "Rank Candidates →"}
        </button>
      )}

      {isBlocked && (
        <p className="compatibility-explain">
          Candidate attribution is unavailable for this investigation because the backend-reported
          compatibility check did not pass. {reasons.length === 0 && "No specific reason was returned by the backend."}
        </p>
      )}
    </div>
  );
}

export default CompatibilityStatus;

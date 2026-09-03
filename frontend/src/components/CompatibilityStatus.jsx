function CompatibilityStatus({ compatibility, onRankCandidates }) {
  const status = compatibility?.status || "blocked";
  const reasons = compatibility?.reasons || [];

  const config = {
    compatible: {
      label: "COMPATIBLE",
      title: "Scenario is ready for analysis",
      description:
        "SAR, AIS and environmental data are temporally and spatially compatible.",
    },

    warning: {
      label: "WARNING",
      title: "Scenario has data quality limitations",
      description:
        "Analysis can continue, but some inputs may contain gaps or uncertainty.",
    },

    blocked: {
      label: "BLOCKED",
      title: "Candidate attribution unavailable",
      description:
        "The selected data sources are not compatible enough for candidate ranking.",
    },
  };

  const current = config[status] || config.blocked;

  const isBlocked = status === "blocked";

  return (
    <div
      className={`compatibility-status compatibility-${status}`}
    >
      <div className="compatibility-header">
        <div>
          <span className="section-label">
            DATA COMPATIBILITY
          </span>

          <h3>
            {current.title}
          </h3>
        </div>

        <span className="compatibility-badge">
          {current.label}
        </span>
      </div>

      <p>
        {current.description}
      </p>

      {reasons.length > 0 && (
        <ul className="compatibility-reasons">
          {reasons.map((reason, index) => (
            <li key={index}>
              {reason}
            </li>
          ))}
        </ul>
      )}

      <button
        className="primary-button"
        disabled={isBlocked}
        onClick={onRankCandidates}
      >
        {isBlocked
          ? "Candidate Ranking Unavailable"
          : "Rank Candidates →"}
      </button>
    </div>
  );
}

export default CompatibilityStatus;

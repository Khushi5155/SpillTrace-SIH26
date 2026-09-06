function CandidateCard({ candidate, isSelected, onSelect }) {
  const scorePercent = Math.round((candidate.score ?? 0) * 100);
  const quality = candidate.ais_quality || {};
  const type = candidate.vessel_type || candidate.vesselType || "Type not provided";

  return (
    <button type="button" className={`candidate-card ${isSelected ? "selected" : ""}`} onClick={onSelect}>
      <div className="candidate-top">
        <div className="rank">#{candidate.rank}</div>
        <div className="candidate-main">
          <strong>{candidate.vessel_name || "Unknown Vessel"}</strong>
          <span>MMSI {candidate.mmsi || "Not provided"}</span>
          <small>{type}</small>
        </div>
        <div className="candidate-score">{scorePercent}%</div>
      </div>

      <div className="candidate-progress">
        <div style={{ width: `${scorePercent}%` }} />
      </div>

      <div className="candidate-bottom">
        <span>Continuity {Math.round((quality.track_continuity ?? 0) * 100)}%</span>
        <span>{candidate.label || "Candidate under available evidence"}</span>
      </div>
    </button>
  );
}

export default CandidateCard;

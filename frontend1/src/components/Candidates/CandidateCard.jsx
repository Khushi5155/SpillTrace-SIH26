/**
 * CandidateCard
 *
 * Renders one CandidateResult exactly as returned by
 * POST /api/v1/spills/{id}/candidates/rank (app/schemas/candidate.py).
 * Every field used here exists on that schema — nothing invented.
 */

function CandidateCard({ candidate, isSelected, onSelect }) {
  const scorePercent = Math.round((candidate.score ?? 0) * 100);

  return (
    <button type="button" className={`candidate-card ${isSelected ? "selected" : ""}`} onClick={onSelect}>
      <div className="candidate-top">
        <div className="rank">#{candidate.rank}</div>

        <div className="candidate-main">
          <strong>{candidate.vessel_name || "Unknown Vessel"}</strong>
          <span>MMSI {candidate.mmsi}</span>
        </div>

        <div className="candidate-score">{scorePercent}%</div>
      </div>

      <div className="candidate-progress">
        <div style={{ width: `${scorePercent}%` }} />
      </div>

      <div className="candidate-bottom">
        <span>Continuity {Math.round((candidate.ais_quality?.track_continuity ?? 0) * 100)}%</span>
        <span>{candidate.label}</span>
      </div>
    </button>
  );
}

export default CandidateCard;

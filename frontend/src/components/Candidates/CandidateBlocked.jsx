/**
 * CandidateBlocked
 *
 * Shown whenever candidate ranking cannot run — either because scene
 * compatibility is not PASS, or because POST .../candidates/rank
 * returned HTTP 409 (COMPATIBILITY_FAILED, see
 * app/services/candidate_service.py::_blocked_error).
 *
 * Always prefers the backend's own reason text over the hardcoded
 * fallback sentence.
 */

function CandidateBlocked({ reason, details }) {
  return (
    <div className="candidate-blocked">
      <strong>Candidate ranking unavailable</strong>
      <p>
        {reason ||
          "Candidate attribution is unavailable for this investigation because the SAR/drift reference time and available AIS data do not satisfy the temporal compatibility requirement."}
      </p>

      {details && (
        <div className="quality-reasons">
          <div className="quality-reasons-title">Backend Compatibility Details</div>
          {details.temporal_overlap !== undefined && (
            <div className="quality-note">Temporal overlap: {String(details.temporal_overlap)}</div>
          )}
          {details.geographic_overlap !== undefined && (
            <div className="quality-note">Geographic overlap: {String(details.geographic_overlap)}</div>
          )}
          {details.crs_valid !== undefined && <div className="quality-note">CRS valid: {String(details.crs_valid)}</div>}
          {details.environmental_coverage !== undefined && (
            <div className="quality-note">Environmental coverage: {String(details.environmental_coverage)}</div>
          )}
          {Array.isArray(details.reasons) &&
            details.reasons.map((r, i) => (
              <div className="quality-note" key={i}>
                {r}
              </div>
            ))}
        </div>
      )}

      <div className="empty-state">No fake candidates or AIS tracks are shown while attribution is blocked.</div>
    </div>
  );
}

export default CandidateBlocked;

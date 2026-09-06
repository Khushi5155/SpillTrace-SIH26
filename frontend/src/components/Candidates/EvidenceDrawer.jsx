/**
 * EvidenceDrawer
 *
 * Expandable evidence panel for a selected candidate. Uses only
 * fields that exist on CandidateResult (app/schemas/candidate.py):
 * score_contributions, weighted_contributions, ais_quality,
 * drift_evidence, evidence_statements. No field is invented — if a
 * sub-field is missing, it's simply not rendered.
 */

const CONTRIBUTION_LABELS = {
  spatial: "Spatial Proximity",
  temporal: "Temporal Overlap",
  heading: "Heading Consistency",
  intersection: "Corridor Intersection",
  continuity: "Track Continuity",
  quality: "AIS Quality",
};

function EvidenceDrawer({ candidate }) {
  if (!candidate) return null;

  const contributions = candidate.score_contributions || {};
  const weighted = candidate.weighted_contributions || {};
  const aisQuality = candidate.ais_quality || {};
  const drift = candidate.drift_evidence || {};

  return (
    <section className="evidence-panel selected-evidence">
      <div className="panel-header">
        <div>
          <div className="panel-kicker">SELECTED CANDIDATE</div>
          <h2>{candidate.vessel_name || "Unknown Vessel"}</h2>
        </div>
        <span className="confidence-badge candidate">{Math.round((candidate.score ?? 0) * 100)}%</span>
      </div>

      <div className="candidate-meta">
        <span>MMSI: {candidate.mmsi}</span>
        <span>Rank #{candidate.rank}</span>
      </div>

      <div className="subheading">Why this score?</div>
      <div className="feature-list">
        {Object.entries(contributions).map(([key, value]) => (
          <div className="feature-row" key={key}>
            <span>{CONTRIBUTION_LABELS[key] || key}</span>
            <div className="feature-score">
              <div className="feature-bar">
                <div style={{ width: `${Math.round(value * 100)}%` }} />
              </div>
              <strong>
                {Math.round(value * 100)}%{weighted[key] != null && ` (weighted ${weighted[key].toFixed(3)})`}
              </strong>
            </div>
          </div>
        ))}
      </div>

      <div className="subheading">AIS Quality</div>
      <div className="metric-grid">
        <div>
          <span>Track Continuity</span>
          <strong>{Math.round((aisQuality.track_continuity ?? 0) * 100)}%</strong>
        </div>
        <div>
          <span>Data Completeness</span>
          <strong>{Math.round((aisQuality.data_completeness ?? 0) * 100)}%</strong>
        </div>
        <div>
          <span>Position Count</span>
          <strong>{aisQuality.position_count ?? "Not provided by backend"}</strong>
        </div>
        <div>
          <span>Gap Count</span>
          <strong>{aisQuality.gap_count ?? "Not provided by backend"}</strong>
        </div>
        <div>
          <span>Source</span>
          <strong>{aisQuality.source || "Not provided by backend"}</strong>
        </div>
      </div>

      <div className="subheading">Drift Evidence</div>
      <div className="metric-grid">
        <div>
          <span>Run Type</span>
          <strong>{drift.run_type || "Not provided by backend"}</strong>
        </div>
        <div>
          <span>Mode</span>
          <strong>{drift.mode || "Not provided by backend"}</strong>
        </div>
        <div>
          <span>Uncertainty Radius</span>
          <strong>{drift.uncertainty_radius_m != null ? `${drift.uncertainty_radius_m} m` : "Not provided by backend"}</strong>
        </div>
        <div>
          <span>Corridor Reference</span>
          <strong>{drift.corridor_reference || "Not provided by backend"}</strong>
        </div>
      </div>

      {Array.isArray(candidate.evidence_statements) && candidate.evidence_statements.length > 0 && (
        <>
          <div className="subheading">Evidence Statements</div>
          <ul className="compatibility-reasons">
            {candidate.evidence_statements.map((statement, i) => (
              <li key={i}>{statement}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export default EvidenceDrawer;

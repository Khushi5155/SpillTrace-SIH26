import { useState } from "react";

/**
 * AISQualityPanel
 *
 * Collapsible ETL / data-quality panel (Day 5). Shows the scene
 * compatibility fields returned by the backend
 * (GET /api/scenes/{id}/compatibility -> CompatibilityStatus in
 * app/schemas/contracts.py: compatible, reasons, temporal_overlap,
 * geographic_overlap, crs_valid, environmental_coverage).
 *
 * There is currently no AIS-specific quality endpoint (no
 * ais_completeness / track_continuity / gap_stats source exists on
 * this backend), so this panel only ever shows the scene-level
 * compatibility fields, honestly labelled as such.
 */

function getStatus(value) {
  if (value === true) return "AVAILABLE";
  if (value === false) return "INVALID";
  if (value === null || value === undefined) return "NOT AVAILABLE";
  return String(value).toUpperCase();
}

function getStatusClass(value) {
  if (value === true) return "quality-good";
  if (value === false) return "quality-bad";
  return "quality-neutral";
}

function AISQualityPanel({ compatibility }) {
  const [isOpen, setIsOpen] = useState(false);
  const data = compatibility ?? {};

  return (
    <section className="data-quality-panel">
      <button type="button" className="data-quality-header" onClick={() => setIsOpen((v) => !v)} aria-expanded={isOpen}>
        <div>
          <span className="section-label">DATA QUALITY</span>
          <h3>ETL &amp; Source Quality</h3>
          <p>Backend-reported input compatibility and data quality information.</p>
        </div>
        <span className="data-quality-toggle">{isOpen ? "−" : "+"}</span>
      </button>

      {isOpen && (
        <div className="data-quality-content">
          <div className="quality-row">
            <div>
              <strong>CRS Validation</strong>
              <span>Coordinate reference system validity</span>
            </div>
            <span className={`quality-status ${getStatusClass(data.crs_valid)}`}>{getStatus(data.crs_valid)}</span>
          </div>

          <div className="quality-row">
            <div>
              <strong>Temporal Overlap</strong>
              <span>SAR / AIS / environmental time coverage</span>
            </div>
            <span className={`quality-status ${getStatusClass(data.temporal_overlap)}`}>
              {getStatus(data.temporal_overlap)}
            </span>
          </div>

          <div className="quality-row">
            <div>
              <strong>Geographic Overlap</strong>
              <span>Spatial coverage between input datasets</span>
            </div>
            <span className={`quality-status ${getStatusClass(data.geographic_overlap)}`}>
              {getStatus(data.geographic_overlap)}
            </span>
          </div>

          <div className="quality-row">
            <div>
              <strong>Environmental Coverage</strong>
              <span>Wind and ocean-current coverage</span>
            </div>
            <span className={`quality-status ${getStatusClass(data.environmental_coverage)}`}>
              {getStatus(data.environmental_coverage)}
            </span>
          </div>

          <div className="quality-row">
            <div>
              <strong>Overall Compatibility</strong>
              <span>Whether the scenario can support attribution</span>
            </div>
            <span className={`quality-status ${data.compatible ? "quality-good" : "quality-bad"}`}>
              {data.compatible ? "COMPATIBLE" : "BLOCKED"}
            </span>
          </div>

          {Array.isArray(data.reasons) && data.reasons.length > 0 && (
            <div className="quality-reasons">
              <div className="quality-reasons-title">Backend Notes</div>
              {data.reasons.map((reason, index) => (
                <div className="quality-note" key={`${reason}-${index}`}>
                  {reason}
                </div>
              ))}
            </div>
          )}

          <div className="quality-footnote">
            AIS-specific quality metrics (completeness, track continuity, gap stats) are not yet exposed by this
            backend — there is no AIS data source wired up. Only scene-level compatibility fields are shown above.
          </div>
        </div>
      )}
    </section>
  );
}

export default AISQualityPanel;

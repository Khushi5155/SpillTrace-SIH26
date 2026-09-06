/**
 * SlickMetrics
 *
 * Displays whatever the backend actually returns for a detection.
 *
 * Backend reality check (app/schemas/detection.py DetectionMetadata):
 *   - There is NO area_sq_km / perimeter field on DetectionMetadata.
 *     (SpillResponse from the /spills/{id}/detect MOCK endpoint does
 *     have area_sq_km, but that's the hardcoded-mock endpoint, not
 *     the real detector — we label that distinction in the UI.)
 *   - centroid: list[float] | None — shown as lon/lat per GeoJSON order.
 *   - total_slicks_detected, pixel_count_after_cleanup: optional ints.
 *   - detector_name, model_name: always present (with defaults).
 *   - probability_threshold: always present (default 0.30).
 *   - No detection "confidence" score field exists on the response at all.
 *
 * Anything not present is shown as "Not provided by backend" rather
 * than computed or guessed.
 */

function SlickMetrics({ metadata, mockArea, isMockSource }) {
  if (!metadata) {
    return (
      <div className="metric-grid">
        <div className="empty-state">No detection metadata available yet.</div>
      </div>
    );
  }

  const centroid = Array.isArray(metadata.centroid) && metadata.centroid.length === 2 ? metadata.centroid : null;

  return (
    <div className="metric-grid">
      <div>
        <span>Detector</span>
        <strong>{metadata.detector_name || "Not provided by backend"}</strong>
      </div>

      <div>
        <span>Model</span>
        <strong>{metadata.model_name || "Not provided by backend"}</strong>
      </div>

      <div>
        <span>Slick Centroid</span>
        {centroid ? (
          <strong>
            Lat {Number(centroid[1]).toFixed(4)}, Lon {Number(centroid[0]).toFixed(4)}
          </strong>
        ) : (
          <strong>Not provided by backend</strong>
        )}
      </div>

      <div>
        <span>Slick Area</span>
        <strong>
          {isMockSource && mockArea != null
            ? `${mockArea} km² (mock endpoint)`
            : "Not provided by backend"}
        </strong>
      </div>

      <div>
        <span>Slick Perimeter</span>
        <strong>Not provided by backend</strong>
      </div>

      <div>
        <span>Detection Confidence</span>
        <strong>Not provided by backend</strong>
      </div>

      <div>
        <span>Number of Slicks</span>
        <strong>{metadata.total_slicks_detected ?? "Not provided by backend"}</strong>
      </div>

      <div>
        <span>Probability Threshold</span>
        <strong>{metadata.probability_threshold ?? "Not provided by backend"}</strong>
      </div>

      {metadata.fallback_used && (
        <div className="metadata-wide">
          <span>Fallback Used</span>
          <strong>{metadata.fallback_reason || "Yes (no reason provided)"}</strong>
        </div>
      )}
    </div>
  );
}

export default SlickMetrics;

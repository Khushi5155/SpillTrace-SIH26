/**
 * AISTrackInfo
 *
 * Shown when an AIS track is selected on the map. There is currently
 * no backend AIS source, so this component always renders the
 * "unavailable" state — it exists so the integration point is ready
 * the day GET /api/v1/ais/tracks (or equivalent) is implemented.
 */

function AISTrackInfo({ track, compatibilityBlocked, blockedReason }) {
  if (compatibilityBlocked) {
    return (
      <div className="ais-track-info ais-blocked">
        <strong>Vessel attribution unavailable</strong>
        <p>{blockedReason || "Compatibility check did not pass for this investigation."}</p>
      </div>
    );
  }

  if (!track) {
    return (
      <div className="ais-track-info ais-empty">
        <strong>AIS tracks not available</strong>
        <p>
          This backend does not currently expose an AIS tracks endpoint. No vessel positions, MMSIs, or timestamps
          are fabricated here — this panel will populate once a real AIS data source is wired up.
        </p>
      </div>
    );
  }

  const p = track.properties || {};

  return (
    <div className="ais-track-info">
      <strong>{p.vessel_name || "Unknown vessel"}</strong>
      <div className="quality-row">
        <span>MMSI</span>
        <span>{p.mmsi || "Not provided by backend"}</span>
      </div>
      <div className="quality-row">
        <span>Type</span>
        <span>{p.vessel_type || "Not provided by backend"}</span>
      </div>
      <div className="quality-row">
        <span>Speed</span>
        <span>{p.speed_knots != null ? `${p.speed_knots} kn` : "Not provided by backend"}</span>
      </div>
      <div className="quality-row">
        <span>Course</span>
        <span>{p.course_degrees != null ? `${p.course_degrees}°` : "Not provided by backend"}</span>
      </div>
      <div className="quality-row">
        <span>Data Quality</span>
        <span>{p.data_quality_status || "Not provided by backend"}</span>
      </div>
    </div>
  );
}

export default AISTrackInfo;

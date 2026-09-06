/**
 * AISTimeline
 *
 * Scrubs through a selected candidate's AIS track timestamps.
 * timestamps_utc[i] corresponds to coordinates[i] — no interpolation
 * is ever performed; the slider only ever snaps to real indices.
 *
 * Since no AIS source exists on this backend yet, `timestamps` will
 * normally be empty and this renders the explicit unavailable state.
 */

function AISTimeline({ timestamps, selectedIndex, onChange }) {
  if (!Array.isArray(timestamps) || timestamps.length === 0) {
    return (
      <div className="timeline-section">
        <div className="timeline-header">
          <h2>Timeline</h2>
        </div>
        <div className="empty-state">No AIS timestamps available for this candidate.</div>
      </div>
    );
  }

  const current = timestamps[selectedIndex] ?? timestamps[0];

  return (
    <div className="timeline-section">
      <div className="timeline-header">
        <h2>Timeline</h2>
        <strong>{current}</strong>
      </div>

      <input
        type="range"
        className="timeline-slider"
        min={0}
        max={timestamps.length - 1}
        step={1}
        value={selectedIndex}
        onChange={(e) => onChange(Number(e.target.value))}
      />

      <div className="timeline-labels">
        <span>{timestamps[0]}</span>
        <span>{timestamps[timestamps.length - 1]}</span>
      </div>
    </div>
  );
}

export default AISTimeline;

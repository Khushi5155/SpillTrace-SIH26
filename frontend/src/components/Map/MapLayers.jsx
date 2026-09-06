/**
 * MapLayers
 *
 * Layer visibility toggles for the investigation map (Day 8).
 * Each toggle is independently controllable and disabled when its
 * underlying data isn't available, so the analyst never toggles on
 * a layer that has nothing to show.
 */

const LAYER_DEFS = [
  { key: "sarSource", label: "SAR Source" },
  { key: "slick", label: "Slick Polygon" },
  { key: "hindcastOrigin", label: "Hindcast Origin" },
  { key: "forecastCorridor", label: "Forecast Corridor" },
  { key: "aisTracks", label: "AIS Tracks" },
  { key: "candidateTrack", label: "Candidate Track" },
];

function MapLayers({ layers, onToggle, availability }) {
  return (
    <div className="map-layers-panel">
      <div className="section-label">LAYERS</div>
      {LAYER_DEFS.map(({ key, label }) => {
        const available = availability?.[key] !== false;
        return (
          <label key={key} className={`map-layer-toggle ${!available ? "disabled" : ""}`}>
            <input
              type="checkbox"
              checked={!!layers[key]}
              disabled={!available}
              onChange={() => onToggle(key)}
            />
            <span>{label}</span>
            {!available && <small>Unavailable</small>}
          </label>
        );
      })}
    </div>
  );
}

export default MapLayers;

import { useState } from "react";
import { BASEMAPS, MAP_COLORS } from "../../utils/mapStyles";

/**
 * Compact floating layer control. Layers with no data yet are shown dimmed
 * and cannot be toggled, so the analyst never toggles a layer with nothing
 * to show.
 */
const LAYER_DEFS = [
  { key: "slick", label: "Slick", color: MAP_COLORS.slick },
  { key: "hindcastOrigin", label: "Hindcast", color: MAP_COLORS.hindcast },
  { key: "forecastCorridor", label: "Forecast", color: MAP_COLORS.forecast },
  { key: "aisTracks", label: "AIS", color: MAP_COLORS.ais },
  { key: "candidateTrack", label: "Candidate", color: MAP_COLORS.candidate },
  { key: "sarSource", label: "SAR extent", color: MAP_COLORS.extent },
];

function MapLayers({ layers, onToggle, availability, basemap, onBasemap, onFit }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="map-layers">
      <button
        type="button"
        className="map-layers-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>LAYERS</span>
        <span aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="map-layers-body">
          {LAYER_DEFS.map(({ key, label, color }) => {
            const available = availability?.[key] !== false;
            return (
              <label
                key={key}
                className={`map-layer-toggle ${!available ? "disabled" : ""}`}
                title={available ? undefined : "No data for this layer yet"}
              >
                <input
                  type="checkbox"
                  checked={!!layers[key] && available}
                  disabled={!available}
                  onChange={() => onToggle(key)}
                />
                <span className="swatch" style={{ background: color }} />
                <span>{label}</span>
              </label>
            );
          })}

          <div className="map-layers-foot">
            <div className="segmented" role="group" aria-label="Basemap">
              {Object.entries(BASEMAPS).map(([id, b]) => (
                <button
                  key={id}
                  type="button"
                  className={basemap === id ? "active" : ""}
                  onClick={() => onBasemap(id)}
                >
                  {b.label}
                </button>
              ))}
            </div>
            <button type="button" className="map-fit-button" onClick={onFit}>
              Fit view
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MapLayers;

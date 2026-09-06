function MapLegend() {
  return (
    <div className="map-legend">
      <div className="legend-title">LEGEND</div>

      <div className="legend-item">
        <span className="legend-marker" style={{ background: "#94a3b8" }} />
        <span>SAR scene extent</span>
      </div>

      <div className="legend-item">
        <span className="legend-marker" style={{ background: "#e6533c" }} />
        <span>Observed slick</span>
      </div>

      <div className="legend-item">
        <span className="legend-line" style={{ borderTopColor: "#7c5cff" }} />
        <span>Hindcast origin corridor</span>
      </div>

      <div className="legend-item">
        <span className="legend-line" style={{ borderTopColor: "#2fb8a3" }} />
        <span>Forecast corridor</span>
      </div>

      <div className="legend-item">
        <span className="legend-line" style={{ borderTopColor: "#3b82f6" }} />
        <span>AIS vessel track</span>
      </div>

      <div className="legend-item">
        <span className="legend-line" style={{ borderTopColor: "#facc15" }} />
        <span>Selected candidate track</span>
      </div>
    </div>
  );
}

export default MapLegend;

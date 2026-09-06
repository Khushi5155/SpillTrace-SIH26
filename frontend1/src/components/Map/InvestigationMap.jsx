import { MapContainer, TileLayer, GeoJSON, Rectangle, Popup, useMap } from "react-leaflet";
import { useEffect, useMemo } from "react";
import "leaflet/dist/leaflet.css";

/**
 * InvestigationMap
 *
 * Central GIS map for the investigation workspace. Renders only
 * layers that were actually supplied — never fabricates geometry.
 *
 * GeoJSON coordinate order is always [longitude, latitude] and is
 * never reversed here; react-leaflet's <GeoJSON> component consumes
 * raw GeoJSON directly so no manual lon/lat swapping happens.
 *
 * Layers (all optional, all toggle independently):
 *  - sceneBounds: [minLon, minLat, maxLon, maxLat] rectangle, only if backend provides it
 *  - slickGeojson: observed slick polygon(s) from detection
 *  - hindcastCorridor / hindcastEndpoint: GeoJSON from POST /api/drift/hindcast
 *  - forecastCorridor / forecastEndpoint: GeoJSON from POST /api/drift/forecast
 *  - aisTracksGeojson: FeatureCollection of LineStrings (currently always null — no backend source)
 *  - candidateTrackGeojson: highlighted selected-candidate AIS track (currently always null)
 */

function FitBounds({ geojsons }) {
  const map = useMap();

  useEffect(() => {
    const layers = geojsons.filter(Boolean);
    if (layers.length === 0) return;

    try {
      // Build a temporary L.geoJSON to compute combined bounds without extra state.
      const L = window.L;
      if (!L) return;

      let combined = null;
      layers.forEach((gj) => {
        const layer = L.geoJSON(gj);
        const b = layer.getBounds();
        if (b.isValid()) {
          combined = combined ? combined.extend(b) : b;
        }
      });

      if (combined && combined.isValid()) {
        map.fitBounds(combined, { padding: [40, 40] });
      }
    } catch {
      // Non-fatal — just skip auto-fit if geometry is malformed.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, JSON.stringify(geojsons)]);

  return null;
}

const LAYER_STYLES = {
  slick: { color: "#e6533c", weight: 2, fillOpacity: 0.25 },
  hindcastCorridor: { color: "#7c5cff", weight: 2, fillOpacity: 0.08, dashArray: "6 4" },
  forecastCorridor: { color: "#2fb8a3", weight: 2, fillOpacity: 0.08, dashArray: "2 4" },
  ais: { color: "#3b82f6", weight: 2 },
  candidate: { color: "#facc15", weight: 4 },
};

function InvestigationMap({
  sceneBounds,
  slickGeojson,
  hindcastCorridor,
  hindcastEndpoint,
  forecastCorridor,
  forecastEndpoint,
  aisTracksGeojson,
  candidateTrackGeojson,
  layers,
}) {
  const hasSceneBounds = Array.isArray(sceneBounds) && sceneBounds.length === 4;

  const rectBounds = useMemo(() => {
    if (!hasSceneBounds) return null;
    const [minLon, minLat, maxLon, maxLat] = sceneBounds;
    return [
      [minLat, minLon],
      [maxLat, maxLon],
    ];
  }, [sceneBounds, hasSceneBounds]);

  const defaultCenter = rectBounds
    ? [(rectBounds[0][0] + rectBounds[1][0]) / 2, (rectBounds[0][1] + rectBounds[1][1]) / 2]
    : [18.9, 72.8];

  const fitTargets = [
    layers.slick && slickGeojson,
    layers.hindcastOrigin && hindcastCorridor,
    layers.forecastCorridor && forecastCorridor,
    layers.aisTracks && aisTracksGeojson,
    layers.candidateTrack && candidateTrackGeojson,
  ];

  return (
    <div className="investigation-map">
      <MapContainer center={defaultCenter} zoom={hasSceneBounds ? 9 : 5} scrollWheelZoom className="map-container">
        <TileLayer attribution="© OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <FitBounds geojsons={fitTargets} />

        {layers.sarSource && hasSceneBounds && (
          <Rectangle bounds={rectBounds} pathOptions={{ color: "#94a3b8", weight: 1, fillOpacity: 0.03 }}>
            <Popup>SAR scene extent (backend-reported bounds)</Popup>
          </Rectangle>
        )}

        {layers.slick && slickGeojson && (
          <GeoJSON
            data={slickGeojson}
            style={LAYER_STYLES.slick}
            onEachFeature={(feature, layer) => {
              const p = feature.properties || {};
              layer.bindPopup(
                `<strong>Observed Slick</strong><br/>` +
                  `Centroid: ${p.centroid ? p.centroid.join(", ") : "Not provided by backend"}<br/>` +
                  `Area: ${p.area_sq_km != null ? p.area_sq_km + " km²" : "Not provided by backend"}<br/>` +
                  `Perimeter: ${p.perimeter_m != null ? p.perimeter_m + " m" : "Not provided by backend"}<br/>` +
                  `Confidence: ${p.confidence != null ? p.confidence : "Not provided by backend"}`
              );
            }}
          />
        )}

        {layers.hindcastOrigin && hindcastCorridor && (
          <GeoJSON data={hindcastCorridor} style={LAYER_STYLES.hindcastCorridor} />
        )}

        {layers.hindcastOrigin && hindcastEndpoint && (
          <GeoJSON
            data={hindcastEndpoint}
            pointToLayer={(feature, latlng) => window.L.circleMarker(latlng, { radius: 6, color: "#7c5cff" })}
          />
        )}

        {layers.forecastCorridor && forecastCorridor && (
          <GeoJSON data={forecastCorridor} style={LAYER_STYLES.forecastCorridor} />
        )}

        {layers.forecastCorridor && forecastEndpoint && (
          <GeoJSON
            data={forecastEndpoint}
            pointToLayer={(feature, latlng) => window.L.circleMarker(latlng, { radius: 6, color: "#2fb8a3" })}
          />
        )}

        {layers.aisTracks && aisTracksGeojson && (
          <GeoJSON
            data={aisTracksGeojson}
            style={LAYER_STYLES.ais}
            onEachFeature={(feature, layer) => {
              const p = feature.properties || {};
              layer.bindPopup(
                `<strong>${p.vessel_name || "Unknown vessel"}</strong><br/>` +
                  `MMSI: ${p.mmsi || "Not provided by backend"}<br/>` +
                  `Type: ${p.vessel_type || "Not provided by backend"}<br/>` +
                  `Quality: ${p.data_quality_status || "Not provided by backend"}`
              );
            }}
          />
        )}

        {layers.candidateTrack && candidateTrackGeojson && (
          <GeoJSON data={candidateTrackGeojson} style={LAYER_STYLES.candidate} />
        )}
      </MapContainer>
    </div>
  );
}

export default InvestigationMap;

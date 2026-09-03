import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Rectangle,
  useMap,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";

function MapBounds({ bounds }) {
  const map = useMap();

  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, {
        padding: [30, 30],
      });
    }
  }, [map, bounds]);

  return null;
}

function SpillMap({ scene }) {
  const sar = scene?.scenario_manifest?.sar;

  if (!sar) {
    return (
      <div className="map-empty">
        No scene geometry available.
      </div>
    );
  }

  const [
    minLon,
    minLat,
    maxLon,
    maxLat,
  ] = sar.bounds;

  const bounds = [
    [minLat, minLon],
    [maxLat, maxLon],
  ];

  // Day-4 GeoJSON placeholder.
  // Real oil-spill GeoJSON will come from the backend later.
  const geoJsonPlaceholder = null;

  return (
    <div className="spill-map">
      <MapContainer
        center={[
          (minLat + maxLat) / 2,
          (minLon + maxLon) / 2,
        ]}
        zoom={7}
        scrollWheelZoom
        className="map-container"
      >
        <TileLayer
          attribution="© OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapBounds bounds={bounds} />

        {/* SAR scene extent placeholder */}
        <Rectangle
          bounds={bounds}
          pathOptions={{
            weight: 1,
            fillOpacity: 0.04,
          }}
        />

        {/* Future backend GeoJSON layer */}
        {geoJsonPlaceholder && (
          <GeoJSON data={geoJsonPlaceholder} />
        )}
      </MapContainer>

      <div className="map-label">
        SAR SCENE EXTENT
      </div>
    </div>
  );
}

export default SpillMap;

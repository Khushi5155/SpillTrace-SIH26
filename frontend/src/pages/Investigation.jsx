import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  CircleMarker,
  MapContainer,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

import spillData from "../data/mockSpillData.json";

/* =========================================================
   MAP RESIZE
   ========================================================= */

function MapResizeHandler() {
  const map = useMap();

  useMemo(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => clearTimeout(timer);
  }, [map]);

  return null;
}

/* =========================================================
   SAFE NUMBER
   ========================================================= */

function safeNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

/* =========================================================
   INVESTIGATION
   ========================================================= */

function Investigation() {
  const { id } = useParams();
  const navigate = useNavigate();

  /* -------------------------------------------------------
     DATA
  ------------------------------------------------------- */

  const investigation = spillData?.investigation ?? {};
  const scenario = spillData?.scenario_manifest ?? {};
  const sar = scenario?.sar ?? {};

  const spill = spillData?.spill_detection ?? {};
  const origin = spillData?.origin_reconstruction ?? {};
  const ais = spillData?.ais_summary ?? {};

  const candidates = Array.isArray(spillData?.vessel_candidates)
    ? spillData.vessel_candidates
    : [];

  const backwardParticles = Array.isArray(
    origin?.backward_particles
  )
    ? origin.backward_particles
    : [];

  /* -------------------------------------------------------
     STATE
  ------------------------------------------------------- */

  const [timelineHour, setTimelineHour] = useState(0);

  const [selectedCandidate, setSelectedCandidate] = useState(
    candidates.length > 0 ? candidates[0] : null
  );

  /* -------------------------------------------------------
     SPILL CENTROID
  ------------------------------------------------------- */

  const spillLat = safeNumber(spill?.centroid?.lat, 18.234);
  const spillLon = safeNumber(spill?.centroid?.lon, 72.452);

  const mapCenter = [spillLat, spillLon];

  /* -------------------------------------------------------
     ORIGIN
  ------------------------------------------------------- */

  const originLat = safeNumber(
    origin?.estimated_origin?.lat,
    18.1
  );

  const originLon = safeNumber(
    origin?.estimated_origin?.lon,
    71.8
  );

  const estimatedOrigin = [originLat, originLon];

  /* -------------------------------------------------------
     BACKWARD DRIFT PATH
  ------------------------------------------------------- */

  const driftPath = backwardParticles
    .filter(
      (point) =>
        Number.isFinite(Number(point?.lat)) &&
        Number.isFinite(Number(point?.lon))
    )
    .map((point) => [
      Number(point.lat),
      Number(point.lon),
    ]);

  /*
    JSON contains:
      0h
      -6h
      -12h
      -18h
      -24h

    Timeline slider uses:
      0
      -6
      -12
      -18
      -24
  */

  const availableTimelineHours = backwardParticles
    .map((point) => Number(point?.t_offset_hours))
    .filter(Number.isFinite);

  const selectedParticle =
    backwardParticles.find(
      (point) =>
        Number(point?.t_offset_hours) === timelineHour
    ) ?? null;

  const selectedParticlePosition = selectedParticle
    ? [
        safeNumber(selectedParticle.lat, spillLat),
        safeNumber(selectedParticle.lon, spillLon),
      ]
    : estimatedOrigin;

  /* -------------------------------------------------------
     TIMELINE PATH
  ------------------------------------------------------- */

  const visibleDriftPath = useMemo(() => {
    if (backwardParticles.length === 0) {
      return [];
    }

    const validPoints = backwardParticles
      .filter(
        (point) =>
          Number.isFinite(Number(point?.lat)) &&
          Number.isFinite(Number(point?.lon)) &&
          Number.isFinite(Number(point?.t_offset_hours))
      )
      .map((point) => ({
        time: Number(point.t_offset_hours),
        position: [
          Number(point.lat),
          Number(point.lon),
        ],
      }));

    /*
      Sort from oldest -> newest:
      -24 -> -18 -> -12 -> -6 -> 0
    */

    validPoints.sort((a, b) => a.time - b.time);

    const selectedTime = timelineHour;

    return validPoints
      .filter((point) => point.time >= selectedTime)
      .map((point) => point.position);
  }, [backwardParticles, timelineHour]);

  /* -------------------------------------------------------
     SPILL POLYGON
     -------------------------------------------------------

     The mock JSON currently has:
       polygon_geojson: null

     Therefore a demo polygon is used only for visualization.
  */

  const spillPolygon = [
    [18.27, 72.39],
    [18.31, 72.44],
    [18.29, 72.51],
    [18.23, 72.54],
    [18.18, 72.49],
    [18.17, 72.41],
    [18.22, 72.37],
  ];

  /* -------------------------------------------------------
     SAR BOUNDS
     -------------------------------------------------------

     JSON:
       bounds: [70.9, 17.6, 73.2, 19.9]

     Order:
       [minLon, minLat, maxLon, maxLat]
  */

  const sarBounds = Array.isArray(sar?.bounds)
    ? sar.bounds
    : [70.9, 17.6, 73.2, 19.9];

  const minLon = safeNumber(sarBounds[0], 70.9);
  const minLat = safeNumber(sarBounds[1], 17.6);
  const maxLon = safeNumber(sarBounds[2], 73.2);
  const maxLat = safeNumber(sarBounds[3], 19.9);

  const sceneBounds = [
    [minLat, minLon],
    [minLat, maxLon],
    [maxLat, maxLon],
    [maxLat, minLon],
  ];

  /* -------------------------------------------------------
     SCORE
  ------------------------------------------------------- */

  const selectedScore = selectedCandidate
    ? Math.round(
        safeNumber(
          selectedCandidate?.attribution_score,
          0
        ) * 100
      )
    : 0;

  const detectionConfidence = Math.round(
    safeNumber(spill?.detection_confidence, 0) * 100
  );

  const originConfidence = Math.round(
    safeNumber(origin?.confidence, 0) * 100
  );

  const aisCompleteness = Math.round(
    safeNumber(
      ais?.data_quality?.ais_completeness,
      0
    ) * 100
  );

  /* -------------------------------------------------------
     TIMELINE LABEL
  ------------------------------------------------------- */

  const timelineLabel =
    timelineHour === 0
      ? "CURRENT SPILL"
      : `${Math.abs(timelineHour)}h BACKWARD`;

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <section className="investigation-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="investigation-header">

        <div>
          <p className="eyebrow">
            SPILLTRACE / INVESTIGATION
          </p>

          <div className="investigation-title-row">

            <h1>
              Marine Spill Investigation
            </h1>

            <span className="investigation-status">
              {String(
                investigation?.status ?? "active"
              ).toUpperCase()}
            </span>

          </div>

          <p className="page-description">
            SAR-based oil-spill detection, origin
            reconstruction and vessel candidate analysis.
          </p>
        </div>

        <button
          className="back-button"
          onClick={() => navigate("/")}
        >
          ← Dashboard
        </button>

      </div>

      {/* =====================================================
          INVESTIGATION META
      ===================================================== */}

      <div className="investigation-meta">

        <div className="meta-item">
          <span>
            INVESTIGATION ID
          </span>

          <strong>
            {id || investigation?.id || "UNKNOWN"}
          </strong>
        </div>

        <div className="meta-item">
          <span>
            REGION
          </span>

          <strong>
            {investigation?.region || "Arabian Sea"}
          </strong>
        </div>

        <div className="meta-item">
          <span>
            SAR SOURCE
          </span>

          <strong>
            {sar?.source || "Sentinel-1"}
          </strong>
        </div>

        <div className="meta-item">
          <span>
            DATA MODE
          </span>

          <strong>
            {String(
              investigation?.data_mode ?? "real_data"
            )
              .replaceAll("_", " ")
              .toUpperCase()}
          </strong>
        </div>

      </div>

      {/* =====================================================
          MAIN WORKSPACE
      ===================================================== */}

      <div className="investigation-workspace">

        {/* ===================================================
            MAP
        =================================================== */}

        <div className="map-container">

          <MapContainer
            center={mapCenter}
            zoom={8}
            minZoom={7}
            maxZoom={13}
            scrollWheelZoom={true}
            className="investigation-map"
          >

            {/* BASE MAP */}

            <TileLayer
              attribution="© OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapResizeHandler />

            {/* =================================================
                SAR SCENE BOUNDARY
            ================================================= */}

            <Polygon
              positions={sceneBounds}
              pathOptions={{
                color: "#38bdf8",
                weight: 1,
                opacity: 0.55,
                fillOpacity: 0.035,
              }}
            />

            {/* =================================================
                BACKWARD DRIFT
            ================================================= */}

            {visibleDriftPath.length > 1 && (
              <Polyline
                positions={visibleDriftPath}
                pathOptions={{
                  color: "#facc15",
                  weight: 3,
                  opacity: 0.85,
                  dashArray: "8 7",
                }}
              />
            )}

            {/* =================================================
                CURRENT / SELECTED DRIFT POINT
            ================================================= */}

            <CircleMarker
              center={selectedParticlePosition}
              radius={6}
              pathOptions={{
                color: "#facc15",
                fillColor: "#facc15",
                fillOpacity: 0.9,
                weight: 2,
              }}
            >
              <Popup>
                <strong>
                  Backward Drift Position
                </strong>

                <br />

                Time:
                {" "}
                {timelineHour === 0
                  ? "Current"
                  : `${timelineHour}h`}

                <br />

                Lat:
                {" "}
                {selectedParticlePosition[0].toFixed(3)}

                <br />

                Lon:
                {" "}
                {selectedParticlePosition[1].toFixed(3)}
              </Popup>
            </CircleMarker>

            {/* =================================================
                ESTIMATED ORIGIN
            ================================================= */}

            <CircleMarker
              center={estimatedOrigin}
              radius={10}
              pathOptions={{
                color: "#facc15",
                fillColor: "#facc15",
                fillOpacity: 0.95,
                weight: 3,
              }}
            >
              <Popup>

                <strong>
                  Estimated Spill Origin
                </strong>

                <br />

                Confidence:
                {" "}
                {originConfidence}%

                <br />

                Lat:
                {" "}
                {originLat.toFixed(3)}

                <br />

                Lon:
                {" "}
                {originLon.toFixed(3)}

              </Popup>
            </CircleMarker>

            {/* =================================================
                DETECTED SPILL
            ================================================= */}

            <Polygon
              positions={spillPolygon}
              pathOptions={{
                color: "#ef4444",
                fillColor: "#ef4444",
                fillOpacity: 0.38,
                weight: 2,
              }}
            >
              <Popup>

                <strong>
                  Detected Spill
                </strong>

                <br />

                Area:
                {" "}
                {spill?.area_km2 ?? 0} km²

                <br />

                Confidence:
                {" "}
                {detectionConfidence}%

              </Popup>
            </Polygon>

            {/* =================================================
                SELECTED VESSEL
            ================================================= */}

            {selectedCandidate && (
              <CircleMarker
                center={[
                  originLat,
                  originLon,
                ]}
                radius={7}
                pathOptions={{
                  color: "#ffffff",
                  fillColor: "#ffffff",
                  fillOpacity: 0.95,
                  weight: 2,
                }}
              >
                <Popup>

                  <strong>
                    {selectedCandidate?.vessel_name ??
                      "Unknown Vessel"}
                  </strong>

                  <br />

                  MMSI:
                  {" "}
                  {selectedCandidate?.mmsi ??
                    "Unknown"}

                  <br />

                  Candidate Score:
                  {" "}
                  {selectedScore}%

                </Popup>
              </CircleMarker>
            )}

          </MapContainer>

          {/* =================================================
              MAP TITLE
          ================================================= */}

          <div className="map-overlay-title">

            <span className="map-live-dot"></span>

            <div>

              <strong>
                {investigation?.region ||
                  "ARABIAN SEA"}
              </strong>

              <span>
                {sar?.source ||
                  "Copernicus Sentinel-1"}
                {" · "}
                31 Aug 2026
              </span>

            </div>

          </div>

          {/* =================================================
              MAP LEGEND
          ================================================= */}

          <div className="map-legend">

            <div className="legend-title">
              MAP LEGEND
            </div>

            <div className="legend-item">

              <span
                className="legend-marker"
                style={{
                  background: "#ef4444",
                }}
              />

              Detected Spill

            </div>

            <div className="legend-item">

              <span
                className="legend-marker"
                style={{
                  background: "#facc15",
                }}
              />

              Estimated Origin

            </div>

            <div className="legend-item">

              <span
                className="legend-line"
                style={{
                  borderColor: "#facc15",
                }}
              />

              Backward Drift

            </div>

            <div className="legend-item">

              <span
                className="legend-marker"
                style={{
                  background: "#ffffff",
                }}
              />

              AIS Candidate

            </div>

          </div>

        </div>

        {/* ===================================================
            EVIDENCE PANEL
        =================================================== */}

        <aside className="evidence-panel">

          {/* =================================================
              SAR DETECTION
          ================================================= */}

          <div className="evidence-card">

            <div className="evidence-card-header">

              <div>

                <span className="evidence-number">
                  01
                </span>

                <h3>
                  SAR Detection
                </h3>

              </div>

              <span className="complete-status">
                COMPLETE
              </span>

            </div>

            <div className="evidence-value">

              {detectionConfidence}%

              <span>
                {" "}
                confidence
              </span>

            </div>

            <div className="metric-grid">

              <div>

                <span>
                  AREA
                </span>

                <strong>
                  {spill?.area_km2 ?? 0} km²
                </strong>

              </div>

              <div>

                <span>
                  PERIMETER
                </span>

                <strong>
                  {spill?.perimeter_km ?? 0} km
                </strong>

              </div>

            </div>

          </div>

          {/* =================================================
              ORIGIN
          ================================================= */}

          <div className="evidence-card">

            <div className="evidence-card-header">

              <div>

                <span className="evidence-number">
                  02
                </span>

                <h3>
                  Origin Hindcast
                </h3>

              </div>

              <span className="medium-status">
                {String(
                  origin?.confidence_label ?? "MEDIUM"
                ).toUpperCase()}
              </span>

            </div>

            <div className="evidence-value">

              {originConfidence}%

              <span>
                {" "}
                confidence
              </span>

            </div>

            <p>

              Estimated origin:

              <strong>

                {" "}
                {originLat.toFixed(3)}
                °,
                {" "}
                {originLon.toFixed(3)}
                °

              </strong>

            </p>

          </div>

          {/* =================================================
              AIS ANALYSIS
          ================================================= */}

          <div className="evidence-card">

            <div className="evidence-card-header">

              <div>

                <span className="evidence-number">
                  03
                </span>

                <h3>
                  AIS Analysis
                </h3>

              </div>

              <span className="complete-status">
                COMPLETE
              </span>

            </div>

            <div className="evidence-value">

              {ais?.tracks_in_origin_window ?? 0}

              <span>
                {" "}
                vessels in origin window
              </span>

            </div>

            <p>

              {ais?.total_tracks_analyzed ?? 0}
              {" "}
              historical AIS tracks analyzed.

            </p>

            <div className="metric-grid">

              <div>

                <span>
                  AIS COMPLETENESS
                </span>

                <strong>
                  {aisCompleteness}%
                </strong>

              </div>

              <div>

                <span>
                  CANDIDATES
                </span>

                <strong>
                  {ais?.candidates_ranked ??
                    candidates.length}
                </strong>

              </div>

            </div>

          </div>

          {/* =================================================
              CANDIDATES
          ================================================= */}

          <div className="candidate-section">

            <div className="candidate-section-header">

              <div>

                <p className="eyebrow">
                  VESSEL ATTRIBUTION
                </p>

                <h2>
                  Candidate Vessels
                </h2>

              </div>

              <span className="candidate-count">
                {candidates.length}
              </span>

            </div>

            <div className="candidate-list">

              {candidates.length === 0 ? (

                <div className="evidence-card">

                  <p>
                    No compatible vessel candidates
                    are currently available.
                  </p>

                </div>

              ) : (

                candidates.map((candidate) => {

                  const score = Math.round(
                    safeNumber(
                      candidate?.attribution_score,
                      0
                    ) * 100
                  );

                  const isSelected =
                    selectedCandidate?.mmsi ===
                    candidate?.mmsi;

                  return (
                    <button
                      key={
                        candidate?.mmsi ??
                        candidate?.rank
                      }
                      type="button"
                      className={`candidate-card ${
                        isSelected
                          ? "selected"
                          : ""
                      }`}
                      onClick={() =>
                        setSelectedCandidate(candidate)
                      }
                    >

                      <div className="candidate-rank">
                        #{candidate?.rank ?? "-"}
                      </div>

                      <div className="candidate-info">

                        <strong>
                          {candidate?.vessel_name ??
                            "Unknown Vessel"}
                        </strong>

                        <span>
                          {candidate?.vessel_type ??
                            "Unknown Type"}
                          {" · "}
                          {candidate?.flag ??
                            "N/A"}
                        </span>

                        <small>
                          MMSI{" "}
                          {candidate?.mmsi ??
                            "Unknown"}
                        </small>

                      </div>

                      <div className="candidate-score">

                        <strong>
                          {score}%
                        </strong>

                        <span>
                          {candidate?.label ??
                            "Candidate"}
                        </span>

                      </div>

                    </button>
                  );
                })

              )}

            </div>

          </div>

        </aside>

      </div>

      {/* =====================================================
          TIMELINE
      ===================================================== */}

      <div className="timeline-section">

        <div className="timeline-header">

          <div>

            <p className="eyebrow">
              DRIFT RECONSTRUCTION
            </p>

            <h2>
              Backward Drift Timeline
            </h2>

          </div>

          <strong>
            {timelineLabel}
          </strong>

        </div>

        <input
          type="range"
          min="-24"
          max="0"
          step="6"
          value={timelineHour}
          onChange={(event) =>
            setTimelineHour(
              Number(event.target.value)
            )
          }
          className="timeline-slider"
        />

        <div className="timeline-labels">

          <span>
            -24h
          </span>

          <span>
            -18h
          </span>

          <span>
            -12h
          </span>

          <span>
            -6h
          </span>

          <span>
            NOW
          </span>

        </div>

        {/* CURRENT TIMELINE POSITION */}

        <div
          style={{
            marginTop: "12px",
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            color: "#64748b",
            fontSize: "9px",
          }}
        >

          <span>
            Selected position:
          </span>

          <strong
            style={{
              color: "#facc15",
              fontFamily: "monospace",
            }}
          >
            {selectedParticle
              ? `${safeNumber(
                  selectedParticle.lat
                ).toFixed(3)}°,
                ${safeNumber(
                  selectedParticle.lon
                ).toFixed(3)}°`
              : "N/A"}
          </strong>

        </div>

      </div>

      {/* =====================================================
          DISCLAIMER
      ===================================================== */}

      <div className="investigation-disclaimer">

        <strong>
          Investigation note:
        </strong>{" "}

        {spillData?.disclaimers?.attribution ??
          "Candidate rankings support investigation and do not constitute legal attribution."}

      </div>

    </section>
  );
}

export default Investigation;

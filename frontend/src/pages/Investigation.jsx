import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polygon,
  Polyline,
  Popup,
  Rectangle,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

import spillData from "../data/mockSpillData.json";

import SceneMetadata from "../components/SceneMetadata";
import CompatibilityStatus from "../components/CompatibilityStatus";

/* =========================================================
   HELPERS
========================================================= */

const safeNumber = (value, fallback = 0) => {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
};

const clamp = (value, min = 0, max = 1) =>
  Math.min(Math.max(safeNumber(value), min), max);

const formatPercent = (value) =>
  `${Math.round(clamp(value) * 100)}%`;

const formatArea = (value) =>
  `${safeNumber(value).toFixed(1)} km²`;

const formatCoordinate = (value) =>
  safeNumber(value).toFixed(3);


/* =========================================================
   FALLBACK DEMO SPILL POLYGON

   Current mock JSON contains:
   polygon_geojson: null

   Therefore this polygon is retained only for the
   frontend demonstration until Aayush provides the
   real GeoJSON endpoint.
========================================================= */

const DEMO_SPILL_POLYGON = [
  [18.185, 72.400],
  [18.205, 72.430],
  [18.225, 72.445],
  [18.250, 72.455],
  [18.270, 72.480],
  [18.255, 72.505],
  [18.230, 72.520],
  [18.205, 72.505],
  [18.180, 72.475],
  [18.170, 72.440],
  [18.185, 72.400],
];


/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function Investigation() {
  const { id } = useParams();
  const navigate = useNavigate();

  /* =======================================================
     STATE
  ======================================================= */

  const [selectedCandidate, setSelectedCandidate] = useState(0);

  const [selectedTimeIndex, setSelectedTimeIndex] =
    useState(0);

  const [layers, setLayers] = useState({
    spill: true,
    origin: true,
    drift: true,
    scene: false,
  });


  /* =======================================================
     DATA
  ======================================================= */

  const investigation =
    spillData?.investigation ?? {};

  const scenario =
    spillData?.scenario_manifest ?? {};

  const spill =
    spillData?.spill_detection ?? {};

  const origin =
    spillData?.origin_reconstruction ?? {};

  const ais =
    spillData?.ais_summary ?? {};

  const candidates =
    spillData?.vessel_candidates ?? [];

  const compatibility =
    scenario?.compatibility ?? {
      status: "blocked",
      reasons: [
        "Compatibility information unavailable.",
      ],
    };

  const backwardParticles =
    origin?.backward_particles ?? [];


  /* =======================================================
     COORDINATES
  ======================================================= */

  const spillLat = safeNumber(
    spill?.centroid?.lat,
    18.234
  );

  const spillLon = safeNumber(
    spill?.centroid?.lon,
    72.452
  );

  const originLat = safeNumber(
    origin?.estimated_origin?.lat,
    18.1
  );

  const originLon = safeNumber(
    origin?.estimated_origin?.lon,
    71.8
  );


  /* =======================================================
     MAP CENTER
  ======================================================= */

  const mapCenter = [
    (spillLat + originLat) / 2,
    (spillLon + originLon) / 2,
  ];


  /* =======================================================
     SAR SCENE
  ======================================================= */

  const sar =
    scenario?.sar ?? {};


  /* =======================================================
     SCENE BOUNDS
  ======================================================= */

  let sceneBounds = null;

  if (
    Array.isArray(sar?.bounds) &&
    sar.bounds.length === 4
  ) {
    const [
      minLon,
      minLat,
      maxLon,
      maxLat,
    ] = sar.bounds;

    sceneBounds = [
      [minLat, minLon],
      [maxLat, maxLon],
    ];
  }


  /* =======================================================
     BACKWARD DRIFT PATH
  ======================================================= */

  const driftPath = backwardParticles
    .filter(
      (point) =>
        Number.isFinite(Number(point?.lat)) &&
        Number.isFinite(Number(point?.lon))
    )
    .map((point) => [
      safeNumber(point.lat),
      safeNumber(point.lon),
    ]);


  /* =======================================================
     CURRENT TIMELINE POINT
  ======================================================= */

  const selectedDriftPoint =
    backwardParticles[selectedTimeIndex] ??
    backwardParticles[
      backwardParticles.length - 1
    ] ??
    null;

  const selectedDriftLat =
    selectedDriftPoint
      ? safeNumber(
          selectedDriftPoint.lat,
          originLat
        )
      : originLat;

  const selectedDriftLon =
    selectedDriftPoint
      ? safeNumber(
          selectedDriftPoint.lon,
          originLon
        )
      : originLon;


  /* =======================================================
     VISIBLE DRIFT PATH
  ======================================================= */

  const visibleDriftPath =
    backwardParticles
      .slice(selectedTimeIndex)
      .map((point) => [
        safeNumber(point?.lat),
        safeNumber(point?.lon),
      ]);


  /* =======================================================
     SELECTED CANDIDATE
  ======================================================= */

  const currentCandidate =
    compatibility?.status === "blocked"
      ? null
      : candidates[selectedCandidate] ?? null;


  /* =======================================================
     MAP LAYER TOGGLE
  ======================================================= */

  const toggleLayer = (layerName) => {
    setLayers((previous) => ({
      ...previous,
      [layerName]: !previous[layerName],
    }));
  };


  /* =======================================================
     TIMELINE
  ======================================================= */

  const handleTimelineChange = (event) => {
    setSelectedTimeIndex(
      Number(event.target.value)
    );
  };


  /* =======================================================
     SPILL POLYGON

     Real polygon_geojson will come from backend later.
  ======================================================= */

  const spillPolygon =
    Array.isArray(spill?.polygon_geojson) &&
    spill.polygon_geojson.length > 0
      ? spill.polygon_geojson
      : DEMO_SPILL_POLYGON;


  /* =======================================================
     CANDIDATE RANKING ACTION

     Actual ranking endpoint will be connected later.
  ======================================================= */

  const handleRankCandidates = () => {
    if (compatibility?.status === "blocked") {
      return;
    }

    console.log(
      "Candidate ranking will be connected to the backend."
    );
  };


  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="investigation-page">

      {/* ===================================================
          PAGE HEADER
      =================================================== */}

      <div className="investigation-header">

        <div>
          <div className="eyebrow">
            ACTIVE INVESTIGATION
          </div>

          <h1>
            {investigation?.id ||
              id ||
              "Investigation"}
          </h1>

          <p>
            {investigation?.region ||
              "Arabian Sea"}

            {" · "}

            {investigation?.demo_case_label ||
              "Marine oil-spill reconstruction"}
          </p>
        </div>


        <div className="header-actions">

          <div className="status-badge">
            <span className="status-dot" />

            {investigation?.status?.toUpperCase() ||
              "ACTIVE"}
          </div>

          <button
            className="secondary-button"
            onClick={() => navigate("/")}
          >
            ← Dashboard
          </button>

        </div>
      </div>


      {/* ===================================================
          DAY 4 — SCENE METADATA
      =================================================== */}

      <SceneMetadata
        investigation={spillData}
      />


      {/* ===================================================
          DAY 4 — COMPATIBILITY STATUS
      =================================================== */}

      <CompatibilityStatus
        compatibility={compatibility}
        onRankCandidates={handleRankCandidates}
      />


      {/* ===================================================
          MAIN WORKSPACE
      =================================================== */}

      <div className="investigation-workspace">


        {/* =================================================
            MAP
        ================================================= */}

        <section className="map-section">

          <MapContainer
            center={mapCenter}
            zoom={7}
            scrollWheelZoom
            className="investigation-map"
          >

            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />


            {/* ---------------------------------------------
                SAR SCENE BOUNDS
            --------------------------------------------- */}

            {layers.scene &&
              sceneBounds && (
                <Rectangle
                  bounds={sceneBounds}
                  pathOptions={{
                    color: "#64748b",
                    weight: 1,
                    dashArray: "6 6",
                    fillOpacity: 0.03,
                  }}
                />
              )}


            {/* ---------------------------------------------
                DETECTED SPILL
            --------------------------------------------- */}

            {layers.spill &&
              spillPolygon.length > 0 && (
                <Polygon
                  positions={spillPolygon}
                  pathOptions={{
                    color: "#ef4444",
                    weight: 2,
                    fillColor: "#ef4444",
                    fillOpacity: 0.32,
                  }}
                >
                  <Popup>
                    <strong>
                      Detected Oil Spill
                    </strong>

                    <br />

                    Area:{" "}
                    {formatArea(
                      spill?.area_km2
                    )}

                    <br />

                    Confidence:{" "}
                    {formatPercent(
                      spill?.detection_confidence
                    )}
                  </Popup>
                </Polygon>
              )}


            {/* ---------------------------------------------
                SPILL CENTROID
            --------------------------------------------- */}

            {layers.spill && (
              <CircleMarker
                center={[
                  spillLat,
                  spillLon,
                ]}
                radius={7}
                pathOptions={{
                  color: "#ffffff",
                  weight: 2,
                  fillColor: "#ef4444",
                  fillOpacity: 1,
                }}
              >
                <Popup>
                  <strong>
                    Detected Spill Centroid
                  </strong>

                  <br />

                  Lat:{" "}
                  {formatCoordinate(
                    spillLat
                  )}

                  <br />

                  Lon:{" "}
                  {formatCoordinate(
                    spillLon
                  )}
                </Popup>
              </CircleMarker>
            )}


            {/* ---------------------------------------------
                ESTIMATED ORIGIN
            --------------------------------------------- */}

            {layers.origin && (
              <CircleMarker
                center={[
                  originLat,
                  originLon,
                ]}
                radius={8}
                pathOptions={{
                  color: "#ffffff",
                  weight: 2,
                  fillColor: "#facc15",
                  fillOpacity: 1,
                }}
              >
                <Popup>
                  <strong>
                    Estimated Spill Origin
                  </strong>

                  <br />

                  Lat:{" "}
                  {formatCoordinate(
                    originLat
                  )}

                  <br />

                  Lon:{" "}
                  {formatCoordinate(
                    originLon
                  )}

                  <br />

                  Confidence:{" "}
                  {formatPercent(
                    origin?.confidence
                  )}
                </Popup>
              </CircleMarker>
            )}


            {/* ---------------------------------------------
                FULL BACKWARD DRIFT PATH
            --------------------------------------------- */}

            {layers.drift &&
              driftPath.length > 1 && (
                <Polyline
                  positions={driftPath}
                  pathOptions={{
                    color: "#38bdf8",
                    weight: 3,
                    opacity: 0.45,
                    dashArray: "7 8",
                  }}
                />
              )}


            {/* ---------------------------------------------
                ACTIVE TIMELINE PATH
            --------------------------------------------- */}

            {layers.drift &&
              visibleDriftPath.length > 1 && (
                <Polyline
                  positions={visibleDriftPath}
                  pathOptions={{
                    color: "#22d3ee",
                    weight: 4,
                    opacity: 0.95,
                  }}
                />
              )}


            {/* ---------------------------------------------
                SELECTED DRIFT PARTICLE
            --------------------------------------------- */}

            {layers.drift &&
              selectedDriftPoint && (
                <CircleMarker
                  center={[
                    selectedDriftLat,
                    selectedDriftLon,
                  ]}
                  radius={6}
                  pathOptions={{
                    color: "#ffffff",
                    weight: 2,
                    fillColor: "#22d3ee",
                    fillOpacity: 1,
                  }}
                >
                  <Popup>

                    <strong>
                      Backward Drift Position
                    </strong>

                    <br />

                    T ={" "}
                    {safeNumber(
                      selectedDriftPoint?.t_offset_hours
                    )}{" "}
                    hours

                    <br />

                    Lat:{" "}
                    {formatCoordinate(
                      selectedDriftLat
                    )}

                    <br />

                    Lon:{" "}
                    {formatCoordinate(
                      selectedDriftLon
                    )}

                  </Popup>
                </CircleMarker>
              )}

          </MapContainer>


          {/* =================================================
              MAP LEGEND
          ================================================= */}

          <div className="map-legend">

            <div className="legend-title">
              MAP LAYERS
            </div>


            <button
              className={`legend-row ${
                layers.spill
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                toggleLayer("spill")
              }
            >
              <span className="legend-marker spill-marker" />

              <span>
                Detected Spill
              </span>
            </button>


            <button
              className={`legend-row ${
                layers.origin
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                toggleLayer("origin")
              }
            >
              <span className="legend-marker origin-marker" />

              <span>
                Estimated Origin
              </span>
            </button>


            <button
              className={`legend-row ${
                layers.drift
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                toggleLayer("drift")
              }
            >
              <span className="legend-marker drift-marker" />

              <span>
                Backward Drift
              </span>
            </button>


            <button
              className={`legend-row ${
                layers.scene
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                toggleLayer("scene")
              }
            >
              <span className="legend-marker scene-marker" />

              <span>
                SAR Scene Bounds
              </span>
            </button>

          </div>


          {/* =================================================
              MAP STATUS
          ================================================= */}

          <div className="map-status">

            <span className="map-status-dot" />

            <span>
              SAR + Ocean Dynamics + AIS
            </span>

          </div>

        </section>


        {/* =================================================
            RIGHT SIDEBAR
        ================================================= */}

        <aside className="investigation-sidebar">


          {/* =================================================
              DETECTION SUMMARY
          ================================================= */}

          <section className="evidence-panel">

            <div className="panel-header">

              <div>

                <div className="panel-kicker">
                  01 · SAR DETECTION
                </div>

                <h2>
                  Spill Characterization
                </h2>

              </div>

              <span className="confidence-badge high">
                {spill?.confidence_label ||
                  "HIGH"}
              </span>

            </div>


            <div className="stats-grid">

              <div className="stat-box">
                <span>AREA</span>

                <strong>
                  {formatArea(
                    spill?.area_km2
                  )}
                </strong>
              </div>


              <div className="stat-box">
                <span>PERIMETER</span>

                <strong>
                  {safeNumber(
                    spill?.perimeter_km
                  ).toFixed(1)}{" "}
                  km
                </strong>
              </div>


              <div className="stat-box">
                <span>CONFIDENCE</span>

                <strong>
                  {formatPercent(
                    spill?.detection_confidence
                  )}
                </strong>
              </div>


              <div className="stat-box">
                <span>ORIENTATION</span>

                <strong>
                  {safeNumber(
                    spill?.orientation_deg
                  )}
                  °
                </strong>
              </div>

            </div>


            <div className="evidence-factors">

              <div className="subheading">
                Detection Evidence
              </div>

              {Array.isArray(
                spill?.evidence_factors
              ) &&
                spill.evidence_factors.map(
                  (factor) => (
                    <div
                      className="factor-row"
                      key={factor.label}
                    >

                      <span>
                        {factor.label}
                      </span>

                      <div className="factor-value">

                        <div className="factor-bar">

                          <div
                            className="factor-fill"
                            style={{
                              width: `${
                                clamp(
                                  factor.value
                                ) * 100
                              }%`,
                            }}
                          />

                        </div>

                        <strong>
                          {formatPercent(
                            factor.value
                          )}
                        </strong>

                      </div>

                    </div>
                  )
                )}

            </div>

          </section>


          {/* =================================================
              ORIGIN RECONSTRUCTION
          ================================================= */}

          <section className="evidence-panel">

            <div className="panel-header">

              <div>

                <div className="panel-kicker">
                  02 · ORIGIN HINDCAST
                </div>

                <h2>
                  Estimated Origin
                </h2>

              </div>

              <span className="confidence-badge medium">
                {origin?.confidence_label ||
                  "MEDIUM"}
              </span>

            </div>


            <div className="origin-coordinates">

              <div>
                <span>LAT</span>

                <strong>
                  {formatCoordinate(
                    originLat
                  )}
                </strong>
              </div>


              <div>
                <span>LON</span>

                <strong>
                  {formatCoordinate(
                    originLon
                  )}
                </strong>
              </div>

            </div>


            <div className="origin-method">

              <span>METHOD</span>

              <strong>
                {origin?.method ||
                  "Backward drift hindcast"}
              </strong>

            </div>


            <div className="origin-window">

              <span>
                ESTIMATED WINDOW
              </span>

              <strong>
                {origin?.estimated_window_start
                  ? new Date(
                      origin.estimated_window_start
                    ).toUTCString()
                  : "Unavailable"}
              </strong>

              <strong>
                {origin?.estimated_window_end
                  ? new Date(
                      origin.estimated_window_end
                    ).toUTCString()
                  : "Unavailable"}
              </strong>

            </div>

          </section>


          {/* =================================================
              AIS SUMMARY
          ================================================= */}

          <section className="evidence-panel">

            <div className="panel-header">

              <div>

                <div className="panel-kicker">
                  03 · AIS FILTER
                </div>

                <h2>
                  Traffic Analysis
                </h2>

              </div>

            </div>


            <div className="stats-grid">

              <div className="stat-box">
                <span>TRACKS</span>

                <strong>
                  {safeNumber(
                    ais?.total_tracks_analyzed
                  )}
                </strong>
              </div>


              <div className="stat-box">
                <span>
                  ORIGIN WINDOW
                </span>

                <strong>
                  {safeNumber(
                    ais?.tracks_in_origin_window
                  )}
                </strong>
              </div>


              <div className="stat-box">
                <span>RANKED</span>

                <strong>
                  {safeNumber(
                    ais?.candidates_ranked
                  )}
                </strong>
              </div>


              <div className="stat-box">
                <span>QUALITY</span>

                <strong>
                  {formatPercent(
                    ais?.data_quality
                      ?.ais_completeness
                  )}
                </strong>
              </div>

            </div>


            {ais?.data_quality
              ?.gap_detected && (
              <div className="warning-box">

                <strong>
                  AIS data gap detected
                </strong>

                <span>
                  {ais?.data_quality
                    ?.gap_note ||
                    "Simulation partially compensates."}
                </span>

              </div>
            )}

          </section>


          {/* =================================================
              BACKWARD DRIFT TIMELINE
          ================================================= */}

          <section className="evidence-panel timeline-panel">

            <div className="panel-header">

              <div>

                <div className="panel-kicker">
                  DRIFT RECONSTRUCTION
                </div>

                <h2>
                  Backward Timeline
                </h2>

              </div>

            </div>


            {backwardParticles.length > 0 ? (
              <>

                <div className="timeline-current">

                  <span>
                    SELECTED TIME
                  </span>

                  <strong>
                    {safeNumber(
                      selectedDriftPoint
                        ?.t_offset_hours
                    )}{" "}
                    hours
                  </strong>

                </div>


                <input
                  type="range"
                  min="0"
                  max={Math.max(
                    backwardParticles.length - 1,
                    0
                  )}
                  step="1"
                  value={selectedTimeIndex}
                  onChange={
                    handleTimelineChange
                  }
                  className="timeline-slider"
                />


                <div className="timeline-labels">

                  {backwardParticles.map(
                    (point, index) => (
                      <button
                        key={`${point?.t_offset_hours}-${index}`}
                        className={
                          index ===
                          selectedTimeIndex
                            ? "timeline-label active"
                            : "timeline-label"
                        }
                        onClick={() =>
                          setSelectedTimeIndex(
                            index
                          )
                        }
                      >
                        {safeNumber(
                          point?.t_offset_hours
                        ) === 0
                          ? "NOW"
                          : `${safeNumber(
                              point?.t_offset_hours
                            )}h`}
                      </button>
                    )
                  )}

                </div>


                <div className="timeline-location">

                  <span>
                    POSITION
                  </span>

                  <strong>
                    {formatCoordinate(
                      selectedDriftLat
                    )}
                    {" , "}
                    {formatCoordinate(
                      selectedDriftLon
                    )}
                  </strong>

                </div>

              </>
            ) : (
              <div className="empty-state">
                No backward-drift particle data
                available.
              </div>
            )}

          </section>


          {/* =================================================
              CANDIDATE RANKING
          ================================================= */}

          <section className="evidence-panel candidates-panel">

            <div className="panel-header">

              <div>

                <div className="panel-kicker">
                  04 · CANDIDATE RANKING
                </div>

                <h2>
                  Vessel Candidates
                </h2>

              </div>


              <span className="candidate-count">
                {compatibility?.status ===
                "blocked"
                  ? "—"
                  : candidates.length}
              </span>

            </div>


            <div className="candidate-list">

              {/* -------------------------------------------
                  BLOCKED STATE
              ------------------------------------------- */}

              {compatibility?.status ===
              "blocked" ? (
                <div className="ranking-blocked">

                  <strong>
                    Candidate ranking unavailable
                  </strong>

                  <span>
                    Vessel attribution is disabled
                    because the selected data sources
                    are not compatible.
                  </span>

                </div>

              ) : candidates.length === 0 ? (

                /* -----------------------------------------
                   NO CANDIDATES
                ----------------------------------------- */

                <div className="empty-state">
                  No compatible vessel candidates
                  available.
                </div>

              ) : (

                /* -----------------------------------------
                   CANDIDATES
                ----------------------------------------- */

                candidates.map(
                  (candidate, index) => {

                    const score = clamp(
                      candidate
                        ?.attribution_score
                    );

                    const isSelected =
                      index ===
                      selectedCandidate;

                    return (
                      <button
                        key={
                          candidate?.mmsi ||
                          index
                        }
                        className={`candidate-card ${
                          isSelected
                            ? "selected"
                            : ""
                        }`}
                        onClick={() =>
                          setSelectedCandidate(
                            index
                          )
                        }
                      >

                        <div className="candidate-top">

                          <div className="rank">
                            #
                            {candidate?.rank ??
                              index + 1}
                          </div>


                          <div className="candidate-main">

                            <strong>
                              {candidate?.vessel_name ||
                                "Unknown Vessel"}
                            </strong>

                            <span>
                              {candidate?.vessel_type ||
                                "Unknown Type"}

                              {" · "}

                              {candidate?.flag ||
                                "N/A"}
                            </span>

                          </div>


                          <div className="candidate-score">
                            {formatPercent(
                              score
                            )}
                          </div>

                        </div>


                        <div className="candidate-progress">

                          <div
                            style={{
                              width: `${
                                score * 100
                              }%`,
                            }}
                          />

                        </div>


                        <div className="candidate-bottom">

                          <span>
                            MMSI{" "}
                            {candidate?.mmsi ||
                              "Unavailable"}
                          </span>

                          <span>
                            {candidate?.label ||
                              "Candidate"}
                          </span>

                        </div>

                      </button>
                    );
                  }
                )
              )}

            </div>

          </section>


          {/* =================================================
              SELECTED CANDIDATE EVIDENCE
          ================================================= */}

          {currentCandidate && (
            <section className="evidence-panel selected-evidence">

              <div className="panel-header">

                <div>

                  <div className="panel-kicker">
                    SELECTED CANDIDATE
                  </div>

                  <h2>
                    {currentCandidate.vessel_name}
                  </h2>

                </div>


                <span className="confidence-badge candidate">
                  {formatPercent(
                    currentCandidate
                      .attribution_score
                  )}
                </span>

              </div>


              <div className="candidate-meta">

                <span>
                  MMSI:{" "}
                  {currentCandidate.mmsi}
                </span>

                <span>
                  {currentCandidate.vessel_type}
                </span>

                <span>
                  Flag:{" "}
                  {currentCandidate.flag}
                </span>

              </div>


              <div className="subheading">
                Why this score?
              </div>


              <div className="feature-list">

                {Object.entries(
                  currentCandidate.features || {}
                ).map(
                  ([key, value]) => {

                    const label = key
                      .replaceAll("_", " ")
                      .replace(
                        /\b\w/g,
                        (letter) =>
                          letter.toUpperCase()
                      );

                    return (
                      <div
                        className="feature-row"
                        key={key}
                      >

                        <span>
                          {label}
                        </span>


                        <div className="feature-score">

                          <div className="feature-bar">

                            <div
                              style={{
                                width: `${
                                  clamp(
                                    value
                                  ) * 100
                                }%`,
                              }}
                            />

                          </div>


                          <strong>
                            {formatPercent(
                              value
                            )}
                          </strong>

                        </div>

                      </div>
                    );
                  }
                )}

              </div>


              {/* -------------------------------------------
                  EVIDENCE TIMELINE
              ------------------------------------------- */}

              {Array.isArray(
                currentCandidate
                  .evidence_timeline
              ) &&
                currentCandidate
                  .evidence_timeline.length >
                  0 && (
                  <div className="candidate-timeline">

                    <div className="subheading">
                      Evidence Timeline
                    </div>


                    {currentCandidate
                      .evidence_timeline
                      .map(
                        (event, index) => (
                          <div
                            className={`evidence-event ${
                              event?.highlight
                                ? "highlight"
                                : ""
                            }`}
                            key={`${event?.time}-${index}`}
                          >

                            <div className="event-time">
                              {event?.time}
                            </div>

                            <div className="event-dot" />

                            <div className="event-label">
                              {event?.label}
                            </div>

                          </div>
                        )
                      )}

                  </div>
                )}

            </section>
          )}


          {/* =================================================
              SCIENTIFIC DISCLAIMER
          ================================================= */}

          <div className="investigation-disclaimer">

            <strong>
              Investigation support only
            </strong>

            <span>
              {spillData?.disclaimers
                ?.attribution ||
                "Candidate rankings support investigation and do not constitute legal attribution."}
            </span>

          </div>

        </aside>

      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  createDetection,
  createInvestigationReport,
  createInvestigationReportHtml,
  detectSpillMock,
  getAisTracks,
  getApiError,
  getCandidateDetail,
  getCandidates,
  getScenes,
  getSceneCompatibility,
  getSceneManifest,
  getSpill,
  pollDetection,
  rankCandidates,
  resolveApiUrl,
  runForecast,
  runHindcast,
} from "../services/api";

import SceneSelector from "../components/Scenario/SceneSelector";
import SceneMetadata from "../components/Scenario/SceneMetadata";
import CompatibilityStatus from "../components/Scenario/CompatibilityStatus";

import AISQualityPanel from "../components/AIS/AISQualityPanel";
import AISTrackInfo from "../components/AIS/AISTrackInfo";

import DetectionStatus from "../components/Detection/DetectionStatus";
import SlickMetrics from "../components/Detection/SlickMetrics";

import DriftControls from "../components/Drift/DriftControls";

import InvestigationMap from "../components/Map/InvestigationMap";
import MapLayers from "../components/Map/MapLayers";
import MapLegend from "../components/Map/MapLegend";

import CandidateList from "../components/Candidates/CandidateList";
import CandidateBlocked from "../components/Candidates/CandidateBlocked";
import EvidenceDrawer from "../components/Candidates/EvidenceDrawer";

import AISTimeline from "../components/Timeline/AISTimeline";

import {
  loadInvestigationData,
  normalizeAisResponse,
  normalizeCandidateResponse,
  normalizeDetectionGeometry,
  normalizeGeoJSON,
  saveInvestigationData,
} from "../utils/investigation";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function normalizeCompatibility(value) {
  if (!value) return null;

  return {
    ...value,
    status:
      value.status ||
      (value.compatible === true
        ? "pass"
        : value.compatible === false
          ? "blocked"
          : "unknown"),
  };
}

function normalizeDetectionJob(job) {
  if (!job) return null;

  const geo = normalizeDetectionGeometry(job);

  return {
    ...job,
    geojson: geo,
    isMock: job.isMock === true,
  };
}

function geometryProperties(job) {
  const metadata = job?.metadata || {};
  const extra = metadata?.extra || {};

  return {
    centroid: metadata.centroid || null,

    area_sq_km:
      extra.area_sq_km ??
      extra.area_km2 ??
      metadata.area_sq_km ??
      metadata.area_km2 ??
      null,

    perimeter_m:
      extra.perimeter_m ??
      metadata.perimeter_m ??
      null,

    confidence:
      extra.confidence ??
      extra.mean_probability ??
      metadata.confidence ??
      metadata.mean_probability ??
      null,
  };
}

function findTrackForCandidate(geojson, candidate) {
  if (!geojson || !candidate) return null;

  const features = geojson.features || [];

  const targetIds = [
    candidate.mmsi,
    candidate.candidate_id,
    candidate.vessel_id,
  ]
    .filter(Boolean)
    .map(String);

  if (!targetIds.length) return null;

  return (
    features.find((feature) => {
      const properties = feature?.properties || {};

      const values = [
        properties.mmsi,
        properties.candidate_id,
        properties.vessel_id,
      ]
        .filter(Boolean)
        .map(String);

      return values.some((value) => targetIds.includes(value));
    }) || null
  );
}

function extractTrackTimestamps(track) {
  if (!track) return [];

  const properties = track.properties || {};

  const timestamps =
    properties.timestamps_utc ??
    properties.timestamps ??
    properties.time ??
    properties.times ??
    [];

  if (Array.isArray(timestamps)) {
    return timestamps;
  }

  return [];
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function Investigation() {
  const { id } = useParams();
  const navigate = useNavigate();

  /* ------------------------------------------------------------------------ */
  /* Scene state                                                              */
  /* ------------------------------------------------------------------------ */

  const [scenes, setScenes] = useState([]);
  const [scene, setScene] = useState(null);
  const [manifest, setManifest] = useState(null);

  const [sceneLoading, setSceneLoading] = useState(true);
  const [sceneError, setSceneError] = useState(null);

  const [compatibility, setCompatibility] = useState(null);
  const [compatibilityLoading, setCompatibilityLoading] = useState(true);

  /* ------------------------------------------------------------------------ */
  /* Spill / detection                                                        */
  /* ------------------------------------------------------------------------ */

  const [spill, setSpill] = useState(null);

  const [detection, setDetection] = useState(null);
  const [detectionLoading, setDetectionLoading] = useState(false);
  const [detectionError, setDetectionError] = useState(null);

  const [slickGeojson, setSlickGeojson] = useState(null);

  const [slickIsMock, setSlickIsMock] = useState(false);
  const [mockArea, setMockArea] = useState(null);

  /* ------------------------------------------------------------------------ */
  /* Drift                                                                    */
  /* ------------------------------------------------------------------------ */

  const [hindcastResult, setHindcastResult] = useState(null);
  const [forecastResult, setForecastResult] = useState(null);

  const [hindcastLoading, setHindcastLoading] = useState(false);
  const [forecastLoading, setForecastLoading] = useState(false);

  const [driftError, setDriftError] = useState(null);

  /* ------------------------------------------------------------------------ */
  /* AIS                                                                      */
  /* ------------------------------------------------------------------------ */

  const [aisTracksGeojson, setAisTracksGeojson] = useState(null);
  const [aisLoading, setAisLoading] = useState(false);
  const [aisError, setAisError] = useState(null);

  const [selectedAisTrack, setSelectedAisTrack] = useState(null);

  /* ------------------------------------------------------------------------ */
  /* Candidates                                                               */
  /* ------------------------------------------------------------------------ */

  const [candidateRun, setCandidateRun] = useState(null);
  const [candidateError, setCandidateError] = useState(null);
  const [candidateBlockedDetails, setCandidateBlockedDetails] =
    useState(null);

  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateDetailLoading, setCandidateDetailLoading] = useState(false);

  const [selectedCandidateId, setSelectedCandidateId] = useState(null);

  /* ------------------------------------------------------------------------ */
  /* Timeline / report                                                        */
  /* ------------------------------------------------------------------------ */

  const [timelineIndex, setTimelineIndex] = useState(0);

  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState(null);

  /* ------------------------------------------------------------------------ */
  /* Map layers                                                               */
  /* ------------------------------------------------------------------------ */

  const [layers, setLayers] = useState({
    sarSource: true,
    slick: true,
    hindcastOrigin: true,
    forecastCorridor: true,
    aisTracks: true,
    candidateTrack: true,
  });

  const toggleLayer = useCallback((key) => {
    setLayers((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  }, []);

  /* ------------------------------------------------------------------------ */
  /* Persisted investigation                                                  */
  /* ------------------------------------------------------------------------ */

  const persisted = useMemo(() => {
    return loadInvestigationData(id);
  }, [id]);

  const spillId =
    spill?.spill_id ||
    persisted?.upload?.spill_id ||
    id;

  /* ------------------------------------------------------------------------ */
  /* Load scene                                                               */
  /* ------------------------------------------------------------------------ */

  const loadScene = useCallback(async (sceneId) => {
    if (!sceneId) return;

    setSceneLoading(true);
    setCompatibilityLoading(true);
    setSceneError(null);

    try {
      const response = await getSceneManifest(sceneId);

      setScene(response?.scene || null);
      setManifest(response?.manifest || null);

      try {
        const compatibilityResponse =
          await getSceneCompatibility(sceneId);

        setCompatibility(
          normalizeCompatibility(
            compatibilityResponse?.compatibility
          )
        );
      } catch (compatibilityError) {
        setCompatibility(null);

        const compatibilityApiError =
          getApiError(compatibilityError);

        console.warn(
          "Scene compatibility request failed:",
          compatibilityApiError.message
        );
      }
    } catch (err) {
      const apiError = getApiError(err);

      setSceneError(apiError.message);
      setScene(null);
      setManifest(null);
      setCompatibility(null);
    } finally {
      setSceneLoading(false);
      setCompatibilityLoading(false);
    }
  }, []);

  /* ------------------------------------------------------------------------ */
  /* Initial investigation boot                                               */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    let active = true;

    async function boot() {
      setSceneLoading(true);
      setCompatibilityLoading(true);
      setSceneError(null);
      setDetectionError(null);
      setAisError(null);

      const saved = loadInvestigationData(id);

      try {
        /* Restore previously saved detection */

        if (saved?.detection && active) {
          const normalized =
            normalizeDetectionJob(saved.detection);

          setDetection(normalized);

          if (normalized.geojson) {
            setSlickGeojson(normalized.geojson);
          }

          setSlickIsMock(normalized.isMock === true);
        }

        /* Load spill */

        const spillResponse = await getSpill(id);

        if (!active) return;

        setSpill(spillResponse);

        /* Load scene list */

        const sceneListResponse = await getScenes();

        if (!active) return;

        const sceneList =
          sceneListResponse?.scenes || [];

        setScenes(sceneList);

        /* Determine correct scene */

        const savedSceneId = saved?.sceneId;

        let targetSceneId = savedSceneId;

        if (!targetSceneId) {
          const matchingScene =
            sceneList.find(
              (item) => item.scene_id === id
            );

          targetSceneId =
            matchingScene?.scene_id ||
            sceneList[0]?.scene_id ||
            null;
        }

        if (targetSceneId) {
          await loadScene(targetSceneId);
        } else {
          setSceneLoading(false);
          setCompatibilityLoading(false);

          setSceneError(
            "No SAR scene metadata is available for this investigation."
          );
        }

        /* Resume running detection */

        if (
          saved?.detection?.job_id &&
          ["QUEUED", "PROCESSING"].includes(
            saved.detection.status
          )
        ) {
          setDetectionLoading(true);

          try {
            const finalJob = await pollDetection(
              saved.detection.job_id,
              {
                onUpdate: (job) => {
                  if (!active) return;

                  const normalized =
                    normalizeDetectionJob(job);

                  setDetection(normalized);

                  if (normalized.geojson) {
                    setSlickGeojson(
                      normalized.geojson
                    );
                  }

                  saveInvestigationData(id, {
                    ...saved,
                    detection: job,
                  });
                },
              }
            );

            if (active) {
              const normalized =
                normalizeDetectionJob(finalJob);

              setDetection(normalized);

              if (normalized.geojson) {
                setSlickGeojson(
                  normalized.geojson
                );
              }
            }
          } catch (err) {
            if (active) {
              setDetectionError(
                getApiError(err).message
              );
            }
          } finally {
            if (active) {
              setDetectionLoading(false);
            }
          }
        }
      } catch (err) {
        if (!active) return;

        const apiError = getApiError(err);

        setSceneError(apiError.message);

        /* Try to preserve spill data if scene loading failed */

        try {
          const spillResponse = await getSpill(id);

          if (active) {
            setSpill(spillResponse);
          }
        } catch (spillError) {
          if (active) {
            setSceneError(
              `${apiError.message} / ${getApiError(spillError).message}`
            );
          }
        } finally {
          if (active) {
            setSceneLoading(false);
            setCompatibilityLoading(false);
          }
        }
      }
    }

    boot();

    return () => {
      active = false;
    };
  }, [id, loadScene]);

  /* ------------------------------------------------------------------------ */
  /* Compatibility                                                            */
  /* ------------------------------------------------------------------------ */

  const isCompatible =
    compatibility?.compatible === true;

  /* ------------------------------------------------------------------------ */
  /* Try loading GeoJSON artifact                                             */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    let active = true;

    async function loadArtifactGeometry() {
      if (slickGeojson) return;

      const raw =
        detection?.artifacts?.geojson;

      if (!raw) return;

      const url = resolveApiUrl(raw);

      if (!url) return;

      try {
        const response = await fetch(url);

        if (!response.ok) return;

        const payload = await response.json();

        const geo = normalizeGeoJSON(payload);

        if (active && geo) {
          setSlickGeojson(geo);
        }
      } catch {
        /*
         * Artifact serving is optional.
         * The main detection response may already contain GeoJSON.
         */
      }
    }

    loadArtifactGeometry();

    return () => {
      active = false;
    };
  }, [detection?.artifacts?.geojson, slickGeojson]);

  /* ------------------------------------------------------------------------ */
  /* Real detection                                                           */
  /* ------------------------------------------------------------------------ */

  const runDetection = async () => {
    const saved = loadInvestigationData(id);

    const filePath =
      saved?.upload?.saved_path;

    const sceneId =
      scene?.scene_id ||
      saved?.sceneId;

    if (!filePath || !sceneId) {
      setDetectionError(
        "No server-side uploaded file path is available. Start from Upload & Run Detection."
      );

      return;
    }

    setDetectionLoading(true);
    setDetectionError(null);

    try {
      const job = await createDetection({
        sceneId,
        filePath,
      });

      const normalizedJob =
        normalizeDetectionJob(job);

      setDetection(normalizedJob);

      saveInvestigationData(id, {
        ...saved,
        sceneId,
        detection: job,
      });

      const finalJob = await pollDetection(
        job.job_id,
        {
          onUpdate: (next) => {
            const normalized =
              normalizeDetectionJob(next);

            setDetection(normalized);

            if (normalized.geojson) {
              setSlickGeojson(
                normalized.geojson
              );
            }

            saveInvestigationData(id, {
              ...saved,
              sceneId,
              detection: next,
            });
          },
        }
      );

      const normalizedFinal =
        normalizeDetectionJob(finalJob);

      setDetection(normalizedFinal);

      if (normalizedFinal.geojson) {
        setSlickGeojson(
          normalizedFinal.geojson
        );
      }

      setSlickIsMock(false);

      saveInvestigationData(id, {
        ...saved,
        sceneId,
        detection: finalJob,
      });
    } catch (err) {
      setDetectionError(
        getApiError(err).message
      );
    } finally {
      setDetectionLoading(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Demo detection                                                           */
  /* ------------------------------------------------------------------------ */

  const runDemoDetection = async () => {
    if (!spillId) return;

    setDetectionLoading(true);
    setDetectionError(null);

    try {
      const result =
        await detectSpillMock(spillId);

      const geometry =
        normalizeGeoJSON(result?.geometry);

      setSlickGeojson(geometry);

      setSlickIsMock(true);

      setMockArea(
        result?.area_sq_km ?? null
      );

      setDetection({
        status: "COMPLETED",

        message:
          result?.message ||
          "Demo detection completed.",

        metadata: {
          detector_name:
            "Backend demonstration endpoint",

          model_name:
            "Mock segmentation",

          total_slicks_detected: 1,

          probability_threshold: null,

          centroid: null,

          extra: {
            area_sq_km:
              result?.area_sq_km ?? null,
          },
        },

        geojson: geometry,

        isMock: true,
      });
    } catch (err) {
      setDetectionError(
        getApiError(err).message
      );
    } finally {
      setDetectionLoading(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Drift                                                                     */
  /* ------------------------------------------------------------------------ */

  const runDriftAction = async (
    direction,
    params
  ) => {
    if (!slickGeojson) {
      setDriftError(
        "No slick geometry is available. Run detection first."
      );

      return;
    }

    const isHindcast =
      direction === "hindcast";

    const setLoading = isHindcast
      ? setHindcastLoading
      : setForecastLoading;

    const setResult = isHindcast
      ? setHindcastResult
      : setForecastResult;

    const runner = isHindcast
      ? runHindcast
      : runForecast;

    setLoading(true);
    setDriftError(null);

    try {
      const result = await runner({
        spillId,

        acquisitionTimeUtc:
          scene?.acquisition_start_utc ||
          undefined,

        slickGeojson,

        parameters: params,
      });

      setResult(result);
    } catch (err) {
      setDriftError(
        getApiError(err).message
      );
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* AIS                                                                       */
  /* ------------------------------------------------------------------------ */

  const loadAis = async () => {
    if (!spillId) return;

    setAisLoading(true);
    setAisError(null);

    try {
      const response =
        await getAisTracks(spillId);

      const geo =
        normalizeAisResponse(response);

      if (!geo) {
        throw Object.assign(
          new Error(
            "AIS endpoint returned no GeoJSON tracks."
          ),
          {
            code: "AIS_EMPTY",
          }
        );
      }

      setAisTracksGeojson(geo);

      /* Automatically select first track if available */

      const firstTrack =
        geo.features?.[0] || null;

      if (firstTrack) {
        setSelectedAisTrack(firstTrack);
      }
    } catch (err) {
      const apiError =
        getApiError(err);

      if (
        apiError.code ===
        "AIS_NOT_CONFIGURED"
      ) {
        setAisError(
          "AIS endpoint is not configured yet."
        );
      } else {
        setAisError(
          apiError.message
        );
      }

      setAisTracksGeojson(null);
    } finally {
      setAisLoading(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Candidate ranking                                                        */
  /* ------------------------------------------------------------------------ */

  const handleRankCandidates =
    async () => {
      if (!compatibility || !isCompatible) {
        return;
      }

      setCandidateLoading(true);
      setCandidateError(null);
      setCandidateBlockedDetails(null);

      try {
        /* -------------------------------------------------------------- */
        /* Prefer future GET candidate endpoint                           */
        /* -------------------------------------------------------------- */

        try {
          const generated =
            normalizeCandidateResponse(
              await getCandidates(spillId)
            );

          if (generated) {
            setCandidateRun(generated);

            if (
              generated.candidates?.length
            ) {
              setSelectedCandidateId(
                generated.candidates[0]
                  .candidate_id
              );
            }

            return;
          }
        } catch {
          /*
           * Current backend may not expose
           * GET /api/spills/{id}/candidates.
           *
           * Fall through to rankCandidates().
           */
        }

        /* -------------------------------------------------------------- */
        /* Existing rank endpoint                                         */
        /* -------------------------------------------------------------- */

        const tracks =
          aisTracksGeojson?.features || [];

        const candidateInputs =
          tracks
            .map(
              (track) =>
                track?.properties
                  ?.candidate_input
            )
            .filter(Boolean);

        if (!candidateInputs.length) {
          throw Object.assign(
            new Error(
              "No rankable AIS candidate records are available."
            ),
            {
              code:
                "NO_AIS_CANDIDATES",
            }
          );
        }

        const drift =
          hindcastResult ||
          forecastResult;

        if (!drift) {
          throw new Error(
            "Run a hindcast or forecast before ranking candidates."
          );
        }

        const driftEvidence = {
          run_id:
            drift.run_id || null,

          run_type:
            drift.run_type || null,

          mode:
            drift.data_mode ||
            "analyst_parameter_driven",

          corridor_reference:
            drift.corridor?.type ||
            null,

          uncertainty_radius_m:
            drift.uncertainty_radius_m ??
            null,

          assumptions:
            drift.assumptions || [],
        };

        const result =
          await rankCandidates(
            spillId,
            {
              compatibility: {
                compatible: true,

                status: "passed",

                temporal_overlap:
                  compatibility.temporal_overlap ??
                  true,

                geographic_overlap:
                  compatibility.geographic_overlap ??
                  true,

                crs_valid:
                  compatibility.crs_valid ??
                  true,

                environmental_coverage:
                  compatibility.environmental_coverage ??
                  true,

                reasons:
                  compatibility.reasons ||
                  [],
              },

              driftEvidence,

              candidates:
                candidateInputs,

              limit: 10,
            }
          );

        setCandidateRun(result);

        if (
          result?.candidates?.length
        ) {
          setSelectedCandidateId(
            result.candidates[0]
              .candidate_id
          );
        }
      } catch (err) {
        const apiError =
          getApiError(err);

        if (
          apiError.code ===
          "NO_AIS_CANDIDATES"
        ) {
          setCandidateError(
            "AIS data is available only when the configured AIS endpoint returns rankable candidate_input records."
          );
        } else {
          setCandidateError(
            apiError.message
          );
        }

        setCandidateBlockedDetails(
          apiError.details || null
        );
      } finally {
        setCandidateLoading(false);
      }
    };

  /* ------------------------------------------------------------------------ */
  /* Selected candidate                                                       */
  /* ------------------------------------------------------------------------ */

  const selectedCandidate =
    useMemo(() => {
      return (
        candidateRun?.candidates?.find(
          (candidate) =>
            candidate.candidate_id ===
            selectedCandidateId
        ) || null
      );
    }, [
      candidateRun,
      selectedCandidateId,
    ]);

  /* ------------------------------------------------------------------------ */
  /* Candidate evidence                                                       */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    let active = true;

    async function hydrateCandidate() {
      if (
        !selectedCandidate ||
        !candidateRun?.run_id
      ) {
        return;
      }

      const trackReference =
        selectedCandidate.track_reference;

      const sourceReference =
        selectedCandidate.source_reference;

      if (
        !trackReference &&
        !sourceReference
      ) {
        return;
      }

      setCandidateDetailLoading(true);

      try {
        const detail =
          await getCandidateDetail(
            spillId,
            candidateRun.run_id,
            selectedCandidate.candidate_id
          );

        if (!active || !detail) {
          return;
        }

        setCandidateRun(
          (previous) => {
            if (!previous) {
              return previous;
            }

            return {
              ...previous,

              candidates:
                previous.candidates.map(
                  (candidate) =>
                    candidate.candidate_id ===
                    detail.candidate_id
                      ? detail
                      : candidate
                ),
            };
          }
        );
      } catch {
        /*
         * Candidate detail is optional.
         * Existing candidate result remains usable.
         */
      } finally {
        if (active) {
          setCandidateDetailLoading(false);
        }
      }
    }

    hydrateCandidate();

    return () => {
      active = false;
    };
  }, [
    selectedCandidate,
    candidateRun?.run_id,
    spillId,
  ]);

  /* ------------------------------------------------------------------------ */
  /* Candidate track                                                          */
  /* ------------------------------------------------------------------------ */

  const candidateTrackGeojson =
    useMemo(() => {
      if (!selectedCandidate) {
        return null;
      }

      /* Track directly embedded in candidate */

      if (
        selectedCandidate.track_reference &&
        typeof selectedCandidate.track_reference ===
          "object"
      ) {
        return normalizeGeoJSON(
          selectedCandidate.track_reference
        );
      }

      /* Track found inside AIS FeatureCollection */

      const fromAis =
        findTrackForCandidate(
          aisTracksGeojson,
          selectedCandidate
        );

      if (fromAis) {
        return fromAis;
      }

      /*
       * A string track_reference may point
       * to an API artifact. It cannot be synchronously
       * fetched inside useMemo.
       */

      return null;
    }, [
      selectedCandidate,
      aisTracksGeojson,
    ]);

  /* ------------------------------------------------------------------------ */
  /* Timeline                                                                 */
  /* ------------------------------------------------------------------------ */

  const selectedTimeline =
    useMemo(() => {
      return extractTrackTimestamps(
        candidateTrackGeojson
      );
    }, [candidateTrackGeojson]);

  /* ------------------------------------------------------------------------ */
  /* Candidate selection                                                      */
  /* ------------------------------------------------------------------------ */

  const handleCandidateSelect =
    (candidateId) => {
      setSelectedCandidateId(
        candidateId
      );

      setTimelineIndex(0);

      const candidate =
        candidateRun?.candidates?.find(
          (item) =>
            item.candidate_id ===
            candidateId
        );

      const track =
        findTrackForCandidate(
          aisTracksGeojson,
          candidate
        );

      setSelectedAisTrack(track);
    };

  /* ------------------------------------------------------------------------ */
  /* Report export                                                            */
  /* ------------------------------------------------------------------------ */

  const exportReport = async () => {
    if (!spillId) {
      setReportError(
        "No spill ID is available for report export."
      );

      return;
    }

    setReportLoading(true);
    setReportError(null);

    try {
      const geoProps =
        geometryProperties(detection);

      let status = "failed";

      if (
        candidateRun?.candidates?.length
      ) {
        status = "complete";
      } else if (
        detection?.status ===
          "COMPLETED" ||
        slickGeojson
      ) {
        status = "partial";
      } else if (
        compatibility &&
        compatibility.compatible === false
      ) {
        status = "blocked";
      }

      const dataMode =
        slickIsMock
          ? "synthetic_test_fixture"
          : detection?.status ===
              "COMPLETED"
            ? "real"
            : "unavailable";

      const payload = {
        title:
          `SpillTrace Investigation — ${spillId}`,

        status,

        data_mode: dataMode,

        spill_id: spillId,

        scene_id:
          scene?.scene_id || null,

        detector:
          detection?.metadata || {},

        geometry: slickGeojson
          ? {
              geometry_type:
                slickGeojson.geometry
                  ?.type ||
                slickGeojson.type ||
                null,

              centroid:
                geoProps.centroid,

              area_km2:
                geoProps.area_sq_km,

              perimeter_m:
                geoProps.perimeter_m,

              polygon_count: 1,

              geojson:
                slickGeojson,
            }
          : null,

        drift: {
          mode:
            hindcastResult?.data_mode ||
            forecastResult?.data_mode ||
            null,

          run_id:
            hindcastResult?.run_id ||
            forecastResult?.run_id ||
            null,

          origin_time_window:
            hindcastResult
              ? `${hindcastResult.start_time_utc} → ${hindcastResult.end_time_utc}`
              : null,

          forecast_horizon:
            forecastResult
              ? `${forecastResult.start_time_utc} → ${forecastResult.end_time_utc}`
              : null,

          timestep_minutes:
            hindcastResult?.timestep_minutes ||
            forecastResult?.timestep_minutes ||
            null,

          particle_count:
            hindcastResult?.particle_count ||
            forecastResult?.particle_count ||
            null,

          uncertainty_radius_m:
            hindcastResult?.uncertainty_radius_m ??
            forecastResult?.uncertainty_radius_m ??
            null,

          assumptions: [
            ...(hindcastResult?.assumptions ||
              []),
            ...(forecastResult?.assumptions ||
              []),
          ],

          hindcast_geojson:
            hindcastResult?.corridor ||
            null,

          forecast_geojson:
            forecastResult?.corridor ||
            null,
        },

        compatibility: {
          compatible:
            compatibility?.compatible ===
            true,

          status_code:
            compatibility?.status ||
            "unknown",

          reasons:
            compatibility?.reasons || [],

          sar_time_window:
            scene?.acquisition_start_utc &&
            scene?.acquisition_end_utc
              ? `${scene.acquisition_start_utc} → ${scene.acquisition_end_utc}`
              : null,

          geographic_overlap:
            compatibility?.geographic_overlap ??
            null,

          crs_valid:
            compatibility?.crs_valid ??
            null,

          environmental_coverage:
            compatibility?.environmental_coverage ??
            null,
        },

        sources: [
          scene
            ? {
                source_id:
                  scene.scene_id,

                source_type: "SAR",

                label:
                  scene.source ||
                  "SAR scene",

                provenance:
                  "Backend scene metadata",
              }
            : null,

          aisTracksGeojson
            ? {
                source_id:
                  "ais-configured",

                source_type: "AIS",

                label:
                  "AIS track source",

                provenance:
                  "Configured frontend AIS endpoint",
              }
            : null,
        ].filter(Boolean),

        candidates:
          (
            candidateRun?.candidates ||
            []
          ).map((candidate) => ({
            candidate_id:
              candidate.candidate_id,

            vessel_name:
              candidate.vessel_name,

            mmsi:
              candidate.mmsi,

            rank:
              candidate.rank,

            score:
              candidate.score,

            score_contributions:
              candidate.score_contributions ||
              {},

            evidence:
              candidate.evidence_statements ||
              [],

            ais_quality:
              candidate.ais_quality ||
              {},

            source_ids:
              candidate.source_reference
                ? [
                    candidate.source_reference,
                  ]
                : [],
          })),

        limitations: [
          !aisTracksGeojson
            ? "AIS tracks are not available from the configured frontend endpoint."
            : null,

          !candidateRun?.candidates?.length
            ? "No candidate ranking result is available."
            : null,

          slickIsMock
            ? "Slick geometry came from the backend demonstration endpoint, not the real ML detector."
            : null,
        ].filter(Boolean),

        warnings:
          detectionError
            ? [detectionError]
            : [],
      };

      const report =
        await createInvestigationReport(
          payload
        );

      const html =
        await createInvestigationReportHtml(
          payload
        );

      const blob = new Blob(
        [html],
        {
          type:
            "text/html;charset=utf-8",
        }
      );

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;

      link.download =
        `${report?.report_id || "spilltrace-investigation"}.html`;

      document.body.appendChild(link);

      link.click();

      link.remove();

      URL.revokeObjectURL(url);
    } catch (err) {
      setReportError(
        getApiError(err).message
      );
    } finally {
      setReportLoading(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Derived UI data                                                          */
  /* ------------------------------------------------------------------------ */

  const resolvedTitle =
    scene?.scene_id ||
    spill?.spill_id ||
    id;

  const bounds =
    scene?.bounds ||
    manifest?.bounds ||
    null;

  const candidateCount =
    candidateRun?.candidates?.length || 0;

  /* ------------------------------------------------------------------------ */
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="investigation-page">
      {/* ================================================================== */}
      {/* HEADER                                                             */}
      {/* ================================================================== */}

      <div className="investigation-header">
        <div className="investigation-title-row">
          <div>
            <p className="eyebrow">
              SPILLTRACE / INVESTIGATION WORKSPACE
            </p>

            <h1>{resolvedTitle}</h1>
          </div>

          <span
            className={`investigation-status status-${
              compatibility?.status ||
              "loading"
            }`}
          >
            {compatibilityLoading
              ? "Checking…"
              : compatibility?.compatible
                ? "Compatible"
                : "Blocked"}
          </span>
        </div>

        <div className="investigation-actions">
          <button
            className="secondary-button"
            onClick={() =>
              navigate("/upload")
            }
          >
            ← New Investigation
          </button>

          <button
            className="primary-button"
            onClick={exportReport}
            disabled={reportLoading}
          >
            {reportLoading
              ? "Exporting…"
              : "Export Investigation Report"}
          </button>
        </div>

        {sceneError && (
          <div className="error-state">
            <strong>
              Scene metadata
            </strong>

            <p>{sceneError}</p>
          </div>
        )}

        {reportError && (
          <div className="error-state">
            <strong>
              Report export failed
            </strong>

            <p>{reportError}</p>
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* WORKSPACE                                                          */}
      {/* ================================================================== */}

      <div className="investigation-workspace">
        {/* ================================================================ */}
        {/* MAP                                                               */}
        {/* ================================================================ */}

        <div className="map-container">
          <InvestigationMap
            sceneBounds={bounds}
            slickGeojson={
              slickGeojson
            }
            hindcastCorridor={
              hindcastResult?.corridor ||
              null
            }
            hindcastEndpoint={
              hindcastResult?.endpoint ||
              null
            }
            forecastCorridor={
              forecastResult?.corridor ||
              null
            }
            forecastEndpoint={
              forecastResult?.endpoint ||
              null
            }
            aisTracksGeojson={
              aisTracksGeojson
            }
            candidateTrackGeojson={
              candidateTrackGeojson
            }
            layers={layers}
          />

          <MapLegend />

          <div className="map-overlay-stack">
            <MapLayers
              layers={layers}
              onToggle={toggleLayer}
              availability={{
                sarSource: !!bounds,

                slick:
                  !!slickGeojson,

                hindcastOrigin:
                  !!hindcastResult
                    ?.corridor,

                forecastCorridor:
                  !!forecastResult
                    ?.corridor,

                aisTracks:
                  !!aisTracksGeojson,

                candidateTrack:
                  !!candidateTrackGeojson,
              }}
            />

            <button
              className="secondary-button map-action-button"
              onClick={loadAis}
              disabled={aisLoading}
            >
              {aisLoading
                ? "Loading AIS…"
                : "Load AIS Tracks"}
            </button>
          </div>
        </div>

        {/* ================================================================ */}
        {/* SIDEBAR                                                           */}
        {/* ================================================================ */}

        <aside className="investigation-sidebar">
          {/* -------------------------------------------------------------- */}
          {/* SCENE SELECTOR                                                 */}
          {/* -------------------------------------------------------------- */}

          <section className="investigation-sidebar-section">
            <SceneSelector
              scenes={scenes}
              selectedSceneId={
                scene?.scene_id
              }
              onSelect={loadScene}
              loading={
                sceneLoading &&
                scenes.length === 0
              }
              error={null}
            />
          </section>

          {/* -------------------------------------------------------------- */}
          {/* SCENE METADATA                                                 */}
          {/* -------------------------------------------------------------- */}

          <section className="investigation-sidebar-section">
            {sceneLoading ? (
              <div className="loading-state">
                Loading scene metadata…
              </div>
            ) : (
              <SceneMetadata
                scene={scene}
                manifest={manifest}
              />
            )}
          </section>

          {/* -------------------------------------------------------------- */}
          {/* COMPATIBILITY                                                  */}
          {/* -------------------------------------------------------------- */}

          <section className="investigation-sidebar-section">
            <CompatibilityStatus
              compatibility={
                compatibilityLoading
                  ? { status: "loading" }
                  : compatibility
              }
              onRankCandidates={
                handleRankCandidates
              }
              rankDisabled={
                candidateLoading ||
                !(
                  hindcastResult ||
                  forecastResult
                )
              }
            />
          </section>

          {/* -------------------------------------------------------------- */}
          {/* AIS QUALITY                                                    */}
          {/* -------------------------------------------------------------- */}

          <section className="investigation-sidebar-section">
            <AISQualityPanel
              compatibility={
                compatibility
              }
            />

            {aisError && (
              <div className="empty-state">
                {aisError}
              </div>
            )}
          </section>

          {/* -------------------------------------------------------------- */}
          {/* DETECTION                                                       */}
          {/* -------------------------------------------------------------- */}

          <section className="investigation-sidebar-section">
            <div className="section-label">
              DETECTION
            </div>

            <DetectionStatus
              job={detection}
            />

            <SlickMetrics
              metadata={
                detection?.metadata
              }
              mockArea={mockArea}
              isMockSource={
                slickIsMock
              }
            />

            {detectionError && (
              <div className="error-state">
                <strong>
                  Detection error
                </strong>

                <p>
                  {detectionError}
                </p>
              </div>
            )}

            {!detection?.isMock &&
              !slickGeojson && (
                <button
                  className="secondary-button"
                  onClick={
                    runDetection
                  }
                  disabled={
                    detectionLoading
                  }
                >
                  {detectionLoading
                    ? "Running detector…"
                    : "Run Real Detection"}
                </button>
              )}

            {spill && (
              <button
                className="secondary-button"
                onClick={
                  runDemoDetection
                }
                disabled={
                  detectionLoading
                }
                style={{
                  marginTop: 8,
                }}
              >
                {detectionLoading
                  ? "Working…"
                  : "Run Demo Detection"}
              </button>
            )}

            {detection?.artifacts &&
              Object.keys(
                detection.artifacts
              ).length > 0 && (
                <div className="artifact-list">
                  {Object.entries(
                    detection.artifacts
                  ).map(
                    ([key, value]) => {
                      const url =
                        resolveApiUrl(
                          value
                        );

                      if (!url) {
                        return null;
                      }

                      return (
                        <a
                          key={key}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {key.replaceAll(
                            "_",
                            " "
                          )}
                        </a>
                      );
                    }
                  )}
                </div>
              )}
          </section>

          {/* -------------------------------------------------------------- */}
          {/* DRIFT                                                           */}
          {/* -------------------------------------------------------------- */}

          <section className="investigation-sidebar-section">
            <DriftControls
              onRunHindcast={(params) =>
                runDriftAction(
                  "hindcast",
                  params
                )
              }
              onRunForecast={(params) =>
                runDriftAction(
                  "forecast",
                  params
                )
              }
              hindcastLoading={
                hindcastLoading
              }
              forecastLoading={
                forecastLoading
              }
              disabledReason={
                !slickGeojson
                  ? "Run detection to obtain slick geometry before running drift."
                  : null
              }
            />

            {driftError && (
              <div className="error-state">
                <strong>
                  Drift request failed
                </strong>

                <p>
                  {driftError}
                </p>
              </div>
            )}
          </section>

          {/* -------------------------------------------------------------- */}
          {/* AIS TRACK INFO                                                  */}
          {/* -------------------------------------------------------------- */}

          <section className="investigation-sidebar-section">
            <div className="section-label">
              AIS
            </div>

            <AISTrackInfo
              track={selectedAisTrack}
              compatibilityBlocked={
                !isCompatible
              }
              blockedReason={
                compatibility
                  ?.reasons?.[0]
              }
            />
          </section>

          {/* -------------------------------------------------------------- */}
          {/* CANDIDATES                                                      */}
          {/* -------------------------------------------------------------- */}

          <section className="candidate-section investigation-sidebar-section">
            <div className="candidate-section-header">
              <h2>
                Candidates
              </h2>

              {candidateRun && (
                <span className="candidate-count">
                  {candidateCount}
                </span>
              )}
            </div>

            {candidateLoading && (
              <div className="loading-state">
                Generating / ranking
                candidates…
              </div>
            )}

            {!candidateLoading &&
              candidateError && (
                <CandidateBlocked
                  reason={
                    candidateError
                  }
                  details={
                    candidateBlockedDetails
                  }
                />
              )}

            {!candidateLoading &&
              !candidateError &&
              candidateRun && (
                <CandidateList
                  candidates={
                    candidateRun.candidates ||
                    []
                  }
                  selectedCandidateId={
                    selectedCandidateId
                  }
                  onSelect={
                    handleCandidateSelect
                  }
                />
              )}

            {!candidateLoading &&
              !candidateError &&
              !candidateRun && (
                <div className="empty-state">
                  Load AIS, run drift,
                  then rank candidates.
                  The frontend does not
                  invent vessels when AIS
                  data is absent.
                </div>
              )}
          </section>

          {/* -------------------------------------------------------------- */}
          {/* EVIDENCE + TIMELINE                                            */}
          {/* -------------------------------------------------------------- */}

          {selectedCandidate && (
            <section className="investigation-sidebar-section">
              {candidateDetailLoading && (
                <div className="loading-state">
                  Loading candidate
                  evidence…
                </div>
              )}

              <EvidenceDrawer
                candidate={
                  selectedCandidate
                }
              />

              <AISTimeline
                timestamps={
                  selectedTimeline
                }
                selectedIndex={
                  timelineIndex
                }
                onChange={
                  setTimelineIndex
                }
              />
            </section>
          )}

          {/* -------------------------------------------------------------- */}
          {/* DISCLAIMER                                                      */}
          {/* -------------------------------------------------------------- */}

          <div className="investigation-disclaimer">
            <strong>
              Investigation support only
            </strong>

            <span>
              {candidateRun?.disclaimer ||
                "Candidate rankings support investigation and do not constitute legal attribution."}
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}

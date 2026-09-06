import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import {
  getSceneManifest,
  getSceneCompatibility,
  getSpill,
  detectSpillMock,
  runHindcast,
  runForecast,
  rankCandidates,
  getApiError,
} from "../services/api";

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

/* =========================================================
   NOTE ON WHAT "id" MEANS HERE

   Route is /investigation/:id. Today, the only real identifiers
   the backend gives out are scene_id (from GET /api/scenes) and
   spill_id (from POST /api/spills/upload). There is no unified
   "investigation_id" concept on the backend. We treat :id as a
   scene_id first (since GET /api/scenes/{id}/manifest is the Day 4
   entrypoint); if that 404s, we fall back to treating it as a
   spill_id via GET /api/spills/{id}. Whichever resolves is shown.
========================================================= */

export default function Investigation() {
  const { id } = useParams();

  /* ---------------- Scene state (Day 4/5) ---------------- */
  const [scene, setScene] = useState(null);
  const [manifest, setManifest] = useState(null);
  const [sceneLoading, setSceneLoading] = useState(true);
  const [sceneError, setSceneError] = useState(null);
  const [compatibility, setCompatibility] = useState(null);
  const [compatibilityLoading, setCompatibilityLoading] = useState(true);

  /* ---------------- Spill fallback state ---------------- */
  const [spill, setSpill] = useState(null);
  const [spillError, setSpillError] = useState(null);

  /* ---------------- Detection state (Day 6) ---------------- */
  // No live detection job is auto-started here — the backend has no
  // endpoint that both accepts a browser upload AND runs the real
  // detector (see services/api.js header comment, gap #3). This page
  // shows whatever the Upload flow already produced via the mock
  // /spills/{id}/detect endpoint, honestly labelled as mock.
  const [slickGeojson, setSlickGeojson] = useState(null);
  const [slickIsMock, setSlickIsMock] = useState(false);
  const [mockArea, setMockArea] = useState(null);

  /* ---------------- Drift state (Day 6) ---------------- */
  const [hindcastResult, setHindcastResult] = useState(null);
  const [forecastResult, setForecastResult] = useState(null);
  const [hindcastLoading, setHindcastLoading] = useState(false);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [driftError, setDriftError] = useState(null);

  /* ---------------- Candidates state (Day 7) ---------------- */
  const [candidateRun, setCandidateRun] = useState(null);
  const [candidateError, setCandidateError] = useState(null);
  const [candidateBlockedDetails, setCandidateBlockedDetails] = useState(null);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);

  /* ---------------- Timeline state (Day 7) ---------------- */
  const [timelineIndex, setTimelineIndex] = useState(0);

  /* ---------------- Map layer toggles (Day 8) ---------------- */
  const [layers, setLayers] = useState({
    sarSource: true,
    slick: true,
    hindcastOrigin: true,
    forecastCorridor: true,
    aisTracks: true,
    candidateTrack: true,
  });

  const toggleLayer = (key) => setLayers((prev) => ({ ...prev, [key]: !prev[key] }));

  /* =======================================================
     LOAD SCENE + COMPATIBILITY (Day 4/5)
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    async function load() {
      setSceneLoading(true);
      setSceneError(null);
      setCompatibilityLoading(true);

      try {
        const manifestResponse = await getSceneManifest(id);
        if (!mounted) return;
        setScene(manifestResponse.scene);
        setManifest(manifestResponse.manifest);
      } catch (err) {
        if (!mounted) return;
        const apiErr = getApiError(err);

        // Fall back: maybe :id is a spill_id, not a scene_id.
        try {
          const spillResponse = await getSpill(id);
          if (!mounted) return;
          setSpill(spillResponse);
          setSceneError(null);

          // The only endpoint that returns any geometry for a spill_id
          // is the mock /spills/{id}/detect endpoint (see api.js and
          // Upload.jsx docstrings — it is NOT a real detector run, it
          // always returns the same fixed demonstration polygon). We
          // re-call it here so refreshing/deep-linking into an
          // investigation still shows that same demo polygon rather
          // than nothing, and we label it clearly as mock everywhere
          // it's displayed.
          try {
            const detectResponse = await detectSpillMock(id);
            if (!mounted) return;
            if (detectResponse.geometry) {
              setSlickGeojson({
                type: "Feature",
                properties: {
                  area_sq_km: detectResponse.area_sq_km ?? null,
                },
                geometry: detectResponse.geometry,
              });
              setSlickIsMock(true);
              setMockArea(detectResponse.area_sq_km ?? null);
            }
          } catch {
            // Non-fatal — geometry just stays unavailable.
          }
        } catch (spillErr) {
          if (!mounted) return;
          setSpillError(getApiError(spillErr).message);
          setSceneError(apiErr.message);
        }
      } finally {
        if (mounted) setSceneLoading(false);
      }

      try {
        const compatResponse = await getSceneCompatibility(id);
        if (!mounted) return;
        const c = compatResponse.compatibility;
        setCompatibility({
          ...c,
          status: c.compatible ? "pass" : "blocked",
        });
      } catch (err) {
        if (!mounted) return;
        const apiErr = getApiError(err);
        setCompatibility({
          status: apiErr.status === 404 ? "unknown" : "error",
          reasons: [apiErr.message],
        });
      } finally {
        if (mounted) setCompatibilityLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [id]);

  const isCompatible = compatibility?.compatible === true;

  /* =======================================================
     DRIFT ACTIONS (Day 6)

     NOTE: hindcast/forecast require slick_geojson. Until a real
     detection produces one, we cannot honestly call these — the
     UI disables the buttons and explains why instead of sending
     a fabricated polygon.
  ======================================================= */

  const runDriftAction = async (direction, params) => {
    if (!slickGeojson) {
      setDriftError("No slick geometry is available yet — run detection first.");
      return;
    }

    const setLoading = direction === "hindcast" ? setHindcastLoading : setForecastLoading;
    const setResult = direction === "hindcast" ? setHindcastResult : setForecastResult;
    const runner = direction === "hindcast" ? runHindcast : runForecast;

    setLoading(true);
    setDriftError(null);

    try {
      const result = await runner({
        spillId: spill?.spill_id || id,
        slickGeojson,
        parameters: params,
      });
      setResult(result);
    } catch (err) {
      setDriftError(getApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  /* =======================================================
     CANDIDATE RANKING (Day 7)

     No AIS source exists, so `candidates` is always []. We still
     wire the real call so the 409-blocked path is exercised
     honestly, and so this starts working the day AIS candidates
     exist to submit.
  ======================================================= */

  const handleRankCandidates = async () => {
    if (!compatibility) return;

    setCandidateLoading(true);
    setCandidateError(null);
    setCandidateBlockedDetails(null);

    const compatibilityPayload = {
      compatible: !!compatibility.compatible,
      status: compatibility.compatible ? "passed" : "blocked",
      temporal_overlap: compatibility.temporal_overlap ?? false,
      geographic_overlap: compatibility.geographic_overlap ?? false,
      crs_valid: compatibility.crs_valid ?? false,
      environmental_coverage: compatibility.environmental_coverage ?? false,
      reasons: compatibility.reasons || [],
    };

    const driftEvidence = {
      run_id: hindcastResult?.run_id || "no_drift_run_available",
      run_type: "hindcast",
      mode: hindcastResult?.data_mode || "analyst_parameter_driven",
      corridor_reference: null,
      uncertainty_radius_m: hindcastResult?.uncertainty_radius_m ?? null,
      assumptions: hindcastResult?.assumptions || [],
    };

    try {
      const result = await rankCandidates(spill?.spill_id || id, {
        compatibility: compatibilityPayload,
        driftEvidence,
        candidates: [], // No AIS source to draw real candidates from — see api.js gap notes.
        limit: 10,
      });
      setCandidateRun(result);
    } catch (err) {
      const apiErr = getApiError(err);
      setCandidateError(apiErr.message);
      setCandidateBlockedDetails(apiErr.details);
    } finally {
      setCandidateLoading(false);
    }
  };

  const selectedCandidate = useMemo(
    () => candidateRun?.candidates?.find((c) => c.candidate_id === selectedCandidateId) || null,
    [candidateRun, selectedCandidateId]
  );

  /* =======================================================
     RENDER
  ======================================================= */

  const resolvedTitle = scene?.scene_id || spill?.spill_id || id;

  return (
    <div className="investigation-page">
      <div className="investigation-header">
        <div className="investigation-title-row">
          <h1>{resolvedTitle}</h1>
          <span className={`investigation-status status-${compatibility?.status || "loading"}`}>
            {compatibilityLoading ? "Checking…" : compatibility?.compatible ? "Compatible" : "Blocked"}
          </span>
        </div>

        {sceneError && spillError && (
          <div className="error-state">
            <strong>Could not resolve "{id}" as a scene or a spill</strong>
            <p>
              Scene lookup: {sceneError}
              <br />
              Spill lookup: {spillError}
            </p>
          </div>
        )}
      </div>

      <div className="investigation-workspace">
        <div className="map-container">
          <InvestigationMap
            sceneBounds={scene?.bounds || manifest?.bounds || null}
            slickGeojson={slickGeojson}
            hindcastCorridor={hindcastResult?.corridor || null}
            hindcastEndpoint={hindcastResult?.endpoint || null}
            forecastCorridor={forecastResult?.corridor || null}
            forecastEndpoint={forecastResult?.endpoint || null}
            aisTracksGeojson={null}
            candidateTrackGeojson={null}
            layers={layers}
          />

          <MapLegend />

          <MapLayers
            layers={layers}
            onToggle={toggleLayer}
            availability={{
              sarSource: !!(scene?.bounds || manifest?.bounds),
              slick: !!slickGeojson,
              hindcastOrigin: !!hindcastResult?.corridor,
              forecastCorridor: !!forecastResult?.corridor,
              aisTracks: false,
              candidateTrack: !!selectedCandidate,
            }}
          />
        </div>

        <aside className="investigation-sidebar">
          <section className="investigation-sidebar-section">
            {sceneLoading ? (
              <div className="loading-state">Loading scene metadata…</div>
            ) : (
              <SceneMetadata scene={scene} manifest={manifest} />
            )}
          </section>

          <section className="investigation-sidebar-section">
            <CompatibilityStatus
              compatibility={compatibilityLoading ? { status: "loading" } : compatibility}
              onRankCandidates={handleRankCandidates}
              rankDisabled={candidateLoading}
            />
          </section>

          <section className="investigation-sidebar-section">
            <AISQualityPanel compatibility={compatibility} />
          </section>

          <section className="investigation-sidebar-section">
            <div className="section-label">DETECTION</div>
            <DetectionStatus job={slickGeojson ? { status: "COMPLETED", message: "Mock detection endpoint returned geometry." } : null} />
            <SlickMetrics metadata={null} mockArea={mockArea} isMockSource={slickIsMock} />
            {!slickGeojson && (
              <div className="empty-state">
                This backend cannot run real detection from a browser-uploaded file — see the Upload page for
                details. Slick geometry here will populate once available.
              </div>
            )}
            {slickIsMock && (
              <div className="empty-state">
                The polygon shown on the map came from the backend&apos;s mock detect endpoint
                (POST /api/spills/&#123;id&#125;/detect), not a real detector run.
              </div>
            )}
          </section>

          <section className="investigation-sidebar-section">
            <DriftControls
              onRunHindcast={(params) => runDriftAction("hindcast", params)}
              onRunForecast={(params) => runDriftAction("forecast", params)}
              hindcastLoading={hindcastLoading}
              forecastLoading={forecastLoading}
              disabledReason={!slickGeojson ? "Run detection to obtain slick geometry before running drift." : null}
            />
            {driftError && (
              <div className="error-state">
                <strong>Drift request failed</strong>
                <p>{driftError}</p>
              </div>
            )}
          </section>

          <section className="investigation-sidebar-section">
            <div className="section-label">AIS</div>
            <AISTrackInfo track={null} compatibilityBlocked={!isCompatible} blockedReason={compatibility?.reasons?.[0]} />
          </section>

          <section className="candidate-section investigation-sidebar-section">
            <div className="candidate-section-header">
              <h2>Candidates</h2>
              {candidateRun && <span className="candidate-count">{candidateRun.candidates.length}</span>}
            </div>

            {candidateLoading && <div className="loading-state">Ranking candidates…</div>}

            {!candidateLoading && candidateError && (
              <CandidateBlocked reason={candidateError} details={candidateBlockedDetails} />
            )}

            {!candidateLoading && !candidateError && candidateRun && (
              <CandidateList
                candidates={candidateRun.candidates}
                selectedCandidateId={selectedCandidateId}
                onSelect={setSelectedCandidateId}
              />
            )}

            {!candidateLoading && !candidateError && !candidateRun && (
              <div className="empty-state">Run candidate ranking from the compatibility panel above.</div>
            )}
          </section>

          {selectedCandidate && (
            <section className="investigation-sidebar-section">
              <EvidenceDrawer candidate={selectedCandidate} />
              <AISTimeline timestamps={[]} selectedIndex={timelineIndex} onChange={setTimelineIndex} />
            </section>
          )}

          <div className="investigation-disclaimer">
            <strong>Investigation support only</strong>
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

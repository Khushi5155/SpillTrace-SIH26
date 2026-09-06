import axios from "axios";

// ============================================================
// SpillTrace API Layer
//
// This file only exposes functions for endpoints that were
// verified to actually exist on the backend (backend/app/main.py
// + backend/app/api/routes/*.py). Nothing here is invented.
//
// Verified mount map (from app/main.py):
//
//   settings.api_prefix = "/api"
//
//   /api            + system.router      -> GET  /api/health
//   /api            + scenes.router      -> GET  /api/scenes
//                                           GET  /api/scenes/{scene_id}/manifest
//                                           GET  /api/scenes/{scene_id}/compatibility
//   /api            + detections.router  -> POST /api/detections
//                                           GET  /api/detections/{job_id}
//   /api            + spills.router      -> POST /api/spills/upload
//                                           POST /api/spills/{spill_id}/detect
//                                           GET  /api/spills/{spill_id}
//   drift_router (own prefix)            -> POST /api/drift/hindcast
//                                           POST /api/drift/forecast
//   detections.router again, at /api/v1  -> POST /api/v1/detections            (duplicate mount)
//                                           GET  /api/v1/detections/{job_id}   (duplicate mount)
//   candidates_router (own prefix)       -> POST /api/v1/spills/{spill_id}/candidates/rank
//                                           GET  /api/v1/spills/{spill_id}/candidate-runs/{run_id}
//                                           GET  /api/v1/spills/{spill_id}/candidate-runs/{run_id}/candidates/{candidate_id}
//   reports_router (own prefix)          -> POST /api/v1/reports/investigation
//                                           POST /api/v1/reports/investigation/html
//   root (no prefix)                     -> GET  /health
//                                           GET  /ready
//
// IMPORTANT GAPS (confirmed by reading the backend source, not guessed):
//
//   1. There is NO endpoint that returns AIS tracks. There is no AIS
//      data source anywhere in this backend. Any AIS UI must treat
//      AIS as "not provided by backend" until such an endpoint exists.
//
//   2. There is NO "GET candidates" endpoint. Candidate ranking is a
//      POST where the CALLER supplies compatibility, drift_evidence
//      and the full candidate list (see CandidateRunRequest in
//      app/schemas/candidate.py) and the backend only scores/ranks
//      what it's given. The backend does not generate candidates.
//      Because we have no AIS source, we have no candidates to send,
//      so the candidate flow cannot run end-to-end yet. The
//      integration layer below is ready for the day this exists.
//
//   3. POST /api/detections and POST /api/spills/{id}/detect both
//      require a *server-side filesystem path* to a GeoTIFF
//      (DetectionRequest.file_path / detector_service reads from
//      disk). Neither takes a browser file upload directly. The
//      only actual file-upload endpoint is POST /api/spills/upload
//      (multipart), which stores the file and returns spill_id +
//      saved_path, but detect_spill() for that router ignores the
//      uploaded content and returns a hardcoded mock polygon
//      (see routes/spills.py) — it does not run a real detector.
//      The only path that runs the REAL detector
//      (detector_service -> ml.day1_inference.process_sar_scene) is
//      POST /api/detections, which needs "file_path" to already
//      exist on the server's disk, not an uploaded browser File.
//      There is no bridge between "upload a file from the browser"
//      and "run the real detector on it" in this backend yet. This
//      is reported to the user rather than faked.
//
//   4. GET /api/scenes currently only ever returns one hardcoded
//      scene ("scene_demo_001"), with no `bounds` field, and
//      GET /api/scenes/{id}/compatibility always returns
//      compatible: false ("Compatibility inputs not fully
//      integrated yet"). This is real backend behavior, not a
//      frontend bug — the UI renders it as BLOCKED because that is
//      literally what the backend says.
//
//   5. Detection artifacts (oil_mask / probability_map / geojson
//      paths in ArtifactRefs) are filesystem paths written by the
//      detector service. main.py never mounts a StaticFiles route,
//      so nothing under those paths is reachable over HTTP. The UI
//      shows these as an integration gap instead of guessing a URL.
//
// ============================================================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: "application/json",
  },
  timeout: 30000,
});

const encodeId = (value) => encodeURIComponent(String(value));

// ============================================================
// API ERROR NORMALIZATION
//
// Centralized handler covering 400 / 404 / 409 / 422 / 500 /
// network error / timeout. Never surfaces a raw Python traceback;
// always preserves whatever message/detail/reason the backend sent.
// ============================================================

export const getApiError = (error) => {
  if (!error) {
    return {
      status: null,
      code: null,
      message: "Unknown error.",
      details: null,
      isNetworkError: false,
      isTimeout: false,
    };
  }

  const isTimeout = error.code === "ECONNABORTED";
  const isNetworkError = !error.response && !isTimeout;

  if (isTimeout) {
    return {
      status: null,
      code: "ERR_TIMEOUT",
      message: "The request timed out. The backend may be slow or unreachable.",
      details: null,
      isNetworkError: false,
      isTimeout: true,
    };
  }

  if (isNetworkError) {
    return {
      status: null,
      code: "ERR_NETWORK",
      message:
        "Could not reach the SpillTrace backend. Check that it is running and VITE_API_BASE_URL is correct.",
      details: null,
      isNetworkError: true,
      isTimeout: false,
    };
  }

  const status = error.response?.status ?? null;
  const responseData = error.response?.data ?? null;

  // Candidate service uses: { detail: { code, message, details, request_id, timestamp_utc } }
  // Some routes use: { detail: "plain string" }
  // Older/global handler in main.py uses: { error, message, details, run_id }
  const detail = responseData?.detail;

  if (detail && typeof detail === "object") {
    return {
      status,
      code: detail.code ?? null,
      message: detail.message ?? "Something went wrong.",
      details: detail.details ?? null,
      isNetworkError: false,
      isTimeout: false,
    };
  }

  if (typeof detail === "string") {
    return {
      status,
      code: null,
      message: detail,
      details: null,
      isNetworkError: false,
      isTimeout: false,
    };
  }

  if (responseData?.error && typeof responseData.error === "string") {
    return {
      status,
      code: responseData.error,
      message: responseData.message ?? "Something went wrong.",
      details: responseData.details ?? null,
      isNetworkError: false,
      isTimeout: false,
    };
  }

  return {
    status,
    code: null,
    message: error.message || "Something went wrong.",
    details: null,
    isNetworkError: false,
    isTimeout: false,
  };
};

// ============================================================
// SYSTEM
// ============================================================

/** GET /api/health */
export const checkHealth = async () => {
  const response = await api.get("/api/health");
  return response.data;
};

// ============================================================
// SCENES  (Day 4 / Day 5)
// ============================================================

/** GET /api/scenes */
export const getScenes = async () => {
  const response = await api.get("/api/scenes");
  return response.data; // { scenes: SARSceneMetadata[] }
};

/** GET /api/scenes/{scene_id}/manifest */
export const getSceneManifest = async (sceneId) => {
  if (!sceneId) throw new Error("Scene ID is required.");
  const response = await api.get(`/api/scenes/${encodeId(sceneId)}/manifest`);
  return response.data; // { scene, manifest }
};

/** GET /api/scenes/{scene_id}/compatibility */
export const getSceneCompatibility = async (sceneId) => {
  if (!sceneId) throw new Error("Scene ID is required.");
  const response = await api.get(`/api/scenes/${encodeId(sceneId)}/compatibility`);
  return response.data; // { scene_id, compatibility }
};

// ============================================================
// SPILL UPLOAD / MOCK DETECT  (Day 6)
//
// NOTE: /spills/{id}/detect on this backend returns a hardcoded
// mock polygon (see routes/spills.py) — it is NOT the real
// detector. We call it anyway because it's the only endpoint
// wired to the upload flow, but we always label its output as
// backend-mock, never as a real detection result.
// ============================================================

/** POST /api/spills/upload (multipart) */
export const uploadSpill = async (file) => {
  if (!file) throw new Error("A file is required to upload.");
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post("/api/spills/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data; // SpillUploadResponse
};

/** POST /api/spills/{spill_id}/detect — backend-documented mock endpoint */
export const detectSpillMock = async (spillId) => {
  if (!spillId) throw new Error("Spill ID is required.");
  const response = await api.post(`/api/spills/${encodeId(spillId)}/detect`);
  return response.data; // SpillResponse
};

/** GET /api/spills/{spill_id} */
export const getSpill = async (spillId) => {
  if (!spillId) throw new Error("Spill ID is required.");
  const response = await api.get(`/api/spills/${encodeId(spillId)}`);
  return response.data; // SpillMetadataResponse
};

// ============================================================
// REAL DETECTION JOBS  (Day 6)
//
// This is the actual detector pathway (detector_service ->
// ml.day1_inference.process_sar_scene). It requires a server-side
// file_path, not a browser File object. We expose it so the UI can
// call it when a server-side path is genuinely known, but the
// Upload page cannot silently turn a browser file into this
// because no such bridging endpoint exists.
// ============================================================

/** POST /api/detections  Body: { scene_id, file_path } */
export const createDetection = async ({ sceneId, filePath }) => {
  if (!sceneId) throw new Error("Scene ID is required.");
  if (!filePath) throw new Error("A server-side file_path is required.");

  const response = await api.post("/api/detections", {
    scene_id: sceneId,
    file_path: filePath,
  });
  return response.data; // DetectionResponse
};

/** GET /api/detections/{job_id} */
export const getDetection = async (jobId) => {
  if (!jobId) throw new Error("Detection job ID is required.");
  const response = await api.get(`/api/detections/${encodeId(jobId)}`);
  return response.data; // DetectionResponse
};

/**
 * Poll a detection job until COMPLETED / FAILED / timeout.
 * Uses a 1.5s interval per the performance rules (not aggressive),
 * and always cleans up its own interval.
 *
 * Returns the final DetectionResponse, or throws on timeout/error.
 * Calls onUpdate(job) after every poll so the UI can render
 * QUEUED / PROCESSING live status without inventing a percentage.
 */
export const pollDetection = async (jobId, { onUpdate, intervalMs = 1500, timeoutMs = 120000 } = {}) => {
  const start = Date.now();

  for (;;) {
    const job = await getDetection(jobId);
    if (onUpdate) onUpdate(job);

    if (job.status === "COMPLETED" || job.status === "FAILED") {
      return job;
    }

    if (Date.now() - start > timeoutMs) {
      throw new Error("Detection job polling timed out.");
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
};

// ============================================================
// DRIFT  (Day 6) — real endpoints, real schema
// ============================================================

/**
 * POST /api/drift/hindcast or /api/drift/forecast
 *
 * Body must match DriftRequest exactly:
 * {
 *   spill_id?: string,
 *   acquisition_time_utc?: string,
 *   slick_geojson: object,       // required
 *   parameters: {                // required, DriftParametersRequest
 *     wind_speed_mps, wind_direction_from_deg,
 *     current_speed_mps, current_direction_to_deg,
 *     timestep_minutes?, duration_hours?,
 *     wind_drift_coefficient?, current_coefficient?,
 *     particle_count?, diffusion_mps?, random_seed?,
 *     mode?, vector_source?
 *   }
 * }
 */
export const runDrift = async ({ direction, spillId, acquisitionTimeUtc, slickGeojson, parameters }) => {
  if (direction !== "hindcast" && direction !== "forecast") {
    throw new Error('direction must be "hindcast" or "forecast".');
  }
  if (!slickGeojson) throw new Error("slick_geojson is required.");
  if (!parameters) throw new Error("Drift parameters are required.");

  const body = {
    spill_id: spillId ?? undefined,
    acquisition_time_utc: acquisitionTimeUtc ?? undefined,
    slick_geojson: slickGeojson,
    parameters,
  };

  const response = await api.post(`/api/drift/${direction}`, body);
  return response.data; // DriftResponse
};

export const runHindcast = (args) => runDrift({ ...args, direction: "hindcast" });
export const runForecast = (args) => runDrift({ ...args, direction: "forecast" });

// ============================================================
// AIS
//
// No AIS endpoint exists anywhere on this backend. We deliberately
// do not export a queryAisTracks() function that pretends to call
// something real. Any UI needing AIS must show "Not provided by
// backend" rather than import a dead function.
// ============================================================

// ============================================================
// CANDIDATES  (Day 7) — rank-only, caller supplies everything
// ============================================================

/**
 * POST /api/v1/spills/{spill_id}/candidates/rank
 *
 * Body must match CandidateRunRequest exactly:
 * {
 *   compatibility: CompatibilityStatus,   // required
 *   drift_evidence: DriftEvidence,        // required
 *   candidates: CandidateInput[],         // required (can be empty)
 *   limit?: number
 * }
 *
 * Returns 409 when compatibility.compatible is false — callers
 * should catch this via getApiError(error) and render the blocked
 * state with error.details (temporal_overlap, geographic_overlap,
 * crs_valid, environmental_coverage, reasons).
 */
export const rankCandidates = async (spillId, { compatibility, driftEvidence, candidates = [], limit = 10 }) => {
  if (!spillId) throw new Error("Spill ID is required.");
  if (!compatibility) throw new Error("compatibility is required.");
  if (!driftEvidence) throw new Error("drift_evidence is required.");

  const response = await api.post(`/api/v1/spills/${encodeId(spillId)}/candidates/rank`, {
    compatibility,
    drift_evidence: driftEvidence,
    candidates,
    limit,
  });
  return response.data; // CandidateRunResponse
};

/** GET /api/v1/spills/{spill_id}/candidate-runs/{run_id} */
export const getCandidateRun = async (spillId, runId) => {
  if (!spillId || !runId) throw new Error("Spill ID and run ID are required.");
  const response = await api.get(`/api/v1/spills/${encodeId(spillId)}/candidate-runs/${encodeId(runId)}`);
  return response.data; // CandidateRunResponse
};

/** GET /api/v1/spills/{spill_id}/candidate-runs/{run_id}/candidates/{candidate_id} */
export const getCandidateDetail = async (spillId, runId, candidateId) => {
  if (!spillId || !runId || !candidateId) {
    throw new Error("Spill ID, run ID and candidate ID are required.");
  }
  const response = await api.get(
    `/api/v1/spills/${encodeId(spillId)}/candidate-runs/${encodeId(runId)}/candidates/${encodeId(candidateId)}`
  );
  return response.data; // CandidateDetailResponse
};

// ============================================================
// REPORTS  (Day 9 — out of current UI scope, exposed for later)
// ============================================================

/** POST /api/v1/reports/investigation — body is a free-form payload the backend validates */
export const createInvestigationReport = async (payload) => {
  const response = await api.post("/api/v1/reports/investigation", payload);
  return response.data;
};

export default api;

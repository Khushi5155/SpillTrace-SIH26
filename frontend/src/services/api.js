import axios from "axios";

// ============================================================
// SpillTrace API Configuration
// ============================================================

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";


// ============================================================
// Axios Instance
// ============================================================

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: "application/json",
  },
  timeout: 30000,
});


// ============================================================
// HELPER — Encode URL Parameters
// ============================================================

const encodeId = (value) =>
  encodeURIComponent(String(value));


// ============================================================
// HEALTH CHECK
// ============================================================

/**
 * Backend:
 * GET /api/health
 */
export const checkHealth = async () => {
  try {
    const response = await api.get("/api/health");

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error(
      "SpillTrace backend health check failed:",
      error
    );

    return {
      success: false,
      error: getApiError(error),
    };
  }
};


// ============================================================
// SCENE APIs
// ============================================================

/**
 * Get all available SAR scenes.
 *
 * Backend:
 * GET /api/scenes
 */
export const getScenes = async () => {
  try {
    const response = await api.get("/api/scenes");

    return response.data;
  } catch (error) {
    console.error(
      "Failed to fetch scenes:",
      error
    );

    throw error;
  }
};


/**
 * Get scene manifest + metadata.
 *
 * Backend:
 * GET /api/scenes/{scene_id}/manifest
 */
export const getScene = async (sceneId) => {
  if (!sceneId) {
    throw new Error("Scene ID is required.");
  }

  try {
    const response = await api.get(
      `/api/scenes/${encodeId(sceneId)}/manifest`
    );

    return response.data;
  } catch (error) {
    console.error(
      `Failed to fetch scene ${sceneId}:`,
      error
    );

    throw error;
  }
};


/**
 * Get scene compatibility information.
 *
 * Backend:
 * GET /api/scenes/{scene_id}/compatibility
 */
export const getSceneCompatibility = async (
  sceneId
) => {
  if (!sceneId) {
    throw new Error("Scene ID is required.");
  }

  try {
    const response = await api.get(
      `/api/scenes/${encodeId(sceneId)}/compatibility`
    );

    return response.data;
  } catch (error) {
    console.error(
      `Failed to fetch compatibility for ${sceneId}:`,
      error
    );

    throw error;
  }
};


// ============================================================
// DAY 6 — DETECTION
// ============================================================

/**
 * Start SAR oil-spill detection.
 *
 * Backend:
 * POST /api/v1/detections
 *
 * Content-Type:
 * multipart/form-data
 *
 * Request:
 * - file
 * - acquisition_start_utc (optional)
 * - acquisition_end_utc (optional)
 * - source (optional)
 *
 * Response:
 * {
 *   job_id,
 *   status,
 *   progress,
 *   message
 * }
 */
export const startDetection = async ({
  file,
  acquisition_start_utc,
  acquisition_end_utc,
  source = "sentinel-1",
} = {}) => {
  if (!file) {
    throw new Error(
      "SAR image file is required."
    );
  }

  const formData = new FormData();

  formData.append("file", file);

  if (acquisition_start_utc) {
    formData.append(
      "acquisition_start_utc",
      acquisition_start_utc
    );
  }

  if (acquisition_end_utc) {
    formData.append(
      "acquisition_end_utc",
      acquisition_end_utc
    );
  }

  if (source) {
    formData.append(
      "source",
      source
    );
  }

  try {
    const response = await api.post(
      "/api/v1/detections",
      formData,
      {
        headers: {
          "Content-Type":
            "multipart/form-data",
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "SAR detection start failed:",
      error
    );

    throw error;
  }
};


/**
 * Get detection job status.
 *
 * Backend:
 * GET /api/v1/detections/{job_id}
 *
 * Possible statuses:
 * queued
 * processing
 * completed
 * failed
 * blocked
 */
export const getDetectionStatus = async (
  jobId
) => {
  if (!jobId) {
    throw new Error(
      "Detection job ID is required."
    );
  }

  try {
    const response = await api.get(
      `/api/v1/detections/${encodeId(jobId)}`
    );

    return response.data;
  } catch (error) {
    console.error(
      `Failed to fetch detection status for ${jobId}:`,
      error
    );

    throw error;
  }
};


// ============================================================
// DAY 6 — SPILL RESULT
// ============================================================

/**
 * Get detected spill result.
 *
 * Backend:
 * GET /api/v1/spills/{spill_id}
 *
 * Returns:
 * - centroid
 * - area_km2
 * - perimeter_m
 * - confidence
 * - geometry
 * - acquisition timestamps
 * - detector metadata
 */
export const getSpill = async (
  spillId
) => {
  if (!spillId) {
    throw new Error(
      "Spill ID is required."
    );
  }

  try {
    const response = await api.get(
      `/api/v1/spills/${encodeId(spillId)}`
    );

    return response.data;
  } catch (error) {
    console.error(
      `Failed to fetch spill ${spillId}:`,
      error
    );

    throw error;
  }
};


// ============================================================
// DAY 6 — SPILL GEOMETRY
// ============================================================

/**
 * Get detected slick geometry.
 *
 * Backend:
 * GET /api/v1/spills/{spill_id}/geometry
 *
 * Expected:
 * GeoJSON geometry / GeoJSON response.
 */
export const getSpillGeometry = async (
  spillId
) => {
  if (!spillId) {
    throw new Error(
      "Spill ID is required."
    );
  }

  try {
    const response = await api.get(
      `/api/v1/spills/${encodeId(spillId)}/geometry`
    );

    return response.data;
  } catch (error) {
    console.error(
      `Failed to fetch spill geometry for ${spillId}:`,
      error
    );

    throw error;
  }
};


// ============================================================
// DAY 6 — SAR ARTIFACTS
// ============================================================

/**
 * Get SAR source image, preview,
 * detection mask and slick polygon references.
 *
 * Backend:
 * GET /api/v1/spills/{spill_id}/artifacts
 *
 * Returns:
 * {
 *   source_image,
 *   source_preview,
 *   detection_mask,
 *   slick_polygon,
 *   crs
 * }
 */
export const getSpillArtifacts = async (
  spillId
) => {
  if (!spillId) {
    throw new Error(
      "Spill ID is required."
    );
  }

  try {
    const response = await api.get(
      `/api/v1/spills/${encodeId(spillId)}/artifacts`
    );

    return response.data;
  } catch (error) {
    console.error(
      `Failed to fetch SAR artifacts for ${spillId}:`,
      error
    );

    throw error;
  }
};


// ============================================================
// DAY 6 — HINDCAST
// ============================================================

/**
 * Run backward drift hindcast.
 *
 * Backend:
 * POST /api/v1/spills/{spill_id}/hindcast
 *
 * Payload example:
 * {
 *   duration_hours: 24,
 *   time_step_minutes: 60,
 *   wind_speed_mps: 5.2,
 *   wind_direction_deg: 270,
 *   current_speed_mps: 0.6,
 *   current_direction_deg: 90,
 *   wind_drift_coefficient: 0.03,
 *   current_coefficient: 1.0,
 *   particle_count: 500,
 *   uncertainty_diffusion_m: 250,
 *   random_seed: 42,
 *   mode: "analyst_parameter_driven"
 * }
 */
export const runHindcast = async (
  spillId,
  payload
) => {
  if (!spillId) {
    throw new Error(
      "Spill ID is required."
    );
  }

  if (!payload) {
    throw new Error(
      "Hindcast payload is required."
    );
  }

  try {
    const response = await api.post(
      `/api/v1/spills/${encodeId(spillId)}/hindcast`,
      payload
    );

    return response.data;
  } catch (error) {
    console.error(
      `Hindcast failed for ${spillId}:`,
      error
    );

    throw error;
  }
};


// ============================================================
// DAY 6 — FORECAST
// ============================================================

/**
 * Run forward drift forecast.
 *
 * Backend:
 * POST /api/v1/spills/{spill_id}/forecast
 *
 * Uses the same parameter-driven payload
 * as hindcast.
 */
export const runForecast = async (
  spillId,
  payload
) => {
  if (!spillId) {
    throw new Error(
      "Spill ID is required."
    );
  }

  if (!payload) {
    throw new Error(
      "Forecast payload is required."
    );
  }

  try {
    const response = await api.post(
      `/api/v1/spills/${encodeId(spillId)}/forecast`,
      payload
    );

    return response.data;
  } catch (error) {
    console.error(
      `Forecast failed for ${spillId}:`,
      error
    );

    throw error;
  }
};


// ============================================================
// DAY 6 — SPILL COMPATIBILITY
// ============================================================

/**
 * Check whether AIS attribution is compatible
 * with the current spill investigation.
 *
 * Backend:
 * GET /api/v1/spills/{spill_id}/compatibility
 *
 * Successful response:
 * {
 *   compatible: true,
 *   status: "passed",
 *   ...
 * }
 *
 * Failed compatibility may return:
 * HTTP 409 Conflict
 */
export const getSpillCompatibility = async (
  spillId
) => {
  if (!spillId) {
    throw new Error(
      "Spill ID is required."
    );
  }

  try {
    const response = await api.get(
      `/api/v1/spills/${encodeId(spillId)}/compatibility`
    );

    return response.data;
  } catch (error) {
    console.error(
      `Failed to fetch spill compatibility for ${spillId}:`,
      error
    );

    // IMPORTANT:
    // Do not convert 409 into a generic failure.
    // Investigation.jsx can use this to show
    // the explicit attribution-blocked state.
    throw error;
  }
};


// ============================================================
// DAY 6 — AIS TRACKS
// ============================================================

/**
 * Query real AIS vessel tracks.
 *
 * Backend:
 * GET /api/v1/ais/tracks
 *
 * Query parameters:
 * - start_utc
 * - end_utc
 * - min_lon
 * - min_lat
 * - max_lon
 * - max_lat
 * - spill_id
 *
 * Example:
 *
 * queryAisTracks({
 *   spill_id: "spill_01J...",
 *   start_utc: "2026-09-04T12:00:00Z",
 *   end_utc: "2026-09-05T12:00:00Z",
 *   min_lon: 72.0,
 *   min_lat: 18.0,
 *   max_lon: 73.0,
 *   max_lat: 19.0
 * });
 */
export const queryAisTracks = async (
  params = {}
) => {
  try {
    const response = await api.get(
      "/api/v1/ais/tracks",
      {
        params: cleanQueryParams(params),
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "AIS tracks API failed:",
      error
    );

    throw error;
  }
};


// ============================================================
// QUERY PARAM CLEANER
// ============================================================

/**
 * Removes undefined/null/empty values before
 * sending query parameters to FastAPI.
 */
const cleanQueryParams = (
  params = {}
) => {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== ""
    )
  );
};


// ============================================================
// OPTIONAL — LOAD COMPLETE SPILL CONTEXT
// ============================================================

/**
 * Convenience helper for Investigation.jsx.
 *
 * Loads:
 * - spill metadata
 * - SAR artifacts
 * - compatibility
 *
 * IMPORTANT:
 * This does NOT run hindcast/forecast/AIS.
 * Those remain explicit operations.
 */
export const getSpillInvestigationContext =
  async (spillId) => {
    if (!spillId) {
      throw new Error(
        "Spill ID is required."
      );
    }

    const [
      spill,
      artifacts,
      compatibility,
    ] = await Promise.allSettled([
      getSpill(spillId),
      getSpillArtifacts(spillId),
      getSpillCompatibility(spillId),
    ]);

    return {
      spill:
        spill.status === "fulfilled"
          ? spill.value
          : null,

      artifacts:
        artifacts.status === "fulfilled"
          ? artifacts.value
          : null,

      compatibility:
        compatibility.status ===
        "fulfilled"
          ? compatibility.value
          : null,

      errors: {
        spill:
          spill.status === "rejected"
            ? getApiError(spill.reason)
            : null,

        artifacts:
          artifacts.status === "rejected"
            ? getApiError(
                artifacts.reason
              )
            : null,

        compatibility:
          compatibility.status ===
          "rejected"
            ? getApiError(
                compatibility.reason
              )
            : null,
      },
    };
  };


// ============================================================
// API ERROR NORMALIZATION
// ============================================================

/**
 * Convert Axios/FastAPI errors into
 * a consistent frontend-friendly object.
 *
 * Supports Day-6 backend format:
 *
 * {
 *   error: {
 *     code,
 *     message,
 *     details,
 *     request_id,
 *     timestamp_utc
 *   }
 * }
 *
 * Also supports older FastAPI responses:
 *
 * {
 *   detail: ...
 * }
 */
export const getApiError = (
  error
) => {
  if (!error) {
    return {
      status: null,
      code: null,
      message: "Unknown error",
      details: null,
      request_id: null,
      timestamp_utc: null,
      run_id: null,
    };
  }

  const status =
    error.response?.status ?? null;

  const responseData =
    error.response?.data ?? null;

  // ----------------------------------------------------------
  // Day-6 structured error
  // ----------------------------------------------------------

  const structuredError =
    responseData?.error;

  if (
    structuredError &&
    typeof structuredError ===
      "object"
  ) {
    return {
      status,

      code:
        structuredError.code ??
        null,

      message:
        structuredError.message ??
        "Something went wrong.",

      details:
        structuredError.details ??
        null,

      request_id:
        structuredError.request_id ??
        null,

      timestamp_utc:
        structuredError.timestamp_utc ??
        null,

      run_id:
        responseData?.run_id ??
        null,
    };
  }

  // ----------------------------------------------------------
  // Older / FastAPI-style error
  // ----------------------------------------------------------

  let message =
    responseData?.message ??
    responseData?.detail ??
    error.message ??
    "Something went wrong.";

  let details =
    responseData?.details ??
    null;

  // FastAPI HTTPException detail
  // may itself be an object.
  if (
    typeof message === "object"
  ) {
    details =
      message.details ??
      details;

    message =
      message.message ??
      message.error ??
      JSON.stringify(message);
  }

  return {
    status,

    code:
      responseData?.code ??
      null,

    message,

    details,

    request_id:
      responseData?.request_id ??
      null,

    timestamp_utc:
      responseData?.timestamp_utc ??
      null,

    run_id:
      responseData?.run_id ??
      null,
  };
};


// ============================================================
// DEFAULT EXPORT
// ============================================================

export default api;

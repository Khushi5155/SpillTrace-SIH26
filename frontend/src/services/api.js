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
  timeout: 15000,
});


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
// SCENE APIs — CURRENT BACKEND
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
    console.error("Failed to fetch scenes:", error);

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
      `/api/scenes/${encodeURIComponent(sceneId)}/manifest`
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
export const getSceneCompatibility = async (sceneId) => {
  if (!sceneId) {
    throw new Error("Scene ID is required.");
  }

  try {
    const response = await api.get(
      `/api/scenes/${encodeURIComponent(sceneId)}/compatibility`
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
// LEGACY SPILL APIs
// ============================================================

/**
 * Upload a SAR file.
 *
 * NOTE:
 * The backend code currently provided does NOT confirm
 * that this endpoint exists.
 *
 * Kept here only for compatibility with older frontend code.
 *
 * Expected future/legacy endpoint:
 * POST /api/spills/upload
 */
export const uploadSpill = async (file) => {
  if (!file) {
    throw new Error("No SAR file provided.");
  }

  const formData = new FormData();

  formData.append("file", file);

  try {
    const response = await api.post(
      "/api/spills/upload",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("SAR upload failed:", error);

    throw error;
  }
};


/**
 * Get spill metadata.
 *
 * NOTE:
 * Current backend code provided does not confirm
 * this endpoint.
 *
 * Expected:
 * GET /api/spills/{spill_id}
 */
export const getSpill = async (spillId) => {
  if (!spillId) {
    throw new Error("Spill ID is required.");
  }

  try {
    const response = await api.get(
      `/api/spills/${encodeURIComponent(spillId)}`
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


/**
 * Run spill detection.
 *
 * NOTE:
 * Current backend code provided does not confirm
 * this endpoint.
 *
 * Expected:
 * POST /api/spills/{spill_id}/detect
 */
export const detectSpill = async (spillId) => {
  if (!spillId) {
    throw new Error("Spill ID is required.");
  }

  try {
    const response = await api.post(
      `/api/spills/${encodeURIComponent(spillId)}/detect`
    );

    return response.data;
  } catch (error) {
    console.error(
      `Spill detection failed for ${spillId}:`,
      error
    );

    throw error;
  }
};


// ============================================================
// FUTURE — SCENE UPLOAD
// ============================================================

/**
 * Upload/register a SAR scene.
 *
 * NOT CONFIRMED IN CURRENT BACKEND CONTRACT.
 *
 * Expected future endpoint:
 * POST /api/scenes/upload
 */
export const uploadScene = async (
  file,
  metadata = {}
) => {
  if (!file) {
    throw new Error("No SAR file provided.");
  }

  const formData = new FormData();

  formData.append("file", file);

  Object.entries(metadata).forEach(
    ([key, value]) => {
      if (
        value !== undefined &&
        value !== null
      ) {
        formData.append(
          key,
          String(value)
        );
      }
    }
  );

  try {
    const response = await api.post(
      "/api/scenes/upload",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "Scene upload failed:",
      error
    );

    throw error;
  }
};


// ============================================================
// FUTURE — DETECTION
// ============================================================

/**
 * Run SAR spill detection.
 *
 * NOT YET CONFIRMED IN CURRENT BACKEND.
 *
 * Expected future endpoint:
 * POST /api/detection/run
 */
export const runDetection = async ({
  scene_id,
  detector = "unet-r18",
  fallback_allowed = true,
}) => {
  if (!scene_id) {
    throw new Error("Scene ID is required.");
  }

  try {
    const response = await api.post(
      "/api/detection/run",
      {
        scene_id,
        detector,
        fallback_allowed,
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "Detection API failed:",
      error
    );

    throw error;
  }
};


// ============================================================
// FUTURE — SPILL GEOMETRY
// ============================================================

/**
 * Get detected spill geometry.
 *
 * Expected future endpoint:
 * GET /api/spills/{spill_id}/geometry
 */
export const getSpillGeometry = async (
  spillId
) => {
  if (!spillId) {
    throw new Error("Spill ID is required.");
  }

  try {
    const response = await api.get(
      `/api/spills/${encodeURIComponent(spillId)}/geometry`
    );

    return response.data;
  } catch (error) {
    console.error(
      `Failed to fetch geometry for ${spillId}:`,
      error
    );

    throw error;
  }
};


// ============================================================
// FUTURE — DRIFT HINDCAST
// ============================================================

/**
 * Run backward drift hindcast.
 *
 * Expected future endpoint:
 * POST /api/drift/hindcast
 */
export const runHindcast = async (
  payload
) => {
  if (!payload) {
    throw new Error(
      "Hindcast payload is required."
    );
  }

  try {
    const response = await api.post(
      "/api/drift/hindcast",
      payload
    );

    return response.data;
  } catch (error) {
    console.error(
      "Hindcast API failed:",
      error
    );

    throw error;
  }
};


// ============================================================
// FUTURE — AIS TRACKS
// ============================================================

/**
 * Query AIS vessel tracks.
 *
 * Expected future endpoint:
 * POST /api/ais/tracks/query
 *
 * This endpoint should be used only after the
 * real AIS subset/API contract is provided.
 */
export const queryAisTracks = async (
  payload
) => {
  if (!payload) {
    throw new Error(
      "AIS query payload is required."
    );
  }

  try {
    const response = await api.post(
      "/api/ais/tracks/query",
      payload
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
// FUTURE — CANDIDATE RANKING
// ============================================================

/**
 * Rank candidate vessels.
 *
 * Expected future endpoint:
 * POST /api/candidates/rank
 *
 * Backend requirement:
 * HTTP 409 when compatibility fails.
 */
export const rankCandidates = async (
  payload
) => {
  if (!payload) {
    throw new Error(
      "Candidate ranking payload is required."
    );
  }

  try {
    const response = await api.post(
      "/api/candidates/rank",
      payload
    );

    return response.data;
  } catch (error) {
    console.error(
      "Candidate ranking API failed:",
      error
    );

    // Preserve HTTP 409 so the UI can display
    // the explicit attribution-blocked state.
    if (error.response?.status === 409) {
      throw error;
    }

    throw error;
  }
};


// ============================================================
// FUTURE — DRIFT FORECAST
// ============================================================

/**
 * Run forward drift forecast.
 *
 * Expected future endpoint:
 * POST /api/drift/forecast
 */
export const runForecast = async (
  payload
) => {
  if (!payload) {
    throw new Error(
      "Forecast payload is required."
    );
  }

  try {
    const response = await api.post(
      "/api/drift/forecast",
      payload
    );

    return response.data;
  } catch (error) {
    console.error(
      "Forecast API failed:",
      error
    );

    throw error;
  }
};


// ============================================================
// API ERROR NORMALIZATION
// ============================================================

/**
 * Convert Axios/backend errors into a consistent
 * frontend-friendly object.
 */
export const getApiError = (error) => {
  if (!error) {
    return {
      status: null,
      message: "Unknown error",
      details: null,
      run_id: null,
    };
  }

  const responseData =
    error.response?.data;

  let message =
    responseData?.message ||
    responseData?.detail ||
    error.message ||
    "Something went wrong.";

  // FastAPI HTTPException detail can be an object.
  if (
    typeof message === "object"
  ) {
    message =
      message.message ||
      message.error ||
      JSON.stringify(message);
  }

  return {
    status:
      error.response?.status ||
      null,

    message,

    details:
      responseData?.details ||
      null,

    run_id:
      responseData?.run_id ||
      null,
  };
};


// ============================================================
// DEFAULT EXPORT
// ============================================================

export default api;

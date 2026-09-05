import axios from "axios";

// ============================================================
// SpillTrace API Configuration
// ============================================================

// Backend URL
// Local development:
// http://localhost:8000
//
// Later, when deployed, replace this with your Render backend URL.
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
// Health Check
// ============================================================

/**
 * Check whether SpillTrace backend is running.
 *
 * Current backend:
 * GET /health
 */
export const checkHealth = async () => {
  try {
    const response = await api.get("/api/v1/health");

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error("SpillTrace backend health check failed:", error);

    return {
      success: false,
      error: error.response?.data || error.message,
    };
  }
};


// ============================================================
// SAR / Spill Upload
// ============================================================

/**
 * Upload a SAR image/file.
 *
 * Current backend:
 * POST /api/spills/upload
 *
 * @param {File} file - SAR file selected by the user
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


// ============================================================
// Get Spill Metadata
// ============================================================

/**
 * Get uploaded spill metadata.
 *
 * Current backend:
 * GET /api/spills/{spill_id}
 *
 * @param {string} spillId
 */
export const getSpill = async (spillId) => {
  if (!spillId) {
    throw new Error("Spill ID is required.");
  }

  try {
    const response = await api.get(`/api/spills/${spillId}`);

    return response.data;
  } catch (error) {
    console.error(`Failed to fetch spill ${spillId}:`, error);

    throw error;
  }
};


// ============================================================
// Run Spill Detection
// ============================================================

/**
 * Run spill detection for an uploaded SAR scene.
 *
 * Current backend:
 * POST /api/spills/{spill_id}/detect
 *
 * NOTE:
 * Current backend returns a mock segmentation result.
 * This will later be replaced by the real detection endpoint.
 *
 * @param {string} spillId
 */
export const detectSpill = async (spillId) => {
  if (!spillId) {
    throw new Error("Spill ID is required.");
  }

  try {
    const response = await api.post(
      `/api/spills/${spillId}/detect`
    );

    return response.data;
  } catch (error) {
    console.error(`Spill detection failed for ${spillId}:`, error);

    throw error;
  }
};


// ============================================================
// DAY 4+ — Scene APIs
// ============================================================

/**
 * Get available SAR scenes.
 *
 * FUTURE ENDPOINT:
 * GET /api/v1/scenes
 *
 * Not currently implemented by backend.
 */
export const getScenes = async () => {
  try {
    const response = await api.get("/api/v1/scenes");

    return response.data;
  } catch (error) {
    console.error("Failed to fetch scenes:", error);

    throw error;
  }
};


/**
 * Get a specific SAR scene.
 *
 * FUTURE ENDPOINT:
 * GET /api/v1/scenes/{scene_id}
 */
export const getScene = async (sceneId) => {
  if (!sceneId) {
    throw new Error("Scene ID is required.");
  }

  try {
    const response = await api.get(
      `/api/v1/scenes/${sceneId}/manifest`
    );

    return response.data;
  } catch (error) {
    console.error(`Failed to fetch scene ${sceneId}:`, error);
    throw error;
  }
};


export const getSceneCompatibility = async (sceneId) => {
  if (!sceneId) {
    throw new Error("Scene ID is required.");
  }

  try {
    const response = await api.get(
      `/api/v1/scenes/${sceneId}/compatibility`
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


/**
 * Upload SAR scene using the future API contract.
 *
 * FUTURE ENDPOINT:
 * POST /api/v1/scenes/upload
 */
export const uploadScene = async (file, metadata = {}) => {
  if (!file) {
    throw new Error("No SAR file provided.");
  }

  const formData = new FormData();

  formData.append("file", file);

  Object.entries(metadata).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, value);
    }
  });

  try {
    const response = await api.post(
      "/api/v1/scenes/upload",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Scene upload failed:", error);

    throw error;
  }
};


// ============================================================
// DAY 5+ — Detection APIs
// ============================================================

/**
 * Run SAR spill detection.
 *
 * FUTURE ENDPOINT:
 * POST /api/v1/detection/run
 *
 * @param {object} payload
 * @param {string} payload.scene_id
 * @param {string} payload.detector
 * @param {boolean} payload.fallback_allowed
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
      "/api/v1/detection/run",
      {
        scene_id,
        detector,
        fallback_allowed,
      }
    );

    return response.data;
  } catch (error) {
    console.error("Detection API failed:", error);

    throw error;
  }
};


// ============================================================
// Spill Geometry
// ============================================================

/**
 * Get detected spill geometry.
 *
 * FUTURE ENDPOINT:
 * GET /api/v1/spills/{spill_id}/geometry
 *
 * Expected response:
 * GeoJSON FeatureCollection
 */
export const getSpillGeometry = async (spillId) => {
  if (!spillId) {
    throw new Error("Spill ID is required.");
  }

  try {
    const response = await api.get(
      `/api/v1/spills/${spillId}/geometry`
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
// DAY 6 — Drift Hindcast
// ============================================================

/**
 * Run backward drift hindcast.
 *
 * FUTURE ENDPOINT:
 * POST /api/v1/drift/hindcast
 */
export const runHindcast = async (payload) => {
  if (!payload) {
    throw new Error("Hindcast payload is required.");
  }

  try {
    const response = await api.post(
      "/api/v1/drift/hindcast",
      payload
    );

    return response.data;
  } catch (error) {
    console.error("Hindcast API failed:", error);

    throw error;
  }
};


// ============================================================
// DAY 6 — AIS Tracks
// ============================================================

/**
 * Query AIS vessel tracks.
 *
 * FUTURE ENDPOINT:
 * POST /api/v1/ais/tracks/query
 */
export const queryAisTracks = async (payload) => {
  if (!payload) {
    throw new Error("AIS query payload is required.");
  }

  try {
    const response = await api.post(
      "/api/v1/ais/tracks/query",
      payload
    );

    return response.data;
  } catch (error) {
    console.error("AIS tracks API failed:", error);

    throw error;
  }
};


// ============================================================
// DAY 7 — Candidate Ranking
// ============================================================

/**
 * Rank candidate vessels.
 *
 * FUTURE ENDPOINT:
 * POST /api/v1/candidates/rank
 *
 * IMPORTANT:
 * Backend may return HTTP 409 when scenario compatibility
 * is false. We intentionally re-throw the error so the UI
 * can show the blocked attribution state.
 */
export const rankCandidates = async (payload) => {
  if (!payload) {
    throw new Error("Candidate ranking payload is required.");
  }

  try {
    const response = await api.post(
      "/api/v1/candidates/rank",
      payload
    );

    return response.data;
  } catch (error) {
    console.error("Candidate ranking API failed:", error);

    // Preserve backend 409 compatibility response.
    if (error.response?.status === 409) {
      throw error;
    }

    throw error;
  }
};


// ============================================================
// DAY 6+ — Drift Forecast
// ============================================================

/**
 * Run forward drift forecast.
 *
 * FUTURE ENDPOINT:
 * POST /api/v1/drift/forecast
 */
export const runForecast = async (payload) => {
  if (!payload) {
    throw new Error("Forecast payload is required.");
  }

  try {
    const response = await api.post(
      "/api/v1/drift/forecast",
      payload
    );

    return response.data;
  } catch (error) {
    console.error("Forecast API failed:", error);

    throw error;
  }
};


// ============================================================
// Utility — API Error Normalization
// ============================================================

/**
 * Convert Axios errors into a frontend-friendly format.
 *
 * This will be useful later for loading/error/blocked states.
 */
export const getApiError = (error) => {
  if (!error) {
    return {
      status: null,
      message: "Unknown error",
      details: null,
    };
  }

  return {
    status: error.response?.status || null,

    message:
      error.response?.data?.message ||
      error.response?.data?.detail ||
      error.message ||
      "Something went wrong.",

    details:
      error.response?.data?.details ||
      null,

    run_id:
      error.response?.data?.run_id ||
      null,
  };
};


// ============================================================
// Default Export
// ============================================================

export default api;

import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const AIS_TRACKS_URL =
  import.meta.env.VITE_AIS_TRACKS_URL || "";

const CANDIDATES_URL =
  import.meta.env.VITE_CANDIDATES_URL || "";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: "application/json",
  },
  timeout: 30000,
});

const encodeId = (value) =>
  encodeURIComponent(String(value));

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

  const isTimeout =
    error.code === "ECONNABORTED" ||
    error.code === "ETIMEDOUT";

  const isNetworkError =
    !error.response && !isTimeout;

  if (isTimeout) {
    return {
      status: null,
      code: "ERR_TIMEOUT",
      message:
        "The request timed out. The backend may be slow or unreachable.",
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
  const data = error.response?.data ?? {};
  const detail = data?.detail;

  if (detail && typeof detail === "object") {
    return {
      status,
      code: detail.code ?? detail.error ?? null,
      message: detail.message ?? "Something went wrong.",
      details: detail.details ?? null,
      isNetworkError: false,
      isTimeout: false,
    };
  }

  if (typeof detail === "string") {
    return {
      status,
      code: data?.error ?? null,
      message: detail,
      details: data?.details ?? null,
      isNetworkError: false,
      isTimeout: false,
    };
  }

  if (data?.error && typeof data.error === "string") {
    return {
      status,
      code: data.error,
      message: data.message ?? "Something went wrong.",
      details: data.details ?? null,
      isNetworkError: false,
      isTimeout: false,
    };
  }

  return {
    status,
    code: null,
    message:
      error.message || "Something went wrong.",
    details: null,
    isNetworkError: false,
    isTimeout: false,
  };
};


/* ---------------- HEALTH ---------------- */

export const checkHealth = async () =>
  (await api.get("/api/health")).data;


/* ---------------- SCENES ---------------- */

export const getScenes = async () =>
  (await api.get("/api/scenes")).data;

export const getSceneManifest = async (sceneId) => {
  if (!sceneId) {
    throw new Error("Scene ID is required.");
  }

  return (
    await api.get(
      `/api/scenes/${encodeId(sceneId)}/manifest`
    )
  ).data;
};

export const getSceneCompatibility = async (sceneId) => {
  if (!sceneId) {
    throw new Error("Scene ID is required.");
  }

  return (
    await api.get(
      `/api/scenes/${encodeId(sceneId)}/compatibility`
    )
  ).data;
};


/* ---------------- SPILL ---------------- */

export const uploadSpill = async (file) => {
  if (!file) {
    throw new Error("A file is required.");
  }

  const formData = new FormData();
  formData.append("file", file);

  return (
    await api.post(
      "/api/spills/upload",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    )
  ).data;
};

export const getSpill = async (spillId) => {
  if (!spillId) {
    throw new Error("Spill ID is required.");
  }

  return (
    await api.get(
      `/api/spills/${encodeId(spillId)}`
    )
  ).data;
};


/* ---------------- DEMO DETECTION ---------------- */

export const detectSpillMock = async (spillId) => {
  if (!spillId) {
    throw new Error("Spill ID is required.");
  }

  return (
    await api.post(
      `/api/spills/${encodeId(spillId)}/detect`
    )
  ).data;
};


/* ---------------- REAL DETECTION ---------------- */

export const createDetection = async ({
  sceneId,
  filePath,
}) => {
  if (!sceneId || !filePath) {
    throw new Error(
      "sceneId and server-side filePath are required."
    );
  }

  return (
    await api.post(
      "/api/detections",
      {
        scene_id: sceneId,
        file_path: filePath,
      }
    )
  ).data;
};

export const getDetection = async (jobId) => {
  if (!jobId) {
    throw new Error(
      "Detection job ID is required."
    );
  }

  return (
    await api.get(
      `/api/detections/${encodeId(jobId)}`
    )
  ).data;
};

export const pollDetection = async (
  jobId,
  {
    onUpdate,
    intervalMs = 1500,
    timeoutMs = 120000,
  } = {}
) => {
  const started = Date.now();

  while (true) {
    const job = await getDetection(jobId);

    onUpdate?.(job);

    if (
      job.status === "COMPLETED" ||
      job.status === "FAILED"
    ) {
      return job;
    }

    if (
      Date.now() - started >= timeoutMs
    ) {
      throw new Error(
        "Detection job polling timed out."
      );
    }

    await new Promise((resolve) =>
      setTimeout(resolve, intervalMs)
    );
  }
};


/* ---------------- DRIFT ---------------- */

export const runDrift = async ({
  direction,
  spillId,
  acquisitionTimeUtc,
  slickGeojson,
  parameters,
}) => {
  if (
    !["hindcast", "forecast"].includes(direction)
  ) {
    throw new Error(
      'direction must be "hindcast" or "forecast".'
    );
  }

  if (!slickGeojson) {
    throw new Error(
      "slick_geojson is required."
    );
  }

  return (
    await api.post(
      `/api/drift/${direction}`,
      {
        spill_id: spillId ?? undefined,
        acquisition_time_utc:
          acquisitionTimeUtc ?? undefined,
        slick_geojson: slickGeojson,
        parameters,
      }
    )
  ).data;
};

export const runHindcast = (args) =>
  runDrift({
    ...args,
    direction: "hindcast",
  });

export const runForecast = (args) =>
  runDrift({
    ...args,
    direction: "forecast",
  });


/* ---------------- AIS ---------------- */

export const getAisTracks = async (spillId) => {
  if (!spillId) {
    const error = new Error(
      "A real spill ID is required for AIS."
    );

    error.code = "NO_SPILL_ID";

    throw error;
  }

  if (!AIS_TRACKS_URL) {
    const error = new Error(
      "AIS endpoint is not configured."
    );

    error.code = "AIS_NOT_CONFIGURED";

    throw error;
  }

  const target =
    AIS_TRACKS_URL.includes("{spillId}")
      ? AIS_TRACKS_URL.replaceAll(
          "{spillId}",
          encodeId(spillId)
        )
      : AIS_TRACKS_URL;

  return (await api.get(target)).data;
};


/* ---------------- CANDIDATES ---------------- */

export const getCandidates = async (spillId) => {
  if (!spillId) {
    const error = new Error(
      "A real spill ID is required for candidates."
    );

    error.code = "NO_SPILL_ID";

    throw error;
  }

  if (!CANDIDATES_URL) {
    const error = new Error(
      "Candidate generation endpoint is not configured."
    );

    error.code = "CANDIDATES_NOT_CONFIGURED";

    throw error;
  }

  const target =
    CANDIDATES_URL.includes("{spillId}")
      ? CANDIDATES_URL.replaceAll(
          "{spillId}",
          encodeId(spillId)
        )
      : CANDIDATES_URL;

  return (await api.get(target)).data;
};

export const rankCandidates = async (
  spillId,
  {
    compatibility,
    driftEvidence,
    candidates = [],
    limit = 10,
  }
) => {
  if (!spillId) {
    throw new Error(
      "Spill ID is required."
    );
  }

  return (
    await api.post(
      `/api/v1/spills/${encodeId(
        spillId
      )}/candidates/rank`,
      {
        compatibility,
        drift_evidence: driftEvidence,
        candidates,
        limit,
      }
    )
  ).data;
};

export const getCandidateRun = async (
  spillId,
  runId
) =>
  (
    await api.get(
      `/api/v1/spills/${encodeId(
        spillId
      )}/candidate-runs/${encodeId(runId)}`
    )
  ).data;

export const getCandidateDetail = async (
  spillId,
  runId,
  candidateId
) =>
  (
    await api.get(
      `/api/v1/spills/${encodeId(
        spillId
      )}/candidate-runs/${encodeId(
        runId
      )}/candidates/${encodeId(
        candidateId
      )}`
    )
  ).data;


/* ---------------- REPORT ---------------- */

export const createInvestigationReport =
  async (payload) =>
    (
      await api.post(
        "/api/v1/reports/investigation",
        payload
      )
    ).data;

export const createInvestigationReportHtml =
  async (payload) =>
    (
      await api.post(
        "/api/v1/reports/investigation/html",
        payload,
        {
          responseType: "text",
        }
      )
    ).data;


/* ---------------- URL HELPER ---------------- */

export const resolveApiUrl = (value) => {
  if (!value || typeof value !== "string") {
    return null;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith("/")) {
    return `${API_BASE_URL}${value}`;
  }

  return null;
};

export default api;

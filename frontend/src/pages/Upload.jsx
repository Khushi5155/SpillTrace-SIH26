import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  createDetection,
  getApiError,
  getScenes,
  pollDetection,
  uploadSpill,
} from "../services/api";

import {
  saveInvestigationData,
} from "../utils/investigation";

const MAX_MB = 250;

function Upload() {
  const navigate = useNavigate();

  const [scenes, setScenes] =
    useState([]);

  const [sceneId, setSceneId] =
    useState("");

  const [selectedFile, setSelectedFile] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [stage, setStage] =
    useState("");

  const [error, setError] =
    useState("");


  useEffect(() => {
    let active = true;

    getScenes()
      .then((data) => {
        if (!active) return;

        const list =
          data?.scenes || [];

        setScenes(list);

        if (
          list[0]?.scene_id
        ) {
          setSceneId(
            list[0].scene_id
          );
        }
      })
      .catch(() => {
        if (active) {
          setScenes([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);


  const handleFileChange =
    (event) => {
      const file =
        event.target.files?.[0];

      if (!file) return;

      const extension =
        file.name
          .toLowerCase()
          .split(".")
          .pop();

      if (
        !["tif", "tiff"].includes(
          extension
        )
      ) {
        setSelectedFile(null);

        setError(
          "Please select a GeoTIFF file (.tif or .tiff)."
        );

        return;
      }

      if (
        file.size >
        MAX_MB * 1024 * 1024
      ) {
        setSelectedFile(null);

        setError(
          `File is larger than ${MAX_MB} MB.`
        );

        return;
      }

      setSelectedFile(file);
      setError("");
    };


  const handleStart = async () => {
    if (
      !selectedFile ||
      loading
    ) {
      return;
    }

    if (!sceneId) {
      setError(
        "Select a SAR scene before starting detection."
      );

      return;
    }

    try {
      setLoading(true);
      setError("");

      /*
       * STEP 1
       */
      setStage(
        "Uploading SAR file…"
      );

      const uploadResult =
        await uploadSpill(
          selectedFile
        );

      if (!uploadResult?.spill_id) {
        throw new Error(
          "Backend upload succeeded but did not return a spill_id."
        );
      }


      /*
       * IMPORTANT:
       *
       * Everything after this point
       * is stored under REAL spill_id.
       */
      saveInvestigationData(
        uploadResult.spill_id,
        {
          upload:
            uploadResult,

          sceneId,

          fileName:
            selectedFile.name,
        }
      );


      /*
       * STEP 2
       */
      setStage(
        "Starting real detector…"
      );

      const job =
        await createDetection({
          sceneId,

          filePath:
            uploadResult.saved_path,
        });


      saveInvestigationData(
        uploadResult.spill_id,
        {
          upload:
            uploadResult,

          sceneId,

          fileName:
            selectedFile.name,

          detection:
            job,
        }
      );


      /*
       * STEP 3
       */
      setStage(
        "Waiting for detector…"
      );

      const finalJob =
        await pollDetection(
          job.job_id,
          {
            onUpdate: (
              next
            ) => {
              saveInvestigationData(
                uploadResult.spill_id,
                {
                  upload:
                    uploadResult,

                  sceneId,

                  fileName:
                    selectedFile.name,

                  detection:
                    next,
                }
              );

              setStage(
                next.status ===
                  "PROCESSING"
                  ? "Detector is processing…"
                  : next.message ||
                    next.status
              );
            },
          }
        );


      saveInvestigationData(
        uploadResult.spill_id,
        {
          upload:
            uploadResult,

          sceneId,

          fileName:
            selectedFile.name,

          detection:
            finalJob,
        }
      );


      /*
       * IMPORTANT:
       *
       * Route uses spill_id,
       * NOT scene_id.
       */
      navigate(
        `/investigation/${encodeURIComponent(
          uploadResult.spill_id
        )}`
      );
    } catch (err) {
      const apiErr =
        getApiError(err);

      setError(
        apiErr.message
      );

      setStage("");
    } finally {
      setLoading(false);
    }
  };


  return (
    <section className="upload-page">

      <div className="page-header">
        <div>

          <p className="eyebrow">
            SPILLTRACE / DATA INGESTION
          </p>

          <h1>
            Upload SAR Scene
          </h1>

          <p className="page-description">
            Register a SAR file, connect it to an available scene, and start the backend detector. The browser never performs ML inference itself.
          </p>

        </div>
      </div>


      <div className="upload-grid">

        <div className="upload-card">

          <div className="upload-icon">
            ↑
          </div>

          <h2>
            Select SAR Image
          </h2>

          <p>
            GeoTIFF (.tif / .tiff) is required by the current real detector.
          </p>


          <label
            className="metadata-item"
            style={{
              display: "block",
              marginBottom: 12,
            }}
          >
            <span>
              SAR Scene
            </span>

            <select
              value={sceneId}
              onChange={(e) =>
                setSceneId(
                  e.target.value
                )
              }
              disabled={
                loading ||
                scenes.length === 0
              }
              style={{
                width: "100%",
                padding: "8px",
                background:
                  "#0a1927",
                color: "inherit",
                border:
                  "1px solid #35506a",
              }}
            >

              {scenes.length ===
                0 && (
                <option value="">
                  No backend scenes available
                </option>
              )}

              {scenes.map(
                (scene) => (
                  <option
                    key={
                      scene.scene_id
                    }
                    value={
                      scene.scene_id
                    }
                  >
                    {
                      scene.scene_id
                    }{" "}
                    —{" "}
                    {
                      scene.source ||
                      "Unknown source"
                    }
                  </option>
                )
              )}

            </select>
          </label>


          <label className="file-picker">

            <span>
              {selectedFile
                ? "Change File"
                : "Choose GeoTIFF"}
            </span>

            <input
              type="file"
              accept=".tif,.tiff,image/tiff"
              onChange={
                handleFileChange
              }
              disabled={
                loading
              }
            />

          </label>


          {selectedFile && (
            <div className="selected-file">

              <div>

                <span className="file-label">
                  SELECTED FILE
                </span>

                <strong>
                  {
                    selectedFile.name
                  }
                </strong>

                <small>
                  {(
                    selectedFile.size /
                    1024 /
                    1024
                  ).toFixed(2)}{" "}
                  MB
                </small>

              </div>

              <span className="file-status">
                READY
              </span>

            </div>
          )}


          {stage && (
            <div className="loading-state">
              {stage}
            </div>
          )}


          {error && (
            <div className="upload-error">

              <strong>
                Processing failed
              </strong>

              <p>
                {error}
              </p>

              <small>
                If the backend reports detector import/model errors, the ML runtime on the backend still needs to be completed.
              </small>

            </div>
          )}


          <button
            className="primary-button"
            onClick={
              handleStart
            }
            disabled={
              !selectedFile ||
              !sceneId ||
              loading
            }
          >
            {loading
              ? "Processing…"
              : "Upload & Run Detection"}
          </button>


          <p className="upload-note">
            Upload response → server saved_path → real detection job → status polling → investigation workspace.
          </p>

        </div>
      </div>

    </section>
  );
}

export default Upload;

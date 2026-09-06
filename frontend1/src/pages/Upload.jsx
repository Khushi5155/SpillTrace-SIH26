import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { uploadSpill, detectSpillMock, getApiError } from "../services/api";

/**
 * Upload page.
 *
 * IMPORTANT — real backend behavior:
 * POST /api/spills/upload genuinely stores the uploaded file and
 * returns a real spill_id. POST /api/spills/{id}/detect, however,
 * is a documented MOCK on this backend (see routes/spills.py) — it
 * ignores the uploaded content and returns a hardcoded polygon over
 * Mumbai with area_sq_km: 3.42. We call it because it's the only
 * endpoint wired to this flow, but we say so plainly rather than
 * presenting it as a real detection result.
 */

function Upload() {
  const navigate = useNavigate();

  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError("");
    }
  };

  const handleContinue = async () => {
    if (!selectedFile || loading) return;

    try {
      setLoading(true);
      setError("");

      const uploadResult = await uploadSpill(selectedFile);

      // NOTE: this next call does not run a real detector on the
      // file we just uploaded — see the module docstring above.
      await detectSpillMock(uploadResult.spill_id);

      navigate(`/investigation/${uploadResult.spill_id}`);
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="upload-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">SPILLTRACE / DATA INGESTION</p>
          <h1>Upload SAR Scene</h1>
          <p className="page-description">
            Upload a SAR image to create a spill record. Note: the backend's detect endpoint for uploaded files
            currently returns a fixed demonstration polygon rather than running the real detector — see the
            investigation page for details.
          </p>
        </div>
      </div>

      <div className="upload-grid">
        <div className="upload-card">
          <div className="upload-icon">↑</div>

          <h2>Select SAR Image</h2>
          <p>Upload a SAR image file for this investigation.</p>

          <label className="file-picker">
            <span>{selectedFile ? "Change File" : "Choose File"}</span>
            <input type="file" onChange={handleFileChange} disabled={loading} />
          </label>

          {selectedFile && (
            <div className="selected-file">
              <div>
                <span className="file-label">SELECTED FILE</span>
                <strong>{selectedFile.name}</strong>
              </div>
              <span className="file-status">READY</span>
            </div>
          )}

          {error && (
            <div className="upload-error">
              <strong>Processing failed</strong>
              <p>{error}</p>
            </div>
          )}

          <button className="primary-button" onClick={handleContinue} disabled={!selectedFile || loading}>
            {loading ? "Uploading…" : "Continue Investigation"}
          </button>

          <p className="upload-note">
            Any file type is accepted by the upload endpoint. The real oil-spill detector
            (POST /api/detections) requires a server-side GeoTIFF path and is not reachable from this form —
            see the investigation page for the full explanation of this backend gap.
          </p>
        </div>
      </div>
    </section>
  );
}

export default Upload;

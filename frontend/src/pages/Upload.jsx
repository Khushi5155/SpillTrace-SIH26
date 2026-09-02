import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Upload() {
  const navigate = useNavigate();

  const [selectedFile, setSelectedFile] = useState(null);

  const demoInvestigationId = "INV-2026-0042";

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDemoCase = () => {
    navigate(`/investigation/${demoInvestigationId}`);
  };

  const handleContinue = () => {
    if (!selectedFile) return;

    // Day 1:
    // Uploaded file is only selected locally.
    // Real SAR processing/API integration will be added in Day 3/4.
    navigate(`/investigation/${demoInvestigationId}`);
  };

  return (
    <section className="upload-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">SPILLTRACE / DATA INGESTION</p>

          <h1>Upload SAR Scene</h1>

          <p className="page-description">
            Start a marine oil-spill investigation by selecting a SAR scene
            or loading the prepared demonstration scenario.
          </p>
        </div>
      </div>

      <div className="upload-grid">
        {/* Upload Card */}
        <div className="upload-card">
          <div className="upload-icon">
            ↑
          </div>

          <h2>Select SAR Image</h2>

          <p>
            Upload a Sentinel-1 SAR image for investigation.
          </p>

          <label className="file-picker">
            <span>Choose SAR File</span>

            <input
              type="file"
              accept=".tif,.tiff,.zip"
              onChange={handleFileChange}
            />
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

          <button
            className="primary-button"
            onClick={handleContinue}
            disabled={!selectedFile}
          >
            Continue Investigation
          </button>

          <p className="upload-note">
            Supported formats: GeoTIFF (.tif / .tiff) or packaged SAR data.
          </p>
        </div>

        {/* Demo Case Card */}
        <div className="demo-card">
          <div className="demo-header">
            <span className="status-dot"></span>

            <span>DEMO SCENARIO AVAILABLE</span>
          </div>

          <h2>Historical Oil Spill Reconstruction</h2>

          <p className="demo-description">
            Load the prepared Arabian Sea scenario to explore the complete
            SpillTrace investigation workflow.
          </p>

          <div className="demo-details">
            <div className="detail-row">
              <span>Investigation</span>
              <strong>{demoInvestigationId}</strong>
            </div>

            <div className="detail-row">
              <span>Region</span>
              <strong>Arabian Sea</strong>
            </div>

            <div className="detail-row">
              <span>SAR Source</span>
              <strong>Copernicus Sentinel-1</strong>
            </div>

            <div className="detail-row">
              <span>Scenario Date</span>
              <strong>31 Aug 2026</strong>
            </div>
          </div>

          <button
            className="secondary-button"
            onClick={handleDemoCase}
          >
            Load Demo Investigation →
          </button>
        </div>
      </div>

      {/* Workflow */}
      <div className="workflow-section">
        <div className="workflow-header">
          <div>
            <p className="eyebrow">INVESTIGATION WORKFLOW</p>

            <h2>From SAR Scene to Source Attribution</h2>
          </div>
        </div>

        <div className="workflow-steps">
          <div className="workflow-step active">
            <span>01</span>

            <div>
              <strong>SAR Detection</strong>
              <p>Identify potential oil slick signature.</p>
            </div>
          </div>

          <div className="workflow-line"></div>

          <div className="workflow-step">
            <span>02</span>

            <div>
              <strong>Origin Hindcast</strong>
              <p>Estimate the likely spill origin.</p>
            </div>
          </div>

          <div className="workflow-line"></div>

          <div className="workflow-step">
            <span>03</span>

            <div>
              <strong>AIS Analysis</strong>
              <p>Filter vessels in the origin window.</p>
            </div>
          </div>

          <div className="workflow-line"></div>

          <div className="workflow-step">
            <span>04</span>

            <div>
              <strong>Candidate Ranking</strong>
              <p>Rank candidates using explainable evidence.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Upload;

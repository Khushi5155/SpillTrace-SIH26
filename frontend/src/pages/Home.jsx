import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getScenes, getApiError } from "../services/api";

/**
 * Dashboard / Home page.
 *
 * Previously this page showed fully hardcoded fake stats (94%
 * confidence, 142 vessels analyzed, etc.) with no backend call at
 * all. That has been replaced with a real GET /api/scenes call.
 * There is no "list investigations" endpoint on this backend, so
 * this page can only honestly show available SAR scenes — it does
 * not claim to show active investigations, spill area, or vessel
 * counts, since none of that is backed by any real data source yet.
 */

function Home() {
  const navigate = useNavigate();
  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    getScenes()
      .then((data) => {
        if (mounted) setScenes(data.scenes || []);
      })
      .catch((err) => {
        if (mounted) setError(getApiError(err).message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="dashboard">
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">MARINE INCIDENT INTELLIGENCE</p>
          <h1>Investigation Dashboard</h1>
          <p>
            Detect, reconstruct and investigate potential marine oil spills using SAR imagery, ocean dynamics and
            AIS data.
          </p>
        </div>

        <button className="upload-button" onClick={() => navigate("/upload")}>
          + New Investigation
        </button>
      </div>

      <div className="recent-spills">
        <div className="section-header">
          <div>
            <p className="eyebrow">BACKEND SCENES</p>
            <h2>Available SAR Scenes</h2>
          </div>
        </div>

        {loading && <div className="loading-state">Loading scenes from backend…</div>}

        {!loading && error && (
          <div className="error-state">
            <strong>Could not load scenes</strong>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && scenes.length === 0 && (
          <div className="empty-state">No scenes are currently available from the backend.</div>
        )}

        {!loading &&
          !error &&
          scenes.map((scene) => (
            <div className="investigation-row" key={scene.scene_id}>
              <div className="investigation-primary">
                <span className="investigation-id">{scene.scene_id}</span>
                <h3>{scene.source || "Unknown source"}</h3>
                <p>
                  {scene.acquisition_start_utc
                    ? `Acquired ${new Date(scene.acquisition_start_utc).toUTCString()}`
                    : "Acquisition time not provided by backend"}
                </p>
              </div>

              <div className="investigation-details">
                <div>
                  <span>CRS</span>
                  <strong>{scene.source_crs || "Not provided by backend"}</strong>
                </div>

                <div>
                  <span>GEOREF METHOD</span>
                  <strong>{scene.georeferencing_method || "Not provided by backend"}</strong>
                </div>

                <div>
                  <span>GEOREF CONFIDENCE</span>
                  <strong>{scene.georeferencing_confidence || "Not provided by backend"}</strong>
                </div>
              </div>

              <button className="view-button" onClick={() => navigate(`/investigation/${scene.scene_id}`)}>
                Open Investigation →
              </button>
            </div>
          ))}
      </div>

      <div className="platform-section">
        <div className="section-header">
          <div>
            <p className="eyebrow">SPILLTRACE WORKFLOW</p>
            <h2>Investigation Pipeline</h2>
          </div>
        </div>

        <div className="pipeline">
          <div className="pipeline-step">
            <span>01</span>
            <div>
              <strong>SAR Detection</strong>
              <p>Detect potential oil slicks.</p>
            </div>
          </div>

          <div className="pipeline-arrow">→</div>

          <div className="pipeline-step">
            <span>02</span>
            <div>
              <strong>Origin Hindcast</strong>
              <p>Reconstruct likely origin.</p>
            </div>
          </div>

          <div className="pipeline-arrow">→</div>

          <div className="pipeline-step">
            <span>03</span>
            <div>
              <strong>AIS Analysis</strong>
              <p>Filter compatible vessels.</p>
            </div>
          </div>

          <div className="pipeline-arrow">→</div>

          <div className="pipeline-step">
            <span>04</span>
            <div>
              <strong>Candidate Ranking</strong>
              <p>Explain vessel compatibility.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-disclaimer">
        <strong>Investigation note:</strong> Candidate rankings support investigation and do not constitute legal
        attribution.
      </div>
    </section>
  );
}

export default Home;

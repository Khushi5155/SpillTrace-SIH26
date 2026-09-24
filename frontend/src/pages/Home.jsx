import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getScenes, getApiError } from "../services/api";
import { NA, formatUtc } from "../utils/format";

/**
 * Dashboard (secondary view). There is no "list investigations" endpoint on
 * the backend, so this only lists the SAR scenes the backend reports; it
 * makes no claims about active investigations, areas or vessel counts.
 */
function Home() {
  const navigate = useNavigate();
  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    getScenes()
      .then((data) => mounted && setScenes(data.scenes || []))
      .catch((err) => mounted && setError(getApiError(err).message))
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="dashboard">
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">WORKSPACE</p>
          <h1>Dashboard</h1>
          <p className="page-description">
            Investigations start by uploading a SAR scene. Scenes already known to the backend are
            listed below.
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => navigate("/upload")}>
          + New Investigation
        </button>
      </div>

      <div className="dash-block">
        <h2 className="section-title">BACKEND SCENES</h2>

        {loading && <p className="muted">Loading scenes from backend…</p>}

        {!loading && error && (
          <div className="notice notice-error">
            <strong className="notice-title-text">COULD NOT LOAD SCENES</strong>
            <div className="notice-reason"><span>Reason</span><code>{error}</code></div>
          </div>
        )}

        {!loading && !error && scenes.length === 0 && (
          <p className="muted">No scenes are currently available from the backend.</p>
        )}

        {!loading && !error && scenes.map((scene) => (
          <div className="scene-row" key={scene.scene_id}>
            <div>
              <span className="mono scene-row-id">{scene.scene_id}</span>
              <strong>{scene.source || NA}</strong>
              <small>
                {scene.acquisition_start_utc
                  ? `Acquired ${formatUtc(scene.acquisition_start_utc)}`
                  : "Acquisition time not available"}
              </small>
            </div>
            <div className="scene-row-meta">
              <span>CRS <strong>{scene.source_crs || NA}</strong></span>
              <span>Georeferencing <strong>{scene.georeferencing_method || NA}</strong></span>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/investigation/${scene.scene_id}`)}>
              Open scene →
            </button>
          </div>
        ))}
      </div>

      <div className="disclaimer">
        <strong>Investigation support only</strong>
        <span>Candidate rankings support investigation and do not constitute legal attribution.</span>
      </div>
    </section>
  );
}

export default Home;

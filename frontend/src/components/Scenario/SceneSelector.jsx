/**
 * SceneSelector
 *
 * Lists scenes from GET /api/scenes and lets the analyst pick one.
 * Today the backend only ever returns a single hardcoded scene
 * ("scene_demo_001" — see app/services/scene_service.py), so in
 * practice this renders a list of one. It is written generically so
 * it keeps working the day the backend adds more scenes.
 */

function SceneSelector({ scenes, selectedSceneId, onSelect, loading, error }) {
  if (loading) {
    return (
      <div className="scene-selector">
        <div className="section-label">SAR SCENES</div>
        <div className="loading-state">Loading scenes from backend…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="scene-selector">
        <div className="section-label">SAR SCENES</div>
        <div className="error-state">
          <strong>Could not load scenes</strong>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!scenes || scenes.length === 0) {
    return (
      <div className="scene-selector">
        <div className="section-label">SAR SCENES</div>
        <div className="empty-state">No scenes are currently available from the backend.</div>
      </div>
    );
  }

  return (
    <div className="scene-selector">
      <div className="section-label">SAR SCENES ({scenes.length})</div>
      <div className="scene-selector-list">
        {scenes.map((scene) => (
          <button
            type="button"
            key={scene.scene_id}
            className={`scene-selector-item ${scene.scene_id === selectedSceneId ? "selected" : ""}`}
            onClick={() => onSelect(scene.scene_id)}
          >
            <strong>{scene.scene_id}</strong>
            <span>{scene.source || "Unknown source"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default SceneSelector;

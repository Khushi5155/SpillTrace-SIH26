/**
 * SceneMetadata
 *
 * Renders SARSceneMetadata + manifest exactly as returned by:
 *   GET /api/scenes/{scene_id}/manifest
 *
 * The current backend (app/services/scene_service.py) does not
 * provide a `bounds` field on SARSceneMetadata at all — it is not
 * part of the schema. We show "Not provided by backend" rather than
 * fabricating coordinates.
 */

function formatDate(value) {
  if (!value) return "Not provided by backend";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not provided by backend";

  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

function SceneMetadata({ scene, manifest }) {
  if (!scene) {
    return (
      <div className="scene-metadata">
        <div className="section-label">SCENE METADATA</div>
        <div className="empty-state">No scene selected.</div>
      </div>
    );
  }

  const {
    scene_id,
    source,
    acquisition_start_utc,
    acquisition_end_utc,
    source_crs,
    output_crs,
    georeferencing_method,
    georeferencing_confidence,
  } = scene;

  // Not part of SARSceneMetadata today — always "Not provided by backend".
  const bounds = scene.bounds ?? manifest?.bounds ?? null;
  const hasBounds = Array.isArray(bounds) && bounds.length === 4;
  const dataMode = manifest?.data_mode ?? null;

  return (
    <div className="scene-metadata">
      <div className="section-label">SCENE METADATA</div>

      <div className="metadata-grid">
        <div className="metadata-item">
          <span>Scene ID</span>
          <strong>{scene_id || "Not provided by backend"}</strong>
        </div>

        <div className="metadata-item">
          <span>Acquisition</span>
          <strong>{formatDate(acquisition_start_utc)} UTC</strong>
          <small>to {formatDate(acquisition_end_utc)} UTC</small>
        </div>

        <div className="metadata-item">
          <span>Source</span>
          <strong>{source || "Not provided by backend"}</strong>
        </div>

        <div className="metadata-item">
          <span>Data Mode</span>
          <strong>{dataMode || "Not provided by backend"}</strong>
        </div>

        <div className="metadata-item metadata-wide">
          <span>Scene Bounds</span>
          {hasBounds ? (
            <>
              <strong>
                {Number(bounds[0]).toFixed(2)}, {Number(bounds[1]).toFixed(2)} →{" "}
                {Number(bounds[2]).toFixed(2)}, {Number(bounds[3]).toFixed(2)}
              </strong>
              <small>Backend scene bounds</small>
            </>
          ) : (
            <>
              <strong>Not available</strong>
              <small>Backend does not currently return scene bounds for this scene.</small>
            </>
          )}
        </div>

        <div className="metadata-item">
          <span>CRS</span>
          <strong>{source_crs || "Not provided by backend"}</strong>
          {output_crs && output_crs !== source_crs && <small>Output: {output_crs}</small>}
        </div>

        <div className="metadata-item">
          <span>Georeferencing</span>
          <strong>{georeferencing_method || "Not provided by backend"}</strong>
          <small>Confidence: {georeferencing_confidence || "Not provided by backend"}</small>
        </div>

        {manifest?.available_artifacts && (
          <div className="metadata-item metadata-wide">
            <span>Available Artifacts</span>
            <strong>
              {Array.isArray(manifest.available_artifacts) && manifest.available_artifacts.length > 0
                ? manifest.available_artifacts.join(", ")
                : "None reported by backend"}
            </strong>
          </div>
        )}

        {manifest?.notes && (
          <div className="metadata-item metadata-wide">
            <span>Manifest Notes</span>
            <strong>{manifest.notes}</strong>
          </div>
        )}
      </div>
    </div>
  );
}

export default SceneMetadata;

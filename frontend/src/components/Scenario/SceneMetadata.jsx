import Section from "../ui/Section";
import { KV } from "../ui/Feedback";
import SceneSelector from "./SceneSelector";
import { NA, formatUtc } from "../../utils/format";

/**
 * Compact scene information from GET /api/v1/scenes/{id}/manifest.
 * Missing fields render as "Not available".
 */
function SceneMetadata({ scene, manifest, loading, scenes, onSelectScene }) {
  const bounds = scene?.bounds ?? manifest?.bounds ?? null;
  const hasBounds = Array.isArray(bounds) && bounds.length === 4;

  return (
    <Section id="scene" title="SCENE INFORMATION" collapsible defaultOpen>
      {loading && <p className="muted">Loading scene metadata…</p>}

      {!loading && !scene && <p className="muted">No scene metadata is available.</p>}

      {!loading && scene && (
        <>
          <div className="kv-grid">
            <KV label="Scene ID" value={scene.scene_id || NA} mono wide />
            <KV label="Source" value={scene.source || NA} wide />
            <KV label="Acquisition" value={formatUtc(scene.acquisition_start_utc)} wide />
            <KV label="CRS" value={scene.source_crs || NA} />
            <KV label="Data mode" value={manifest?.data_mode || NA} />
            <KV
              label="Georeferencing"
              value={
                scene.georeferencing_method
                  ? `${scene.georeferencing_method}${scene.georeferencing_confidence ? ` (${scene.georeferencing_confidence})` : ""}`
                  : NA
              }
              wide
            />
            <KV
              label="Bounds"
              value={
                hasBounds
                  ? `${Number(bounds[0]).toFixed(2)}, ${Number(bounds[1]).toFixed(2)} → ${Number(bounds[2]).toFixed(2)}, ${Number(bounds[3]).toFixed(2)}`
                  : NA
              }
              wide
            />
          </div>
          {manifest?.notes && <p className="footnote">{manifest.notes}</p>}
        </>
      )}

      <SceneSelector
        scenes={scenes}
        selectedSceneId={scene?.scene_id}
        onSelect={onSelectScene}
      />
    </Section>
  );
}

export default SceneMetadata;

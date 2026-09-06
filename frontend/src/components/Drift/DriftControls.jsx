import { useState } from "react";

/**
 * DriftControls
 *
 * Collects the DriftParametersRequest fields the backend actually
 * requires (app/schemas/drift.py) and triggers hindcast/forecast.
 * Only wind_speed_mps, wind_direction_from_deg, current_speed_mps
 * and current_direction_to_deg are required by the schema; everything
 * else has a server-side default we mirror here for clarity.
 */

const DEFAULT_PARAMS = {
  wind_speed_mps: 5,
  wind_direction_from_deg: 270,
  current_speed_mps: 0.5,
  current_direction_to_deg: 90,
  timestep_minutes: 60,
  duration_hours: 24,
  wind_drift_coefficient: 0.03,
  current_coefficient: 1.0,
  particle_count: 100,
  diffusion_mps: 25,
  random_seed: 42,
  mode: "analyst_parameter_driven",
  vector_source: "analyst_input",
};

function DriftControls({ onRunHindcast, onRunForecast, hindcastLoading, forecastLoading, disabledReason }) {
  const [params, setParams] = useState(DEFAULT_PARAMS);

  const update = (field, value) => setParams((prev) => ({ ...prev, [field]: value }));

  const disabled = !!disabledReason;

  return (
    <div className="drift-controls">
      <div className="section-label">DRIFT PARAMETERS</div>

      {disabled && <div className="empty-state">{disabledReason}</div>}

      <div className="metadata-grid">
        <label className="metadata-item">
          <span>Wind speed (m/s)</span>
          <input
            type="number"
            min="0"
            value={params.wind_speed_mps}
            onChange={(e) => update("wind_speed_mps", Number(e.target.value))}
            disabled={disabled}
          />
        </label>

        <label className="metadata-item">
          <span>Wind direction FROM (°)</span>
          <input
            type="number"
            min="0"
            max="359"
            value={params.wind_direction_from_deg}
            onChange={(e) => update("wind_direction_from_deg", Number(e.target.value))}
            disabled={disabled}
          />
        </label>

        <label className="metadata-item">
          <span>Current speed (m/s)</span>
          <input
            type="number"
            min="0"
            value={params.current_speed_mps}
            onChange={(e) => update("current_speed_mps", Number(e.target.value))}
            disabled={disabled}
          />
        </label>

        <label className="metadata-item">
          <span>Current direction TO (°)</span>
          <input
            type="number"
            min="0"
            max="359"
            value={params.current_direction_to_deg}
            onChange={(e) => update("current_direction_to_deg", Number(e.target.value))}
            disabled={disabled}
          />
        </label>

        <label className="metadata-item">
          <span>Duration (hours)</span>
          <input
            type="number"
            min="1"
            max="720"
            value={params.duration_hours}
            onChange={(e) => update("duration_hours", Number(e.target.value))}
            disabled={disabled}
          />
        </label>

        <label className="metadata-item">
          <span>Timestep (minutes)</span>
          <input
            type="number"
            min="1"
            max="1440"
            value={params.timestep_minutes}
            onChange={(e) => update("timestep_minutes", Number(e.target.value))}
            disabled={disabled}
          />
        </label>
      </div>

      <div className="drift-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={() => onRunHindcast(params)}
          disabled={disabled || hindcastLoading}
        >
          {hindcastLoading ? "Running Hindcast…" : "Run Hindcast"}
        </button>

        <button
          type="button"
          className="secondary-button"
          onClick={() => onRunForecast(params)}
          disabled={disabled || forecastLoading}
        >
          {forecastLoading ? "Running Forecast…" : "Run Forecast"}
        </button>
      </div>
    </div>
  );
}

export default DriftControls;

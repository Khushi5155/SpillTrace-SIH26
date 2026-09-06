/**
 * DetectionStatus
 *
 * Renders the JobStatus enum from the backend exactly:
 * QUEUED | PROCESSING | COMPLETED | FAILED (app/schemas/detection.py).
 *
 * The backend never returns a progress percentage anywhere in
 * DetectionResponse/DetectionMetadata, so we never show one —
 * only the literal status string and message the backend sent.
 */

const STATUS_LABEL = {
  QUEUED: "Queued",
  PROCESSING: "Detection processing…",
  COMPLETED: "Completed",
  FAILED: "Failed",
};

function DetectionStatus({ job }) {
  if (!job) {
    return <div className="detection-status detection-idle">No detection job started.</div>;
  }

  const status = job.status || "UNKNOWN";
  const label = STATUS_LABEL[status] || status;

  return (
    <div className={`detection-status detection-${status.toLowerCase()}`}>
      <div className="detection-status-row">
        <span className="detection-status-label">{label}</span>
        {(status === "QUEUED" || status === "PROCESSING") && <span className="detection-spinner" aria-hidden="true" />}
      </div>

      {job.message && <p className="detection-message">{job.message}</p>}

      {status === "FAILED" && job.error && (
        <div className="detection-error">
          <strong>{job.error.code}</strong>
          <span>{job.error.message}</span>
        </div>
      )}
    </div>
  );
}

export default DetectionStatus;

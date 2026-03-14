import { resolveAssetUrl } from '../services/api';

function ScanCard({ scan, onOpenReport }) {
  return (
    <article className="scan-card">
      <div className="scan-card-header">
        <h3>Patient: {scan.patientId}</h3>
        <span className={`badge ${scan.transferStatus === 'SUCCESS' ? 'ok' : 'fail'}`}>
          {scan.transferStatus}
        </span>
      </div>

      <ul>
        <li><strong>Latency:</strong> {Number(scan.latency).toFixed(2)} ms</li>
        <li><strong>Retry Count:</strong> {scan.retryCount ?? 0}</li>
        <li><strong>Transfer Failure Probability:</strong> {Number(scan.failureProbability || 0).toFixed(1)}%</li>
        <li><strong>Risk Label:</strong> {scan.failureRiskLabel || 'LOW_RISK'}</li>
        <li><strong>Disease Detected:</strong> {scan.diseaseDetected ? 'Yes' : 'No'}</li>
        <li><strong>Detection Confidence:</strong> {(Number(scan.confidence || 0) * 100).toFixed(1)}%</li>
        <li><strong>Timestamp:</strong> {new Date(scan.timestamp).toLocaleString()}</li>
      </ul>

      {scan.imagePath && (
        <img
          className="highlight-image"
          src={resolveAssetUrl(scan.imagePath)}
          alt={`Highlighted scan for ${scan.patientId}`}
        />
      )}

      <button type="button" onClick={() => onOpenReport(scan)}>
        View Report
      </button>
    </article>
  );
}

export default ScanCard;

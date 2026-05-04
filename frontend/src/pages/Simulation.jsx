import { useEffect, useRef, useState } from 'react';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import PipelineProgress from '../components/PipelineProgress';
import StatusBadge from '../components/StatusBadge';
import { exportPdfUrl, resolveAssetUrl, startSimulation } from '../services/api';

function RadiologyImagePanel({ title, src, alt }) {
  const cacheBustedSrc = src ? `${src}${src.includes('?') ? '&' : '?'}t=${Date.now()}` : '';
  return (
    <div className="radiology-panel">
      <h3>{title}</h3>
      <TransformWrapper minScale={1} maxScale={6} wheel={{ step: 0.15 }}>
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div className="viewer-controls">
              <button type="button" onClick={() => zoomIn()}>+</button>
              <button type="button" onClick={() => zoomOut()}>-</button>
              <button type="button" onClick={() => resetTransform()}>Reset</button>
            </div>
            <div className="viewer-canvas">
              <TransformComponent>
                <img src={cacheBustedSrc} alt={alt} className="highlight-image viewer-image" />
              </TransformComponent>
            </div>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}

function Simulation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [showDetectionOverlay, setShowDetectionOverlay] = useState(true);
  const [currentStage, setCurrentStage] = useState(0);
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  const stageTimerRef = useRef(null);
  const currentStageRef = useRef(0);
  const isCancelledRef = useRef(false);

  useEffect(() => {
    currentStageRef.current = currentStage;
  }, [currentStage]);

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const clearStageTimer = () => {
    if (stageTimerRef.current) {
      clearInterval(stageTimerRef.current);
      stageTimerRef.current = null;
    }
  };

  useEffect(() => () => {
    isCancelledRef.current = true;
    clearStageTimer();
  }, []);

  const animateStageTo = async (targetStage, delayMs = 480) => {
    while (!isCancelledRef.current && currentStageRef.current < targetStage) {
      await sleep(delayMs);
      if (isCancelledRef.current) break;
      setCurrentStage((prev) => Math.min(prev + 1, targetStage));
    }
  };

  const runSimulation = async () => {
    try {
      isCancelledRef.current = false;
      setLoading(true);
      setError('');
      setCurrentStage(1);
      setIsPipelineRunning(true);
      setResult(null);

      const progressRunner = (async () => {
        while (!isCancelledRef.current) {
          if (currentStageRef.current >= 7) break;
          await sleep(760);
          if (isCancelledRef.current) break;
          setCurrentStage((prev) => Math.min(prev + 1, 7));
        }
      })();

      const response = await startSimulation();
      await progressRunner;
      await animateStageTo(8, 420);
      setResult(response);
    } catch (err) {
      const stage = err.response?.data?.stage ? ` [stage: ${err.response.data.stage}]` : '';
      const details = err.response?.data?.error ? ` - ${err.response.data.error}` : '';
      const message = err.response?.data?.message || err.message || 'Failed to run simulation pipeline';
      setError(`${message}${stage}${details}`);
    } finally {
      clearStageTimer();
      setIsPipelineRunning(false);
      setLoading(false);
    }
  };

  const run = result?.run;
  const displayDiagnosis = run?.diseaseLabel || run?.diagnosis || '-';
  const displayRisk = run?.risk || run?.failureRiskLabel || 'N/A';
  const retryEvents = run?.retryEvents || result?.monitoring?.retry_events || [];
  const originalSrc = resolveAssetUrl(result?.original || run?.originalImagePath || run?.selectedImagePath);
  const heatmapSrc = resolveAssetUrl(result?.heatmap || run?.heatmapPath);
  const highlightedSrc = resolveAssetUrl(showDetectionOverlay
    ? (result?.highlighted || run?.imagePath)
    : (result?.original || run?.originalImagePath || run?.selectedImagePath));

  return (
    <main>
      <h1>Medical Imaging Simulation Pipeline</h1>
      <p className="subtitle">Run complete hospital workflow with one click</p>

      <section className="panel">
        <button type="button" onClick={runSimulation} disabled={loading}>
          Start Medical Imaging Simulation
        </button>
        {loading && <p className="loader">Running AI workflow...</p>}
        {error && <p className="error-text">{error}</p>}
      </section>

      <PipelineProgress currentStage={currentStage} isRunning={isPipelineRunning} />

      {result?.pipeline && (
        <section className="panel">
          <h2>Pipeline Status</h2>
          <div className="metrics-grid">
            {result.pipeline.map((step) => (
              <p key={step.stage}>
                <strong>{step.stage}. {step.label}</strong> <StatusBadge status={step.status} />
              </p>
            ))}
          </div>
        </section>
      )}

      {run && (
        <>
          <section className="panel">
            <h2>AI Transfer Monitoring</h2>
            <div className="metrics-grid">
              <p><strong>Latency:</strong> {Number(run.latency).toFixed(2)} ms</p>
              <p><strong>Packet Loss:</strong> {Number(run.packetLoss || 0).toFixed(2)}%</p>
              <p><strong>Retry Count:</strong> {run.retryCount}</p>
              <p><strong>Bandwidth:</strong> {Number(run.bandwidth || 0).toFixed(2)} Mbps</p>
              <p><strong>DICOM Timeout:</strong> {Number(run.dicomTimeout || 1000).toFixed(2)} ms</p>
              <p><strong>Transfer Status:</strong> <StatusBadge status={run.transferStatus} /></p>
              <p><strong>Failure Probability:</strong> {Number(run.failureProbability || 0).toFixed(2)}%</p>
              <p><strong>Risk Level:</strong> {run.failureRiskLabel}</p>
              <p><strong>Network Health Score:</strong> {Number(run.networkHealthScore || (100 - Number(run.failureProbability || 0))).toFixed(2)}</p>
            </div>
            <p><strong>AI Auto Debug Actions:</strong> {(run.aiAction || run.autoDebuggingActions || []).join(', ') || 'None'}</p>
            {run.autoRetryTriggered && (
              <p className="warning-text">AI triggered automatic retry to stabilize transfer</p>
            )}
            {retryEvents.length > 0 && (
              <div className="monitoring-events">
                <h3>Self-Healing Retry Log</h3>
                {retryEvents.map((event) => (
                  <div key={`retry-${event.retry_attempt}`} className="retry-event-card">
                    <p><strong>Attempt #{event.retry_attempt}:</strong> {event.message}</p>
                    <p><strong>Status:</strong> {event.reevaluation}</p>
                    <p>
                      <strong>Updated Metrics After Retry:</strong>{' '}
                      Latency {Number(event.after?.latency_ms || 0).toFixed(2)} ms,
                      Packet Loss {Number(event.after?.packet_loss || 0).toFixed(3)}%,
                      Failure Probability {Number(event.after?.failure_probability || 0).toFixed(2)}%,
                      Risk {event.after?.risk_level || 'N/A'},
                      Health Score {Number(event.after?.network_health_score || 0).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="viewer-header-row">
              <h2>Radiology Viewer</h2>
              <button type="button" onClick={() => setShowDetectionOverlay((prev) => !prev)}>
                Toggle AI Detection
              </button>
            </div>

            <div className="image-grid image-grid-three">
              <RadiologyImagePanel
                title="Scan Image Used For AI Detection"
                src={originalSrc}
                alt="Original scan"
              />
              <RadiologyImagePanel
                title="AI Attention Heatmap"
                src={heatmapSrc}
                alt="AI attention heatmap"
              />
              <RadiologyImagePanel
                title="Disease Highlighted"
                src={highlightedSrc}
                alt="Highlighted disease region"
              />
            </div>
          </section>

          <section className="panel">
            <h2>Detection Results</h2>
            <p><strong>Patient ID:</strong> {run.patientId}</p>
            <p><strong>Modality:</strong> {run.modality || run.scanType || 'N/A'}</p>
            <p><strong>Disease Category:</strong> {run.disease || 'N/A'}</p>
            <p><strong>Diagnosis:</strong> {displayDiagnosis}</p>
            <p><strong>Detected Disease:</strong> {run.diseaseDetected ? 'Yes' : 'No'}</p>
            <p><strong>Confidence Score:</strong> {(Number(run.confidence) * 100).toFixed(2)}%</p>
            <p><strong>Clinical Risk:</strong> {displayRisk}</p>
            <p>
              <strong>Bounding Box:</strong>{' '}
              {run.coordinates
                ? `x=${run.coordinates.x}, y=${run.coordinates.y}, w=${run.coordinates.width}, h=${run.coordinates.height}`
                : 'N/A'}
            </p>
          </section>

          <section className="panel report-panel">
            <div className="report-header-row">
              <h2>Medical Report</h2>
              <span className="report-chip">Clinical Summary</span>
            </div>
            <p className="report-subtitle">Structured AI-assisted findings with radiology-ready formatting.</p>
            <div className="report-content">
              <pre>{run.reportText}</pre>
            </div>
            <div className="report-actions">
              <button type="button" onClick={() => window.open(exportPdfUrl(run._id), '_blank')}>
                Export Report as PDF
              </button>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

export default Simulation;

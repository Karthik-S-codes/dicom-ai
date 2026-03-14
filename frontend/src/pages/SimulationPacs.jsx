import { useState } from 'react';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import { exportPdfUrl, resolveAssetUrl, startSimulation } from '../services/api';

function ImagePanel({ title, src, alt }) {
  const cacheBustedSrc = src ? `${src}${src.includes('?') ? '&' : '?'}t=${Date.now()}` : '';

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-lg transition hover:scale-[1.01]">
      <h3 className="mb-3 text-sm font-semibold text-slate-200">{title}</h3>
      <TransformWrapper minScale={1} maxScale={6} wheel={{ step: 0.15 }}>
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div className="mb-2 flex gap-2">
              <button type="button" className="rounded-md border border-slate-600 bg-slate-700 px-2 py-1 text-xs transition hover:scale-105" onClick={() => zoomIn()}>+</button>
              <button type="button" className="rounded-md border border-slate-600 bg-slate-700 px-2 py-1 text-xs transition hover:scale-105" onClick={() => zoomOut()}>-</button>
              <button type="button" className="rounded-md border border-slate-600 bg-slate-700 px-2 py-1 text-xs transition hover:scale-105" onClick={() => resetTransform()}>Reset</button>
            </div>
            <div className="min-h-[240px] overflow-hidden rounded-lg border border-slate-700 bg-slate-900 p-2">
              <TransformComponent>
                <img src={cacheBustedSrc} alt={alt} className="h-auto w-full rounded-md object-contain" />
              </TransformComponent>
            </div>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-700/40 p-3 shadow-lg transition hover:scale-105">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function SimulationPacs() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [showDetectionOverlay, setShowDetectionOverlay] = useState(true);

  const runSimulation = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await startSimulation();
      setResult(response);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to run simulation pipeline');
    } finally {
      setLoading(false);
    }
  };

  const run = result?.run;
  const displayDiagnosis = run?.diseaseLabel || run?.diagnosis || '-';
  const displayRisk = run?.risk || run?.failureRiskLabel || 'N/A';
  const retryEvents = run?.retryEvents || result?.monitoring?.retry_events || [];

  const originalSrc = resolveAssetUrl(result?.original || run?.originalImagePath || run?.selectedImagePath);
  const heatmapSrc = resolveAssetUrl(result?.heatmap || run?.heatmapPath);
  const highlightedSrc = resolveAssetUrl(
    showDetectionOverlay
      ? result?.highlighted || run?.imagePath
      : result?.original || run?.originalImagePath || run?.selectedImagePath
  );

  return (
    <main className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Simulation</h1>
          <p className="text-sm text-slate-300">Radiology PACS simulation workspace</p>
        </div>
        <button
          type="button"
          onClick={runSimulation}
          disabled={loading}
          className="rounded-lg border border-sky-500 bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:scale-105 hover:bg-sky-500 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Running Workflow...' : 'Start Simulation'}
        </button>
      </div>

      {error && <p className="rounded-md border border-red-700 bg-red-900/30 px-3 py-2 text-sm text-red-300">{error}</p>}

      {run && (
        <>
          <section className="rounded-xl border border-slate-700 bg-slate-800 p-5 shadow-lg transition">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100">AI Monitoring Panel</h2>
              <span className="rounded-full border border-slate-600 bg-slate-700 px-3 py-1 text-xs text-slate-300">Live Transfer Metrics</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Latency" value={`${Number(run.latency || 0).toFixed(2)} ms`} />
              <MetricCard label="Packet Loss" value={`${Number(run.packetLoss || 0).toFixed(2)}%`} />
              <MetricCard label="Retry Count" value={run.retryCount ?? 0} />
              <MetricCard label="Bandwidth" value={`${Number(run.bandwidth || 0).toFixed(2)} Mbps`} />
              <MetricCard label="Failure Probability" value={`${Number(run.failureProbability || 0).toFixed(2)}%`} />
              <MetricCard label="Risk Level" value={run.failureRiskLabel || 'N/A'} />
              <MetricCard label="Network Health Score" value={Number(run.networkHealthScore || 0).toFixed(2)} />
              <MetricCard label="Transfer Status" value={run.transferStatus || 'PENDING'} />
            </div>
            <p className="mt-4 text-sm text-slate-300">
              <span className="font-semibold text-slate-200">AI Actions:</span>{' '}
              {(run.aiAction || run.autoDebuggingActions || []).join(', ') || 'None'}
            </p>

            {retryEvents.length > 0 && (
              <div className="mt-3 space-y-2">
                {retryEvents.map((event) => (
                  <div key={`retry-${event.retry_attempt}`} className="rounded-lg border border-sky-700 bg-sky-900/20 p-3 text-sm text-slate-200">
                    <p className="font-medium">Attempt #{event.retry_attempt}: {event.message}</p>
                    <p className="text-slate-300">{event.reevaluation}</p>
                    <p className="text-slate-300">
                      Updated: Latency {Number(event.after?.latency_ms || 0).toFixed(2)} ms, Packet Loss {Number(event.after?.packet_loss || 0).toFixed(3)}%, Risk {event.after?.risk_level || 'N/A'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-700 bg-slate-800 p-5 shadow-lg transition">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-100">Scan Viewer</h2>
              <button
                type="button"
                onClick={() => setShowDetectionOverlay((prev) => !prev)}
                className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:scale-105 hover:shadow-lg"
              >
                Toggle Detection Overlay
              </button>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <ImagePanel title="Original Scan" src={originalSrc} alt="Original scan" />
              <ImagePanel title="AI Heatmap" src={heatmapSrc} alt="AI heatmap" />
              <ImagePanel title="Disease Detection" src={highlightedSrc} alt="Highlighted disease region" />
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 shadow-lg">
              <h2 className="mb-3 text-lg font-semibold text-slate-100">Detection Summary</h2>
              <div className="space-y-2 text-sm text-slate-300">
                <p><span className="font-medium text-slate-200">Patient ID:</span> {run.patientId}</p>
                <p><span className="font-medium text-slate-200">Modality:</span> {run.modality || run.scanType || 'N/A'}</p>
                <p><span className="font-medium text-slate-200">Disease Category:</span> {run.disease || 'N/A'}</p>
                <p><span className="font-medium text-slate-200">Diagnosis:</span> {displayDiagnosis}</p>
                <p><span className="font-medium text-slate-200">Confidence:</span> {(Number(run.confidence || 0) * 100).toFixed(2)}%</p>
                <p><span className="font-medium text-slate-200">Clinical Risk:</span> {displayRisk}</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 shadow-lg">
              <h2 className="mb-3 text-lg font-semibold text-slate-100">Medical Report</h2>
              <div className="max-h-[260px] overflow-auto rounded-lg border border-slate-700 bg-slate-900 p-3">
                <pre className="whitespace-pre-wrap text-xs text-slate-300">{run.reportText || 'Report unavailable.'}</pre>
              </div>
              <button
                type="button"
                onClick={() => window.open(exportPdfUrl(run._id), '_blank')}
                className="mt-3 rounded-lg border border-emerald-500 bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:scale-105 hover:bg-emerald-500 hover:shadow-lg"
              >
                Export Report as PDF
              </button>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

export default SimulationPacs;

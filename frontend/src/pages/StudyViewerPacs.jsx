import { useEffect, useMemo, useState } from 'react';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import { useParams } from 'react-router-dom';
import { fetchStudyById, resolveAssetUrl } from '../services/api';

function ViewerPanel({ title, src, alt }) {
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
            <div className="min-h-[220px] overflow-hidden rounded-lg border border-slate-700 bg-slate-900 p-2">
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

function StudyViewerPacs() {
  const { studyId } = useParams();
  const [study, setStudy] = useState(null);
  const [selectedScanId, setSelectedScanId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!studyId) return;
    fetchStudyById(studyId)
      .then((response) => {
        setStudy(response);
        if (response?.scans?.length > 0) {
          setSelectedScanId(response.scans[0].id);
        }
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Failed to load study');
        setStudy(null);
      });
  }, [studyId]);

  const selectedScan = useMemo(() => {
    if (!study?.scans?.length) return null;
    return study.scans.find((scan) => scan.id === selectedScanId) || study.scans[0];
  }, [study, selectedScanId]);

  return (
    <main className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Study Viewer</h1>
        <p className="text-sm text-slate-300">Radiology workstation interpretation view</p>
      </div>

      {error && <p className="rounded-md border border-red-700 bg-red-900/30 px-3 py-2 text-sm text-red-300">{error}</p>}

      {study && (
        <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
          <aside className="rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-lg">
            <h2 className="mb-3 text-lg font-semibold text-slate-100">Patient Information</h2>
            <div className="space-y-2 text-sm text-slate-300">
              <p><span className="font-medium text-slate-200">Patient ID:</span> {study.patient_id}</p>
              <p><span className="font-medium text-slate-200">Study ID:</span> {study.study_id}</p>
              <p><span className="font-medium text-slate-200">Modality:</span> {study.modality || 'N/A'}</p>
              <p><span className="font-medium text-slate-200">Date:</span> {new Date(study.timestamp).toLocaleString()}</p>
              <p><span className="font-medium text-slate-200">Number of Scans:</span> {study.number_of_scans || 0}</p>
            </div>

            <h3 className="mt-5 mb-2 text-sm font-semibold text-slate-100">Scan Thumbnails</h3>
            <div className="max-h-[52vh] space-y-2 overflow-auto pr-1">
              {(study.scans || []).map((scan) => {
                const thumb = resolveAssetUrl(scan.original || scan.detection || scan.heatmap);
                const isActive = selectedScan?.id === scan.id;

                return (
                  <button
                    key={scan.id}
                    type="button"
                    className={[
                      'w-full rounded-lg border p-2 text-left transition hover:scale-[1.01] hover:shadow-lg',
                      isActive ? 'border-sky-500 bg-sky-900/25' : 'border-slate-700 bg-slate-700/40'
                    ].join(' ')}
                    onClick={() => setSelectedScanId(scan.id)}
                  >
                    <img src={thumb} alt={scan.scan_uid || 'Scan thumbnail'} className="mb-2 h-20 w-full rounded-md border border-slate-700 object-cover" />
                    <p className="text-xs text-slate-300">{scan.diagnosis || 'Scan'}</p>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="space-y-4">
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-lg">
              <h2 className="mb-3 text-lg font-semibold text-slate-100">Study Details</h2>
              {selectedScan ? (
                <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2 xl:grid-cols-4">
                  <p><span className="font-medium text-slate-200">Scan UID:</span> {selectedScan.scan_uid || 'N/A'}</p>
                  <p><span className="font-medium text-slate-200">Diagnosis:</span> {selectedScan.diagnosis || '-'}</p>
                  <p><span className="font-medium text-slate-200">Confidence:</span> {(Number(selectedScan.confidence || 0) * 100).toFixed(2)}%</p>
                  <p><span className="font-medium text-slate-200">Risk:</span> {selectedScan.risk || 'LOW_RISK'}</p>
                </div>
              ) : (
                <p className="text-sm text-slate-300">No scans available for this study.</p>
              )}
            </div>

            {selectedScan && (
              <div className="grid gap-4 lg:grid-cols-3">
                <ViewerPanel title="Original Scan" src={resolveAssetUrl(selectedScan.original)} alt="Original scan" />
                <ViewerPanel title="AI Heatmap" src={resolveAssetUrl(selectedScan.heatmap)} alt="AI heatmap" />
                <ViewerPanel title="Disease Detection" src={resolveAssetUrl(selectedScan.detection)} alt="Disease detection" />
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

export default StudyViewerPacs;

import { useEffect, useMemo, useState } from 'react';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import { useParams } from 'react-router-dom';
import { fetchStudyById, resolveAssetUrl } from '../services/api';

function ViewerPanel({ title, src, alt }) {
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

function StudyViewer() {
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
    <main>
      <h1>Study Viewer</h1>
      <p className="subtitle">Radiology workstation view for patient study interpretation</p>

      {error && <p className="error-text">{error}</p>}

      {study && (
        <div className="study-viewer-layout">
          <aside className="panel study-sidebar">
            <h2>Patient Information</h2>
            <p><strong>Patient ID:</strong> {study.patient_id}</p>
            <p><strong>Study ID:</strong> {study.study_id}</p>
            <p><strong>Modality:</strong> {study.modality || 'N/A'}</p>
            <p><strong>Date:</strong> {new Date(study.timestamp).toLocaleString()}</p>
            <p><strong>Number of Scans:</strong> {study.number_of_scans || 0}</p>

            <h3>Scan Thumbnails</h3>
            <div className="thumbnail-list">
              {(study.scans || []).map((scan) => {
                const thumb = resolveAssetUrl(scan.original || scan.detection || scan.heatmap);
                const isActive = selectedScan?.id === scan.id;
                return (
                  <button
                    key={scan.id}
                    type="button"
                    className={`thumbnail-item ${isActive ? 'active' : ''}`}
                    onClick={() => setSelectedScanId(scan.id)}
                  >
                    <img src={thumb} alt={scan.scan_uid || 'Scan thumbnail'} />
                    <span>{scan.diagnosis || 'Scan'}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="panel study-main-viewer">
            <div className="viewer-header-row">
              <h2>Study Details</h2>
            </div>

            {selectedScan ? (
              <>
                <div className="metrics-grid">
                  <p><strong>Scan UID:</strong> {selectedScan.scan_uid || 'N/A'}</p>
                  <p><strong>Diagnosis:</strong> {selectedScan.diagnosis || '-'}</p>
                  <p><strong>Confidence:</strong> {(Number(selectedScan.confidence || 0) * 100).toFixed(2)}%</p>
                  <p><strong>Risk:</strong> {selectedScan.risk || 'LOW_RISK'}</p>
                </div>

                <div className="image-grid image-grid-three">
                  <ViewerPanel
                    title="Original Scan"
                    src={resolveAssetUrl(selectedScan.original)}
                    alt="Original scan"
                  />
                  <ViewerPanel
                    title="AI Heatmap"
                    src={resolveAssetUrl(selectedScan.heatmap)}
                    alt="AI heatmap"
                  />
                  <ViewerPanel
                    title="Disease Detection"
                    src={resolveAssetUrl(selectedScan.detection)}
                    alt="Disease detection"
                  />
                </div>
              </>
            ) : (
              <p>No scans available for this study.</p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

export default StudyViewer;

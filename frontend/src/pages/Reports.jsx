import { useEffect, useState } from 'react';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import { exportPdfUrl, fetchReportById, fetchReports, resolveAssetUrl } from '../services/api';

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

function Reports() {
  const [reports, setReports] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [showDetectionOverlay, setShowDetectionOverlay] = useState(true);

  const loadReports = () => {
    fetchReports().then(setReports).catch(() => setReports([]));
  };

  useEffect(() => {
    loadReports();
  }, []);

  const openReport = async (reportId) => {
    setSelectedId(reportId);
    try {
      const report = await fetchReportById(reportId);
      setSelectedReport(report);
    } catch (_err) {
      setSelectedReport(null);
    }
  };

  return (
    <main>
      <h1>Reports</h1>
      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Patient</th>
              <th>Diagnosis</th>
              <th>Confidence</th>
              <th>Risk</th>
              <th>View</th>
              <th>Export</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td>{r.patientId}</td>
                <td>{r.diseaseLabel || r.diagnosis || '-'}</td>
                <td>{(Number(r.confidence || 0) * 100).toFixed(2)}%</td>
                <td>{r.riskLevel}</td>
                <td>
                  <button type="button" onClick={() => openReport(r.id)}>
                    {selectedId === r.id ? 'Opened' : 'Open'}
                  </button>
                </td>
                <td><button type="button" onClick={() => window.open(exportPdfUrl(r.id), '_blank')}>PDF</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {selectedReport && (
        <section className="panel">
          <div className="viewer-header-row">
            <h2>Scan Viewer: {selectedReport.patientId}</h2>
            <button type="button" onClick={() => setShowDetectionOverlay((prev) => !prev)}>
              Toggle AI Detection
            </button>
          </div>
          <p><strong>Diagnosis:</strong> {selectedReport.diseaseLabel || selectedReport.diagnosis || '-'}</p>
          <p><strong>Risk:</strong> {selectedReport.risk || '-'}</p>
          <p><strong>Confidence:</strong> {(Number(selectedReport.confidence || 0) * 100).toFixed(2)}%</p>
          <div className="image-grid image-grid-three">
            <RadiologyImagePanel
              title="Scan Image Used For AI Detection"
              src={resolveAssetUrl(selectedReport.originalImagePath || selectedReport.selectedImagePath)}
              alt="Original scan"
            />
            <RadiologyImagePanel
              title="AI Attention Heatmap"
              src={resolveAssetUrl(selectedReport.heatmapPath)}
              alt="Heatmap scan"
            />
            <RadiologyImagePanel
              title="Disease Highlighted"
              src={resolveAssetUrl(showDetectionOverlay ? selectedReport.imagePath : selectedReport.originalImagePath || selectedReport.selectedImagePath)}
              alt="Highlighted scan"
            />
          </div>

          <p>
            <strong>Detection Bounding Box:</strong>{' '}
            {selectedReport.coordinates
              ? `x=${selectedReport.coordinates.x}, y=${selectedReport.coordinates.y}, w=${selectedReport.coordinates.width}, h=${selectedReport.coordinates.height}`
              : 'N/A'}
          </p>

          <div className="report-block">
            <pre>{selectedReport.report || 'Report text not available.'}</pre>
          </div>

          <button
            type="button"
            onClick={() => {
              window.open(exportPdfUrl(selectedReport.id), '_blank');
              loadReports();
            }}
          >
            Export Report as PDF
          </button>
        </section>
      )}
    </main>
  );
}

export default Reports;

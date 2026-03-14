function ReportViewer({ reportData, onClose }) {
  if (!reportData) return null;

  return (
    <div className="report-modal-overlay">
      <div className="report-modal">
        <div className="report-modal-header">
          <h2>AI Report</h2>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <p><strong>Patient ID:</strong> {reportData.patientId}</p>
        <pre>{reportData.report}</pre>
      </div>
    </div>
  );
}

export default ReportViewer;

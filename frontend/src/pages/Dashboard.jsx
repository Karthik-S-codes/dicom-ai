import { useEffect, useMemo, useState } from 'react';
import {
  analyzeScan,
  fetchScans,
  generateReport,
  generateScan,
  startTransfer
} from '../services/api';

const PIPELINE_STEPS = [
  'CT Scanner',
  'DICOM Transfer',
  'PACS Storage',
  'AI Monitoring',
  'Disease Detection',
  'Medical Report'
];

function createInitialPipelineState() {
  return PIPELINE_STEPS.map((label, index) => ({
    id: index + 1,
    label,
    status: 'pending'
  }));
}

function WorkflowPipeline({ steps, progress }) {
  return (
    <section className="panel workflow-panel">
      <div className="workflow-header">
        <h2>Medical Imaging Workflow Pipeline</h2>
        <span className="workflow-progress-text">{Math.round(progress)}% Completed</span>
      </div>

      <div className="workflow-progress-track">
        <div className="workflow-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="workflow-graph">
        {steps.map((step, index) => (
          <div key={step.id} className="workflow-step-wrap">
            <div className={`workflow-node ${step.status}`}>
              <span className="workflow-node-id">{step.id}</span>
            </div>
            <p className="workflow-label">{step.label}</p>
            {index < steps.length - 1 && (
              <span
                className={`workflow-connector ${
                  step.status === 'completed' || step.status === 'processing' ? 'active' : ''
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Dashboard() {
  const [runs, setRuns] = useState([]);
  const [pipelineSteps, setPipelineSteps] = useState(createInitialPipelineState);
  const [isRunning, setIsRunning] = useState(false);
  const [workflowError, setWorkflowError] = useState('');

  useEffect(() => {
    fetchScans().then(setRuns).catch(() => setRuns([]));
  }, []);

  const updateStepStatus = (index, status) => {
    setPipelineSteps((prev) => prev.map((step, i) => (i === index ? { ...step, status } : step)));
  };

  const resetPipeline = () => {
    setPipelineSteps(createInitialPipelineState());
  };

  const runLiveWorkflow = async () => {
    try {
      setIsRunning(true);
      setWorkflowError('');
      resetPipeline();

      updateStepStatus(0, 'processing');
      const generated = await generateScan();
      updateStepStatus(0, 'completed');

      updateStepStatus(1, 'processing');
      const transfer = await startTransfer({ dicomPath: generated.dicomPath });
      updateStepStatus(1, 'completed');

      updateStepStatus(2, 'processing');
      await new Promise((resolve) => setTimeout(resolve, 140));
      if (transfer?.pacs?.status !== 'SUCCESS') {
        updateStepStatus(2, 'completed');
        throw new Error('PACS storage was recovered after a transfer warning');
      }
      updateStepStatus(2, 'completed');

      updateStepStatus(3, 'processing');
      await new Promise((resolve) => setTimeout(resolve, 120));
      updateStepStatus(3, 'completed');

      updateStepStatus(4, 'processing');
      await analyzeScan();
      updateStepStatus(4, 'completed');

      updateStepStatus(5, 'processing');
      await generateReport();
      updateStepStatus(5, 'completed');

      const updatedRuns = await fetchScans();
      setRuns(updatedRuns);
    } catch (error) {
      setWorkflowError(error?.response?.data?.message || error.message || 'Workflow execution failed');
    } finally {
      setIsRunning(false);
    }
  };

  const progress = useMemo(() => {
    const total = pipelineSteps.length || 1;
    const completed = pipelineSteps.filter((step) => step.status === 'completed').length;
    const processing = pipelineSteps.some((step) => step.status === 'processing') ? 0.5 : 0;
    return ((completed + processing) / total) * 100;
  }, [pipelineSteps]);

  const kpi = useMemo(() => {
    const total = runs.length;
    const success = runs.filter((r) => r.transferStatus === 'SUCCESS').length;
    const avgLatency = total ? runs.reduce((a, b) => a + Number(b.latency || 0), 0) / total : 0;
    return {
      total,
      successRate: total ? ((success / total) * 100).toFixed(1) : '0.0',
      avgLatency: avgLatency.toFixed(1)
    };
  }, [runs]);

  return (
    <main>
      <h1>AI-Powered Medical Imaging Transfer System</h1>
      <p className="subtitle">Hospital imaging workflow overview</p>

      <WorkflowPipeline steps={pipelineSteps} progress={progress} />

      <section className="panel">
        <div className="workflow-header">
          <h2>Live Pipeline Control</h2>
          <button type="button" onClick={runLiveWorkflow} disabled={isRunning}>
            {isRunning ? 'Running Workflow...' : 'Start Live Workflow Simulation'}
          </button>
        </div>
        {workflowError && <p className="error-text">{workflowError}</p>}
      </section>

      <section className="kpi-grid">
        <article className="panel"><h3>Total Simulation Runs</h3><p>{kpi.total}</p></article>
        <article className="panel"><h3>Transfer Success Rate</h3><p>{kpi.successRate}%</p></article>
        <article className="panel"><h3>Average Latency</h3><p>{kpi.avgLatency} ms</p></article>
      </section>

      <section className="panel">
        <h2>Recent Simulation Runs</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Latency</th>
                <th>Status</th>
                <th>Confidence</th>
                <th>Risk</th>
                <th>Diagnosis</th>
              </tr>
            </thead>
            <tbody>
              {runs.slice(0, 8).map((run) => (
                <tr key={run._id || run.scanUid}>
                  <td>{run.patientId}</td>
                  <td>{Number(run.latency || 0).toFixed(1)} ms</td>
                  <td>{run.transferStatus}</td>
                  <td>{(Number(run.confidence || 0) * 100).toFixed(1)}%</td>
                  <td>{run.risk || run.failureRiskLabel}</td>
                  <td>{run.diagnosis || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default Dashboard;

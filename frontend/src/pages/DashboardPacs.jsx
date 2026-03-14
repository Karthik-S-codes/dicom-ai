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
    <section className="rounded-xl border border-slate-700 bg-slate-800 p-5 shadow-lg transition">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-100">Medical Imaging Workflow Pipeline</h2>
        <span className="rounded-full border border-slate-600 bg-slate-700 px-3 py-1 text-xs font-medium text-slate-200">
          {Math.round(progress)}% Completed
        </span>
      </div>

      <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-slate-700">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {steps.map((step, index) => (
          <div key={step.id} className="relative">
            <div
              className={[
                'flex min-h-[108px] flex-col items-center justify-center rounded-lg border p-3 text-center transition duration-200 hover:scale-105 hover:shadow-lg',
                step.status === 'completed' ? 'border-emerald-600 bg-emerald-900/20' : '',
                step.status === 'processing' ? 'border-sky-600 bg-sky-900/20' : '',
                step.status === 'pending' ? 'border-slate-700 bg-slate-700/30' : ''
              ].join(' ')}
            >
              <span
                className={[
                  'mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
                  step.status === 'completed' ? 'bg-emerald-600 text-white' : '',
                  step.status === 'processing' ? 'bg-sky-600 text-white' : '',
                  step.status === 'pending' ? 'bg-slate-600 text-slate-100' : ''
                ].join(' ')}
              >
                {step.id}
              </span>
              <p className="text-sm text-slate-200">{step.label}</p>
            </div>
            {index < steps.length - 1 && (
              <span className="absolute -right-2 top-1/2 hidden h-0.5 w-4 bg-slate-600 xl:block" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function DashboardPacs() {
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
      await new Promise((resolve) => setTimeout(resolve, 350));
      if (transfer?.pacs?.status !== 'SUCCESS') {
        throw new Error('PACS storage failed during DICOM transfer');
      }
      updateStepStatus(2, 'completed');

      updateStepStatus(3, 'processing');
      await new Promise((resolve) => setTimeout(resolve, 350));
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
    const avgConfidence = total ? runs.reduce((sum, run) => sum + Number(run.confidence || 0), 0) / total : 0;

    return {
      total,
      successRate: total ? ((success / total) * 100).toFixed(1) : '0.0',
      avgLatency: avgLatency.toFixed(1),
      detectionAccuracy: (avgConfidence * 100).toFixed(1)
    };
  }, [runs]);

  return (
    <main className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Dashboard</h1>
        <p className="text-sm text-slate-300">Professional PACS command center</p>
      </div>

      <WorkflowPipeline steps={pipelineSteps} progress={progress} />

      <section className="rounded-xl border border-slate-700 bg-slate-800 p-5 shadow-lg transition">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-100">Live Pipeline Control</h2>
          <button
            type="button"
            onClick={runLiveWorkflow}
            disabled={isRunning}
            className="rounded-lg border border-sky-500 bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:scale-105 hover:bg-sky-500 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRunning ? 'Running Workflow...' : 'Start Live Workflow Simulation'}
          </button>
        </div>
        {workflowError && (
          <p className="mt-3 rounded-md border border-red-700 bg-red-900/30 px-3 py-2 text-sm text-red-300">
            {workflowError}
          </p>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-lg transition hover:scale-105">
          <h3 className="text-sm text-slate-300">Total Scans</h3>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{kpi.total}</p>
        </article>
        <article className="rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-lg transition hover:scale-105">
          <h3 className="text-sm text-slate-300">Transfer Success Rate</h3>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{kpi.successRate}%</p>
        </article>
        <article className="rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-lg transition hover:scale-105">
          <h3 className="text-sm text-slate-300">Average Latency</h3>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{kpi.avgLatency} ms</p>
        </article>
        <article className="rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-lg transition hover:scale-105">
          <h3 className="text-sm text-slate-300">AI Detection Accuracy</h3>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{kpi.detectionAccuracy}%</p>
        </article>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-800 p-5 shadow-lg transition">
        <h2 className="mb-4 text-lg font-semibold text-slate-100">Recent Simulation Runs</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700 text-sm">
            <thead className="bg-slate-700/40 text-slate-300">
              <tr>
                <th className="px-3 py-2 text-left">Patient</th>
                <th className="px-3 py-2 text-left">Latency</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Confidence</th>
                <th className="px-3 py-2 text-left">Risk</th>
                <th className="px-3 py-2 text-left">Diagnosis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {runs.slice(0, 8).map((run) => (
                <tr key={run._id || run.scanUid} className="transition hover:bg-slate-700/40">
                  <td className="px-3 py-2">{run.patientId}</td>
                  <td className="px-3 py-2">{Number(run.latency || 0).toFixed(1)} ms</td>
                  <td className="px-3 py-2">{run.transferStatus}</td>
                  <td className="px-3 py-2">{(Number(run.confidence || 0) * 100).toFixed(1)}%</td>
                  <td className="px-3 py-2">{run.risk || run.failureRiskLabel}</td>
                  <td className="px-3 py-2">{run.diagnosis || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default DashboardPacs;

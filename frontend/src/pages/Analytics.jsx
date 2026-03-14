import { useEffect, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { CategoryScale, Chart as ChartJS, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend } from 'chart.js';
import { fetchAnalytics } from '../services/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

function Analytics() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchAnalytics().then(setData).catch(() => setData(null));
  }, []);

  if (!data) return <main><h1>Analytics</h1><p>Loading analytics...</p></main>;

  const latencyData = {
    labels: data.latencyTrend.map((d, i) => `Run ${i + 1}`),
    datasets: [{ label: 'Latency (ms)', data: data.latencyTrend.map((d) => d.latency), borderColor: '#60a5fa' }]
  };

  const failureProbabilityData = {
    labels: data.failureProbabilityTrend.map((d, i) => `Run ${i + 1}`),
    datasets: [{
      label: 'Failure Probability %',
      data: data.failureProbabilityTrend.map((d) => d.failureProbability),
      borderColor: '#f97316'
    }]
  };

  const successData = {
    labels: ['Success', 'Failed'],
    datasets: [{ label: 'Transfer Outcome', data: [data.transferOutcome.success, data.transferOutcome.failed], backgroundColor: ['#22c55e', '#ef4444'] }]
  };

  const networkHealthData = {
    labels: ['Network Health Score'],
    datasets: [{
      label: 'Network Health',
      data: [data.networkHealthScore || 0],
      backgroundColor: ['#22c55e']
    }]
  };

  return (
    <main>
      <h1>Analytics Dashboard</h1>
      <section className="kpi-grid">
        <article className="panel"><h3>Total Runs</h3><p>{data.totalRuns}</p></article>
        <article className="panel"><h3>Success Rate</h3><p>{data.successRate}%</p></article>
        <article className="panel"><h3>Network Health Score</h3><p>{Number(data.networkHealthScore || 0).toFixed(2)}</p></article>
      </section>
      <section className="panel"><h2>Transfer Latency Trend</h2><Line data={latencyData} /></section>
      <section className="panel"><h2>Failure Probability Trend</h2><Line data={failureProbabilityData} /></section>
      <section className="panel"><h2>Transfer Success Rate</h2><Bar data={successData} /></section>
      <section className="panel"><h2>Network Health Score</h2><Bar data={networkHealthData} /></section>
    </main>
  );
}

export default Analytics;

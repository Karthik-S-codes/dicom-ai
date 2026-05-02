const STAGES = [
  'Generate Medical Scan',
  'Transfer Image via DICOM',
  'Monitor Transfer with AI',
  'Store Image in PACS Server',
  'Analyze Scan for Disease',
  'Display Highlighted Image',
  'Generate Medical Report',
  'Export Report as PDF'
];

function PipelineProgress({ currentStage, isRunning = false }) {
  const totalStages = STAGES.length;
  const clampedStage = Math.min(Math.max(currentStage, 0), totalStages);
  const progressWidth = `${(clampedStage / totalStages) * 100}%`;

  return (
    <section className="panel">
      <h2>Pipeline Progress</h2>
      <div className="progress-track">
        <div className={`progress-fill ${isRunning ? 'running' : ''}`} style={{ width: progressWidth }} />
      </div>
      <ol className="stage-list">
        {STAGES.map((stage, index) => {
          const stageNo = index + 1;

          let state = 'pending';
          if (!isRunning && clampedStage >= totalStages) {
            state = 'done';
          } else if (stageNo < clampedStage) {
            state = 'done';
          } else if (stageNo === clampedStage && clampedStage > 0) {
            state = 'active';
          }

          return (
            <li key={stage} className={`stage-item ${state}`}>
              <span>{stageNo}</span>
              <div>
                <p>{stage}</p>
                <small className="stage-state">
                  {state === 'done' ? 'Completed' : state === 'active' ? 'Processing' : 'Pending'}
                </small>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default PipelineProgress;

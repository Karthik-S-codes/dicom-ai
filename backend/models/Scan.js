const mongoose = require('mongoose');

const scanSchema = new mongoose.Schema(
  {
    patientId: { type: String, default: 'PATIENT_001', index: true },
    scanType: { type: String, default: 'CT' },
    modality: { type: String, default: 'XRAY' },
    disease: { type: String, default: '' },
    latency: { type: Number, default: 0 },
    packetLoss: { type: Number, default: 0 },
    bandwidth: { type: Number, default: 0 },
    dicomTimeout: { type: Number, default: 1000 },
    transferStatus: { type: String, default: 'PENDING', enum: ['PENDING', 'SUCCESS', 'FAILED'] },
    diseaseDetected: { type: Boolean, default: false },
    confidence: { type: Number, default: 0 },
    risk: { type: String, default: 'LOW_RISK' },
    timestamp: { type: Date, default: Date.now },
    reportPath: { type: String, default: '' },
    pdfPath: { type: String, default: '' },
    imagePath: { type: String, default: '' },
    originalImagePath: { type: String, default: '' },
    heatmapPath: { type: String, default: '' },
    dicomPath: { type: String, default: '' },
    pacsPath: { type: String, default: '' },
    coordinates: {
      x: { type: Number, default: null },
      y: { type: Number, default: null },
      width: { type: Number, default: null },
      height: { type: Number, default: null }
    },
    reportText: { type: String, default: '' },
    diagnosis: { type: String, default: '' },
    recommendation: { type: String, default: '' },
    failureProbability: { type: Number, default: 0 },
    failureRiskLabel: { type: String, default: 'LOW_RISK' },
    aiAction: { type: [String], default: [] },
    networkHealthScore: { type: Number, default: 0 },
    networkStability: { type: String, default: 'UNKNOWN' },
    autoDebuggingActions: { type: [String], default: [] },
    retryEvents: { type: [mongoose.Schema.Types.Mixed], default: [] },
    autoRetryTriggered: { type: Boolean, default: false },
    retryCount: { type: Number, default: 0 },
    scanUid: { type: String, default: '' },
    pipelineStage: { type: Number, default: 0 }
  },
  { versionKey: false, strict: false, collection: 'simulation_runs' }
);

module.exports = mongoose.model('Scan', scanSchema);

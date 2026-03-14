const mongoose = require('mongoose');

const studyScanSchema = new mongoose.Schema(
  {
    scan_uid: { type: String, default: '' },
    original: { type: String, default: '' },
    heatmap: { type: String, default: '' },
    detection: { type: String, default: '' },
    diagnosis: { type: String, default: '' },
    confidence: { type: Number, default: 0 },
    risk: { type: String, default: 'LOW_RISK' },
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

const studySchema = new mongoose.Schema(
  {
    studyId: { type: String, required: true, unique: true, index: true },
    patientId: { type: String, required: true, index: true },
    modality: { type: String, default: 'XRAY' },
    scanPaths: { type: [String], default: [] },
    scans: { type: [studyScanSchema], default: [] },
    scanCount: { type: Number, default: 0 },
    scanRef: { type: String, default: '', index: true },
    timestamp: { type: Date, default: Date.now }
  },
  { versionKey: false, strict: false, collection: 'patient_studies' }
);

module.exports = mongoose.model('Study', studySchema);

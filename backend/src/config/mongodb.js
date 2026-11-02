const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/bizpermit_db';

let isConnected = false;

async function connectMongoDB() {
  if (isConnected) return mongoose.connection;
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000
    });
    isConnected = true;
    console.log('[MongoDB] Connected successfully to ' + uri);
    return mongoose.connection;
  } catch (err) {
    console.error('[MongoDB] Connection error:', err.message);
    throw err;
  }
}

// 1. Application Form Responses Schema
const ApplicationFormResponseSchema = new mongoose.Schema({
  applicationId: { type: Number, required: true, index: true },
  applicationNumber: { type: String, required: true, index: true },
  licenseTypeId: { type: Number, required: true },
  formType: { type: String, default: 'STANDARD_PERMIT' },
  formVersion: { type: String, default: '1.0' },
  formData: { type: mongoose.Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  collection: 'application_form_responses'
});

// 2. Application Documents Schema
const ApplicationDocumentSchema = new mongoose.Schema({
  applicationId: { type: Number, required: true, index: true },
  requirementCode: { type: String, required: true },
  originalFilename: { type: String, required: true },
  storageKey: { type: String, required: true },
  mimeType: { type: String, required: true },
  fileSize: { type: Number, required: true },
  checksum: { type: String, default: '' },
  verificationStatus: {
    type: String,
    enum: ['PENDING', 'VERIFIED', 'REJECTED'],
    default: 'PENDING',
    index: true
  },
  uploadedBy: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now },
  reviewerId: { type: Number, default: null },
  reviewNotes: { type: String, default: '' }
}, {
  collection: 'application_documents'
});

// 3. Inspection Reports Schema
const InspectionReportSchema = new mongoose.Schema({
  inspectionId: { type: Number, required: true, unique: true, index: true },
  applicationId: { type: Number, required: true, index: true },
  reportVersion: { type: String, default: '1.0' },
  checklist: [{
    itemId: { type: String, required: true },
    title: { type: String, required: true },
    status: { type: String, enum: ['PASS', 'FAIL', 'NOT_APPLICABLE'], default: 'PASS' },
    remarks: { type: String, default: '' }
  }],
  evidenceMetadata: [{
    originalFilename: { type: String },
    storageKey: { type: String },
    caption: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  }],
  remarks: { type: String, default: '' },
  inspectorId: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
}, {
  collection: 'inspection_reports'
});

const ApplicationFormResponse = mongoose.model('ApplicationFormResponse', ApplicationFormResponseSchema);
const ApplicationDocument = mongoose.model('ApplicationDocument', ApplicationDocumentSchema);
const InspectionReport = mongoose.model('InspectionReport', InspectionReportSchema);

async function testConnection() {
  try {
    if (mongoose.connection.readyState !== 1) {
      await connectMongoDB();
    }
    const admin = new mongoose.mongo.Admin(mongoose.connection.db);
    const ping = await admin.ping();
    return { status: 'healthy', database: 'MongoDB', ping };
  } catch (err) {
    return { status: 'error', database: 'MongoDB', error: err.message };
  }
}

module.exports = {
  connectMongoDB,
  testConnection,
  ApplicationFormResponse,
  ApplicationDocument,
  InspectionReport,
  mongoose
};

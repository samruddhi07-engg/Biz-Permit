const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const appRepo = require('../repositories/application.repository');
const issuedLicenseRepo = require('../repositories/issued-license.repository');
const notificationRepo = require('../repositories/notification.repository');
const auditLogRepo = require('../repositories/audit-log.repository');
const redisService = require('./redis.service');
const {
  ApplicationFormResponse,
  ApplicationDocument
} = require('../config/mongodb');

class ApplicationService {
  async getApplication(id, user) {
    const app = await appRepo.findById(id);
    if (!app) {
      const err = new Error('Application not found.');
      err.statusCode = 404;
      throw err;
    }

    // Role check: Business owner can only view their own
    const isOwner = app.owner_id === user.id;
    const isStaffOrAdmin = user.roles.some(r => ['OFFICER', 'INSPECTOR', 'ADMIN'].includes(r));
    if (!isOwner && !isStaffOrAdmin) {
      const err = new Error('You are not authorized to view this application.');
      err.statusCode = 403;
      throw err;
    }

    // Attach MongoDB form response and documents
    const formResponse = await ApplicationFormResponse.findOne({ applicationId: app.id });
    app.formData = formResponse ? formResponse.formData : {};
    app.formType = formResponse ? formResponse.formType : 'STANDARD';

    const documents = await ApplicationDocument.find({ applicationId: app.id });
    app.documents = documents;

    return app;
  }

  async createApplication(data, userId) {
    const app = await appRepo.create({
      businessId: data.businessId,
      licenseTypeId: data.licenseTypeId,
      ownerId: userId,
      applicationType: data.applicationType || 'NEW',
      parentLicenseId: data.parentLicenseId || null
    });

    // Initialize MongoDB Form Response record
    await ApplicationFormResponse.findOneAndUpdate(
      { applicationId: app.id },
      {
        applicationId: app.id,
        applicationNumber: app.application_number,
        licenseTypeId: app.license_type_id,
        formType: 'STANDARD_PERMIT',
        formVersion: '1.0',
        formData: data.formData || {}
      },
      { upsert: true, new: true }
    );

    await auditLogRepo.log(userId, 'CREATE_APPLICATION', 'APPLICATION', app.id, {
      applicationNumber: app.application_number,
      licenseTypeId: app.license_type_id
    });

    await redisService.invalidateWorkflowCaches(userId);

    return this.getApplication(app.id, { id: userId, roles: ['BUSINESS_OWNER'] });
  }

  async saveFormData(id, formData, userId) {
    const app = await appRepo.findById(id);
    if (!app) {
      const err = new Error('Application not found.');
      err.statusCode = 404;
      throw err;
    }

    if (app.owner_id !== userId) {
      const err = new Error('Unauthorized.');
      err.statusCode = 403;
      throw err;
    }

    const updated = await ApplicationFormResponse.findOneAndUpdate(
      { applicationId: id },
      {
        applicationId: id,
        applicationNumber: app.application_number,
        licenseTypeId: app.license_type_id,
        formData: formData
      },
      { upsert: true, new: true }
    );

    await auditLogRepo.log(userId, 'UPDATE_FORM_DATA', 'APPLICATION', id);
    return updated.formData;
  }

  async uploadDocument(appId, file, requirementCode, userId) {
    const app = await appRepo.findById(appId);
    if (!app) {
      const err = new Error('Application not found.');
      err.statusCode = 404;
      throw err;
    }

    // Calculate file checksum
    const fileBuffer = fs.readFileSync(file.path);
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Create or update existing document for this requirement
    const doc = await ApplicationDocument.findOneAndUpdate(
      { applicationId: appId, requirementCode: requirementCode },
      {
        applicationId: appId,
        requirementCode,
        originalFilename: file.originalname,
        storageKey: file.filename,
        mimeType: file.mimetype,
        fileSize: file.size,
        checksum,
        verificationStatus: 'PENDING',
        uploadedBy: userId,
        uploadedAt: new Date(),
        reviewerId: null,
        reviewNotes: ''
      },
      { upsert: true, new: true }
    );

    await auditLogRepo.log(userId, 'UPLOAD_DOCUMENT', 'APPLICATION_DOCUMENT', doc._id, {
      requirementCode,
      filename: file.originalname
    });

    return doc;
  }

  async getDocuments(appId, user = null) {
    if (user) {
      const app = await appRepo.findById(appId);
      if (!app) {
        const err = new Error('Application not found.');
        err.statusCode = 404;
        throw err;
      }
      const isOwner = app.owner_id === user.id;
      const isStaffOrAdmin = user.roles.some(r => ['OFFICER', 'INSPECTOR', 'ADMIN'].includes(r));
      if (!isOwner && !isStaffOrAdmin) {
        const err = new Error('Access denied. You do not have permission to view documents for this application.');
        err.statusCode = 403;
        throw err;
      }
    }
    return await ApplicationDocument.find({ applicationId: appId });
  }

  async getMyDocumentVault(userId) {
    const docs = await ApplicationDocument.find({ uploadedBy: userId }).sort({ uploadedAt: -1 }).lean();

    // Collect distinct application IDs
    const appIds = [...new Set(docs.map(d => d.applicationId).filter(Boolean))];
    let appMap = {};

    if (appIds.length > 0) {
      const mysql = require('../config/mysql');
      const placeholders = appIds.map(() => '?').join(',');
      const rows = await mysql.query(
        `SELECT a.id, a.application_number, lt.name AS license_name, b.business_name
         FROM applications a
         JOIN license_types lt ON a.license_type_id = lt.id
         JOIN businesses b ON a.business_id = b.id
         WHERE a.id IN (${placeholders})`,
        appIds
      );
      rows.forEach(r => {
        appMap[r.id] = r;
      });
    }

    const enrichedDocs = docs.map(d => {
      const app = appMap[d.applicationId] || {};
      return {
        ...d,
        id: d._id,
        applicationNumber: app.application_number || (d.applicationId ? `APP-${d.applicationId}` : 'General Vault'),
        licenseTypeName: app.license_name || 'Supporting Credential',
        businessName: app.business_name || 'Business Entity'
      };
    });

    const stats = {
      total: enrichedDocs.length,
      verified: enrichedDocs.filter(d => d.verificationStatus === 'VERIFIED').length,
      pending: enrichedDocs.filter(d => d.verificationStatus === 'PENDING').length,
      rejected: enrichedDocs.filter(d => d.verificationStatus === 'REJECTED').length
    };

    return { documents: enrichedDocs, stats };
  }

  async uploadVaultDocument(file, category, applicationId, userId) {
    let resolvedAppId = applicationId ? parseInt(applicationId, 10) : 0;
    if (resolvedAppId) {
      const app = await appRepo.findById(resolvedAppId);
      if (!app || app.owner_id !== userId) {
        resolvedAppId = 0;
      }
    }

    const fileBuffer = fs.readFileSync(file.path);
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const doc = new ApplicationDocument({
      applicationId: resolvedAppId,
      requirementCode: category || 'GENERAL_VAULT',
      originalFilename: file.originalname,
      storageKey: file.filename,
      mimeType: file.mimetype,
      fileSize: file.size,
      checksum,
      verificationStatus: 'PENDING',
      uploadedBy: userId,
      uploadedAt: new Date(),
      reviewerId: null,
      reviewNotes: ''
    });

    await doc.save();

    await auditLogRepo.log(userId, 'VAULT_UPLOAD_DOCUMENT', 'APPLICATION_DOCUMENT', doc._id.toString(), {
      category: category || 'GENERAL_VAULT',
      filename: file.originalname,
      fileSize: file.size
    });

    return doc;
  }

  async deleteDocument(docId, userId, userRoles = []) {
    const doc = await ApplicationDocument.findById(docId);
    if (!doc) {
      const err = new Error('Document not found.');
      err.statusCode = 404;
      throw err;
    }

    const isAdmin = userRoles.includes('ADMIN');
    if (!isAdmin && doc.uploadedBy !== userId) {
      const err = new Error('Unauthorized. You can only delete your own documents.');
      err.statusCode = 403;
      throw err;
    }

    if (doc.verificationStatus === 'VERIFIED' && !isAdmin) {
      const err = new Error('Verified documents cannot be removed as they are part of statutory review.');
      err.statusCode = 400;
      throw err;
    }

    // Remove file from disk
    const filePath = path.resolve(__dirname, '../../uploads', doc.storageKey);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
    }

    await ApplicationDocument.deleteOne({ _id: docId });
    await auditLogRepo.log(userId, 'DELETE_DOCUMENT', 'APPLICATION_DOCUMENT', docId);
    return true;
  }

  async verifyDocument(docId, status, reviewNotes, reviewerId) {
    const doc = await ApplicationDocument.findById(docId);
    if (!doc) {
      const err = new Error('Document record not found.');
      err.statusCode = 404;
      throw err;
    }

    doc.verificationStatus = status;
    doc.reviewNotes = reviewNotes || '';
    doc.reviewerId = reviewerId;
    await doc.save();

    await auditLogRepo.log(reviewerId, 'VERIFY_DOCUMENT', 'APPLICATION_DOCUMENT', docId, {
      status,
      notes: reviewNotes
    });

    return doc;
  }

  async submitApplication(id, userId, paymentRef = null) {
    const app = await appRepo.findById(id);
    if (!app) {
      const err = new Error('Application not found.');
      err.statusCode = 404;
      throw err;
    }

    if (app.owner_id !== userId) {
      const err = new Error('Unauthorized.');
      err.statusCode = 403;
      throw err;
    }

    // Verify all mandatory documents are present in MongoDB
    const reqDocs = await ApplicationDocument.find({ applicationId: id });
    const uploadedCodes = reqDocs.map(d => d.requirementCode);
    const mandatoryRequirements = (app.requirements || []).filter(r => r.is_mandatory);

    for (const req of mandatoryRequirements) {
      if (!uploadedCodes.includes(req.requirement_code)) {
        const err = new Error(`Mandatory document missing: ${req.title}`);
        err.statusCode = 400;
        err.code = 'MISSING_DOCUMENT';
        throw err;
      }
    }

    const submittedApp = await appRepo.submit(id, userId, paymentRef);

    await auditLogRepo.log(userId, 'SUBMIT_APPLICATION', 'APPLICATION', id, {
      applicationNumber: app.application_number
    });

    await notificationRepo.create(
      userId,
      `Application Submitted: ${app.application_number}`,
      `Your application for ${app.license_name} has been received and routed to the licensing desk.`,
      'INFO',
      `/owner/application-details.html?id=${id}`
    );

    await redisService.invalidateWorkflowCaches(userId);

    return submittedApp;
  }

  async requestCorrections(id, remarks, officerId) {
    const app = await appRepo.updateStatus(id, 'CORRECTION_REQUIRED', officerId, remarks);

    await auditLogRepo.log(officerId, 'REQUEST_CORRECTIONS', 'APPLICATION', id, { remarks });

    await notificationRepo.create(
      app.owner_id,
      `Action Required on Application ${app.application_number}`,
      `An officer has requested clarifications/corrections: "${remarks}"`,
      'WARNING',
      `/owner/application-details.html?id=${id}`
    );

    await redisService.invalidateWorkflowCaches(app.owner_id);

    return app;
  }

  async recordDecision(id, decision, remarks, officerId) {
    if (decision === 'APPROVED') {
      const issued = await issuedLicenseRepo.approveAndIssue(id, officerId, remarks);
      await auditLogRepo.log(officerId, 'APPROVE_APPLICATION', 'APPLICATION', id, {
        licenseNumber: issued.license_number,
        remarks
      });
      await redisService.invalidateWorkflowCaches();
      return { status: 'APPROVED', issuedLicense: issued };
    } else if (decision === 'REJECTED') {
      const app = await appRepo.updateStatus(id, 'REJECTED', officerId, remarks);
      await auditLogRepo.log(officerId, 'REJECT_APPLICATION', 'APPLICATION', id, { remarks });
      await notificationRepo.create(
        app.owner_id,
        `Application Rejected: ${app.application_number}`,
        `Your application for ${app.license_name} was rejected: ${remarks}`,
        'ERROR',
        `/owner/application-details.html?id=${id}`
      );
      await redisService.invalidateWorkflowCaches(app.owner_id);
      return { status: 'REJECTED', application: app };
    } else {
      const err = new Error('Invalid decision. Must be APPROVED or REJECTED.');
      err.statusCode = 400;
      throw err;
    }
  }
}

module.exports = new ApplicationService();

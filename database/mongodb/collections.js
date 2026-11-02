/**
 * BizPermit - MongoDB Collection Definitions and Schema Validators
 * Stores flexible dynamic form responses, document storage metadata, and detailed inspection checklists.
 */

const collections = {
  application_form_responses: {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["applicationId", "applicationNumber", "licenseTypeId", "formData"],
        properties: {
          applicationId: {
            bsonType: "int",
            description: "Authoritative MySQL Application Primary Key"
          },
          applicationNumber: {
            bsonType: "string",
            description: "Application tracking code (e.g. APP-2026-0001)"
          },
          licenseTypeId: {
            bsonType: "int",
            description: "MySQL License Type ID"
          },
          formType: {
            bsonType: "string",
            description: "Category of application form"
          },
          formVersion: {
            bsonType: "string"
          },
          formData: {
            bsonType: "object",
            description: "Dynamic unstructured applicant responses"
          }
        }
      }
    }
  },

  application_documents: {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["applicationId", "requirementCode", "originalFilename", "storageKey", "mimeType", "fileSize", "verificationStatus", "uploadedBy"],
        properties: {
          applicationId: {
            bsonType: "int",
            description: "MySQL Application ID"
          },
          requirementCode: {
            bsonType: "string"
          },
          originalFilename: {
            bsonType: "string"
          },
          storageKey: {
            bsonType: "string",
            description: "Secure disk reference name"
          },
          mimeType: {
            bsonType: "string"
          },
          fileSize: {
            bsonType: "int"
          },
          verificationStatus: {
            enum: ["PENDING", "VERIFIED", "REJECTED"]
          },
          uploadedBy: {
            bsonType: "int"
          }
        }
      }
    }
  },

  inspection_reports: {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["inspectionId", "applicationId", "inspectorId", "checklist"],
        properties: {
          inspectionId: {
            bsonType: "int",
            description: "MySQL Inspection ID"
          },
          applicationId: {
            bsonType: "int",
            description: "MySQL Application ID"
          },
          inspectorId: {
            bsonType: "int"
          },
          checklist: {
            bsonType: "array",
            items: {
              bsonType: "object",
              required: ["itemId", "title", "status"],
              properties: {
                itemId: { bsonType: "string" },
                title: { bsonType: "string" },
                status: { enum: ["PASS", "FAIL", "NOT_APPLICABLE"] },
                remarks: { bsonType: "string" }
              }
            }
          }
        }
      }
    }
  }
};

module.exports = collections;

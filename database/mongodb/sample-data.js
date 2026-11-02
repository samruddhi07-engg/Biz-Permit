/**
 * BizPermit - MongoDB Seed / Sample Data Script
 */
const {
  connectMongoDB,
  ApplicationFormResponse,
  ApplicationDocument,
  InspectionReport,
  mongoose
} = require('../../backend/src/config/mongodb');

async function seedMongo() {
  await connectMongoDB();
  console.log('[MongoDB] Seeding sample data...');

  await ApplicationFormResponse.deleteMany({});
  await ApplicationDocument.deleteMany({});
  await InspectionReport.deleteMany({});

  // 1. Dynamic Form Responses for MySQL Applications
  await ApplicationFormResponse.insertMany([
    {
      applicationId: 1,
      applicationNumber: 'APP-2026-0001',
      licenseTypeId: 1,
      formType: 'GENERAL_TRADE',
      formVersion: '1.0',
      formData: {
        premisesAreaSqFt: 1850,
        commercialActivity: 'Specialty Espresso Bar and Artisan Roastery',
        operatingHours: '07:00 - 20:00 Daily',
        employeeCount: 6,
        waterConnectionRef: 'MUNI-WTR-8812',
        wasteDisposalMethod: 'Municipal Composting & Recycling Service',
        emergencyContactName: 'Marcus Vance',
        emergencyContactPhone: '+1 (555) 234-5678'
      }
    },
    {
      applicationId: 2,
      applicationNumber: 'APP-2026-0002',
      licenseTypeId: 2,
      formType: 'FOOD_SANITATION',
      formVersion: '1.0',
      formData: {
        seatingCapacity: 45,
        hasGreaseTrap: true,
        greaseTrapCapacityLitres: 250,
        refrigerationUnitsCount: 4,
        foodSafetyManagerCertification: 'CERT-FS-2025-991',
        pestControlContractRef: 'PC-CONTRACT-2026-88',
        ventilationHoodType: 'Type-1 Commercial Extraction Hood',
        hasDishwasherSanitizer: true
      }
    },
    {
      applicationId: 3,
      applicationNumber: 'APP-2026-0003',
      licenseTypeId: 3,
      formType: 'FIRE_SAFETY',
      formVersion: '1.0',
      formData: {
        buildingStructureType: 'Reinforced Concrete Type II',
        occupancyGroup: 'Assembly Group A-2',
        maximumOccupantLoad: 60,
        numberOfExits: 2,
        sprinklerSystemInstalled: true,
        fireExtinguisherCount: 4,
        emergencyExitLightBatteryBackup: true
      }
    },
    {
      applicationId: 4,
      applicationNumber: 'APP-2026-0004',
      licenseTypeId: 1,
      formType: 'GENERAL_TRADE',
      formVersion: '1.0',
      formData: {
        premisesAreaSqFt: 950,
        commercialActivity: 'Boutique Home Goods & Apparel',
        operatingHours: '10:00 - 19:00 Mon-Sat',
        employeeCount: 2,
        waterConnectionRef: 'MUNI-WTR-3419',
        emergencyContactName: 'Marcus Vance',
        emergencyContactPhone: '+1 (555) 234-5678'
      }
    },
    {
      applicationId: 5,
      applicationNumber: 'APP-2026-0005',
      licenseTypeId: 5,
      formType: 'CLINICAL_FACILITY',
      formVersion: '1.0',
      formData: {
        supervisingPharmacistName: 'Dr. Evelyn Reed',
        statePharmacyLicenseNumber: 'PHARM-LIC-44910',
        coldStorageTemperatureRange: '2.0C - 8.0C Monitored',
        hasControlledSubstanceSafe: true,
        sterilizationAutoclaveModel: 'Tuttnauer 2540M',
        biohazardHaulerContract: 'BIO-DISP-MUNI-901'
      }
    }
  ]);

  // 2. Application Documents Metadata
  await ApplicationDocument.insertMany([
    {
      applicationId: 1,
      requirementCode: 'REQ-LEASE',
      originalFilename: 'Hearthstone_Lease_Agreement_Executed.pdf',
      storageKey: 'doc_1_lease_sample.pdf',
      mimeType: 'application/pdf',
      fileSize: 1048576,
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      verificationStatus: 'VERIFIED',
      uploadedBy: 1,
      reviewerId: 2,
      reviewNotes: 'Verified against municipal property cadastre.'
    },
    {
      applicationId: 1,
      requirementCode: 'REQ-ID',
      originalFilename: 'Marcus_Vance_Government_ID.jpg',
      storageKey: 'doc_1_id_sample.jpg',
      mimeType: 'image/jpeg',
      fileSize: 524288,
      checksum: '5d41402abc4b2a76b9719d911017c592',
      verificationStatus: 'VERIFIED',
      uploadedBy: 1,
      reviewerId: 2,
      reviewNotes: 'Identity confirmed.'
    },
    {
      applicationId: 2,
      requirementCode: 'REQ-KITCHEN-PLAN',
      originalFilename: 'Commercial_Kitchen_Layout_Blueprint.pdf',
      storageKey: 'doc_2_kitchen_sample.pdf',
      mimeType: 'application/pdf',
      fileSize: 2097152,
      checksum: '8b1a9953c4611296a827abf8c47804d7',
      verificationStatus: 'PENDING',
      uploadedBy: 1,
      reviewNotes: ''
    },
    {
      applicationId: 2,
      requirementCode: 'REQ-FOOD-CERT',
      originalFilename: 'Food_Safety_Manager_Cert.pdf',
      storageKey: 'doc_2_foodcert_sample.pdf',
      mimeType: 'application/pdf',
      fileSize: 450000,
      checksum: '68eacb97d86f0c4621fa2b0e17cabd8c',
      verificationStatus: 'VERIFIED',
      uploadedBy: 1,
      reviewerId: 2,
      reviewNotes: 'Certified by State Board.'
    },
    {
      applicationId: 4,
      requirementCode: 'REQ-LEASE',
      originalFilename: 'Apex_Draft_Lease.pdf',
      storageKey: 'doc_4_lease_rejected.pdf',
      mimeType: 'application/pdf',
      fileSize: 850000,
      checksum: '9f83c6051f8ce969b4f02e0004598219',
      verificationStatus: 'REJECTED',
      uploadedBy: 1,
      reviewerId: 2,
      reviewNotes: 'Missing landlord signature page on page 6.'
    }
  ]);

  // 3. Detailed Inspection Checklist and Evidence Metadata for MySQL Inspection #1
  await InspectionReport.create({
    inspectionId: 1,
    applicationId: 3,
    inspectorId: 3,
    reportVersion: '1.0',
    checklist: [
      { itemId: 'FIRE-01', title: 'Two unobstructed emergency exit doors leading to public way', status: 'PASS', remarks: 'Clear clearance confirmed.' },
      { itemId: 'FIRE-02', title: 'Illuminated Exit signs with functional battery backup test', status: 'PASS', remarks: 'Tested on battery cut-off.' },
      { itemId: 'FIRE-03', title: 'Commercial fire extinguishers (min 2x 10lb ABC) tagged and serviced', status: 'PASS', remarks: 'Tag date within 30 days.' },
      { itemId: 'FIRE-04', title: 'Hardwired smoke & heat detector coverage across public area', status: 'PASS', remarks: 'Linked to centralized building panel.' },
      { itemId: 'FIRE-05', title: 'Sprinkler head clearance minimum 18 inches from storage', status: 'PASS', remarks: 'Complies with NFPA 13 standard.' }
    ],
    evidenceMetadata: [
      { originalFilename: 'Extinguisher_Inspection_Tag.jpg', storageKey: 'insp_1_ext_tag.jpg', caption: 'Tag dated 2026.02 on kitchen exit cylinder' },
      { originalFilename: 'Exit_Corridor_Clearance.jpg', storageKey: 'insp_1_exit.jpg', caption: 'Rear egress hallway unhindered' }
    ],
    remarks: 'Premises fire safety compliance satisfactory. Ready for final approval.'
  });

  console.log('[MongoDB] Sample data seeded successfully.');
}

if (require.main === module) {
  seedMongo().then(() => {
    mongoose.connection.close();
    process.exit(0);
  }).catch(err => {
    console.error('[MongoDB] Seeding failed:', err);
    process.exit(1);
  });
}

module.exports = seedMongo;

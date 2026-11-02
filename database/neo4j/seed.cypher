// ========================================================
// BizPermit Neo4j Demonstration Graph Seed Data
// ========================================================

// Clear existing graph elements
MATCH (n) DETACH DELETE n;

// 1. Business Categories
CREATE (c1:BusinessCategory {id: 1, code: 'RETAIL', name: 'Retail Outlets & Commercial Trade'})
CREATE (c2:BusinessCategory {id: 2, code: 'FOOD_HOSPITALITY', name: 'Food Establishments & Hospitality'})
CREATE (c3:BusinessCategory {id: 3, code: 'MANUFACTURING', name: 'Manufacturing & Light Industrial'})
CREATE (c4:BusinessCategory {id: 4, code: 'HEALTHCARE', name: 'Health & Clinical Services'})
CREATE (c5:BusinessCategory {id: 5, code: 'LOGISTICS', name: 'Logistics, Warehousing & Fleet'})
CREATE (c6:BusinessCategory {id: 6, code: 'PROFESSIONAL', name: 'Professional & Consulting Services'})

// 2. Departments
CREATE (d1:Department {id: 1, code: 'DCR', name: 'Commercial Regulations & Consumer Affairs'})
CREATE (d2:Department {id: 2, code: 'DPH', name: 'Public Health & Food Sanitation'})
CREATE (d3:Department {id: 3, code: 'FSB', name: 'Municipal Fire & Life Safety Bureau'})
CREATE (d4:Department {id: 4, code: 'BMZ', name: 'Building & Municipal Zoning Bureau'})
CREATE (d5:Department {id: 5, code: 'EPW', name: 'Environmental Protection & Waste Governance'})

// 3. License Types
CREATE (l1:LicenseType {id: 1, code: 'LIC-TRD-001', name: 'General Commercial Trade License', fee: 2500.0, validityMonths: 12, requiresInspection: false})
CREATE (l2:LicenseType {id: 2, code: 'LIC-FOD-002', name: 'Commercial Food Service & Sanitation Permit', fee: 4500.0, validityMonths: 12, requiresInspection: true})
CREATE (l3:LicenseType {id: 3, code: 'LIC-FIR-003', name: 'Municipal Fire Safety & Occupancy Certificate', fee: 3500.0, validityMonths: 12, requiresInspection: true})
CREATE (l4:LicenseType {id: 4, code: 'LIC-IND-004', name: 'Light Industrial & Manufacturing Operating Permit', fee: 15000.0, validityMonths: 24, requiresInspection: true})
CREATE (l5:LicenseType {id: 5, code: 'LIC-MED-005', name: 'Clinical Pharmacy & Medical Facility License', fee: 7500.0, validityMonths: 12, requiresInspection: true})
CREATE (l6:LicenseType {id: 6, code: 'LIC-ENV-006', name: 'Hazardous Materials & Environmental Clearance', fee: 8000.0, validityMonths: 12, requiresInspection: true})
CREATE (l7:LicenseType {id: 7, code: 'LIC-LOG-007', name: 'Commercial Freight & Fleet Operating Permit', fee: 5000.0, validityMonths: 12, requiresInspection: false})

// 4. Document Types
CREATE (doc1:DocumentType {code: 'LEASE_AGREEMENT', name: 'Premises Lease Agreement or Title Deed'})
CREATE (doc2:DocumentType {code: 'ID_PROOF', name: 'Government-Issued Owner Identification'})
CREATE (doc3:DocumentType {code: 'KITCHEN_PLAN', name: 'Commercial Kitchen & Sanitary Blueprint'})
CREATE (doc4:DocumentType {code: 'FOOD_HANDLER_CERT', name: 'Certified Food Handler Certifications'})
CREATE (doc5:DocumentType {code: 'FLOOR_PLAN', name: 'Architectural Egress & Floor Plan'})
CREATE (doc6:DocumentType {code: 'EXTINGUISHER_CERT', name: 'Extinguisher Inspection Certificate'})
CREATE (doc7:DocumentType {code: 'MACHINERY_SPEC', name: 'Machinery Layout & Power Specifications'})
CREATE (doc8:DocumentType {code: 'PHARMACIST_LICENSE', name: 'Head Pharmacist License & Degree'})
CREATE (doc9:DocumentType {code: 'CHEMICAL_MANIFEST', name: 'Hazardous Chemical Inventory Manifest'})
CREATE (doc10:DocumentType {code: 'FLEET_SCHEDULE', name: 'Fleet Vehicle Registrations & Insurance'})

// 5. Requirements
CREATE (r1:Requirement {code: 'REQ-LEASE', title: 'Premises Lease Agreement', isMandatory: true})
CREATE (r2:Requirement {code: 'REQ-ID', title: 'Owner Identity Verification', isMandatory: true})
CREATE (r3:Requirement {code: 'REQ-KITCHEN-PLAN', title: 'Commercial Kitchen Layout', isMandatory: true})
CREATE (r4:Requirement {code: 'REQ-FOOD-CERT', title: 'Food Handler Certification', isMandatory: true})
CREATE (r5:Requirement {code: 'REQ-FLOOR-PLAN', title: 'Emergency Egress Plan', isMandatory: true})
CREATE (r6:Requirement {code: 'REQ-EXTINGUISHER', title: 'Fire Extinguisher Tag', isMandatory: true})
CREATE (r7:Requirement {code: 'REQ-PHARM-DEGREE', title: 'Supervising Pharmacist Board Credential', isMandatory: true})

// 6. Connect LicenseTypes to Departments (HANDLED_BY)
CREATE (l1)-[:HANDLED_BY]->(d1)
CREATE (l2)-[:HANDLED_BY]->(d2)
CREATE (l3)-[:HANDLED_BY]->(d3)
CREATE (l4)-[:HANDLED_BY]->(d4)
CREATE (l5)-[:HANDLED_BY]->(d2)
CREATE (l6)-[:HANDLED_BY]->(d5)
CREATE (l7)-[:HANDLED_BY]->(d1)

// 7. Connect BusinessCategories to LicenseTypes (MAY_REQUIRE)
CREATE (c1)-[:MAY_REQUIRE]->(l1)
CREATE (c1)-[:MAY_REQUIRE]->(l3)

CREATE (c2)-[:MAY_REQUIRE]->(l1)
CREATE (c2)-[:MAY_REQUIRE]->(l2)
CREATE (c2)-[:MAY_REQUIRE]->(l3)

CREATE (c3)-[:MAY_REQUIRE]->(l1)
CREATE (c3)-[:MAY_REQUIRE]->(l3)
CREATE (c3)-[:MAY_REQUIRE]->(l4)
CREATE (c3)-[:MAY_REQUIRE]->(l6)

CREATE (c4)-[:MAY_REQUIRE]->(l1)
CREATE (c4)-[:MAY_REQUIRE]->(l3)
CREATE (c4)-[:MAY_REQUIRE]->(l5)
CREATE (c4)-[:MAY_REQUIRE]->(l6)

CREATE (c5)-[:MAY_REQUIRE]->(l1)
CREATE (c5)-[:MAY_REQUIRE]->(l7)

CREATE (c6)-[:MAY_REQUIRE]->(l1)

// 8. License Dependencies (DEPENDS_ON) - Important signature demonstration
// Commercial Food Permit depends on having General Trade License and Fire Safety Certificate
CREATE (l2)-[:DEPENDS_ON {reason: 'Statutory prerequisite commercial premise authorization'}]->(l1)
CREATE (l2)-[:DEPENDS_ON {reason: 'Mandatory fire evacuation clearance before food preparation'}]->(l3)

// Manufacturing Operating Permit depends on Fire Safety & Environmental Clearance
CREATE (l4)-[:DEPENDS_ON {reason: 'General business compliance baseline'}]->(l1)
CREATE (l4)-[:DEPENDS_ON {reason: 'Industrial fire and life safety egress certification'}]->(l3)
CREATE (l4)-[:DEPENDS_ON {reason: 'Waste and environmental discharge validation'}]->(l6)

// Clinical Pharmacy depends on General Trade License and Fire Safety
CREATE (l5)-[:DEPENDS_ON {reason: 'Commercial trade baseline authorization'}]->(l1)
CREATE (l5)-[:DEPENDS_ON {reason: 'Patient facility safety and occupancy certification'}]->(l3)

// 9. License Requirements & Document Links (NEEDS_DOCUMENT, HAS_REQUIREMENT)
CREATE (l1)-[:NEEDS_DOCUMENT {isMandatory: true}]->(doc1)
CREATE (l1)-[:NEEDS_DOCUMENT {isMandatory: true}]->(doc2)
CREATE (l1)-[:HAS_REQUIREMENT]->(r1)
CREATE (l1)-[:HAS_REQUIREMENT]->(r2)

CREATE (l2)-[:NEEDS_DOCUMENT {isMandatory: true}]->(doc3)
CREATE (l2)-[:NEEDS_DOCUMENT {isMandatory: true}]->(doc4)
CREATE (l2)-[:HAS_REQUIREMENT]->(r3)
CREATE (l2)-[:HAS_REQUIREMENT]->(r4)

CREATE (l3)-[:NEEDS_DOCUMENT {isMandatory: true}]->(doc5)
CREATE (l3)-[:NEEDS_DOCUMENT {isMandatory: true}]->(doc6)
CREATE (l3)-[:HAS_REQUIREMENT]->(r5)
CREATE (l3)-[:HAS_REQUIREMENT]->(r6)

CREATE (l4)-[:NEEDS_DOCUMENT {isMandatory: true}]->(doc7)
CREATE (l5)-[:NEEDS_DOCUMENT {isMandatory: true}]->(doc8)
CREATE (l5)-[:HAS_REQUIREMENT]->(r7)
CREATE (l6)-[:NEEDS_DOCUMENT {isMandatory: true}]->(doc9)
CREATE (l7)-[:NEEDS_DOCUMENT {isMandatory: true}]->(doc10)

// 10. Category Cross-Relations (RELATED_TO)
CREATE (c1)-[:RELATED_TO {relation: 'SUPPLIER_CHAIN'}]->(c5)
CREATE (c2)-[:RELATED_TO {relation: 'EQUIPMENT_SAFETY'}]->(c3)
CREATE (c3)-[:RELATED_TO {relation: 'SUPPLIER_CHAIN'}]->(c5)

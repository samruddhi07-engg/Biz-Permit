// ========================================================
// BizPermit Neo4j Graph Schema & Relationship Metamodel
// ========================================================

// Nodes:
// (:BusinessCategory {id, code, name, description})
// (:LicenseType {id, code, name, fee, validityMonths, requiresInspection})
// (:Department {id, code, name})
// (:DocumentType {code, name})
// (:Requirement {code, title, isMandatory})

// Relationships:
// (:BusinessCategory)-[:MAY_REQUIRE]->(:LicenseType)
// (:LicenseType)-[:DEPENDS_ON {dependencyType: 'PREREQUISITE'}]->(:LicenseType)
// (:LicenseType)-[:HANDLED_BY]->(:Department)
// (:LicenseType)-[:NEEDS_DOCUMENT {isMandatory: boolean}]->(:DocumentType)
// (:LicenseType)-[:HAS_REQUIREMENT]->(:Requirement)
// (:BusinessCategory)-[:RELATED_TO]->(:BusinessCategory)
// (:LicenseType)-[:RELATED_TO]->(:LicenseType)

// Common Working Query 1: Find applicable licenses for a category
// MATCH (c:BusinessCategory {code: $categoryCode})-[:MAY_REQUIRE]->(l:LicenseType)
// OPTIONAL MATCH (l)-[:HANDLED_BY]->(d:Department)
// OPTIONAL MATCH (l)-[:DEPENDS_ON]->(dep:LicenseType)
// RETURN l, d, collect(dep) AS dependencies;

// Common Working Query 2: Find all requirements & documents for a license
// MATCH (l:LicenseType {code: $licenseCode})
// OPTIONAL MATCH (l)-[r:NEEDS_DOCUMENT]->(doc:DocumentType)
// OPTIONAL MATCH (l)-[:HAS_REQUIREMENT]->(req:Requirement)
// RETURN l, collect(doc) AS documents, collect(req) AS requirements;

// Common Working Query 3: Full Graph Visualization (Cytoscape JSON format)
// MATCH (n)
// OPTIONAL MATCH (n)-[r]->(m)
// RETURN n, r, m;

// ========================================================
// BizPermit Neo4j Constraints & Indexes
// ========================================================

CREATE CONSTRAINT unique_biz_cat_code IF NOT EXISTS
FOR (c:BusinessCategory) REQUIRE c.code IS UNIQUE;

CREATE CONSTRAINT unique_license_type_code IF NOT EXISTS
FOR (l:LicenseType) REQUIRE l.code IS UNIQUE;

CREATE CONSTRAINT unique_dept_code IF NOT EXISTS
FOR (d:Department) REQUIRE d.code IS UNIQUE;

CREATE CONSTRAINT unique_doc_type_code IF NOT EXISTS
FOR (doc:DocumentType) REQUIRE doc.code IS UNIQUE;

CREATE CONSTRAINT unique_requirement_code IF NOT EXISTS
FOR (r:Requirement) REQUIRE r.code IS UNIQUE;

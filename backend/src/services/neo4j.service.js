const { runQuery, getDriver } = require('../config/neo4j');

class Neo4jService {
  /**
   * Find applicable licenses and dependencies for a business category
   */
  async findLicensesByCategory(categoryCode) {
    try {
      const cypher = `
        MATCH (c:BusinessCategory {code: $categoryCode})-[:MAY_REQUIRE]->(l:LicenseType)
        OPTIONAL MATCH (l)-[:HANDLED_BY]->(d:Department)
        OPTIONAL MATCH (l)-[depRel:DEPENDS_ON]->(dep:LicenseType)
        OPTIONAL MATCH (l)-[:NEEDS_DOCUMENT]->(doc:DocumentType)
        RETURN l, d, 
               collect(DISTINCT {
                 id: dep.id,
                 code: dep.code, 
                 name: dep.name, 
                 reason: depRel.reason
               }) AS dependencies,
               collect(DISTINCT {
                 code: doc.code, 
                 name: doc.name
               }) AS requiredDocuments
        ORDER BY l.id ASC
      `;
      const records = await runQuery(cypher, { categoryCode });
      return records.map(record => {
        const l = record.get('l').properties;
        const d = record.get('d') ? record.get('d').properties : null;
        const dependencies = record.get('dependencies').filter(dep => dep.code !== null);
        const requiredDocuments = record.get('requiredDocuments').filter(doc => doc.code !== null);
        return {
          license: l,
          department: d,
          dependencies,
          requiredDocuments
        };
      });
    } catch (err) {
      console.warn('[Neo4j Warning in findLicensesByCategory]:', err.message);
      const mysql = require('../config/mysql');
      const rows = await mysql.query(`
        SELECT lt.id, lt.code, lt.name, lt.fee, lt.validity_months AS validityMonths,
               lt.requires_inspection AS requiresInspection, d.id AS deptId, d.name AS deptName
        FROM license_types lt
        JOIN license_type_categories ltc ON lt.id = ltc.license_type_id
        JOIN business_categories bc ON ltc.category_id = bc.id
        LEFT JOIN departments d ON lt.department_id = d.id
        WHERE bc.code = ?
      `, [categoryCode]);
      return rows.map(r => ({
        license: {
          id: r.id,
          code: r.code,
          name: r.name,
          fee: parseFloat(r.fee),
          validityMonths: r.validityMonths,
          requiresInspection: !!r.requiresInspection
        },
        department: r.deptId ? { id: r.deptId, name: r.deptName } : null,
        dependencies: [],
        requiredDocuments: []
      }));
    }
  }

  /**
   * Find single license type graph dependencies and requirements
   */
  async getLicenseRelationships(licenseCode) {
    try {
      const cypher = `
        MATCH (l:LicenseType {code: $licenseCode})
        OPTIONAL MATCH (l)-[:HANDLED_BY]->(d:Department)
        OPTIONAL MATCH (l)-[depRel:DEPENDS_ON]->(dep:LicenseType)
        OPTIONAL MATCH (l)-[:NEEDS_DOCUMENT]->(doc:DocumentType)
        OPTIONAL MATCH (l)-[:HAS_REQUIREMENT]->(req:Requirement)
        OPTIONAL MATCH (cat:BusinessCategory)-[:MAY_REQUIRE]->(l)
        RETURN l, d,
               collect(DISTINCT { id: dep.id, code: dep.code, name: dep.name, reason: depRel.reason }) AS prerequisites,
               collect(DISTINCT { code: doc.code, name: doc.name }) AS documents,
               collect(DISTINCT { code: req.code, title: req.title, isMandatory: req.isMandatory }) AS requirements,
               collect(DISTINCT { id: cat.id, code: cat.code, name: cat.name }) AS applicableCategories
      `;
      const records = await runQuery(cypher, { licenseCode });
      if (records.length === 0) return null;
      const rec = records[0];
      return {
        license: rec.get('l').properties,
        department: rec.get('d') ? rec.get('d').properties : null,
        prerequisites: rec.get('prerequisites').filter(p => p.code !== null),
        documents: rec.get('documents').filter(d => d.code !== null),
        requirements: rec.get('requirements').filter(r => r.code !== null),
        applicableCategories: rec.get('applicableCategories').filter(c => c.code !== null)
      };
    } catch (err) {
      console.warn('[Neo4j Warning in getLicenseRelationships]:', err.message);
      const mysql = require('../config/mysql');
      const rows = await mysql.query(`
        SELECT lt.*, d.name AS department_name
        FROM license_types lt
        LEFT JOIN departments d ON lt.department_id = d.id
        WHERE lt.code = ?
      `, [licenseCode]);
      if (!rows.length) return null;
      const l = rows[0];
      return {
        license: {
          id: l.id,
          code: l.code,
          name: l.name,
          fee: parseFloat(l.fee),
          validityMonths: l.validity_months,
          requiresInspection: !!l.requires_inspection
        },
        department: l.department_id ? { id: l.department_id, name: l.department_name } : null,
        prerequisites: [],
        documents: [],
        requirements: [],
        applicableCategories: []
      };
    }
  }

  /**
   * Return full graph visualization tailored for Cytoscape.js
   */
  async getFullGraph(categoryFilter = null) {
    try {
      let cypher = `
        MATCH (n)
        OPTIONAL MATCH (n)-[r]->(m)
        RETURN n, r, m
      `;
      if (categoryFilter) {
        cypher = `
          MATCH (c:BusinessCategory {code: $categoryFilter})
          MATCH path = (c)-[*1..2]-(m)
          UNWIND nodes(path) AS n
          UNWIND relationships(path) AS r
          RETURN DISTINCT n, r, endNode(r) AS m
        `;
      }

      const records = await runQuery(cypher, { categoryFilter });
      const nodesMap = new Map();
      const edgesList = [];

      records.forEach(record => {
        const n = record.get('n');
        if (n && !nodesMap.has(n.elementId || n.identity.toString())) {
          const id = n.elementId || n.identity.toString();
          const label = n.labels[0];
          nodesMap.set(id, {
            data: {
              id,
              label: n.properties.name || n.properties.title || n.properties.code || id,
              category: label,
              code: n.properties.code || '',
              ...n.properties
            }
          });
        }

        const r = record.get('r');
        const m = record.get('m');
        if (m && !nodesMap.has(m.elementId || m.identity.toString())) {
          const id = m.elementId || m.identity.toString();
          const label = m.labels[0];
          nodesMap.set(id, {
            data: {
              id,
              label: m.properties.name || m.properties.title || m.properties.code || id,
              category: label,
              code: m.properties.code || '',
              ...m.properties
            }
          });
        }

        if (r && n && m) {
          const edgeId = r.elementId || r.identity.toString();
          edgesList.push({
            data: {
              id: edgeId,
              source: n.elementId || n.identity.toString(),
              target: m.elementId || m.identity.toString(),
              label: r.type,
              type: r.type,
              ...r.properties
            }
          });
        }
      });

      if (nodesMap.size > 0) {
        return {
          source: 'neo4j',
          elements: {
            nodes: Array.from(nodesMap.values()),
            edges: edgesList
          }
        };
      }
      throw new Error('Neo4j returned zero graph nodes. Falling back to relational synchronization.');
    } catch (err) {
      console.warn('[Neo4j Warning in getFullGraph]:', err.message);
      // Synchronize full graph from authoritative MySQL tables
      const mysql = require('../config/mysql');
      const nodesMap = new Map();
      const edgesList = [];

      // 1. Business Categories
      const categories = await mysql.query(
        `SELECT id, code, name, description FROM business_categories ${categoryFilter ? 'WHERE code = ?' : ''}`,
        categoryFilter ? [categoryFilter] : []
      );
      categories.forEach(c => {
        const id = `cat_${c.code}`;
        nodesMap.set(id, {
          data: {
            id,
            label: c.name,
            code: c.code,
            category: 'BusinessCategory',
            description: c.description
          }
        });
      });

      // 2. License Types
      let licSql = `
        SELECT lt.id, lt.code, lt.name, lt.fee, lt.validity_months, lt.requires_inspection,
               lt.department_id, d.name AS department_name, d.code AS department_code,
               ltc.category_id, bc.code AS category_code
        FROM license_types lt
        JOIN departments d ON lt.department_id = d.id
        LEFT JOIN license_type_categories ltc ON lt.id = ltc.license_type_id
        LEFT JOIN business_categories bc ON ltc.category_id = bc.id
      `;
      if (categoryFilter) {
        licSql += ' WHERE bc.code = ?';
      }
      const licRows = await mysql.query(licSql, categoryFilter ? [categoryFilter] : []);

      licRows.forEach(l => {
        const licId = `lic_${l.code}`;
        if (!nodesMap.has(licId)) {
          nodesMap.set(licId, {
            data: {
              id: licId,
              label: l.name,
              code: l.code,
              category: 'LicenseType',
              fee: parseFloat(l.fee),
              validityMonths: l.validity_months,
              requiresInspection: Boolean(l.requires_inspection),
              department: l.department_name
            }
          });
        }

        // Department node
        const deptId = `dept_${l.department_code}`;
        if (!nodesMap.has(deptId)) {
          nodesMap.set(deptId, {
            data: {
              id: deptId,
              label: l.department_name,
              code: l.department_code,
              category: 'Department'
            }
          });
        }

        // HANDLED_BY edge
        const deptEdgeId = `edge_${licId}_handledby_${deptId}`;
        if (!edgesList.some(e => e.data.id === deptEdgeId)) {
          edgesList.push({
            data: {
              id: deptEdgeId,
              source: licId,
              target: deptId,
              label: 'HANDLED_BY',
              type: 'HANDLED_BY'
            }
          });
        }

        // MAY_REQUIRE edge from category
        if (l.category_code) {
          const catId = `cat_${l.category_code}`;
          if (nodesMap.has(catId)) {
            const catEdgeId = `edge_${catId}_mayrequire_${licId}`;
            if (!edgesList.some(e => e.data.id === catEdgeId)) {
              edgesList.push({
                data: {
                  id: catEdgeId,
                  source: catId,
                  target: licId,
                  label: 'MAY_REQUIRE',
                  type: 'MAY_REQUIRE'
                }
              });
            }
          }
        }
      });

      // 3. Document Requirements
      const reqRows = await mysql.query(`
        SELECT lr.id, lr.requirement_code, lr.title, lr.document_type, lr.is_mandatory,
               lt.code AS license_code
        FROM license_requirements lr
        JOIN license_types lt ON lr.license_type_id = lt.id
      `);

      reqRows.forEach(r => {
        const licId = `lic_${r.license_code}`;
        if (nodesMap.has(licId)) {
          // DocumentType Node
          const docId = `doc_${r.document_type}`;
          if (!nodesMap.has(docId)) {
            nodesMap.set(docId, {
              data: {
                id: docId,
                label: r.title,
                code: r.document_type,
                category: 'DocumentType'
              }
            });
          }

          // Requirement Node
          const reqNodeId = `req_${r.requirement_code}`;
          if (!nodesMap.has(reqNodeId)) {
            nodesMap.set(reqNodeId, {
              data: {
                id: reqNodeId,
                label: r.title,
                code: r.requirement_code,
                category: 'Requirement',
                isMandatory: Boolean(r.is_mandatory)
              }
            });
          }

          // NEEDS_DOCUMENT edge
          const docEdgeId = `edge_${licId}_needs_${docId}`;
          if (!edgesList.some(e => e.data.id === docEdgeId)) {
            edgesList.push({
              data: {
                id: docEdgeId,
                source: licId,
                target: docId,
                label: 'NEEDS_DOCUMENT',
                type: 'NEEDS_DOCUMENT',
                isMandatory: Boolean(r.is_mandatory)
              }
            });
          }

          // HAS_REQUIREMENT edge
          const reqEdgeId = `edge_${licId}_has_${reqNodeId}`;
          if (!edgesList.some(e => e.data.id === reqEdgeId)) {
            edgesList.push({
              data: {
                id: reqEdgeId,
                source: licId,
                target: reqNodeId,
                label: 'HAS_REQUIREMENT',
                type: 'HAS_REQUIREMENT'
              }
            });
          }
        }
      });

      // 4. Statutory Prerequisites (DEPENDS_ON)
      // Food permit depends on General Trade License & Fire Safety
      // Light Industrial depends on General Trade & Fire Safety & Environmental
      // Clinical Pharmacy depends on General Trade & Fire Safety
      const dependencies = [
        { from: 'lic_LIC-FOD-002', to: 'lic_LIC-TRD-001', reason: 'Statutory commercial premise baseline credential' },
        { from: 'lic_LIC-FOD-002', to: 'lic_LIC-FIR-003', reason: 'Mandatory fire evacuation & kitchen clearance' },
        { from: 'lic_LIC-IND-004', to: 'lic_LIC-TRD-001', reason: 'Commercial manufacturing registration baseline' },
        { from: 'lic_LIC-IND-004', to: 'lic_LIC-FIR-003', reason: 'Industrial egress & fire hydrant certification' },
        { from: 'lic_LIC-IND-004', to: 'lic_LIC-ENV-006', reason: 'Waste effluent and emission compliance' },
        { from: 'lic_LIC-MED-005', to: 'lic_LIC-TRD-001', reason: 'Registered retail trade baseline' },
        { from: 'lic_LIC-MED-005', to: 'lic_LIC-FIR-003', reason: 'Clinical facility occupancy & safety certificate' }
      ];

      dependencies.forEach(dep => {
        if (nodesMap.has(dep.from) && nodesMap.has(dep.to)) {
          const depEdgeId = `edge_${dep.from}_depends_${dep.to}`;
          if (!edgesList.some(e => e.data.id === depEdgeId)) {
            edgesList.push({
              data: {
                id: depEdgeId,
                source: dep.from,
                target: dep.to,
                label: 'DEPENDS_ON',
                type: 'DEPENDS_ON',
                reason: dep.reason
              }
            });
          }
        }
      });

      return {
        source: 'mysql_fallback',
        note: 'Neo4j service offline. Knowledge graph synchronized from authoritative MySQL relational schema.',
        elements: {
          nodes: Array.from(nodesMap.values()),
          edges: edgesList
        }
      };
    }
  }

  /**
   * Synchronize LicenseType master data modifications to Neo4j
   */
  async syncLicenseType(licenseData) {
    try {
      const cypher = `
        MERGE (l:LicenseType {code: $code})
        SET l.id = $id,
            l.name = $name,
            l.fee = $fee,
            l.validityMonths = $validityMonths,
            l.requiresInspection = $requiresInspection
        WITH l
        MATCH (d:Department {id: $departmentId})
        MERGE (l)-[:HANDLED_BY]->(d)
        RETURN l
      `;
      return await runQuery(cypher, {
        code: licenseData.code,
        id: licenseData.id,
        name: licenseData.name,
        fee: parseFloat(licenseData.fee || 0),
        validityMonths: parseInt(licenseData.validity_months || 12, 10),
        requiresInspection: Boolean(licenseData.requires_inspection),
        departmentId: licenseData.department_id
      });
    } catch (err) {
      console.warn('[Neo4j Sync Warning in syncLicenseType]:', err.message);
      return null;
    }
  }

  /**
   * Synchronize BusinessCategory master data to Neo4j
   */
  async syncBusinessCategory(categoryData) {
    try {
      const cypher = `
        MERGE (c:BusinessCategory {code: $code})
        SET c.id = $id,
            c.name = $name
        RETURN c
      `;
      return await runQuery(cypher, {
        code: categoryData.code,
        id: categoryData.id,
        name: categoryData.name
      });
    } catch (err) {
      console.warn('[Neo4j Sync Warning in syncBusinessCategory]:', err.message);
      return null;
    }
  }

  /**
   * Synchronize Department master data to Neo4j
   */
  async syncDepartment(deptData) {
    try {
      const cypher = `
        MERGE (d:Department {code: $code})
        SET d.id = $id,
            d.name = $name
        RETURN d
      `;
      return await runQuery(cypher, {
        code: deptData.code,
        id: deptData.id,
        name: deptData.name
      });
    } catch (err) {
      console.warn('[Neo4j Sync Warning in syncDepartment]:', err.message);
      return null;
    }
  }
}

module.exports = new Neo4jService();

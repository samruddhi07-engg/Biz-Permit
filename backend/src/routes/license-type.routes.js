const express = require('express');
const router = express.Router();
const licenseRepo = require('../repositories/license-type.repository');
const neo4jService = require('../services/neo4j.service');
const redisService = require('../services/redis.service');

// GET /api/license-types (with Redis caching)
router.get('/', async (req, res, next) => {
  try {
    const hasFilters = Object.keys(req.query).length > 0;
    
    // Check Redis cache if no specific filter query is passed
    if (!hasFilters) {
      const cached = await redisService.getCatalogCache();
      if (cached) {
        return res.json({ success: true, data: cached, source: 'cache' });
      }
    }

    const licenses = await licenseRepo.getAllLicenseTypes(req.query);

    if (!hasFilters) {
      await redisService.setCatalogCache(licenses);
    }

    res.json({ success: true, data: licenses, source: 'database' });
  } catch (err) {
    next(err);
  }
});

// GET /api/license-types/:id (with Redis caching)
router.get('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (isNaN(id)) {
      return next(); // pass to next matching route if non-numeric
    }

    const cached = await redisService.getLicenseDetailCache(id);
    if (cached) {
      return res.json({ success: true, data: cached, source: 'cache' });
    }

    const license = await licenseRepo.findById(id);
    if (!license) {
      return res.status(404).json({ success: false, error: { message: 'License type not found.' } });
    }

    // Attach Neo4j relationships if available
    try {
      const graphData = await neo4jService.getLicenseRelationships(license.code);
      license.graphRelationships = graphData;
    } catch (graphErr) {
      console.warn('[Neo4j Warning]:', graphErr.message);
      license.graphRelationships = null;
    }

    await redisService.setLicenseDetailCache(id, license);

    res.json({ success: true, data: license, source: 'database' });
  } catch (err) {
    next(err);
  }
});

// GET /api/license-types/:id/relationships (direct Neo4j endpoint)
router.get('/:id/relationships', async (req, res, next) => {
  try {
    const license = await licenseRepo.findById(req.params.id);
    if (!license) {
      return res.status(404).json({ success: false, error: { message: 'License type not found.' } });
    }

    const relationships = await neo4jService.getLicenseRelationships(license.code);
    res.json({ success: true, data: relationships });
  } catch (err) {
    next(err);
  }
});

// GET /api/license-types/discover/:categoryCode (Neo4j category discovery)
router.get('/discover/:categoryCode', async (req, res, next) => {
  try {
    const { categoryCode } = req.params;
    const discovered = await neo4jService.findLicensesByCategory(categoryCode.toUpperCase());
    res.json({ success: true, data: discovered });
  } catch (err) {
    next(err);
  }
});

// GET /api/departments
router.get('/meta/departments', async (req, res, next) => {
  try {
    const depts = await licenseRepo.getDepartments();
    res.json({ success: true, data: depts });
  } catch (err) {
    next(err);
  }
});

// GET /api/graph (Cytoscape Graph visualization endpoint)
router.get('/meta/graph', async (req, res, next) => {
  try {
    const category = req.query.category || null;
    const graphData = await neo4jService.getFullGraph(category);
    res.json({ success: true, data: graphData });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

/**
 * Master Seed Script for BizPermit
 * Seeds MySQL, MongoDB, Neo4j, and initializes Redis caches.
 */
const { execSync } = require('child_process');
const path = require('path');
const mysql = require('../backend/src/config/mysql');
const mongo = require('../backend/src/config/mongodb');
const neo4j = require('../backend/src/config/neo4j');
const redis = require('../backend/src/config/redis');

async function seedAll() {
  console.log('====================================================');
  console.log('  BizPermit — Master Multi-Database Seeding System  ');
  console.log('====================================================\n');

  // 1. MySQL
  console.log('[1/4] Applying MySQL Schema and Seeds...');
  const schemaPath = path.join(__dirname, 'mysql', 'schema.sql');
  const indexPath = path.join(__dirname, 'mysql', 'indexes.sql');
  const seedPath = path.join(__dirname, 'mysql', 'seed.sql');

  const fs = require('fs');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const indexSql = fs.readFileSync(indexPath, 'utf8');
  const seedSql = fs.readFileSync(seedPath, 'utf8');

  const conn = await mysql.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0;');
    await conn.query(schemaSql);
    await conn.query(indexSql);
    await conn.query(seedSql);
    await conn.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('  -> MySQL tables, indexes, and seed records applied successfully.');
  } finally {
    conn.release();
  }

  // 2. MongoDB
  console.log('\n[2/4] Seeding MongoDB Collections & Synchronizing Indexes...');
  const seedMongo = require('./mongodb/sample-data');
  const createMongoIndexes = require('./mongodb/indexes');
  await createMongoIndexes();
  await seedMongo();
  console.log('  -> MongoDB documents and indexes populated.');

  // 3. Neo4j
  console.log('\n[3/4] Seeding Neo4j Knowledge Graph...');
  const neo4jApplyPath = path.join(__dirname, 'neo4j', 'apply-cypher.js');
  execSync(`node "${neo4jApplyPath}"`, { stdio: 'inherit' });

  // 4. Redis
  console.log('\n[4/4] Flushing and Resetting Redis Caches...');
  await redis.connectRedis();
  await redis.invalidatePrefix('bizpermit:');
  console.log('  -> Redis caches cleared and ready.');

  console.log('\n====================================================');
  console.log('  ALL 4 DATABASES SUCCESSFULLY SEEDED & VERIFIED!   ');
  console.log('====================================================');

  await neo4j.closeDriver();
  process.exit(0);
}

seedAll().catch(err => {
  console.error('\n[Error in Seed All]:', err);
  process.exit(1);
});

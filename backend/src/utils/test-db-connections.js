const mysqlConfig = require('../config/mysql');
const mongoConfig = require('../config/mongodb');
const neo4jConfig = require('../config/neo4j');
const redisConfig = require('../config/redis');

async function testAll() {
  console.log('Testing all 4 Database Connections...');
  
  const mysqlRes = await mysqlConfig.testConnection();
  console.log('MySQL:', mysqlRes);

  const mongoRes = await mongoConfig.testConnection();
  console.log('MongoDB:', mongoRes);

  const neo4jRes = await neo4jConfig.testConnection();
  console.log('Neo4j:', neo4jRes);

  const redisRes = await redisConfig.testConnection();
  console.log('Redis:', redisRes);

  await neo4jConfig.closeDriver();
  process.exit(0);
}

testAll().catch(err => {
  console.error('Test script failure:', err);
  process.exit(1);
});

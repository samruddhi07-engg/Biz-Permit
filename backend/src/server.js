const app = require('./app');
const { connectMongoDB } = require('./config/mongodb');
const { connectRedis } = require('./config/redis');
const { testConnection: testMySQL } = require('./config/mysql');
const { testConnection: testNeo4j } = require('./config/neo4j');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

async function startServer() {
  console.log('====================================================');
  console.log('  BizPermit — Smart Business License Management     ');
  console.log('====================================================\n');
  console.log('Starting services and verifying 4-way database integration...\n');

  try {
    // 1. MySQL
    const mysqlStatus = await testMySQL();
    console.log(`[MySQL]    Host: ${process.env.MYSQL_HOST || 'localhost'}:${process.env.MYSQL_PORT || 3306} -> ${mysqlStatus.status.toUpperCase()}`);

    // 2. MongoDB
    await connectMongoDB();
    console.log(`[MongoDB]  URI: ${process.env.MONGODB_URI || 'mongodb://localhost:27018/bizpermit_db'} -> CONNECTED`);

    // 3. Neo4j
    const neo4jStatus = await testNeo4j();
    console.log(`[Neo4j]    URI: ${process.env.NEO4J_URI || 'bolt://localhost:7687'} -> ${neo4jStatus.status.toUpperCase()} (${neo4jStatus.version || ''})`);

    // 4. Redis
    await connectRedis();
    console.log(`[Redis]    URL: ${process.env.REDIS_URL || 'redis://127.0.0.1:6379'} -> READY`);

    // Start HTTP Server
    app.listen(PORT, () => {
      console.log(`\n====================================================`);
      console.log(`  BizPermit Server running live on port ${PORT}`);
      console.log(`  Application URL: http://localhost:${PORT}`);
      console.log(`  Health Endpoint: http://localhost:${PORT}/api/health`);
      console.log(`====================================================\n`);
    });

  } catch (err) {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  }
}

startServer();

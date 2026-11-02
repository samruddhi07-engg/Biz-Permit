const neo4j = require('neo4j-driver');
require('dotenv').config();

const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
const user = process.env.NEO4J_USER || 'neo4j';
const password = process.env.NEO4J_PASSWORD || 'civicconnect2025';

let driver = null;

function getDriver() {
  if (!driver) {
    driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      maxConnectionPoolSize: 50,
      connectionTimeout: 5000
    });
  }
  return driver;
}

async function runQuery(cypher, params = {}) {
  const currentDriver = getDriver();
  const session = currentDriver.session();
  try {
    const result = await session.run(cypher, params);
    return result.records;
  } finally {
    await session.close();
  }
}

async function testConnection() {
  try {
    const currentDriver = getDriver();
    const serverInfo = await currentDriver.getServerInfo();
    return { status: 'healthy', database: 'Neo4j', version: serverInfo.agent };
  } catch (err) {
    return { status: 'error', database: 'Neo4j', error: err.message };
  }
}

async function closeDriver() {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

module.exports = {
  getDriver,
  runQuery,
  testConnection,
  closeDriver
};

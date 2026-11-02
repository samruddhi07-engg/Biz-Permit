const fs = require('fs');
const path = require('path');
const { runQuery, closeDriver } = require('../../backend/src/config/neo4j');

async function applyCypherFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  // Split statements by semicolon, skipping comments
  const lines = content.split('\n');
  const cleanStatements = [];
  let currentStmt = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed === '') continue;
    currentStmt += ' ' + trimmed;
    if (trimmed.endsWith(';')) {
      cleanStatements.push(currentStmt.replace(/;$/, '').trim());
      currentStmt = '';
    }
  }
  if (currentStmt.trim()) {
    cleanStatements.push(currentStmt.trim());
  }

  for (const stmt of cleanStatements) {
    if (!stmt) continue;
    try {
      await runQuery(stmt);
    } catch (err) {
      console.warn(`[Neo4j Cypher Warning on "${stmt.substring(0, 40)}..."]:`, err.message);
    }
  }
}

async function main() {
  console.log('[Neo4j] Applying constraints...');
  await applyCypherFile(path.join(__dirname, 'constraints.cypher'));

  console.log('[Neo4j] Applying seed graph data...');
  await applyCypherFile(path.join(__dirname, 'seed.cypher'));

  // Test query
  const res = await runQuery('MATCH (n) RETURN count(n) AS nodeCount');
  console.log('[Neo4j] Total Graph Nodes:', res[0].get('nodeCount').toNumber());

  const edgeRes = await runQuery('MATCH ()-[r]->() RETURN count(r) AS edgeCount');
  console.log('[Neo4j] Total Graph Relationships:', edgeRes[0].get('edgeCount').toNumber());

  await closeDriver();
  console.log('[Neo4j] Cypher seed successfully completed.');
  process.exit(0);
}

main().catch(err => {
  console.error('[Neo4j] Setup error:', err);
  process.exit(1);
});

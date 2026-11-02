/**
 * BizPermit - MongoDB Index Setup Script
 */
const {
  connectMongoDB,
  ApplicationFormResponse,
  ApplicationDocument,
  InspectionReport,
  mongoose
} = require('../../backend/src/config/mongodb');

async function createIndexes() {
  await connectMongoDB();
  console.log('[MongoDB] Synchronizing model indexes...');

  await ApplicationFormResponse.syncIndexes();
  await ApplicationDocument.syncIndexes();
  await InspectionReport.syncIndexes();

  console.log('[MongoDB] All collection indexes successfully synchronized and active.');
}

if (require.main === module) {
  createIndexes().then(() => {
    mongoose.connection.close();
    process.exit(0);
  }).catch(err => {
    console.error('[MongoDB] Index synchronization failed:', err);
    process.exit(1);
  });
}

module.exports = createIndexes;

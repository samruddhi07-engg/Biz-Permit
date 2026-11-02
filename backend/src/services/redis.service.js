const redisConfig = require('../config/redis');

class RedisService {
  constructor() {
    this.TTL = {
      CATALOG: 600,       // 10 minutes
      LICENSE_DETAIL: 300,// 5 minutes
      ADMIN_DASHBOARD: 60,// 60 seconds
      OWNER_DASHBOARD: 60,// 60 seconds
      OTP_VERIFY: 300,    // 5 minutes
      GRAPH_CACHE: 300    // 5 minutes
    };
  }

  // 1. License Catalog
  async getCatalogCache() {
    return await redisConfig.getCache('bizpermit:license-catalog:v1');
  }

  async setCatalogCache(catalogData) {
    return await redisConfig.setCache('bizpermit:license-catalog:v1', catalogData, this.TTL.CATALOG);
  }

  async invalidateCatalogCache() {
    console.log('[Redis Cache] Invalidating catalog cache...');
    return await redisConfig.delCache('bizpermit:license-catalog:v1');
  }

  // 2. License Detail
  async getLicenseDetailCache(licenseId) {
    return await redisConfig.getCache(`bizpermit:license:${licenseId}:details`);
  }

  async setLicenseDetailCache(licenseId, detailData) {
    return await redisConfig.setCache(`bizpermit:license:${licenseId}:details`, detailData, this.TTL.LICENSE_DETAIL);
  }

  async invalidateLicenseDetailCache(licenseId) {
    console.log(`[Redis Cache] Invalidating detail cache for license ${licenseId}...`);
    return await redisConfig.delCache(`bizpermit:license:${licenseId}:details`);
  }

  // 3. Admin Dashboard
  async getAdminDashboardCache() {
    return await redisConfig.getCache('bizpermit:dashboard:admin');
  }

  async setAdminDashboardCache(dashboardData) {
    return await redisConfig.setCache('bizpermit:dashboard:admin', dashboardData, this.TTL.ADMIN_DASHBOARD);
  }

  async invalidateAdminDashboardCache() {
    console.log('[Redis Cache] Invalidating admin dashboard cache...');
    return await redisConfig.delCache('bizpermit:dashboard:admin');
  }

  // 4. Owner Dashboard
  async getOwnerDashboardCache(userId) {
    return await redisConfig.getCache(`bizpermit:dashboard:owner:${userId}`);
  }

  async setOwnerDashboardCache(userId, dashboardData) {
    return await redisConfig.setCache(`bizpermit:dashboard:owner:${userId}`, dashboardData, this.TTL.OWNER_DASHBOARD);
  }

  async invalidateOwnerDashboardCache(userId) {
    console.log(`[Redis Cache] Invalidating owner dashboard cache for user ${userId}...`);
    return await redisConfig.delCache(`bizpermit:dashboard:owner:${userId}`);
  }

  // 5. Verification Token / OTP
  async setVerificationCode(email, code) {
    return await redisConfig.setCache(`bizpermit:verify:${email}`, { code, createdAt: Date.now() }, this.TTL.OTP_VERIFY);
  }

  async getVerificationCode(email) {
    return await redisConfig.getCache(`bizpermit:verify:${email}`);
  }

  async clearVerificationCode(email) {
    return await redisConfig.delCache(`bizpermit:verify:${email}`);
  }

  // Invalidate all dashboards when application workflow progresses
  async invalidateWorkflowCaches(ownerId = null) {
    await this.invalidateAdminDashboardCache();
    if (ownerId) {
      await this.invalidateOwnerDashboardCache(ownerId);
    } else {
      await redisConfig.invalidatePrefix('bizpermit:dashboard:owner:');
    }
  }

  // Invalidate all catalog & license items
  async invalidateAllLicenseCaches() {
    await this.invalidateCatalogCache();
    await redisConfig.invalidatePrefix('bizpermit:license:');
  }
}

module.exports = new RedisService();

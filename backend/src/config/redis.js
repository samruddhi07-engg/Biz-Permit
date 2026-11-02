const { createClient } = require('redis');
require('dotenv').config();

const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const client = createClient({ url });

let isConnected = false;

client.on('connect', () => {
  isConnected = true;
  console.log('[Redis] Connected successfully to ' + url);
});

client.on('error', (err) => {
  console.warn('[Redis] Connection error/warning:', err.message);
  isConnected = false;
});

async function connectRedis() {
  if (!client.isOpen) {
    try {
      await client.connect();
      isConnected = true;
    } catch (err) {
      console.warn('[Redis] Could not connect to Redis, operating in fallback mode:', err.message);
      isConnected = false;
    }
  }
  return client;
}

// Safe helpers with fallback
async function getCache(key) {
  if (!isConnected && !client.isOpen) return null;
  try {
    const val = await client.get(key);
    return val ? JSON.parse(val) : null;
  } catch (err) {
    console.warn('[Redis] getCache error:', err.message);
    return null;
  }
}

async function setCache(key, value, ttlSeconds = 300) {
  if (!isConnected && !client.isOpen) return false;
  try {
    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
    return true;
  } catch (err) {
    console.warn('[Redis] setCache error:', err.message);
    return false;
  }
}

async function delCache(key) {
  if (!isConnected && !client.isOpen) return false;
  try {
    await client.del(key);
    return true;
  } catch (err) {
    console.warn('[Redis] delCache error:', err.message);
    return false;
  }
}

async function invalidatePrefix(prefix) {
  if (!isConnected && !client.isOpen) return false;
  try {
    const keys = await client.keys(`${prefix}*`);
    if (keys.length > 0) {
      await client.del(keys);
    }
    return true;
  } catch (err) {
    console.warn('[Redis] invalidatePrefix error:', err.message);
    return false;
  }
}

async function testConnection() {
  try {
    if (!client.isOpen) {
      await client.connect();
    }
    const pong = await client.ping();
    return { status: 'healthy', database: 'Redis', response: pong };
  } catch (err) {
    return { status: 'error', database: 'Redis', error: err.message };
  }
}

module.exports = {
  client,
  connectRedis,
  getCache,
  setCache,
  delCache,
  invalidatePrefix,
  testConnection
};

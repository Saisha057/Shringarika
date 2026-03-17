import { createClient } from 'redis';

let redisClient = null;
let isConnected = false;

export const connectRedis = async () => {
  try {
    if (!process.env.REDIS_URL) {
      console.log('⚠️  Redis not configured - caching disabled');
      return null;
    }

    redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('❌ Redis connection failed after 10 retries');
            return new Error('Redis connection failed');
          }
          return retries * 100;
        }
      }
    });

    redisClient.on('error', (err) => console.error('Redis Client Error:', err));
    redisClient.on('connect', () => console.log('🔄 Redis connecting...'));
    redisClient.on('ready', () => {
      isConnected = true;
      console.log('✅ Redis connected successfully');
    });
    redisClient.on('end', () => {
      isConnected = false;
      console.log('⚠️  Redis connection closed');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('❌ Redis connection error:', error.message);
    return null;
  }
};

export const getRedisClient = () => {
  return isConnected ? redisClient : null;
};

// Cache helper functions
export const cacheGet = async (key) => {
  try {
    if (!isConnected || !redisClient) return null;
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Redis GET error:', error);
    return null;
  }
};

export const cacheSet = async (key, value, ttl = 3600) => {
  try {
    if (!isConnected || !redisClient) return false;
    await redisClient.setEx(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('Redis SET error:', error);
    return false;
  }
};

export const cacheDel = async (key) => {
  try {
    if (!isConnected || !redisClient) return false;
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error('Redis DEL error:', error);
    return false;
  }
};

export const cacheFlush = async (pattern) => {
  try {
    if (!isConnected || !redisClient) return false;
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
    return true;
  } catch (error) {
    console.error('Redis FLUSH error:', error);
    return false;
  }
};

export default { connectRedis, getRedisClient, cacheGet, cacheSet, cacheDel, cacheFlush };

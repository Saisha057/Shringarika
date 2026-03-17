import { cacheGet, cacheSet } from '../config/redis.js';

// Cache middleware for GET requests
export const cacheMiddleware = (duration = 300) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = `cache:${req.originalUrl || req.url}`;

    try {
      const cachedData = await cacheGet(key);
      
      if (cachedData) {
        return res.json(cachedData);
      }

      // Store original res.json
      const originalJson = res.json.bind(res);

      // Override res.json to cache the response
      res.json = (body) => {
        // Cache the response
        cacheSet(key, body, duration).catch(err => 
          console.error('Cache set error:', err)
        );
        
        // Send the response
        return originalJson(body);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
};

// Invalidate cache for specific patterns
export const invalidateCache = async (pattern) => {
  try {
    const { cacheFlush } = await import('../config/redis.js');
    await cacheFlush(pattern);
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
};

export default cacheMiddleware;

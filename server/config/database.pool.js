import pg from 'pg';
const { Pool } = pg;

/**
 * PostgreSQL Connection Pool for high-performance database access
 * Manages multiple database connections efficiently
 */

let pool = null;

export const createDatabasePool = () => {
  if (pool) {
    return pool;
  }

  const config = {
    connectionString: process.env.DATABASE_URL,
    
    // Connection pool settings
    min: parseInt(process.env.DB_POOL_MIN) || 2,
    max: parseInt(process.env.DB_POOL_MAX) || 10,
    
    // Connection timeout (30 seconds)
    connectionTimeoutMillis: 30000,
    
    // Idle timeout (30 seconds - release connection if idle)
    idleTimeoutMillis: 30000,
    
    // Maximum time a client can remain checked out (60 seconds)
    maxUses: 7500,
    
    // Enable keep-alive
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    
    // SSL configuration for production
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : false,
  };

  pool = new Pool(config);

  // Handle pool errors
  pool.on('error', (err, client) => {
    console.error('❌ Unexpected error on idle client', err);
  });

  // Handle pool connection
  pool.on('connect', (client) => {
    console.log('✅ New database connection established');
  });

  // Handle pool removal
  pool.on('remove', (client) => {
    console.log('🗑️  Database connection removed from pool');
  });

  console.log(`✅ Database connection pool created (min: ${config.min}, max: ${config.max})`);

  return pool;
};

/**
 * Get a client from the pool
 */
export const getPoolClient = async () => {
  if (!pool) {
    pool = createDatabasePool();
  }
  return await pool.connect();
};

/**
 * Execute a query using the pool
 */
export const query = async (text, params) => {
  if (!pool) {
    pool = createDatabasePool();
  }
  
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log(`🔍 Query executed in ${duration}ms`);
    return res;
  } catch (error) {
    console.error('❌ Database query error:', error);
    throw error;
  }
};

/**
 * Close the pool (use on server shutdown)
 */
export const closeDatabasePool = async () => {
  if (pool) {
    await pool.end();
    console.log('✅ Database connection pool closed');
    pool = null;
  }
};

/**
 * Get pool statistics
 */
export const getPoolStats = () => {
  if (!pool) {
    return null;
  }

  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
};

export default {
  createDatabasePool,
  getPoolClient,
  query,
  closeDatabasePool,
  getPoolStats
};

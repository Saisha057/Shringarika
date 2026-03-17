import { createDatabasePool } from './config/database.pool.js';

export const runMigration = async () => {
    console.log('🔄 MIGRATION: Starting auto-migration...');
    // Ensure pool is created/retrieved
    const pool = createDatabasePool(); 
    
    // Commands to add columns
    const queries = [
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;`,
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;`,
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS archived_reason TEXT DEFAULT NULL;`,
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS archived_by TEXT DEFAULT NULL;`,
        `UPDATE orders SET is_archived = false WHERE is_archived IS NULL;`
    ];

    let client;
    try {
        client = await connectWithRetry(pool); 
        if (!client) {
             console.error('❌ MIGRATION: Could not get client from pool');
             return;
        }

        for (const q of queries) {
            try {
                await client.query(q);
                console.log(`✅ MIGRATION: Executed ${q.substring(0,40)}...`);
            } catch(e) {
                 // Ignore if "column already exists" - though IF NOT EXISTS handles it 
                 console.log(`⚠️ MIGRATION: Query warning/error: ${e.message}`);
            }
        }
        console.log('✅ MIGRATION: Complete sequence finished.');
    } catch (err) {
        console.error('❌ MIGRATION: CRITICAL FAILURE', err);
    } finally {
        if (client) client.release();
    }
};

async function connectWithRetry(pool, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await pool.connect();
        } catch (err) {
            console.log(`⚠️ Pool connect failed (attempt ${i + 1}/${retries}): ${err.message}`);
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    return null;
}

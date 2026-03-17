import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function executeSQL(client, filePath, description) {
  try {
    console.log(`\n📝 ${description}...`);
    
    const sqlContent = fs.readFileSync(filePath, 'utf8');
    
    // Execute SQL
    await client.query(sqlContent);
    
    console.log(`✅ ${description} completed!`);
    return true;
  } catch (error) {
    console.error(`❌ Error in ${description}:`, error.message);
    // Log first few lines of error for context
    if (error.position) {
      console.error(`   Position: ${error.position}`);
    }
    return false;
  }
}

async function testConnection() {
  const client = await pool.connect();
  try {
    console.log('🔌 Testing database connection...');
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ Database connected successfully!');
    console.log(`   Time: ${result.rows[0].current_time}`);
    console.log(`   PostgreSQL Version: ${result.rows[0].pg_version.split(',')[0]}\n`);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  } finally {
    client.release();
  }
}

async function checkExistingTables(client) {
  try {
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    if (result.rows.length > 0) {
      console.log(`\n⚠️  Found ${result.rows.length} existing tables:`);
      result.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
      return true;
    } else {
      console.log('\n✓ No existing tables found. Fresh database!');
      return false;
    }
  } catch (error) {
    console.error('Error checking tables:', error.message);
    return false;
  }
}

async function setupDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 SHRINGARIKA DATABASE SETUP');
    console.log('═════════════════════════════════════════\n');
    console.log('📦 Database URL:', process.env.SUPABASE_URL);
    console.log('═════════════════════════════════════════');
    
    // Test connection
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Cannot connect to database');
    }
    
    // Check existing tables
    const hasExisting = await checkExistingTables(client);
    
    if (hasExisting) {
      console.log('\n⚠️  WARNING: Existing tables found!');
      console.log('   This will DROP all existing tables and recreate them.');
      console.log('   All data will be LOST!\n');
      
      // In production, you would want to confirm here
      // For now, we'll proceed automatically
      console.log('🗑️  Dropping existing tables...');
      await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
      console.log('✅ Existing tables dropped!\n');
    }
    
    // Execute schema files in order
    const schemaFile = join(__dirname, 'database', 'complete-schema.sql');
    const rlsFile = join(__dirname, 'database', 'row-level-security.sql');
    const seedFile = join(__dirname, 'database', 'seed-data.sql');
    
    console.log('\n📋 Executing database setup scripts...');
    console.log('═════════════════════════════════════════');
    
    // 1. Create tables and indexes
    const schemaSuccess = await executeSQL(
      client,
      schemaFile,
      'Creating tables, indexes, and triggers'
    );
    
    if (!schemaSuccess) {
      throw new Error('Schema creation failed');
    }
    
    // 2. Apply Row-Level Security
    const rlsSuccess = await executeSQL(
      client,
      rlsFile,
      'Applying Row-Level Security policies'
    );
    
    if (!rlsSuccess) {
      console.log('⚠️  RLS setup had issues, but continuing...');
    }
    
    // 3. Insert seed data
    const seedSuccess = await executeSQL(
      client,
      seedFile,
      'Inserting seed data (categories, products, etc.)'
    );
    
    if (!seedSuccess) {
      console.log('⚠️  Seed data had issues, but database structure is ready');
    }
    
    // Verify tables
    const finalCheck = await client.query(`
      SELECT 
        COUNT(*) as table_count,
        (SELECT COUNT(*) FROM categories) as category_count,
        (SELECT COUNT(*) FROM products) as product_count,
        (SELECT COUNT(*) FROM users) as user_count
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `);
    
    console.log('\n═════════════════════════════════════════');
    console.log('✅ DATABASE SETUP COMPLETED!');
    console.log('═════════════════════════════════════════');
    console.log(`📊 Total Tables: ${finalCheck.rows[0].table_count}`);
    console.log(`📂 Categories: ${finalCheck.rows[0].category_count}`);
    console.log(`🛍️  Products: ${finalCheck.rows[0].product_count}`);
    console.log(`👥 Users: ${finalCheck.rows[0].user_count}`);
    console.log('═════════════════════════════════════════\n');
    
    console.log('🎯 NEXT STEPS:');
    console.log('1. Run: node setup-admin.mjs (to create admin user)');
    console.log('2. Start backend: node server.js');
    console.log('3. Start frontend: npm run dev\n');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ DATABASE SETUP FAILED!');
    console.error('Error:', error.message);
    console.error('\nPlease check:');
    console.error('1. Database connection string in .env');
    console.error('2. Database permissions');
    console.error('3. SQL syntax in schema files\n');
    return false;
  } finally {
    client.release();
  }
}

// Main execution
(async () => {
  try {
    const success = await setupDatabase();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();

import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const { Client } = pg;

const client = new Client({
  host: 'aws-0-ap-south-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.srdljxbumxkgjxoqqrzs',
  password: 'Shringarika@2024',
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const migrationPath = join(__dirname, 'migrations', '012_add_image_to_order_items.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Running migration 012_add_image_to_order_items.sql...');
    await client.query(sql);
    
    console.log('✅ Migration 012 applied successfully!');
    console.log('✅ Added image_url column to order_items table');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();

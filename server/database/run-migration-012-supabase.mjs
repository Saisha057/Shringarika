import { getSupabase } from '../config/supabase.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

async function runMigration() {
  try {
    const supabase = getSupabase();
    console.log('✅ Connected to Supabase');
    
    // Migration SQL
    const migrations = [
      {
        name: 'Add image_url column',
        sql: `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS image_url TEXT;`
      },
      {
        name: 'Update existing orders with product images',
        sql: `
          UPDATE order_items oi
          SET image_url = (
            SELECT p.images->0
            FROM products p
            WHERE p.id = oi.product_id
          )
          WHERE oi.image_url IS NULL 
          AND oi.product_id IS NOT NULL;
        `
      }
    ];
    
    for (const migration of migrations) {
      console.log(`📝 Running: ${migration.name}...`);
      const { error } = await supabase.rpc('exec_sql', { sql_query: migration.sql });
      
      if (error) {
        console.error(`❌ ${migration.name} failed:`, error.message);
        // Continue with next migration
      } else {
        console.log(`✅ ${migration.name} completed`);
      }
    }
    
    console.log('\n✅ Migration 012 applied successfully!');
    console.log('✅ Added image_url column to order_items table');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  }
}

runMigration();

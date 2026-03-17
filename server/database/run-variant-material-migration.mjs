/**
 * Migration: Add material and price_modifier columns to product_inventory
 * 
 * This script adds support for variant-specific materials and price adjustments.
 */

import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from parent directory
dotenv.config({ path: path.join(__dirname, '../.env') });

// Use the existing DATABASE_URL from .env
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL not found in .env file');
  process.exit(1);
}

console.log('🔧 ADDING material AND price_modifier COLUMNS TO product_inventory');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function runMigration() {
  const client = new Client({
    connectionString: connectionString,
  });

  try {
    console.log('📡 Connecting to database...');
    await client.connect();
    console.log('✅ Connected\n');

    console.log('Step 1: Adding material column...');
    const materialResult = await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'product_inventory' AND column_name = 'material'
        ) THEN
          ALTER TABLE product_inventory ADD COLUMN material VARCHAR(100);
          RAISE NOTICE '✅ Added material column to product_inventory';
        ELSE
          RAISE NOTICE '⏭️ material column already exists';
        END IF;
      END $$;
    `);
    console.log('✅ material column check completed');

    console.log('\nStep 2: Adding price_modifier column...');
    const priceResult = await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'product_inventory' AND column_name = 'price_modifier'
        ) THEN
          ALTER TABLE product_inventory ADD COLUMN price_modifier DECIMAL(10, 2) DEFAULT 0;
          RAISE NOTICE '✅ Added price_modifier column to product_inventory';
        ELSE
          RAISE NOTICE '⏭️ price_modifier column already exists';
        END IF;
      END $$;
    `);
    console.log('✅ price_modifier column check completed');

    console.log('\nStep 3: Adding index for material searches...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_product_inventory_material 
      ON product_inventory(material) 
      WHERE material IS NOT NULL;
    `);
    console.log('✅ Index created');

    console.log('\nStep 4: Adding column comments...');
    await client.query(`
      COMMENT ON COLUMN product_inventory.material IS 'Variant-specific material type (e.g., Cotton, Silk, Polyester)';
    `);
    await client.query(`
      COMMENT ON COLUMN product_inventory.price_modifier IS 'Price adjustment for this variant (can be positive or negative)';
    `);
    console.log('✅ Comments added');

    console.log('\nStep 5: Verifying columns...');
    const verifyResult = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        character_maximum_length,
        column_default,
        is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'product_inventory' 
      AND column_name IN ('material', 'price_modifier')
      ORDER BY ordinal_position;
    `);

    console.log('\n📊 Column verification:');
    verifyResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}${row.character_maximum_length ? `(${row.character_maximum_length})` : ''}, default: ${row.column_default || 'NULL'}, nullable: ${row.is_nullable}`);
    });

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📊 You can now use material and price_modifier fields in variants.');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Details:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n📡 Database connection closed');
  }
}

runMigration();


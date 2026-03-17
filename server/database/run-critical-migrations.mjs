/**
 * Run Critical Migrations 012 & 013
 * 
 * This script executes the critical migrations needed to fix:
 * 1. Make variant_id nullable in order_items table
 * 2. Add variants to existing products
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔧 RUNNING CRITICAL MIGRATIONS');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function runMigration(migrationFile) {
  console.log(`\n📋 Running: ${migrationFile}`);
  console.log('─'.repeat(50));
  
  const filePath = path.join(__dirname, 'migrations', migrationFile);
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return false;
  }
  
  const sql = fs.readFileSync(filePath, 'utf8');
  
  // Split SQL by semicolons (basic approach)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  console.log(`Found ${statements.length} SQL statements\n`);
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    
    // Skip comments and SELECT statements (verification queries)
    if (statement.startsWith('--') || statement.toUpperCase().startsWith('SELECT')) {
      continue;
    }
    
    try {
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: statement });
      
      if (error) {
        console.error(`❌ Error:`, error.message);
        return false;
      }
      
      console.log(`✅ Success`);
    } catch (error) {
      console.error(`❌ Exception:`, error.message);
      return false;
    }
  }
  
  console.log(`\n✅ Migration ${migrationFile} completed successfully`);
  return true;
}

async function verifyChanges() {
  console.log('\n\n🔍 VERIFYING CHANGES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Check if variant_id is now nullable
  console.log('1. Checking order_items.variant_id nullability...');
  const { data: columns, error: colError } = await supabase
    .from('information_schema.columns')
    .select('column_name, is_nullable')
    .eq('table_name', 'order_items')
    .eq('column_name', 'variant_id')
    .single();
  
  if (colError) {
    console.error('❌ Could not verify column:', colError.message);
  } else {
    console.log(`   variant_id is_nullable: ${columns?.is_nullable || 'unknown'}`);
    console.log(`   ${columns?.is_nullable === 'YES' ? '✅ NOW NULLABLE' : '❌ STILL NOT NULL'}`);
  }
  
  // Check product_inventory count
  console.log('\n2. Checking product_inventory variants...');
  const { count: variantCount, error: countError } = await supabase
    .from('product_inventory')
    .select('*', { count: 'exact', head: true });
  
  if (countError) {
    console.error('❌ Could not count variants:', countError.message);
  } else {
    console.log(`   Total variants: ${variantCount}`);
    console.log(`   ${variantCount > 0 ? '✅ VARIANTS EXIST' : '⚠️  NO VARIANTS YET'}`);
  }
  
  // Check products count
  console.log('\n3. Checking products...');
  const { count: productCount, error: prodError } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true });
  
  if (prodError) {
    console.error('❌ Could not count products:', prodError.message);
  } else {
    console.log(`   Total products: ${productCount}`);
  }
}

async function main() {
  try {
    console.log('🌐 Connected to:', process.env.SUPABASE_URL);
    console.log('\n');
    
    // Migration 012: Make variant_id nullable
    const migration012Success = await runMigration('012_fix_order_items_variant_nullable.sql');
    
    if (!migration012Success) {
      console.error('\n❌ Migration 012 failed. Stopping.');
      process.exit(1);
    }
    
    // Migration 013: Add variants to products
    const migration013Success = await runMigration('013_add_variants_to_existing_products.sql');
    
    if (!migration013Success) {
      console.error('\n❌ Migration 013 failed.');
      process.exit(1);
    }
    
    // Verify changes
    await verifyChanges();
    
    console.log('\n\n🎉 ALL MIGRATIONS COMPLETED SUCCESSFULLY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('✅ Next steps:');
    console.log('   1. Restart backend server');
    console.log('   2. Place a test order');
    console.log('   3. Verify order_items are created\n');
    
  } catch (error) {
    console.error('\n❌ MIGRATION FAILED:', error.message);
    process.exit(1);
  }
}

main();

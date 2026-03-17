/**
 * Migration: Convert color = '' (empty string) to NULL in product_inventory
 * 
 * Root cause: SQL COALESCE(color, 'default') only handles NULL not empty string.
 * Passing p_color='default' never matched rows where color='', causing:
 *   "Product variant not available: AROHI COLLECTION (Size: S)"
 * 
 * Fix: Normalize all empty-string color values to NULL so COALESCE works correctly.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixColorEmptyStrings() {
  console.log('🔧 Migration: Fixing empty-string colors in product_inventory...\n');

  // Step 1: Fetch all inventory rows with empty string color
  const { data: emptyColorRows, error: fetchError } = await supabase
    .from('product_inventory')
    .select('id, product_id, size, color, stock')
    .eq('color', '');

  if (fetchError) {
    console.error('❌ Failed to fetch rows:', fetchError.message);
    process.exit(1);
  }

  console.log(`📊 Found ${emptyColorRows?.length || 0} rows with color = '' (empty string)`);

  if (!emptyColorRows || emptyColorRows.length === 0) {
    console.log('✅ No empty-string color rows found. Checking NULL rows...');
    
    // Also show current state
    const { data: allRows } = await supabase
      .from('product_inventory')
      .select('id, product_id, size, color, stock, is_active');
    
    console.log('\n📋 Current product_inventory contents:');
    allRows?.forEach(row => {
      console.log(`  - ID: ${row.id} | Size: ${row.size} | Color: ${JSON.stringify(row.color)} | Stock: ${row.stock} | Active: ${row.is_active}`);
    });
    
    console.log('\n✅ Migration not needed (no empty-string colors found).');
    console.log('💡 If orders still fail, the inventory rows may be missing entirely.');
    return;
  }

  // Step 2: Update each row
  let fixed = 0;
  let failed = 0;

  for (const row of emptyColorRows) {
    console.log(`  🔄 Fixing row ${row.id} (size: ${row.size}, color: '${row.color}' → null)`);
    
    const { error: updateError } = await supabase
      .from('product_inventory')
      .update({ color: null })
      .eq('id', row.id);

    if (updateError) {
      console.error(`  ❌ Failed to update row ${row.id}:`, updateError.message);
      failed++;
    } else {
      console.log(`  ✅ Fixed row ${row.id}`);
      fixed++;
    }
  }

  console.log(`\n📊 Migration complete: ${fixed} fixed, ${failed} failed`);

  // Step 3: Verify the fix
  const { data: verifyRows } = await supabase
    .from('product_inventory')
    .select('id, product_id, size, color, stock, is_active');

  console.log('\n📋 Updated product_inventory contents:');
  verifyRows?.forEach(row => {
    console.log(`  - ID: ${row.id} | Size: ${row.size} | Color: ${JSON.stringify(row.color)} | Stock: ${row.stock} | Active: ${row.is_active}`);
  });

  if (fixed > 0) {
    console.log(`\n✅ SUCCESS: ${fixed} inventory rows normalized (color '' → null).`);
    console.log('   Now COALESCE(color, \'default\') = COALESCE(null, \'default\') = \'default\'');
    console.log('   This matches p_color=\'default\' in the SQL functions. Orders should now work!');
  }
}

fixColorEmptyStrings().catch(err => {
  console.error('💥 Migration failed:', err.message);
  process.exit(1);
});

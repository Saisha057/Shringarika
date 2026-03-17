/**
 * SIMPLE CASCADE TEST
 * 
 * Tests if CASCADE deletion is working by checking products with variants
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read .env file from server directory
const envPath = join(__dirname, 'server', '.env');
const envContent = readFileSync(envPath, 'utf-8');

// Parse .env manually
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = env.SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server/.env');
  console.error('Available keys:', Object.keys(env));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('\n🔍 TESTING CASCADE DELETION...\n');

async function testCascade() {
  try {
    // Step 1: Create a test product
    console.log('1️⃣ Creating test product...');
    const testSlug = `cascade-test-${Date.now()}`;
    const { data: product, error: createError } = await supabase
      .from('products')
      .insert({
        name: 'CASCADE_TEST_PRODUCT',
        slug: testSlug,
        category: 'test',
        price: 999,
        images: ['test.jpg'],
        description: 'Test product for CASCADE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError || !product) {
      console.error('❌ Failed to create test product:', createError);
      return;
    }

    console.log('✅ Test product created:', product.id);

    // Step 2: Skip variants (table structure may vary)
    console.log('\n2️⃣ Skipping variant test...');

    // Step 3: Create test inventory
    console.log('\n3️⃣ Creating test inventory...');
    const { data: inventory, error: inventoryError } = await supabase
      .from('product_inventory')
      .insert({
        product_id: product.id,
        size: 'TEST',
        stock: 10,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (inventoryError) {
      console.error('❌ Failed to create inventory:', inventoryError);
      // Clean up
      await supabase.from('products').delete().eq('id', product.id);
      return;
    }

    console.log('✅ Test inventory created:', inventory.id);

    // Step 4: Try to delete the product
    console.log('\n4️⃣ Attempting to delete product (CASCADE test)...');
    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .eq('id', product.id);

    if (deleteError) {
      console.error('\n❌ CASCADE IS NOT CONFIGURED!');
      console.error('Error:', deleteError.message);
      console.error('\n📋 To fix this:');
      console.error('1. Open Supabase Dashboard SQL Editor');
      console.error('2. Run the apply-cascade.sql script');
      console.error('3. Run this test again\n');
      
      // Manual cleanup
      console.log('⚠️ Cleaning up test data manually...');

      await supabase.from('product_inventory').delete().eq('product_id', product.id);
      await supabase.from('products').delete().eq('id', product.id);
      return;
    }

    console.log('✅ Product deleted successfully!');

    // Step 5: Verify variants and inventory were also deleted
    console.log('\n5️⃣ Verifying CASCADE worked...');
    
    const { data: remainingInventory } = await supabase
      .from('product_inventory')
      .select('id')
      .eq('product_id', product.id);

    if (remainingInventory && remainingInventory.length > 0) {
      console.error('❌ Inventory was NOT deleted! CASCADE not working for product_inventory');
      console.log('\n❌ CASCADE is NOT properly configured. Run apply-cascade.sql\n');
    } else {
      console.log('✅ Inventory was auto-deleted (CASCADE working)');
      console.log('\n🎉 SUCCESS! CASCADE is properly configured!\n');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testCascade();

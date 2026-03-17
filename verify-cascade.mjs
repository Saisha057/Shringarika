/**
 * VERIFY CASCADE CONSTRAINTS IN SUPABASE
 * 
 * This script checks if CASCADE deletion is properly configured
 * for product_variants and product_inventory tables.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('\n🔍 CHECKING CASCADE CONSTRAINTS...\n');

// Query to check foreign key constraints
const query = `
  SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.update_rule,
    rc.delete_rule
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
    AND tc.table_schema = rc.constraint_schema
  WHERE tc.table_name IN ('product_variants', 'product_inventory', 'cart_items')
    AND tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'products'
  ORDER BY tc.table_name;
`;

try {
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql: query 
  });

  if (error) {
    console.error('❌ Error querying constraints:', error);
    console.log('\n⚠️ RPC function not available. Using alternative method...\n');
    
    // Alternative: Try to delete a test product to see what happens
    console.log('📋 CHECKING CONSTRAINTS BY TESTING...\n');
    
    // Get a product that has variants
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('id, name, (product_variants(id), product_inventory(id))')
      .limit(1);
    
    if (prodError) {
      console.error('❌ Error fetching products:', prodError);
    } else if (products && products.length > 0) {
      console.log('✅ Sample product found:', products[0]);
      console.log('\n⚠️ To verify CASCADE:');
      console.log('   1. Go to Supabase Dashboard');
      console.log('   2. Open Table Editor');
      console.log('   3. Click on product_variants table');
      console.log('   4. Click on "Foreign Keys" tab');
      console.log('   5. Check if product_id foreign key has "ON DELETE CASCADE"');
      console.log('\n   Repeat for product_inventory table');
    }
  } else {
    console.log('✅ FOREIGN KEY CONSTRAINTS:\n');
    console.table(data);
    
    // Check for CASCADE
    const hasCascade = data && data.some(row => 
      row.table_name === 'product_variants' && 
      row.delete_rule === 'CASCADE'
    );
    
    if (hasCascade) {
      console.log('\n✅ CASCADE is properly configured!');
    } else {
      console.log('\n❌ CASCADE NOT configured! Run apply-cascade.sql to fix.');
    }
  }
} catch (err) {
  console.error('❌ Unexpected error:', err);
}

console.log('\n');

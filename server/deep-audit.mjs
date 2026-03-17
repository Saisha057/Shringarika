import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deepAudit() {
  console.log('🔍 === DEEP DATABASE AUDIT ===\n');

  const issues = [];
  const warnings = [];

  // 1. Check critical table structures
  console.log('📋 PHASE 1: Inspecting Table Structures\n');

  // Check users table for auth compatibility
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('*')
    .limit(1);

  if (users && users.length > 0) {
    const userColumns = Object.keys(users[0]);
    console.log('✅ Users table columns:', userColumns.join(', '));
    
    const requiredUserCols = ['id', 'email', 'role'];
    requiredUserCols.forEach(col => {
      if (!userColumns.includes(col)) {
        issues.push(`CRITICAL: users table missing "${col}" column`);
      }
    });
  }

  // Check orders table structure
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('*')
    .limit(1);

  if (orders && orders.length > 0) {
    const orderColumns = Object.keys(orders[0]);
    console.log('✅ Orders table columns:', orderColumns.join(', '));
    
    // Check for guest order support
    if (!orderColumns.includes('guest_uuid') && !orderColumns.includes('guest_email')) {
      warnings.push('Orders table may not support guest orders properly');
    }
    
    // Check for return/exchange support
    if (!orderColumns.includes('can_return') && !orderColumns.includes('return_window_expires')) {
      warnings.push('Orders table missing return/exchange tracking columns');
    }
  }

  // Check products table
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('*')
    .limit(1);

  if (products && products.length > 0) {
    const productColumns = Object.keys(products[0]);
    console.log('✅ Products table columns:', productColumns.join(', '));
    
    // Check for stock tracking
    if (!productColumns.includes('stock_quantity') && !productColumns.includes('quantity')) {
      warnings.push('Products table may need stock_quantity column or use inventory table');
    }
  }

  // 2. Check for orphaned data
  console.log('\n📋 PHASE 2: Checking for Orphaned Data\n');

  // Check orders without order_items
  const { data: ordersWithoutItems, error: oiError } = await supabase
    .from('orders')
    .select('id, order_number')
    .not('id', 'in', `(SELECT DISTINCT order_id FROM order_items WHERE order_id IS NOT NULL)`);

  if (!oiError && ordersWithoutItems && ordersWithoutItems.length > 0) {
    warnings.push(`Found ${ordersWithoutItems.length} orders without order_items`);
    console.log(`⚠️  ${ordersWithoutItems.length} orders have no items`);
  } else {
    console.log('✅ All orders have order_items');
  }

  // Check products without categories
  const { data: productsWithoutCategories, error: pcError } = await supabase
    .from('products')
    .select('id, name, category_id')
    .is('category_id', null);

  if (!pcError && productsWithoutCategories && productsWithoutCategories.length > 0) {
    warnings.push(`Found ${productsWithoutCategories.length} products without categories`);
    console.log(`⚠️  ${productsWithoutCategories.length} products missing category`);
  }

  // 3. Check for data inconsistencies
  console.log('\n📋 PHASE 3: Checking Data Consistency\n');

  // Check if order totals match order_items sum
  const { data: allOrders } = await supabase
    .from('orders')
    .select('id, order_number, total_amount');

  if (allOrders) {
    for (const order of allOrders.slice(0, 5)) {
      const { data: items } = await supabase
        .from('order_items')
        .select('total_price')
        .eq('order_id', order.id);

      if (items && items.length > 0) {
        const itemsTotal = items.reduce((sum, item) => sum + parseFloat(item.total_price || 0), 0);
        const orderTotal = parseFloat(order.total_amount || 0);
        
        if (Math.abs(itemsTotal - orderTotal) > 1) {
          warnings.push(`Order ${order.order_number} total mismatch: items=${itemsTotal}, order=${orderTotal}`);
        }
      }
    }
  }

  // 4. Check product-inventory relationship
  console.log('\n📋 PHASE 4: Checking Inventory System\n');

  const { data: allProducts } = await supabase
    .from('products')
    .select('id, name');

  if (allProducts) {
    let productsWithInventory = 0;
    let productsWithoutInventory = 0;

    for (const product of allProducts) {
      const { data: inv } = await supabase
        .from('inventory')
        .select('quantity')
        .eq('product_id', product.id);

      if (inv && inv.length > 0) {
        productsWithInventory++;
      } else {
        productsWithoutInventory++;
      }
    }

    console.log(`✅ Products with inventory: ${productsWithInventory}`);
    console.log(`⚠️  Products without inventory: ${productsWithoutInventory}`);

    if (productsWithoutInventory > 0) {
      warnings.push(`${productsWithoutInventory} products don't have inventory records`);
    }
  }

  // 5. Check for missing indexes (via query performance)
  console.log('\n📋 PHASE 5: Performance Checks\n');
  
  const start = Date.now();
  const { data: ordersByUser } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', (await supabase.from('users').select('id').limit(1)).data?.[0]?.id);
  const elapsed = Date.now() - start;
  
  console.log(`Query time for orders by user_id: ${elapsed}ms`);
  if (elapsed > 100) {
    warnings.push('Slow query on orders.user_id - check index');
  }

  // 6. Check RLS policies by testing restricted access
  console.log('\n📋 PHASE 6: RLS Policy Checks\n');

  // Create anon client (no auth)
  const anonClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  // Test if anon can read products (should be allowed)
  const { data: anonProducts, error: anonProdError } = await anonClient
    .from('products')
    .select('*')
    .limit(1);

  if (anonProdError) {
    issues.push(`CRITICAL: Anonymous users cannot read products - ${anonProdError.message}`);
    console.log('❌ Products not publicly readable');
  } else {
    console.log('✅ Products publicly readable');
  }

  // Test if anon can insert products (should be denied)
  const { error: anonInsertError } = await anonClient
    .from('products')
    .insert({ name: 'Test Product', slug: 'test-' + Date.now(), price: 100 });

  if (!anonInsertError) {
    issues.push('CRITICAL: Anonymous users CAN insert products (security risk!)');
    console.log('❌ Products writable by anonymous users - SECURITY ISSUE');
    
    // Clean up test product
    await supabase
      .from('products')
      .delete()
      .eq('name', 'Test Product');
  } else {
    console.log('✅ Products properly protected from anonymous writes');
  }

  // Test if anon can read other users' orders
  const { data: anonOrders, error: anonOrderError } = await anonClient
    .from('orders')
    .select('*')
    .limit(1);

  if (!anonOrderError && anonOrders && anonOrders.length > 0) {
    issues.push('CRITICAL: Anonymous users can read all orders - privacy violation!');
    console.log('❌ Orders readable by anonymous users - SECURITY ISSUE');
  } else {
    console.log('✅ Orders properly protected');
  }

  // 7. Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 AUDIT SUMMARY');
  console.log('='.repeat(60));
  
  console.log(`\n🔴 CRITICAL ISSUES (${issues.length}):`);
  if (issues.length === 0) {
    console.log('   None found ✅');
  } else {
    issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
  }

  console.log(`\n⚠️  WARNINGS (${warnings.length}):`);
  if (warnings.length === 0) {
    console.log('   None found ✅');
  } else {
    warnings.forEach((warning, i) => {
      console.log(`   ${i + 1}. ${warning}`);
    });
  }

  console.log('\n' + '='.repeat(60));

  return { issues, warnings };
}

deepAudit().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

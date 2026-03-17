import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🧪 PHASE 1.5: VERIFICATION TESTS');
console.log('================================\n');

async function runTests() {
  
  // ================================================
  // TEST 1: Verify product_variants exist
  // ================================================
  console.log('📊 TEST 1: Checking product variants...\n');
  
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name');

  if (productsError) {
    console.error('❌ Error fetching products:', productsError.message);
    return;
  }

  console.log(`Found ${products.length} products\n`);

  let productsWithVariants = 0;
  let productsWithoutVariants = 0;

  for (const product of products) {
    const { data: variants, error: variantsError } = await supabase
      .from('product_variants')
      .select('id, size, color, stock_quantity, sku')
      .eq('product_id', product.id);

    if (variantsError) {
      console.error(`❌ Error fetching variants for ${product.name}:`, variantsError.message);
      continue;
    }

    if (variants && variants.length > 0) {
      productsWithVariants++;
      console.log(`✅ ${product.name}`);
      console.log(`   Variants: ${variants.length}`);
      variants.forEach(v => {
        console.log(`   - ${v.size || 'N/A'} / ${v.color || 'N/A'} - Stock: ${v.stock_quantity} - SKU: ${v.sku}`);
      });
    } else {
      productsWithoutVariants++;
      console.log(`❌ ${product.name}`);
      console.log(`   NO VARIANTS FOUND`);
    }
    console.log('');
  }

  console.log('─────────────────────────────────────');
  console.log(`Products with variants: ${productsWithVariants}`);
  console.log(`Products without variants: ${productsWithoutVariants}`);
  console.log('─────────────────────────────────────\n');

  // ================================================
  // TEST 2: Verify order_items exist for recent orders
  // ================================================
  console.log('📊 TEST 2: Checking order items...\n');

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, order_number, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (ordersError) {
    console.error('❌ Error fetching orders:', ordersError.message);
    return;
  }

  console.log(`Checking last ${orders.length} orders\n`);

  let ordersWithItems = 0;
  let ordersWithoutItems = 0;

  for (const order of orders) {
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('id, product_name, quantity, unit_price')
      .eq('order_id', order.id);

    if (itemsError) {
      console.error(`❌ Error fetching items for ${order.order_number}:`, itemsError.message);
      continue;
    }

    const orderDate = new Date(order.created_at).toLocaleString();

    if (items && items.length > 0) {
      ordersWithItems++;
      console.log(`✅ ${order.order_number} (${orderDate})`);
      console.log(`   Items: ${items.length}`);
      items.forEach(item => {
        console.log(`   - ${item.product_name} x ${item.quantity} @ ₹${item.unit_price}`);
      });
    } else {
      ordersWithoutItems++;
      console.log(`❌ ${order.order_number} (${orderDate})`);
      console.log(`   NO ITEMS FOUND (ORPHANED ORDER)`);
    }
    console.log('');
  }

  console.log('─────────────────────────────────────');
  console.log(`Orders with items: ${ordersWithItems}`);
  console.log(`Orders without items: ${ordersWithoutItems}`);
  console.log('─────────────────────────────────────\n');

  // ================================================
  // TEST 3: Check order_items constraints
  // ================================================
  console.log('📊 TEST 3: Checking order_items table constraints...\n');

  // Try to query order_items table structure (this is informational)
  const { data: sampleItem, error: sampleError } = await supabase
    .from('order_items')
    .select('*')
    .limit(1);

  if (sampleError && sampleError.code !== 'PGRST116') {
    console.log('⚠️  Cannot query order_items table:', sampleError.message);
  } else {
    console.log('✅ order_items table is queryable');
    if (sampleItem && sampleItem.length > 0) {
      console.log('✅ Sample order_item found');
      console.log('   Columns:', Object.keys(sampleItem[0]).join(', '));
    } else {
      console.log('⚠️  order_items table exists but is empty');
    }
  }
  console.log('');

  // ================================================
  // FINAL SUMMARY
  // ================================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   PHASE 1.5 VERIFICATION SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const allProductsHaveVariants = productsWithoutVariants === 0;
  const allOrdersHaveItems = ordersWithoutItems === 0;

  console.log('✅ GOAL: All products have variants');
  console.log(`   Status: ${allProductsHaveVariants ? '✅ ACHIEVED' : '❌ NOT YET'}`);
  console.log(`   Result: ${productsWithVariants}/${products.length} products have variants\n`);

  console.log('✅ GOAL: New orders have order_items');
  console.log(`   Status: ${allOrdersHaveItems ? '✅ ACHIEVED' : '⚠️  PENDING'}`);
  console.log(`   Result: ${ordersWithItems}/${orders.length} recent orders have items`);
  console.log(`   Note: Old orders (28 orphaned) remain unfixed - create NEW test order\n`);

  if (allProductsHaveVariants && ordersWithItems > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   🎉 PHASE 1.5 COMPLETE!');
    console.log('   ✅ Ready for Phase 2 cleanup');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } else {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   ⚠️  PHASE 1.5 INCOMPLETE');
    console.log('   📋 NEXT STEPS:');
    
    if (!allProductsHaveVariants) {
      console.log('   1. Run migration 013 in Supabase SQL Editor');
      console.log('      (Add variants to existing products)');
    }
    
    if (ordersWithoutItems === orders.length) {
      console.log('   2. Run migration 012 in Supabase SQL Editor');
      console.log('      (Make variant_id nullable)');
      console.log('   3. Restart backend server (new code with logging)');
      console.log('   4. Create a NEW test order');
      console.log('   5. Re-run this verification script');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
}

runTests().catch(console.error);

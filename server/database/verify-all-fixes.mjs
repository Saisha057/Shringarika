import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { initializeSupabase } from '../config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function verifyFixes() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ VERIFYING ALL FIXES APPLIED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const { supabaseAdmin } = initializeSupabase();
    
    let allGood = true;

    // 1. Check product_inventory has data
    console.log('1️⃣ Checking product_inventory table...');
    const { count: inventoryCount, error: inventoryError } = await supabaseAdmin
      .from('product_inventory')
      .select('*', { count: 'exact', head: true });

    if (inventoryError) {
      console.log('   ❌ Error querying product_inventory:', inventoryError.message);
      allGood = false;
    } else if (inventoryCount === 0) {
      console.log('   ❌ product_inventory is EMPTY - No variants available!');
      allGood = false;
    } else {
      console.log(`   ✅ product_inventory has ${inventoryCount} variants`);
    }

    // 2. Check product_variants status (should be empty or not exist)
    console.log('\n2️⃣ Checking product_variants table...');
    const { count: variantsCount, error: variantsError } = await supabaseAdmin
      .from('product_variants')
      .select('*', { count: 'exact', head: true });

    if (variantsError) {
      if (variantsError.message.includes('does not exist')) {
        console.log('   ✅ product_variants table dropped (good - was duplicate)');
      } else {
        console.log('   ⚠️  Error:', variantsError.message);
      }
    } else if (variantsCount === 0) {
      console.log('   ⚠️  product_variants exists but is empty (recommend dropping)');
      console.log('      Run: DROP TABLE product_variants CASCADE;');
    } else {
      console.log(`   ❌ product_variants has ${variantsCount} rows - should be dropped!`);
      allGood = false;
    }

    // 3. Test variant fetch (simulating what Order.model.js does)
    console.log('\n3️⃣ Testing variant fetch (as Order.model.js does)...');
    const { data: testVariants, error: testError } = await supabaseAdmin
      .from('product_inventory')
      .select('id, size, color, stock')
      .limit(1);

    if (testError) {
      console.log('   ❌ Error fetching from product_inventory:', testError.message);
      allGood = false;
    } else if (testVariants && testVariants.length > 0) {
      console.log('   ✅ Successfully fetched variant from product_inventory');
      console.log(`      ID: ${testVariants[0].id}`);
      console.log(`      Size: ${testVariants[0].size || 'N/A'}`);
      console.log(`      Color: ${testVariants[0].color || 'N/A'}`);
    } else {
      console.log('   ❌ No variants found in product_inventory');
      allGood = false;
    }

    // 4. Check products have inventory
    console.log('\n4️⃣ Checking products have inventory...');
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, name')
      .limit(5);

    if (products && products.length > 0) {
      for (const product of products) {
        const { count: productInventoryCount } = await supabaseAdmin
          .from('product_inventory')
          .select('*', { count: 'exact', head: true })
          .eq('product_id', product.id);

        if (productInventoryCount > 0) {
          console.log(`   ✅ ${product.name}: ${productInventoryCount} variant(s)`);
        } else {
          console.log(`   ⚠️  ${product.name}: NO VARIANTS - orders will fail!`);
          allGood = false;
        }
      }
    }

    // 5. Check unnecessary tables
    console.log('\n5️⃣ Checking unnecessary tables...');
    const unnecessaryTables = ['reviews', 'addresses', 'coupons'];
    
    for (const table of unnecessaryTables) {
      const { error } = await supabaseAdmin
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error && error.message.includes('does not exist')) {
        console.log(`   ✅ ${table} - Dropped (good cleanup)`);
      } else {
        console.log(`   ⚠️  ${table} - Still exists (optional cleanup recommended)`);
      }
    }

    // Final summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (allGood) {
      console.log('✅ ALL CRITICAL FIXES VERIFIED!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      console.log('🎯 READY FOR TESTING:\n');
      console.log('   1. Navigate to http://localhost:3000');
      console.log('   2. Browse products and select a variant');
      console.log('   3. Add to cart and complete checkout');
      console.log('   4. Verify order_items are created\n');
      
      console.log('📊 Expected Results:');
      console.log('   • Order completes successfully');
      console.log('   • Backend logs: "✅ Successfully inserted X order items"');
      console.log('   • Database: New rows in order_items table');
      console.log('   • Frontend: Order shows in history with items\n');
      
    } else {
      console.log('⚠️  SOME ISSUES DETECTED');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      console.log('Please review the warnings above.\n');
      console.log('Critical issues must be fixed before testing.\n');
    }

    // Show current database state
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 CURRENT DATABASE STATE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const { count: productsCount } = await supabaseAdmin
      .from('products')
      .select('*', { count: 'exact', head: true });

    const { count: ordersCount } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true });

    const { count: orderItemsCount } = await supabaseAdmin
      .from('order_items')
      .select('*', { count: 'exact', head: true });

    console.log(`📦 Products: ${productsCount}`);
    console.log(`🎨 Product Inventory: ${inventoryCount} variants`);
    console.log(`📦 Orders: ${ordersCount}`);
    console.log(`📦 Order Items: ${orderItemsCount}`);
    
    if (ordersCount > 0 && orderItemsCount === 0) {
      console.log('\n⚠️  WARNING: All existing orders are orphaned (no items)');
      console.log('   This is expected - they were created before the fix.');
      console.log('   New orders will work correctly.\n');
    }

  } catch (err) {
    console.error('❌ Fatal error:', err);
  }
}

verifyFixes().catch(console.error);

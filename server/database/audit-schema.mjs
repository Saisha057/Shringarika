import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 PHASE 1: COMPREHENSIVE SCHEMA AUDIT (READ-ONLY)');
console.log('================================================\n');

const results = {
  tables: [],
  functions: [],
  triggers: [],
  foreignKeys: [],
  constraints: [],
  policies: [],
  problems: [],
  indexes: [],
  storage: []
};

// Helper to run raw SQL
async function runQuery(query, description) {
  console.log(`\n📊 ${description}...`);
  try {
    const { data, error } = await supabase.rpc('exec_sql', { query });
    if (error) {
      // Fallback: try direct query
      const { data: directData, error: directError } = await supabase
        .from('_sql_query')
        .select('*')
        .limit(0);
      
      if (directError) {
        console.log(`⚠️  Could not execute: ${directError.message}`);
        return null;
      }
      return directData;
    }
    console.log(`✅ Retrieved ${data?.length || 0} results`);
    return data;
  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
    return null;
  }
}

async function audit() {
  
  // ================================================
  // SECTION 1: ALL TABLES
  // ================================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SECTION 1: TABLE INVENTORY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const tables = [
    'users', 'products', 'orders', 'order_items', 'product_variants',
    'carts', 'cart_items', 'reviews', 'wishlists', 'wishlist_items',
    'categories', 'coupons', 'addresses', 'notifications',
    'support_tickets', 'support_messages', 'stock_history',
    'analytics_events', 'sessions', 'api_keys', 'audit_logs',
    'exports', 'backups'
  ];

  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ ${table}: ERROR - ${error.message}`);
        results.tables.push({
          name: table,
          exists: false,
          error: error.message
        });
      } else {
        console.log(`✅ ${table}: ${count} rows`);
        results.tables.push({
          name: table,
          exists: true,
          rowCount: count,
          classification: 'PENDING'
        });
      }
    } catch (err) {
      console.log(`❌ ${table}: EXCEPTION - ${err.message}`);
      results.tables.push({
        name: table,
        exists: false,
        error: err.message
      });
    }
  }

  // ================================================
  // SECTION 2: FOREIGN KEY ANALYSIS
  // ================================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SECTION 2: FOREIGN KEY RELATIONSHIPS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const fkQuery = `
    SELECT
      tc.constraint_name,
      tc.table_name AS from_table,
      kcu.column_name AS from_column,
      ccu.table_name AS to_table,
      ccu.column_name AS to_column
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name;
  `;

  console.log('Note: Foreign key queries require direct database access.');
  console.log('Run AUDIT_PHASE1_QUERIES.sql in Supabase SQL Editor for full FK map.\n');

  // ================================================
  // SECTION 3: CLASSIFICATION
  // ================================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SECTION 3: TABLE CLASSIFICATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const classifications = {
    KEEP: [
      { table: 'users', reason: 'Core user management' },
      { table: 'products', reason: 'Core product catalog' },
      { table: 'orders', reason: 'Core order management' },
      { table: 'order_items', reason: 'Order line items' },
      { table: 'product_variants', reason: 'Product sizes/colors' },
      { table: 'carts', reason: 'Shopping cart persistence' },
      { table: 'cart_items', reason: 'Cart line items' },
      { table: 'reviews', reason: 'Product reviews' },
      { table: 'wishlists', reason: 'User wishlists' },
      { table: 'wishlist_items', reason: 'Wishlist items' },
      { table: 'addresses', reason: 'User shipping addresses' },
      { table: 'coupons', reason: 'Discount codes' },
    ],
    INVESTIGATE: [
      { table: 'categories', reason: 'Check if products use this' },
      { table: 'notifications', reason: 'Verify notification system active' },
      { table: 'support_tickets', reason: 'Check usage frequency' },
      { table: 'support_messages', reason: 'Check usage frequency' },
      { table: 'stock_history', reason: 'Verify stock tracking in use' },
      { table: 'analytics_events', reason: 'Check analytics implementation' },
      { table: 'sessions', reason: 'Verify session management' },
      { table: 'api_keys', reason: 'Check if API key system is used' },
      { table: 'audit_logs', reason: 'Verify audit logging active' },
      { table: 'exports', reason: 'Check export feature usage' },
      { table: 'backups', reason: 'Check backup system usage' },
    ],
    REMOVE: []
  };

  console.log('🟢 KEEP (Production-Critical):');
  classifications.KEEP.forEach(({ table, reason }) => {
    const tableData = results.tables.find(t => t.name === table);
    console.log(`   ✓ ${table.padEnd(20)} - ${reason} (${tableData?.rowCount || 0} rows)`);
  });

  console.log('\n🟡 INVESTIGATE (Verify Usage):');
  classifications.INVESTIGATE.forEach(({ table, reason }) => {
    const tableData = results.tables.find(t => t.name === table);
    console.log(`   ? ${table.padEnd(20)} - ${reason} (${tableData?.rowCount || 0} rows)`);
  });

  console.log('\n🔴 REMOVE (Candidates):');
  console.log('   (None identified yet - pending investigation)');

  // ================================================
  // SECTION 4: PROBLEM DETECTION
  // ================================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SECTION 4: PROBLEM DETECTION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check for orders without items
  console.log('🔍 Checking for orders without order_items...');
  try {
    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_number, created_at');
    
    if (orders) {
      let orphanedOrders = 0;
      for (const order of orders) {
        const { count } = await supabase
          .from('order_items')
          .select('*', { count: 'exact', head: true })
          .eq('order_id', order.id);
        
        if (count === 0) {
          orphanedOrders++;
          results.problems.push({
            type: 'ORPHANED_ORDER',
            orderId: order.id,
            orderNumber: order.order_number
          });
        }
      }
      console.log(`   ${orphanedOrders === 0 ? '✅' : '⚠️'} Found ${orphanedOrders} orders without items`);
    }
  } catch (err) {
    console.log(`   ❌ Error checking orders: ${err.message}`);
  }

  // Check for products without variants
  console.log('\n🔍 Checking for products without variants...');
  try {
    const { data: products } = await supabase
      .from('products')
      .select('id, name');
    
    if (products) {
      let productsWithoutVariants = 0;
      for (const product of products) {
        const { count } = await supabase
          .from('product_variants')
          .select('*', { count: 'exact', head: true })
          .eq('product_id', product.id);
        
        if (count === 0) {
          productsWithoutVariants++;
          results.problems.push({
            type: 'PRODUCT_NO_VARIANTS',
            productId: product.id,
            productName: product.name
          });
        }
      }
      console.log(`   ${productsWithoutVariants === 0 ? '✅' : '⚠️'} Found ${productsWithoutVariants} products without variants`);
    }
  } catch (err) {
    console.log(`   ❌ Error checking products: ${err.message}`);
  }

  // ================================================
  // SECTION 5: SUMMARY & RECOMMENDATIONS
  // ================================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SECTION 5: AUDIT SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📊 Tables Found:', results.tables.filter(t => t.exists).length);
  console.log('🟢 Production Critical:', classifications.KEEP.length);
  console.log('🟡 Needs Investigation:', classifications.INVESTIGATE.length);
  console.log('🔴 Deletion Candidates:', classifications.REMOVE.length);
  console.log('⚠️  Problems Detected:', results.problems.length);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('NEXT STEPS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('1. Review the INVESTIGATE tables:');
  console.log('   - Run queries in AUDIT_PHASE1_QUERIES.sql');
  console.log('   - Check if features are actively used');
  console.log('   - Determine KEEP vs REMOVE');

  console.log('\n2. Address detected problems:');
  if (results.problems.length > 0) {
    results.problems.forEach(problem => {
      console.log(`   - ${problem.type}: ${JSON.stringify(problem)}`);
    });
  } else {
    console.log('   ✅ No critical problems detected');
  }

  console.log('\n3. Run full SQL audit:');
  console.log('   - Open Supabase SQL Editor');
  console.log('   - Run: server/database/AUDIT_PHASE1_QUERIES.sql');
  console.log('   - Review: Foreign keys, Functions, Triggers, RLS policies');

  console.log('\n4. Await confirmation before PHASE 2 (deletions)');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('✅ PHASE 1 AUDIT COMPLETE');
  console.log('⚠️  NO CHANGES MADE - READ-ONLY ANALYSIS');
  console.log('\n');

  // Save results to file
  fs.writeFileSync(
    './database/AUDIT_PHASE1_RESULTS.json',
    JSON.stringify(results, null, 2)
  );
  console.log('📄 Results saved to: database/AUDIT_PHASE1_RESULTS.json\n');
}

audit().catch(console.error);

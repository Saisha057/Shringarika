import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 COMPREHENSIVE DATABASE SCHEMA ANALYSIS');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const issues = [];
const fixes = [];

async function analyzeSchema() {
  // Get all tables
  const { data: tables } = await supabase
    .rpc('get_tables');
  
  // Alternative method - query information_schema
  const { data: allTables, error: tablesError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_type', 'BASE TABLE');

  if (tablesError) {
    console.log('Using direct table queries instead...\n');
  }

  console.log('📊 ANALYZING ALL TABLES...\n');

  // List of tables to check
  const tablesToCheck = [
    'users', 'orders', 'order_items', 'products', 'product_variants',
    'cart', 'cart_items', 'reviews', 'wishlist', 'addresses',
    'coupons', 'notifications', 'sessions', 'api_keys',
    'audit_logs', 'two_factor_auth', 'user_activity',
    'support_tickets', 'support_messages', 'stock_alerts'
  ];

  for (const tableName of tablesToCheck) {
    await analyzeTable(tableName);
  }

  // Check for duplicate columns across tables
  console.log('\n🔍 CHECKING FOR SCHEMA INCONSISTENCIES...\n');
  await checkSchemaConsistency();

  // Check foreign key integrity
  console.log('\n🔗 CHECKING FOREIGN KEY INTEGRITY...\n');
  await checkForeignKeys();

  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📋 TOTAL ISSUES FOUND: ${issues.length}`);
  console.log(`🔧 FIXES TO APPLY: ${fixes.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (issues.length > 0) {
    console.log('❌ ISSUES FOUND:\n');
    issues.forEach((issue, i) => {
      console.log(`${i + 1}. ${issue}`);
    });
  }

  if (fixes.length > 0) {
    console.log('\n✅ RECOMMENDED FIXES:\n');
    fixes.forEach((fix, i) => {
      console.log(`${i + 1}. ${fix}`);
    });
  }
}

async function analyzeTable(tableName) {
  try {
    // Get row count
    const { count, error: countError } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.log(`⚠️  ${tableName}: Table doesn't exist or access denied`);
      return;
    }

    const status = count === 0 ? '📪 EMPTY' : `📦 ${count} rows`;
    console.log(`${status.padEnd(20)} ${tableName}`);

    // Analyze based on row count and purpose
    if (count === 0 && ['cart_items', 'sessions', 'api_keys'].includes(tableName)) {
      console.log(`   ℹ️  Empty (normal for transient data)`);
    } else if (count === 0 && tableName === 'order_items') {
      issues.push(`❌ CRITICAL: ${tableName} is empty but orders exist (orphaned orders)`);
      fixes.push(`Fix order_items creation in Order.model.js`);
    } else if (count === 0 && tableName === 'product_variants') {
      issues.push(`❌ CRITICAL: ${tableName} is empty (products have no SKUs)`);
      fixes.push(`Run migration 013 to add variants to existing products`);
    }

  } catch (error) {
    console.log(`❌ ${tableName}: Error - ${error.message}`);
  }
}

async function checkSchemaConsistency() {
  // Check order_items for required columns
  try {
    const { data: orderItemsCols } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'order_items');

    if (orderItemsCols) {
      const hasVariantInfo = orderItemsCols.some(c => c.column_name === 'variant_info');
      if (hasVariantInfo) {
        issues.push(`⚠️  order_items has 'variant_info' column (should be removed)`);
        fixes.push(`DROP COLUMN variant_info from order_items (not needed, causes errors)`);
      }

      const variantIdCol = orderItemsCols.find(c => c.column_name === 'variant_id');
      if (variantIdCol && variantIdCol.is_nullable === 'NO') {
        issues.push(`❌ order_items.variant_id is NOT NULL (blocks orders without variants)`);
        fixes.push(`Run migration 012: Make variant_id nullable`);
      } else if (variantIdCol && variantIdCol.is_nullable === 'YES') {
        console.log('✅ order_items.variant_id is nullable (migration 012 applied)');
      }
    }
  } catch (error) {
    console.log('⚠️  Could not check order_items schema');
  }

  // Check for duplicate/unnecessary tables
  const unnecessaryTables = [];
  
  // Check if there are multiple user-related tables
  try {
    const { count: usersCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { count: profilesCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).catch(() => ({ count: null }));
    
    if (profilesCount !== null && profilesCount === 0 && usersCount > 0) {
      unnecessaryTables.push('profiles');
      issues.push(`⚠️  'profiles' table exists but is empty (users table has data)`);
      fixes.push(`Consider dropping 'profiles' table if all data is in 'users'`);
    }
  } catch (e) {}

  // Check for old/unused tables
  const potentiallyUnused = ['user_activity', 'sessions', 'api_keys'];
  for (const table of potentiallyUnused) {
    try {
      const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
      if (count === 0) {
        console.log(`ℹ️  ${table}: Empty (may be unused)`);
      }
    } catch (e) {}
  }
}

async function checkForeignKeys() {
  // Check order_items -> orders FK
  try {
    const { data: orphanedItems } = await supabase
      .from('order_items')
      .select('id, order_id')
      .is('order_id', null);

    if (orphanedItems && orphanedItems.length > 0) {
      issues.push(`❌ ${orphanedItems.length} order_items have NULL order_id (orphaned)`);
      fixes.push(`Delete orphaned order_items or assign to valid orders`);
    }
  } catch (e) {}

  // Check order_items -> products FK
  try {
    const { data: items } = await supabase
      .from('order_items')
      .select('id, product_id');

    if (items && items.length > 0) {
      for (const item of items) {
        const { data: product } = await supabase
          .from('products')
          .select('id')
          .eq('id', item.product_id)
          .single();

        if (!product) {
          issues.push(`❌ order_item ${item.id} references non-existent product ${item.product_id}`);
          fixes.push(`Delete orphaned order_item ${item.id}`);
        }
      }
    }
  } catch (e) {}

  // Check product_variants -> products FK
  try {
    const { data: variants } = await supabase
      .from('product_variants')
      .select('id, product_id');

    if (variants && variants.length > 0) {
      for (const variant of variants) {
        const { data: product } = await supabase
          .from('products')
          .select('id')
          .eq('id', variant.product_id)
          .single();

        if (!product) {
          issues.push(`❌ variant ${variant.id} references non-existent product ${variant.product_id}`);
          fixes.push(`Delete orphaned variant ${variant.id}`);
        }
      }
    }
  } catch (e) {}
}

analyzeSchema().catch(console.error);

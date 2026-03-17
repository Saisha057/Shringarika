import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 DETAILED SCHEMA ANALYSIS & FIX GENERATION');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const report = {
  criticalIssues: [],
  unnecessaryTables: [],
  duplicateColumns: [],
  schemaErrors: [],
  fixes: []
};

async function fullAnalysis() {
  // 1. Check order_items table structure
  console.log('1️⃣  ANALYZING ORDER_ITEMS TABLE...\n');
  const { data: orderItemsCols } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable, column_default')
    .eq('table_name', 'order_items')
    .order('ordinal_position');

  if (orderItemsCols) {
    console.log('   Columns in order_items:');
    orderItemsCols.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      console.log(`   - ${col.column_name.padEnd(20)} ${col.data_type.padEnd(15)} ${nullable}`);
      
      // Check for problematic columns
      if (col.column_name === 'variant_info') {
        report.schemaErrors.push({
          table: 'order_items',
          column: 'variant_info',
          issue: 'Column exists but causes PGRST204 error',
          reason: 'PostgREST cannot serialize JSONB properly in this context',
          fix: 'DROP COLUMN variant_info'
        });
      }
      
      if (col.column_name === 'variant_id' && col.is_nullable === 'NO') {
        report.criticalIssues.push({
          table: 'order_items',
          column: 'variant_id',
          issue: 'NOT NULL constraint blocks orders',
          reason: 'Products don\'t have variants yet, FK constraint fails',
          fix: 'ALTER TABLE order_items ALTER COLUMN variant_id DROP NOT NULL'
        });
      }
    });
  }

  // 2. Check product_variants table
  console.log('\n2️⃣  ANALYZING PRODUCT_VARIANTS TABLE...\n');
  const { count: variantsCount } = await supabase
    .from('product_variants')
    .select('*', { count: 'exact', head: true });

  const { count: productsCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true });

  console.log(`   Products: ${productsCount}`);
  console.log(`   Variants: ${variantsCount}`);

  if (productsCount > 0 && variantsCount === 0) {
    report.criticalIssues.push({
      table: 'product_variants',
      issue: `ALL ${productsCount} products have NO variants`,
      reason: 'Product.model.js doesn\'t create variants, prevents orders',
      fix: 'Run migration 013 + update Product.model.js'
    });
  }

  // 3. Check for empty/unnecessary tables
  console.log('\n3️⃣  CHECKING FOR UNNECESSARY TABLES...\n');
  
  const tablesToCheck = [
    { name: 'sessions', purpose: 'Session tracking', keepIfEmpty: true },
    { name: 'api_keys', purpose: 'API authentication', keepIfEmpty: true },
    { name: 'audit_logs', purpose: 'Audit trail', keepIfEmpty: true },
    { name: 'notifications', purpose: 'User notifications', keepIfEmpty: true },
    { name: 'cart_items', purpose: 'Cart storage', keepIfEmpty: true },
    { name: 'reviews', purpose: 'Product reviews', keepIfEmpty: false },
    { name: 'addresses', purpose: 'Saved addresses', keepIfEmpty: false },
    { name: 'coupons', purpose: 'Discount coupons', keepIfEmpty: false },
    { name: 'support_tickets', purpose: 'Customer support', keepIfEmpty: true },
    { name: 'support_messages', purpose: 'Support chat', keepIfEmpty: true }
  ];

  for (const table of tablesToCheck) {
    try {
      const { count } = await supabase
        .from(table.name)
        .select('*', { count: 'exact', head: true });

      const status = count === 0 ? '📪 EMPTY' : `📦 ${count} rows`;
      console.log(`   ${status.padEnd(20)} ${table.name.padEnd(25)} (${table.purpose})`);

      if (count === 0 && !table.keepIfEmpty) {
        report.unnecessaryTables.push({
          table: table.name,
          reason: `Empty and not actively used (${table.purpose})`,
          recommendation: 'Can be dropped if feature not planned'
        });
      }
    } catch (e) {
      console.log(`   ⚠️  ${table.name}: Not accessible`);
    }
  }

  // 4. Check for duplicate/redundant columns
  console.log('\n4️⃣  CHECKING FOR DUPLICATE/REDUNDANT COLUMNS...\n');
  
  const { data: orderCols } = await supabase
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_name', 'orders');

  if (orderCols) {
    const priceColumns = orderCols.filter(c => c.column_name.includes('price') || c.column_name.includes('total'));
    if (priceColumns.length > 0) {
      console.log('   Price-related columns in orders:');
      priceColumns.forEach(col => {
        console.log(`   - ${col.column_name}`);
      });
      
      // Check for duplicates
      const hasBothTotalAndAmount = orderCols.some(c => c.column_name === 'total_price') &&
                                     orderCols.some(c => c.column_name === 'total_amount');
      if (hasBothTotalAndAmount) {
        report.duplicateColumns.push({
          table: 'orders',
          columns: ['total_price', 'total_amount'],
          issue: 'Both columns exist, likely redundant',
          recommendation: 'Standardize on one (suggest: total_amount)'
        });
      }
    }
  }

  // 5. Check foreign key integrity
  console.log('\n5️⃣  CHECKING FOREIGN KEY INTEGRITY...\n');
  
  const { data: orders } = await supabase
    .from('orders')
    .select('id, user_id')
    .limit(5);

  if (orders) {
    for (const order of orders) {
      if (order.user_id) {
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('id', order.user_id)
          .single();

        if (!user) {
          report.schemaErrors.push({
            table: 'orders',
            column: 'user_id',
            issue: `Order ${order.id} references non-existent user ${order.user_id}`,
            fix: 'Delete order or fix user_id'
          });
        }
      }
    }
    console.log(`   ✅ Checked ${orders.length} orders for user FK integrity`);
  }

  // Generate report
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 ANALYSIS COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`❌ Critical Issues: ${report.criticalIssues.length}`);
  console.log(`⚠️  Schema Errors: ${report.schemaErrors.length}`);
  console.log(`📪 Unnecessary Tables: ${report.unnecessaryTables.length}`);
  console.log(`🔄 Duplicate Columns: ${report.duplicateColumns.length}\n`);

  // Print detailed findings
  if (report.criticalIssues.length > 0) {
    console.log('\n🚨 CRITICAL ISSUES:\n');
    report.criticalIssues.forEach((issue, i) => {
      console.log(`${i + 1}. Table: ${issue.table}`);
      if (issue.column) console.log(`   Column: ${issue.column}`);
      console.log(`   Issue: ${issue.issue}`);
      console.log(`   Reason: ${issue.reason}`);
      console.log(`   Fix: ${issue.fix}\n`);
    });
  }

  if (report.schemaErrors.length > 0) {
    console.log('\n⚠️  SCHEMA ERRORS:\n');
    report.schemaErrors.forEach((error, i) => {
      console.log(`${i + 1}. Table: ${error.table}, Column: ${error.column}`);
      console.log(`   Issue: ${error.issue}`);
      console.log(`   Reason: ${error.reason}`);
      console.log(`   Fix: ${error.fix}\n`);
    });
  }

  if (report.unnecessaryTables.length > 0) {
    console.log('\n📪 UNNECESSARY/EMPTY TABLES:\n');
    report.unnecessaryTables.forEach((table, i) => {
      console.log(`${i + 1}. ${table.table}`);
      console.log(`   Reason: ${table.reason}`);
      console.log(`   Recommendation: ${table.recommendation}\n`);
    });
  }

  if (report.duplicateColumns.length > 0) {
    console.log('\n🔄 DUPLICATE/REDUNDANT COLUMNS:\n');
    report.duplicateColumns.forEach((dup, i) => {
      console.log(`${i + 1}. Table: ${dup.table}`);
      console.log(`   Columns: ${dup.columns.join(', ')}`);
      console.log(`   Issue: ${dup.issue}`);
      console.log(`   Recommendation: ${dup.recommendation}\n`);
    });
  }

  // Save report to file
  fs.writeFileSync(
    'database/SCHEMA_ANALYSIS_REPORT.json',
    JSON.stringify(report, null, 2)
  );
  console.log('\n✅ Full report saved to: database/SCHEMA_ANALYSIS_REPORT.json\n');
}

fullAnalysis().catch(console.error);

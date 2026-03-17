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

async function auditStockSystem() {
  console.log('🔍 === COMPREHENSIVE STOCK/INVENTORY AUDIT ===\n');

  const issues = [];
  const findings = [];

  // PHASE 1: Database Architecture Audit
  console.log('📋 PHASE 1: DATABASE ARCHITECTURE\n');

  // Check products table structure
  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('*')
    .limit(3);

  if (products && products.length > 0) {
    const productColumns = Object.keys(products[0]);
    console.log('✅ Products table columns:', productColumns.length);
    
    // Check for stock-related columns
    const stockColumns = productColumns.filter(c => 
      c.includes('stock') || c.includes('quantity') || c.includes('inventory')
    );
    console.log('   Stock-related columns:', stockColumns.join(', '));
    
    findings.push({
      area: 'Products Table',
      columns: stockColumns,
      hasVariants: productColumns.includes('variants'),
      hasSizes: productColumns.includes('sizes'),
      hasColors: productColumns.includes('colors')
    });
  }

  // Check if product_variants table exists and its structure
  const { data: variants, error: varError } = await supabase
    .from('product_variants')
    .select('*')
    .limit(3);

  if (!varError && variants) {
    console.log('✅ Product Variants table exists');
    if (variants.length > 0) {
      const variantColumns = Object.keys(variants[0]);
      const stockCols = variantColumns.filter(c => 
        c.includes('stock') || c.includes('quantity')
      );
      console.log('   Variant columns:', variantColumns.join(', '));
      console.log('   Variant stock columns:', stockCols.join(', '));
      findings.push({
        area: 'Product Variants',
        exists: true,
        count: variants.length,
        stockColumns: stockCols
      });
    } else {
      console.log('⚠️  Product Variants table empty');
      findings.push({
        area: 'Product Variants',
        exists: true,
        count: 0,
        issue: 'No variants defined'
      });
    }
  } else {
    console.log('⚠️  Product Variants table does not exist or is inaccessible');
    findings.push({
      area: 'Product Variants',
      exists: false,
      issue: 'Table missing or RLS blocking'
    });
  }

  // Check inventory table
  const { data: inventory, error: invError } = await supabase
    .from('inventory')
    .select('*')
    .limit(5);

  if (!invError && inventory) {
    console.log('✅ Inventory table exists');
    if (inventory.length > 0) {
      const invColumns = Object.keys(inventory[0]);
      console.log('   Inventory columns:', invColumns.join(', '));
      console.log('   Inventory records:', inventory.length);
      
      // Check if inventory links to products AND variants
      const hasProductId = invColumns.includes('product_id');
      const hasVariantId = invColumns.includes('variant_id');
      const hasQuantity = invColumns.includes('quantity');
      const hasReserved = invColumns.includes('reserved_quantity');
      
      findings.push({
        area: 'Inventory Table',
        exists: true,
        count: inventory.length,
        hasProductLink: hasProductId,
        hasVariantLink: hasVariantId,
        hasQuantity: hasQuantity,
        hasReservedQuantity: hasReserved
      });
    } else {
      console.log('⚠️  Inventory table empty');
      issues.push('Inventory table exists but has no records');
    }
  }

  // PHASE 2: Stock Value Consistency Check
  console.log('\n📋 PHASE 2: STOCK VALUE CONSISTENCY\n');

  const { data: allProducts } = await supabase
    .from('products')
    .select('id, name, stock, total_stock');

  if (allProducts) {
    for (const product of allProducts) {
      // Check if product has inventory record
      const { data: inv } = await supabase
        .from('inventory')
        .select('quantity, reserved_quantity')
        .eq('product_id', product.id)
        .is('variant_id', null);

      if (inv && inv.length > 0) {
        const invQty = inv[0].quantity;
        const prodStock = product.stock || product.total_stock || 0;
        
        if (invQty !== prodStock) {
          issues.push(`Stock mismatch: Product "${product.name}" - inventory:${invQty} vs product:${prodStock}`);
          console.log(`⚠️  Mismatch: ${product.name} - inv:${invQty} vs prod:${prodStock}`);
        }
      } else {
        console.log(`⚠️  Product "${product.name}" has no inventory record`);
      }
    }
  }

  // PHASE 3: Order Flow Analysis
  console.log('\n📋 PHASE 3: ORDER CREATION & STOCK DEDUCTION\n');

  // Get recent orders
  const { data: recentOrders } = await supabase
    .from('orders')
    .select('id, order_number, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (recentOrders && recentOrders.length > 0) {
    console.log(`Found ${recentOrders.length} recent orders to analyze`);
    
    // For each order, check if stock was deducted
    for (const order of recentOrders.slice(0, 2)) {
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('product_id, variant_id, quantity, product_name')
        .eq('order_id', order.id);

      if (orderItems) {
        console.log(`\n   Order ${order.order_number}:`);
        for (const item of orderItems) {
          console.log(`   - ${item.product_name} x${item.quantity}`);
          
          // Check current inventory for this product
          const { data: currentInv } = await supabase
            .from('inventory')
            .select('quantity')
            .eq('product_id', item.product_id)
            .eq('variant_id', item.variant_id || null);

          if (currentInv && currentInv.length > 0) {
            console.log(`     Current stock: ${currentInv[0].quantity}`);
          } else {
            console.log(`     ⚠️  No inventory record found`);
            issues.push(`Order item has no inventory tracking: ${item.product_name}`);
          }
        }
      }
    }
  }

  // PHASE 4: Check for stock deduction triggers/functions
  console.log('\n📋 PHASE 4: AUTOMATED STOCK DEDUCTION MECHANISMS\n');

  // Try to query for triggers (limited by RLS)
  console.log('Checking for database triggers and functions...');
  console.log('(Manual verification needed in SQL Editor)');

  findings.push({
    area: 'Stock Deduction Mechanism',
    note: 'Requires manual check of triggers/functions in SQL Editor',
    checkQueries: [
      `SELECT trigger_name, event_manipulation, event_object_table 
       FROM information_schema.triggers 
       WHERE event_object_schema = 'public' 
       AND event_object_table IN ('orders', 'order_items');`,
      `SELECT routine_name, routine_type 
       FROM information_schema.routines 
       WHERE routine_schema = 'public' 
       AND routine_name LIKE '%stock%' OR routine_name LIKE '%inventory%';`
    ]
  });

  // PHASE 5: Check for negative stock values
  console.log('\n📋 PHASE 5: DATA INTEGRITY CHECKS\n');

  const { data: negativeStock } = await supabase
    .from('inventory')
    .select('product_id, quantity')
    .lt('quantity', 0);

  if (negativeStock && negativeStock.length > 0) {
    issues.push(`Found ${negativeStock.length} inventory records with NEGATIVE stock!`);
    console.log(`❌ CRITICAL: ${negativeStock.length} records have negative stock`);
  } else {
    console.log('✅ No negative stock values found');
  }

  // Check for reserved quantity issues
  const { data: reservedIssues } = await supabase
    .from('inventory')
    .select('product_id, quantity, reserved_quantity')
    .filter('reserved_quantity', 'gt', 'quantity');

  if (reservedIssues && reservedIssues.length > 0) {
    issues.push(`Found ${reservedIssues.length} records where reserved > available`);
    console.log(`⚠️  ${reservedIssues.length} records: reserved > available`);
  }

  // PHASE 6: Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 AUDIT SUMMARY');
  console.log('='.repeat(60));

  console.log('\n🔍 FINDINGS:');
  findings.forEach((finding, i) => {
    console.log(`\n${i + 1}. ${finding.area}:`);
    console.log(JSON.stringify(finding, null, 2));
  });

  console.log(`\n🔴 ISSUES FOUND: ${issues.length}`);
  if (issues.length > 0) {
    issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
  } else {
    console.log('   None found ✅');
  }

  console.log('\n' + '='.repeat(60));

  return { findings, issues };
}

auditStockSystem();

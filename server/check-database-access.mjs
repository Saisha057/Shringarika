import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 DATABASE ACCESS CHECK\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function checkDatabase() {
  // Check orders table
  console.log('📊 ORDERS TABLE:');
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, total_price, order_status, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (ordersError) {
    console.log('❌ Error:', ordersError.message);
  } else {
    console.log(`   Total recent orders: ${orders.length}`);
    orders.forEach((order, i) => {
      console.log(`   ${i + 1}. ${order.order_number} - ${order.customer_name} - ₹${order.total_price} - ${order.order_status}`);
    });
  }
  
  console.log('\n📦 ORDER_ITEMS TABLE:');
  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('id, order_id, product_name, quantity, unit_price')
    .limit(10);

  if (itemsError) {
    console.log('❌ Error:', itemsError.message);
  } else {
    console.log(`   Total order items: ${items.length}`);
    if (items.length > 0) {
      items.forEach((item, i) => {
        console.log(`   ${i + 1}. ${item.product_name} x ${item.quantity} @ ₹${item.unit_price}`);
      });
    } else {
      console.log('   ⚠️  No order items found');
    }
  }

  console.log('\n🏷️  PRODUCTS TABLE:');
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, price')
    .limit(5);

  if (productsError) {
    console.log('❌ Error:', productsError.message);
  } else {
    console.log(`   Total products: ${products.length}`);
    products.forEach((product, i) => {
      console.log(`   ${i + 1}. ${product.name} - ₹${product.price}`);
    });
  }

  console.log('\n🎨 PRODUCT_VARIANTS TABLE:');
  const { data: variants, error: variantsError } = await supabase
    .from('product_variants')
    .select('id, product_id, size, color, stock_quantity')
    .limit(5);

  if (variantsError) {
    console.log('❌ Error:', variantsError.message);
  } else {
    console.log(`   Total variants: ${variants.length}`);
    if (variants.length > 0) {
      variants.forEach((v, i) => {
        console.log(`   ${i + 1}. Size: ${v.size}, Color: ${v.color}, Stock: ${v.stock_quantity}`);
      });
    } else {
      console.log('   ⚠️  No product variants found (Phase 1.5 issue)');
    }
  }

  console.log('\n📋 ORDER_ITEMS TABLE STRUCTURE:');
  const { data: columns, error: columnsError } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable')
    .eq('table_name', 'order_items')
    .order('ordinal_position');

  if (!columnsError && columns) {
    columns.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Database access confirmed!');
  console.log('   Connection: Supabase PostgreSQL');
  console.log('   URL: ' + process.env.SUPABASE_URL);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

checkDatabase().catch(console.error);

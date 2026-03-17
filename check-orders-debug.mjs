import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read .env file
const envContent = readFileSync('./server/.env', 'utf8');
const lines = envContent.split('\n');

let supabaseUrl, supabaseKey;
for (const line of lines) {
  if (line.startsWith('SUPABASE_URL=')) {
    supabaseUrl = line.split('=')[1].trim();
  }
  if (line.startsWith('SUPABASE_ANON_KEY=')) {
    supabaseKey = line.split('=')[1].trim();
  }
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrders() {
  console.log('\n🔍 Checking orders in database...\n');

  // Get recent orders
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, order_number, total_price, order_status, order_items, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`Found ${orders.length} recent orders:\n`);

  orders.forEach((order, idx) => {
    console.log(`${idx + 1}. Order ${order.order_number}`);
    console.log(`   Status: ${order.order_status}`);
    console.log(`   Total: ₹${order.total_price}`);
    console.log(`   Date: ${new Date(order.created_at).toLocaleString()}`);
    console.log(`   order_items type: ${typeof order.order_items}`);
    console.log(`   order_items is array: ${Array.isArray(order.order_items)}`);
    
    if (order.order_items) {
      if (Array.isArray(order.order_items)) {
        console.log(`   ✅ Has ${order.order_items.length} items:`);
        order.order_items.forEach((item, i) => {
          console.log(`      ${i + 1}. Product ID: ${item.productId || item.product_id || 'MISSING'}`);
          console.log(`         Quantity: ${item.quantity || 'MISSING'}`);
          console.log(`         Price: ${item.pricePerItem || item.unit_price || item.price || 'MISSING'}`);
          console.log(`         Name: ${item.productName || item.product_name || item.name || 'MISSING'}`);
        });
      } else {
        console.log(`   ⚠️ order_items is not an array:`, order.order_items);
      }
    } else {
      console.log(`   ❌ No order_items found!`);
    }
    console.log('');
  });

  // Get products
  const { data: products } = await supabase
    .from('products')
    .select('id, name')
    .limit(5);

  console.log('\nSample product IDs:');
  products?.forEach(p => {
    console.log(`  ${p.id} (${typeof p.id}) - ${p.name}`);
  });

  process.exit(0);
}

checkOrders();

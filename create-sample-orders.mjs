import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read .env
const envContent = readFileSync('./server/.env', 'utf8');
const lines = envContent.split('\n');
let supabaseUrl, supabaseKey;
for (const line of lines) {
  if (line.startsWith('SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createSampleOrders() {
  console.log('\n🔄 Creating sample orders for analytics...\n');

  // Get products
  const { data: products } = await supabase
    .from('products')
    .select('id, name, price')
    .limit(5);

  if (!products || products.length === 0) {
    console.error('❌ No products found in database!');
    process.exit(1);
  }

  console.log(`Found ${products.length} products to use\n`);

  // Create 10 sample orders
  const orders = [];
  const statuses = ['Delivered', 'Shipped', 'Processing', 'Confirmed', 'Pending'];
  
  for (let i = 0; i < 10; i++) {
    const product = products[i % products.length];
    const quantity = Math.floor(Math.random() * 3) + 1; // 1-3 items
    const pricePerItem = parseFloat(product.price);
    const lineTotal = quantity * pricePerItem;
    
    // Random date in last 30 days
    const daysAgo = Math.floor(Math.random() * 30);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);

    const order = {
      order_number: `ORD${Date.now()}${i}`.slice(-12),
      customer_name: `Test Customer ${i + 1}`,
      customer_email: `customer${i + 1}@test.com`,
      customer_phone: `98765432${10 + i}`,
      shipping_address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'TestState',
        pincode: '123456',
        country: 'India'
      },
      total_price: lineTotal,
      order_status: statuses[i % statuses.length],
      payment_status: 'paid',
      payment_method: i % 2 === 0 ? 'razorpay' : 'COD',
      order_items: [
        {
          productId: product.id,
          productName: product.name,
          quantity: quantity,
          pricePerItem: pricePerItem,
          lineTotal: lineTotal,
          variant: {}
        }
      ],
      created_at: createdAt.toISOString(),
      updated_at: createdAt.toISOString()
    };

    orders.push(order);
  }

  // Insert all orders
  const { data: insertedOrders, error } = await supabase
    .from('orders')
    .insert(orders)
    .select();

  if (error) {
    console.error('❌ Error creating orders:', error.message);
    process.exit(1);
  }

  console.log(`✅ Created ${insertedOrders.length} sample orders!\n`);

  // Verify
  insertedOrders.forEach((order, idx) => {
    const items = order.order_items;
const itemCount = items.reduce((sum, item) =>sum + item.quantity, 0);
    console.log(`${idx + 1}. Order ${order.order_number}`);
    console.log(`   Status: ${order.order_status}`);
    console.log(`   Items: ${itemCount} units`);
    console.log(`   Total: ₹${order.total_price}`);
    console.log(`   Date: ${new Date(order.created_at).toLocaleDateString()}`);
  });

  console.log('\n✅ Sample orders created! Refresh your analytics page.');
  console.log('🎯 Analytics should now show data!\n');

  process.exit(0);
}

createSampleOrders();

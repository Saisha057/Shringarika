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

async function checkOrders() {
  console.log('\n🔍 CHECKING ORDERS...\n');

  try {
    // Get orders with minimal columns to avoid schema errors
    const { data: orders, error, count } = await supabase
      .from('orders')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Error fetching orders:', error);
      return;
    }

    console.log(`📦 Total Orders in Database: ${count}`);
    console.log('═'.repeat(70));

    if (count === 0) {
      console.log('\n⚠️  NO ORDERS FOUND IN DATABASE\n');
      console.log('This is why the admin dashboard shows empty!');
      console.log('\n📝 TO FIX THIS:');
      console.log('─'.repeat(70));
      console.log('1. Open browser: http://localhost:3000');
      console.log('2. Login with YOUR email (NOT admin@shringarika.test)');
      console.log('   Example: saishadubey1204@gmail.com');
      console.log('3. Browse products and add items to cart');
      console.log('4. Complete checkout to place an order');
      console.log('5. Logout');
      console.log('6. Login as admin (admin@shringarika.test / Admin@123456)');
      console.log('7. Check Admin Dashboard → Orders page');
      console.log('─'.repeat(70));
    } else {
      console.log(`\n✅ Found ${count} order(s):\n`);
      orders.forEach((order, index) => {
        console.log(`${index + 1}. Order ID: ${order.id ? order.id.substring(0, 8) + '...' : 'N/A'}`);
        console.log(`   Status: ${order.order_status || 'N/A'}`);
        console.log(`   Payment: ${order.payment_status || 'N/A'}`);
        console.log(`   Created: ${order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A'}`);
        console.log('');
      });
    }

    console.log('═'.repeat(70));
    console.log('');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkOrders();

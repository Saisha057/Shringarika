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

async function checkDatabaseData() {
  console.log('\n🔍 CHECKING DATABASE DATA...\n');
  console.log('═'.repeat(70));

  try {
    // Check users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, name, role, created_at')
      .order('created_at', { ascending: false });

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
    } else {
      console.log(`\n👥 USERS (Total: ${users.length})`);
      console.log('─'.repeat(70));
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name || 'N/A'} (${user.email})`);
        console.log(`   Role: ${user.role} | Created: ${new Date(user.created_at).toLocaleString()}`);
      });
    }

    // Check orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, user_id, order_status, payment_status, total_amount, created_at')
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error('❌ Error fetching orders:', ordersError);
    } else {
      console.log(`\n\n📦 ORDERS (Total: ${orders.length})`);
      console.log('─'.repeat(70));
      if (orders.length === 0) {
        console.log('⚠️  No orders found in database');
        console.log('\nℹ️  To test the admin dashboard:');
        console.log('   1. Login with a regular user account (not admin)');
        console.log('   2. Browse products and add items to cart');
        console.log('   3. Complete checkout and place an order');
        console.log('   4. Logout and login as admin to see the order');
      } else {
        orders.forEach((order, index) => {
          console.log(`${index + 1}. Order ID: ${order.id.substring(0, 8)}...`);
          console.log(`   User: ${order.user_id.substring(0, 8)}... | Status: ${order.order_status}`);
          console.log(`   Payment: ${order.payment_status} | Amount: ₹${order.total_amount}`);
          console.log(`   Created: ${new Date(order.created_at).toLocaleString()}`);
          console.log('');
        });
      }
    }

    console.log('\n═'.repeat(70));
    console.log('\n✅ Database check complete!\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkDatabaseData();

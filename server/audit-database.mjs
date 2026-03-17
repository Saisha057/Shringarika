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

async function auditDatabase() {
  console.log('🔍 === DATABASE AUDIT STARTED ===\n');

  try {
    // 1. Get all tables in public schema
    console.log('📋 PHASE 1: Inspecting all tables...\n');
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_tables');

    if (tablesError) {
      // Try alternative method
      const { data, error } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');
      
      if (error) {
        console.log('Using direct SQL query...');
        const query = `
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
          ORDER BY table_name;
        `;
        
        const result = await supabase.rpc('exec_sql', { query });
        console.log('Tables query result:', result);
      }
    }

    // Get table information using pg_catalog
    console.log('Fetching table structure...\n');
    const tablesQuery = `
      SELECT 
        schemaname,
        tablename,
        tableowner
      FROM pg_catalog.pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `;

    // Since we can't run arbitrary SQL, let's check specific tables
    const knownTables = [
      'users', 'profiles', 'sessions', 'categories', 'products', 
      'product_variants', 'product_images', 'inventory', 
      'inventory_transactions', 'carts', 'cart_items', 'wishlists',
      'addresses', 'orders', 'order_items', 'order_status_history',
      'payments', 'coupons', 'coupon_usage', 'reviews', 'review_votes',
      'notifications', 'support_tickets', 'support_messages',
      'newsletter_subscribers', 'email_campaigns', 'page_views',
      'product_views', 'search_queries', 'banners', 'faqs',
      'audit_logs', 'dashboard_stats', 'system_settings', 'admin_activities',
      'returns', 'return_items'
    ];

    console.log('✅ Checking existence of known tables:\n');
    const tableStatus = {};
    
    for (const tableName of knownTables) {
      try {
        const { data, error, count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          if (error.code === '42P01') {
            console.log(`❌ Table "${tableName}" does NOT exist`);
            tableStatus[tableName] = { exists: false, error: error.message };
          } else if (error.code === '42501') {
            console.log(`⚠️  Table "${tableName}" exists but RLS policy blocking`);
            tableStatus[tableName] = { exists: true, rlsIssue: true, error: error.message };
          } else {
            console.log(`⚠️  Table "${tableName}" - Error: ${error.message}`);
            tableStatus[tableName] = { exists: 'unknown', error: error.message };
          }
        } else {
          console.log(`✅ Table "${tableName}" exists (${count || 0} rows)`);
          tableStatus[tableName] = { exists: true, rowCount: count || 0 };
        }
      } catch (e) {
        console.log(`❌ Table "${tableName}" - Exception: ${e.message}`);
        tableStatus[tableName] = { exists: false, exception: e.message };
      }
    }

    // 2. Check for foreign key constraints
    console.log('\n📋 PHASE 2: Checking Foreign Keys...\n');
    
    // Try to get FK info from products table
    const productCheck = await supabase
      .from('products')
      .select('*, categories(*)')
      .limit(1);
    
    if (productCheck.error) {
      console.log('⚠️  Foreign key check failed:', productCheck.error.message);
    } else {
      console.log('✅ Products-Categories FK working');
    }

    // 3. Check RLS policies
    console.log('\n📋 PHASE 3: Checking RLS Policies...\n');
    
    // Test if admin can access products
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('*')
      .limit(5);
    
    if (prodError) {
      console.log('❌ RLS Policy Issue on products:', prodError.message);
    } else {
      console.log(`✅ Products accessible (${products?.length || 0} rows fetched)`);
    }

    // Test orders access
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .limit(5);
    
    if (orderError) {
      console.log('❌ RLS Policy Issue on orders:', orderError.message);
    } else {
      console.log(`✅ Orders accessible (${orders?.length || 0} rows fetched)`);
    }

    // 4. Check for users with admin role
    console.log('\n📋 PHASE 4: Checking Admin Users...\n');
    
    const { data: admins, error: adminError } = await supabase
      .from('users')
      .select('id, email, role, is_active')
      .eq('role', 'admin');
    
    if (adminError) {
      console.log('❌ Cannot fetch admin users:', adminError.message);
    } else {
      console.log(`✅ Found ${admins?.length || 0} admin user(s):`);
      admins?.forEach(admin => {
        console.log(`   - ${admin.email} (${admin.is_active ? 'Active' : 'Inactive'})`);
      });
    }

    // 5. Check extensions
    console.log('\n📋 PHASE 5: Checking PostgreSQL Extensions...\n');
    console.log('(Extensions can only be verified via SQL Editor in Supabase Dashboard)');

    // 6. Test data integrity
    console.log('\n📋 PHASE 6: Testing Data Integrity...\n');
    
    // Check if there are orders without users (guest orders)
    const { data: guestOrders, error: guestError } = await supabase
      .from('orders')
      .select('id, order_number, user_id')
      .is('user_id', null);
    
    if (!guestError && guestOrders) {
      console.log(`Found ${guestOrders.length} guest orders (user_id IS NULL)`);
    }

    // Check for products without inventory records
    const { data: productsWithoutInventory, error: invError } = await supabase
      .from('products')
      .select('id, name')
      .not('id', 'in', '(SELECT product_id FROM inventory WHERE product_id IS NOT NULL)')
      .limit(10);
    
    if (!invError && productsWithoutInventory) {
      console.log(`Found ${productsWithoutInventory.length} products without inventory`);
    }

    console.log('\n✅ === DATABASE AUDIT COMPLETED ===\n');
    console.log('📊 Summary:');
    console.log(JSON.stringify(tableStatus, null, 2));

  } catch (error) {
    console.error('❌ Audit failed:', error);
  }
}

auditDatabase();

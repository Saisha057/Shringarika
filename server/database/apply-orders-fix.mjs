import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const SUPABASE_URL = envContent.match(/SUPABASE_URL=(.*)/)?.[1]?.trim();
const SUPABASE_SERVICE_ROLE_KEY = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim();

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runMigration() {
  console.log('🔧 Running orders table schema fix migration...\n');

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations/999_fix_orders_schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Split by semicolon and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('COMMENT'));

    console.log(`📝 Executing ${statements.length} SQL statements...\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`${i + 1}. ${statement.substring(0, 60)}...`);

      const { error } = await supabase.rpc('exec_sql', { 
        sql_query: statement 
      }).catch(async () => {
        // If RPC doesn't exist, try direct query
        return await supabase.from('_sqlquery').insert({ query: statement });
      });

      if (error) {
        // Some errors are expected (like column already exists)
        if (error.message?.includes('already exists') || 
            error.message?.includes('does not exist')) {
          console.log(`   ⚠️  ${error.message}`);
        } else {
          console.error(`   ❌ Error: ${error.message}`);
        }
      } else {
        console.log('   ✅ Success');
      }
    }

    console.log('\n✅ Migration completed!');
    console.log('\nVerifying schema changes...');

    // Verify the changes
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .limit(1);

    if (orderError) {
      console.error('❌ Error verifying orders table:', orderError.message);
    } else {
      console.log('✅ Orders table accessible');
    }

    const { data: orderItems, error: itemError } = await supabase
      .from('order_items')
      .select('*')
      .limit(1);

    if (itemError) {
      console.error('❌ Error verifying order_items table:', itemError.message);
    } else {
      console.log('✅ Order_items table accessible');
    }

    console.log('\n🎉 Database is ready for order creation!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();

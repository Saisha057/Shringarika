import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from root directory (not server directory)
dotenv.config({ path: join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🔄 Running archive columns migration...\n');
  
  try {
    // Read the SQL migration file
    const migrationSQL = readFileSync(
      join(__dirname, './migrations/012_add_archive_columns.sql'),
      'utf-8'
    );
    
    console.log('📄 Migration SQL loaded');
    console.log('━'.repeat(80));
    
    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql: migrationSQL 
    });
    
    if (error) {
      // If exec_sql RPC doesn't exist, try direct execution
      console.log('⚠️ exec_sql RPC not found, attempting direct execution...');
      
      // Split by statement and execute each one
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const statement of statements) {
        if (statement.includes('DO $$') || statement.includes('CREATE INDEX') || statement.includes('ALTER TABLE')) {
          console.log(`\n🔨 Executing: ${statement.substring(0, 60)}...`);
          
          // Use .rpc() for complex statements or direct query for simple ones
          const result = await supabase.rpc('sql', { query: statement });
          
          if (result.error) {
            console.error(`❌ Error executing statement: ${result.error.message}`);
          } else {
            console.log('✅ Statement executed');
          }
        }
      }
    } else {
      console.log('✅ Migration executed successfully');
    }
    
    // Verify columns were added
    console.log('\n\n🔍 Verifying migration...');
    
    const { data: columns, error: verifyError } = await supabase
      .from('orders')
      .select('id, is_archived, archived_at, archived_by')
      .limit(1);
    
    if (verifyError) {
      console.error('❌ Verification failed:', verifyError.message);
      console.log('\n⚠️ If columns are missing, run migration manually in Supabase SQL Editor:');
      console.log('   server/database/migrations/012_add_archive_columns.sql');
      process.exit(1);
    }
    
    console.log('✅ Migration verified successfully!');
    console.log('\n📊 Archive columns added:');
    console.log('   • is_archived (boolean)');
    console.log('   • archived_at (timestamp)');
    console.log('   • archived_by (uuid reference)');
    
    // Check if any orders need to be migrated
    console.log('\n\n🔍 Checking for orders to migrate...');
    const { data: oldOrders, error: checkError } = await supabase
      .from('orders')
      .select('id, order_status')
      .eq('order_status', 'Archived')
      .limit(10);
    
    if (checkError) {
      console.log('⚠️ Could not check for orders with status=Archived (this is expected)');
    } else if (oldOrders && oldOrders.length > 0) {
      console.log(`\n⚠️ Found ${oldOrders.length} orders with order_status='Archived'`);
      console.log('   These will cause constraint violations!');
      console.log('   Updating to is_archived=true and order_status=Delivered...');
      
      for (const order of oldOrders) {
        await supabase
          .from('orders')
          .update({
            is_archived: true,
            archived_at: new Date().toISOString(),
            order_status: 'Delivered'
          })
          .eq('id', order.id);
      }
      
      console.log('✅ Orders migrated successfully');
    } else {
      console.log('✅ No orders need migration');
    }
    
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('✅ MIGRATION COMPLETE');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\nNext steps:');
    console.log('1. Restart backend server');
    console.log('2. Test archive functionality in admin dashboard');
    console.log('3. Verify archived orders display correctly');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\n📝 Error details:', error);
    console.log('\n⚠️ Manual migration required:');
    console.log('   1. Open Supabase SQL Editor');
    console.log('   2. Run: server/database/migrations/012_add_archive_columns.sql');
    process.exit(1);
  }
}

runMigration();

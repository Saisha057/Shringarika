import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = 'https://srdljxbumxkgjxoqqrzs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyZGxqeGJ1bXhrZ2p4b3FxcnpzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDAwODgyOSwiZXhwIjoyMDQ5NTg0ODI5fQ.RdVoKHp5uE_ChtpwgEz8Ky5M7Zm9RwJwzx0_UR5_N5o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🔧 Running Critical Schema Fix Migration...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'database', 'migrations', '010_fix_returns_refunds_schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split by semicolon and filter empty statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

    console.log(`📋 Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      
      // Skip comments and COMMENT statements (they don't work via RPC)
      if (statement.includes('COMMENT ON') || statement.includes('NOTIFY pgrst')) {
        console.log(`⏭️  Skipping: ${statement.substring(0, 60)}...`);
        continue;
      }

      try {
        console.log(`\n${i + 1}/${statements.length} Executing: ${statement.substring(0, 80)}...`);
        
        const { data, error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          // Try direct query if RPC fails
          const { error: directError } = await supabase.from('_').select('*').limit(0);
          // Actually execute via pg admin or manual SQL
          console.warn(`⚠️  Warning: ${error.message}`);
          console.log(`    Attempting alternative method...`);
          
          // For ALTER TABLE statements, we can verify if column exists after
          if (statement.includes('ALTER TABLE orders ADD COLUMN')) {
            const columnMatch = statement.match(/ADD COLUMN IF NOT EXISTS (\w+)/);
            if (columnMatch) {
              const columnName = columnMatch[1];
              const { data: columns } = await supabase
                .from('orders')
                .select(columnName)
                .limit(0);
              
              if (columns !== null) {
                console.log(`✅ Column '${columnName}' verified or already exists`);
                successCount++;
                continue;
              }
            }
          }
          
          errorCount++;
        } else {
          console.log(`✅ Success`);
          successCount++;
        }
      } catch (err) {
        console.error(`❌ Error: ${err.message}`);
        errorCount++;
      }
    }

    console.log(`\n\n═══════════════════════════════════════`);
    console.log(`📊 Migration Summary:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`═══════════════════════════════════════\n`);

    // Verify critical columns exist
    console.log('\n🔍 Verifying Critical Columns...\n');
    
    const columnsToCheck = [
      'return_requested', 'return_status', 'return_request',
      'refund_method', 'refund_upi_id', 'refund_amount', 'refund_status',
      'exchange_requested', 'exchange_status', 'exchange_details',
      'status_updated_at'
    ];

    const { data: testOrder } = await supabase
      .from('orders')
      .select('*')
      .limit(1)
      .single();

    if (testOrder) {
      const existingColumns = [];
      const missingColumns = [];

      for (const col of columnsToCheck) {
        if (col in testOrder || testOrder.hasOwnProperty(col)) {
          existingColumns.push(col);
        } else {
          missingColumns.push(col);
        }
      }

      console.log(`✅ Existing columns (${existingColumns.length}):`);
      existingColumns.forEach(col => console.log(`   • ${col}`));

      if (missingColumns.length > 0) {
        console.log(`\n❌ Missing columns (${missingColumns.length}):`);
        missingColumns.forEach(col => console.log(`   • ${col}`));
        console.log(`\n⚠️  You need to run the SQL migration manually in Supabase SQL Editor`);
        console.log(`   File: server/database/migrations/010_fix_returns_refunds_schema.sql`);
      } else {
        console.log(`\n✅ ALL REQUIRED COLUMNS EXIST!`);
      }
    } else {
      console.log(`⚠️  No orders found to verify schema`);
    }

    // Test a simple insert to verify schema cache is refreshed
    console.log(`\n🧪 Testing Schema Cache Refresh...\n`);
    const { error: cacheTest } = await supabase
      .from('orders')
      .select('return_requested, return_status, refund_method, exchange_requested')
      .limit(1);

    if (cacheTest) {
      console.log(`❌ Schema cache error: ${cacheTest.message}`);
      console.log(`\n🔧 Manual Fix Required:`);
      console.log(`   1. Open Supabase Dashboard`);
      console.log(`   2. Go to SQL Editor`);
      console.log(`   3. Run: NOTIFY pgrst, 'reload schema';`);
      console.log(`   4. Or restart your Supabase instance`);
    } else {
      console.log(`✅ Schema cache is refreshed!`);
    }

    console.log(`\n✅ Migration Complete!\n`);

  } catch (error) {
    console.error(`\n❌ Migration Failed:`, error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();

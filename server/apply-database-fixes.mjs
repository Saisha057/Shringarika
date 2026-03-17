import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function applyFixes() {
  console.log('🔧 === APPLYING DATABASE FIXES ===\n');
  console.log('⚠️  WARNING: This will modify your database schema and policies');
  console.log('⚠️  Make sure you have a backup before proceeding!\n');

  // Read the SQL fix file
  const sqlPath = join(__dirname, 'database', 'FINAL_COMPREHENSIVE_FIX.sql');
  const sqlContent = readFileSync(sqlPath, 'utf8');

  // Split into individual statements (basic splitting by semicolon)
  const statements = sqlContent
    .split(';')
    .map(s => s.trim())
    .filter(s => 
      s.length > 0 && 
      !s.startsWith('--') && 
      !s.match(/^={3,}/) &&
      !s.match(/^PHASE \d+:/)
    );

  console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  // Execute statements in batches
  console.log('🚀 Starting execution...\n');

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    
    // Skip empty or comment-only statements
    if (!statement || statement.trim().length === 0) {
      continue;
    }

    try {
      // Execute via Supabase's SQL execution
      const { error } = await supabase.rpc('exec_sql', {
        sql: statement + ';'
      });

      if (error) {
        // Try alternative: direct query
        const { error: queryError } = await supabase.from('_sql').select('*').limit(0);
        
        if (error.code === 'PGRST202') {
          // Function doesn't exist, try manual execution
          console.log(`⚠️  Statement ${i + 1}: Cannot execute via RPC (use SQL Editor)`);
          console.log(`   ${statement.substring(0, 100)}...`);
        } else {
          throw error;
        }
      } else {
        successCount++;
        if (i % 10 === 0) {
          console.log(`✅ Progress: ${i + 1}/${statements.length} statements`);
        }
      }
    } catch (err) {
      errorCount++;
      errors.push({
        statement: i + 1,
        error: err.message,
        sql: statement.substring(0, 100)
      });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 EXECUTION SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`📝 Total Statements: ${statements.length}`);

  if (errors.length > 0) {
    console.log('\n⚠️  ERRORS ENCOUNTERED:\n');
    errors.forEach((err, i) => {
      console.log(`${i + 1}. Statement #${err.statement}: ${err.error}`);
      console.log(`   SQL: ${err.sql}...`);
    });
  }

  console.log('\n📋 MANUAL EXECUTION REQUIRED:');
  console.log('Due to Supabase limitations, you must manually execute the SQL fix script:');
  console.log('1. Open Supabase Dashboard');
  console.log('2. Go to SQL Editor');
  console.log('3. Copy contents from: server/database/FINAL_COMPREHENSIVE_FIX.sql');
  console.log('4. Paste and click "Run"');
  console.log('\n✅ The script is idempotent - safe to run multiple times.\n');
}

async function verifyFixes() {
  console.log('\n🔍 === VERIFYING FIXES ===\n');

  // Test 1: Check if anonymous user can read products
  const anonClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  const { data: products, error: prodError } = await anonClient
    .from('products')
    .select('id, name')
    .limit(1);

  if (prodError) {
    console.log('❌ Test 1 Failed: Anonymous users cannot read products');
  } else {
    console.log('✅ Test 1 Passed: Products publicly readable');
  }

  // Test 2: Check if anonymous user can write products (should fail)
  const { error: writeError } = await anonClient
    .from('products')
    .insert({ name: 'Test', slug: 'test-' + Date.now(), price: 100 });

  if (writeError) {
    console.log('✅ Test 2 Passed: Anonymous users cannot write products');
  } else {
    console.log('❌ Test 2 Failed: Anonymous users CAN write products - SECURITY ISSUE!');
    // Clean up
    await supabase.from('products').delete().eq('name', 'Test');
  }

  // Test 3: Check if anonymous user can read orders (should fail)
  const { data: orders, error: ordersError } = await anonClient
    .from('orders')
    .select('*')
    .limit(1);

  if (ordersError) {
    console.log('✅ Test 3 Passed: Anonymous users cannot read orders');
  } else if (!orders || orders.length === 0) {
    console.log('✅ Test 3 Passed: Anonymous users cannot read orders');
  } else {
    console.log('❌ Test 3 Failed: Anonymous users CAN read orders - PRIVACY ISSUE!');
  }

  // Test 4: Check indexes exist
  console.log('\n📋 Checking Indexes...');
  console.log('(Must be verified via SQL Editor - see verification queries in fix script)');

  console.log('\n✅ Verification complete!\n');
}

// Main execution
async function main() {
  try {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║   SHRINGARIKA DATABASE FIX APPLICATION TOOL           ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    await applyFixes();
    
    console.log('\n⏳ Waiting 5 seconds before verification...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await verifyFixes();

    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║   IMPORTANT: MANUAL SQL EXECUTION REQUIRED            ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    console.log('📖 Read the full guide: server/database/AUDIT_REPORT_AND_FIX_GUIDE.md');
    console.log('📄 SQL Script: server/database/FINAL_COMPREHENSIVE_FIX.sql\n');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();

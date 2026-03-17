import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getSupabaseAdmin } from './config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔧 Applying CRITICAL FIX: UUID type mismatch in stock functions...\n');

async function applyFix() {
  try {
    const supabase = getSupabaseAdmin();
    
    // Read the SQL fix file
    const sqlPath = join(__dirname, 'database', 'CRITICAL_FIX_UUID_TYPE.sql');
    const sql = readFileSync(sqlPath, 'utf-8');
    
    // Split into individual statements (basic split on CREATE OR REPLACE FUNCTION)
    const statements = sql
      .split(/(?=CREATE OR REPLACE FUNCTION)/g)
      .filter(s => s.trim().length > 0);
    
    console.log(`📝 Found ${statements.length} statements to execute\n`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      
      if (statement.startsWith('--') || statement.length < 10) {
        continue;
      }
      
      // Extract function name for logging
      const funcNameMatch = statement.match(/CREATE OR REPLACE FUNCTION (\w+)/);
      const funcName = funcNameMatch ? funcNameMatch[1] : `Statement ${i + 1}`;
      
      console.log(`⏳ Executing: ${funcName}...`);
      
      const { error } = await supabase.rpc('exec_sql', { sql_query: statement }).catch(async () => {
        // If exec_sql doesn't exist, try direct execution
        return await fetch(process.env.SUPABASE_URL + '/rest/v1/rpc/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
          },
          body: JSON.stringify({ query: statement })
        });
      });
      
      if (error) {
        console.error(`❌ Failed to execute ${funcName}:`, error);
        
        // Try alternative method: direct PostgreSQL connection would be needed
        console.log(`\n⚠️  Please run this SQL manually in Supabase SQL Editor:`);
        console.log(`\n--- Copy from here ---`);
        console.log(statement);
        console.log(`--- Copy to here ---\n`);
        
        process.exit(1);
      }
      
      console.log(`✅ ${funcName} updated successfully\n`);
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ CRITICAL FIX APPLIED SUCCESSFULLY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📋 Summary:');
    console.log('   • Changed v_product_id from TEXT to UUID');
    console.log('   • Added proper UUID casting: (v_item->>\'productId\')::UUID');
    console.log('   • Fixed functions: check_stock_availability, deduct_stock_on_order');
    console.log('\n🧪 Next Step: Test order creation');
    console.log('   1. Place an order through the UI');
    console.log('   2. Check backend console for "✅ Stock deducted" message');
    console.log('   3. Verify order appears in database (not just localStorage)');
    console.log('\n');
    
  } catch (err) {
    console.error('❌ Fatal error:', err);
    console.log('\n⚠️  MANUAL FIX REQUIRED');
    console.log('Please run the SQL file manually:');
    console.log('File: server/database/CRITICAL_FIX_UUID_TYPE.sql');
    console.log('\nSteps:');
    console.log('1. Open Supabase Dashboard → SQL Editor');
    console.log('2. Copy contents of CRITICAL_FIX_UUID_TYPE.sql');
    console.log('3. Paste and run in SQL Editor');
    console.log('4. Verify "CRITICAL FIX APPLIED" message appears');
    process.exit(1);
  }
}

// Check for Supabase connection
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  console.log('\n⚠️  MANUAL FIX REQUIRED');
  console.log('Run this SQL manually in Supabase Dashboard:');
  console.log('File: server/database/CRITICAL_FIX_UUID_TYPE.sql\n');
  process.exit(1);
}

applyFix();

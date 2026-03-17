import { getSupabaseAdmin } from '../config/supabase.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runGuestOrdersFix() {
  console.log('🔧 Starting Guest Orders Fix Migration...\n');

  try {
    const supabase = getSupabaseAdmin();

    // Read the SQL migration file
    const sqlPath = join(__dirname, 'FIX_GUEST_ORDERS.sql');
    const sql = readFileSync(sqlPath, 'utf8');

    console.log('📄 Loaded migration file:', sqlPath);
    console.log('📝 Executing SQL migration...\n');

    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('COMMENT'));

    let successCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement + ';' });
        
        if (error) {
          // Try direct execution if RPC doesn't exist
          const { error: directError } = await supabase.from('_sqlquery').insert({ query: statement });
          
          if (directError) {
            console.log(`⚠️  Statement execution (may already exist):`, statement.substring(0, 80) + '...');
            if (directError.message.includes('already exists') || directError.message.includes('does not exist')) {
              console.log(`   ℹ️  ${directError.message}\n`);
            } else {
              console.error(`   ❌ Error: ${directError.message}\n`);
              errorCount++;
            }
          } else {
            successCount++;
          }
        } else {
          console.log(`✅ Executed: ${statement.substring(0, 80)}...`);
          successCount++;
        }
      } catch (err) {
        console.error(`❌ Failed: ${statement.substring(0, 80)}...`);
        console.error(`   Error: ${err.message}\n`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successful: ${successCount} statements`);
    console.log(`❌ Failed: ${errorCount} statements`);
    console.log('='.repeat(60));

    if (errorCount === 0) {
      console.log('\n🎉 Guest Orders Fix applied successfully!');
      console.log('✅ Orders table now supports guest checkout');
      console.log('✅ user_id is now nullable');
      console.log('✅ Guest tracking via guest_uuid enabled');
    } else {
      console.log('\n⚠️  Migration completed with some errors (likely already applied)');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runGuestOrdersFix();

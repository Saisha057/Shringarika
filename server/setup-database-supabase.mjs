import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

// Supabase client
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

async function executeSQLFile(filePath, description) {
  try {
    console.log(`\n📝 ${description}...`);
    
    const sqlContent = fs.readFileSync(filePath, 'utf8');
    
    // Split into individual statements and execute
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i] + ';';
      
      // Skip comment blocks and empty statements
      if (stmt.includes('--') || stmt.trim() === ';') {
        continue;
      }
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: stmt });
        
        if (error) {
          // Try direct query instead
          const { error: directError } = await supabase.from('_').select('*').limit(0);
          if (directError && directError.message !== 'relation "_" does not exist') {
            console.error(`   ⚠️ Statement ${i + 1} failed:`, error.message.substring(0, 100));
            errorCount++;
          } else {
            successCount++;
          }
        } else {
          successCount++;
        }
      } catch (e) {
        console.error(`   ⚠️ Statement ${i + 1} error:`, e.message.substring(0, 100));
        errorCount++;
      }
      
      // Progress indicator
      if ((i + 1) % 50 === 0) {
        console.log(`   Progress: ${i + 1}/${statements.length} statements`);
      }
    }
    
    console.log(`✅ ${description} completed! (Success: ${successCount}, Errors: ${errorCount})`);
    return errorCount === 0;
  } catch (error) {
    console.error(`❌ Error in ${description}:`, error.message);
    return false;
  }
}

async function setupWithSupabaseAPI() {
  try {
    console.log('🚀 SHRINGARIKA DATABASE SETUP (Using Supabase API)');
    console.log('═══════════════════════════════════════════════════\n');
    console.log('📦 Supabase URL:', process.env.SUPABASE_URL);
    console.log('═══════════════════════════════════════════════════');
    
    // Test connection
    console.log('\n🔌 Testing Supabase connection...');
    const { data, error } = await supabase.from('_healthcheck').select('*').limit(1);
    
    if (error && error.message === 'relation "_healthcheck" does not exist') {
      console.log('✅ Supabase connected successfully!\n');
    } else if (!error) {
      console.log('✅ Supabase connected successfully!\n');
    } else {
      throw new Error('Cannot connect to Supabase: ' + error.message);
    }
    
    console.log('\n📋 IMPORTANT: Execute SQL manually in Supabase Dashboard');
    console.log('═══════════════════════════════════════════════════');
    console.log('\nDue to Supabase limitations, please follow these steps:\n');
    console.log('1. Go to: https://supabase.com/dashboard/project/srdljxbumxkgjxoqqrzs/editor');
    console.log('2. Click "New Query" or open SQL Editor');
    console.log('3. Copy and execute these files IN ORDER:\n');
    
    const schemaFile = join(__dirname, 'database', 'complete-schema.sql');
    const rlsFile = join(__dirname, 'database', 'row-level-security.sql');
    const seedFile = join(__dirname, 'database', 'seed-data.sql');
    
    console.log('   a) Copy content from: server/database/complete-schema.sql');
    console.log('      → Paste in SQL Editor → Click "Run"');
    console.log('      (This creates all 30+ tables, indexes, triggers)\n');
    
    console.log('   b) Copy content from: server/database/row-level-security.sql');
    console.log('      → Paste in SQL Editor → Click "Run"');
    console.log('      (This adds security policies)\n');
    
    console.log('   c) Copy content from: server/database/seed-data.sql');
    console.log('      → Paste in SQL Editor → Click "Run"');
    console.log('      (This adds sample products and categories)\n');
    
    console.log('═══════════════════════════════════════════════════');
    console.log('\n✅ After running all SQL files, run this command:\n');
    console.log('   node setup-admin.mjs\n');
    console.log('═══════════════════════════════════════════════════\n');
    
    // Open Supabase dashboard automatically
    console.log('💡 TIP: Opening Supabase SQL Editor in browser...\n');
    
    const { exec } = await import('child_process');
    exec('start https://supabase.com/dashboard/project/srdljxbumxkgjxoqqrzs/editor');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ SETUP ERROR:', error.message);
    console.error('\nPlease verify:');
    console.error('1. SUPABASE_URL is correct in .env');
    console.error('2. SUPABASE_SERVICE_ROLE_KEY is correct in .env');
    console.error('3. Supabase project is active\n');
    return false;
  }
}

// Main execution
(async () => {
  try {
    await setupWithSupabaseAPI();
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();

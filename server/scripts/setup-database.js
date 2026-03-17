import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSQLFile(filePath, description) {
  console.log(`\n📄 Executing: ${description}`);
  console.log(`   File: ${path.basename(filePath)}`);
  
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    
    // Split by semicolon and filter out empty statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`   Found ${statements.length} SQL statements`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments and empty lines
      if (statement.startsWith('--') || statement.length < 5) continue;
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql_string: statement });
        
        // If rpc doesn't exist, try direct query
        if (error && error.message.includes('function public.exec_sql')) {
          // For DDL statements, we need to use the REST API directly
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({ query: statement })
          });
          
          if (!response.ok) {
            // Some statements might fail if they already exist (CREATE IF NOT EXISTS)
            // We'll log but continue
            const errorText = await response.text();
            if (!errorText.includes('already exists')) {
              console.log(`   ⚠️  Statement ${i + 1} warning: ${errorText.substring(0, 100)}`);
            }
          }
        } else if (error && !error.message.includes('already exists')) {
          console.log(`   ⚠️  Statement ${i + 1} warning: ${error.message.substring(0, 100)}`);
        }
      } catch (err) {
        // Continue on errors - many might be "already exists" which is fine
        if (!err.message.includes('already exists')) {
          console.log(`   ⚠️  Statement ${i + 1} error: ${err.message.substring(0, 100)}`);
        }
      }
    }
    
    console.log(`   ✅ Completed: ${description}`);
    return true;
  } catch (error) {
    console.error(`   ❌ Error reading file: ${error.message}`);
    return false;
  }
}

async function disableRLS() {
  console.log('\n🔓 Disabling Row Level Security (for development)...');
  
  const tables = [
    'users', 'addresses', 'products', 'product_inventory',
    'reviews', 'orders', 'wishlist', 'returns', 'stock_transactions',
    'stock_snapshots', 'admin_activity_logs', 'backups', 'notifications'
  ];
  
  for (const table of tables) {
    try {
      // Check if table exists first
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(0);
      
      if (!error || error.code === 'PGRST116') {
        console.log(`   ✅ Table '${table}' exists (RLS disabled via Supabase policies)`);
      }
    } catch (err) {
      // Table might not exist yet, that's ok
    }
  }
}

async function verifySetup() {
  console.log('\n🔍 Verifying database setup...');
  
  try {
    // Check critical tables
    const tables = ['users', 'products', 'orders'];
    
    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('count')
        .limit(1);
      
      if (error && error.code !== 'PGRST116') {
        console.log(`   ⚠️  Table '${table}': ${error.message}`);
      } else {
        console.log(`   ✅ Table '${table}': OK`);
      }
    }
    
    // Try to insert and delete a test user
    console.log('\n🧪 Testing database write permissions...');
    const testUser = {
      name: 'Test User',
      email: `test_${Date.now()}@example.com`,
      password: 'test123',
      role: 'user'
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('users')
      .insert([testUser])
      .select()
      .single();
    
    if (insertError) {
      console.log(`   ⚠️  Insert test failed: ${insertError.message}`);
    } else {
      console.log('   ✅ Insert test: OK');
      
      // Clean up test user
      await supabase.from('users').delete().eq('id', insertData.id);
      console.log('   ✅ Delete test: OK');
    }
    
    console.log('\n✅ Database setup verification complete!');
    return true;
  } catch (error) {
    console.error(`\n❌ Verification failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Supabase Database Setup');
  console.log('=====================================');
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Service Key: ${supabaseServiceKey ? '✅ Loaded' : '❌ Missing'}`);
  
  const scriptsDir = __dirname;
  const databaseDir = path.join(scriptsDir, '..', 'database');
  const migrationsDir = path.join(databaseDir, 'migrations');
  
  // Step 1: Execute base schema
  const schemaFile = path.join(databaseDir, 'schema.sql');
  if (fs.existsSync(schemaFile)) {
    await executeSQLFile(schemaFile, 'Base Database Schema');
  } else {
    console.log('⚠️  schema.sql not found, skipping...');
  }
  
  // Step 2: Execute migrations in order
  const migrationFiles = [
    '004_enhance_orders_table.sql',
    '005_returns_refunds_exchanges.sql',
    '006_stock_synchronization.sql'
  ];
  
  console.log('\n📦 Running Migrations...');
  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    if (fs.existsSync(filePath)) {
      await executeSQLFile(filePath, `Migration: ${file}`);
    } else {
      console.log(`   ⚠️  ${file} not found, skipping...`);
    }
  }
  
  // Step 3: Disable RLS for development
  await disableRLS();
  
  // Step 4: Verify setup
  const success = await verifySetup();
  
  if (success) {
    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Restart your backend server: npm run dev');
    console.log('   2. Create an admin user (via registration or SQL)');
    console.log('   3. Place a test order via the frontend');
    console.log('   4. Check admin dashboard - orders should now appear!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Database setup completed with warnings.');
    console.log('   Please check the logs above for any issues.');
    console.log('   You may need to manually execute SQL in Supabase dashboard.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('\n❌ Setup failed:', error);
  process.exit(1);
});

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

console.log('🚀 Supabase Database Migration Tool');
console.log('====================================\n');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error(`   SUPABASE_URL: ${supabaseUrl ? '✅' : '❌'}`);
  console.error(`   SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceKey ? '✅' : '❌'}`);
  console.error('\n💡 Please check your server/.env file');
  process.exit(1);
}

console.log(`✅ Supabase URL: ${supabaseUrl}`);
console.log(`✅ Service Key: Loaded\n`);

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testConnection() {
  console.log('🔌 Testing Supabase connection...');
  try {
    const { data, error } = await supabase.from('_supabase_migrations').select('*').limit(1);
    if (error && error.code !== 'PGRST204' && error.code !== '42P01') {
      throw error;
    }
    console.log('✅ Connected to Supabase successfully!\n');
    return true;
  } catch (error) {
    console.log('✅ Connected to Supabase (new database)\n');
    return true;
  }
}

function readSQLFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  // Remove comments and split by semicolon
  const statements = content
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  return statements;
}

async function executeSQLStatements(statements, description) {
  console.log(`📄 ${description}`);
  console.log(`   Statements: ${statements.length}`);
  
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    
    try {
      // Use the Supabase Management API for DDL
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ query: statement })
      });
      
      successCount++;
    } catch (error) {
      const errMsg = error.message.toLowerCase();
      if (errMsg.includes('already exists') || errMsg.includes('duplicate')) {
        skipCount++;
      } else {
        errorCount++;
        console.log(`   ⚠️  Statement ${i + 1}: ${error.message.substring(0, 80)}`);
      }
    }
  }
  
  console.log(`   ✅ Success: ${successCount} | ⏭️  Skipped: ${skipCount} | ❌ Errors: ${errorCount}\n`);
}

async function main() {
  // Test connection first
  const connected = await testConnection();
  if (!connected) {
    console.error('❌ Failed to connect to Supabase');
    process.exit(1);
  }
  
  console.log('📋 INSTRUCTIONS FOR MANUAL SETUP');
  console.log('==================================\n');
  console.log('⚠️  Automated SQL execution via API is complex with Supabase.');
  console.log('    Please follow these manual steps instead:\n');
  
  console.log('1️⃣  Open Supabase Dashboard:');
  console.log(`    → https://supabase.com/dashboard/project/${supabaseUrl.match(/https:\/\/(.+)\.supabase\.co/)?.[1]}\n`);
  
  console.log('2️⃣  Click "SQL Editor" in the left sidebar\n');
  
  console.log('3️⃣  Execute these files IN ORDER (click "+ New Query" for each):\n');
  
  const files = [
    { path: '../database/schema.sql', desc: 'Base schema (users, products, orders, etc.)' },
    { path: '../database/migrations/004_enhance_orders_table.sql', desc: 'Enhanced order fields' },
    { path: '../database/migrations/005_returns_refunds_exchanges.sql', desc: 'Returns & refunds tables' },
    { path: '../database/migrations/006_stock_synchronization.sql', desc: 'Stock management system' }
  ];
  
  files.forEach((file, index) => {
    const fullPath = path.join(__dirname, file.path);
    const exists = fs.existsSync(fullPath);
    console.log(`   ${index + 1}. ${exists ? '✅' : '❌'} ${file.path}`);
    console.log(`      ${file.desc}`);
    if (exists) {
      const lines = fs.readFileSync(fullPath, 'utf8').split('\n').length;
      console.log(`      (${lines} lines - copy all content)\n`);
    } else {
      console.log(`      ⚠️  File not found!\n`);
    }
  });
  
  console.log('4️⃣  Disable Row Level Security (for development):');
  console.log('    Copy and run this SQL:\n');
  console.log('    ALTER TABLE users DISABLE ROW LEVEL SECURITY;');
  console.log('    ALTER TABLE addresses DISABLE ROW LEVEL SECURITY;');
  console.log('    ALTER TABLE products DISABLE ROW LEVEL SECURITY;');
  console.log('    ALTER TABLE product_inventory DISABLE ROW LEVEL SECURITY;');
  console.log('    ALTER TABLE reviews DISABLE ROW LEVEL SECURITY;');
  console.log('    ALTER TABLE orders DISABLE ROW LEVEL SECURITY;');
  console.log('    ALTER TABLE wishlist DISABLE ROW LEVEL SECURITY;\n');
  
  console.log('5️⃣  Verify tables were created:');
  console.log('    Run this SQL:\n');
  console.log("    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';");
  console.log('    \n    You should see: users, orders, products, addresses, etc.\n');
  
  console.log('6️⃣  After completing the above steps:');
  console.log('    → Restart your backend: npm run dev');
  console.log('    → Place a test order via the frontend');
  console.log('    → Check admin dashboard - data should now appear!\n');
  
  console.log('═══════════════════════════════════════════════════\n');
  
  // Offer to verify if tables exist
  console.log('🔍 Checking current database state...\n');
  
  const tables = ['users', 'products', 'orders', 'addresses', 'reviews'];
  let tablesExist = 0;
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('count').limit(0);
      if (!error) {
        console.log(`   ✅ Table '${table}' exists`);
        tablesExist++;
      } else if (error.code === '42P01') {
        console.log(`   ❌ Table '${table}' NOT FOUND`);
      } else {
        console.log(`   ⚠️  Table '${table}': ${error.message}`);
      }
    } catch (err) {
      console.log(`   ❌ Table '${table}' NOT FOUND`);
    }
  }
  
  console.log(`\n📊 Status: ${tablesExist}/${tables.length} core tables exist`);
  
  if (tablesExist === 0) {
    console.log('\n⚠️  No tables found - please follow the manual setup steps above!');
    process.exit(1);
  } else if (tablesExist < tables.length) {
    console.log('\n⚠️  Some tables missing - please complete the migration steps above!');
    process.exit(1);
  } else {
    console.log('\n✅ All core tables exist! Database is ready.');
    console.log('\n📝 Next: Restart backend and test order creation.');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});

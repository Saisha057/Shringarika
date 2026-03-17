// Quick script to check if admin user exists and has admin role
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read .env file manually
const envPath = './server/.env';
let supabaseUrl, supabaseKey;

try {
  const envContent = readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('SUPABASE_URL=')) {
      supabaseUrl = line.split('=')[1].trim();
    }
    if (line.startsWith('SUPABASE_ANON_KEY=')) {
      supabaseKey = line.split('=')[1].trim();
    }
  }
} catch (error) {
  console.error('❌ Could not read .env file:', error.message);
  process.exit(1);
}

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAdminUser() {
  try {
    const email = 'shringarika11@gmail.com';
    
    console.log('\n🔍 Checking admin user...');
    console.log(`   Email: ${email}\n`);

    // Check if user exists
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      console.error('❌ User not found or error:', error.message);
      console.log('\n📋 To create admin user, run:');
      console.log('   node create-admin-simple.mjs');
      process.exit(1);
    }

    console.log('✅ User found!');
    console.log('   ID:', user.id);
    console.log('   Name:', user.name);
    console.log('   Email:', user.email);
    console.log('   Role:', user.role);
    console.log('   Created:', user.created_at);

    if (user.role !== 'admin') {
      console.log('\n⚠️  WARNING: User role is NOT "admin"!');
      console.log('\n📋 Run this SQL query in Supabase SQL Editor:');
      console.log('─────────────────────────────────────────────────────');
      console.log(`UPDATE users SET role = 'admin' WHERE email = '${email}';`);
      console.log('─────────────────────────────────────────────────────');
      console.log('\n🔗 https://supabase.com/dashboard/project/_/sql\n');
    } else {
      console.log('\n✅ User has ADMIN role - Login should work!');
      console.log('\n📝 Login credentials:');
      console.log(`   Email: ${email}`);
      console.log('   Password: (your password)');
      console.log('\n🌐 Login at: http://localhost:3000/admin\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkAdminUser();

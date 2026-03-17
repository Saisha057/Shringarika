// Comprehensive admin login diagnostic and fix script
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read .env file
const envPath = './server/.env';
let supabaseUrl, supabaseServiceKey;

try {
  const envContent = readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('SUPABASE_URL=')) {
      supabaseUrl = line.split('=')[1].trim();
    }
    if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
      supabaseServiceKey = line.split('=')[1].trim();
    }
  }
} catch (error) {
  console.error('❌ Could not read .env file');
  process.exit(1);
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixAdminLogin() {
  try {
    const email = 'shringarika11@gmail.com';
    
    console.log('\n🔍 ADMIN LOGIN DIAGNOSTIC\n');
    console.log('Checking user:', email);
    console.log('─────────────────────────────────────\n');

    // Check if user exists
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email);

    if (error) {
      console.error('❌ Database error:', error.message);
      process.exit(1);
    }

    if (!users || users.length === 0) {
      console.error('❌ User not found in database!');
      console.log('\n📋 Solution: Run this command to create the user:');
      console.log('   node create-admin-for-email.mjs\n');
      process.exit(1);
    }

    const user = users[0];
    
    console.log('✅ User found!');
    console.log('   ID:', user.id);
    console.log('   Name:', user.name);
    console.log('   Email:', user.email);
    console.log('   Current Role:', user.role);
    console.log('   Created:', user.created_at);
    console.log('   Verified:', user.is_verified);

    if (user.role === 'admin') {
      console.log('\n✅ User already has ADMIN role!');
      console.log('\n📝 Login should work with:');
      console.log('   Email:', email);
      console.log('   Password: (your password)');
      console.log('\n🌐 Try logging in at: http://localhost:3000/admin\n');
      process.exit(0);
    }

    // Update to admin role
    console.log('\n⚡ Updating user role to ADMIN...');
    
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        role: 'admin',
        is_verified: true, // Ensure verified
        updated_at: new Date().toISOString()
      })
      .eq('email', email);

    if (updateError) {
      console.error('❌ Failed to update role:', updateError.message);
      console.log('\n📋 Manual fix: Run this SQL in Supabase:');
      console.log('─────────────────────────────────────────────────────');
      console.log(`UPDATE users SET role = 'admin', is_verified = true WHERE email = '${email}';`);
      console.log('─────────────────────────────────────────────────────');
      process.exit(1);
    }

    console.log('✅ Role updated successfully!');
    console.log('\n🎉 ADMIN ACCESS GRANTED!\n');
    console.log('📝 Login credentials:');
    console.log('   Email:', email);
    console.log('   Password: (your password)');
    console.log('\n🌐 Login at: http://localhost:3000/admin');
    console.log('\n✨ The admin dashboard should now work!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixAdminLogin();

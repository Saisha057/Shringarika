// Reset admin password
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';

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

async function resetPassword() {
  try {
    const email = 'shringarika11@gmail.com';
    const newPassword = 'Admin@123';
    
    console.log('\n🔐 RESETTING ADMIN PASSWORD\n');
    console.log('Email:', email);
    console.log('New Password:', newPassword);
    console.log('\nHashing password...');

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    console.log('✅ Password hashed');
    console.log('\nUpdating in database...');

    // Update password in database
    const { error } = await supabase
      .from('users')
      .update({ 
        password: hashedPassword,
        updated_at: new Date().toISOString()
      })
      .eq('email', email);

    if (error) {
      console.error('❌ Failed to update password:', error.message);
      process.exit(1);
    }

    console.log('✅ Password updated successfully!');
    console.log('\n🎉 ADMIN LOGIN READY!\n');
    console.log('📝 Login credentials:');
    console.log('   Email:', email);
    console.log('   Password:', newPassword);
    console.log('\n🌐 Login at: http://localhost:3000/admin');
    console.log('\n✨ Try logging in now!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetPassword();

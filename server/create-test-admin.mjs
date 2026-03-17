import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestAdmin() {
  try {
    const email = 'shringarika11@gmail.com';
    const password = 'Admin@123456';
    const name = 'Shringarika Admin';

    console.log('\n🔄 Updating admin account...');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Name: ${name}\n`);

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (existingUser) {
      // Update existing user to admin with new password
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          role: 'admin', 
          password: hashedPassword,
          name: name,
          updated_at: new Date().toISOString()
        })
        .eq('email', email);

      if (updateError) {
        console.error('❌ Failed to update user:', updateError.message);
        process.exit(1);
      }

      console.log('✅ Updated existing user to admin role with new credentials');
    } else {
      console.error('❌ User account not found. Please register the account first at http://localhost:3000');
      console.log('\n📝 Steps to create account:');
      console.log('   1. Go to http://localhost:3000');
      console.log('   2. Click Sign Up');
      console.log(`   3. Register with email: ${email}`);
      console.log(`   4. Use password: ${password}`);
      console.log('   5. Run this script again to upgrade to admin\n');
      process.exit(1);
    }

    console.log('\n✅ ADMIN ACCOUNT READY:');
    console.log('   Email: shringarika11@gmail.com');
    console.log('   Password: Admin@123456');
    console.log('   Role: admin');
    console.log('\n🌐 Login at: http://localhost:3000');
    console.log('   Press Ctrl+Shift+A to open Admin Dashboard');
    console.log('\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createTestAdmin();

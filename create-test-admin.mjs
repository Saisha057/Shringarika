import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

dotenv.config({ path: './server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestAdmin() {
  try {
    const email = 'admin@shringarika.test';
    const password = 'Admin@123456';
    const name = 'Test Admin';

    console.log('\n🔄 Creating test admin account...');
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
      // Update existing user to admin
      const { error: updateError } = await supabase
        .from('users')
        .update({ role: 'admin', password: hashedPassword })
        .eq('email', email);

      if (updateError) {
        console.error('❌ Failed to update user:', updateError.message);
        process.exit(1);
      }

      console.log('✅ Updated existing user to admin role');
    } else {
      // Create new user
      const { error: insertError } = await supabase
        .from('users')
        .insert([
          {
            name,
            email,
            password: hashedPassword,
            role: 'admin',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);

      if (insertError) {
        console.error('❌ Failed to create user:', insertError.message);
        process.exit(1);
      }

      console.log('✅ Created new admin user');
    }

    console.log('\n✅ TEST ADMIN READY:');
    console.log('   Email: admin@shringarika.test');
    console.log('   Password: Admin@123456');
    console.log('   Role: admin');
    console.log('\n🌐 Login at: http://localhost:3000');
    console.log('\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createTestAdmin();

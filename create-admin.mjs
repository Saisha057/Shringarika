import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
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
  console.log('   Looking for: SUPABASE_URL and SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
  try {
    const email = 'admin@shringarika.com';
    const password = 'Admin@123';
    const name = 'Shringarika Admin';

    console.log('\n🔄 Creating admin account...');
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
        console.log('   Error details:', insertError);
        process.exit(1);
      }

      console.log('✅ Created new admin user');
    }

    console.log('\n✅ ADMIN USER READY:');
    console.log('   Email: admin@shringarika.com');
    console.log('   Password: Admin@123');
    console.log('   Role: admin');
    console.log('\n🌐 Login at: http://localhost:3000/admin-login-test.html');
    console.log('   Or use the admin dashboard at: http://localhost:3000/admin');
    console.log('\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('   Full error:', error);
    process.exit(1);
  }
}

createAdmin();

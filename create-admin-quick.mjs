import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
  try {
    console.log('🔧 Creating/Updating admin user...\n');

    const email = 'admin@shringarika.com';
    const password = 'Admin@123';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if admin exists
    const { data: existingAdmin, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (existingAdmin) {
      console.log('✅ Admin user already exists:', email);
      console.log('📝 Role:', existingAdmin.role);
      
      // Update to make sure they're admin
      const { error: updateError } = await supabase
        .from('users')
        .update({
          role: 'admin',
          password_hash: hashedPassword,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('email', email);

      if (updateError) {
        console.error('❌ Error updating admin:', updateError);
      } else {
        console.log('✅ Admin user updated successfully!');
      }
    } else {
      // Create new admin
      const { data: newAdmin, error: createError } = await supabase
        .from('users')
        .insert([{
          email: email,
          password_hash: hashedPassword,
          role: 'admin',
          is_active: true,
          is_verified: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating admin:', createError);
      } else {
        console.log('✅ Admin user created successfully!');
        console.log('📧 Email:', newAdmin.email);
        console.log('🔑 Password: Admin@123');
        
        // Create profile
        try {
          await supabase
            .from('profiles')
            .insert([{
              user_id: newAdmin.id,
              first_name: 'Admin',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }]);
          console.log('✅ Admin profile created');
        } catch (profileError) {
          console.log('⚠️ Could not create profile (table may not exist)');
        }
      }
    }

    console.log('\n✅ Admin setup complete!');
    console.log('\n📋 Login Credentials:');
    console.log('   Email: admin@shringarika.com');
    console.log('   Password: Admin@123');
    console.log('\n🔗 Login URL: http://localhost:3000/admin-login-test.html');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createAdmin();

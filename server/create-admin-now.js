import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config(); // Will load from server/.env

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
      console.log('📝 Current Role:', existingAdmin.role);
      console.log('📝 Is Active:', existingAdmin.is_active);
      
      // Update to make sure they're admin with fresh password
      const { error: updateError } = await supabase
        .from('users')
        .update({
          role: 'admin',
          password_hash: hashedPassword,
          is_active: true,
          is_verified: true,
          updated_at: new Date().toISOString()
        })
        .eq('email', email);

      if (updateError) {
        console.error('❌ Error updating admin:', updateError);
      } else {
        console.log('✅ Admin user updated successfully!');
        console.log('🔄 Password reset to: Admin@123');
      }
    } else {
      console.log('📝 Admin user does not exist, creating new one...');
      
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
        return;
      }
      
      console.log('✅ Admin user created successfully!');
      console.log('📧 Email:', newAdmin.email);
      console.log('🆔 User ID:', newAdmin.id);
      
      // Create profile
      try {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([{
            user_id: newAdmin.id,
            first_name: 'Admin',
            last_name: 'Shringarika',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]);
        
        if (profileError) {
          console.log('⚠️ Profile creation error:', profileError.message);
        } else {
          console.log('✅ Admin profile created');
        }
      } catch (profileError) {
        console.log('⚠️ Could not create profile');
      }
    }

    console.log('\n✅ Admin setup complete!');
    console.log('\n📋 Login Credentials:');
    console.log('   Email: admin@shringarika.com');
    console.log('   Password: Admin@123');
    console.log('\n🔗 Login URL: http://localhost:3000/admin-login-test.html');
    console.log('\n💡 You can now login and test admin features');

    process.exit(0);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

createAdmin();

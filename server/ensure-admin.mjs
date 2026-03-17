import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ADMIN_EMAIL = 'shringarik11@gmail.com';
const ADMIN_PASSWORD = 'Admin@123456';

async function ensureAdminUser() {
  console.log('🔐 Ensuring admin user exists...\n');
  console.log('📧 Email:', ADMIN_EMAIL);
  console.log('🔗 Database:', process.env.SUPABASE_URL);
  console.log('─'.repeat(50));
  
  try {
    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', ADMIN_EMAIL)
      .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('❌ Error fetching user:', fetchError.message);
      return;
    }
    
    if (existingUser) {
      console.log('\n✅ User exists!');
      console.log('   ID:', existingUser.id);
      console.log('   Email:', existingUser.email);
      console.log('   Current Role:', existingUser.role);
      
      // Update to admin if not already
      if (existingUser.role !== 'admin') {
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            role: 'admin',
            is_active: true,
            is_verified: true,
            updated_at: new Date().toISOString()
          })
          .eq('email', ADMIN_EMAIL);
        
        if (updateError) {
          console.error('\n❌ Failed to update role:', updateError.message);
        } else {
          console.log('\n✅ User role updated to ADMIN!');
        }
      } else {
        console.log('\n✅ User is already an admin!');
      }
    } else {
      console.log('\n📝 Creating new admin user...');
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
      
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([{
          email: ADMIN_EMAIL,
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
        console.error('❌ Failed to create admin:', createError.message);
      } else {
        console.log('✅ Admin user created successfully!');
        console.log('   ID:', newUser.id);
        console.log('   Email:', newUser.email);
        console.log('   Role:', newUser.role);
      }
    }
    
    console.log('\n─'.repeat(50));
    console.log('🔑 Login credentials:');
    console.log('   Email:', ADMIN_EMAIL);
    console.log('   Password:', ADMIN_PASSWORD);
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

ensureAdminUser().then(() => process.exit(0));

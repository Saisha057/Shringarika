import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const email = process.argv[2];

if (!email) {
  console.error('❌ Please provide an email address');
  console.log('Usage: node make-admin.js <email>');
  process.exit(1);
}

async function makeAdmin() {
  try {
    console.log(`🔄 Finding user with email: ${email}`);
    
    // Get the user
    const { data: user, error: getUserError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (getUserError || !user) {
      console.error('❌ User not found:', getUserError?.message);
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.name} (${user.email})`);
    console.log(`   Current role: ${user.role}`);

    // Update the user to admin
    const { error: updateError } = await supabase
      .from('users')
      .update({ role: 'admin' })
      .eq('id', user.id);

    if (updateError) {
      console.error('❌ Failed to update user role:', updateError.message);
      process.exit(1);
    }

    console.log('✅ User role updated to admin!');
    console.log(`✅ ${user.name} (${email}) is now an admin`);
    console.log('\n✅ Please refresh your browser and try accessing the admin dashboard again');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

makeAdmin();

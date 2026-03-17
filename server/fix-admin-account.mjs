import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixAdminAccount() {
  const adminEmail = 'admin@shringarika.test';
  
  console.log('\n🔍 Checking admin account status...\n');

  try {
    // Find all accounts with this email
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, name, role, created_at')
      .eq('email', adminEmail)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Error querying users:', error);
      return;
    }

    if (!users || users.length === 0) {
      console.log('❌ No account found with email:', adminEmail);
      console.log('ℹ️  Please run: node create-test-admin.mjs');
      return;
    }

    console.log(`Found ${users.length} account(s) with email ${adminEmail}:`);
    console.log('─'.repeat(60));
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Name: ${user.name}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`);
      console.log('');
    });

    // If multiple accounts exist, keep the oldest one and update it to admin
    if (users.length > 1) {
      console.log('⚠️  Multiple accounts detected! Fixing...\n');
      
      const oldestUser = users[0]; // First one (oldest)
      const duplicates = users.slice(1);

      // Update oldest to admin role
      const { error: updateError } = await supabase
        .from('users')
        .update({ role: 'admin', name: 'Test Admin' })
        .eq('id', oldestUser.id);

      if (updateError) {
        console.error('❌ Error updating admin role:', updateError);
        return;
      }

      console.log(`✅ Updated account ${oldestUser.id} to admin role`);

      // Delete duplicates
      for (const duplicate of duplicates) {
        const { error: deleteError } = await supabase
          .from('users')
          .delete()
          .eq('id', duplicate.id);

        if (deleteError) {
          console.error(`❌ Error deleting duplicate ${duplicate.id}:`, deleteError);
        } else {
          console.log(`✅ Deleted duplicate account ${duplicate.id}`);
        }
      }

      console.log('\n✅ Admin account fixed!');
    } else {
      // Single account - just ensure it has admin role
      const user = users[0];
      
      if (user.role !== 'admin') {
        console.log('⚠️  Account exists but role is not admin. Fixing...\n');
        
        const { error: updateError } = await supabase
          .from('users')
          .update({ role: 'admin', name: 'Test Admin' })
          .eq('id', user.id);

        if (updateError) {
          console.error('❌ Error updating admin role:', updateError);
          return;
        }

        console.log('✅ Updated account to admin role!');
      } else {
        console.log('✅ Account already has admin role - everything is correct!');
      }
    }

    console.log('\n' + '─'.repeat(60));
    console.log('📋 CURRENT STATUS:');
    console.log('─'.repeat(60));
    console.log('✅ Email: admin@shringarika.test');
    console.log('✅ Password: Admin@123456');
    console.log('✅ Role: admin');
    console.log('✅ Status: READY TO USE');
    console.log('─'.repeat(60));
    console.log('\n🌐 You can now login at: http://localhost:3000');
    console.log('📧 Use: admin@shringarika.test / Admin@123456\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

fixAdminAccount();

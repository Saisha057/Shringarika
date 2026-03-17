import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const jwtSecret = process.env.JWT_SECRET;

if (!supabaseUrl || !supabaseKey || !jwtSecret) {
  console.error('❌ Missing Supabase or JWT credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const email = process.argv[2];

if (!email) {
  console.error('❌ Please provide an email address');
  console.log('Usage: node generate-admin-token.js <email>');
  process.exit(1);
}

async function generateAdminToken() {
  try {
    console.log(`🔄 Generating admin token for: ${email}`);
    
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
    console.log(`   Role: ${user.role}`);

    if (user.role !== 'admin') {
      console.log(`⚠️  User is not an admin. Updating role...`);
      const { error: updateError } = await supabase
        .from('users')
        .update({ role: 'admin' })
        .eq('id', user.id);

      if (updateError) {
        console.error('❌ Failed to update user role:', updateError.message);
        process.exit(1);
      }
      console.log('✅ User role updated to admin');
    }

    // Generate JWT token
    const token = jwt.sign({ id: user.id }, jwtSecret, {
      expiresIn: '7d',
    });

    console.log('\n✅ Token generated successfully!');
    console.log('\n📋 Use this token in your browser console:');
    console.log('-------------------------------------------');
    console.log(`localStorage.setItem('authToken', '${token}');`);
    console.log(`localStorage.setItem('user', '${JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role
    })}');`);
    console.log('-------------------------------------------');
    console.log('\n✅ Then reload the page at http://localhost:3000');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

generateAdminToken();

// Simple script to verify admin user and test login
async function testAdminLogin() {
  try {
    console.log('\n🔄 Testing admin login...\n');

    const credentials = {
      email: 'admin@shringarika.com',
      password: 'Admin@123'
    };

    console.log('   Email:', credentials.email);
    console.log('   Password:', credentials.password, '\n');

    // Test login endpoint
    const response = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials)
    });

    const data = await response.json();

    if (response.ok && data.status === 'success') {
      console.log('✅ LOGIN SUCCESSFUL!');
      console.log('\n📋 User Details:');
      console.log('   Email:', data.user.email);
      console.log('   Role:', data.user.role);
      console.log('   Name:', data.user.name);
      console.log('   Token:', data.token.substring(0, 30) + '...');
      
      if (data.user.role === 'admin') {
        console.log('\n✅ USER HAS ADMIN ROLE - All good!');
      } else {
        console.log('\n⚠️  USER DOES NOT HAVE ADMIN ROLE!');
        console.log('\n📋 Please run this SQL query in Supabase:');
        console.log('─────────────────────────────────────────────────────');
        console.log(`UPDATE users SET role = 'admin' WHERE email = 'admin@shringarika.com';`);
        console.log('─────────────────────────────────────────────────────');
        console.log('\n🔗 Supabase SQL Editor: https://supabase.com/dashboard/project/srdljxbumxkgjxoqqrzs/sql');
      }
      
      console.log('\n✅ You can now login at:');
      console.log('   🌐 http://localhost:3000/admin');
      console.log('\n');
    } else {
      console.log('❌ LOGIN FAILED!');
      console.log('   Status:', response.status);
      console.log('   Message:', data.message);
      
      if (data.message && data.message.includes('Invalid credentials')) {
        console.log('\n🔧 Possible issues:');
        console.log('   1. User does not exist in database');
        console.log('   2. Password is incorrect');
        console.log('   3. Email is incorrect\n');
        
        console.log('📋 To create/reset admin user, run this SQL in Supabase:');
        console.log('─────────────────────────────────────────────────────');
        console.log(`-- First, check if user exists
SELECT * FROM users WHERE email = 'admin@shringarika.com';

-- If user exists, just update role
UPDATE users SET role = 'admin' WHERE email = 'admin@shringarika.com';

-- If user doesn't exist, you need to register via the API first
-- OR manually insert (with hashed password)`);
        console.log('─────────────────────────────────────────────────────');
        console.log('\n🔗 Supabase SQL Editor: https://supabase.com/dashboard/project/srdljxbumxkgjxoqqrzs/sql');
      }
      console.log('\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n⚠️  Make sure the backend server is running on port 5000');
    console.log('   Check: http://localhost:5000/api/health\n');
  }
}

testAdminLogin();

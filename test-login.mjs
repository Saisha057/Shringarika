// Test login with detailed error reporting
async function testLogin() {
  try {
    console.log('\n🔐 Testing admin login...\n');

    const credentials = {
      email: 'shringarika11@gmail.com',
      password: 'Admin@123'
    };

    console.log('Attempting login with:');
    console.log('  Email:', credentials.email);
    console.log('  Password:', credentials.password);
    console.log('\nConnecting to backend...\n');

    const response = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials)
    });

    console.log('Response status:', response.status);
    console.log('Response OK:', response.ok);

    const data = await response.json();
    console.log('\nResponse data:', JSON.stringify(data, null, 2));

    if (response.ok && data.status === 'success') {
      console.log('\n✅ LOGIN SUCCESSFUL!');
      console.log('\nUser details:');
      console.log('  ID:', data.user?.id);
      console.log('  Email:', data.user?.email);
      console.log('  Name:', data.user?.name);
      console.log('  Role:', data.user?.role);
      console.log('\nToken details:');
      console.log('  Token exists:', !!data.token);
      console.log('  Token length:', data.token?.length);
      console.log('  Token preview:', data.token?.substring(0, 30) + '...');
      
      if (data.user?.role === 'admin') {
        console.log('\n👑 ADMIN ACCESS CONFIRMED!');
        console.log('\n✅ Login should work in browser now!');
      } else {
        console.log('\n⚠️  WARNING: User is not an admin!');
        console.log('   Role:', data.user?.role);
      }
    } else {
      console.log('\n❌ LOGIN FAILED!');
      console.log('\nError details:');
      console.log('  Status:', data.status);
      console.log('  Message:', data.message);
      
      if (response.status === 401) {
        console.log('\n🔑 Password issue detected!');
        console.log('   The password "Admin@123" is incorrect.');
        console.log('\n📋 Options:');
        console.log('   1. Try your actual password');
        console.log('   2. Reset password in Supabase');
        console.log('   3. Check if password is hashed correctly');
      }
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.log('\n⚠️  Make sure:');
    console.log('   1. Backend is running on port 5000');
    console.log('   2. Database is connected');
    console.log('   3. Network is working');
  }
}

testLogin();

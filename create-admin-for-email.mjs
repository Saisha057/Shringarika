// Create admin user with the email from your login attempt
async function createAdmin() {
  try {
    console.log('\n🔄 Creating admin account...\n');

    // Using the email you're trying to login with
    const adminData = {
      name: 'Shringarika Admin',
      email: 'shringarika11@gmail.com',
      password: 'Admin@123', // You can change this
      phone: '9999999999'
    };

    console.log('   Creating user with:');
    console.log('   Email:', adminData.email);
    console.log('   Password:', adminData.password);
    console.log('   Name:', adminData.name, '\n');

    const response = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(adminData)
    });

    const data = await response.json();

    if (response.ok && data.status === 'success') {
      console.log('✅ User created successfully!');
      console.log('\n⚠️  IMPORTANT: Now you need to set the admin role!');
      console.log('\n📋 Run this SQL query in Supabase SQL Editor:');
      console.log('─────────────────────────────────────────────────────');
      console.log(`UPDATE users SET role = 'admin' WHERE email = 'shringarika11@gmail.com';`);
      console.log('─────────────────────────────────────────────────────');
      console.log('\n🔗 Supabase SQL Editor:');
      console.log('   https://supabase.com/dashboard/project/_/sql');
      console.log('\n📝 After running the SQL query, login with:');
      console.log('   Email: shringarika11@gmail.com');
      console.log('   Password: Admin@123');
      console.log('\n🌐 Login at: http://localhost:3000/admin');
    } else {
      if (data.message && data.message.includes('already exists')) {
        console.log('ℹ️  User already exists!');
        console.log('\n📋 Make sure to set admin role with this SQL query:');
        console.log('─────────────────────────────────────────────────────');
        console.log(`UPDATE users SET role = 'admin' WHERE email = 'shringarika11@gmail.com';`);
        console.log('─────────────────────────────────────────────────────');
        console.log('\n🔗 https://supabase.com/dashboard/project/_/sql');
        console.log('\n📝 Then login with:');
        console.log('   Email: shringarika11@gmail.com');
        console.log('   Password: (your current password)');
      } else {
        console.log('❌ Failed to create user:', data.message);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n⚠️  Make sure the backend server is running on port 5000');
  }
}

createAdmin();
